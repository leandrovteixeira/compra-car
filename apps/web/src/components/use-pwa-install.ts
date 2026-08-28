'use client';

import { useCallback, useEffect, useState } from 'react';

export type PwaInstallAvailability =
  'checking' | 'installed' | 'native' | 'ios-manual' | 'mobile-manual' | 'unavailable';

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

interface NavigatorWithStandalone extends Navigator {
  readonly standalone?: boolean;
}

export interface PwaInstallEnvironment {
  readonly displayModeStandalone: boolean;
  readonly ios: boolean;
  readonly mobile: boolean;
  readonly nativePrompt: boolean;
  readonly navigatorStandalone: boolean;
}

export function classifyPwaInstallAvailability({
  displayModeStandalone,
  ios,
  mobile,
  nativePrompt,
  navigatorStandalone,
}: PwaInstallEnvironment): Exclude<PwaInstallAvailability, 'checking'> {
  if (displayModeStandalone || navigatorStandalone) return 'installed';
  if (nativePrompt) return 'native';
  if (ios) return 'ios-manual';
  if (mobile) return 'mobile-manual';
  return 'unavailable';
}

export function canOfferPwaInstall(availability: PwaInstallAvailability): boolean {
  return (
    availability === 'native' || availability === 'ios-manual' || availability === 'mobile-manual'
  );
}

export function detectIos(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function usePwaInstall() {
  const [availability, setAvailability] = useState<PwaInstallAvailability>('checking');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const detectWithoutNativePrompt = useCallback(() => {
    const browserNavigator = navigator as NavigatorWithStandalone;
    const ios = detectIos(
      browserNavigator.userAgent,
      browserNavigator.platform,
      browserNavigator.maxTouchPoints,
    );

    return classifyPwaInstallAvailability({
      displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
      ios,
      mobile: ios || /Android|Mobile/i.test(browserNavigator.userAgent),
      nativePrompt: false,
      navigatorStandalone: browserNavigator.standalone === true,
    });
  }, []);

  useEffect(() => {
    setAvailability(detectWithoutNativePrompt());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setAvailability('native');
    };
    const handleInstalled = () => {
      setDeferredPrompt(null);
      setAvailability('installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [detectWithoutNativePrompt]);

  const requestNativeInstall = useCallback(async (): Promise<'completed' | 'manual'> => {
    if (!deferredPrompt) {
      setAvailability(detectWithoutNativePrompt());
      return 'manual';
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setAvailability(choice.outcome === 'accepted' ? 'installed' : detectWithoutNativePrompt());
      return 'completed';
    } catch {
      setDeferredPrompt(null);
      setAvailability(detectWithoutNativePrompt());
      return 'manual';
    }
  }, [deferredPrompt, detectWithoutNativePrompt]);

  return { availability, requestNativeInstall } as const;
}
