import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Turbopack config (default bundler in Next.js 16)
  turbopack: {
    resolveAlias: {
      // MetaMask SDK tries to import React Native modules that don't exist in web context
      '@react-native-async-storage/async-storage': { browser: '' },
      // pino tries to optionally require 'pino-pretty' which is not installed
      'pino-pretty': { browser: '' },
    },
  },
  // Webpack fallback config (used when running with --turbopack=false)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self' https://rpc.testnet.arc.network https://api.circle.com;",
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
