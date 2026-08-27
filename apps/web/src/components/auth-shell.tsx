import type { ReactNode } from 'react';

interface AuthShellProps {
  readonly children: ReactNode;
  readonly description?: string;
  readonly title: string;
}

export function AuthShell({ children, description, title }: AuthShellProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-text-primary">
      <section className="ui-surface w-full max-w-sm p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
          Compra Car
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-text-secondary">{description}</p> : null}
        {children}
      </section>
    </main>
  );
}
