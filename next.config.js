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
    // CORS for the public /api surface. We allow any origin (the API is
    // intentionally public for the launch — there's no auth, no cookies,
    // and the wallet endpoint takes a wallet address as a query param,
    // not from a session).
    //
    // We deliberately do NOT set Access-Control-Allow-Credentials: browsers
    // reject the wildcard-with-credentials combination per the CORS spec
    // (RFC 6454 §7.2) and accepting credentials from any origin would
    // leak user data. If we add cookie-based auth later, replace `*`
    // with an explicit allowlist and re-enable credentials.
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
