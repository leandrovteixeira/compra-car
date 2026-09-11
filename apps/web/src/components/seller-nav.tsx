'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavigationLink } from './authenticated-navigation-policy';

interface SellerNavProps {
  readonly links: readonly NavigationLink[];
}

export function SellerNav({ links }: SellerNavProps) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação do vendedor">
      <ul className="grid gap-1">
        {links.map((link) => {
          const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(`${link.href}/`));
          return (
            <li key={link.href}>
              <Link
                aria-current={active ? 'page' : undefined}
                className={`touch-target relative flex min-h-8 items-center rounded-md px-2.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${active ? 'bg-selection font-semibold text-text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-selection-strong' : 'font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary'}`}
                href={link.href}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
