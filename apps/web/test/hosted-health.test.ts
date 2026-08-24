import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (relativePath: string) =>
  fs.readFileSync(path.join(import.meta.dirname, relativePath), 'utf8');

describe('hosted health check', () => {
  it('returns a minimal uncached response without consulting application services', () => {
    const route = source('../src/app/api/health/route.ts');

    expect(route).toContain("{ status: 'ok' }");
    expect(route).toContain("'Cache-Control': 'no-store'");
    expect(route).not.toContain('SUPABASE');
    expect(route).not.toContain('process.env');
  });

  it('keeps the Railway probe outside authenticated middleware', () => {
    const railway = source('../../../railway.json');
    const middleware = source('../src/middleware.ts');

    expect(railway).toContain('"healthcheckPath": "/api/health"');
    expect(middleware).toContain('(?!api/health|');
  });
});
