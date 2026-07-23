import type { AuthCookie, AuthCookieStore } from '@compra-car/adapter-supabase';

interface NextCookieStore {
  getAll(): readonly Pick<AuthCookie, 'name' | 'value'>[];
  set(name: string, value: string, options?: AuthCookie['options']): void;
}

export function createServerAuthCookieStore(
  nextCookieStore: NextCookieStore,
  cookieWrites: 'read-only' | 'mutable',
): AuthCookieStore {
  return {
    getAll: () => nextCookieStore.getAll(),
    setAll: (cookiesToSet: readonly AuthCookie[]) => {
      if (cookieWrites === 'mutable') {
        cookiesToSet.forEach(({ name, value, options }) => {
          nextCookieStore.set(name, value, options);
        });
        return;
      }

      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          nextCookieStore.set(name, value, options);
        });
      } catch {
        // Server Components cannot write cookies. Middleware performs refresh writes.
      }
    },
  };
}
