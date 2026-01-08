// lib/wecom/msgaudit.ts
import crypto from "crypto";
import path from "path";

/**
 * ✅ 终局加载器：完全 runtime 决策，避免 Turbopack 静态解析
 * - 不使用 require.resolve
 * - 不写 "wework-chat-node/lib" 这类子路径常量
 * - 通过读取 package.json 的 main 字段 + moduleRoot 计算出真实入口文件路径
 */
let _mod: any = null;

function getWeWorkModule(): any {
  if (_mod) return _mod;

  const req = (eval("require") as any) as (id: string) => any;

  // 1) 读取 package.json（这是固定存在的文件）
  const pkgJsonPath = req("wework-chat-node/package.json") && req.resolve
    ? req.resolve("wework-chat-node/package.json")
    : null;

  // 某些环境下 eval(require) 没有 resolve，我们用 __dirname 相对推断会不可靠；
  // 所以这里 fallback：直接 require package.json 对象，不依赖 resolve。
  const pkg = req("wework-chat-node/package.json");
  const mainRel = (pkg && pkg.main) ? String(pkg.main) : "index.js";

  // 2) 计算 moduleRoot：优先用 resolve 的绝对路径，否则用 package.json 自身路径推断
  let moduleRoot: string | null = null;
  if (pkgJsonPath && typeof pkgJsonPath === "string") {
    moduleRoot = path.dirname(pkgJsonPath);
  } else {
    // fallback：require("wework-chat-node/package.json") 返回对象没路径，那就只能尝试包根（可能失败）
    // 但在 Vercel runtime 中通常 req.resolve 是存在的
    moduleRoot = null;
  }

  // 3) 优先用绝对路径加载 main，避免 "main 指向不存在的 index.js" 的老坑
  if (moduleRoot) {
    const entry = path.join(moduleRoot, mainRel);
    _mod = req(entry);
  } else {
    // 最后兜底：直接包根（如果包 main 正常会成功；如果 main 坏，会和之前一样失败）
    _mod = req("wework-chat-node");
  }

  _mod = _mod?.default ?? _mod;
  return _mod;
}

function env(name: string) {
  return (process.env[name] ?? "").trim();
}

function mustEnv(name: string) {
  const v = env(name);
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

/**
 * wework-chat-node 的导出形态各版本可能不同，这里做兼容提取
 */
function getCtor(mod: any) {
  // 常见形态：module.exports = WeWorkChat
  if (typeof mod === "function") return mod;
  // 或 { WeWorkChat: ... }
  if (mod?.WeWorkChat) return mod.WeWorkChat;
  // 或 { default: ... }
  if (typeof mod?.default === "function") return mod.default;
  if (mod?.default?.WeWorkChat) return mod.default.WeWorkChat;
  return null;
}

function getClient() {
  const mod = getWeWorkModule();
  const Ctor = getCtor(mod);
  if (!Ctor) {
    const keys = Object.keys(mod || {});
    throw new Error(`wework-chat-node export not found. keys=${keys.join(",")}`);
  }

  const corpId = mustEnv("WECOM_CORP_ID");
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

  // 兼容两种 API：
  // - client.getChatData({seq,limit,timeout}) -> Promise
  // - client.getChatData(seq,limit,timeout, cb)
  const res = await (async () => {
    if (typeof client.getChatData === "function" && client.getChatData.length <= 1) {
      return await client.getChatData({
        seq: args.seq,
        limit: args.limit,
        timeout: args.timeout,
      });
    }
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

/**
 * 解密单条 chatdata（你 route.ts 里会用它做 firstPreview）
 * 这里提供一个不依赖 SDK 的纯 JS 解密（若 SDK 自带 decrypt 也可改用 SDK）
 */
export function decryptChatDataItem(item: any, rsaPrivateKeyPem: string) {
  const encRandomKeyB64 = item.encrypt_random_key;
  const encChatMsgB64 = item.encrypt_chat_msg;

  if (!encRandomKeyB64 || !encChatMsgB64) {
    throw new Error("invalid chatdata item: missing encrypt_random_key/encrypt_chat_msg");
  }

  const randomKey = crypto.privateDecrypt(
    {
      key: rsaPrivateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(encRandomKeyB64, "base64")
  );

  const aesKey = crypto.createHash("sha256").update(randomKey).digest();
  const iv = crypto.createHash("md5").update(randomKey).digest();

  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  const plain = Buffer.concat([
    decipher.update(Buffer.from(encChatMsgB64, "base64")),
    decipher.final(),
  ]);

  const text = plain.toString("utf8").trim();
  return JSON.parse(text);
}
