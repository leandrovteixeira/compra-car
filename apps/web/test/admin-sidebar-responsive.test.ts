import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Admin desktop sidebar reflow', () => {
  const sidebar = readFileSync(resolve(__dirname, '../src/components/admin/admin-sidebar.tsx'), 'utf8');
  const shell = readFileSync(resolve(__dirname, '../src/components/admin/admin-shell.tsx'), 'utf8');

  it('reserves the same animated width as the visible sidebar when hovered or focused', () => {
    expect(sidebar).toContain("hovered ? 'w-[264px]' : 'w-[76px]'");
    expect(sidebar).toMatch(/<aside[\s\S]*?className=\{`sticky top-0[\s\S]*?transition-\[width\]/);
    expect(sidebar).toContain('onMouseEnter={() => setHovered(true)}');
    expect(sidebar).toContain('onFocusCapture={() => setHovered(true)}');
  });

  it('keeps the panel inside the sidebar width rather than overlaying adjacent content', () => {
    expect(sidebar).toContain('absolute inset-y-0 left-0 z-40 flex h-dvh w-full flex-col');
    expect(sidebar).not.toContain('h-dvh w-[76px] shrink-0 overflow-visible lg:block');
  });

  it('allows the shared desktop content to shrink while keeping mobile full width', () => {
    expect(shell).toContain('lg:flex lg:items-start');
    expect(shell).toContain('min-w-0 w-full flex-1');
    expect(shell).toContain('lg:w-0');
    expect(sidebar).toContain('<MobileNavigation>');
  });
});
