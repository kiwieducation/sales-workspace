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
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {
    // ignore
  }
}

function ensureSymlink(linkPath: string, targetPath: string) {
  try {
    const st = fs.lstatSync(linkPath);
    if (st.isSymbolicLink()) return;
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
 * Some native builds embed absolute prefix like "/tmp/vercelp0/node_modules/..."
 * Ensure "/tmp/vercelp0/node_modules" points to "/var/task/node_modules".
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

/**
 * native SDK (libcurl/OpenSSL) needs CA bundle for TLS; Node options don't affect it.
 */
function ensureNativeCaBundle() {
  if (process.platform !== "linux") return;

  // do not override if user set explicitly
  if (process.env.SSL_CERT_FILE || process.env.CURL_CA_BUNDLE) return;

  const candidates = [
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
    "/etc/ssl/ca-bundle.pem",
    "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem",
  ];

  const found = candidates.find((p) => safeExists(p));
  if (found) {
    process.env.SSL_CERT_FILE = found;
    process.env.CURL_CA_BUNDLE = found;
    if (!process.env.SSL_CERT_DIR && safeExists("/etc/ssl/certs")) {
      process.env.SSL_CERT_DIR = "/etc/ssl/certs";
    }
  }
}

function findWeworkPkgJsonByFs() {
  const base = process.cwd(); // /var/task on Vercel
  const p = path.join(base, "node_modules", "wework-chat-node", "package.json");
  if (safeExists(p)) return p;
  throw new Error("wework-chat-node package.json not found under /var/task/node_modules");
}

function loadWeWork() {
  if (cached) return cached;

  ensureNativeCaBundle();
  ensureVercelPathShim();

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

export async function wecomPullChatData(args: {
  seq: number;
  limit: number;
  timeout: number;
}) {
  const corpId = mustEnv("WECOM_CORP_ID");

  // Prefer archive secret (clear semantics)
  const secret = env("WECOM_MSG_ARCHIVE_SECRET") || env("WECOM_CORP_SECRET");
  if (!secret) {
    throw new Error("missing env: WECOM_MSG_ARCHIVE_SECRET or WECOM_CORP_SECRET");
  }

  const privateKeyPemRaw = mustEnv("WECOM_MSG_ARCHIVE_PRIVATE_KEY");
  const privateKey = privateKeyPemRaw.replace(/\\n/g, "\n");

  const { WeWorkChat } = loadWeWork();
  const client = new WeWorkChat({ corpId, secret, privateKey });

  const res = await client.getChatData({
    seq: args.seq,
    limit: args.limit,
    timeout: args.timeout,
  });

  // If wrapper exposes errcode/errmsg, surface it
  const errcode = (res as any)?.errcode;
  const errmsg = (res as any)?.errmsg;
  if (errcode !== undefined && Number(errcode) !== 0) {
    throw new Error(
      `getchatdata failed: errcode=${errcode} errmsg=${String(errmsg || "").trim().slice(0, 500)}`
    );
  }

  const items = (res as any)?.chatdata ?? [];
  const nextSeq = items.length
    ? Number(items[items.length - 1]?.seq ?? args.seq)
    : args.seq;

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
