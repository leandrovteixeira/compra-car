import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminAccount } from './admin-account';
import { AdminNav } from './admin-nav';

interface AdminShellProps {
  readonly children: ReactNode;
  readonly displayName: string;
}

function Brand() {
  return (
    <div>
      <Link
        className="inline-flex rounded text-xs font-semibold uppercase tracking-[0.14em] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        href="/admin"
      >
        Compra Car
      </Link>
      <p className="mt-1 text-xs font-medium text-text-muted">Administração</p>
    </div>
  );
}

export function AdminShell({ children, displayName }: AdminShellProps) {
  return (
    <div className="min-h-dvh bg-background text-text-primary lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:p-4">
        <Brand />
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <AdminNav />
        </div>
        <AdminAccount displayName={displayName} />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 h-[var(--admin-topbar-height)] border-b border-border bg-surface px-4 sm:px-5 lg:px-6">
          <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4">
            <div className="lg:hidden">
              <Brand />
            </div>
            <p className="hidden text-sm font-medium text-text-secondary lg:block">
              Painel administrativo
            </p>

            <details className="group relative lg:hidden">
              <summary className="ui-button ui-button--secondary cursor-pointer list-none">
                Menu
              </summary>
              <div className="ui-surface absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] shadow-lg">
                <AdminNav />
                <div className="mt-4">
                  <AdminAccount displayName={displayName} />
                </div>
              </div>
            </details>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-5 lg:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
