import { LogoutControl } from './logout-control';

export function UserMenu({
  displayName,
  logoutAction,
  roleLabel,
}: {
  readonly displayName: string;
  readonly logoutAction: () => Promise<never>;
  readonly roleLabel: string;
}) {
  return (
    <details className="group relative shrink-0">
      <summary className="touch-target touch-target-square flex min-h-8 max-w-48 cursor-pointer list-none items-center gap-1 rounded-md px-1 text-left text-xs font-semibold text-text-secondary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:gap-2 sm:px-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-selection text-[0.6875rem] font-bold text-text-primary">
          {displayName.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'U'}
        </span>
        <span className="hidden truncate sm:block">{displayName}</span>
        <span aria-hidden="true" className="hidden text-text-muted sm:inline">
          ⌄
        </span>
      </summary>
      <section
        aria-label="Menu do usuário"
        className="absolute right-0 z-50 mt-2 w-60 rounded-lg border border-border bg-surface p-2 shadow-lg"
      >
        <div className="border-b border-border px-2 pb-2">
          <p className="truncate text-sm font-semibold text-text-primary">{displayName}</p>
          <p className="mt-0.5 text-xs text-text-muted">{roleLabel}</p>
        </div>
        <LogoutControl
          action={logoutAction}
          className="touch-target mt-1 flex min-h-8 w-full items-center rounded-md px-2 text-xs font-semibold text-text-secondary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
        />
      </section>
    </details>
  );
}
