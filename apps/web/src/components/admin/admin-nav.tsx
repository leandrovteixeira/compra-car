import Link from 'next/link';

import { adminNavigationItems } from './admin-navigation';

export function AdminNav() {
  return (
    <nav aria-label="Navegação administrativa">
      <ul className="grid gap-1.5">
        {adminNavigationItems.map((item) => (
          <li key={item.label}>
            {item.status === 'active' && item.href ? (
              <Link
                className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                href={item.href}
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-sm text-slate-500"
              >
                {item.label}
                <span className="rounded-full border border-slate-800 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
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
