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
      className="ui-button ui-button--ghost ui-button--compact"
      href={link.href}
      key={link.href}
    >
      {link.label}
    </Link>
  ));
  return (
    <ApplicationTopbar
      area={area}
      displayName={displayName}
      logoutAction={logoutAction}
      mobileNavigation={
        links.length ? (
          <details className="relative sm:hidden">
            <summary className="ui-button ui-button--ghost ui-button--compact cursor-pointer list-none">
              Mais
            </summary>
            <nav
              aria-label="Navegação da área do vendedor"
              className="absolute right-0 z-50 mt-2 grid min-w-44 gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg"
            >
              {links}
            </nav>
          </details>
        ) : undefined
      }
      profile={profile}
      secondaryNavigation={links}
    />
  );
}

export function AppAuthenticatedNavigation(
  props: Omit<AuthenticatedNavigationProps, 'logoutAction'>,
) {
  return <AuthenticatedNavigation {...props} logoutAction={logout} />;
}
