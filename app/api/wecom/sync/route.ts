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
  const token = (process.env.WECOM_SYNC_TOKEN || "").trim();
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
 * ✅ 给 native libcurl/OpenSSL 指定 CA bundle
 * 让 wework-chat-node 的 HTTPS 校验在 Serverless 环境稳定可复现
 */
function ensureNativeCaBundleEnv() {
  if (process.env.SSL_CERT_FILE || process.env.CURL_CA_BUNDLE) return;

  const candidates = [
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
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

/**
 * ✅ 用同一套 corpId+secret 调 gettoken
 * - 不回传 access_token，避免泄露
 * - 用来“一刀切”判断 secret/corpId 是否正确
 */
async function wecomGetTokenProbe() {
  const corpId = (process.env.WECOM_CORP_ID || "").trim();
  const secret = (
    process.env.WECOM_MSG_ARCHIVE_SECRET ||
    process.env.WECOM_CORP_SECRET ||
    ""
  ).trim();

  if (!corpId || !secret) {
    return {
      ok: false,
      error: "missing WECOM_CORP_ID or (WECOM_MSG_ARCHIVE_SECRET/WECOM_CORP_SECRET)",
    };
  }

  try {
    const url =
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken` +
      `?corpid=${encodeURIComponent(corpId)}` +
      `&corpsecret=${encodeURIComponent(secret)}`;

    const r = await fetch(url, { cache: "no-store" });
    const j: any = await r.json().catch(() => ({}));

    return {
      ok: true,
      httpStatus: r.status,
      errcode: j?.errcode,
      errmsg: j?.errmsg,
      hasAccessToken: Boolean(j?.access_token),
      expiresIn: typeof j?.expires_in === "number" ? j.expires_in : null,
      // 只告诉你用的是哪一个 secret 名称（不泄露值）
      usingSecret: process.env.WECOM_MSG_ARCHIVE_SECRET
        ? "WECOM_MSG_ARCHIVE_SECRET"
        : process.env.WECOM_CORP_SECRET
        ? "WECOM_CORP_SECRET"
        : "NONE",
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ 最早注入：确保后续 native SDK 发 HTTPS 时有 CA
    ensureNativeCaBundleEnv();

    if (!isAuthed(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({} as any));

    if (body?.diag === true) {
      const [probe, tokenProbe] = await Promise.all([
        nodeFetchProbe(),
        wecomGetTokenProbe(),
      ]);

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
        wecomGetTokenProbe: tokenProbe,
      });
    }

    const seq = Number(body?.seq ?? 0);
    const limit = Number(body?.maxResults ?? 1);
    const timeout = Number(body?.timeout ?? 1);

    if (!Number.isFinite(seq) || seq < 0) {
      return json({ ok: false, error: "invalid seq" }, 400);
    }
    if (!Number.isFinite(limit) || limit <= 0 || limit > 1000) {
      return json({ ok: false, error: "invalid maxResults" }, 400);
    }
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 60) {
      return json({ ok: false, error: "invalid timeout" }, 400);
    }

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
