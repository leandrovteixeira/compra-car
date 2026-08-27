import Link from 'next/link';

import { adminNavigationItems } from './admin-navigation';

export function AdminNav() {
  return (
    <nav aria-label="Navegação administrativa">
      <ul className="grid gap-1">
        {adminNavigationItems.map((item) => (
          <li key={item.label}>
            {item.status === 'active' && item.href ? (
              <Link
                className="flex min-h-9 items-center rounded-md px-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                href={item.href}
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="flex min-h-9 items-center justify-between gap-2 rounded-md px-2.5 text-sm text-text-muted"
              >
                {item.label}
                <span className="ui-badge text-text-muted">Em breve</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
