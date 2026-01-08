#!/usr/bin/env node
/**
 * postbuild-fix-wework-next.cjs (FINAL)
 *
 * Goal: Make `bindings` always find wework.node on Vercel runtime.
 * Observed runtime error tried paths (under /var/task/.next/...):
 *   - .next/compiled/<ver>/linux/x64/wework.node
 *   - .next/build/{Release,Debug}/wework.node
 *   - .next/build/wework.node
 *   - .next/build/default/wework.node
 *   - .next/{Release,Debug}/wework.node
 *   - .next/out/{Release,Debug}/wework.node
 *
 * Strategy:
 *   - After `next build`, copy the built addon `node_modules/wework-chat-node/build/Release/wework.node`
 *     into ALL of the above candidate locations inside `.next/`.
 *   - Also cover small patch window and known runtime patch (20.19.5) for .next/compiled/<ver>/...
 *   - Always succeed (never fail build).
 */

const fs = require("fs");
const path = require("path");

function log(...args) {
  console.log("[wework-next-postbuild]", ...args);
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

function main() {
  const cwd = process.cwd();
  const nextDir = path.join(cwd, ".next");
  if (!exists(nextDir)) {
    log("skip: .next not found (must run after `next build`)");
    return;
  }

  const moduleRoot = path.join(cwd, "node_modules", "wework-chat-node");
  const srcCandidates = [
    path.join(moduleRoot, "build", "Release", "wework.node"),
    path.join(moduleRoot, "build", "Debug", "wework.node"),
  ];
  const src = srcCandidates.find(exists);

  if (!src) {
    log("skip: wework.node not found");
    log("tried:", srcCandidates);
    return;
  }

  // -------- 1) Copy into generic .next locations (bindings tried these)
  const genericTargets = [
    path.join(nextDir, "build", "wework.node"),
    path.join(nextDir, "build", "default", "wework.node"),
    path.join(nextDir, "build", "Release", "wework.node"),
    path.join(nextDir, "build", "Debug", "wework.node"),
    path.join(nextDir, "Release", "wework.node"),
    path.join(nextDir, "Debug", "wework.node"),
    path.join(nextDir, "out", "Release", "wework.node"),
    path.join(nextDir, "out", "Debug", "wework.node"),
  ];

  let copied = 0;
  const sample = [];

  for (const dst of genericTargets) {
    if (safeCopy(src, dst)) {
      copied++;
      if (sample.length < 12) sample.push(dst);
    }
  }

  // -------- 2) Copy into .next/compiled/<ver>/linux/x64/wework.node (bindings also tried)
  const platform = "linux";
  const arch = "x64";

  const buildNode = process.versions.node; // build env version
  const parsed = parseNodeVersion(buildNode);

  const versions = new Set();

  if (parsed) {
    for (let p = Math.max(0, parsed.patch - 2); p <= parsed.patch + 6; p++) {
      versions.add(`${parsed.major}.${parsed.minor}.${p}`);
    }
    versions.add(`${parsed.major}.${parsed.minor}.${parsed.patch}`);
  } else {
    versions.add(String(buildNode));
  }

  // Known runtime patch observed on Vercel
  versions.add("20.19.5");

  for (const v of [process.env.VERCEL_NODE_VERSION, process.env.NODE_VERSION].filter(Boolean)) {
    versions.add(String(v));
  }

  for (const ver of versions) {
    const dst = path.join(nextDir, "compiled", ver, platform, arch, "wework.node");
    if (safeCopy(src, dst)) {
      copied++;
      if (sample.length < 12) sample.push(dst);
    }
  }

  log("copied:", copied);
  log("from:", src);
  log("sample to:", sample);
}

try {
  main();
} catch (e) {
  log("ERROR (ignored):", e && e.stack ? e.stack : e);
} finally {
  process.exit(0);
}
