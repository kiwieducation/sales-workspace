// scripts/fix-wework-chat-node.cjs
const fs = require("fs");
const path = require("path");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

// ✅ 关键：无论如何 10 秒强制退出，防止 Vercel build 卡死
const timer = setTimeout(() => {
  console.log("[wework-chat-node] postinstall timeout -> exit(0)");
  process.exit(0);
}, 10_000);

try {
  console.log("[wework-chat-node] postinstall start");

  const root = process.cwd();
  const modRoot = path.join(root, "node_modules", "wework-chat-node");

  if (!exists(modRoot)) {
    console.log("[wework-chat-node] module not found, skip");
    clearTimeout(timer);
    process.exit(0);
  }

  // ✅ 尽量少找，避免遍历导致卡死
  const fromCandidates = [
    path.join(modRoot, "build", "Release", "wework.node"),
    path.join(modRoot, "build", "Debug", "wework.node"),
  ];

  const from = fromCandidates.find(exists);
  if (!from) {
    console.log("[wework-chat-node] no binding found, skip");
    console.log("[wework-chat-node] tried:", fromCandidates);
    clearTimeout(timer);
    process.exit(0);
  }

  const nodeVer = process.versions.node; // e.g. 20.19.5
  const platform = process.platform;     // linux
  const arch = process.arch;             // x64

  const targetDir = path.join(modRoot, "compiled", nodeVer, platform, arch);
  fs.mkdirSync(targetDir, { recursive: true });

  const to = path.join(targetDir, "wework.node");
  fs.copyFileSync(from, to);

  console.log("[wework-chat-node] fixed:");
  console.log("  from:", from);
  console.log("  to  :", to);

  clearTimeout(timer);
  process.exit(0);
} catch (e) {
  console.error("[wework-chat-node] error:", e?.message || e);
  // 不要让安装失败
  clearTimeout(timer);
  process.exit(0);
}
