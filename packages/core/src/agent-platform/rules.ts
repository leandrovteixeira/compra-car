import type { AgentJson, AgentReview } from './types';
export class AgentPlatformError extends Error {
  constructor(
    readonly code:
      'INVALID_INPUT' | 'NOT_FOUND' | 'IMMUTABLE_RUN' | 'CONTENT_CONFLICT' | 'PERSISTENCE_FAILED',
  ) {
    super(code);
    this.name = 'AgentPlatformError';
  }
}
export function assertAgentUuid(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id))
    throw new AgentPlatformError('INVALID_INPUT');
}
export function canonicalAgentJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalAgentJson).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonicalAgentJson(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value) ?? 'null';
}
export function assertAgentSame(a: unknown, b: unknown): void {
  if (canonicalAgentJson(a) !== canonicalAgentJson(b))
    throw new AgentPlatformError('CONTENT_CONFLICT');
}
export function agentReviewHistory(reviews: readonly AgentReview[]): readonly AgentReview[] {
  return [...reviews].sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
  );
}
export function latestAgentReview(reviews: readonly AgentReview[]): AgentReview | null {
  return agentReviewHistory(reviews)[0] ?? null;
}
export function safeAgentSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function assertAgentJson(value: AgentJson, maxBytes = 65536): void {
  const text = canonicalAgentJson(value);
  if (
    new TextEncoder().encode(text).length > maxBytes ||
    /data:[^;]+;base64,|<!doctype html|<html[\s>]/iu.test(text)
  )
    throw new AgentPlatformError('INVALID_INPUT');
}
