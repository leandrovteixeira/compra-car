import Link from 'next/link';

import { ShareApplication } from './share-application';

export function PublicNavigation() {
  return (
    <header className="sticky top-0 z-40 h-[var(--app-topbar-height)] border-b border-border bg-surface-elevated">
      <div className="mx-auto flex h-full w-full max-w-[100rem] items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
        <Link href="/" className="font-semibold text-text-primary">COMPRA CAR</Link>
        <div className="flex items-center gap-2">
          <ShareApplication />
          <Link className="ui-button ui-button--interactive ui-button--compact" href="?auth=login">
            Entrar / Criar conta
          </Link>
        </div>
      </div>
    </header>
  );
}
