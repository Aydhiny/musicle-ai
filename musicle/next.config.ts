/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAliases: {
      // Stub out Node built-ins that essentia.js references but never
      // actually calls in the browser (it detects the env at runtime).
      fs: "./lib/empty-module.js",
      path: "./lib/empty-module.js",
      crypto: "./lib/empty-module.js",
      os: "./lib/empty-module.js",
      stream: "./lib/empty-module.js",
      buffer: "./lib/empty-module.js",
    },
  },
};

module.exports = nextConfig;
