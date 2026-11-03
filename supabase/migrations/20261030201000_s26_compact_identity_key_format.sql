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
 normalized_key := format('[%s,%s,%s,%s,%s]',
   to_json('mmv-current:v2'::text)::text,
   to_json(lower(b))::text,to_json(lower(m))::text,
   CASE WHEN v IS NULL THEN 'null' ELSE to_json(lower(v))::text END,
   (raw_key->4)::text);
 RETURN jsonb_set(jsonb_set(jsonb_set(jsonb_set(p_item,'{model}',to_jsonb(m),true),
   '{officialVersionLabel}',to_jsonb(v),true),'{trim}',to_jsonb(v),true),
   '{identityKey}',to_jsonb(normalized_key),true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.s26_normalize_mmv_identity(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.s26_normalize_mmv_identity(jsonb) TO service_role;