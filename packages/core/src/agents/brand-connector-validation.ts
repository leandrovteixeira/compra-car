import { createHash } from 'node:crypto';
import { canonicalAgentJson, latestAgentReview, type AgentFindingDetail } from '../agent-platform';
import { vehicleTextComparisonKey } from '../admin/vehicle-text-normalization';
import {
  CONNECTOR_SOURCE_TYPES,
  type BrandConnectorDefinition,
  type ConnectorSourceEntry,
} from './brand-connector-types';

export function connectorText(value: unknown, max = 500): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[<>\u0000-\u001f]|(?:bearer\s|sk-[a-z0-9]|-----BEGIN|(?:api[_-]?key|password|secret|token)\s*[=:])/iu.test(
      value,
    )
  )
    throw new Error('INVALID_CONNECTOR');
  return value.trim().replace(/\s+/gu, ' ');
}
export function brandKey(value: string): string {
  return vehicleTextComparisonKey(connectorText(value, 100));
}
export function connectorMarket(value: string): string {
  const market = connectorText(value, 2).toUpperCase();
  if (!/^[A-Z]{2}$/u.test(market)) throw new Error('INVALID_CONNECTOR_MARKET');
  return market;
}
export function connectorDomain(value: unknown): string {
  const domain = connectorText(value, 253).toLowerCase();
  // DNS names only: reject all IP literals, internal suffixes and alternate numeric IP forms.
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(domain) ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/u.test(domain)
  )
    throw new Error('INVALID_CONNECTOR_DOMAIN');
  return domain;
}
export function safeConnectorUrl(value: unknown, domains?: readonly string[]): string | null {
  try {
    if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\\]/u.test(value))
      return null;
    const url = new URL(value);
    const host = connectorDomain(url.hostname);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      [...url.searchParams.keys()].some((k) =>
        /token|key|secret|password|signature|credential/iu.test(k),
      )
    )
      return null;
    if (domains && !domains.some((d) => host === d || host.endsWith('.' + d))) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}
function texts(value: unknown, maxItems = 40): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error('INVALID_CONNECTOR');
  return [...new Set(value.map((v) => connectorText(v)))].sort();
}
export function validateConnectorDefinition(input: unknown): BrandConnectorDefinition {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('INVALID_CONNECTOR');
  const v = input as Record<string, unknown>;
  const brand = connectorText(v.brand, 100),
    market = connectorMarket(connectorText(v.market, 2));
  const allowedDomains = texts(v.allowedDomains, 20).map(connectorDomain).sort();
  if (!allowedDomains.length || !Array.isArray(v.sourceEntries) || v.sourceEntries.length > 100)
    throw new Error('INVALID_CONNECTOR');
  const entries: ConnectorSourceEntry[] = v.sourceEntries.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('INVALID_CONNECTOR');
    const e = raw as Record<string, unknown>,
      url = safeConnectorUrl(e.url, allowedDomains);
    if (
      !url ||
      !CONNECTOR_SOURCE_TYPES.includes(e.type as ConnectorSourceEntry['type']) ||
      !Number.isInteger(e.priority) ||
      Number(e.priority) < 0 ||
      Number(e.priority) > 100
    )
      throw new Error('INVALID_CONNECTOR_SOURCE');
    return {
      type: e.type as ConnectorSourceEntry['type'],
      url,
      priority: Number(e.priority),
      ...(e.notes ? { notes: connectorText(e.notes) } : {}),
    };
  });
  const sourceEntries = [...new Map(entries.map((e) => [canonicalAgentJson(e), e])).entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, e]) => e);
  return {
    brand,
    market,
    allowedDomains: [...new Set(allowedDomains)],
    sourceEntries,
    searchHints: texts(v.searchHints),
    terminologyHints: texts(v.terminologyHints),
  };
}
export function connectorFingerprint(value: unknown): string {
  const definition = validateConnectorDefinition(value);
  return createHash('sha256')
    .update(canonicalAgentJson({ ...definition, brand: brandKey(definition.brand) }))
    .digest('hex');
}
export function acceptedConnectorProposal(detail: AgentFindingDetail): BrandConnectorDefinition {
  if (
    detail.run.agentType !== 'BRAND_CONNECTOR' ||
    detail.run.status !== 'COMPLETED' ||
    !['NEW_BRAND_CONNECTOR', 'CONNECTOR_DRIFT'].includes(detail.finding.findingType) ||
    latestAgentReview(detail.reviews)?.decision !== 'ACCEPT'
  )
    throw new Error('CONNECTOR_ACTIVATION_NOT_ALLOWED');
  const proposal = validateConnectorDefinition(detail.finding.proposal);
  if (
    brandKey(proposal.brand) !== brandKey(String(detail.finding.subject.brand)) ||
    proposal.market !== detail.finding.subject.market ||
    brandKey(proposal.brand) !== brandKey(detail.run.brand ?? '') ||
    proposal.market !== detail.run.market ||
    detail.finding.payload.connectorFingerprint !== connectorFingerprint(proposal)
  )
    throw new Error('CONNECTOR_PROPOSAL_MISMATCH');
  return proposal;
}
