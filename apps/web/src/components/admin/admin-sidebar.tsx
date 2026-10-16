'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNavigationItems } from './admin-navigation';

const paths: Record<string, ReactNode> = {
  Home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></>,
  'Veículos': <><path d="m5 11 2-6h10l2 6" /><rect x="3" y="11" width="18" height="8" rx="2" /><circle cx="7" cy="16" r="1" /><circle cx="17" cy="16" r="1" /><path d="M5 19v2m14-2v2" /></>,
  'Preços': <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h4M9 12h7M9 16h7" /></>,
  'Inteligência': <><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8m0-14.2-2.8 2.8m-8.6 8.6-2.8 2.8"/></>,
  'Educação': <><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
  'Agentes': <><rect x="4" y="7" width="16" height="13" rx="3" /><path d="M12 3v4M9 3h6M8 13h.01M16 13h.01M9 17h6" /></>,
  'Configurações': <><circle cx="12" cy="12" r="3"/><path d="M10 2h4l1 3 2 1 3-1 2 4-2 2v2l2 2-2 4-3-1-2 1-1 3h-4l-1-3-2-1-3 1-2-4 2-2v-2L2 9l2-4 3 1 2-1z"/></>,
  'Conta': <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
};

function NavIcon({ name }: { readonly name: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none"
    stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    {paths[name] ?? paths.Home}
  </svg>;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const expanded = hovered || pinned;
  const groups = adminNavigationItems.filter((item) => item.label !== 'Conta');
  const account = adminNavigationItems.find((item) => item.label === 'Conta');

  return (
    <aside aria-label="Menu administrativo"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false);
      }}
      className={`sticky top-[var(--app-topbar-height)] hidden h-[calc(100dvh-var(--app-topbar-height))] shrink-0 flex-col overflow-visible bg-[#1A1D21] text-white transition-[width] duration-200 lg:flex ${expanded ? 'w-[264px]' : 'w-[76px]'}`}>
      <div className="flex min-h-[88px] items-center gap-2 px-4">
        <span aria-hidden="true" className="grid size-10 shrink-0 grid-cols-2 gap-[3px] p-1">
          <span className="bg-[#9ABCC8]"/><span className="bg-[#EF7732]"/>
          <span className="bg-white"/><span className="bg-[#9ABCC8]"/>
        </span>
        {expanded && <span className="truncate text-xl font-semibold tracking-tight">carboot</span>}
      </div>
      <div className="mx-3 h-px bg-white/20"/>
      <nav aria-label="Navegação Carboot" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {groups.map((item) => {
            const children = item.children ?? [];
            const open = openGroup === item.label;
            const groupHasActivePage = children.some((child) => child.href &&
              (pathname === child.href || pathname.startsWith(child.href + '/')));
            const itemClass = 'flex h-11 w-full items-center gap-3 rounded-md px-4 text-left text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#9ABCC8]';
            return <li key={item.label}>
              {children.length ? (
                <button type="button" title={!expanded ? item.label : undefined}
                  aria-expanded={open} aria-controls={`nav-group-${item.label}`}
                  onClick={() => { setHovered(true); setOpenGroup(open ? null : item.label); }}
                  className={itemClass}>
                  <span className="shrink-0"><NavIcon name={item.label}/></span>
                  {expanded && <><span className="min-w-0 flex-1 truncate">{item.label}</span><span aria-hidden="true" className="text-[#9ABCC8]">{open ? '⌃' : '⌄'}</span></>}
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
        {account?.href ? (
          <Link href={account.href} title="Conta"
            className="flex h-11 items-center gap-3 rounded-md px-4 text-sm text-white/85 hover:bg-white/10">
            <NavIcon name="Conta"/>{expanded && <span>Conta</span>}
          </Link>
        ) : (
          <div title="Conta" aria-label="Conta" className="flex h-11 items-center gap-3 rounded-md px-4 text-sm text-white/85">
            <NavIcon name="Conta"/>{expanded && <span>Conta</span>}
          </div>
        )}
      </div>
      <button type="button" aria-label={pinned ? 'Desafixar sidebar' : 'Fixar sidebar expandida'}
        aria-pressed={pinned} onClick={() => setPinned((value) => !value)}
        className="absolute bottom-3 right-1 translate-x-1/2 rounded-full border border-[#D6DEE3] bg-white px-1.5 py-0.5 text-xs text-[#1A1D21] shadow-md">
        {pinned ? '«' : '»'}
      </button>
    </aside>
  );
}
