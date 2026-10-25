import Link from 'next/link';

import type { AccountTier } from '@/auth/entitlements-23c';
import { logout } from '@/app/actions/auth';
import { UserMenu } from './user-menu';
import { ShareApplication } from './share-application';

export function PublicNavigation({ tier }: { readonly tier: AccountTier }) {
  const authenticated = tier !== 'visitor';
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface-elevated">
      <div className="mx-auto flex min-h-[var(--app-topbar-height)] w-full max-w-[100rem] flex-wrap items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="mr-auto text-sm font-bold tracking-[.14em] text-text-primary">COMPRA CAR</Link>
        <nav aria-label="Explorar Compra Car" className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/ver-modelo" className="rounded-md px-3 py-2 text-text-secondary hover:bg-surface-muted">Fichas Técnicas</Link>
          <Link href="/" className="rounded-md px-3 py-2 text-text-secondary hover:bg-surface-muted">Comparar Modelos</Link>
          {tier === 'master' || tier === 'admin'
            ? <Link href="/admin" className="rounded-md px-3 py-2 text-text-secondary hover:bg-surface-muted">Administração</Link>
            : null}
        </nav>
        <ShareApplication />
        {authenticated ? (
          <UserMenu displayName="Minha conta" roleLabel={tier} tier={tier} logoutAction={logout} />
        ) : (
          <Link href="/?auth=login" className="ui-button ui-button--interactive ui-button--compact">Entrar / Criar conta</Link>
        )}
      </div>
    </header>
  );
}
