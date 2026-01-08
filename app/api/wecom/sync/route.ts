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

function isDryRun() {
  // WECOM_SYNC_DRY_RUN = "0" 才真正拉取；其他都当 dry-run
  return env("WECOM_SYNC_DRY_RUN") !== "0";
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

function findPkgJsonByFs() {
  // 在 Vercel serverless 里通常 cwd=/var/task
  // 我们直接用 fs 来定位 node_modules，而不是 require.resolve（会被打包替换成数字 id）
  const candidates: string[] = [];

  const cwd = process.cwd();
  // 从 cwd 开始向上找 6 层（足够覆盖 /var/task 以及本地构建差异）
  let cur = cwd;
  for (let i = 0; i < 6; i++) {
    candidates.push(path.join(cur, "node_modules", "wework-chat-node", "package.json"));
    candidates.push(path.join(cur, "node_modules", ".pnpm", "wework-chat-node", "package.json")); // 兜底
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  for (const p of candidates) {
    if (safeExists(p)) return p;
  }

  // 最后兜底：如果未来 Vercel 目录有变化，你至少能看到我们尝试过哪些路径
  throw new Error(`wework-chat-node package.json not found via fs. tried: ${candidates.join(" | ")}`);
}

function resolveWeworkPaths() {
  const cwd = process.cwd();
  const pkgJsonPath = findPkgJsonByFs();

  const moduleRoot = path.dirname(String(pkgJsonPath));
  const libDir = path.join(moduleRoot, "lib");
  const soPath = path.join(libDir, "libWeWorkFinanceSdk_C.so");

  return {
    cwd,
    pkgJsonPath: String(pkgJsonPath),
    moduleRoot,
    libDir,
    soPath,
    soExists: safeExists(soPath),
    libFiles: safeExists(libDir) ? safeReadDir(libDir, 120) : [],
  };
}

/**
 * 终局：在加载 msgaudit/wework-chat-node 之前，设置 LD_LIBRARY_PATH
 * - 优先 wework-chat-node/lib（它自己的 .so 及可能的依赖）
 * - 再加 /var/task/vendor/wecom/lib（你 vendoring 的依赖库）
 */
function ensureLdLibraryPath(weworkLibDir?: string) {
  if (process.platform !== "linux") return String(process.env.LD_LIBRARY_PATH || "");

  const vendorLib = "/var/task/vendor/wecom/lib";
  const parts = [
    // vendored libs（如 libssl.so.1.1/libcrypto.so.1.1）
    safeExists(vendorLib) ? vendorLib : "",
    // wework sdk .so 所在目录
    safeExists(weworkLibDir) ? String(weworkLibDir) : "",
    // keep existing
    process.env.LD_LIBRARY_PATH || "",
  ].filter(Boolean);

  process.env.LD_LIBRARY_PATH = parts.join(":");
  return process.env.LD_LIBRARY_PATH;
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

    // ✅ diag：永不加载 native
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

    // 3) params
    const seq = Number(body?.seq ?? 0);
    const maxResults = Math.min(Number(body?.maxResults ?? 50), 1000);
    const timeout = Math.min(Math.max(Number(body?.timeout ?? 10), 1), 60);

    // 4) dry-run
    if (isDryRun()) {
      return NextResponse.json({
        ok: true,
        where: process.env.VERCEL ? "vercel" : "local",
        dryRun: true,
        hint: 'Set WECOM_SYNC_DRY_RUN="0" to enable real pulling.',
        runtime: { node: process.versions.node, platform: process.platform, arch: process.arch },
      });
    }

    // 5) 在加载 native 前设置 LD_LIBRARY_PATH（终局必做）
    let nativeInfo: any = null;
    try {
      nativeInfo = resolveWeworkPaths();
      ensureLdLibraryPath(nativeInfo?.libDir);
    } catch (e: any) {
      // 即使这里失败也继续，让错误在真正加载时暴露
      nativeInfo = { error: e?.message || String(e) };
    }

    // ⚠️ 关键：延迟 import，避免初始化阶段触发 native
    const { decryptChatDataItem, wecomPullChatData } = await import("@/lib/wecom/msgaudit");

    const rsaPrivateKeyPem = mustEnv("WECOM_MSG_ARCHIVE_PRIVATE_KEY").replace(/\\n/g, "\n");

    const pulledRet = await wecomPullChatData({
      seq,
      limit: maxResults,
      timeout,
    });

    const items = pulledRet.items ?? [];
    const pulled = pulledRet.pulled ?? items.length;
    const nextSeq = pulledRet.nextSeq ?? seq;

    // 解密第一条验证链路
    let firstOk = false;
    let firstMsgid: string | null = null;
    let firstPreview: any = null;
    let firstError: string | null = null;

    if (items.length > 0) {
      try {
        const dec = decryptChatDataItem(items[0], rsaPrivateKeyPem);
        firstOk = true;
        firstMsgid = dec?.msgid ?? null;
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
      firstPreview,
      firstError,
      runtime: { node: process.versions.node, platform: process.platform, arch: process.arch },
      native: {
        ...nativeInfo,
        ldLibraryPath: String(process.env.LD_LIBRARY_PATH || ""),
      },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const hint =
      msg.includes("libWeWorkFinanceSdk_C.so") || msg.includes("shared object file")
        ? "native_so_load_failed"
        : null;

    return NextResponse.json(
      {
        ok: false,
        error: msg,
        name: e?.name || "Error",
        cause: e?.cause?.message || e?.cause || null,
        hint,
        runtime: { node: process.versions.node, platform: process.platform, arch: process.arch },
      },
      { status: 500 }
    );
  }
}
