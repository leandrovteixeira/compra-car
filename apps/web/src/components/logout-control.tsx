import { logout } from '../app/actions/auth';
import { buttonClassName } from '@compra-car/ui';

export interface LogoutControlProps {
  readonly action: () => Promise<never>;
  readonly className?: string;
}

export function LogoutControl({ action, className }: LogoutControlProps) {
  return (
    <form action={action}>
      <button
        className={className ?? buttonClassName({ fullWidth: true, variant: 'secondary' })}
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
