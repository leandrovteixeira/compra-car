'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNavigationItems } from './admin-navigation';
import { UserMenu } from '../user-menu';

const names: Record<string,string> = {
  Home: 'home', 'Veículos':'car', Preços:'docs', 'Inteligência':'intelligence',
  'Educação':'atom', Agentes:'bot', 'Configurações':'config', Conta:'account'
};

function NavIcon({ name }: { readonly name: string }) {
  return <img alt="" aria-hidden="true" src={`/carboot/${names[name] ?? 'home'}.svg`}
    className="size-[22px] shrink-0 object-contain"/>;
}

function DropdownArrow({ open }: { readonly open: boolean }) {
  return <img alt="" aria-hidden="true" src="/carboot/arrow.svg"
    className={`size-4 object-contain transition-transform ${open ? 'rotate-180' : ''}`}/>;
}

export function AdminSidebar({ displayName, logoutAction }: { readonly displayName: string; readonly logoutAction: () => Promise<never> }) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [pinned] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const expanded = hovered || pinned;
  const groups = adminNavigationItems.filter((item) => item.label !== 'Conta');

  return (
    <aside aria-label="Menu administrativo"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false);
      }}
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col overflow-visible bg-[#1A1D21] text-white shadow-[6px_0_18px_rgba(26,29,33,0.16)] transition-[width] duration-200 lg:flex ${expanded ? 'w-[264px]' : 'w-[76px]'}`}>
      <div className="flex min-h-[88px] items-center gap-2 overflow-hidden px-[13px]">
        <img alt="Carboot" src="/carboot/logo-icon.svg"
          className="size-[49px] shrink-0 object-contain"/>
        <div aria-hidden="true"
          className={`relative h-[52px] min-w-0 overflow-hidden transition-[width,opacity] duration-200 ${expanded ? 'w-[165px] opacity-100' : 'w-0 opacity-0'}`}>
          <img alt="" src="/carboot/logo-full.svg"
            className="absolute left-[-47px] top-0 h-[52px] w-[198px] max-w-none object-contain"/>
        </div>
      </div>
      <div className="mx-3 h-px bg-white/20"/>
      <nav aria-label="Navegação Carboot" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
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
        {expanded ? (
          <UserMenu displayName={displayName} logoutAction={logoutAction}
            roleLabel="Administrador" sidebar />
        ) : (
          <div className="relative group/account">
            <button type="button" aria-label="Conta" onClick={() => setHovered(true)}
              className="flex h-11 items-center rounded-md px-4 text-white/85">
              <NavIcon name="Conta"/>
            </button>
            <div className="absolute bottom-0 left-full hidden pl-2 group-focus-within/account:block group-hover/account:block">
              <UserMenu displayName={displayName} logoutAction={logoutAction}
                roleLabel="Administrador" sidebar />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
