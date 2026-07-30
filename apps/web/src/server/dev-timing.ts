import 'server-only';

export async function withDevTiming<T>(label: string, operation: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV !== 'development') return operation();
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    console.info(`[timing] ${label}: ${Math.round(performance.now() - startedAt)} ms`);
  }
}
