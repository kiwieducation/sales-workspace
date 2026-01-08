#!/usr/bin/env node
/**
 * scripts/fix-wework-chat-node.cjs
 *
 * Goal:
 * - Handle Vercel build/runtime Node patch drift for wework-chat-node native binding.
 * - Copy build/Release/wework.node to compiled/<nodeVer>/linux/x64/wework.node for a small patch window.
 * - Always exit(0) with hard timeout (never block install/build).
 */

const fs = require("fs");
const path = require("path");

function log(...args) {
  console.log("[wework-chat-node]", ...args);
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {}
}

function safeCopy(src, dst) {
  try {
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
    return true;
  } catch {
    return false;
  }
}

function parseNodeVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || ""));
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function getModuleRoot(moduleName) {
  const pkgJsonPath = require.resolve(`${moduleName}/package.json`, {
    paths: [process.cwd()],
  });
  return path.dirname(pkgJsonPath);
}

// ---- hard guard: never hang build
const timer = setTimeout(() => {
  log("timeout -> exit(0)");
  process.exit(0);
}, 10_000);

function main() {
  log("postinstall start");

  const moduleRoot = getModuleRoot("wework-chat-node");

  // Vercel build is linux/x64; runtime is also linux/x64
  const platform = "linux";
  const arch = "x64";

  const srcCandidates = [
    path.join(moduleRoot, "build", "Release", "wework.node"),
    path.join(moduleRoot, "build", "Debug", "wework.node"),
  ];
  const src = srcCandidates.find(exists);
  if (!src) {
    log("no wework.node found, skip");
    log("tried:", srcCandidates);
    return;
  }

  const nodeV = process.versions.node;
  const parsed = parseNodeVersion(nodeV);

  const targetVersions = new Set();

  // Always include current build node
  if (parsed) {
    const { major, minor, patch } = parsed;
    // small patch window: patch-2 .. patch+6 (max 9 copies)
    for (let p = Math.max(0, patch - 2); p <= patch + 6; p++) {
      targetVersions.add(`${major}.${minor}.${p}`);
    }
    // plus: known runtime patch you observed
    targetVersions.add("20.19.5");
  } else if (nodeV) {
    targetVersions.add(String(nodeV));
    targetVersions.add("20.19.5");
  }

  let copied = 0;
  const sample = [];

  for (const ver of targetVersions) {
    const dst = path.join(moduleRoot, "compiled", ver, platform, arch, "wework.node");
    if (safeCopy(src, dst)) {
      copied++;
      if (sample.length < 12) sample.push(dst);
    }
  }

  // quick sanity about finance sdk .so
  const soPath = path.join(moduleRoot, "lib", "libWeWorkFinanceSdk_C.so");
  log("fixed:");
  log("  node from:", src);
  log("  node sample to:", sample);
  log("  node total copies:", copied);
  log("  finance so:", soPath, exists(soPath) ? "(exists)" : "(missing)");
}

try {
  main();
} catch (e) {
  log("ERROR (ignored):", e && e.stack ? e.stack : e);
} finally {
  clearTimeout(timer);
  process.exit(0);
}
