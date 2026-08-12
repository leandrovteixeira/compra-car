import type { NextConfig } from 'next';

import { IMPORT_ENGINE_SERVER_ACTION_BODY_SIZE_LIMIT } from './src/config/import-engine-upload';

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: IMPORT_ENGINE_SERVER_ACTION_BODY_SIZE_LIMIT,
    },
    middlewareClientMaxBodySize: IMPORT_ENGINE_SERVER_ACTION_BODY_SIZE_LIMIT,
  },
  transpilePackages: [
    '@compra-car/adapter-supabase',
    '@compra-car/contracts',
    '@compra-car/core',
    '@compra-car/shared',
    '@compra-car/ui',
  ],
} satisfies NextConfig;

export default nextConfig;
