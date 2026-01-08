/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * 终局目标：
   * 1) wework-chat-node 作为 external package（不要打进 .next）
   * 2) 只对 /api/wecom/sync 强制把 wework-chat-node 全包 trace 进函数包
   */
  serverExternalPackages: ["wework-chat-node"],

  outputFileTracingIncludes: {
    "/api/wecom/sync": ["./node_modules/wework-chat-node/**"],
  },
};

module.exports = nextConfig;
