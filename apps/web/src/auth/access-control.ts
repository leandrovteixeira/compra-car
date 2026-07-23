import type { AppRole, AuthProfile } from '@compra-car/adapter-supabase';

export type ProtectedArea = 'seller' | 'admin';

export function hasRole(profile: AuthProfile, requiredRole: AppRole): boolean {
  if (requiredRole === 'seller') {
    return profile.role === 'seller' || profile.role === 'admin';
  }

  return profile.role === 'admin';
}

export function canAccessArea(profile: AuthProfile | null, protectedArea: ProtectedArea): boolean {
  if (!profile || profile.status !== 'active') return false;
  return hasRole(profile, protectedArea);
}
