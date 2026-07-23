import { logout } from '../app/actions/auth';

export interface LogoutControlProps {
  readonly action: () => Promise<never>;
  readonly className?: string;
}

export function LogoutControl({ action, className }: LogoutControlProps) {
  return (
    <form action={action}>
      <button
        className={
          className ??
          'min-h-11 w-full rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300'
        }
        type="submit"
      >
        Sair
      </button>
    </form>
  );
}

export function AppLogoutControl(props: Omit<LogoutControlProps, 'action'>) {
  return <LogoutControl {...props} action={logout} />;
}
