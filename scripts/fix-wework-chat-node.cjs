#!/usr/bin/env node
/**
 * Ensure wework-chat-node native binding exists for Vercel runtime patch drift.
 * - Copy build/Release/wework.node to compiled/<ver>/linux/x64/wework.node for a small patch window
 * - Always exit(0) within 10s
 */
const fs = require("fs");
const path = require("path");

function log(...a) { console.log("[wework-chat-node]", ...a); }
function exists(p) { try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; } }
function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch {} }
function copy(src, dst) { try { ensureDir(path.dirname(dst)); fs.copyFileSync(src, dst); return true; } catch { return false; } }

function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v||""));
  return m ? { maj:+m[1], min:+m[2], pat:+m[3] } : null;
}
function moduleRoot(name) {
  const p = require.resolve(`${name}/package.json`, { paths:[process.cwd()] });
  return path.dirname(p);
}

const timer = setTimeout(() => { log("timeout -> exit(0)"); process.exit(0); }, 10_000);

try {
  log("postinstall start");
  const root = moduleRoot("wework-chat-node");
  const src = [
    path.join(root, "build", "Release", "wework.node"),
    path.join(root, "build", "Debug", "wework.node"),
  ].find(exists);

  if (!src) { log("no wework.node, skip"); process.exit(0); }

  const nodeV = process.versions.node;
  const p = parse(nodeV);
  const vers = new Set();

  if (p) {
    for (let pat = Math.max(0, p.pat - 2); pat <= p.pat + 6; pat++) {
      vers.add(`${p.maj}.${p.min}.${pat}`);
    }
  } else {
    vers.add(String(nodeV));
  }
  // known runtime patch observed
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
} catch (e) {
  log("ERROR (ignored):", e && e.stack ? e.stack : e);
} finally {
  clearTimeout(timer);
  process.exit(0);
}
