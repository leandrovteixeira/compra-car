'use client';

import { useFormStatus } from 'react-dom';

interface PendingSubmitButtonProps {
  readonly idleLabel: string;
  readonly pendingLabel: string;
  readonly className: string;
  readonly name?: string;
  readonly value?: string;
  readonly formNoValidate?: boolean;
  readonly disabled?: boolean;
}

export function PendingSubmitButton({
  idleLabel, pendingLabel, className, name, value, formNoValidate, disabled,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formNoValidate={formNoValidate}
      disabled={pending || disabled}
      aria-busy={pending}
      className={className}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {pending && (
          <span aria-hidden="true" className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {pending ? pendingLabel : idleLabel}
      </span>
    </button>
  );
}
