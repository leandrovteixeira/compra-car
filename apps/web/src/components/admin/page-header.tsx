import type { ReactNode } from 'react';

interface PageHeaderProps {
  readonly actions?: ReactNode;
  readonly description: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly compact?: boolean;
  readonly sticky?: boolean;
}

export function PageHeader({
  actions,
  compact = false,
  description,
  eyebrow,
  title,
  sticky = false,
}: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between ${
        compact ? 'pb-3' : 'pb-5'
      } ${sticky ? 'admin-page-header' : compact ? 'pt-2' : 'pt-6 lg:pt-8'}`}
    >
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={`${eyebrow ? 'mt-1' : ''} text-2xl font-semibold tracking-tight text-text-primary`}
        >
          {title}
        </h1>
        <p className={`${compact ? 'mt-1' : 'mt-1.5'} max-w-2xl text-sm text-text-secondary`}>
          {description}
        </p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
