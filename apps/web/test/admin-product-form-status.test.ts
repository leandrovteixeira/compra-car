import { isValidElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, vi.fn(), false],
  useState: (initial: unknown) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.values)) hooks.values[slot] = initial;
    return [
      hooks.values[slot],
      (value: unknown) => {
        hooks.values[slot] = value;
      },
    ];
  },
}));

import {
  AdminProductForm,
  type AdminProductFormMode,
} from '../src/components/admin/admin-product-form';

type InputProps = {
  children?: unknown;
  type?: string;
  name?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange: (event: { target: { checked: boolean } }) => void;
};
function inputs(node: unknown): ReactElement<InputProps>[] {
  if (Array.isArray(node)) return node.flatMap(inputs);
  if (!isValidElement<InputProps>(node)) return [];
  return node.type === 'input' ? [node] : inputs(node.props.children);
}

function render(mode: AdminProductFormMode) {
  hooks.cursor = 0;
  const tree = AdminProductForm({
    mode,
    currentYear: 2026,
    action: vi.fn(),
    initialValues: {
      brand: 'Toyota',
      model: 'Corolla Cross',
      version: 'XRE',
      productionYear: '2026',
      modelYear: '2027',
      isActive: true,
      isPublic: true,
    },
  });
  const fields = tree.props.children[0];
  const fieldComponent = fields.type as (props: typeof fields.props) => ReactElement;
  const renderedInputs = inputs(fieldComponent(fields.props));
  const [active, publication] = renderedInputs.filter((input) => input.props.type === 'checkbox');
  return {
    active: active!.props,
    publication: publication!.props,
    publicValue: renderedInputs.find((input) => input.props.name === 'isPublic')!.props.value,
  };
}

beforeEach(() => {
  hooks.values = [];
});

describe('shared vehicle form Public requires Active', () => {
  it.each(['create', 'edit', 'duplicate'] as const)(
    'unpublishes on deactivation and never republishes on activation in %s',
    (mode) => {
      render(mode).active.onChange({ target: { checked: false } });
      let current = render(mode);
      expect(current.publication.disabled).toBe(true);
      expect(current.publication.checked).toBe(false);
      expect(current.publicValue).toBe('false');
      current.publication.onChange({ target: { checked: true } });
      expect(render(mode).publicValue).toBe('false');
      current.active.onChange({ target: { checked: true } });
      current = render(mode);
      expect(current.publication.disabled).toBe(false);
      expect(current.publication.checked).toBe(false);
      current.publication.onChange({ target: { checked: true } });
      expect(render(mode).publicValue).toBe('true');
    },
  );
});
