#!/usr/bin/env node

// Postinstall hardening for wework-chat-node on Vercel Serverless.
// 1) Copy build/Release/wework.node -> compiled/<patch>/linux/x64/wework.node
// 2) Patch absolute build prefix in ALL native binaries to a writable runtime shim prefix:
//    "/vercel/path0"  -> "/tmp/vercelp0"  (same length, no NUL truncation)
//    "/var/task\0\0\0\0" -> "/tmp/vercelp0" (repair previous NUL-padded patch)
// Always exit(0) within 12s.

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

function walkFiles(dir, pred, out = [], max = 6000) {
  if (out.length >= max) return out;
  try {
    const ents = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of ents) {
      if (out.length >= max) break;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkFiles(p, pred, out, max);
      else if (e.isFile() && pred(p)) out.push(p);
    }
  } catch {}
  return out;
}

// Replace equal-length byte sequences in a binary file (no NUL padding, no truncation).
function replaceBytesInFile(filePath, fromBuf, toBuf) {
  try {
    if (fromBuf.length !== toBuf.length) return 0;

    const buf = fs.readFileSync(filePath);
    let hits = 0;

    for (let i = 0; i <= buf.length - fromBuf.length; i++) {
      let match = true;
      for (let j = 0; j < fromBuf.length; j++) {
        if (buf[i + j] !== fromBuf[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        toBuf.copy(buf, i);
        hits++;
        i += fromBuf.length - 1;
      }
    }

    if (hits > 0) {
      fs.writeFileSync(filePath, buf);
      log("patched:", filePath, `hits=${hits}`);
    }
    return hits;
  } catch {
    return 0;
  }
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

  if (srcNode) {
    const nodeV = process.versions.node;
    const p = parse(nodeV);
    const vers = new Set();

    if (p) {
      for (let pat = Math.max(0, p.pat - 2); pat <= p.pat + 18; pat++) {
        vers.add(`${p.maj}.${p.min}.${pat}`);
      }
    } else {
      vers.add(String(nodeV));
    }

    // runtime patches you observed
    vers.add("20.19.5");
    vers.add("20.19.6");

    let copied = 0;
    for (const v of vers) {
      const dst = path.join(root, "compiled", v, "linux", "x64", "wework.node");
      if (copy(srcNode, dst)) copied++;
    }

    log("copied wework.node total:", copied);
  } else {
    log("no wework.node in build/, skip copy");
  }

  // 2) Patch absolute prefix in ALL native binaries
  const toBuf = Buffer.from("/tmp/vercelp0", "utf8"); // length 13

  const from1 = Buffer.from("/vercel/path0", "utf8"); // length 13
  // previous bad patch pattern: "/var/task" + 4 NULs (length 13)
  const from2 = Buffer.concat([Buffer.from("/var/task", "utf8"), Buffer.alloc(4, 0)]);

  let patchedFiles = 0;
  let totalHits = 0;

  const targets = [];

  const libDir = path.join(root, "lib");
  if (exists(libDir)) {
    for (const f of fs.readdirSync(libDir)) {
      if (f.endsWith(".so")) targets.push(path.join(libDir, f));
    }
  }

  const buildDir = path.join(root, "build");
  if (exists(buildDir)) targets.push(...walkFiles(buildDir, (p) => p.endsWith(".node")));

  const compiledDir = path.join(root, "compiled");
  if (exists(compiledDir)) targets.push(...walkFiles(compiledDir, (p) => p.endsWith(".node")));

  // de-dup
  const uniq = Array.from(new Set(targets));

  for (const f of uniq) {
    const h1 = replaceBytesInFile(f, from1, toBuf);
    const h2 = replaceBytesInFile(f, from2, toBuf);
    const hits = h1 + h2;
    if (hits > 0) {
      patchedFiles++;
      totalHits += hits;
    }
  }

  log("absolute prefix patch done.", { patchedFiles, totalHits });
} catch (e) {
  log("ERROR (ignored):", e && e.stack ? e.stack : e);
} finally {
  clearTimeout(timer);
  process.exit(0);
}
