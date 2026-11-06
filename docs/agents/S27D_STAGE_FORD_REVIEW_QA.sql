-- S27D QA-only publication of immutable, value-bearing review findings.
-- Publishes review material, never updates specs, aliases or product values.
CREATE OR REPLACE FUNCTION public.s27d_stage_ford_spec_value_reviews(p_preview_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE
 v_preview public.agent_runs;
 v_fusion public.agent_runs;
 v_candidate jsonb;
 v_proposal jsonb;
 v_ordinal integer;
 v_finding_id uuid;
 v_fp text;
 v_count integer:=0;
 v_kind text;
BEGIN
 SELECT * INTO v_preview FROM public.agent_runs WHERE id=p_preview_run;
 IF NOT FOUND OR v_preview.status<>'COMPLETED' OR
    v_preview.run_mode<>'SOURCE_QUALITY_CATALOG_PREVIEW_ONLY' OR
    v_preview.brand<>'Ford' OR v_preview.market<>'BR' OR
    v_preview.input->>'productId'<>'1236' OR
    v_preview.summary->>'queuePublicationPending'<>'true' OR
    jsonb_array_length(v_preview.summary->'reviewCandidates')<>42
 THEN RAISE EXCEPTION 'S27D_STAGING_PREVIEW_UNVERIFIED'; END IF;
 SELECT * INTO v_fusion FROM public.agent_runs
 WHERE id=(v_preview.input->>'sourceFusionRunId')::uuid;
 IF NOT FOUND OR v_fusion.status<>'COMPLETED' OR
    v_fusion.run_mode<>'SOURCE_FUSION_REVIEW_ONLY' OR
    v_fusion.summary->>'sourceQualityGate'<>'S27D_FORD_V1' OR
    jsonb_array_length(v_fusion.summary->'proposals')<>107
 THEN RAISE EXCEPTION 'S27D_STAGING_FUSION_UNVERIFIED'; END IF;
 FOR v_candidate IN SELECT value FROM jsonb_array_elements(v_preview.summary->'reviewCandidates')
 LOOP
   v_ordinal:=(v_candidate->>'ordinal')::integer;
   IF v_ordinal<1 OR v_ordinal>107 THEN
     RAISE EXCEPTION 'S27D_STAGING_ORDINAL_INVALID'; END IF;
   v_proposal:=v_fusion.summary->'proposals'->(v_ordinal-1);
   v_kind:=v_candidate->>'kind';
   IF v_proposal->>'quality'<>'CORROBORATED' OR
      v_proposal->>'decision'<>'REVIEW_REQUIRED' OR
      v_proposal->>'reason'<>'BOTH_OFFICIAL_SOURCES_CORROBORATE' OR
      v_proposal->>'concept' IS DISTINCT FROM v_candidate->>'label' OR
      v_kind NOT IN ('binary','numeric') THEN
      RAISE EXCEPTION 'S27D_STAGING_SOURCE_NOT_APPROVABLE';
   END IF;
   v_fp:=md5(p_preview_run::text||':'||v_ordinal::text||':'||v_proposal::text);
   INSERT INTO public.agent_findings(
     id,run_id,finding_type,fingerprint,subject_key,title,summary,confidence,
     requires_review,subject,proposal,payload)
   VALUES(
    gen_random_uuid(),p_preview_run,'SPEC_VALUE_REVIEW',v_fp,
    jsonb_build_array('BR',1236,2027,v_ordinal)::text,
    left('Ford · Ranger · XLS 3.0 4x4 V6 · '||(v_proposal->>'concept'),500),
    'Evidência PDF + HTML corroborada. Canonicalizar e gravar valor na mesma decisão.',
    null,true,
    jsonb_build_object('brand','Ford','model','Ranger',
      'officialVersionLabel','XLS 3.0 4x4 V6','productId',1236,'modelYear',2027),
    jsonb_build_object('action','SPEC_VALUE_REVIEW','reviewOnly',true,
      'sourceLabel',v_proposal->>'concept','rawValue',v_proposal->>'value',
      'availability',v_proposal->>'availability','inputUnit',v_proposal->>'unit',
      'sourceQuality','CORROBORATED','kind',v_kind,
      'candidateCodes',v_candidate->'candidateCodes'),
    jsonb_build_object('reasonCode','SPEC_VALUE_REVIEW',
      'sourceQualityGate','S27D_FORD_V1',
      'sourceFusionRunId',v_fusion.id,'sourceOrdinal',v_ordinal,
      'sourceUrl',(v_proposal->'evidence'->0)->>'sourceUrl',
      'sourceEvidence',v_proposal->'evidence',
      'automaticCatalogWrites',false)
   ) ON CONFLICT(run_id,fingerprint) DO NOTHING RETURNING id INTO v_finding_id;
   IF v_finding_id IS NULL THEN
     SELECT id INTO v_finding_id FROM public.agent_findings
       WHERE run_id=p_preview_run AND fingerprint=v_fp;
   END IF;
   IF v_finding_id IS NULL THEN RAISE EXCEPTION 'S27D_STAGING_FINDING_FAILED'; END IF;
   INSERT INTO public.agent_review_cases(scope_key,case_kind,source_kind,
      source_ref,source_snapshot_fingerprint,source_observed_at,status)
   VALUES('s27d:spec-value:'||v_finding_id::text,
      CASE WHEN v_candidate->>'status'='SPEC_NEW' THEN 'SPEC_NEW' ELSE 'SPEC_AMBIGUOUS' END,
      'AGENT_PLATFORM',v_finding_id::text,v_fp,v_preview.completed_at,'WAITING')
   ON CONFLICT(scope_key) DO NOTHING;
   v_count:=v_count+1;
   v_finding_id:=null;
 END LOOP;
 RETURN jsonb_build_object('status','STAGED','findings',v_count,'previewRunId',p_preview_run,
   'canonicalWrites',false,'productSpecWrites',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.s27d_stage_ford_spec_value_reviews(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.s27d_stage_ford_spec_value_reviews(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.s27d_stage_ford_spec_value_reviews(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.s27d_stage_ford_spec_value_reviews(uuid) TO service_role;
