CREATE OR REPLACE FUNCTION public.s26_normalize_mmv_identity(p_item jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $fn$
DECLARE b text; m text; v text; raw_key jsonb; normalized_key text;
BEGIN
 b := btrim(p_item->>'brand'); m := btrim(p_item->>'model');
 v := nullif(btrim(p_item->>'officialVersionLabel'),'');
 IF upper(b)='GWM' THEN
   m := regexp_replace(m,'^GWM[[:space:]]+','','i');
   IF upper(m) IN ('H6','H7','H9') THEN m := 'HAVAL '||upper(m); END IF;
 END IF;
 IF v IS NOT NULL AND lower(v)=lower(m) THEN v:=NULL; END IF;
 IF v IS NOT NULL AND lower(left(v,length(m)+1))=lower(m||' ') THEN
   v:=nullif(btrim(substr(v,length(m)+2)),'');
 END IF;
 raw_key := (p_item->>'identityKey')::jsonb;
 IF jsonb_typeof(raw_key)<>'array' OR jsonb_array_length(raw_key)<>5
 THEN RAISE EXCEPTION 'MMV_IDENTITY_KEY_INVALID'; END IF;
 normalized_key := jsonb_build_array('mmv-current:v2',lower(b),lower(m),
   CASE WHEN v IS NULL THEN NULL ELSE lower(v) END,raw_key->4)::text;
 RETURN jsonb_set(jsonb_set(jsonb_set(jsonb_set(p_item,'{model}',to_jsonb(m),true),
   '{officialVersionLabel}',to_jsonb(v),true),'{trim}',to_jsonb(v),true),
   '{identityKey}',to_jsonb(normalized_key),true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.s26_normalize_mmv_identity(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.s26_normalize_mmv_identity(jsonb) TO service_role;
DO $do$
DECLARE body text;
BEGIN
 SELECT pg_get_functiondef('public.s26_apply_approved_mmv_identity(uuid,text)'::regprocedure) INTO body;
 IF position('INSERT INTO public.catalog_mmvs' in body)=0
 OR position('VALUES (vmarket,p_identity_key' in body)=0
 THEN RAISE EXCEPTION 'MMV_APPLY_CONTRACT_CHANGED'; END IF;
 body:=replace(body,' INSERT INTO public.catalog_mmvs',
   ' item := public.s26_normalize_mmv_identity(item);'||chr(10)||' INSERT INTO public.catalog_mmvs');
 body:=replace(body,'VALUES (vmarket,p_identity_key,','VALUES (vmarket,item->>''identityKey'',');
 EXECUTE body;
END
$do$;
UPDATE public.catalog_mmvs
SET model='HAVAL H6',official_version_label='PHEV19',
 identity_key='["mmv-current:v2","gwm","haval h6","phev19",null]',
 updated_at=now()
WHERE id='1e61c710-60c5-4936-8cac-b3933e1b8f04'
 AND model='H6' AND official_version_label='HAVAL H6 PHEV19';
DO $do$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.catalog_mmvs WHERE id='1e61c710-60c5-4936-8cac-b3933e1b8f04'
 AND model='HAVAL H6' AND official_version_label='PHEV19') THEN
 RAISE EXCEPTION 'H6_REPAIR_NOT_APPLIED'; END IF;
END $do$;