'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { adminNavigationItems } from './admin-navigation';

export function AdminNav() {
  const pathname = usePathname();
  const activeHref = adminNavigationItems
    .filter(
      (item) =>
        item.status === 'active' &&
        item.href &&
        (pathname === item.href ||
          (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))),
    )
    .sort((left, right) => (right.href?.length ?? 0) - (left.href?.length ?? 0))[0]?.href;
  return (
    <nav aria-label="Navegação administrativa">
      <ul className="grid gap-1">
        {adminNavigationItems.map((item) => (
          <li key={item.label}>
            {item.status === 'active' && item.href ? (
              <Link
                aria-current={activeHref === item.href ? 'page' : undefined}
                className={`relative flex min-h-8 items-center rounded-md px-2.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${activeHref === item.href ? 'bg-selection font-semibold text-text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-selection-strong' : 'font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary'}`}
                href={item.href}
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="flex min-h-8 items-center justify-between gap-2 rounded-md px-2.5 text-[0.8125rem] text-text-muted"
              >
                {item.label}
                <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[0.625rem] font-medium leading-none text-text-muted">
                  Em breve
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
