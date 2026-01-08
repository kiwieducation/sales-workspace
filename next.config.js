/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ 强制把 wework-chat-node 整包带进函数包（JS + .node + .so + compiled/**）
  outputFileTracingIncludes: {
    "/*": ["./node_modules/wework-chat-node/**"],
  },

  // ✅ 对 native addon 场景：用 Webpack 更稳，绕开 Turbopack 的静态解析限制
  experimental: {
    turbo: {
      enabled: false,
    },
  },

  webpack(config) {
    // 保险：不要让 webpack 把 node 原生二进制当成可打包资源
    config.module.rules.push({
      test: /\.node$/,
      loader: "node-loader",
    });
    return config;
  },
};

module.exports = nextConfig;
