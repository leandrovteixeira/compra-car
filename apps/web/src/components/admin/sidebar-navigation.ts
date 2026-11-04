import type { AccountTier } from '@/auth/entitlements-23c';
import { featureAvailability } from '@/auth/entitlements-23c';
import { adminNavigationItems, type AdminNavigationItem } from './admin-navigation';

function active(tier: AccountTier, feature: Parameters<typeof featureAvailability>[1]): boolean {
  return featureAvailability(tier, feature) === 'enabled';
}

export function getSidebarNavigation(tier: AccountTier): readonly AdminNavigationItem[] {
  const vehicleChildren: AdminNavigationItem[] = [
    { href: '/fichas-tecnicas', label: 'Fichas Técnicas', status: 'active' },
    { href: '/comparar-modelos', label: 'Comparar Modelos', status: 'active' },
    { href: '/comparar-especificacoes', label: 'Comparar Especificações', status: 'active' },
  ];

  if (active(tier, 'vehicle-administration')) {
    vehicleChildren.push({ href: '/admin/products', label: 'Cadastro de Modelos', status: 'active' });
  }

  const items: AdminNavigationItem[] = [
    { href: '/', label: 'Home', status: 'active' },
    { label: 'Veículos', status: 'active', children: vehicleChildren },
  ];

  if (active(tier, 'price-list') || active(tier, 'price-administration') || active(tier, 'current-policies')) {
    const priceChildren: AdminNavigationItem[] = [];
    if (active(tier, 'price-administration')) {
      priceChildren.push(
        { href: '/admin/prices', label: 'Gerenciar Preços', status: 'active' },
        { href: '/admin/prices/input', label: 'Cadastrar Preços', status: 'active' },
        { href: '/admin/prices/policies/input', label: 'Cadastrar Políticas', status: 'active' },
      );
    }
    if (active(tier, 'price-list')) {
      priceChildren.push({ href: '/admin/prices/list', label: 'Lista de Preços', status: 'active' });
    }
    if (active(tier, 'current-policies')) {
      priceChildren.push({ href: '/admin/prices/policies/current', label: 'Políticas Vigentes', status: 'active' });
    }
    items.push({ label: 'Preços', status: 'active', children: priceChildren });
  }

  const intelligenceChildren: AdminNavigationItem[] = [];
  if (featureAvailability(tier, 'tpva') !== 'hidden') {
    intelligenceChildren.push({ label: 'Análise de TPVA', status: 'planned' });
  }
  if (intelligenceChildren.length) {
    items.push({ label: 'Inteligência', status: 'active', children: intelligenceChildren });
  }

  if (active(tier, 'news')) {
    items.push({ href: '/admin/news', label: 'News', status: 'active' });
  }

  if (featureAvailability(tier, 'education') !== 'hidden') {
    items.push({ label: 'Educação', status: 'planned' });
  }

  if (featureAvailability(tier, 'chat') !== 'hidden') {
    items.push({ href: '/admin/chat', label: 'Chat', status: 'planned' });
  }

  if (active(tier, 'agents')) {
    const agents = adminNavigationItems.find((item) => item.label === 'Agentes');
    if (agents) items.push(agents);
  }

  if (active(tier, 'settings')) {
    const settings = adminNavigationItems.find((item) => item.label === 'Configurações');
    if (settings) items.push(settings);
  }

  return items;
}
