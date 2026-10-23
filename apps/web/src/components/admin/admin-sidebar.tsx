'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNavigationItems, type AdminNavigationItem } from './admin-navigation';
import { UserMenu } from '../user-menu';
import type { AccountTier } from '@/auth/entitlements-23c';

const names: Record<string,string> = {
  Home: 'home2', 'Veículos':'car2', Preços:'docs2', 'Inteligência':'intelligence2',
  'Educação':'atom2', Agentes:'bot2', 'Configurações':'config2', Chat:'chat2', News:'news2', Conta:'account2'
};

function NavIcon({ name }: { readonly name: string }) {
  return <img alt="" aria-hidden="true" src={`/carboot/${names[name] ?? 'home'}.svg`}
    className="size-[22px] shrink-0 object-contain"/>;
}

function DropdownArrow({ open }: { readonly open: boolean }) {
  return <img alt="" aria-hidden="true" src="/carboot/arrow.svg"
    className={`size-4 object-contain transition-transform ${open ? 'rotate-180' : ''}`}/>;
}

export function AdminSidebar({ displayName, logoutAction, tier }: { readonly displayName: string; readonly logoutAction: () => Promise<never>; readonly tier: AccountTier }) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [pinned] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const expanded = hovered || pinned;
  const privileged = tier === 'admin' || tier === 'master';
  const groups: readonly AdminNavigationItem[] = [
    { href: '/', label: 'Home', status: 'active' as const },
    { label: 'Veículos', status: 'active' as const, children: [
      { href: '/fichas-tecnicas', label: 'Fichas Técnicas', status: 'active' as const },
      { href: '/comparar-modelos', label: 'Comparar Modelos', status: 'active' as const },
      { href: '/comparar-especificacoes', label: 'Comparar Especificações', status: 'active' as const },
      ...(privileged ? [
        { href: '/admin/products', label: 'Cadastro de Modelos', status: 'active' as const },
      ] : []),
    ] },
    ...(tier === 'corporate' || privileged ? [{ label: 'Preços', status: 'active' as const, children: privileged
      ? (adminNavigationItems.find(item => item.label === 'Preços')?.children ?? [])
      : [{ href: '/admin/prices/list', label: 'Lista de Preços', status: 'active' as const }] }] : []),
    ...(privileged ? adminNavigationItems.filter(item => !['Home','Veículos','Preços','Conta'].includes(item.label) &&
      (tier === 'master' || !['Agentes','Configurações'].includes(item.label))) : []),
  ];

  return (
    <aside aria-label="Menu administrativo"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setOpenGroup(null); }}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) { setHovered(false); setOpenGroup(null); }
      }}
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col overflow-visible bg-[#1A1D21] text-white shadow-[6px_0_18px_rgba(26,29,33,0.16)] transition-[width] duration-200 lg:flex ${expanded ? 'w-[264px]' : 'w-[76px]'}`}>
      <div className="flex min-h-[88px] items-center gap-0 overflow-hidden px-[14px]">
        <img alt="Carboot" src="/carboot/icon_logo_official.svg"
          className="size-12 shrink-0 object-contain"/>
        <div aria-hidden="true"
          className={`h-12 shrink-0 overflow-hidden transition-[width,opacity] duration-200 ${expanded ? 'w-[180px] opacity-100' : 'w-0 opacity-0'}`}>
          <img alt="" src="/carboot/name_logo_official.svg"
            className="h-12 w-[180px] max-w-none object-contain"/>
        </div>
      </div>
      <div className="mx-3 h-px bg-white/20"/>
      <nav aria-label="Navegação Carboot" className="cc-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {groups.map((item) => {
            const children = item.children ?? [];
            const open = openGroup === item.label;
            const itemClass = 'flex h-11 w-full items-center gap-3 rounded-md px-4 text-left text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#9ABCC8]';
            return <li key={item.label}>
              {children.length ? (
                <button type="button" title={!expanded ? item.label : undefined}
                  aria-expanded={open} aria-controls={`nav-group-${item.label}`}
                  onClick={() => { setHovered(true); setOpenGroup(open ? null : item.label); }}
                  className={itemClass}>
                  <span className="shrink-0"><NavIcon name={item.label}/></span>
                  {expanded && <><span className="min-w-0 flex-1 truncate">{item.label}</span><span aria-hidden="true" className="text-[#9ABCC8]"><DropdownArrow open={open}/></span></>}
                </button>
              ) : item.href ? (
                <Link title={!expanded ? item.label : undefined} href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined} className={itemClass}>
                  <span className="shrink-0"><NavIcon name={item.label}/></span>{expanded && <span>{item.label}</span>}
                </Link>
              ) : (
                <span title={!expanded ? item.label : undefined} aria-disabled="true" className={itemClass + ' cursor-default opacity-75'}>
                  <span className="shrink-0"><NavIcon name={item.label}/></span>{expanded && <span>{item.label}</span>}
                </span>
              )}
              {expanded && open && children.length > 0 && (
                <ul id={`nav-group-${item.label}`} className="ml-10 border-l border-white/20 pl-2">
                  {children.map((child) => (
                    <li key={child.label}>
                      {child.href && child.status === 'active' ? (
                        <Link href={child.href}
                          aria-current={pathname === child.href ? 'page' : undefined}
                          className="block rounded-md px-2 py-2 text-xs text-white/80 hover:bg-white/10 hover:text-white">
                          {child.label}
                        </Link>
                      ) : (
                        <span aria-disabled="true" className="block px-2 py-2 text-xs text-white/45">{child.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>;
          })}
        </ul>
      </nav>
      <div className="mx-3 h-px bg-white/20"/>
      <div className="p-2">
        {tier === "visitor" ? (
          <Link href="/?auth=login" title="Entrar / Criar conta" aria-label="Entrar / Criar conta" className="flex h-11 w-full items-center gap-3 rounded-md px-4 text-sm text-[#EF7732] hover:bg-white/10"><svg aria-hidden="true" className="size-[22px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>{expanded && <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap opacity-0 transition-opacity delay-200 duration-150 group-hover:opacity-100 group-focus-within:opacity-100">Entrar / Criar conta</span>}</Link>
        ) : expanded ? (
          <UserMenu displayName={displayName} logoutAction={logoutAction}
            roleLabel={tier === "master" ? "Master" : "Administrador"} tier={tier} sidebar />
        ) : (
          <div className="relative group/account">
            <button type="button" aria-label="Conta" onClick={() => setHovered(true)}
              className="flex h-11 items-center rounded-md px-4 text-white/85">
              <NavIcon name="Conta"/>
            </button>
            <div className="absolute bottom-0 left-full hidden pl-2 group-focus-within/account:block group-hover/account:block">
              <UserMenu displayName={displayName} logoutAction={logoutAction}
                roleLabel={tier} tier={tier} sidebar />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
