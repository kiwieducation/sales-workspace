// lib/wecom/msgaudit.ts
import crypto from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// wework-chat-node 是 native addon + CommonJS
type WeWorkChatCtor = new (opts: {
  corpId: string;
  secret: string;
  privateKey: string;
}) => {
  getChatData: (args: {
    seq: number;
    limit: number;
    timeout: number;
  }) => Promise<{
    errcode?: number;
    errmsg?: string;
    chatdata?: any[];
  }>;
};

let WeWorkChatCached: WeWorkChatCtor | null = null;

function env(name: string) {
  return (process.env[name] ?? "").trim();
}

function mustEnv(name: string) {
  const v = env(name);
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

/**
 * 终局加载策略（稳定）：
 * - 不 require("wework-chat-node")（它会走 package.json main，线上可能缺 index.js）
 * - 优先 require 子路径（通常是 lib/**），绕开 main
 * - 多候选兜底，避免未来包结构小改就炸
 */
function requireWeWorkModule(): any {
  const candidates = [
    "wework-chat-node/lib",          // ✅ 最常见
    "wework-chat-node/lib/index.js", // ✅ 保险
    "wework-chat-node/dist",         // 兼容少数打包方式
    "wework-chat-node/dist/index.js",
  ];

  const errors: string[] = [];

  for (const id of candidates) {
    try {
      // 先 resolve，再 require（更好诊断）
      const resolved = require.resolve(id);
      return require(resolved);
    } catch (e: any) {
      errors.push(`${id}: ${e?.message || String(e)}`);
    }
  }

  // 最后才尝试包根（可选：你也可以直接注释掉这段）
  try {
    const resolved = require.resolve("wework-chat-node");
    return require(resolved);
  } catch (e: any) {
    errors.push(`wework-chat-node(root): ${e?.message || String(e)}`);
  }

  throw new Error(
    "wework-chat-node load failed. Tried:\n" + errors.map((s) => `- ${s}`).join("\n")
  );
}

function getWeWorkChatCtor(): WeWorkChatCtor {
  if (WeWorkChatCached) return WeWorkChatCached;

  // 兼容 CommonJS / default export / named export
  const pkg = requireWeWorkModule();
  const mod = pkg?.default ?? pkg;

  const ctor =
    mod?.WeWorkChat ||
    mod?.weworkChat ||
    mod?.default?.WeWorkChat ||
    pkg?.WeWorkChat;

  if (!ctor) {
    const keys = Object.keys(mod || {});
    throw new Error(`wework-chat-node: cannot find WeWorkChat export. keys=${keys.join(",")}`);
  }

  WeWorkChatCached = ctor as WeWorkChatCtor;
  return WeWorkChatCached;
}

function getWeWorkClient() {
  const corpId = mustEnv("WECOM_CORP_ID");

  // ✅ 统一用 WECOM_CORP_SECRET（你现在 Vercel 上也是这个）
  // 兼容老变量（如果你本地还留着 WECOM_MSG_ARCHIVE_SECRET）
  const secret = env("WECOM_CORP_SECRET") || env("WECOM_MSG_ARCHIVE_SECRET");
  if (!secret) throw new Error("missing env: WECOM_CORP_SECRET");

  // ✅ 统一用 WECOM_MSG_ARCHIVE_PRIVATE_KEY
  const privateKeyRaw =
    env("WECOM_MSG_ARCHIVE_PRIVATE_KEY") ||
    env("WECOM_RSA_PRIVATE_KEY") ||
    env("WECOM_RSA_PRIVATE_KEY_PEM");
  if (!privateKeyRaw) throw new Error("missing env: WECOM_MSG_ARCHIVE_PRIVATE_KEY");

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const WeWorkChat = getWeWorkChatCtor();
  return new WeWorkChat({ corpId, secret, privateKey });
}

export async function wecomPullChatData(args: {
  seq: number;
  limit: number;
  timeout: number;
}): Promise<{ pulled: number; nextSeq: number; items: any[] }> {
  const client = getWeWorkClient();
  const res = await client.getChatData({
    seq: args.seq,
    limit: args.limit,
    timeout: args.timeout,
  });

  if (res.errcode && res.errcode !== 0) {
    throw new Error(`getchatdata failed: ${res.errcode} ${res.errmsg || ""}`.trim());
  }

  const items = res.chatdata ?? [];
  const nextSeq = items.length ? items[items.length - 1].seq : args.seq;

  return { pulled: items.length, nextSeq, items };
}

/**
 * 解密单条 chatdata（企业微信会话存档返回的加密结构）
 * item 里一般会有 encrypt_random_key / encrypt_chat_msg
 */
export function decryptChatDataItem(item: any, rsaPrivateKeyPem: string) {
  const encRandomKeyB64 = item.encrypt_random_key;
  const encChatMsgB64 = item.encrypt_chat_msg;

  if (!encRandomKeyB64 || !encChatMsgB64) {
    throw new Error("invalid chatdata item: missing encrypt_random_key/encrypt_chat_msg");
  }

  // 1) RSA 解出随机 key（16 bytes）
  const randomKey = crypto.privateDecrypt(
    {
      key: rsaPrivateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(encRandomKeyB64, "base64")
  );

  // 2) AES-256-CBC 解密 chat msg（常见实现：aesKey=sha256(randomKey), iv=md5(randomKey)）
  const aesKey = crypto.createHash("sha256").update(randomKey).digest(); // 32 bytes
  const iv = crypto.createHash("md5").update(randomKey).digest(); // 16 bytes

  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  const plain = Buffer.concat([
    decipher.update(Buffer.from(encChatMsgB64, "base64")),
    decipher.final(),
  ]);

  // 3) JSON parse
  const text = plain.toString("utf8").trim();
  return JSON.parse(text);
}
