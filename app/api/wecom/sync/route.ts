// app/api/wecom/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { wecomPullChatData } from "@/lib/wecom/msgaudit";

export const runtime = "nodejs";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function isAuthed(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = process.env.WECOM_SYNC_TOKEN || "";
  return Boolean(token) && auth === `Bearer ${token}`;
}

function fileReadable(p: string) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * ✅ 终局：在 route 层注入 native TLS 的 CA bundle
 * - 影响 libcurl/OpenSSL（wework-chat-node 内部）
 * - 不依赖 Node 的 TLS/证书行为
 * - 只要 Vercel runtime 有任意一个 CA 路径存在，就能稳定工作
 */
function ensureNativeCaBundleEnv() {
  // 如果用户已经手动配置了，就不覆盖
  if (process.env.SSL_CERT_FILE || process.env.CURL_CA_BUNDLE) return;

  const candidates = [
    "/etc/ssl/certs/ca-certificates.crt", // Debian/Ubuntu
    "/etc/pki/tls/certs/ca-bundle.crt", // RHEL/CentOS
    "/etc/ssl/ca-bundle.pem",
    "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem",
  ];

  const found = candidates.find((p) => fileReadable(p));
  if (found) {
    process.env.SSL_CERT_FILE = found;
    process.env.CURL_CA_BUNDLE = found;
    if (!process.env.SSL_CERT_DIR && fileReadable("/etc/ssl/certs")) {
      process.env.SSL_CERT_DIR = "/etc/ssl/certs";
    }
  }
}

async function nodeFetchProbe() {
  try {
    const r = await fetch("https://qyapi.weixin.qq.com", { cache: "no-store" });
    return { ok: true, status: r.status };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ 必须最早执行：确保后续 native SDK 发 HTTPS 时有 CA
    ensureNativeCaBundleEnv();

    if (!isAuthed(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));

    if (body?.diag === true) {
      const probe = await nodeFetchProbe();
      return json({
        ok: true,
        diag: true,
        runtime: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        env: {
          hasCorpId: Boolean(process.env.WECOM_CORP_ID),
          hasCorpSecret: Boolean(process.env.WECOM_CORP_SECRET),
          hasArchiveSecret: Boolean(process.env.WECOM_MSG_ARCHIVE_SECRET),
          hasPrivateKey: Boolean(process.env.WECOM_MSG_ARCHIVE_PRIVATE_KEY),
          hasSyncToken: Boolean(process.env.WECOM_SYNC_TOKEN),
        },
        tlsEnv: {
          SSL_CERT_FILE: process.env.SSL_CERT_FILE || null,
          SSL_CERT_DIR: process.env.SSL_CERT_DIR || null,
          CURL_CA_BUNDLE: process.env.CURL_CA_BUNDLE || null,
          NODE_OPTIONS: process.env.NODE_OPTIONS || null,
          LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || null,
        },
        nodeFetchProbe: probe,
      });
    }

    const seq = Number(body?.seq ?? 0);
    const limit = Number(body?.maxResults ?? 1);
    const timeout = Number(body?.timeout ?? 1);

    const result = await wecomPullChatData({ seq, limit, timeout });
    return json({ ok: true, ...result });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: String(e?.message || e),
        name: e?.name || "Error",
      },
      500
    );
  }
}
