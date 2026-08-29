import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  canOfferPwaInstall,
  classifyPwaInstallAvailability,
} from '../src/components/use-pwa-install';

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');
const browser = (
  overrides: Partial<Parameters<typeof classifyPwaInstallAvailability>[0]> = {},
) => ({
  browserManual: true,
  displayModeStandalone: false,
  ios: false,
  nativePrompt: false,
  navigatorStandalone: false,
  ...overrides,
});

describe('Sprint 14G.4 install availability after app removal', () => {
  it('hides the action whenever either standalone signal is active', () => {
    expect(
      canOfferPwaInstall(classifyPwaInstallAvailability(browser({ displayModeStandalone: true }))),
    ).toBe(false);
    expect(
      canOfferPwaInstall(classifyPwaInstallAvailability(browser({ navigatorStandalone: true }))),
    ).toBe(false);
  });

  it('shows the browser action and prioritizes a native prompt when available', () => {
    const availability = classifyPwaInstallAvailability(browser({ nativePrompt: true }));
    expect(availability).toBe('native');
    expect(canOfferPwaInstall(availability)).toBe(true);

    const menu = source('../src/components/user-menu.tsx');
    expect(menu).toContain('await requestNativeInstall()');
  });

  it('keeps a manual browser path without beforeinstallprompt', () => {
    const availability = classifyPwaInstallAvailability(browser());
    expect(availability).toBe('browser-manual');
    expect(canOfferPwaInstall(availability)).toBe(true);

    const menu = source('../src/components/user-menu.tsx');
    expect(menu).toContain('<PwaInstallInstructions');
    expect(menu).toContain('manualInstall');
  });

  it('makes installation available again when returning from standalone to the browser', () => {
    expect(classifyPwaInstallAvailability(browser({ displayModeStandalone: true }))).toBe(
      'installed',
    );
    expect(classifyPwaInstallAvailability(browser())).toBe('browser-manual');

    const helper = source('../src/components/use-pwa-install.ts');
    expect(helper).toContain("window.addEventListener('pageshow', refreshAvailability)");
    expect(helper).toContain("document.addEventListener('visibilitychange'");
  });

  it('does not persist installation state that could block reinstall', () => {
    const helper = source('../src/components/use-pwa-install.ts');
    expect(helper).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    expect(helper).toContain("window.addEventListener('appinstalled'");
  });

  it('preserves specific iOS instructions', () => {
    expect(classifyPwaInstallAvailability(browser({ ios: true }))).toBe('ios-manual');
    const instructions = source('../src/components/pwa-install-instructions.tsx');
    expect(instructions).toContain('Toque em Compartilhar.');
    expect(instructions).toContain('Adicionar à Tela de Início');
    expect(instructions).toContain('Toque em “Adicionar”.');
  });
});
