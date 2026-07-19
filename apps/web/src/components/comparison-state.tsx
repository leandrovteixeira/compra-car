import type { ReactNode } from 'react';

interface ComparisonStateProps {
  readonly kind: 'empty' | 'error' | 'loading';
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
  readonly compact?: boolean;
}

function StateIcon({ kind }: Pick<ComparisonStateProps, 'kind'>) {
  if (kind === 'loading') {
    return (
      <svg aria-hidden="true" className="size-6 animate-spin" viewBox="0 0 24 24">
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          fill="none"
          r="9"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === 'error') {
    return (
      <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 8v5m0 3.5v.01M10.3 4.8 3.4 17a2 2 0 0 0 1.74 3h13.72a2 2 0 0 0 1.74-3L13.7 4.8a2 2 0 0 0-3.4 0Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 7.5h14M7.5 12H12m-4.5 4.5h7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <rect height="18" rx="3" stroke="currentColor" strokeWidth="1.7" width="18" x="3" y="3" />
    </svg>
  );
}

export function ComparisonState({
  kind,
  title,
  description,
  action,
  compact = false,
}: ComparisonStateProps) {
  const tone = kind === 'error' ? 'text-rose-300' : 'text-cyan-300';

  return (
    <section
      aria-live={kind === 'loading' ? 'polite' : undefined}
      className={`flex flex-col items-center justify-center rounded-3xl border border-slate-800/90 bg-slate-900/70 px-6 text-center shadow-2xl shadow-slate-950/20 ${
        compact ? 'min-h-64 py-10' : 'min-h-[24rem] py-16'
      }`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span
        className={`grid size-12 place-items-center rounded-2xl border border-current/15 bg-current/5 ${tone}`}
      >
        <StateIcon kind={kind} />
      </span>
      <h2 className="mt-5 text-xl font-semibold tracking-tight text-slate-50">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
