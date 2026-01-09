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

export async function POST(req: NextRequest) {
  try {
    // 1) 鉴权
    if (!isAuthed(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));

    // 2) 诊断模式（只看运行环境，不调用接口）
    if (body?.diag === true) {
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
          hasPrivateKey: Boolean(process.env.WECOM_MSG_ARCHIVE_PRIVATE_KEY),
          hasSyncToken: Boolean(process.env.WECOM_SYNC_TOKEN),
        },
      });
    }

    // 3) 参数校验
    const seq = Number(body?.seq ?? 0);
    const limit = Number(body?.maxResults ?? 100);
    const timeout = Number(body?.timeout ?? 30);

    if (!Number.isFinite(seq) || seq < 0) {
      return json({ ok: false, error: "invalid seq" }, 400);
    }

    // 4) 真正调用会话内容存档
    try {
      const result = await wecomPullChatData({
        seq,
        limit,
        timeout,
      });

      return json({
        ok: true,
        ...result,
      });
    } catch (err: any) {
      // 关键：把 ret/errmsg 原样返回
      return json(
        {
          ok: false,
          error: err?.message || String(err),
          name: err?.name,
        },
        500
      );
    }
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: err?.message || String(err),
        name: err?.name,
      },
      500
    );
  }
}
