import type { MetadataRoute } from 'next';

import {
  APP_BACKGROUND_COLOR,
  APP_DESCRIPTION,
  APP_ICON_PATHS,
  APP_NAME,
  APP_SHORT_NAME,
  APP_THEME_COLOR,
} from '@/config/app-identity';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: APP_BACKGROUND_COLOR,
    description: APP_DESCRIPTION,
    display: 'standalone',
    icons: [
      {
        purpose: 'any',
        sizes: '192x192',
        src: APP_ICON_PATHS.standard192,
        type: 'image/png',
      },
      {
        purpose: 'any',
        sizes: '512x512',
        src: APP_ICON_PATHS.standard512,
        type: 'image/png',
      },
      {
        purpose: 'maskable',
        sizes: '512x512',
        src: APP_ICON_PATHS.maskable512,
        type: 'image/png',
      },
    ],
    id: '/',
    lang: 'pt-BR',
    name: APP_NAME,
    scope: '/',
    short_name: APP_SHORT_NAME,
    start_url: '/',
    theme_color: APP_THEME_COLOR,
  };
}
