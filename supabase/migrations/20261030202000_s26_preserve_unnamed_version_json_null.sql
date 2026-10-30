DO $do$
DECLARE body text;
BEGIN
 SELECT pg_get_functiondef('public.s26_normalize_mmv_identity(jsonb)'::regprocedure) INTO body;
 IF position($s$'{officialVersionLabel}',to_jsonb(v),true$s$ in body)=0 OR
    position($s$'{trim}',to_jsonb(v),true$s$ in body)=0
 THEN RAISE EXCEPTION 'MMV_NORMALIZER_CONTRACT_CHANGED'; END IF;
 body:=replace(body,$s$'{officialVersionLabel}',to_jsonb(v),true$s$,
   $s$'{officialVersionLabel}',coalesce(to_jsonb(v),'null'::jsonb),true$s$);
 body:=replace(body,$s$'{trim}',to_jsonb(v),true$s$,
   $s$'{trim}',coalesce(to_jsonb(v),'null'::jsonb),true$s$);
 EXECUTE body;
END $do$;