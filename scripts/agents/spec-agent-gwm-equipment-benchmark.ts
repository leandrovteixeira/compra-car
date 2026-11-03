/**
 * Sprint 27 GWM PHEV19 2027 - full equipment-page benchmark.
 * Reads public PDF layout text and a frozen QA catalog snapshot.
 * It NEVER writes to Supabase, approves aliases, or calls an LLM.
 *
 * Usage: pnpm --filter @compra-car/agents exec tsx spec-agent-gwm-equipment-benchmark.ts
 *          --text /path/to/pdftotext-layout.txt
 */
import {readFileSync} from 'node:fs';
import {
  extractGwmEquipmentClaims27,
  suggestCanonicalSpecs27,
  type SpecCatalogDisplay27,
} from '@compra-car/core/agents';
import {normalizeAliasLabel} from '@compra-car/core/agent-platform';

const [flag,filename]=process.argv.slice(2);
if(flag!=='--text'||!filename){
  process.stderr.write('Usage: --text path/to/real-pdftotext-layout.txt\n');
  process.exit(2);
}
const text=readFileSync(filename,'utf8');
const extracted=extractGwmEquipmentClaims27(text);
type SnapshotRow={id:string;code:string;type:'binary'|'numeric'|'scale';unit:string|null;label:string;group_name:string;equipment_group:string;spec_set:string};
const snapshot=JSON.parse(readFileSync(
  new URL('../../packages/core/test/fixtures/gwm-h6-phev19-2027-qa-specs.json',import.meta.url),
  'utf8',
)) as {productId:number;modelYear:number;rows:SnapshotRow[]};
if(snapshot.productId!==1166||snapshot.modelYear!==2027||snapshot.rows.length!==171)
  throw new Error('GWM_QA_SNAPSHOT_INCONSISTENT');
const binary=snapshot.rows.filter(row=>row.type==='binary');
const exactLabel=(label:string)=>binary.filter(
  row=>normalizeAliasLabel(row.label)===normalizeAliasLabel(label)
);
const observationClaims=extracted.claims.map(claim=>({
  label:claim.sourceLabel,kind:'binary' as const,value:'STANDARD' as const,
  evidence:{sourceId:'gwm-h6-phev19-flex',documentHash:'PENDING_DOWNLOAD_HASH',
    capturedAt:'2026-11-03T00:00:00Z',authority:'MANUFACTURER' as const,documentPage:claim.page},
}));
const suggested=suggestCanonicalSpecs27({
  observations:observationClaims,
  catalog:snapshot.rows.map(row=>({
    id:row.id,code:row.code,type:row.type,unit:row.unit,detail:row.label,
    displayPt:row.label,groupName:row.group_name,
    equipmentGroup:row.equipment_group,specSet:row.spec_set,
  })) satisfies SpecCatalogDisplay27[],
  limit:3,
});
const results=extracted.claims.map((claim,index)=>{
  const direct=exactLabel(claim.sourceLabel);
  const candidates=suggested[index]!.candidates
    .filter(c=>c.score>=0.2)
    .map(c=>({code:c.specCode,label:c.label,score:c.score}));
  return {
    page:claim.page,category:claim.category,ordinal:claim.ordinal,
    sourceLabel:claim.sourceLabel,
    matchState:direct.length===1?'EXACT_LABEL_UNAPPROVED'
      :direct.length>1?'EXACT_LABEL_AMBIGUOUS'
      :candidates.length?'LEXICAL_SUGGESTION_ONLY':'NO_SUGGESTION',
    exactCodes:direct.map(s=>s.code),suggestions:candidates,
    lexicalTier:!candidates.length?'NONE':candidates[0]!.score>=0.6?'HIGH':candidates[0]!.score>=0.35?'MEDIUM':'LOW',
    compositeNeedsDecomposition:claim.sourceLabel.includes(' + '),
  };
});
const count=(state:string)=>results.filter(x=>x.matchState===state).length;
const report={
  target:{productId:1166,modelYear:2027,version:'Haval H6 PHEV19 Flex'},
  source:'GWM H6 PHEV19 Flex public PDF, pages 1-4',
  scope:'Equipment bullet claims only; not all canonical specs nor full technical sheet',
  extraction:{...extracted.metrics,warnings:extracted.warnings},
  reconciliation:{
    qaExistingSpecs:snapshot.rows.length,
    qaBinarySpecs:binary.length,
    exactLabelCandidates:count('EXACT_LABEL_UNAPPROVED'),
    ambiguousExactLabelCandidates:count('EXACT_LABEL_AMBIGUOUS'),
    lexicalSuggestionOnly:count('LEXICAL_SUGGESTION_ONLY'),
    withoutCandidate:count('NO_SUGGESTION'),
    strongLexicalReviewCandidates:results.filter(x=>x.lexicalTier==='HIGH').length,
    mediumLexicalReviewCandidates:results.filter(x=>x.lexicalTier==='MEDIUM').length,
    weakLexicalReviewCandidates:results.filter(x=>x.lexicalTier==='LOW').length,
    claimsWithExplicitPlusComposition:results.filter(x=>x.compositeNeedsDecomposition).length,
    approvedContextualAliasesApplied:0,
    canonicalUpdatesApplied:0,
    candidatesAwaitingHumanValidation:results.length,
  },
  telemetry:{llmCalls:0,estimatedAiCostUsd:0,databaseWrites:0},
  findings:results,
};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
