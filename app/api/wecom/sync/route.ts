// app/api/wecom/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { wecomPullChatData } from "@/lib/wecom/msgaudit";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);

function bearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "").trim();
}

function expectedToken() {
  // 保持兼容：你现在用的 token 可以放在 WECOM_SYNC_TOKEN
  // 如果你之前项目里叫别的，也支持几个常见名字，不引入新体系
  return (
    (process.env.WECOM_SYNC_TOKEN || "").trim() ||
    (process.env.WECOM_SYNC_BEARER_TOKEN || "").trim() ||
    (process.env.WECOM_SYNC_SECRET || "").trim()
  );
}

function checkAuth(req: NextRequest) {
  const got = bearerToken(req);
  const exp = expectedToken();
  return Boolean(got && exp && got === exp);
}

function ensureLdLibraryPath(libDir: string) {
  const cur = (process.env.LD_LIBRARY_PATH || "").trim();
  const parts = cur.split(":").filter(Boolean);

  if (!parts.includes(libDir)) {
    process.env.LD_LIBRARY_PATH = [libDir, ...parts].join(":");
  }
}

function safeListDir(dir: string) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function fileExists(p: string) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * diag：验证 Vercel Serverless 上 native 包是否真的在 /var/task/node_modules
 * 并确保 LD_LIBRARY_PATH 包含 wework-chat-node/lib
 */
function runNativeDiag() {
  let diagError: string | null = null;

  let pkgJsonPath = "";
  let moduleRoot = "";
  let libDir = "";
  let soPath = "";
  let soExists = false;
  let libFiles: string[] = [];
  let hasWeWorkChatExport: boolean | null = null;

  try {
    pkgJsonPath = require.resolve("wework-chat-node/package.json");
    moduleRoot = path.dirname(pkgJsonPath);
    libDir = path.join(moduleRoot, "lib");

    ensureLdLibraryPath(libDir);

    // 这个 so 名字是 wework-chat-node 常见的 SDK so（你之前 diag 里就是它）
    soPath = path.join(libDir, "libWeWorkFinanceSdk_C.so");
    soExists = fileExists(soPath);
    libFiles = safeListDir(libDir);

    // 尝试 require 包本体，验证导出（会触发 .node 加载）
    // 失败也不要影响 diag 返回，只记录 diagError
    const mod = require("wework-chat-node");
    const resolved = mod?.default ? mod.default : mod;
    hasWeWorkChatExport = Boolean(resolved?.WeWorkChat);
  } catch (e: any) {
    diagError = e?.message || String(e);
  }

  return {
    runtime: {
      node: process.version.replace(/^v/, ""),
      platform: process.platform,
      arch: process.arch,
    },
    ldLibraryPath: process.env.LD_LIBRARY_PATH || "",
    paths: {
      cwd: process.cwd(),
      pkgJsonPath,
      moduleRoot,
      libDir,
      soPath,
      soExists,
      libFiles,
      hasWeWorkChatExport,
    },
    diagError,
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // diag 模式：不依赖企业微信 env，不落盘，只做 native 诊断
    if (body?.diag === true) {
      const diag = runNativeDiag();
      return NextResponse.json({ ok: true, diag: true, ...diag });
    }

    // 参数解析：显式 number 化（避免任何奇怪类型传递）
    const seq = num(body?.seq ?? 0, 0);
    const limit = num(body?.maxResults ?? body?.limit ?? 10, 10);
    const timeout = num(body?.timeout ?? 10, 10);

    if (!Number.isFinite(seq) || seq < 0) {
      return NextResponse.json(
        { ok: false, error: "invalid seq" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(limit) || limit <= 0 || limit > 1000) {
      return NextResponse.json(
        { ok: false, error: "invalid maxResults/limit" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 300) {
      return NextResponse.json(
        { ok: false, error: "invalid timeout" },
        { status: 400 }
      );
    }

    // ✅ 不写 /var/task，不 mkdir，不落盘
    const result = await wecomPullChatData({
      seq,
      limit,
      timeout,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[wecom-sync] error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "internal error",
        name: err?.name,
        cause: err?.cause ?? null,
        hint: err?.hint ?? null,
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
