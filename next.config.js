/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * 终局策略：
   * - 强制把 wework-chat-node 的所有 native 产物（.node/.so/compiled/**）带进 serverless 函数包
   * - 同时带上 vendor/wecom/lib（用于补齐 OpenSSL 等依赖）
   *
   * 用 "/*" 是为了稳定：避免 App Router/Route Handler 的 key 命中差异导致 include 失效。
   */
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/wework-chat-node/**",
      "./vendor/wecom/lib/**",
    ],
  },
};

module.exports = nextConfig;
