import type { ReactNode } from 'react';

interface PageHeaderProps {
  readonly actions?: ReactNode;
  readonly description: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly compact?: boolean;
}

export function PageHeader({
  actions,
  compact = false,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-5 border-b border-slate-800 sm:flex-row sm:items-end sm:justify-between ${
        compact ? 'pb-4' : 'pb-7'
      }`}
    >
      <div>
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">{eyebrow}</p>
        ) : null}
        <h1
          className={`${eyebrow ? 'mt-2' : ''} text-3xl font-semibold tracking-tight text-white ${
            compact ? '' : 'sm:text-4xl'
          }`}
        >
          {title}
        </h1>
        <p className={`${compact ? 'mt-2 leading-6' : 'mt-3 leading-7'} max-w-2xl text-slate-400`}>
          {description}
        </p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
