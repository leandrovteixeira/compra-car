export interface AdminNavigationItem {
  readonly href?: string;
  readonly label: string;
  readonly status: 'active' | 'planned';
  readonly children?: readonly AdminNavigationItem[];
}

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  { href: '/admin', label: 'Home', status: 'active' },
  { label: 'Veículos', status: 'active', children: [
    { href: '/admin/products', label: 'Cadastro de Modelos', status: 'active' },
    { href: '/admin/ver-ficha-tecnica', label: 'Fichas Técnicas', status: 'active' },
    { href: '/admin/comparar-modelos', label: 'Comparar Modelos', status: 'active' },
    { href: '/admin/comparar-especificacoes', label: 'Comparar Especificações', status: 'active' },
  ] },
  { label: 'Preços', status: 'active', children: [
    { href: '/admin/prices', label: 'Gerenciar Preços', status: 'active' },
    { href: '/admin/prices/list', label: 'Lista de Preços', status: 'active' },
    { href: '/admin/prices/input', label: 'Cadastrar Preços', status: 'active' },
    { href: '/admin/prices/policies/input', label: 'Cadastrar Políticas', status: 'active' },
    { href: '/admin/prices/policies/current', label: 'Políticas Vigentes', status: 'planned' },
  ] },
  { label: 'Inteligência', status: 'active', children: [
    { label: 'Análise de TPVA', status: 'planned' },
  ] },
  { label: 'Educação', status: 'planned' },
  { href: '/admin/news', label: 'News', status: 'planned' },
  { href: '/admin/chat', label: 'Chat', status: 'planned' },
  { label: 'Agentes', status: 'active', children: [
    { href: '/admin/agents', label: 'Agentes', status: 'active' },
  ] },
  { label: 'Configurações', status: 'active', children: [
    { href: '/admin/users', label: 'Gestão de Usuários', status: 'active' },
    { href: '/admin/imports', label: 'Importações', status: 'active' },
  ] },
  { label: 'Conta', status: 'planned' },
];