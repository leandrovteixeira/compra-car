const DEFAULT_DESTINATION = '/';

export function getSafeInternalDestination(
  value: string | null | undefined,
  fallback = DEFAULT_DESTINATION,
): string {
  if (!value || value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
    return fallback;
  }

  let decodedValue = value;
  try {
    for (let depth = 0; depth < 2; depth += 1) {
      const nextValue = decodeURIComponent(decodedValue);
      if (nextValue === decodedValue) break;
      decodedValue = nextValue;
    }
  } catch {
    return fallback;
  }

  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    decodedValue.startsWith('//') ||
    decodedValue.includes('\\')
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(value, 'http://internal.local');
    if (parsed.origin !== 'http://internal.local') return fallback;
    if (!parsed.pathname.startsWith('/')) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function isAdminDestination(destination: string): boolean {
  const pathname = destination.split(/[?#]/u, 1)[0];
  return pathname === '/admin' || pathname?.startsWith('/admin/') === true;
}
