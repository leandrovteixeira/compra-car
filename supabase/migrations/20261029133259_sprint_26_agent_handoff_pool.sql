-- Sprint 26 / QA ONLY. Durable agent-to-agent handoffs without paid dispatch.
-- A handoff is NOT a human review, nor a canonical catalog write.
CREATE TABLE public.agent_handoff_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL CHECK (task_type IN
    ('RESOLVE_MMV_IDENTITY','DISCOVER_BRAND','DISCOVER_MMV','VERIFY_MODEL_YEAR','VERIFY_PRICE')),
  source_agent text NOT NULL,
  target_agent text NOT NULL,
  market text NOT NULL CHECK (market ~ '^[A-Z]{2}$'),
  brand text NOT NULL,
  model text NOT NULL DEFAULT '',
  version_label text NOT NULL DEFAULT '',
  brand_key text NOT NULL,
  model_key text NOT NULL DEFAULT '',
  version_key text NOT NULL DEFAULT '',
  semantic_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'QUEUED' CHECK
    (status IN ('QUEUED','CLAIMED','BLOCKED','COMPLETED','EXHAUSTED','CANCELLED')),
  dispatch_enabled boolean NOT NULL DEFAULT false,
  priority smallint NOT NULL DEFAULT 50 CHECK(priority BETWEEN 0 AND 100),
  attempts smallint NOT NULL DEFAULT 0 CHECK(attempts>=0),
  max_attempts smallint NOT NULL DEFAULT 2 CHECK(max_attempts BETWEEN 1 AND 3),
  claim_owner text,
  lease_until timestamptz,
  next_eligible_at timestamptz NOT NULL DEFAULT now(),
  latest_finding_id uuid NOT NULL REFERENCES public.agent_findings(id) ON DELETE RESTRICT,
  latest_fingerprint text NOT NULL,
  last_error_code text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='CLAIMED' AND claim_owner IS NOT NULL AND lease_until IS NOT NULL)
     OR (status<>'CLAIMED' AND claim_owner IS NULL AND lease_until IS NULL))
);
CREATE INDEX agent_handoff_tasks_dispatch_idx
 ON public.agent_handoff_tasks(status,dispatch_enabled,next_eligible_at,priority DESC,created_at)
 WHERE status IN('QUEUED','CLAIMED');
CREATE INDEX agent_handoff_tasks_origin_idx
 ON public.agent_handoff_tasks(source_agent,market,brand_key,model_key);
CREATE TABLE public.agent_handoff_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.agent_handoff_tasks(id) ON DELETE RESTRICT,
  source_finding_id uuid NOT NULL REFERENCES public.agent_findings(id) ON DELETE RESTRICT,
  source_run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE RESTRICT,
  evidence_fingerprint text NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_finding_id)
);
CREATE INDEX agent_handoff_observations_task_idx
 ON public.agent_handoff_observations(task_id,observed_at DESC);

-- Emits task records only AFTER a Product Year run is completed. Never calls an agent.
-- Same semantic identity -> one task with many immutable observations.
CREATE FUNCTION public.s26_enqueue_model_year_handoffs()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $fn$
DECLARE
 f public.agent_findings;
 v_brand text; v_model text; v_version text;
 b text; m text; v text;
 sk text; tid uuid;
