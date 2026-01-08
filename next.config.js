/** @type {import('next').NextConfig} */
const nextConfig = {
  // 强制把 wework-chat-node 整包带进 Serverless Functions（含 .js/.node/.so/compiled/**）
  outputFileTracingIncludes: {
    "/*": ["./node_modules/wework-chat-node/**"],
  },
};

module.exports = nextConfig;
