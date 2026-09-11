import type { AuthProfile } from '@compra-car/adapter-supabase';
import Link from 'next/link';

import { logout } from '../app/actions/auth';
import { ApplicationTopbar } from './application-topbar';
import {
  getAuthenticatedNavigationModel,
  type AuthenticatedArea,
} from './authenticated-navigation-policy';

export interface AuthenticatedNavigationProps {
  readonly area: AuthenticatedArea;
  readonly displayName: string;
  readonly logoutAction: () => Promise<never>;
  readonly profile: AuthProfile;
}

export function AuthenticatedNavigation({
  area,
  displayName,
  logoutAction,
  profile,
}: AuthenticatedNavigationProps) {
  const { localLinks } = getAuthenticatedNavigationModel(profile, area);
  const links = localLinks.map((link) => (
    <Link
      className="ui-button ui-button--ghost ui-button--compact justify-start"
      href={link.href}
      key={link.href}
    >
      {link.label}
    </Link>
  ));

  const sellerMenu = area === 'seller' && links.length ? (
    <details className="relative shrink-0">
      <summary
        aria-label="Menu do vendedor"
        className="ui-button ui-button--ghost ui-button--compact cursor-pointer list-none"
      >
        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
          <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
        </svg>
        <span className="hidden min-[28rem]:inline">Menu</span>
      </summary>
      <nav
        aria-label="Navegação da área do vendedor"
        className="absolute right-0 z-50 mt-2 grid min-w-52 gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg"
      >
        {links}
      </nav>
    </details>
  ) : undefined;

  const mobileAdminMenu = area !== 'seller' && links.length ? (
    <details className="relative shrink-0 sm:hidden">
      <summary
        aria-label="Mais"
        className="ui-button ui-button--ghost ui-button--compact cursor-pointer list-none"
      >
        <span className="hidden min-[28rem]:inline">Mais</span>
        <svg aria-hidden="true" className="size-4 min-[28rem]:hidden" fill="none" viewBox="0 0 16 16">
          <circle cx="3" cy="8" fill="currentColor" r="1" />
          <circle cx="8" cy="8" fill="currentColor" r="1" />
          <circle cx="13" cy="8" fill="currentColor" r="1" />
        </svg>
      </summary>
      <nav
        aria-label="Navegação"
        className="absolute right-0 z-50 mt-2 grid min-w-44 gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg"
      >
        {links}
      </nav>
    </details>
  ) : undefined;

  return (
    <ApplicationTopbar
      area={area}
      displayName={displayName}
      logoutAction={logoutAction}
      mobileNavigation={sellerMenu ?? mobileAdminMenu}
      profile={profile}
      secondaryNavigation={area === 'seller' ? undefined : links}
    />
  );
}

export function AppAuthenticatedNavigation(
  props: Omit<AuthenticatedNavigationProps, 'logoutAction'>,
) {
  return <AuthenticatedNavigation {...props} logoutAction={logout} />;
}
