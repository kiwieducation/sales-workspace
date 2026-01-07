// app/api/wecom/sync/route.ts
import { NextResponse } from "next/server";
import { decryptChatDataItem, wecomPullChatData } from "@/lib/wecom/msgaudit";

export const runtime = "nodejs"; // 必须是 nodejs（不能 edge）
export const dynamic = "force-dynamic";

function env(name: string) {
  return (process.env[name] ?? "").trim();
}

function mustEnv(name: string) {
  const v = env(name);
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

function isDryRun() {
  // 约定：WECOM_SYNC_DRY_RUN = "0" 才真正拉取；其他都当 dry-run
  const v = env("WECOM_SYNC_DRY_RUN");
  return v !== "0";
}

export async function POST(req: Request) {
  try {
    // 1) Bearer token 保护
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const expected = mustEnv("WECOM_SYNC_TOKEN");
    if (!token || token !== expected) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    // 2) 参数
    const body = await req.json().catch(() => ({} as any));
    const seq = Number(body.seq ?? 0);
    const maxResults = Math.min(Number(body.maxResults ?? 50), 1000);
    const timeout = Math.min(Math.max(Number(body.timeout ?? 10), 1), 60);

    // 3) dry-run：只回 OK，不拉取
    if (isDryRun()) {
      return NextResponse.json({
        ok: true,
        where: process.env.VERCEL ? "vercel" : "local",
        dryRun: true,
        hint: 'Set WECOM_SYNC_DRY_RUN="0" to enable real pulling.',
      });
    }

    // 4) 真正拉取 + 解密示例
    const rsaPrivateKeyPem = mustEnv("WECOM_MSG_ARCHIVE_PRIVATE_KEY").replace(
      /\\n/g,
      "\n"
    );

    const pulledRet = await wecomPullChatData({
      seq,
      limit: maxResults,
      timeout,
    });

    const items = pulledRet.items ?? [];
    const pulled = pulledRet.pulled ?? items.length;
    const nextSeq = pulledRet.nextSeq ?? seq;

    // 解密第一条（用于验证链路是否通）
    let firstOk = false;
    let firstMsgid: string | null = null;
    let firstKeys: string[] | null = null;
    let firstPreview: any = null;
    let firstError: string | null = null;

    if (items.length > 0) {
      try {
        const dec = decryptChatDataItem(items[0], rsaPrivateKeyPem);
        firstOk = true;
        firstMsgid = dec?.msgid ?? null;
        firstKeys = dec ? Object.keys(dec) : null;
        // 只给一个轻量 preview，避免把敏感内容全返回
        firstPreview = {
          msgid: dec?.msgid,
          action: dec?.action,
          from: dec?.from,
          tolist: dec?.tolist,
          roomid: dec?.roomid,
          msgtype: dec?.msgtype,
          msgtime: dec?.msgtime,
        };
      } catch (e: any) {
        firstError = e?.message || String(e);
      }
    }

    return NextResponse.json({
      ok: true,
      where: process.env.VERCEL ? "vercel" : "local",
      dryRun: false,
      seq,
      pulled,
      nextSeq,
      firstOk,
      firstMsgid,
      firstKeys,
      firstPreview,
      firstError,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || String(e),
        name: e?.name || "Error",
        cause: e?.cause?.message || e?.cause || null,
      },
      { status: 500 }
    );
  }
}