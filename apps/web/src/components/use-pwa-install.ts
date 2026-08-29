'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PwaInstallAvailability =
  'browser-manual' | 'checking' | 'installed' | 'ios-manual' | 'native' | 'unavailable';

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

interface NavigatorWithStandalone extends Navigator {
  readonly standalone?: boolean;
}

export interface PwaInstallEnvironment {
  readonly browserManual: boolean;
  readonly displayModeStandalone: boolean;
  readonly ios: boolean;
  readonly nativePrompt: boolean;
  readonly navigatorStandalone: boolean;
}

export function classifyPwaInstallAvailability({
  browserManual,
  displayModeStandalone,
  ios,
  nativePrompt,
  navigatorStandalone,
}: PwaInstallEnvironment): Exclude<PwaInstallAvailability, 'checking'> {
  if (displayModeStandalone || navigatorStandalone) return 'installed';
  if (nativePrompt) return 'native';
  if (ios) return 'ios-manual';
  if (browserManual) return 'browser-manual';
  return 'unavailable';
}

export function canOfferPwaInstall(availability: PwaInstallAvailability): boolean {
  return (
    availability === 'native' || availability === 'ios-manual' || availability === 'browser-manual'
  );
}

export function detectIos(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function usePwaInstall({
  desktopManual = false,
}: { readonly desktopManual?: boolean } = {}) {
  const [availability, setAvailability] = useState<PwaInstallAvailability>('checking');
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  const detectWithoutNativePrompt = useCallback(() => {
    const browserNavigator = navigator as NavigatorWithStandalone;
    const chromium = /Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser/i.test(
      browserNavigator.userAgent,
    );
    const ios = detectIos(
      browserNavigator.userAgent,
      browserNavigator.platform,
      browserNavigator.maxTouchPoints,
    );

    return classifyPwaInstallAvailability({
      browserManual:
        ios || /Android|Mobile/i.test(browserNavigator.userAgent) || (desktopManual && chromium),
      displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
      ios,
      nativePrompt: false,
      navigatorStandalone: browserNavigator.standalone === true,
    });
  }, [desktopManual]);

  useEffect(() => {
    const refreshAvailability = () => {
      const detected = detectWithoutNativePrompt();
      setAvailability(deferredPrompt.current && detected !== 'installed' ? 'native' : detected);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setAvailability('native');
    };
    const handleInstalled = () => {
      deferredPrompt.current = null;
      setAvailability('installed');
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshAvailability();
    };

    refreshAvailability();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('pageshow', refreshAvailability);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('pageshow', refreshAvailability);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [detectWithoutNativePrompt]);

  const requestNativeInstall = useCallback(async (): Promise<'completed' | 'manual'> => {
    const prompt = deferredPrompt.current;
    if (!prompt) {
      setAvailability(detectWithoutNativePrompt());
      return 'manual';
    }

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      deferredPrompt.current = null;
      setAvailability(choice.outcome === 'accepted' ? 'installed' : detectWithoutNativePrompt());
      return 'completed';
    } catch {
      deferredPrompt.current = null;
      setAvailability(detectWithoutNativePrompt());
      return 'manual';
    }
  }, [deferredPrompt, detectWithoutNativePrompt]);

  return { availability, requestNativeInstall } as const;
}
