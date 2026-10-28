-- SPRINT 26 / DESIGN DRAFT — NOT IN supabase/migrations; DO NOT APPLY.
-- QA-only proposal. No production change, no backfill and no enabled decision RPC.
-- Must be generated as an official migration with Supabase CLI after contract review.
-- Source of truth: docs/agents/SPRINT_26_CANONICAL_DECISION_CONTRACT_DRAFT.md

BEGIN;

CREATE TABLE public.agent_review_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL UNIQUE,
  case_kind text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('AGENT_PLATFORM','WATCHER')),
  source_ref text NOT NULL,
  source_snapshot_fingerprint text NOT NULL,
  source_observed_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'WAITING'
    CHECK (status IN ('WAITING','APPROVED','REJECTED','POSTPONED')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_review_cases_status_idx
  ON public.agent_review_cases (status, updated_at DESC);

CREATE TABLE public.agent_decision_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.agent_review_cases(id) ON DELETE RESTRICT,
  prior_case_revision bigint NOT NULL CHECK (prior_case_revision > 0),
  snapshot_fingerprint text NOT NULL,
  action text NOT NULL CHECK (action IN ('APPROVE','MERGE','REJECT','POSTPONE')),
  resulting_status text NOT NULL
    CHECK (resulting_status IN ('APPROVED','REJECTED','POSTPONED')),
  actor_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  canonical_kind text NULL
    CHECK (canonical_kind IN ('BRAND','MMV','SPEC_FIELD','SCALE_OPTION')),
  canonical_target_ref text NULL,
  effect_receipt jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text NULL CHECK (note IS NULL OR length(note) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, prior_case_revision),
  CHECK (resulting_status = CASE WHEN action IN ('APPROVE','MERGE')
    THEN 'APPROVED' WHEN action='REJECT' THEN 'REJECTED' ELSE 'POSTPONED' END),
  CHECK (action <> 'MERGE' OR
    (canonical_kind IS NOT NULL AND canonical_target_ref IS NOT NULL))
);
CREATE INDEX agent_decision_events_case_idx
  ON public.agent_decision_events (case_id, created_at DESC);

-- One confirmed alias within a FULL brand/model/powertrain scope can point to one MMV.
-- Merchant trim strings without brand/model scope are never accepted.
CREATE TABLE public.mmv_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market text NOT NULL CHECK (market ~ '^[A-Z]{2}$'),
  brand_key text NOT NULL,
  model_key text NOT NULL,
  commercial_powertrain_key text NOT NULL DEFAULT '',
  alias text NOT NULL,
  alias_key text NOT NULL,
  canonical_mmv_id uuid NOT NULL REFERENCES public.catalog_mmvs(id) ON DELETE RESTRICT,
  decision_event_id uuid NOT NULL REFERENCES public.agent_decision_events(id) ON DELETE RESTRICT,
  source_finding_id uuid NULL REFERENCES public.agent_findings(id) ON DELETE RESTRICT,
  source_reference text NOT NULL, -- watcher event key or agent finding ID
  source_url text NULL,
  status text NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','REVOKED')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  CHECK (length(btrim(alias_key)) > 0 AND length(btrim(alias)) > 0),
  CHECK ((status='CONFIRMED' AND revoked_at IS NULL) OR
         (status='REVOKED' AND revoked_at >= confirmed_at))
);
CREATE UNIQUE INDEX mmv_aliases_active_identity_uq
  ON public.mmv_aliases (
    market, brand_key, model_key, commercial_powertrain_key, alias_key
  ) WHERE status='CONFIRMED';
CREATE INDEX mmv_aliases_target_idx ON public.mmv_aliases(canonical_mmv_id);

-- Explicit stable concept ID. Existing public.specs rows/codes are NOT rewritten.
CREATE TABLE public.spec_scale_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name text NOT NULL,
  equipment_group text NOT NULL,
  spec_set text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_name,equipment_group,spec_set)
);

