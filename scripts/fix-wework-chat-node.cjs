/**
 * scripts/fix-wework-chat-node.cjs
 *
 * Fix for Vercel runtime/build Node patch mismatch when using wework-chat-node.
 * It copies the built native binding `wework.node` into:
 *   node_modules/wework-chat-node/compiled/<nodeVer>/<platform>/<arch>/wework.node
 *
 * And (important) it also copies into a patch-range for the same major.minor
 * (e.g. 20.19.0 ~ 20.19.30) so that if Vercel runs a different patch than build,
 * the bindings loader can still find it.
 *
 * This script must NEVER fail the install; it always exits 0.
 */

const fs = require("fs");
const path = require("path");

function log(...args) {
  console.log("[wework-chat-node]", ...args);
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safeCopy(from, to) {
  mkdirp(path.dirname(to));
  fs.copyFileSync(from, to);
  try {
    fs.chmodSync(to, 0o755);
  } catch {
    // ignore chmod failures
  }
}

function parseSemver(v) {
  // v like "20.19.6"
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

(async function main() {
  // Guard: never hang forever (Vercel build timeouts are painful)
  const timer = setTimeout(() => {
    log("timeout; exiting 0");
    process.exit(0);
  }, 20_000);

  try {
    log("postinstall start");

    // Resolve module root reliably
    let modRoot;
    try {
      // package.json path inside the module
      const pkgPath = require.resolve("wework-chat-node/package.json", {
        paths: [process.cwd()],
      });
      modRoot = path.dirname(pkgPath);
    } catch (e) {
      log("cannot resolve module root; skip.", e?.message || e);
      clearTimeout(timer);
      process.exit(0);
      return;
    }

    const candidates = [
      path.join(modRoot, "build", "Release", "wework.node"),
      path.join(modRoot, "build", "wework.node"),
      path.join(modRoot, "Release", "wework.node"),
      path.join(modRoot, "wework.node"),
    ];

    const from = candidates.find(exists);
    if (!from) {
      log("native binding not found in candidates; skip.");
      log("checked:", candidates);
      clearTimeout(timer);
      process.exit(0);
      return;
    }

    const nodeVer = process.versions.node; // build-time node version
    const platform = process.platform;     // linux / darwin
    const arch = process.arch;             // x64 / arm64

    const sem = parseSemver(nodeVer);
    const targets = new Set();

    // Always copy to exact build-time version
    targets.add(nodeVer);

    // Also copy a patch-range for the same major.minor (handles runtime patch mismatch)
    if (sem) {
      const maxPatch = Math.max(30, sem.patch); // 0..30 usually enough; keep small but safe
      for (let p = 0; p <= maxPatch; p++) {
        targets.add(`${sem.major}.${sem.minor}.${p}`);
      }
    }

    // If user pins via engines "20.x", Vercel runtime sometimes differs by patch.
    // Also add common known Node 20 patch that Vercel has used recently.
    if (sem && sem.major === 20 && sem.minor === 19) {
      targets.add("20.19.5");
      targets.add("20.19.6");
    }

    let copied = 0;
    const toList = [];

    for (const ver of targets) {
      const to = path.join(modRoot, "compiled", ver, platform, arch, "wework.node");
      try {
        safeCopy(from, to);
        copied++;
        // Only print a few to avoid noisy logs
        if (toList.length < 6) toList.push(to);
      } catch (e) {
        // keep going
      }
    }

    if (copied > 0) {
      log("fixed:");
      log("  from:", from);
      log("  sample to:", toList);
      log("  total copies:", copied);
    } else {
      log("no copies made; skip.");
    }

    clearTimeout(timer);
    process.exit(0);
  } catch (e) {
    console.error("[wework-chat-node] error:", e?.message || e);
    clearTimeout(timer);
    process.exit(0); // never fail install
  }
})();
