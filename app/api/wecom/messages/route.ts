// app/api/wecom/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    // 1) 用户态 client（cookie auth → RLS 生效）
    const supabase = await createServerSupabaseClient();

    // 未登录检查
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2) 解析参数
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const cursor = searchParams.get("cursor"); // ISO string

    // 3) 查询 wechat_messages（RLS 自动过滤）
    let q = supabase
      .from("wechat_messages")
      .select(
        "msg_id, from_user_id, to_user_id, room_id, msg_type, content, send_time"
      )
      .order("send_time", { ascending: false })
      .limit(limit);

    if (cursor) q = q.lt("send_time", cursor);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: `Supabase query error: ${error.message}`,
          debug: { limit, cursor, ms: Date.now() - startedAt },
        },
        { status: 500 }
      );
    }

    const items = data ?? [];
    const nextCursor = items.length
      ? (items[items.length - 1] as any).send_time
      : null;

    return NextResponse.json({
      ok: true,
      items,
      nextCursor,
      debug: { ms: Date.now() - startedAt },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unhandled exception",
        detail: { message: e?.message || String(e) },
      },
      { status: 500 }
    );
  }
}
