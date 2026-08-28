import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

describe('Sprint 14A.1 design-system foundation', () => {
  it('centralizes the light-first palette, typography and density tokens', () => {
    const css = source('../src/app/globals.css');
    expect(css).toContain('--color-background: #f6f7f8');
    expect(css).toContain('--color-surface: #ffffff');
    expect(css).toContain('--color-text-primary: #1a1d21');
    expect(css).toContain('--color-attention: #ef7732');
    expect(css).toContain('--color-selection-strong: #9abcc8');
    expect(css).toContain('--color-action-interactive: #9abcc8');
    expect(css).not.toContain('#466f7d');
    expect(css).toMatch(/--font-sans:\s+Inter/);
    expect(css).toContain('--density-control-height: 2.25rem');
    expect(css).toContain('--density-table-row: 3rem');
  });

  it('exposes shared primitives without making orange the primary action', () => {
    const css = source('../src/app/globals.css');
    const primitives = source('../../../packages/ui/src/primitives.ts');
    const primary = css.slice(
      css.indexOf('.ui-button--primary {'),
      css.indexOf('.ui-button--primary:hover'),
    );
    expect(primitives).toContain(
      "'destructive' | 'ghost' | 'interactive' | 'primary' | 'secondary'",
    );
    expect(primitives).toContain("export const fieldClassName = 'ui-field'");
    expect(primitives).toContain("export const tableClassName = 'ui-table'");
    expect(primitives).toContain("export const formGridClassName = 'ui-form-grid'");
    expect(primitives).toContain("export const tableFrameClassName = 'ui-table-frame'");
    expect(css).toContain('.ui-badge--info');
    expect(css).toContain('@media (pointer: coarse)');
    expect(primary).toContain('var(--color-action-primary)');
    expect(css).toContain('--color-action-primary: #1a1d21');
    expect(primary).not.toContain('var(--color-attention)');
    expect(css).toMatch(/\.ui-button--interactive\s*{[^}]*var\(--color-action-interactive\)/s);
    expect(css).toMatch(/\.ui-button--interactive\s*{[^}]*var\(--color-text-primary\)/s);
  });

  it('reserves attention orange for comparison advantage', () => {
    const comparison = source('../src/components/comparison-value-cell.tsx');
    expect(comparison).toContain('text-attention');
    expect(comparison).toContain('aria-label="Vantagem"');
  });
});
