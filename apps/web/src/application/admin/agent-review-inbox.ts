import 'server-only';

import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
import {
  type ReviewCaseKind,
  type ReviewStatus,
  type ReviewQueueItem,
  reviewPolicy,
} from '@compra-car/core/agent-platform';

/** Read-only Sprint 26 projection over historical Agent Platform data.
 * A legacy ACCEPT is deliberately NOT converted to APPROVED: old ACCEPT
 * does not prove that a canonical write took place.
 */
export type ReviewInboxRow = ReviewQueueItem & Readonly<{
  findingId: string;
  findingType: string;
  agentLabel: string;
  reasonCode: string | null;
  legacyAccepted: boolean;
  priorRuns: number;
}>;

export type ReviewInboxResponse = Readonly<{
  items: readonly ReviewInboxRow[];
  total: number;
  statusCounts: Record<ReviewStatus, number>;
}>;

type FindingRecord = {
  id: string;
  run_id: string;
  finding_type: string;
  fingerprint: string;
  subject_key: string | null;
  title: string;
  summary: string | null;
  confidence: number | string | null;
  proposal: unknown;
  payload: Record<string, unknown> | null;
  created_at: string;
};
type RunRecord = { id: string; agent_type: string; brand: string | null; status: string; started_at: string; market: string | null };
type ReviewRecord = { finding_id: string; decision: string; created_at: string };

const labels: Record<string, string> = {
  BRAND_CONNECTOR: 'Brand Connector',
  MMV_DISCOVERY: 'MMV Discovery',
  MODEL_YEAR: 'Ano-modelo',
  PRODUCT_YEAR: 'Ano-modelo',
  PRICE_INTELLIGENCE: 'Preços',
  SPEC_INTELLIGENCE: 'Specs',
};

const recommendations: Record<ReviewCaseKind, string> = {
  BRAND_NEW: 'Confirmar nova marca',
  BRAND_AMBIGUOUS: 'Reconciliar marca',
  CONNECTOR_NEW: 'Validar fontes oficiais',
  CONNECTOR_UPDATE: 'Validar atualização das fontes',
  MMV_NEW: 'Criar identidade MMV',
  MMV_AMBIGUOUS: 'Criar ou vincular MMV',
  MMV_MATCHED: 'Correspondência confirmada',
  MODEL_YEAR_NEW: 'Confirmar novo ano-modelo',
  MODEL_YEAR_MATCHED: 'Ano-modelo conhecido',
  PRICE_NEW: 'Confirmar preço público',
  PRICE_CHANGE: 'Validar alteração do preço',
  SPEC_NEW: 'Cadastrar especificação',
  SPEC_AMBIGUOUS: 'Criar ou reconciliar spec',
  SPEC_MATCHED: 'Especificação conhecida',
  WATCHER_SIGNAL: 'Validar sinal',
};

function kindFor(finding: FindingRecord, run: RunRecord): ReviewCaseKind | null {
  if (run.agent_type === 'BRAND_CONNECTOR') {
    if (finding.finding_type === 'NEW_BRAND_CONNECTOR') return 'CONNECTOR_NEW';
    if (finding.finding_type === 'CONNECTOR_DRIFT' && finding.proposal) return 'CONNECTOR_UPDATE';
    return null;
  }
  if (run.agent_type === 'MMV_DISCOVERY') {
    if (finding.finding_type === 'MMV_MATCHED') return null;
    return finding.finding_type === 'AMBIGUOUS_MMV' || !finding.proposal
      ? 'MMV_AMBIGUOUS' : 'MMV_NEW';
  }
  if (run.agent_type === 'PRODUCT_YEAR' || run.agent_type === 'MODEL_YEAR') {
    if (finding.finding_type === 'MODEL_YEAR_MATCHED' ||
        finding.payload?.reasonCode === 'CONFIRMED_MODEL_YEAR') return null;
    if (finding.finding_type === 'POSSIBLE_NEW_MMV' ||
        finding.finding_type === 'PRODUCT_YEAR_CONFLICT') return 'MMV_AMBIGUOUS';
    return 'MODEL_YEAR_NEW';
  }
  if (run.agent_type === 'PRICE_INTELLIGENCE')
    return finding.finding_type === 'PRICE_CHANGE' ? 'PRICE_CHANGE' : 'PRICE_NEW';
  if (run.agent_type === 'SPEC_INTELLIGENCE')
    return finding.finding_type === 'UNMATCHED_SPEC' ? 'SPEC_AMBIGUOUS' : 'SPEC_NEW';
  return null; // Watcher intelligence has a distinct, versioned store/adapter.
}

function recordStatus(decision: string | null): ReviewStatus {
  if (decision === 'REJECT') return 'REJECTED';
  if (decision === 'DEFER') return 'POSTPONED';
  // ACCEPT was legacy review-only and may not have been applied.
  return 'WAITING';
}

function businessKey(finding: FindingRecord, run: RunRecord): string {
  const reason = typeof finding.payload?.reasonCode === 'string' ? finding.payload.reasonCode : '';
  return JSON.stringify([
    run.agent_type === 'MODEL_YEAR' ? 'PRODUCT_YEAR' : run.agent_type,
    finding.finding_type,
    reason,
    finding.subject_key ?? finding.fingerprint,
  ]);
}

