import type { ReactNode } from 'react';

interface EmptyStateProps {
  readonly action?: ReactNode;
  readonly description: string;
  readonly title: string;
}

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-12 text-center sm:px-8">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
