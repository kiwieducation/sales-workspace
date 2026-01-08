/** @type {import('next').NextConfig} */
const nextConfig = {
  // 明确使用 Node.js runtime（不是 edge）
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },
};

module.exports = nextConfig;
