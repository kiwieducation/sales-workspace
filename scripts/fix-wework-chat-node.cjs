/**
 * Fix wework-chat-node native binding location for Vercel / Serverless
 * This runs in postinstall.
 */

const fs = require("fs");
const path = require("path");

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

const pkgRoot = path.join(
  __dirname,
  "..",
  "node_modules",
  "wework-chat-node"
);

// 常见可能产出位置
const candidates = [
  "build/Release/wework.node",
  "build/wework.node",
  "compiled/20.19.5/linux/x64/wework.node",
  "compiled/20.19.6/linux/x64/wework.node",
];

const target = path.join(pkgRoot, "build", "Release", "wework.node");

let copied = false;
for (const rel of candidates) {
  const src = path.join(pkgRoot, rel);
  if (copyIfExists(src, target)) {
    console.log("[wework-chat-node] native binding fixed:", rel);
    copied = true;
    break;
  }
}

if (!copied) {
  console.warn(
    "[wework-chat-node] native binding not found, build may fail"
  );
}
