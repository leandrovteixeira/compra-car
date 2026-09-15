import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const sql = readFileSync(
  new URL('../../../supabase/migrations/20260915163527_sprint_20_model_year.sql', import.meta.url),
  'utf8',
);
describe('MY forward migration', () => {
  it('extends agent type and preserves legacy rows', () => {
    expect(sql).toContain("'PRODUCT_YEAR','MODEL_YEAR'");
    expect(sql).toContain('agent_runs_agent_type_check');
  });
  it('contains no data writes, grants, RLS or policy mutations', () => {
    const executable = sql.replace(/--[^\n]*/g, '');
    expect(executable).not.toMatch(
      /\b(insert|update|delete|truncate|grant|revoke|policy|disable|products)\b/i,
    );
    expect(executable).toMatch(/begin;/i);
    expect(executable).toMatch(/commit;/i);
  });
});
