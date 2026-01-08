// lib/wecom/msgaudit.ts
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let cached: any = null;

function env(name: string) {
  return (process.env[name] ?? "").trim();
}
function mustEnv(name: string) {
  const v = env(name);
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

function safeExists(p: unknown) {
  try {
    const s = String(p ?? "");
    if (!s) return false;
    fs.accessSync(s, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 终局：不要用 require.resolve 定位包路径（会被 webpack 替换成数字 module id）
 * 用 fs 从 cwd 向上找 /node_modules/wework-chat-node/package.json
 */
function findWeworkPkgJsonByFs() {
  const candidates: string[] = [];

  let cur = process.cwd();
  for (let i = 0; i < 8; i++) {
    candidates.push(path.join(cur, "node_modules", "wework-chat-node", "package.json"));
    candidates.push(path.join(cur, "node_modules", ".pnpm", "wework-chat-node", "package.json"));
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  for (const p of candidates) {
    if (safeExists(p)) return p;
  }

  throw new Error(`wework-chat-node package.json not found via fs`);
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

  const pkgJsonPath = findWeworkPkgJsonByFs();
  const moduleRoot = path.dirname(pkgJsonPath);

  ensureLdLibraryPath(moduleRoot);

  const mod = require("wework-chat-node");
  cached = mod?.default ? mod.default : mod;

  if (!cached?.WeWorkChat) {
    throw new Error("wework-chat-node export missing: WeWorkChat");
  }
  return cached;
}

export async function wecomPullChatData(args: { seq: number; limit: number; timeout: number }) {
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

  const randomKey = crypto.privateDecrypt(
    { key: rsaPrivateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(encRandomKeyB64, "base64")
  );

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
