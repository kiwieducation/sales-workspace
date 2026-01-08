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

function safeExists(p: string) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function ensureSymlink(linkPath: string, targetPath: string) {
  try {
    const st = fs.lstatSync(linkPath);
    if (st.isSymbolicLink()) return;
    // if it exists but not symlink, leave it (don’t break)
    return;
  } catch {
    // not exist
  }
  try {
    fs.symlinkSync(targetPath, linkPath, "dir");
  } catch {
    // ignore
  }
}

/**
 * Runtime shim:
 * Native binaries will reference "/tmp/vercelp0/node_modules/..."
 * Create /tmp/vercelp0 and symlink node_modules -> /var/task/node_modules
 */
function ensureVercelPathShim() {
  if (process.platform !== "linux") return;

  const shimRoot = "/tmp/vercelp0";
  const shimNodeModules = path.join(shimRoot, "node_modules");
  const realNodeModules = path.join(process.cwd(), "node_modules"); // /var/task/node_modules

  try {
    ensureDir(shimRoot);
    if (safeExists(realNodeModules)) {
      ensureSymlink(shimNodeModules, realNodeModules);
    }
  } catch {
    // ignore
  }
}

function ensureLdLibraryPath(moduleRoot: string) {
  const libDir = path.join(moduleRoot, "lib");
  const cur = process.env.LD_LIBRARY_PATH || "";
  const parts = cur.split(":").filter(Boolean);
  if (!parts.includes(libDir)) {
    process.env.LD_LIBRARY_PATH = [libDir, ...parts].join(":");
  }
}

function findWeworkPkgJsonByFs() {
  const base = process.cwd(); // /var/task
  const p = path.join(base, "node_modules", "wework-chat-node", "package.json");
  if (safeExists(p)) return p;
  throw new Error("wework-chat-node package.json not found under /var/task/node_modules");
}

function loadWeWork() {
  if (cached) return cached;

  // ✅ ensure shim first
  ensureVercelPathShim();

  // ✅ resolve moduleRoot via fs (avoid require.resolve numeric id issue)
  const pkgJsonPath = findWeworkPkgJsonByFs();
  const moduleRoot = path.dirname(pkgJsonPath);

  // ✅ LD_LIBRARY_PATH must include lib dir
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
