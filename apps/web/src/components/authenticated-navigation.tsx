import type { AuthProfile } from '@compra-car/adapter-supabase';
import Link from 'next/link';

import { logout } from '../app/actions/auth';
import { LogoutControl } from './logout-control';
import {
  getAuthenticatedNavigationModel,
  type AuthenticatedArea,
  type NavigationLink,
} from './authenticated-navigation-policy';

export interface AuthenticatedNavigationProps {
  readonly area: AuthenticatedArea;
  readonly displayName: string;
  readonly logoutAction: () => Promise<never>;
  readonly profile: AuthProfile;
}

function NavigationControls({
  links,
  logoutAction,
}: {
  readonly links: readonly NavigationLink[];
  readonly logoutAction: () => Promise<never>;
}) {
  return (
    <>
      {links.map((link) => (
        <Link className="ui-button ui-button--secondary" href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
      <LogoutControl action={logoutAction} />
    </>
  );
}

export function AuthenticatedNavigation({
  area,
  displayName,
  logoutAction,
  profile,
}: AuthenticatedNavigationProps) {
  const { areaLabel, links, roleLabel } = getAuthenticatedNavigationModel(profile, area);

  return (
    <header className="border-b border-border bg-surface text-text-primary">
      <div className="mx-auto flex min-h-14 w-full max-w-[100rem] items-center justify-between gap-3 px-4 py-2 sm:px-5 lg:px-6">
        <div className="min-w-0">
          <Link
            className="inline-flex rounded text-xs font-semibold uppercase tracking-[0.14em] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href={area === 'admin' ? '/admin' : '/'}
          >
            Compra Car
          </Link>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {areaLabel} · {displayName} · {roleLabel}
          </p>
        </div>

        <nav
          aria-label={`Navegação da ${areaLabel.toLocaleLowerCase('pt-BR')}`}
          className="hidden items-center gap-2 sm:flex"
        >
          <NavigationControls links={links} logoutAction={logoutAction} />
        </nav>

        <details className="group relative sm:hidden">
          <summary className="ui-button ui-button--secondary cursor-pointer list-none">
            Menu
          </summary>
          <nav
            aria-label={`Menu móvel da ${areaLabel.toLocaleLowerCase('pt-BR')}`}
            className="ui-surface absolute right-0 z-50 mt-2 grid min-w-52 gap-2 shadow-lg"
          >
            <NavigationControls links={links} logoutAction={logoutAction} />
          </nav>
        </details>
      </div>
    </header>
  );
}

export function AppAuthenticatedNavigation(
  props: Omit<AuthenticatedNavigationProps, 'logoutAction'>,
) {
  return <AuthenticatedNavigation {...props} logoutAction={logout} />;
}
