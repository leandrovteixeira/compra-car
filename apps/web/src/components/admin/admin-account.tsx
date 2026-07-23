import Link from 'next/link';

import { AppLogoutControl } from '../logout-control';

interface AdminAccountProps {
  readonly displayName: string;
}

export function AdminAccount({ displayName }: AdminAccountProps) {
  return (
    <section aria-label="Conta" className="border-t border-slate-800 pt-4">
      <p className="truncate px-1 text-sm font-semibold text-slate-100">{displayName}</p>
      <p className="mt-1 px-1 text-xs text-slate-500">Administrador</p>
      <div className="mt-4 grid gap-2">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          href="/"
        >
          Área do vendedor
        </Link>
        <AppLogoutControl />
      </div>
    </section>
  );
}
