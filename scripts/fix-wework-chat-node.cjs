#!/usr/bin/env node

// Postinstall hardening for wework-chat-node on Vercel Serverless.
// Goals:
// 1) Copy build/Release/wework.node -> compiled/<patch>/linux/x64/wework.node (patch window)
// 2) Purge build-time absolute prefix "/vercel/path0" from ALL native binaries.
// 3) ALSO patch any traced/copied native binaries under project output (e.g. .next/**),
//    because the runtime may load a copied artifact instead of the original node_modules file.
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

// Binary-safe equal-length replacement (NUL padded).
function replaceInBinary(filePath, fromStr, toStr) {
  try {
    const buf = fs.readFileSync(filePath);
    const from = Buffer.from(fromStr, "utf8");
    const toRaw = Buffer.from(toStr, "utf8");

    if (toRaw.length > from.length) return false;
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
  } catch {
    return false;
  }
}

function walkFiles(dir, pred, out = [], max = 4000) {
  if (out.length >= max) return out;
  try {
    const ents = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of ents) {
      if (out.length >= max) break;
      const p = path.join(dir, e.name);

      // skip huge dirs
      if (e.isDirectory()) {
        if (
          e.name === ".git" ||
          e.name === ".turbo" ||
          e.name === ".cache" ||
          e.name === "node_modules" // avoid double scan here; we scan target module separately
        ) {
          continue;
        }
        walkFiles(p, pred, out, max);
      } else if (e.isFile() && pred(p)) {
        out.push(p);
      }
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

  const fromStr = "/vercel/path0";
  const toStr = "/var/task";
  let patchedCount = 0;

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

    // ensure current build/runtime patches you may hit
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
  } else {
    log("no wework.node in build/, skip copy");
  }

  // 2) Patch within wework-chat-node itself (lib/*.so + build/**/*.node + compiled/**/*.node)
  const libDir = path.join(root, "lib");
  if (exists(libDir)) {
    const soFiles = fs
      .readdirSync(libDir)
      .filter((f) => f.endsWith(".so"))
      .map((f) => path.join(libDir, f));
    for (const f of soFiles) if (replaceInBinary(f, fromStr, toStr)) patchedCount++;
  }

  const buildDir = path.join(root, "build");
  if (exists(buildDir)) {
    const nodeFiles = walkFiles(buildDir, (p) => p.endsWith(".node"), [], 2000);
    for (const f of nodeFiles) if (replaceInBinary(f, fromStr, toStr)) patchedCount++;
  }

  const compiledDir = path.join(root, "compiled");
  if (exists(compiledDir)) {
    const compiledNodes = walkFiles(compiledDir, (p) => p.endsWith(".node"), [], 4000);
    for (const f of compiledNodes) if (replaceInBinary(f, fromStr, toStr)) patchedCount++;
  }

  log("module patch done. patched files:", patchedCount);

  // 3) EXTRA: Patch any traced/copied native binaries in output dirs (.next/** etc)
  // This covers the case where Vercel runtime loads a copied artifact rather than node_modules.
  let extraPatched = 0;
  const cwd = process.cwd();

  // only scan a few likely dirs to stay fast
  const scanRoots = [
    path.join(cwd, ".next"),
    path.join(cwd, ".vercel"), // sometimes contains output traces
  ].filter(exists);

  for (const sr of scanRoots) {
    const natives = walkFiles(
      sr,
      (p) => p.endsWith(".node") || p.endsWith(".so"),
      [],
      2000
    );
    for (const f of natives) {
      if (replaceInBinary(f, fromStr, toStr)) extraPatched++;
    }
  }

  log("output patch done. patched files:", extraPatched);
} catch (e) {
  log("ERROR (ignored):", e && e.stack ? e.stack : e);
} finally {
  clearTimeout(timer);
  process.exit(0);
}
