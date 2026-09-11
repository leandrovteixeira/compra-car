'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LogoutControl } from './logout-control';
import { PwaInstallInstructions } from './pwa-install-instructions';
import { canOfferPwaInstall, usePwaInstall } from './use-pwa-install';

interface MenuLink {
  readonly href: string;
  readonly label: string;
}

const itemClass =
  'touch-target mt-1 flex min-h-8 w-full items-center rounded-md px-2 text-left text-[0.8125rem] font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary';

export function UserMenu({
  displayName,
  logoutAction,
  roleLabel,
  navigationLinks = [],
  showInvite = false,
}: {
  readonly displayName: string;
  readonly logoutAction: () => Promise<never>;
  readonly roleLabel: string;
  readonly navigationLinks?: readonly MenuLink[];
  readonly showInvite?: boolean;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const { availability, requestNativeInstall } = usePwaInstall({ desktopManual: true });
  const [requestingInstall, setRequestingInstall] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const canInstall = canOfferPwaInstall(availability);
  const manualInstall = availability === 'ios-manual' || availability === 'browser-manual';
  const instructionsId = 'user-menu-install-instructions';

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) {
        menu.current.removeAttribute('open');
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') menu.current?.removeAttribute('open');
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  const close = () => menu.current?.removeAttribute('open');
  const install = async () => {
    if (manualInstall) {
      setShowInstallInstructions((current) => !current);
      return;
    }
    setRequestingInstall(true);
    const result = await requestNativeInstall();
    setRequestingInstall(false);
    if (result === 'completed') close();
    else setShowInstallInstructions(true);
  };

  return (
    <details className="group relative shrink-0" ref={menu}>
      <summary
        aria-label="Menu"
        className="ui-button ui-button--ghost ui-button--compact cursor-pointer list-none"
      >
        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
          <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
        </svg>
        <span>Menu</span>
      </summary>
      <section aria-label="Menu" className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-surface p-2 shadow-lg">
        <div className="border-b border-border px-2 pb-2">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="mt-0.5 text-xs text-text-muted">{roleLabel}</p>
        </div>

        {navigationLinks.length ? (
          <nav className="my-1 border-b border-border pb-1 lg:hidden">
            {navigationLinks.map((link) => (
              <Link className={itemClass} href={link.href} key={link.href} onClick={close}>
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {canInstall ? (
          <>
            <button className={itemClass} disabled={requestingInstall} onClick={install} type="button">
              {requestingInstall ? 'Abrindo instalação…' : 'Instalar aplicativo'}
            </button>
            {showInstallInstructions ? (
              <div className="px-1 py-1" role="status">
                <PwaInstallInstructions id={instructionsId} ios={availability === 'ios-manual'} />
              </div>
            ) : null}
          </>
        ) : null}

        {showInvite ? (
          <Link className={itemClass} href="/invite-requests" onClick={close}>
            Convidar
          </Link>
        ) : null}

        <LogoutControl action={logoutAction} className={itemClass} />
      </section>
    </details>
  );
}
