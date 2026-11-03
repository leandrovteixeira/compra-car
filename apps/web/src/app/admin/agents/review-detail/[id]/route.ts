import { NextResponse } from 'next/server';
import { safeAgentSourceUrl } from '@compra-car/core/agent-platform';
import { loadAgentFinding } from '@/application/admin/agent-platform';

/** On-demand detail only; no mutations and no service-role credential in browser. */
export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id))
    return NextResponse.json({ error: 'ID_INVALIDO' }, { status: 400 });
  // loadAgentFinding enforces admin authorization and executes on the server.
  const detail = await loadAgentFinding(id);
  if (!detail) return NextResponse.json({ error: 'NAO_ENCONTRADO' }, { status: 404 });
  return NextResponse.json({
    findingId: detail.finding.id,
    title: detail.finding.title,
    summary: detail.finding.summary,
    sourceAgent: detail.run.agentType,
    subject: detail.finding.subject,
    proposal: detail.finding.proposal,
    reasonCode: typeof detail.finding.payload.reasonCode === 'string'
      ? detail.finding.payload.reasonCode : null,
    evidenceAssessment: detail.finding.payload.evidenceAssessment ?? null,
    technicalPayload: detail.finding.payload,
    evidence: detail.evidence.slice(0,50).map((e)=>({
      title:e.title,excerpt:e.excerpt,sourceType:e.sourceType,
      url:safeAgentSourceUrl(e.sourceUrl), capturedAt:e.capturedAt,
    })),
    history: detail.reviews.map((review)=>({
      decision:review.decision,note:review.note,at:review.createdAt,
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
