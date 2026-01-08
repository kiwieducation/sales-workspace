// lib/wecom/msgaudit.ts
import crypto from "crypto";
import path from "path";

/**
 * ✅ 终局加载器（Next 16 + Vercel 稳定）：
 * - 不使用 require.resolve（避免 Turbopack/打包器静态解析）
 * - 不出现 "wework-chat-node/lib" 这种子路径字符串（你已经被它坑过）
 * - 只读取 wework-chat-node/package.json，然后按 pkg.main 拼出绝对入口文件加载
 */
type NodeRequireLike = ((id: string) => any) & { resolve?: (id: string) => string };

let _loaded: any = null;

function getReq(): NodeRequireLike {
  // eval("require")：保证是 runtime require，而不是被打包器改写
  return (eval("require") as any) as NodeRequireLike;
}

function loadWeWorkChatNode(): any {
  if (_loaded) return _loaded;

  const req = getReq();

  // 1) 读取 package.json（一定存在）
  const pkg = req("wework-chat-node/package.json") as { main?: string };

  // 2) 尽量拿到 package.json 的绝对路径（有 resolve 就用 resolve）
  const pkgJsonAbs =
    typeof req.resolve === "function"
      ? req.resolve("wework-chat-node/package.json")
      : null;

  // 3) 根据 pkg.main 拼出真实入口文件绝对路径加载
  const mainRel = (pkg?.main ? String(pkg.main) : "index.js").replace(/^\.\//, "");

  if (pkgJsonAbs) {
    const moduleRoot = path.dirname(pkgJsonAbs);
    const entryAbs = path.join(moduleRoot, mainRel);
    _loaded = req(entryAbs);
  } else {
    // 极端兜底：没有 resolve 的情况（通常不会发生在 Vercel Node runtime）
    _loaded = req("wework-chat-node");
  }

  _loaded = _loaded?.default ?? _loaded;
  return _loaded;
}

function env(name: string) {
  return (process.env[name] ?? "").trim();
}

function mustEnv(name: string) {
  const v = env(name);
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

function getCtor(mod: any) {
  if (typeof mod === "function") return mod;
  if (mod?.WeWorkChat) return mod.WeWorkChat;
  if (typeof mod?.default === "function") return mod.default;
  if (mod?.default?.WeWorkChat) return mod.default.WeWorkChat;
  return null;
}

function getClient() {
  const mod = loadWeWorkChatNode();
  const Ctor = getCtor(mod);
  if (!Ctor) {
    const keys = Object.keys(mod || {});
    throw new Error(`wework-chat-node export not found. keys=${keys.join(",")}`);
  }

  const corpId = mustEnv("WECOM_CORP_ID");

  // ✅ 统一：优先 WECOM_CORP_SECRET，兼容旧变量
  const secret = env("WECOM_CORP_SECRET") || env("WECOM_MSG_ARCHIVE_SECRET");
  if (!secret) throw new Error("missing env: WECOM_CORP_SECRET");

  const privateKeyRaw =
    env("WECOM_MSG_ARCHIVE_PRIVATE_KEY") ||
    env("WECOM_RSA_PRIVATE_KEY") ||
    env("WECOM_RSA_PRIVATE_KEY_PEM");
  if (!privateKeyRaw) throw new Error("missing env: WECOM_MSG_ARCHIVE_PRIVATE_KEY");

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  return new Ctor({ corpId, secret, privateKey });
}

export async function wecomPullChatData(args: {
  seq: number;
  limit: number;
  timeout: number;
}): Promise<{ pulled: number; nextSeq: number; items: any[] }> {
  const client: any = getClient();

  const res = await (async () => {
    // 常见：Promise 版
    if (typeof client.getChatData === "function" && client.getChatData.length <= 1) {
      return await client.getChatData({
        seq: args.seq,
        limit: args.limit,
        timeout: args.timeout,
      });
    }
    // 兼容 callback 版
    return await new Promise<any>((resolve, reject) => {
      client.getChatData(args.seq, args.limit, args.timeout, (err: any, data: any) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
  })();

  if (res?.errcode && res.errcode !== 0) {
    throw new Error(`getchatdata failed: ${res.errcode} ${res.errmsg || ""}`.trim());
  }

  const items = res?.chatdata ?? res?.items ?? [];
  const nextSeq = items.length ? items[items.length - 1].seq : args.seq;
  return { pulled: items.length, nextSeq, items };
}

export function decryptChatDataItem(item: any, rsaPrivateKeyPem: string) {
  const encRandomKeyB64 = item.encrypt_random_key;
  const encChatMsgB64 = item.encrypt_chat_msg;

  if (!encRandomKeyB64 || !encChatMsgB64) {
    throw new Error("invalid chatdata item: missing encrypt_random_key/encrypt_chat_msg");
  }

  const randomKey = crypto.privateDecrypt(
    { key: rsaPrivateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(encRandomKeyB64, "base64")
  );

  const aesKey = crypto.createHash("sha256").update(randomKey).digest();
  const iv = crypto.createHash("md5").update(randomKey).digest();

  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  const plain = Buffer.concat([
    decipher.update(Buffer.from(encChatMsgB64, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(plain.toString("utf8").trim());
}
