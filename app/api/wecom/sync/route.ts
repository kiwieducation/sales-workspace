// app/api/wecom/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { wecomPullChatData } from "@/lib/wecom/msgaudit";

export const runtime = "nodejs";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function isAuthed(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = process.env.WECOM_SYNC_AUTH_TOKEN || "";
  return Boolean(token) && auth === `Bearer ${token}`;
}

async function nodeFetchProbe() {
  try {
    const r = await fetch("https://qyapi.weixin.qq.com", {
      method: "GET",
      cache: "no-store",
    });
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

    const body = await req.json().catch(() => ({} as any));
    const diag = Boolean(body?.diag);

    if (diag) {
      const probe = await nodeFetchProbe();
      return json({
        ok: true,
        diag: true,
        runtime: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
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
    const maxResults = Number(body?.maxResults ?? 1);
    const timeout = Number(body?.timeout ?? 1);

    if (!Number.isFinite(seq) || seq < 0) return json({ ok: false, error: "invalid seq" }, 400);
    if (!Number.isFinite(maxResults) || maxResults <= 0 || maxResults > 1000)
      return json({ ok: false, error: "invalid maxResults" }, 400);
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 60)
      return json({ ok: false, error: "invalid timeout" }, 400);

    const res = await wecomPullChatData({ seq, limit: maxResults, timeout });
    return json({ ok: true, ...res });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: String(e?.message || e),
        name: e?.name || "Error",
        runtime: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      },
      500
    );
  }
}
