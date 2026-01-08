/** @type {import('next').NextConfig} */
const nextConfig = {
  // 不要 externalize wework-chat-node（external module 会丢 .so）
  // serverExternalPackages: ["wework-chat-node"],

  // 强制把 wework-chat-node 全包带进所有 server functions
  outputFileTracingIncludes: {
    "/*": ["./node_modules/wework-chat-node/**"],
  },
};

module.exports = nextConfig;
