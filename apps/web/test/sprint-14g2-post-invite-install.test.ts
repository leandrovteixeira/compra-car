import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { APP_NAME } from '../src/config/app-identity';
import { classifyPwaInstallAvailability, detectIos } from '../src/components/use-pwa-install';

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

const environment = (
  overrides: Partial<Parameters<typeof classifyPwaInstallAvailability>[0]> = {},
) => ({
  displayModeStandalone: false,
  ios: false,
  mobile: true,
  nativePrompt: false,
  navigatorStandalone: false,
  ...overrides,
});

describe('Sprint 14G.2 post-invite install offer', () => {
  it('classifies native, iOS, mobile fallback, desktop and installed environments', () => {
    expect(classifyPwaInstallAvailability(environment({ nativePrompt: true }))).toBe('native');
    expect(classifyPwaInstallAvailability(environment({ ios: true }))).toBe('ios-manual');
    expect(classifyPwaInstallAvailability(environment())).toBe('mobile-manual');
    expect(classifyPwaInstallAvailability(environment({ mobile: false }))).toBe('unavailable');
    expect(
      classifyPwaInstallAvailability(
        environment({ displayModeStandalone: true, nativePrompt: true }),
      ),
    ).toBe('installed');
    expect(
      classifyPwaInstallAvailability(environment({ navigatorStandalone: true, ios: true })),
    ).toBe('installed');
  });

  it('recognizes iPhone, iPad and touch-based iPadOS without spoofing desktop Safari', () => {
    expect(detectIos('Mozilla/5.0 (iPhone)', 'iPhone', 5)).toBe(true);
    expect(detectIos('Mozilla/5.0 (iPad)', 'iPad', 5)).toBe(true);
    expect(detectIos('Mozilla/5.0 (Macintosh)', 'MacIntel', 5)).toBe(true);
    expect(detectIos('Mozilla/5.0 (Macintosh)', 'MacIntel', 0)).toBe(false);
  });

  it('mounts the install controller during password creation but reveals the offer only on new success', () => {
    const onboarding = source('../src/components/invite-onboarding.tsx');
    const passwordForm = source('../src/components/auth-password-form.tsx');

    expect(onboarding).toContain('usePwaInstall()');
    expect(onboarding).toContain('if (!completion)');
    expect(onboarding).toContain("newlyCompleted: message === 'Cadastro concluído.'");
    expect(onboarding).toContain('<PostInviteInstallStep');
    expect(passwordForm).toContain("state.status !== 'success'");
    expect(passwordForm).toContain('if (onSuccess) onSuccess');
  });

  it('uses native prompt, manual instructions, centralized identity and optional continuation', () => {
    const install = source('../src/components/use-pwa-install.ts');
    const step = source('../src/components/post-invite-install-step.tsx');
    const instructions = source('../src/components/pwa-install-instructions.tsx');

    expect(install).toContain("window.addEventListener('beforeinstallprompt'");
    expect(install).toContain("window.addEventListener('appinstalled'");
    expect(install).toContain("window.matchMedia('(display-mode: standalone)')");
    expect(step).toContain('await requestNativeInstall()');
    expect(step).toContain('<PwaInstallInstructions');
    expect(instructions).toContain('Toque em Compartilhar.');
    expect(instructions).toContain('Abra o menu do navegador');
    expect(step).toContain('Agora não');
    expect(step).toContain('onClick={continueToApp}');
    expect(step).toContain('{APP_NAME}');
    expect(APP_NAME).not.toBe('');
    expect(step).not.toContain('Compra Car');
  });

  it('keeps scanner-safe invite confirmation and password lifecycle isolated from installation', () => {
    const callback = source('../src/app/auth/callback/invite/route.ts');
    const confirmation = source('../src/app/auth/invite/confirm/actions.ts');
    const lifecycle = source('../src/application/auth/password-lifecycle.ts');

    expect(callback).toContain("searchParams.get('token_hash')");
    expect(callback).not.toContain('verifyInviteToken');
    expect(confirmation).toContain('verifyInviteToken');
    expect(confirmation).toContain('httpOnly: true');
    expect(`${callback}${confirmation}${lifecycle}`).not.toContain('beforeinstallprompt');
  });

  it('retains narrow AuthShell layout and touch-friendly full-width actions', () => {
    const shell = source('../src/components/auth-shell.tsx');
    const step = source('../src/components/post-invite-install-step.tsx');

    expect(shell).toContain('w-full max-w-sm');
    expect(shell).toContain('px-4');
    expect(step).toContain("buttonClassName({ fullWidth: true, variant: 'interactive' })");
    expect(step).toContain('touch-target');
  });
});
