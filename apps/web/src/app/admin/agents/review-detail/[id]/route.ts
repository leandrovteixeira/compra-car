import { NextResponse } from 'next/server';
import { safeAgentSourceUrl } from '@compra-car/core/agent-platform';
import {suggestVocabularyMatches27} from '@compra-car/core/agents';
import { loadAgentFinding } from '@/application/admin/agent-platform';
import {createPrivilegedAdminClient} from '@/auth/admin-client';

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
  let canonicalOptions: {id:number;code:string;label:string;type:string;group:string;unit:string|null}[]=[];
  let specReviewHints: {code:string;label:string;score:number;reasons:readonly string[]}[]=[];
  if(detail.run.agentType==='SPEC_INTELLIGENCE'){
    const kind=detail.finding.proposal?.kind;
    if(kind==='binary'||kind==='numeric'||kind==='scale'){
      const {data:catalog,error}=await createPrivilegedAdminClient().from('specs')
        .select('id,code,display_pt,detail_pt,detail,type,group_name_pt,group_name,unit')
        .eq('type',kind).eq('is_active',true).order('code').limit(600);
      if(error||!catalog)return NextResponse.json({error:'SPEC_CATALOG_UNAVAILABLE'},{status:503});
      canonicalOptions=catalog.map(c=>({id:Number(c.id),code:String(c.code),
        label:String(c.display_pt??c.detail_pt??c.detail??c.code),
        group:String(c.group_name_pt??c.group_name??''),type:String(c.type),
        unit:typeof c.unit==='string'?c.unit:null}));
      const sourceLabel=detail.finding.proposal?.sourceLabel;
      const rawLabel=detail.finding.proposal?.rawLabel;
      const unit=detail.finding.proposal?.observedUnit;
      if(typeof sourceLabel==='string'&&sourceLabel.trim()){
        specReviewHints=[...suggestVocabularyMatches27({
          label:sourceLabel,rawLabel:typeof rawLabel==='string'?rawLabel:undefined,
          kind,unit:typeof unit==='string'?unit:null,
          catalog:canonicalOptions.map(option=>({
            code:option.code,label:option.label,kind,unit:option.unit
          })),limit:5
        })];
      }
    }
  }
  return NextResponse.json({
    findingId: detail.finding.id,
    canonicalOptions,
    specReviewHints,
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
