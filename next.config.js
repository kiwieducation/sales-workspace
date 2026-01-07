/** @type {import('next').NextConfig} */
const nextConfig = {
    // ✅ 关键：让 Next server 端不要把这些包打进 .next 里（否则 native binding 路径会炸）
    serverExternalPackages: ["wework-chat-node"],
  
    // 你原来如果没有其他配置，可以先保持最简单
  };
  
  module.exports = nextConfig;
  