CREATE TABLE public.spec_scale_family_options (
  family_id uuid NOT NULL REFERENCES public.spec_scale_families(id) ON DELETE RESTRICT,
  spec_id bigint NOT NULL UNIQUE REFERENCES public.specs(id) ON DELETE RESTRICT,
  PRIMARY KEY (family_id, spec_id)
);
-- Before enabling writes, SQL must verify corresponding specs.type='scale' and the
-- exact family structural tuple (via guarded server function/trigger).

CREATE TABLE public.spec_field_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale text NOT NULL,
  category_key text NOT NULL,
  source_context_key text NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('binary','numeric','scale')),
  alias text NOT NULL,
  alias_key text NOT NULL,
  target_spec_id bigint NULL REFERENCES public.specs(id) ON DELETE RESTRICT,
  target_scale_family_id uuid NULL REFERENCES public.spec_scale_families(id) ON DELETE RESTRICT,
  decision_event_id uuid NOT NULL REFERENCES public.agent_decision_events(id) ON DELETE RESTRICT,
  source_reference text NOT NULL,
  status text NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','REVOKED')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  CHECK (length(btrim(alias_key)) > 0 AND length(btrim(alias)) > 0),
  CHECK (
    (value_type IN ('binary','numeric') AND target_spec_id IS NOT NULL
     AND target_scale_family_id IS NULL) OR
    (value_type='scale' AND target_spec_id IS NULL
     AND target_scale_family_id IS NOT NULL)
  ),
  CHECK ((status='CONFIRMED' AND revoked_at IS NULL) OR
         (status='REVOKED' AND revoked_at >= confirmed_at))
);
CREATE UNIQUE INDEX spec_field_aliases_active_uq
  ON public.spec_field_aliases(
    locale, category_key, source_context_key, value_type, alias_key
  ) WHERE status='CONFIRMED';

CREATE TABLE public.spec_scale_option_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  spec_id bigint NOT NULL,
  locale text NOT NULL,
  alias text NOT NULL,
  alias_key text NOT NULL,
  decision_event_id uuid NOT NULL REFERENCES public.agent_decision_events(id) ON DELETE RESTRICT,
  source_reference text NOT NULL,
  status text NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','REVOKED')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  FOREIGN KEY (family_id, spec_id) REFERENCES
    public.spec_scale_family_options(family_id,spec_id) ON DELETE RESTRICT,
  CHECK (length(btrim(alias_key)) > 0 AND length(btrim(alias)) > 0),
  CHECK ((status='CONFIRMED' AND revoked_at IS NULL) OR
         (status='REVOKED' AND revoked_at >= confirmed_at))
);
CREATE UNIQUE INDEX spec_scale_option_aliases_active_uq
  ON public.spec_scale_option_aliases(family_id,locale,alias_key)
  WHERE status='CONFIRMED';

-- Server-only; no policies for anon or authenticated.
ALTER TABLE public.agent_review_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_decision_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mmv_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_scale_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_scale_family_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_field_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_scale_option_aliases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.agent_review_cases, public.agent_decision_events,
  public.mmv_aliases, public.spec_scale_families, public.spec_scale_family_options,
  public.spec_field_aliases, public.spec_scale_option_aliases
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agent_review_cases,
  public.mmv_aliases, public.spec_field_aliases, public.spec_scale_option_aliases
  TO service_role;
GRANT SELECT, INSERT ON public.agent_decision_events,
  public.spec_scale_families, public.spec_scale_family_options TO service_role;

COMMIT;

-- REQUIRED BEFORE APPLY / not implemented here:
-- 1. DB transaction RPC with actor reauthentication, case row lock, source review
--    optimistic CAS, canonical mutation/alias and decision event in one commit.
-- 2. SQL enforcement of spec type + scale family/option structural correspondence.
-- 3. Validate existing specs scale family option/baseline consistency; prepare a
--    separately approved, audited idempotent backfill for existing scale rows.
-- 4. Recheck canonical target scope and brand aliases, never global fuzzy matching.
-- 5. Integration tests for replay, concurrency, stale revisions, rollback and RLS.
-- 6. Audit existing DEFAULT PRIVILEGES on exposed schema.
