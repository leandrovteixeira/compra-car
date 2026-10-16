'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNavigationItems } from './admin-navigation';

/** Shared desktop navigation for the Carboot administration workspace. */
export function AdminSidebar() {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;
  return (
    <aside
      aria-label="Menu administrativo"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false); }}
      className={`sticky top-[var(--app-topbar-height)] hidden h-[calc(100dvh-var(--app-topbar-height))] shrink-0 flex-col overflow-y-auto border-r border-[#D6DEE3] bg-white transition-[width] duration-200 lg:flex ${expanded ? 'w-[232px]' : 'w-[76px]'}`}
    >
      <div className="flex min-h-14 items-center justify-between border-b border-[#EAF1F4] px-3">
        {expanded && <span className="text-xs font-bold uppercase tracking-widest text-[#1A1D21]">Navegação</span>}
        <button aria-label={pinned ? 'Desafixar menu' : 'Fixar menu expandido'} aria-pressed={pinned} aria-expanded={expanded}
          className="flex size-9 items-center justify-center rounded-md text-[#1A1D21] hover:bg-[#EAF1F4]"
          onClick={() => setPinned((value) => !value)} type="button">{pinned ? '«' : '»'}</button>
      </div>
      <nav aria-label="Seções administrativas" className="flex-1 p-2">
        <ul className="space-y-1">
          {adminNavigationItems.map((item, index) => {
            const active = Boolean(item.href && (pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'))));
            const children = item.children ?? [];
            if (item.label === 'Conta') return null;
            return (
              <li key={item.href ?? item.label}>
                {item.href ? (
                  <Link href={item.href} title={item.label} aria-current={active ? 'page' : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition ${active ? 'bg-[#DCE8ED] font-semibold text-[#1A1D21]' : 'text-[#526670] hover:bg-[#EAF1F4]'}`}>
                    <span aria-hidden="true" className="inline-flex w-5 shrink-0 justify-center font-semibold">{index + 1}</span>
                    {expanded && <span>{item.label}</span>}
                  </Link>
                ) : expanded ? (
                  <p className="px-3 pt-3 text-[11px] font-bold uppercase tracking-wider text-[#526670]">{item.label}</p>
                ) : null}
                {children.length > 0 && expanded && (
                  <ul className="ml-5 border-l border-[#D6DEE3] pl-2">
                    {children.map((child) => {
                      const selected = Boolean(child.href && (pathname === child.href || pathname.startsWith(child.href + '/')));
                      return (
                        <li key={child.href}>
                          {child.href && child.status === 'active' ? (
                            <Link href={child.href} aria-current={selected ? 'page' : undefined}
                              className={`block rounded-md px-3 py-2 text-xs ${selected ? 'bg-[#DCE8ED] font-semibold text-[#1A1D21]' : 'text-[#526670] hover:bg-[#EAF1F4]'}`}>{child.label}</Link>
                          ) : (
                            <span aria-disabled="true" className="block rounded-md px-3 py-2 text-xs text-[#89979E]">{child.label}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
