// lib/wecom/msgaudit.ts
import crypto from "crypto";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// —— 最小依赖：只在 Node 运行期加载 native 包，避免 turbopack/webpack 误处理
let cached: any = null;

function env(name: string) {
  return (process.env[name] ?? "").trim();
}
function mustEnv(name: string) {
  const v = env(name);
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

function ensureLdLibraryPath(moduleRoot: string) {
  const libDir = path.join(moduleRoot, "lib");
  const cur = process.env.LD_LIBRARY_PATH || "";
  const parts = cur.split(":").filter(Boolean);
  if (!parts.includes(libDir)) {
    process.env.LD_LIBRARY_PATH = [libDir, ...parts].join(":");
  }
}

function loadWeWork() {
  if (cached) return cached;

  // ✅ 固定从 node_modules 找 package.json，拿到真实 moduleRoot
  const pkgJsonPath = require.resolve("wework-chat-node/package.json");
  const moduleRoot = path.dirname(pkgJsonPath);

  // ✅ 先把 .so 所在目录放进 LD_LIBRARY_PATH
  ensureLdLibraryPath(moduleRoot);

  // ✅ 再 require 包本体（CJS），兼容 default export
  const mod = require("wework-chat-node");
  cached = mod?.default ? mod.default : mod;

  if (!cached?.WeWorkChat) {
    throw new Error("wework-chat-node export missing: WeWorkChat");
  }
  return cached;
}

export async function wecomPullChatData(args: {
  seq: number;
  limit: number;
  timeout: number;
}) {
  const corpId = mustEnv("WECOM_CORP_ID");
  const secret = env("WECOM_CORP_SECRET") || env("WECOM_MSG_ARCHIVE_SECRET");
  if (!secret) throw new Error("missing env: WECOM_CORP_SECRET");

  const privateKeyPemRaw = mustEnv("WECOM_MSG_ARCHIVE_PRIVATE_KEY");
  const privateKey = privateKeyPemRaw.replace(/\\n/g, "\n");

  const { WeWorkChat } = loadWeWork();
  const client = new WeWorkChat({ corpId, secret, privateKey });

  const res = await client.getChatData({
    seq: args.seq,
    limit: args.limit,
    timeout: args.timeout,
  });

  const items = res?.chatdata ?? [];
  const nextSeq = items.length ? Number(items[items.length - 1]?.seq ?? args.seq) : args.seq;

  if (res?.errcode && res.errcode !== 0) {
    throw new Error(`getchatdata failed: ${res.errcode} ${res.errmsg || ""}`.trim());
  }

  return { pulled: items.length, nextSeq, items };
}

export function decryptChatDataItem(item: any, rsaPrivateKeyPem: string) {
  const encRandomKeyB64 = item?.encrypt_random_key;
  const encChatMsgB64 = item?.encrypt_chat_msg;
  if (!encRandomKeyB64 || !encChatMsgB64) {
    throw new Error("invalid chatdata item: missing encrypt_random_key/encrypt_chat_msg");
  }

  // 1) RSA 解 randomKey
  const randomKey = crypto.privateDecrypt(
    {
      key: rsaPrivateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(encRandomKeyB64, "base64")
  );

  // 2) AES 解密
  const aesKey = crypto.createHash("sha256").update(randomKey).digest();
  const iv = crypto.createHash("md5").update(randomKey).digest();

  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  decipher.setAutoPadding(true);

  const plain = Buffer.concat([
    decipher.update(Buffer.from(encChatMsgB64, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plain);
}
