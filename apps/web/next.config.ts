import type { NextConfig } from 'next';

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: [
    '@compra-car/adapter-supabase',
    '@compra-car/contracts',
    '@compra-car/core',
    '@compra-car/shared',
    '@compra-car/ui',
  ],
} satisfies NextConfig;

export default nextConfig;
