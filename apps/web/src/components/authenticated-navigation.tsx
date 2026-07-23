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
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          href={link.href}
          key={link.href}
        >
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
    <header className="border-b border-slate-800 bg-slate-900/90 text-slate-50">
      <div className="mx-auto flex min-h-18 w-full max-w-[100rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <Link
            className="inline-flex rounded-md text-xs font-bold uppercase tracking-[0.22em] text-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            href={area === 'admin' ? '/admin' : '/'}
          >
            Compra Car
          </Link>
          <p className="mt-1 truncate text-sm text-slate-300">
            {areaLabel} · {displayName} · {roleLabel}
          </p>
        </div>

        <nav
          aria-label={`Navegação da ${areaLabel.toLocaleLowerCase('pt-BR')}`}
          className="hidden items-center gap-3 sm:flex"
        >
          <NavigationControls links={links} logoutAction={logoutAction} />
        </nav>

        <details className="group relative sm:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            Menu
          </summary>
          <nav
            aria-label={`Menu móvel da ${areaLabel.toLocaleLowerCase('pt-BR')}`}
            className="absolute right-0 z-50 mt-2 grid min-w-52 gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl shadow-slate-950/70"
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
