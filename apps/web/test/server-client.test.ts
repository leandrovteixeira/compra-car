import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientState = vi.hoisted(() => ({
  set: vi.fn(),
}));

import { createServerAuthCookieStore } from '../src/auth/server-cookie-store';

describe('server Auth clients por contexto', () => {
  beforeEach(() => {
    clientState.set.mockReset();
  });

  it('tolera escrita proibida no contexto read-only', async () => {
    clientState.set.mockImplementation(() => {
      throw new Error('read-only');
    });
    const store = createServerAuthCookieStore(
      { getAll: () => [], set: clientState.set },
      'read-only',
    );

    expect(() => store.setAll([{ name: 'sb-token', value: 'value' }])).not.toThrow();
  });

  it('propaga falha de escrita no contexto mutável', async () => {
    clientState.set.mockImplementation(() => {
      throw new Error('write failed');
    });
    const store = createServerAuthCookieStore(
      { getAll: () => [], set: clientState.set },
      'mutable',
    );

    expect(() => store.setAll([{ name: 'sb-token', value: 'value' }])).toThrow('write failed');
  });
});
