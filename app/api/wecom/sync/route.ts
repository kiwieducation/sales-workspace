// app/api/wecom/sync/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  return String(process.env[name] ?? "").trim();
}
function mustEnv(name: string) {
  const v = env(name);
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

function safeExists(p: unknown) {
  try {
    const s = String(p ?? "");
    if (!s) return false;
    fs.accessSync(s, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function safeReadDir(p: unknown, limit = 80) {
  try {
    const s = String(p ?? "");
    if (!s) return [];
    return fs.readdirSync(s).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * 终局：不要用 require.resolve（会被 webpack 替换成数字 module id）
 * 用 fs 从 /var/task (cwd) 向上找 node_modules/wework-chat-node/package.json
 */
function findWeworkPkgJsonByFs() {
  const candidates: string[] = [];

  let cur = process.cwd();
  for (let i = 0; i < 8; i++) {
    candidates.push(path.join(cur, "node_modules", "wework-chat-node", "package.json"));
    // 兜底：如果未来换 pnpm/特殊布局，也至少尝试一下
    candidates.push(path.join(cur, "node_modules", ".pnpm", "wework-chat-node", "package.json"));

    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  for (const p of candidates) {
    if (safeExists(p)) return p;
  }

  throw new Error(
    `wework-chat-node package.json not found via fs. tried: ${candidates.join(" | ")}`
  );
}

function ensureLdLibraryPath(weworkLibDir?: string) {
  if (process.platform !== "linux") return String(process.env.LD_LIBRARY_PATH || "");

  const parts = [
    safeExists(weworkLibDir) ? String(weworkLibDir) : "",
    process.env.LD_LIBRARY_PATH || "",
  ].filter(Boolean);

  process.env.LD_LIBRARY_PATH = parts.join(":");
  return process.env.LD_LIBRARY_PATH;
}

function resolveWeworkPaths() {
  const cwd = process.cwd();
  const pkgJsonPath = findWeworkPkgJsonByFs();
  const moduleRoot = path.dirname(pkgJsonPath);
  const libDir = path.join(moduleRoot, "lib");
  const soPath = path.join(libDir, "libWeWorkFinanceSdk_C.so");

  return {
    cwd,
    pkgJsonPath,
    moduleRoot,
    libDir,
    soPath,
    soExists: safeExists(soPath),
    libFiles: safeExists(libDir) ? safeReadDir(libDir, 120) : [],
  };
}

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: Request) {
  try {
    // 1) Bearer token
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const expected = mustEnv("WECOM_SYNC_TOKEN");

    if (!token || token !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // 2) body
    const body = (await req.json().catch(() => ({}))) as any;

    // 3) diag：验证 native 包是否真实在 /var/task/node_modules
    if (body?.diag === true) {
      let paths: any = null;
      let diagError: string | null = null;

      try {
        paths = resolveWeworkPaths();
        ensureLdLibraryPath(paths?.libDir);
      } catch (e: any) {
        diagError = e?.message || String(e);
      }

      return NextResponse.json({
        ok: true,
        diag: true,
        runtime: { node: process.versions.node, platform: process.platform, arch: process.arch },
        ldLibraryPath: String(process.env.LD_LIBRARY_PATH || ""),
        paths,
        diagError,
      });
    }

    // 4) params
    const seq = num(body?.seq ?? 0, 0);
    const maxResults = Math.min(num(body?.maxResults ?? 50, 50), 1000);
    const timeout = Math.min(Math.max(num(body?.timeout ?? 10, 10), 1), 60);

    // 5) 在加载 native 前设置 LD_LIBRARY_PATH（终局必做）
    try {
      const nativeInfo = resolveWeworkPaths();
      ensureLdLibraryPath(nativeInfo?.libDir);
    } catch {
      // 不阻断，让真正加载时报错（会在返回 JSON 里看到）
    }

    // 6) 延迟 import（避免初始化阶段触发 native）
    const { wecomPullChatData, decryptChatDataItem } = await import("@/lib/wecom/msgaudit");

    const rsaPrivateKeyPem = mustEnv("WECOM_MSG_ARCHIVE_PRIVATE_KEY").replace(/\\n/g, "\n");

    const pulledRet = await wecomPullChatData({ seq, limit: maxResults, timeout });

    const items = pulledRet.items ?? [];
    const nextSeq = pulledRet.nextSeq ?? seq;

    // 解密第一条验证链路
    let firstOk = false;
    let firstMsgid: string | null = null;
    let firstError: string | null = null;

    if (items.length > 0) {
      try {
        const dec = decryptChatDataItem(items[0], rsaPrivateKeyPem);
        firstOk = true;
        firstMsgid = dec?.msgid ?? null;
      } catch (e: any) {
        firstError = e?.message || String(e);
      }
    }

    return NextResponse.json({
      ok: true,
      seq,
      pulled: pulledRet.pulled ?? items.length,
      nextSeq,
      firstOk,
      firstMsgid,
      firstError,
      runtime: { node: process.versions.node, platform: process.platform, arch: process.arch },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        name: e?.name || "Error",
        cause: e?.cause?.message || e?.cause || null,
        runtime: { node: process.versions.node, platform: process.platform, arch: process.arch },
      },
      { status: 500 }
    );
  }
}
