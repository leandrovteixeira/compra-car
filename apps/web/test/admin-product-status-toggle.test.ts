import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  ref: { current: false },
  pending: false,
  error: null as string | null,
  finished: Promise.resolve(),
  action: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useId: () => 'inline-error',
  useRef: () => harness.ref,
  useState: () => [
    harness.error,
    (error: string | null) => {
      harness.error = error;
    },
  ],
  useTransition: () => [
    harness.pending,
    (callback: () => Promise<void>) => {
      harness.pending = true;
      harness.finished = callback().finally(() => {
        harness.pending = false;
      });
    },
  ],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock('../src/app/admin/products/actions', () => ({
  updateAdminProductStatusAction: harness.action,
}));

import { AdminProductStatusToggle } from '../src/components/admin/admin-product-status-toggle';

function render(field: 'isPublic' | 'isActive' = 'isPublic', value = true, isActive = true) {
  const tree = AdminProductStatusToggle({
    productId: '7',
    productName: 'Toyota Corolla Cross XRE',
    field,
    value,
    isActive,
  });
  const children = (tree as ReactElement<{ children: ReactElement[] }>).props.children;
  return {
    button: children[0] as ReactElement<{
      onClick: () => void;
      disabled: boolean;
      title?: string;
      children: string;
      'aria-label': string;
      'aria-pressed': boolean;
      'aria-busy': boolean;
    }>,
    error: children[1] as ReactElement<{ role: string; children: string }> | null,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  harness.ref.current = false;
  harness.pending = false;
  harness.error = null;
});

describe('inline status controls with controlled React hooks', () => {
  it('disables publication while inactive and explains how to enable it', () => {
    const { button } = render('isPublic', false, false);
    expect(button.props.disabled).toBe(true);
    expect(button.props.children).toBe('Privado');
    expect(button.props.title).toBe('Ative o veículo antes de publicá-lo.');
    expect(button.props['aria-label']).toContain('Ative o veículo antes de publicá-lo.');
    button.props.onClick();
    expect(harness.action).not.toHaveBeenCalled();
    expect(render('isActive', false, false).button.props.disabled).toBe(false);
  });
  it.each([
    ['isActive', true, 'Ativo', 'inativo', { isActive: false }],
    ['isActive', false, 'Inativo', 'ativo', { isActive: true }],
    ['isPublic', true, 'Público', 'privado', { isPublic: false }],
    ['isPublic', false, 'Privado', 'público', { isPublic: true }],
  ] as const)('renders and toggles %s=%s', async (field, value, label, target, patch) => {
    harness.action.mockResolvedValue({ status: 'success' });
    const { button } = render(field, value);
    expect(button.type).toBe('button');
    expect(button.props.children).toBe(label);
    expect(button.props['aria-label']).toBe(`Marcar Toyota Corolla Cross XRE como ${target}`);
    expect(button.props['aria-pressed']).toBe(value);
    button.props.onClick();
    await harness.finished;
    expect(harness.action).toHaveBeenCalledExactlyOnceWith('7', patch);
    // Refresh keeps the current route/search parameters rather than navigating to a bare list URL.
    expect(harness.refresh).toHaveBeenCalledExactlyOnceWith();
  });

  it('blocks double click before rerender, disables during pending and keeps label/size stable', async () => {
    let finish!: (value: { status: 'success' }) => void;
    harness.action.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const initial = render();
    initial.button.props.onClick();
    initial.button.props.onClick();
    expect(harness.action).toHaveBeenCalledOnce();
    const pending = render();
    expect(pending.button.props.disabled).toBe(true);
    expect(pending.button.props['aria-busy']).toBe(true);
    expect(pending.button.props.children).toBe(initial.button.props.children);
    pending.button.props.onClick();
    expect(harness.action).toHaveBeenCalledOnce();
    finish({ status: 'success' });
    await harness.finished;
    expect(render().button.props.disabled).toBe(false);
  });

  it.each(['repository', 'network'])(
    'announces %s errors without claiming success and allows retry',
    async (failure) => {
      if (failure === 'repository')
        harness.action.mockResolvedValue({ status: 'error', message: 'Falha de gravação.' });
      else harness.action.mockRejectedValue(new Error('Network failed'));
      render().button.props.onClick();
      await harness.finished;
      const failed = render();
      expect(failed.button.props.children).toBe('Público');
      expect(failed.button.props.disabled).toBe(false);
      expect(failed.error?.props.role).toBe('alert');
      expect(failed.error?.props.children).toBeTruthy();
      expect(harness.refresh).not.toHaveBeenCalled();
      harness.action.mockResolvedValue({ status: 'success' });
      failed.button.props.onClick();
      await harness.finished;
      expect(render().error).toBeNull();
      expect(harness.refresh).toHaveBeenCalledOnce();
    },
  );
});
