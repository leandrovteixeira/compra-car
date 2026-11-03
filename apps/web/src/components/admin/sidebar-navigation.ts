import type { AccountTier } from '@/auth/entitlements-23c';
import { adminNavigationItems, type AdminNavigationItem } from './admin-navigation';

export function getSidebarNavigation(tier: AccountTier): readonly AdminNavigationItem[] {
  const privileged = tier === 'admin' || tier === 'master';
  return [
    { href: '/', label: 'Home', status: 'active' as const },
    {
      label: 'Veículos',
      status: 'active' as const,
      children: [
        { href: '/fichas-tecnicas', label: 'Fichas Técnicas', status: 'active' as const },
        { href: '/comparar-modelos', label: 'Comparar Modelos', status: 'active' as const },
        {
          href: '/comparar-especificacoes',
          label: 'Comparar Especificações',
          status: 'active' as const,
        },
        ...(privileged
          ? [{ href: '/admin/products', label: 'Cadastro de Modelos', status: 'active' as const }]
          : []),
      ],
    },
    ...(tier === 'corporate' || privileged
      ? [
          {
            label: 'Preços',
            status: 'active' as const,
            children: privileged
              ? (adminNavigationItems.find((item) => item.label === 'Preços')?.children ?? [])
              : [
                  {
                    href: '/admin/prices/list',
                    label: 'Lista de Preços',
                    status: 'active' as const,
                  },
                ],
          },
        ]
      : []),
    ...(privileged
      ? adminNavigationItems.filter(
          (item) =>
            !['Home', 'Veículos', 'Preços', 'Conta'].includes(item.label) &&
            (tier === 'master' || !['Agentes', 'Configurações'].includes(item.label)),
        )
      : []),
  ];
}
