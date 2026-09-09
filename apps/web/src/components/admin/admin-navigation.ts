export interface AdminNavigationItem {
  readonly href?: string;
  readonly label: string;
  readonly status: 'active' | 'planned';
  readonly children?: readonly AdminNavigationItem[];
}

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  { href: '/admin', label: 'Visão geral', status: 'active' },
  { href: '/admin/products', label: 'Veículos', status: 'active' },
  { href: '/admin/prices', label: 'Preços públicos', status: 'active' },
  { href: '/admin/prices/input', label: 'Criar preços', status: 'active' },
  { href: '/admin/prices/policies/input', label: 'Criar políticas', status: 'active' },
  { label: 'Equipamentos', status: 'planned' },
  { label: 'Categorias', status: 'planned' },
  { label: 'Marcas', status: 'planned' },
  {
    label: 'Importações',
    status: 'active',
    children: [
      { href: '/admin/imports', label: 'Cartas comerciais', status: 'active' },
      {
        href: '/admin/imports/structured-policies',
        label: 'Políticas estruturadas (Excel)',
        status: 'active',
      },
    ],
  },
  { href: '/admin/users', label: 'Usuários', status: 'active' },
  { label: 'Configurações', status: 'planned' },
];
