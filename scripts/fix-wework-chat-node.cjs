#!/usr/bin/env node
/**
 * Ensure wework-chat-node native binding exists for Vercel runtime patch drift.
 *
 * What this script does (postinstall on Vercel):
 * 1) Copy build/Release/wework.node -> compiled/<ver>/linux/x64/wework.node (patch window)
 * 2) Patch absolute build-time path strings in lib/*.so:
 *    "/vercel/path0" -> "/var/task" (equal-length replacement with NUL padding)
 *
 * Always exit(0) within 10s (never block deployment).
 */
const fs = require("fs");
const path = require("path");

function log(...a) {
  console.log("[wework-chat-node]", ...a);
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
function copy(src, dst) {
  try {
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
    return true;
  } catch {
    return false;
  }
}

function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || ""));
  return m ? { maj: +m[1], min: +m[2], pat: +m[3] } : null;
}

function moduleRoot(name) {
  // This runs in Node during install/build, safe to use require.resolve here.
  const p = require.resolve(`${name}/package.json`, { paths: [process.cwd()] });
  return path.dirname(p);
}

/**
 * Binary-safe equal-length string replacement with NUL padding.
 * This avoids breaking ELF layout.
 */
function replaceInBinary(filePath, fromStr, toStr) {
  try {
    const buf = fs.readFileSync(filePath);
    const from = Buffer.from(fromStr, "utf8");
    const toRaw = Buffer.from(toStr, "utf8");

    // Must be equal or shorter; pad with \0 to keep same length
    if (toRaw.length > from.length) {
      log("skip replace (toStr longer than fromStr)", filePath);
      return false;
    }
    const to = Buffer.concat([toRaw, Buffer.alloc(from.length - toRaw.length, 0)]);

    let replaced = false;

    // naive scan; lib sizes are small, OK
    for (let i = 0; i <= buf.length - from.length; i++) {
      let match = true;
      for (let j = 0; j < from.length; j++) {
        if (buf[i + j] !== from[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        to.copy(buf, i);
        replaced = true;
        i += from.length - 1;
      }
    }

    if (replaced) {
      fs.writeFileSync(filePath, buf);
      log("patched absolute path string in", filePath, `${fromStr} -> ${toStr}`);
    }
    return replaced;
  } catch (e) {
    log("replaceInBinary failed", filePath, e?.message || String(e));
    return false;
  }
}

const timer = setTimeout(() => {
  log("timeout -> exit(0)");
  process.exit(0);
}, 10_000);

try {
  log("postinstall start");
  const root = moduleRoot("wework-chat-node");

  // 1) Patch wework.node across a small Node patch window
  const src = [
    path.join(root, "build", "Release", "wework.node"),
    path.join(root, "build", "Debug", "wework.node"),
  ].find(exists);

  if (!src) {
    log("no wework.node, skip");
  } else {
    const nodeV = process.versions.node;
    const p = parse(nodeV);
    const vers = new Set();

    if (p) {
      // patch window: current-2 ... current+6
      for (let pat = Math.max(0, p.pat - 2); pat <= p.pat + 6; pat++) {
        vers.add(`${p.maj}.${p.min}.${pat}`);
      }
    } else {
      vers.add(String(nodeV));
    }

    // known runtime patch observed in your logs
    vers.add("20.19.5");

    let copied = 0;
    const sample = [];
    for (const v of vers) {
      const dst = path.join(root, "compiled", v, "linux", "x64", "wework.node");
      if (copy(src, dst)) {
        copied++;
        if (sample.length < 10) sample.push(dst);
      }
    }

    log("fixed:");
    log("  from:", src);
    log("  sample to:", sample);
    log("  total copies:", copied);
  }

  // 2) Patch lib/*.so absolute build-time paths that leak into runtime
  //    Symptom: runtime error referencing "/vercel/path0/node_modules/.../libWeWorkFinanceSdk_C.so"
  try {
    const libDir = path.join(root, "lib");
    if (!exists(libDir)) {
      log("no lib dir, skip abs-path patch");
    } else {
      const files = fs.readdirSync(libDir).filter((f) => f.endsWith(".so"));
      if (!files.length) {
        log("no .so files, skip abs-path patch");
      } else {
        const fromStr = "/vercel/path0";
        const toStr = "/var/task";

        let patched = 0;
        for (const f of files) {
          const p = path.join(libDir, f);
          if (replaceInBinary(p, fromStr, toStr)) patched++;
        }
        log("absolute path patch done. patched files:", patched);
      }
    }
  } catch (e) {
    log("abs-path patch ERROR (ignored):", e?.message || String(e));
  }
} catch (e) {
  log("ERROR (ignored):", e && e.stack ? e.stack : e);
} finally {
  clearTimeout(timer);
  process.exit(0);
}
