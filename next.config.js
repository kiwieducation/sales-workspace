/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * 关键：让 wework-chat-node 不被打包进 .next 产物
   * 否则 bindings 会在 /var/task/.next/... 里找 wework.node（你现在就是这个情况）
   */
  serverExternalPackages: ["wework-chat-node"],

  /**
   * 同时强制把 wework-chat-node 的所有文件带进函数包（.node/.so/compiled/**）
   * 以及 vendor/wecom/lib（后续如果要补依赖库）
   */
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/wework-chat-node/**",
      "./vendor/wecom/lib/**",
    ],
  },
};

module.exports = nextConfig;
