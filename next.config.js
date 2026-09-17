/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  // Single-image deployable build. Emits `.next/standalone/` containing a
  // minimal `server.js` + pruned `node_modules/` for Docker and self-hosted
  // production. `next dev` and `next build` keep working as before.
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['raw.githubusercontent.com', 'assets.coingecko.com'],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    // Mock @react-native-async-storage for MetaMask SDK
    config.resolve.alias['@react-native-async-storage/async-storage'] = path.join(__dirname, 'lib/__mocks__/async-storage.js');
    // Add path alias
    config.resolve.alias['@'] = path.join(__dirname, '.');
    return config;
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
