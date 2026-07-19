import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#020617',
    description: 'Experiência mobile-first de apoio à comparação de veículos.',
    display: 'standalone',
    icons: [
      {
        purpose: 'any',
        sizes: '192x192',
        src: '/icons/icon-192.svg',
        type: 'image/svg+xml',
      },
      {
        purpose: 'any',
        sizes: '512x512',
        src: '/icons/icon-512.svg',
        type: 'image/svg+xml',
      },
      {
        purpose: 'maskable',
        sizes: '512x512',
        src: '/icons/icon-512.svg',
        type: 'image/svg+xml',
      },
    ],
    id: '/',
    lang: 'pt-BR',
    name: 'Compra Car',
    orientation: 'portrait-primary',
    scope: '/',
    short_name: 'Compra Car',
    start_url: '/',
    theme_color: '#0f172a',
  };
}
