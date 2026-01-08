/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ 不让 Next/Webpack bundle 这个 native addon（必须走 node_modules 原路径）
  serverExternalPackages: ["wework-chat-node"],

  // ✅ 关键兜底：强制把 native 文件带进 serverless 函数包（/var/task）
  experimental: {
    outputFileTracingIncludes: {
      // 你的实际路由（很多情况下这个就够）
      "/api/wecom/sync": ["./node_modules/wework-chat-node/**"],

      // App Router 某些版本/场景会用 route 作为 key（加上更稳）
      "/api/wecom/sync/route": ["./node_modules/wework-chat-node/**"],
    },
  },
};

module.exports = nextConfig;
