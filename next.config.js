/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ 强制把 wework-chat-node 整包带进函数包（JS + .node + .so + compiled/**）
  outputFileTracingIncludes: {
    "/*": ["./node_modules/wework-chat-node/**"],
  },
};

module.exports = nextConfig;
