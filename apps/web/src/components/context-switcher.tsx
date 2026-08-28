import type { AuthProfile } from '@compra-car/adapter-supabase';
import Link from 'next/link';
import { getAvailableContexts, type AuthenticatedArea } from './authenticated-navigation-policy';

export function ContextSwitcher({
  area,
  profile,
}: {
  readonly area: AuthenticatedArea;
  readonly profile: AuthProfile;
}) {
  const contexts = getAvailableContexts(profile);
  return (
    <nav
      aria-label="Alternar área"
      className="flex min-w-0 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md bg-surface-muted p-0.5"
    >
      {contexts.map((context) => (
        <Link
          aria-current={context.area === area ? 'page' : undefined}
          className={`min-h-8 rounded px-1.5 py-1.5 text-xs font-semibold transition min-[23rem]:px-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus sm:px-2.5 ${context.area === area ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
          href={context.href}
          key={context.area}
        >
          {context.label}
        </Link>
      ))}
    </nav>
  );
}
