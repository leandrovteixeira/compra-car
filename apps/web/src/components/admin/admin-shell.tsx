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
        className="inline-flex rounded-md text-xs font-bold uppercase tracking-[0.22em] text-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
        href="/admin"
      >
        Compra Car
      </Link>
      <p className="mt-2 text-sm font-semibold text-slate-200">Administração</p>
    </div>
  );
}

export function AdminShell({ children, displayName }: AdminShellProps) {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-50 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-800 bg-slate-900/80 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:p-5">
        <Brand />
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <AdminNav />
        </div>
        <AdminAccount displayName={displayName} />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex min-h-11 w-full max-w-7xl items-center justify-between gap-4">
            <div className="lg:hidden">
              <Brand />
            </div>
            <p className="hidden text-sm font-semibold text-slate-300 lg:block">
              Painel administrativo
            </p>

            <details className="group relative lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
                Menu
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-slate-950/70">
                <AdminNav />
                <div className="mt-4">
                  <AdminAccount displayName={displayName} />
                </div>
              </div>
            </details>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
