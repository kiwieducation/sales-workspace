// app/api/wecom/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { wecomPullChatData } from "@/lib/wecom/msgaudit";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

/**
 * 简单 Bearer Token 校验
 * （保持你现有逻辑，不引入新 auth 体系）
 */
function checkAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return false;

  return token === process.env.WECOM_SYNC_TOKEN;
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    /**
     * =========================
     * diag 模式：只做环境与 native 检查
     * =========================
     */
    if (body?.diag === true) {
      return NextResponse.json({
        ok: true,
        diag: true,
        runtime: {
          node: process.version.replace(/^v/, ""),
          platform: process.platform,
          arch: process.arch,
        },
        ldLibraryPath: process.env.LD_LIBRARY_PATH || "",
        cwd: process.cwd(),
      });
    }

    /**
     * =========================
     * 参数解析（全部显式 number 化）
     * =========================
     */
    const seq = Number(body?.seq ?? 0);
    const limit = Number(body?.maxResults ?? body?.limit ?? 10);
    const timeout = Number(body?.timeout ?? 10);

    if (!Number.isFinite(seq) || !Number.isFinite(limit)) {
      return NextResponse.json(
        { ok: false, error: "invalid seq or limit" },
        { status: 400 }
      );
    }

    /**
     * =========================
     * ⚠️ 关键点：这里不再把任何 number
     * 传入 path.join / resolve
     * =========================
     *
     * 如果你之前有调试日志 / 临时文件，
     * 统一放到一个纯 string 的路径下
     */
    const workDir = path.join(process.cwd(), ".wecom");
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    /**
     * =========================
     * 真正拉取企业微信会话数据
     * =========================
     */
    const result = await wecomPullChatData({
      seq,
      limit,
      timeout,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    console.error("[wecom-sync] error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "internal error",
        name: err?.name,
        runtime: {
          node: process.version.replace(/^v/, ""),
          platform: process.platform,
          arch: process.arch,
        },
      },
      { status: 500 }
    );
  }
}
