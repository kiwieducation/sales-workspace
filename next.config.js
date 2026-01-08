/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Stable strategy:
   * - Do NOT externalize wework-chat-node (avoid Vercel external module path imprint like /vercel/path0)
   * - Force trace wework-chat-node files into serverless bundle
   * - Reserve vendor/wecom/lib for future vendored shared libs if ever needed
   */
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/wework-chat-node/**",
      "./vendor/wecom/lib/**",
    ],
  },
};

module.exports = nextConfig;
