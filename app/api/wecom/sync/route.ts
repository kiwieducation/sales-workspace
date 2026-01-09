// app/api/wecom/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
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

async function nodeFetchProbe() {
  // 只验证：Vercel Node runtime 是否能建立 TLS 连接到企业微信域名
  try {
    const r = await fetch("https://qyapi.weixin.qq.com", { cache: "no-store" });
    return { ok: true, status: r.status };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function POST(req: NextRequest) {
  try {
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
          // 这些如果是 null/空，native libcurl/OpenSSL 可能就找不到 CA
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
