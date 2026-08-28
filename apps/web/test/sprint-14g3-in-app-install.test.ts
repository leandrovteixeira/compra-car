import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { canOfferPwaInstall } from '../src/components/use-pwa-install';

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

describe('Sprint 14G.3 in-app install option', () => {
  it('shows an install action only for native or useful manual installation paths', () => {
    expect(canOfferPwaInstall('native')).toBe(true);
    expect(canOfferPwaInstall('ios-manual')).toBe(true);
    expect(canOfferPwaInstall('mobile-manual')).toBe(true);
    expect(canOfferPwaInstall('checking')).toBe(false);
    expect(canOfferPwaInstall('installed')).toBe(false);
    expect(canOfferPwaInstall('unavailable')).toBe(false);
  });

  it('reuses the shared hook in UserMenu and invokes the native prompt path', () => {
    const menu = source('../src/components/user-menu.tsx');

    expect(menu).toContain('usePwaInstall()');
    expect(menu).toContain('canOfferPwaInstall(availability)');
    expect(menu).toContain('await requestNativeInstall()');
    expect(menu).toContain('Instalar aplicativo');
    expect(menu).not.toContain('beforeinstallprompt');
  });

  it('shares compact manual instructions with post-invite onboarding', () => {
    const menu = source('../src/components/user-menu.tsx');
    const onboarding = source('../src/components/post-invite-install-step.tsx');
    const instructions = source('../src/components/pwa-install-instructions.tsx');

    expect(menu).toContain('<PwaInstallInstructions');
    expect(onboarding).toContain('<PwaInstallInstructions');
    expect(instructions).toContain('Toque em Compartilhar.');
    expect(instructions).toContain('Adicionar à Tela de Início');
    expect(instructions).toContain('Abra o menu do navegador');
  });

  it('keeps the menu compact, keyboard-accessible and mobile-safe', () => {
    const menu = source('../src/components/user-menu.tsx');

    expect(menu).toContain('w-60');
    expect(menu).toContain('touch-target');
    expect(menu).toContain('type="button"');
    expect(menu).toContain('aria-expanded');
    expect(menu).toContain('focus-visible:outline-2');
  });

  it('preserves logout after the install action', () => {
    const menu = source('../src/components/user-menu.tsx');
    const installPosition = menu.indexOf('Instalar aplicativo');
    const logoutPosition = menu.indexOf('<LogoutControl');

    expect(installPosition).toBeGreaterThan(-1);
    expect(logoutPosition).toBeGreaterThan(installPosition);
    expect(menu).toContain('logoutAction');
  });
});
