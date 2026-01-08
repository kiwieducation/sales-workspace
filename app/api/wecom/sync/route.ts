// app/api/wecom/sync/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
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
  const v = env("WECOM_SYNC_DRY_RUN");
  return v !== "0";
}

function safeReadDir(p: string, limit = 80) {
  try {
    return fs.readdirSync(p).slice(0, limit);
  } catch {
    return [];
  }
}

function resolveWeworkPaths() {
  // 只做 resolve/exists，不 require wework-chat-node（避免触发 native）
  const pkg = require.resolve("wework-chat-node/package.json", { paths: [process.cwd()] });
  const root = path.dirname(pkg);
  const libDir = path.join(root, "lib");
  const soPath = path.join(libDir, "libWeWorkFinanceSdk_C.so");
  const nodePath = path.join(root, "build", "Release", "wework.node");

  return {
    root,
    libDir,
    soPath,
    nodePath,
    soExists: fs.existsSync(soPath),
    nodeExists: fs.existsSync(nodePath),
    libFiles: fs.existsSync(libDir) ? safeReadDir(libDir) : [],
  };
}

export async function POST(req: Request) {
  try {
    // 1) Auth
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const expected = mustEnv("WECOM_SYNC_TOKEN");
    if (!token || token !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // 2) Body
    const body = await req.json().catch(() => ({} as any));

    // ✅ 0) DIAG：永远不触发 native，只返回文件是否存在
    if (body?.diag) {
      const paths = resolveWeworkPaths();
      return NextResponse.json({
        ok: true,
        diag: true,
        runtime: { node: process.versions.node, platform: process.platform, arch: process.arch },
        cwd: process.cwd(),
        paths,
        ldLibraryPath: process.env.LD_LIBRARY_PATH || "",
      });
    }

    // 3) Params
    const seq = Number(body.seq ?? 0);
    const maxResults = Math.min(Number(body.maxResults ?? 50), 1000);
    const timeout = Math.min(Math.max(Number(body.timeout ?? 10), 1), 60);

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

    // 5) 在真正 import 业务模块前，先准备 LD_LIBRARY_PATH（可选，但推荐）
    // 让动态链接器优先在 wework-chat-node/lib 找依赖
    if (process.platform === "linux") {
      const paths = resolveWeworkPaths();
      const extra = [paths.libDir].filter(Boolean).join(":");
      process.env.LD_LIBRARY_PATH = [extra, process.env.LD_LIBRARY_PATH || ""].filter(Boolean).join(":");
    }

    // ⚠️ 关键：延迟 import，避免初始化阶段就加载 native
    const { decryptChatDataItem, wecomPullChatData } = await import("@/lib/wecom/msgaudit");

    const rsaPrivateKeyPem = mustEnv("WECOM_MSG_ARCHIVE_PRIVATE_KEY").replace(/\\n/g, "\n");

    const pulledRet = await wecomPullChatData({ seq, limit: maxResults, timeout });
    const items = pulledRet.items ?? [];
    const pulled = pulledRet.pulled ?? items.length;
    const nextSeq = pulledRet.nextSeq ?? seq;

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
