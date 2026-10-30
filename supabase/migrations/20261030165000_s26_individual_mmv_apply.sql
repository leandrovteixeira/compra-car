-- Sprint 26: individual approval-gated MMV application.
CREATE OR REPLACE FUNCTION public.s26_apply_approved_mmv_identity(p_finding uuid, p_identity_key text)
 RETURNS catalog_mmvs
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 f public.agent_findings;
 r public.agent_runs;
 item jsonb;
 receipt public.agent_mmv_identity_reviews;
 stored public.catalog_mmvs;
 vmarket text;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_finding::text, 19));
 SELECT * INTO f FROM public.agent_findings WHERE id=p_finding FOR UPDATE;
 IF NOT FOUND OR f.finding_type NOT IN ('NEW_MODEL','NEW_VERSION')
    OR f.proposal->>'action' IS DISTINCT FROM 'STAGE_MMV_IDENTITIES'
    OR jsonb_typeof(f.proposal->'identities') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'MMV_IDENTITY_NOT_ELIGIBLE'; END IF;
 SELECT * INTO r FROM public.agent_runs WHERE id=f.run_id;
 IF NOT FOUND OR r.agent_type <> 'MMV_DISCOVERY' OR r.status <> 'COMPLETED'
 THEN RAISE EXCEPTION 'MMV_RUN_NOT_ELIGIBLE'; END IF;
 IF EXISTS (
 SELECT 1 FROM public.agent_findings newer
 JOIN public.agent_runs nr ON nr.id=newer.run_id
 WHERE newer.id<>f.id AND newer.subject_key IS NOT DISTINCT FROM f.subject_key
 AND newer.created_at>f.created_at AND nr.agent_type='MMV_DISCOVERY' AND nr.status='COMPLETED'
 ) THEN RAISE EXCEPTION 'MMV_STALE_PROPOSAL'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(f.proposal->'identities') x
 WHERE x->>'identityKey'=p_identity_key)<>1
 THEN RAISE EXCEPTION 'MMV_IDENTITY_NOT_UNIQUE'; END IF;
 SELECT x INTO item FROM jsonb_array_elements(f.proposal->'identities') x
 WHERE x->>'identityKey'=p_identity_key;
 SELECT * INTO receipt FROM public.agent_mmv_identity_reviews
 WHERE finding_id=f.id AND identity_key=p_identity_key
 ORDER BY created_at DESC,id DESC LIMIT 1;
 IF NOT FOUND OR receipt.decision <> 'ACCEPT'
 OR receipt.finding_fingerprint IS DISTINCT FROM f.fingerprint
 THEN RAISE EXCEPTION 'MMV_IDENTITY_NOT_APPROVED'; END IF;
 vmarket=f.proposal->>'market';
 IF vmarket IS DISTINCT FROM r.market OR vmarket !~ '^[A-Z]{2}$'
 OR coalesce(length(btrim(item->>'brand')),0) NOT BETWEEN 1 AND 120
 OR coalesce(length(btrim(item->>'model')),0) NOT BETWEEN 1 AND 200
 OR coalesce(length(p_identity_key),0) NOT BETWEEN 1 AND 2000
 OR (item->>'officialVersionLabel' IS NOT NULL AND
     coalesce(length(btrim(item->>'officialVersionLabel')),0) NOT BETWEEN 1 AND 200)
 THEN RAISE EXCEPTION 'MMV_IDENTITY_INVALID'; END IF;
 INSERT INTO public.catalog_mmvs(market,identity_key,brand,model,official_version_label,
 body_style,powertrain_label,propulsion,engine_displacement,source_finding_id,last_confirmed_finding_id,created_by)
 VALUES (vmarket,p_identity_key,btrim(item->>'brand'),btrim(item->>'model'),
 nullif(btrim(item->>'officialVersionLabel'),''),
 nullif(btrim(item->>'bodyStyle'),''),nullif(btrim(item->>'powertrainLabel'),''),
 nullif(btrim(item->>'propulsion'),''),(item->>'engineDisplacement')::numeric,
 f.id,f.id,receipt.reviewed_by)
 ON CONFLICT (market,identity_key) DO UPDATE SET
 last_confirmed_finding_id=EXCLUDED.last_confirmed_finding_id,updated_at=now()
 RETURNING * INTO stored;
 IF stored.brand IS DISTINCT FROM btrim(item->>'brand')
 OR stored.model IS DISTINCT FROM btrim(item->>'model')
 OR stored.official_version_label IS DISTINCT FROM nullif(btrim(item->>'officialVersionLabel'),'')
 OR stored.powertrain_label IS DISTINCT FROM nullif(btrim(item->>'powertrainLabel'),'')
 OR stored.propulsion IS DISTINCT FROM nullif(btrim(item->>'propulsion'),'')
 OR stored.engine_displacement IS DISTINCT FROM (item->>'engineDisplacement')::numeric
 THEN RAISE EXCEPTION 'MMV_IDENTITY_COLLISION'; END IF;
 RETURN stored;
END;
$function$

REVOKE ALL ON FUNCTION public.s26_apply_approved_mmv_identity(uuid,text) FROM PUBLIC,anon,authenticated;
