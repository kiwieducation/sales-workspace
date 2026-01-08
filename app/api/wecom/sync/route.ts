// app/api/wecom/sync/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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

function fileExists(p: string) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function safeReadDir(p: string, limit = 50) {
  try {
    return fs.readdirSync(p).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * 在加载 wework-chat-node（native）之前，先做：
 * - 找到模块 root
 * - 检查 .so 是否存在
 * - 把可能需要的目录加入 LD_LIBRARY_PATH
 *
 * 注意：必须在 import("@/lib/wecom/msgaudit") 之前调用，
 * 因为 msgaudit 里会 require wework-chat-node。
 */
function prepareNativeRuntime() {
  let moduleRoot: string | null = null;
  let soPath: string | null = null;
  let soExists = false;
  let libDir: string | null = null;
  let libFiles: string[] = [];

  try {
    const pkgJson = require.resolve("wework-chat-node/package.json", {
      paths: [process.cwd()],
    });
    moduleRoot = path.dirname(pkgJson);
    libDir = path.join(moduleRoot, "lib");
    soPath = path.join(libDir, "libWeWorkFinanceSdk_C.so");
    soExists = fileExists(soPath);
    libFiles = libDir ? safeReadDir(libDir, 80) : [];
  } catch {
    // ignore
  }

  // 把 wework-chat-node/lib 放到 LD_LIBRARY_PATH（动态链接器找 .so 及其依赖）
  // 另外预留 vendor 目录（如果你后续要把缺的 libssl/libcrypto 放进去）
  const candidates = [
    // wework-chat-node 自己的 lib 目录（最重要）
    moduleRoot ? path.join(moduleRoot, "lib") : "",
    // 可选：你自己 vendoring 的动态库目录（如果后续需要）
    "/var/task/vendor/openssl11",
    "/var/task/vendor/lib",
    "/var/task/vendor",
    // 兼容本地调试（非必须）
    process.cwd() ? path.join(process.cwd(), "vendor", "openssl11") : "",
    process.cwd() ? path.join(process.cwd(), "vendor", "lib") : "",
  ].filter(Boolean);

  const existing = candidates.filter((p) => fileExists(p));
  const current = process.env.LD_LIBRARY_PATH || "";
  const next = [...existing, current].filter(Boolean).join(":");

  // 只在 linux 下设置（Vercel runtime 就是 linux）
  if (process.platform === "linux") {
    process.env.LD_LIBRARY_PATH = next;
  }

  return {
    moduleRoot,
    libDir,
    soPath,
    soExists,
    libFiles,
    ldLibraryPath: process.env.LD_LIBRARY_PATH || "",
  };
}

export async function POST(req: Request) {
  try {
    // 1) Bearer token 保护
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const expected = mustEnv("WECOM_SYNC_TOKEN");
    if (!token || token !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
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
        runtime: {
          node: process.versions.node,
          platform: process.platform,
          arch: process.arch,
        },
      });
    }

    // 4) 在加载 native 之前：准备运行期（检查 .so、设置 LD_LIBRARY_PATH）
    const native = prepareNativeRuntime();

    // ⚠️ 关键：延迟 import，确保上面的 LD_LIBRARY_PATH 已设置
    const { decryptChatDataItem, wecomPullChatData } = await import("@/lib/wecom/msgaudit");

    // 5) 真正拉取 + 解密示例
    const rsaPrivateKeyPem = mustEnv("WECOM_MSG_ARCHIVE_PRIVATE_KEY").replace(/\\n/g, "\n");

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
      runtime: {
        node: process.versions.node,
        platform: process.platform,
        arch: process.arch,
      },
      native: {
        // 这些字段对你排 “/var/task 是否带 .so / 是否缺依赖” 很关键
        moduleRoot: native.moduleRoot,
        soPath: native.soPath,
        soExists: native.soExists,
        libDir: native.libDir,
        libFilesSample: native.libFiles,
        ldLibraryPath: native.ldLibraryPath,
      },
    });
  } catch (e: any) {
    // 给你一个更可操作的错误输出（不泄露敏感内容）
    const msg = e?.message || String(e);
    const nativeHint =
      msg.includes("libWeWorkFinanceSdk_C.so") || msg.includes("shared object file")
        ? "native_so_load_failed"
        : null;

    return NextResponse.json(
      {
        ok: false,
        error: msg,
        name: e?.name || "Error",
        cause: e?.cause?.message || e?.cause || null,
        hint: nativeHint,
        runtime: {
          node: process.versions.node,
          platform: process.platform,
          arch: process.arch,
        },
      },
      { status: 500 }
    );
  }
}
