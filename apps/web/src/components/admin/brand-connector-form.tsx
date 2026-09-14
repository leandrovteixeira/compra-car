'use client';
import { useActionState, type ReactNode } from 'react';
import { brandConnectorAction } from '@/app/admin/agents/brands/actions';
import type { BrandActionState } from '@/application/admin/brand-connectors';
export function BrandConnectorForm({
  operation,
  label,
  fields = {},
  children,
}: {
  readonly operation: string;
  readonly label: string;
  readonly fields?: Record<string, string>;
  readonly children?: ReactNode;
}) {
  const [state, action, pending] = useActionState<BrandActionState, FormData>(
    brandConnectorAction,
    { status: 'idle', message: '' },
  );
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="operation" value={operation} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <button
        className="ui-button ui-button--secondary ui-button--action"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Aguarde…' : label}
      </button>
      {state.message ? (
        <p role="status" className="w-full text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
