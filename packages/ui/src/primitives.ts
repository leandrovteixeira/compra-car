export type ButtonVariant = 'destructive' | 'ghost' | 'interactive' | 'primary' | 'secondary';
export type ButtonSize = 'action' | 'commit' | 'micro';

export interface ButtonClassOptions {
  readonly compact?: boolean;
  readonly fullWidth?: boolean;
  readonly size?: ButtonSize;
  readonly variant?: ButtonVariant;
}

export function buttonClassName({
  compact = false,
  fullWidth = false,
  size = 'commit',
  variant = 'primary',
}: ButtonClassOptions = {}): string {
  const resolvedSize = compact ? 'micro' : size;
  return [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${resolvedSize}`,
    fullWidth ? 'w-full' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export const fieldClassName = 'ui-field';
export const labelClassName = 'ui-label';
export const helperClassName = 'ui-helper';
export const surfaceClassName = 'ui-surface';
export const badgeClassName = 'ui-badge';
export const infoBadgeClassName = 'ui-badge ui-badge--info';
export const tableClassName = 'ui-table';
export const tableFrameClassName = 'ui-table-frame';
export const formGridClassName = 'ui-form-grid';
export const formSectionClassName = 'ui-form-section';
