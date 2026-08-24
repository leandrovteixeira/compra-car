import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPublicPath } from '../src/auth/route-policy';
const source = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
describe('auth lifecycle callback routes', () => {
  it('keeps auth callbacks public while application routes remain protected', () => {
    expect(isPublicPath('/auth/callback/invite')).toBe(true);
    expect(isPublicPath('/auth/recovery')).toBe(true);
    expect(isPublicPath('/admin/users')).toBe(false);
  });
  it('exchanges only code and routes to fixed flow destinations', () => {
    const invite = source('../src/app/auth/callback/invite/route.ts'),
      recovery = source('../src/app/auth/callback/recovery/route.ts');
    expect(invite).toContain("searchParams.get('code')");
    expect(invite).toContain("'/auth/invite'");
    expect(recovery).toContain("'/auth/recovery'");
    for (const route of [invite, recovery]) {
      expect(route).not.toContain("searchParams.get('next')");
      expect(route).not.toContain('SUPABASE_SERVER_KEY');
    }
  });
  it('distinguishes flows with short HttpOnly cookies', () => {
    for (const route of ['invite', 'recovery']) {
      const content = source(`../src/app/auth/callback/${route}/route.ts`);
      expect(content).toContain('httpOnly: true');
      expect(content).toContain('maxAge: 900');
      expect(content).toContain(`'${route}'`);
    }
  });
  it('does not introduce public signup', () => {
    expect(source('../src/app/auth/invite/actions.ts')).not.toContain('signUp(');
    expect(source('../src/app/auth/recovery/actions.ts')).not.toContain('signUp(');
  });
});
