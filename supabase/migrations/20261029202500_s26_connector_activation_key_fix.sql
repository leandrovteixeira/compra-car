-- Sprint 26: fix ambiguous PL/pgSQL variable in connector activation.
-- Keep the existing activation checks, audit trail and permissions unchanged.
DO $$
DECLARE
 d text;
BEGIN
 SELECT pg_get_functiondef('public.activate_brand_connector(uuid,uuid,uuid,jsonb,text)'::regprocedure) INTO d;
 IF position('v_canonical_key text;' in d)>0 THEN RETURN; END IF;
 IF position('canonical_key text;' in d)=0 THEN
   RAISE EXCEPTION 'UNEXPECTED_FUNCTION_DEFINITION';
 END IF;
 d:=replace(d,'canonical_key text;','v_canonical_key text;');
 d:=replace(d,'canonical_key := lower(canonical_name);','v_canonical_key := lower(canonical_name);');
 d:=replace(d,'t.market, canonical_name, canonical_key, f.id, p_actor','t.market, canonical_name, v_canonical_key, f.id, p_actor');
 EXECUTE d;
END $$;
