import type { Metadata, Viewport } from 'next';

import {
  APP_DESCRIPTION,
  APP_ICON_PATHS,
  APP_NAME,
  APP_SHORT_NAME,
  APP_THEME_COLOR,
} from './app-identity';

export const APP_METADATA: Metadata = {
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_SHORT_NAME,
  },
  description: APP_DESCRIPTION,
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: [{ sizes: '180x180', type: 'image/png', url: APP_ICON_PATHS.appleTouch }],
    icon: [
      { sizes: '192x192', type: 'image/png', url: APP_ICON_PATHS.standard192 },
      { sizes: '512x512', type: 'image/png', url: APP_ICON_PATHS.standard512 },
    ],
    shortcut: APP_ICON_PATHS.standard192,
  },
  manifest: '/manifest.webmanifest',
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
};

export const APP_VIEWPORT: Viewport = {
  colorScheme: 'light',
  themeColor: APP_THEME_COLOR,
};
