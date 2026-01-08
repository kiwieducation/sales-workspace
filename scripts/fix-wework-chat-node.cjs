#!/usr/bin/env node
/* scripts/fix-wework-chat-node.cjs
 *
 * Goal (Vercel-stable):
 * 1) Patch Vercel Build/Runtime Node patch drift for native addon loader path:
 *      node_modules/wework-chat-node/compiled/<nodeVer>/linux/x64/wework.node
 * 2) Avoid IO explosion (no 0..40, no minor spread); keep copies small.
 * 3) Never break install: hard timeout + always exit(0).
 * 4) Print ldd on libWeWorkFinanceSdk_C.so to diagnose missing shared libs.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

// ---- hard guard: never hang the build
const timer = setTimeout(() => {
  log("postinstall timeout -> exit(0)");
  process.exit(0);
}, 10_000);

function main() {
  log("postinstall start");

  const moduleRoot = getModuleRoot("wework-chat-node");

  // 1) Find built addon (.node)
  const srcCandidates = [
    path.join(moduleRoot, "build", "Release", "wework.node"),
    path.join(moduleRoot, "build", "Debug", "wework.node"),
  ];
  const srcNode = srcCandidates.find(exists);

  if (!srcNode) {
    log("no native binding found, skip");
    log("tried:", srcCandidates);
  }

  // 2) Copy .node into compiled/<ver>/linux/x64 with small patch window
  const nodeV = process.versions.node; // build env node version
  const parsed = parseNodeVersion(nodeV);

  const platform = "linux"; // force for Vercel runtime
  const arch = "x64";       // force for Vercel runtime

  const targetVersions = new Set();

  if (parsed) {
    targetVersions.add(`${parsed.major}.${parsed.minor}.${parsed.patch}`);
    // patch window: -2..+6 (max 9)
    for (let p = Math.max(0, parsed.patch - 2); p <= parsed.patch + 6; p++) {
      targetVersions.add(`${parsed.major}.${parsed.minor}.${p}`);
    }
  } else if (nodeV) {
    targetVersions.add(String(nodeV));
  }

  // Known runtime patch you already observed
  targetVersions.add("20.19.5");

  // Optional hints
  for (const v of [process.env.VERCEL_NODE_VERSION, process.env.NODE_VERSION].filter(Boolean)) {
    targetVersions.add(String(v));
  }

  let copiedNode = 0;
  const sampleTargets = [];

  if (srcNode) {
    for (const ver of targetVersions) {
      const dst = path.join(moduleRoot, "compiled", ver, platform, arch, "wework.node");
      if (safeCopy(srcNode, dst)) {
        copiedNode++;
        if (sampleTargets.length < 12) sampleTargets.push(dst);
      }
    }
    // ensure build/Release exists
    const releaseTarget = path.join(moduleRoot, "build", "Release", "wework.node");
    if (!exists(releaseTarget)) {
      if (safeCopy(srcNode, releaseTarget)) copiedNode++;
    }
  }

  // 3) Ensure Finance SDK .so is present (should come with package)
  const soPath = path.join(moduleRoot, "lib", "libWeWorkFinanceSdk_C.so");
  const soExists = exists(soPath);

  log("fixed:");
  if (srcNode) log("  node from:", srcNode);
  log("  node sample to:", sampleTargets);
  log("  node total copies:", copiedNode);
  log("  finance so:", soPath, soExists ? "(exists)" : "(MISSING)");

  // 4) ldd diagnostics (do not fail build)
  try {
    if (soExists) {
      log("ldd:", soPath);
      const out = execSync(`ldd "${soPath}" || true`, { stdio: "pipe" }).toString();
      console.log(out);
    } else {
      log("ldd skip: finance so not found");
    }
  } catch (e) {
    log("ldd failed (ignored):", e && e.message ? e.message : e);
  }
}

try {
  main();
} catch (e) {
  log("ERROR:", e && e.stack ? e.stack : e);
} finally {
  clearTimeout(timer);
  process.exit(0);
}
