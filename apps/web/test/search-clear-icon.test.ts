import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('official Elementos Close icon in searchbars', () => {
  it('styles native WebKit search clear controls with the same official asset', () => {
    const css = readFileSync(resolve(__dirname, '../src/app/globals.css'), 'utf8');
    expect(css).toContain("input[type='search']::-webkit-search-cancel-button");
    expect(css).toContain("background: url('/carboot/close.svg')");
  });

  it('uses the official icon in the custom clear button without a double native X', () => {
    const css = readFileSync(resolve(__dirname, '../src/app/globals.css'), 'utf8');
    const source = readFileSync(resolve(__dirname, '../src/components/vehicle-selection.tsx'), 'utf8');
    expect(source).toContain('cc-search-manual-clear');
    expect(source).toMatch(/aria-label="Limpar busca"[\s\S]*?<img src="\/carboot\/close.svg"/);
    expect(css).toContain("input[type='search'].cc-search-manual-clear::-webkit-search-cancel-button");
  });

  it('keeps the official SVG asset available', () => {
    const svg = readFileSync(resolve(__dirname, '../public/carboot/close.svg'), 'utf8');
    expect(svg).toContain('viewBox="0 0 3118 3118"');
    expect(svg).toContain('stroke="#9ABCC8"');
  });
});
