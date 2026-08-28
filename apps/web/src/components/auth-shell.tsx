import type { ReactNode } from 'react';

import { APP_NAME } from '@/config/app-identity';

interface AuthShellProps {
  readonly children: ReactNode;
  readonly description?: string;
  readonly title: string;
}

export function AuthShell({ children, description, title }: AuthShellProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-text-primary">
      <section className="ui-surface relative w-full max-w-sm overflow-hidden p-5 sm:p-6">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-action-interactive" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-interactive">
          {APP_NAME}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-text-secondary">{description}</p> : null}
        {children}
      </section>
    </main>
  );
}