BEGIN
 IF NEW.status<>'COMPLETED' OR OLD.status='COMPLETED'
    OR NEW.agent_type<>'PRODUCT_YEAR' THEN RETURN NEW; END IF;
 FOR f IN SELECT * FROM public.agent_findings
     WHERE run_id=NEW.id AND finding_type='POSSIBLE_NEW_MMV'
       AND payload->>'reasonCode'='POSSIBLE_NEW_MMV'
       AND requires_review=true
 LOOP
   v_brand:=nullif(btrim(f.subject->>'brand'),'');
   v_model:=nullif(btrim(f.subject->>'model'),'');
   v_version:=nullif(btrim(f.subject->>'officialVersionLabel'),'');
   IF v_brand IS NULL OR v_model IS NULL OR v_version IS NULL OR
      length(v_brand)>120 OR length(v_model)>200 OR length(v_version)>200
   THEN CONTINUE; END IF;
   b:=lower(btrim(pg_catalog.regexp_replace(public.unaccent(v_brand),
      '[^a-zA-Z0-9]+',' ','g')));
   m:=lower(btrim(pg_catalog.regexp_replace(public.unaccent(v_model),
      '[^a-zA-Z0-9]+',' ','g')));
   v:=lower(btrim(pg_catalog.regexp_replace(public.unaccent(v_version),
      '[^a-zA-Z0-9]+',' ','g')));
   IF b='' OR m='' OR v='' THEN CONTINUE; END IF;
   IF b='vw' THEN b:='volkswagen'; END IF;
   sk:=pg_catalog.jsonb_build_array('RESOLVE_MMV_IDENTITY',NEW.market,b,m,v)::text;
   INSERT INTO public.agent_handoff_tasks(
     task_type,source_agent,target_agent,market,brand,model,version_label,
     brand_key,model_key,version_key,semantic_key,latest_finding_id,
     latest_fingerprint
   ) VALUES (
     'RESOLVE_MMV_IDENTITY','PRODUCT_YEAR','MMV_DISCOVERY',NEW.market,
     v_brand,v_model,v_version,b,m,v,sk,f.id,f.fingerprint
   )
   ON CONFLICT(semantic_key) DO UPDATE
     SET latest_finding_id=excluded.latest_finding_id,
         latest_fingerprint=excluded.latest_fingerprint,
         updated_at=now()
     WHERE public.agent_handoff_tasks.status NOT IN ('COMPLETED','CANCELLED')
   RETURNING id INTO tid;
   IF tid IS NULL THEN
     SELECT id INTO tid FROM public.agent_handoff_tasks WHERE semantic_key=sk;
   END IF;
   INSERT INTO public.agent_handoff_observations(
     task_id,source_finding_id,source_run_id,evidence_fingerprint,observed_at)
   VALUES(tid,f.id,NEW.id,f.fingerprint,f.created_at)
   ON CONFLICT(source_finding_id) DO NOTHING;
 END LOOP;
 RETURN NEW;
END;
$fn$;
CREATE TRIGGER s26_product_year_dependency_intake
 AFTER UPDATE OF status ON public.agent_runs FOR EACH ROW
 WHEN (NEW.status='COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION public.s26_enqueue_model_year_handoffs();

-- Only an exact brand/model/version canonical identity resolves a handoff.
-- No inference from suffixes, shape or fuzzy matching.
CREATE FUNCTION public.s26_complete_matching_mmv_handoffs()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $fn$
DECLARE
 b text; m text; v text;
BEGIN
 IF NEW.status<>'ACTIVE' THEN RETURN NEW; END IF;
 b:=lower(btrim(pg_catalog.regexp_replace(public.unaccent(NEW.brand),
     '[^a-zA-Z0-9]+',' ','g')));
 m:=lower(btrim(pg_catalog.regexp_replace(public.unaccent(NEW.model),
     '[^a-zA-Z0-9]+',' ','g')));
 v:=lower(btrim(pg_catalog.regexp_replace(public.unaccent(NEW.official_version_label),
     '[^a-zA-Z0-9]+',' ','g')));
 IF b='vw' THEN b:='volkswagen'; END IF;
 UPDATE public.agent_handoff_tasks h
   SET status='COMPLETED',completed_at=now(),updated_at=now(),
       claim_owner=NULL,lease_until=NULL,last_error_code=NULL
 WHERE task_type='RESOLVE_MMV_IDENTITY'
   AND market=NEW.market AND brand_key=b AND model_key=m AND version_key=v
   AND status IN('QUEUED','BLOCKED','EXHAUSTED');
 RETURN NEW;
END;
$fn$;
CREATE TRIGGER s26_canonical_mmv_handoff_resolution
 AFTER INSERT OR UPDATE OF status ON public.catalog_mmvs FOR EACH ROW
 EXECUTE FUNCTION public.s26_complete_matching_mmv_handoffs();

ALTER TABLE public.agent_handoff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_handoff_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_handoff_tasks,public.agent_handoff_observations
 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.agent_handoff_tasks TO service_role;
GRANT SELECT,INSERT ON public.agent_handoff_observations TO service_role;
REVOKE ALL ON FUNCTION public.s26_enqueue_model_year_handoffs() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.s26_complete_matching_mmv_handoffs() FROM PUBLIC,anon,authenticated;
-- Intentionally NO dispatcher, no worker subscription, no AI execution.
