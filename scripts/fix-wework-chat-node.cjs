#!/usr/bin/env node
/* scripts/fix-wework-chat-node.cjs
 *
 * Fast + safe workaround for Vercel Build/Runtime Node patch drift
 * with native addon loader path: compiled/<nodeVer>/linux/x64/wework.node
 *
 * - Small patch window only (avoid IO explosion / 45min build risk)
 * - Hard timeout, always exit(0)
 * - Force linux/x64 targets on Vercel to match /var/task runtime
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
  fs.mkdirSync(p, { recursive: true });
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

  // Find source binding
  const srcCandidates = [
    path.join(moduleRoot, "build", "Release", "wework.node"),
    path.join(moduleRoot, "build", "Debug", "wework.node"),
  ];
  const src = srcCandidates.find(exists);

  if (!src) {
    log("no native binding found, skip");
    log("tried:", srcCandidates);
    return;
  }

  const nodeV = process.versions.node; // build env node version
  const parsed = parseNodeVersion(nodeV);

  // On Vercel, runtime is linux/x64 in /var/task.
  // Force targets to linux/x64 so paths match what the loader will look for.
  const onVercel = !!process.env.VERCEL;
  const platform = onVercel ? "linux" : process.platform;
  const arch = onVercel ? "x64" : process.arch;

  const targetVersions = new Set();

  // Always include current build node (exact)
  if (parsed) {
    targetVersions.add(`${parsed.major}.${parsed.minor}.${parsed.patch}`);

    // Patch window: (patch-2..patch+6) capped at >=0
    for (let p = Math.max(0, parsed.patch - 2); p <= parsed.patch + 6; p++) {
      targetVersions.add(`${parsed.major}.${parsed.minor}.${p}`);
    }

    // Known runtime drift anchor(s) you observed
    // Keep small, but include ±1 around it to survive tiny pool changes.
    const known = { major: 20, minor: 19, patch: 5 };
    if (parsed.major === known.major && parsed.minor === known.minor) {
      for (let p = Math.max(0, known.patch - 1); p <= known.patch + 1; p++) {
        targetVersions.add(`${known.major}.${known.minor}.${p}`);
      }
    } else {
      // still add the exact known runtime patch anyway
      targetVersions.add("20.19.5");
      targetVersions.add("20.19.6");
    }
  } else if (nodeV) {
    targetVersions.add(String(nodeV));
    // Still add known runtime patch
    targetVersions.add("20.19.5");
    targetVersions.add("20.19.6");
  }

  // Optional hints (usually empty, but harmless)
  for (const v of [process.env.VERCEL_NODE_VERSION, process.env.NODE_VERSION].filter(Boolean)) {
    targetVersions.add(String(v));
  }

  let copied = 0;
  const targets = [];

  for (const ver of targetVersions) {
    const dst = path.join(moduleRoot, "compiled", ver, platform, arch, "wework.node");
    if (safeCopy(src, dst)) {
      copied++;
      targets.push(dst);
    }
  }

  // Ensure build/Release exists (some packages expect it)
  const releaseTarget = path.join(moduleRoot, "build", "Release", "wework.node");
  if (!exists(releaseTarget)) {
    if (safeCopy(src, releaseTarget)) {
      copied++;
      targets.push(releaseTarget);
    }
  }

  log("fixed:");
  log("  from:", src);
  log("  sample to:", targets.slice(0, 12));
  log("  total copies:", copied);
}

try {
  main();
} catch (e) {
  log("ERROR:", e && e.stack ? e.stack : e);
} finally {
  clearTimeout(timer);
  process.exit(0);
}
