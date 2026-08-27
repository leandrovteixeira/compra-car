import type { AuthProfile } from '@compra-car/adapter-supabase';

export type AuthenticatedArea = 'seller' | 'admin';

export interface NavigationLink {
  readonly href: string;
  readonly label: string;
}

export interface NavigationContext extends NavigationLink {
  readonly area: AuthenticatedArea;
}

export function getAvailableContexts(profile: AuthProfile): readonly NavigationContext[] {
  return [
    ...(profile.role === 'admin'
      ? [{ area: 'admin' as const, href: '/admin', label: 'Administração' }]
      : []),
    { area: 'seller', href: '/', label: 'Vendedor' },
  ];
}

export interface AuthenticatedNavigationModel {
  readonly areaLabel: string;
  readonly localLinks: readonly NavigationLink[];
  readonly roleLabel: string;
}

export function getAuthenticatedNavigationModel(
  profile: AuthProfile,
  area: AuthenticatedArea,
): AuthenticatedNavigationModel {
  if (area === 'admin') {
    return {
      areaLabel: 'Área administrativa',
      localLinks: [],
      roleLabel: 'Administrador',
    };
  }

  return {
    areaLabel: 'Área do vendedor',
    localLinks: [{ href: '/invite-requests', label: 'Convidar alguém' }],
    roleLabel: profile.role === 'admin' ? 'Administrador' : 'Vendedor',
  };
}
