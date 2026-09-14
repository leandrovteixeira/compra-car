import { ProductResearchProviderError } from '@compra-car/adapter-openai';

// Exact allowlist only. Never return a raw message, stack, cause, SDK body or arbitrary .code.
const SAFE_AGENT_ERROR_CODES = [
  'INVALID_AGENT_ARGUMENTS',
  'INVALID_CONNECTOR_ARGUMENTS',
  'OPENAI_AGENT_CONFIG_REQUIRED',
  'SUPABASE_AGENT_CONFIG_REQUIRED',
  'OPENAI_RESEARCH_FAILED',
  'OPENAI_RESEARCH_BAD_REQUEST',
  'OPENAI_RESEARCH_AUTH',
  'OPENAI_RESEARCH_RATE_LIMIT',
  'OPENAI_RESEARCH_TIMEOUT',
  'OPENAI_RESEARCH_CONNECTION',
  'OPENAI_RESEARCH_CANCELLED',
  'OPENAI_RESEARCH_SERVER_ERROR',
  'OPENAI_RESEARCH_INCOMPLETE',
  'OPENAI_RESEARCH_INVALID_OUTPUT',
  'OPENAI_RESEARCH_NO_WEB_SEARCH',
  'CONNECTOR_RESEARCH_FAILED',
  'CONNECTOR_RESEARCH_INCOMPLETE',
  'CONNECTOR_RESEARCH_INVALID_OUTPUT',
  'CONNECTOR_RESEARCH_NO_WEB_SEARCH',
  'INVALID_CONNECTOR_RESEARCH',
  'INVALID_CONNECTOR_EVIDENCE',
  'CONNECTOR_DOMAIN_EVIDENCE_REQUIRED',
  'INVALID_CONNECTOR',
  'INVALID_CONNECTOR_MARKET',
  'INVALID_CONNECTOR_DOMAIN',
  'INVALID_CONNECTOR_SOURCE',
  'BRAND_CONNECTOR_REQUIRED',
  'CONNECTOR_SCOPE_MISMATCH',
  'CONNECTOR_ALREADY_ACTIVE',
  'CONNECTOR_FIXTURE_NOT_AVAILABLE',
  'CONNECTOR_READ_FAILED',
  'CONNECTOR_FINGERPRINT_MISMATCH',
  'PERSISTENCE_FAILED',
  'INVALID_INPUT',
  'CONTENT_CONFLICT',
  'IMMUTABLE_RUN',
] as const;

export function safeAgentFailure(
  prefix: 'BRAND_CONNECTOR_FAILED' | 'NEW_PRODUCT_CHECK_FAILED',
  error: unknown,
): string {
  const code =
    error instanceof Error
      ? SAFE_AGENT_ERROR_CODES.find((candidate) => candidate === error.message)
      : undefined;
  if (!code) return prefix;
  const fields = [prefix + ': ' + code];
  if (error instanceof ProductResearchProviderError) {
    if (Number.isInteger(error.status) && error.status! >= 100 && error.status! <= 599)
      fields.push('status=' + error.status);
    if (Number.isSafeInteger(error.elapsedMs) && error.elapsedMs! >= 0)
      fields.push('elapsed_ms=' + error.elapsedMs);
  }
  return fields.join('\n');
}
