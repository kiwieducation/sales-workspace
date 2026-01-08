/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ 不让 Next/Webpack bundle 这个 native addon（必须走 node_modules 原路径）
  serverExternalPackages: ["wework-chat-node"],

  // ✅ 关键兜底：强制把 native 文件带进 serverless 函数包（/var/task）
  outputFileTracingIncludes: {
    // 你的实际路由（从 build 输出看到是 ƒ /api/wecom/sync）
    "/api/wecom/sync": ["./node_modules/wework-chat-node/**"],

    // 额外兜底：某些情况下 route key 会被用到（加了不亏）
    "/api/wecom/sync/route": ["./node_modules/wework-chat-node/**"],
  },
};

module.exports = nextConfig;
