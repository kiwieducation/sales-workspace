/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./node_modules/wework-chat-node/**"],
  },
};

module.exports = nextConfig;
