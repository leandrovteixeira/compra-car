import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { createLegacySupabaseClient } from '../src/client';
import { LegacyAdapterConfigurationError, LegacyAdapterServerOnlyError } from '../src/errors';
import { LegacySupabaseAdapter } from '../src/legacy-supabase-adapter';

describe('cliente Supabase legado', () => {
  it('falha de forma clara quando a configuração privada está ausente', () => {
    expect(() => createLegacySupabaseClient({ url: '', serverKey: '' })).toThrow(
      LegacyAdapterConfigurationError,
    );
  });

  it('impede cliente e adaptador em runtime de navegador', () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    try {
      expect(() =>
        createLegacySupabaseClient({ url: 'https://example.supabase.co', serverKey: 'secret' }),
      ).toThrow(LegacyAdapterServerOnlyError);
      expect(() => new LegacySupabaseAdapter({} as SupabaseClient)).toThrow(
        LegacyAdapterServerOnlyError,
      );
    } finally {
      Reflect.deleteProperty(globalThis, 'window');
    }
  });
});
