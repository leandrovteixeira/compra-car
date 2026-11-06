-- S27D QA: atomic spec canonicalization and vehicle value save.
-- Public execution is explicitly revoked; caller identity comes from auth.uid().
CREATE OR REPLACE FUNCTION public.s27d_commit_ford_spec_value(
  p_finding uuid,
  p_fingerprint text,
  p_revision bigint,
  p_action text,
  p_target_spec bigint,
  p_canonical_input jsonb,
  p_idempotency text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_f public.agent_findings;
 v_case public.agent_review_cases;
 v_preview public.agent_runs;
 v_fusion public.agent_runs;
 v_spec public.specs;
 v_proposal jsonb;
 v_index integer;
 v_target_id bigint;
 v_value numeric;
 v_is_present boolean;
 v_unit text;
 v_kind text;
 v_availability text;
 v_event uuid;
 v_existing public.product_specs;
 v_doc uuid;
 v_obs uuid;
 v_previous uuid;
 v_receipt jsonb;
 v_label text;
 v_alias_key text;
 v_alias_existing bigint;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.profiles
   WHERE id=v_actor AND lower(role::text) IN ('admin','master') AND status='active'
 ) THEN RAISE EXCEPTION 'SPEC_VALUE_NOT_AUTHORIZED'; END IF;
 IF p_finding IS NULL OR length(coalesce(p_fingerprint,''))<16 OR
    p_revision IS NULL OR p_revision<1 OR p_action IS NULL
    OR p_action NOT IN ('MERGE','CREATE','REJECT','POSTPONE')
    OR length(coalesce(p_idempotency,''))<12 OR length(p_idempotency)>200
 THEN RAISE EXCEPTION 'SPEC_VALUE_BAD_COMMAND'; END IF;
 SELECT * INTO v_f FROM public.agent_findings WHERE id=p_finding FOR UPDATE;
 IF NOT FOUND OR v_f.fingerprint<>p_fingerprint OR
    v_f.finding_type<>'SPEC_VALUE_REVIEW' OR
    v_f.proposal->>'sourceQuality'<>'CORROBORATED' OR
    v_f.proposal->>'reviewOnly'<>'true' OR
    v_f.subject->>'productId'<>'1236' OR
    v_f.subject->>'modelYear'<>'2027'
 THEN RAISE EXCEPTION 'SPEC_VALUE_UNVERIFIED_FINDING'; END IF;
 SELECT * INTO v_case FROM public.agent_review_cases
   WHERE scope_key='s27d:spec-value:'||v_f.id::text FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SPEC_VALUE_CASE_MISSING'; END IF;
 SELECT id INTO v_previous FROM public.agent_decision_events
   WHERE idempotency_key=p_idempotency;
 IF FOUND THEN
   IF NOT EXISTS(SELECT 1 FROM public.agent_decision_events WHERE id=v_previous
      AND case_id=v_case.id AND action=p_action AND actor_id=v_actor)
   THEN RAISE EXCEPTION 'SPEC_VALUE_IDEMPOTENCY_CONFLICT'; END IF;
   RETURN jsonb_build_object('status','REPLAYED','caseId',v_case.id,'decisionId',v_previous);
 END IF;
 IF v_case.status NOT IN ('WAITING','POSTPONED')
    OR v_case.revision<>p_revision OR
    v_case.source_snapshot_fingerprint<>p_fingerprint
 THEN RAISE EXCEPTION 'SPEC_VALUE_STALE_CASE'; END IF;
 SELECT * INTO v_preview FROM public.agent_runs WHERE id=v_f.run_id;
 IF NOT FOUND OR v_preview.run_mode<>'SOURCE_QUALITY_CATALOG_PREVIEW_ONLY'
    OR v_preview.status<>'COMPLETED' OR v_preview.summary->>'queuePublicationPending'<>'true'
 THEN RAISE EXCEPTION 'SPEC_VALUE_PREVIEW_MISSING'; END IF;
 SELECT * INTO v_fusion FROM public.agent_runs
  WHERE id=(v_f.payload->>'sourceFusionRunId')::uuid;
 IF NOT FOUND OR v_fusion.run_mode<>'SOURCE_FUSION_REVIEW_ONLY'
    OR v_fusion.status<>'COMPLETED'
    OR v_fusion.summary->>'sourceQualityGate'<>'S27D_FORD_V1'
    OR v_fusion.summary->>'reviewOnly'<>'true'
    OR v_fusion.input->>'targetProductId'<>'1236'
 THEN RAISE EXCEPTION 'SPEC_VALUE_SOURCE_UNVERIFIED'; END IF;
 v_index := (v_f.payload->>'sourceOrdinal')::integer;
 IF v_index IS NULL OR v_index<1 OR v_index>107
 THEN RAISE EXCEPTION 'SPEC_VALUE_ORDINAL_INVALID'; END IF;
 v_proposal := v_fusion.summary->'proposals'->(v_index-1);
 IF v_proposal IS NULL OR v_proposal->>'quality'<>'CORROBORATED'
    OR v_proposal->>'decision'<>'REVIEW_REQUIRED'
    OR v_proposal->>'reason'<>'BOTH_OFFICIAL_SOURCES_CORROBORATE'
    OR v_proposal->>'concept' IS DISTINCT FROM v_f.proposal->>'sourceLabel'
    OR v_proposal->>'value' IS DISTINCT FROM v_f.proposal->>'rawValue'
    OR v_proposal->>'availability' IS DISTINCT FROM v_f.proposal->>'availability'
    OR v_proposal->>'unit' IS DISTINCT FROM v_f.proposal->>'inputUnit'
 THEN RAISE EXCEPTION 'SPEC_VALUE_EVIDENCE_STALE'; END IF;
 IF p_action IN ('REJECT','POSTPONE') THEN
   IF p_target_spec IS NOT NULL OR p_canonical_input IS NOT NULL
   THEN RAISE EXCEPTION 'SPEC_VALUE_UNEXPECTED_CANONICAL_INPUT'; END IF;
   INSERT INTO public.agent_decision_events(case_id,prior_case_revision,
    snapshot_fingerprint,action,resulting_status,actor_id,idempotency_key,effect_receipt)
   VALUES(v_case.id,v_case.revision,p_fingerprint,p_action,
     CASE WHEN p_action='REJECT' THEN 'REJECTED' ELSE 'POSTPONED' END,
     v_actor,p_idempotency,jsonb_build_object('applied',false)) RETURNING id INTO v_event;
   UPDATE public.agent_review_cases SET status=CASE WHEN p_action='REJECT' THEN 'REJECTED' ELSE 'POSTPONED' END,
    revision=revision+1,updated_at=now() WHERE id=v_case.id;
   RETURN jsonb_build_object('status',p_action,'caseId',v_case.id,'decisionId',v_event,'applied',false);
 END IF;
 v_availability := v_proposal->>'availability';
 IF v_availability NOT IN ('STANDARD','NOT_AVAILABLE') OR
    jsonb_array_length(v_proposal->'evidence')<2
 THEN RAISE EXCEPTION 'SPEC_VALUE_SOURCE_NOT_APPLICABLE'; END IF;
 IF p_action='MERGE' THEN
   IF p_target_spec IS NULL OR p_canonical_input IS NOT NULL
   THEN RAISE EXCEPTION 'SPEC_VALUE_MERGE_TARGET_REQUIRED'; END IF;
   SELECT * INTO v_spec FROM public.specs WHERE id=p_target_spec AND is_active=true FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'SPEC_VALUE_CANONICAL_NOT_FOUND'; END IF;
 ELSE
   IF p_target_spec IS NOT NULL OR
      p_canonical_input IS NULL OR jsonb_typeof(p_canonical_input)<>'object'
   THEN RAISE EXCEPTION 'SPEC_VALUE_CREATE_INPUT_REQUIRED'; END IF;
   IF coalesce(length(btrim(p_canonical_input->>'code')),0)<3 OR
      coalesce(length(btrim(p_canonical_input->>'detail')),0)<3 OR
      coalesce(length(btrim(p_canonical_input->>'group_name')),0)<2 OR
      coalesce(length(btrim(p_canonical_input->>'equipment_group')),0)<2 OR
      coalesce(length(btrim(p_canonical_input->>'spec_set')),0)<2 OR
      p_canonical_input->>'type' NOT IN ('binary','numeric')
   THEN RAISE EXCEPTION 'SPEC_VALUE_CREATE_FIELDS_INCOMPLETE'; END IF;
   INSERT INTO public.specs(code,detail,group_name,equipment_group,spec_set,type,
    unit,display_pt,detail_pt,group_name_pt,equipment_group_pt,spec_set_pt,display_order,
    unit_perceived_value,relative_value,notes)
   VALUES(p_canonical_input->>'code',p_canonical_input->>'detail',
    p_canonical_input->>'group_name',p_canonical_input->>'equipment_group',
    p_canonical_input->>'spec_set',p_canonical_input->>'type',
    NULLIF(p_canonical_input->>'unit',''),NULLIF(p_canonical_input->>'display_pt',''),
    NULLIF(p_canonical_input->>'detail_pt',''),
    NULLIF(p_canonical_input->>'group_name_pt',''),
    NULLIF(p_canonical_input->>'equipment_group_pt',''),
    NULLIF(p_canonical_input->>'spec_set_pt',''),
    NULLIF(p_canonical_input->>'display_order','')::integer,
    coalesce(NULLIF(p_canonical_input->>'unit_perceived_value','')::numeric,0),
    coalesce(NULLIF(p_canonical_input->>'relative_value','')::numeric,0),
    'S27D approved canonical creation; Ford Ranger XLS 2027'
   ) RETURNING * INTO v_spec;
 END IF;
 IF v_spec.type NOT IN ('numeric','binary')
 THEN RAISE EXCEPTION 'SPEC_VALUE_SCALE_NOT_SUPPORTED'; END IF;
 v_kind := v_spec.type;
 v_unit := nullif(btrim(v_proposal->>'unit'),'');
 IF v_kind='numeric' THEN
   IF v_availability<>'STANDARD' OR
      coalesce(v_proposal->>'value','') !~ '^-?[0-9]+([.,][0-9]+)?$' OR
      lower(coalesce(v_unit,''))<>lower(coalesce(v_spec.unit,''))
   THEN RAISE EXCEPTION 'SPEC_VALUE_NUMERIC_OR_UNIT_INVALID'; END IF;
   v_value:=replace(v_proposal->>'value',',','.')::numeric;
   v_is_present:=null;
 ELSE
   IF v_proposal->>'value' IS NOT NULL
   THEN RAISE EXCEPTION 'SPEC_VALUE_BINARY_HAS_NUMBER'; END IF;
   v_value:=null;
   v_is_present:=(v_availability='STANDARD');
 END IF;
 v_target_id:=v_spec.id;
 SELECT * INTO v_existing FROM public.product_specs
  WHERE product_id=1236 AND equipment_id=v_target_id FOR UPDATE;
 IF FOUND AND (v_existing.value IS DISTINCT FROM v_value OR
    v_existing.is_present IS DISTINCT FROM v_is_present OR
    coalesce(lower(v_existing.input_unit),'')<>coalesce(lower(v_unit),''))
 THEN RAISE EXCEPTION 'SPEC_VALUE_EXISTING_PRODUCT_CONFLICT'; END IF;
 v_label:=v_f.proposal->>'sourceLabel';
 v_alias_key:=regexp_replace(lower(btrim(v_label)),'[[:space:]]+',' ','g');
 SELECT target_spec_id INTO v_alias_existing FROM public.spec_field_aliases
   WHERE locale='pt-BR' AND source_context_key='FORD'
    AND value_type=v_kind AND alias_key=v_alias_key AND status='CONFIRMED'
   LIMIT 1;
 IF v_alias_existing IS NOT NULL AND v_alias_existing<>v_target_id
 THEN RAISE EXCEPTION 'SPEC_VALUE_ALIAS_TARGET_CONFLICT'; END IF;
 INSERT INTO public.agent_decision_events(case_id,prior_case_revision,
  snapshot_fingerprint,action,resulting_status,actor_id,idempotency_key,
  canonical_kind,canonical_target_ref,effect_receipt)
 VALUES(v_case.id,v_case.revision,p_fingerprint,p_action,'APPROVED',
  v_actor,p_idempotency,'SPEC_FIELD',v_target_id::text,
  jsonb_build_object('productId',1236,'modelYear',2027,'specId',v_target_id,
    'value',v_value,'isPresent',v_is_present,'sourceFusionRunId',v_fusion.id))
 RETURNING id INTO v_event;
 IF v_alias_existing IS NULL THEN
   INSERT INTO public.spec_field_aliases(locale,category_key,source_context_key,
    value_type,alias,alias_key,target_spec_id,decision_event_id,source_reference,status)
   VALUES('pt-BR',coalesce(nullif(v_spec.spec_set,''),'GENERAL'),'FORD',
    v_kind,v_label,v_alias_key,v_target_id,v_event,
    v_fusion.input->>'htmlUrl','CONFIRMED');
 END IF;
 INSERT INTO public.agent_spec_documents(source_family_key,source_document_key,
  content_sha256,source_authority,source_url,source_captured_at,import_agent_run_id)
 VALUES('FORD_RANGER_XLS_2027','FORD_XLS_MATRIX_'||v_fusion.input->>'pdfRunId',
  v_fusion.input->>'pdfSha256','MANUFACTURER',
  (v_proposal->'evidence'->0)->>'sourceUrl',now(),v_fusion.id)
 ON CONFLICT(source_document_key,content_sha256)
 DO UPDATE SET source_document_key=excluded.source_document_key
 RETURNING id INTO v_doc;
 INSERT INTO public.agent_spec_observations(product_id,model_year,spec_id,
  source_document_id,source_locator,raw_label,raw_value,availability,numeric_value,
  measurement_operator,measurement_method,input_unit,observed_at,confirmation_status,review_case_id)
 VALUES(1236,2027,v_target_id,v_doc,'PDF_PAGE_2:ROW_'||v_index::text,
  v_label,coalesce(v_proposal->>'value',v_availability),
  CASE WHEN v_kind='numeric' THEN null ELSE v_availability END,
  v_value,'=','MANUFACTURER_PDF_HTML',v_unit,now(),'CONFIRMED',v_case.id)
 ON CONFLICT(product_id,model_year,spec_id,source_document_id,source_locator)
 DO UPDATE SET raw_value=excluded.raw_value
 RETURNING id INTO v_obs;
 INSERT INTO public.agent_spec_selected_values(product_id,model_year,spec_id,
  measurement_method,observation_id,is_confirmed)
 VALUES(1236,2027,v_target_id,'MANUFACTURER_PDF_HTML',v_obs,true)
 ON CONFLICT(product_id,model_year,spec_id,measurement_method)
 DO UPDATE SET observation_id=excluded.observation_id,is_confirmed=true,updated_at=now();
 INSERT INTO public.product_specs(product_id,equipment_id,value,is_present,input_unit)
 VALUES(1236,v_target_id,v_value,v_is_present,v_unit)
 ON CONFLICT(product_id,equipment_id) DO NOTHING;
 UPDATE public.agent_review_cases SET status='APPROVED',revision=revision+1,updated_at=now()
   WHERE id=v_case.id;
 INSERT INTO public.agent_reviews(finding_id,decision,note,reviewed_by)
 VALUES(p_finding,'ACCEPT','Spec and product value committed atomically',v_actor);
 RETURN jsonb_build_object('status','APPROVED','caseId',v_case.id,
  'decisionId',v_event,'specId',v_target_id,'value',v_value,'isPresent',v_is_present);
END;
$function$;
REVOKE ALL ON FUNCTION public.s27d_commit_ford_spec_value(uuid,text,bigint,text,bigint,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.s27d_commit_ford_spec_value(uuid,text,bigint,text,bigint,jsonb,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.s27d_commit_ford_spec_value(uuid,text,bigint,text,bigint,jsonb,text) TO authenticated;
