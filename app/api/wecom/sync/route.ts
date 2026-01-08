// app/api/wecom/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createRequire } from "module";
import nodePath from "path";
import fs from "fs";
import { wecomPullChatData } from "@/lib/wecom/msgaudit";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);

function bearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "").trim();
}

function expectedToken() {
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

function fileExists(p: string) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function listDirSafe(dir: string) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function runNativeDiag() {
  // 任何情况下都返回 JSON，不让 diag 本身炸 500
  const out: any = {
    runtime: {
      node: process.version.replace(/^v/, ""),
      platform: process.platform,
      arch: process.arch,
    },
    ldLibraryPath: process.env.LD_LIBRARY_PATH || "",
    paths: {
      cwd: process.cwd(),
      pkgJsonPath: "",
      moduleRoot: "",
      libDir: "",
      soPath: "",
      soExists: false,
      libFiles: [] as string[],
      hasWeWorkChatExport: null as null | boolean,
    },
    diagError: null as null | string,
  };

  try {
    // ✅ 强制字符串化，杜绝 number 混入
    const pkgJsonPath = String(
      require.resolve("wework-chat-node/package.json")
    );
    out.paths.pkgJsonPath = pkgJsonPath;

    const moduleRoot = nodePath.dirname(pkgJsonPath);
    out.paths.moduleRoot = moduleRoot;

    const libDir = nodePath.join(moduleRoot, "lib");
    out.paths.libDir = libDir;

    ensureLdLibraryPath(libDir);
    out.ldLibraryPath = process.env.LD_LIBRARY_PATH || "";

    const soPath = nodePath.join(libDir, "libWeWorkFinanceSdk_C.so");
    out.paths.soPath = soPath;
    out.paths.soExists = fileExists(soPath);
    out.paths.libFiles = listDirSafe(libDir);

    // 触发加载 native addon（如果失败也不炸，只记录错误）
    try {
      const mod = require("wework-chat-node");
      const resolved = mod?.default ? mod.default : mod;
      out.paths.hasWeWorkChatExport = Boolean(resolved?.WeWorkChat);
    } catch (e: any) {
      out.paths.hasWeWorkChatExport = false;
      out.diagError = out.diagError || (e?.message || String(e));
    }
  } catch (e: any) {
    out.diagError = e?.message || String(e);
  }

  return out;
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

    if (body?.diag === true) {
      const diag = runNativeDiag();
      return NextResponse.json({ ok: true, diag: true, ...diag });
    }

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

    // ✅ 不写盘 / 不 mkdir / 不碰 /var/task
    const result = await wecomPullChatData({ seq, limit, timeout });
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
