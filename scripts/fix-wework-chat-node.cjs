#!/usr/bin/env node

// Postinstall hardening for wework-chat-node on Vercel Serverless.
// Goals:
// 1) Copy build/Release/wework.node -> compiled/<patch>/linux/x64/wework.node (patch window)
// 2) Purge build-time absolute prefix "/vercel/path0" from ALL native binaries:
//    - lib/*.so
//    - build/**/*.node
//    - compiled/**/*.node
// Always exit(0) within 12s (never block deployment).

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
  const p = require.resolve(`${name}/package.json`, { paths: [process.cwd()] });
  return path.dirname(p);
}

// Binary-safe equal-length replacement (NUL padded) to avoid breaking ELF layout.
function replaceInBinary(filePath, fromStr, toStr) {
  try {
    const buf = fs.readFileSync(filePath);
    const from = Buffer.from(fromStr, "utf8");
    const toRaw = Buffer.from(toStr, "utf8");

    if (toRaw.length > from.length) {
      log("skip replace (toStr longer than fromStr)", filePath);
      return false;
    }
    const to = Buffer.concat([toRaw, Buffer.alloc(from.length - toRaw.length, 0)]);

    let replaced = false;
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
      log("patched:", filePath, `${fromStr} -> ${toStr}`);
    }
    return replaced;
  } catch (e) {
    log("replaceInBinary failed:", filePath, e?.message || String(e));
    return false;
  }
}

function walkFiles(dir, pred, out = []) {
  try {
    const ents = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkFiles(p, pred, out);
      else if (e.isFile() && pred(p)) out.push(p);
    }
  } catch {}
  return out;
}

const timer = setTimeout(() => {
  log("timeout -> exit(0)");
  process.exit(0);
}, 12_000);

try {
  log("postinstall start");
  const root = moduleRoot("wework-chat-node");

  // 1) Copy wework.node across patch window
  const srcNode = [
    path.join(root, "build", "Release", "wework.node"),
    path.join(root, "build", "Debug", "wework.node"),
  ].find(exists);

  if (!srcNode) {
    log("no wework.node in build/, skip copy");
  } else {
    const nodeV = process.versions.node;
    const p = parse(nodeV);
    const vers = new Set();

    if (p) {
      // patch window: current-2 ... current+12
      for (let pat = Math.max(0, p.pat - 2); pat <= p.pat + 12; pat++) {
        vers.add(`${p.maj}.${p.min}.${pat}`);
      }
    } else {
      vers.add(String(nodeV));
    }

    // ensure current runtime patch as seen in your runtime
    vers.add("20.19.5");
    vers.add("20.19.6");

    let copied = 0;
    const sample = [];
    for (const v of vers) {
      const dst = path.join(root, "compiled", v, "linux", "x64", "wework.node");
      if (copy(srcNode, dst)) {
        copied++;
        if (sample.length < 10) sample.push(dst);
      }
    }
    log("copied wework.node:");
    log("  from:", srcNode);
    log("  sample to:", sample);
    log("  total copies:", copied);
  }

  // 2) Patch "/vercel/path0" -> "/var/task" in ALL native binaries
  const fromStr = "/vercel/path0";
  const toStr = "/var/task";
  let patchedCount = 0;

  // 2a) lib/*.so
  const libDir = path.join(root, "lib");
  if (exists(libDir)) {
    const soFiles = fs
      .readdirSync(libDir)
      .filter((f) => f.endsWith(".so"))
      .map((f) => path.join(libDir, f));
    for (const f of soFiles) {
      if (replaceInBinary(f, fromStr, toStr)) patchedCount++;
    }
  }

  // 2b) build/**/*.node
  const buildDir = path.join(root, "build");
  if (exists(buildDir)) {
    const nodeFiles = walkFiles(buildDir, (p) => p.endsWith(".node"));
    for (const f of nodeFiles) {
      if (replaceInBinary(f, fromStr, toStr)) patchedCount++;
    }
  }

  // 2c) compiled/**/*.node
  const compiledDir = path.join(root, "compiled");
  if (exists(compiledDir)) {
    const compiledNodes = walkFiles(compiledDir, (p) => p.endsWith(".node"));
    for (const f of compiledNodes) {
      if (replaceInBinary(f, fromStr, toStr)) patchedCount++;
    }
  }

  log("absolute prefix patch done. patched files:", patchedCount);
} catch (e) {
  log("ERROR (ignored):", e && e.stack ? e.stack : e);
} finally {
  clearTimeout(timer);
  process.exit(0);
}
