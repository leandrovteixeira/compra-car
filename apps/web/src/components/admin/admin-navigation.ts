export interface AdminNavigationItem {
  readonly href?: string;
  readonly label: string;
  readonly status: 'active' | 'planned';
}

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  { href: '/admin', label: 'Visão geral', status: 'active' },
  { href: '/admin/products', label: 'Veículos', status: 'active' },
  { label: 'Equipamentos', status: 'planned' },
  { label: 'Categorias', status: 'planned' },
  { label: 'Marcas', status: 'planned' },
  { label: 'Importação', status: 'planned' },
  { label: 'Usuários', status: 'planned' },
  { label: 'Configurações', status: 'planned' },
];
