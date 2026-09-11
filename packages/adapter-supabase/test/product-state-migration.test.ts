import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Public requires Active migration', () => {
  it('adds a validated CHECK without changing any rows or security policies', () => {
    const sql = readFileSync(
      new URL(
        '../../../supabase/migrations/20260911204125_products_public_requires_active.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const statement = sql.replace(/--[^\n]*/gu, '').trim();
    expect(statement).toMatch(
      /^alter table public\.products\s+add constraint products_public_requires_active\s+check \(is_public IS NOT TRUE OR is_active IS TRUE\);$/u,
    );
  });
});