async function readAllFindings(client: ReturnType<typeof createPrivilegedAdminClient>): Promise<FindingRecord[]> {
  const rows: FindingRecord[] = [];
  const size = 500;
  for (let offset = 0; offset < 5000; offset += size) {
    const { data, error } = await client
      .from('agent_findings')
      .select('id,run_id,finding_type,fingerprint,subject_key,title,summary,confidence,proposal,payload,created_at')
      .eq('requires_review', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + size - 1);
    if (error || !data) throw new Error('REVIEW_INBOX_FINDINGS_UNAVAILABLE');
    rows.push(...(data as FindingRecord[]));
    if (data.length < size) return rows;
  }
  throw new Error('REVIEW_INBOX_PAGINATION_LIMIT');
}

export async function loadReviewInbox(
  options: Readonly<{
    page?: number;
    limit?: number;
    status?: ReviewStatus | 'ALL';
    agent?: string;
    search?: string;
  }> = {},
): Promise<ReviewInboxResponse> {
  await requireRole('admin');
  const client = createPrivilegedAdminClient();
  const [findings, runsResult, reviewsResult] = await Promise.all([
    readAllFindings(client),
    client.from('agent_runs').select('id,agent_type,brand,status,started_at,market'),
    client.from('agent_reviews').select('finding_id,decision,created_at').order('created_at', { ascending: false }),
  ]);
  if (runsResult.error || reviewsResult.error || !runsResult.data || !reviewsResult.data)
    throw new Error('REVIEW_INBOX_DATA_UNAVAILABLE');

  const runs = new Map((runsResult.data as RunRecord[]).map((run) => [run.id, run]));
  const reviews = new Map<string, ReviewRecord>();
  for (const review of reviewsResult.data as ReviewRecord[])
    if (!reviews.has(review.finding_id)) reviews.set(review.finding_id, review);
  const groups = new Map<string, { finding: FindingRecord; run: RunRecord; kind: ReviewCaseKind; priorRuns: number; reviewedSameFingerprint: string | null }>();
  for (const finding of findings) {
    const run = runs.get(finding.run_id);
    if (!run || run.status !== 'COMPLETED') continue;
    const kind = kindFor(finding, run);
    if (!kind || !reviewPolicy(kind).showInReviewQueue) continue;
    const key = businessKey(finding, run);
    const old = groups.get(key);
    if (!old) {
      groups.set(key, { finding, run, kind, priorRuns: 1,
        reviewedSameFingerprint: reviews.get(finding.id)?.decision ?? null });
    } else {
      old.priorRuns++;
      if (old.finding.fingerprint === finding.fingerprint && !old.reviewedSameFingerprint)
        old.reviewedSameFingerprint = reviews.get(finding.id)?.decision ?? null;
    }
  }

  const rows: ReviewInboxRow[] = [...groups.values()].map(({finding,run,kind,priorRuns,reviewedSameFingerprint}) => {
    const confidence = finding.confidence == null ? null : Number(finding.confidence);
    const reasonCode = typeof finding.payload?.reasonCode === 'string' ? finding.payload.reasonCode : null;
    return {
      caseId: finding.id,
      caseKind: kind,
      findingId: finding.id,
      findingType: finding.finding_type,
      sourceFindingType: finding.finding_type,
      sourceAgent: run.agent_type,
      agentLabel: labels[run.agent_type] ?? run.agent_type,
      reasonCode,
      businessKey: businessKey(finding, run),
      title: finding.title,
      shortDescription: finding.summary?.slice(0, 230) ?? finding.finding_type,
      recommendation: recommendations[kind],
      confidence: Number.isFinite(confidence) ? confidence : null,
      evidenceCount: 0,
      evidencePreview: null,
      primaryEvidenceUrl: null,
      observedAt: finding.created_at,
      status: recordStatus(reviewedSameFingerprint),
      snapshotFingerprint: finding.fingerprint,
      caseVersion: 0,
      legacyAccepted: reviewedSameFingerprint === 'ACCEPT',
      priorRuns,
    };
  });
  const statusCounts: Record<ReviewStatus, number> = {
    WAITING: 0, APPROVED: 0, REJECTED: 0, POSTPONED: 0,
  };
  rows.forEach((row) => { statusCounts[row.status]++; });
  const term = options.search?.trim().toLocaleLowerCase('pt-BR') ?? '';
  const filtered = rows.filter((r) =>
    (!options.status || options.status === 'ALL' || options.status === r.status) &&
    (!options.agent || options.agent === r.sourceAgent) &&
    (!term || [r.title,r.shortDescription,r.agentLabel,r.recommendation,r.reasonCode]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(term)))
  ).sort((a,b) => Date.parse(b.observedAt)-Date.parse(a.observedAt) || a.caseId.localeCompare(b.caseId));
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 25)));
  const visible = filtered.slice((page-1)*limit, page*limit);

  if (visible.length) {
    const ids = visible.map((row) => row.findingId);
    const {data:evidence,error} = await client.from('agent_evidence')
      .select('finding_id,source_url,excerpt').in('finding_id',ids)
      .order('created_at',{ascending:false}).limit(1000);
    if (error || !evidence) throw new Error('REVIEW_INBOX_EVIDENCE_UNAVAILABLE');
    const first = new Map<string,{source_url:string;excerpt:string|null}>();
    const counts = new Map<string,number>();
    for (const item of evidence) {
      counts.set(item.finding_id,(counts.get(item.finding_id)??0)+1);
      if (!first.has(item.finding_id)) first.set(item.finding_id,item);
    }
    for (let i=0;i<visible.length;i++) {
      const row = visible[i]!;
      const match = first.get(row.findingId);
      visible[i] = {
        ...row,
        evidenceCount: counts.get(row.findingId) ?? 0,
        evidencePreview: match?.excerpt?.slice(0,135) ?? null,
        primaryEvidenceUrl: match?.source_url ?? null,
      };
    }
  }
  return {items:visible,total:filtered.length,statusCounts};
}
