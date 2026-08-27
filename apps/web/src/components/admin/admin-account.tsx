import Link from 'next/link';

import { AppLogoutControl } from '../logout-control';

interface AdminAccountProps {
  readonly displayName: string;
}

export function AdminAccount({ displayName }: AdminAccountProps) {
  return (
    <section aria-label="Conta" className="border-t border-border pt-3">
      <p className="truncate px-1 text-sm font-semibold text-text-primary">{displayName}</p>
      <p className="mt-0.5 px-1 text-xs text-text-muted">Administrador</p>
      <div className="mt-3 grid gap-2">
        <Link className="ui-button ui-button--secondary w-full" href="/">
          Área do vendedor
        </Link>
        <AppLogoutControl />
      </div>
    </section>
  );
}
