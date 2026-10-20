import type { AccountTier } from '@/auth/entitlements-23c';

export interface AccountMenuItem {
  readonly label: string;
  readonly href: string;
  readonly highlight?: boolean;
}

export function getAccountMenuItems(tier: AccountTier): readonly AccountMenuItem[] {
  if (tier === 'visitor') {
    return [
      { label: 'Entrar / Criar conta', href: '/?auth=login', highlight: true },
    ];
  }
  const items: AccountMenuItem[] = [{ label: 'Meu perfil', href: '/conta/perfil' }];
  if (tier === 'public' || tier === 'corporate') {
    items.push({ label: 'Meu plano', href: '/conta/plano' });
  }
  items.push({ label: 'Trocar senha', href: '/conta/trocar-senha' });
  if (tier === 'public') {
    items.push({ label: 'Upgrade de conta', href: '/conta/upgrade', highlight: true });
  }
  return items;
}
