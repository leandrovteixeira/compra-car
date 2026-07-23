import type { AuthProfile } from '@compra-car/adapter-supabase';

export type AuthenticatedArea = 'seller' | 'admin';

export interface NavigationLink {
  readonly href: string;
  readonly label: string;
}

export interface AuthenticatedNavigationModel {
  readonly areaLabel: string;
  readonly links: readonly NavigationLink[];
  readonly roleLabel: string;
}

export function getAuthenticatedNavigationModel(
  profile: AuthProfile,
  area: AuthenticatedArea,
): AuthenticatedNavigationModel {
  if (area === 'admin') {
    return {
      areaLabel: 'Área administrativa',
      links: [{ href: '/', label: 'Área do vendedor' }],
      roleLabel: 'Administrador',
    };
  }

  return {
    areaLabel: 'Área do vendedor',
    links: profile.role === 'admin' ? [{ href: '/admin', label: 'Administração' }] : [],
    roleLabel: profile.role === 'admin' ? 'Administrador' : 'Vendedor',
  };
}
