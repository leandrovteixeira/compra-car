-- Sprint 26: structural preparation for commercial MMVs with no marketed version name.
-- A NULL means "no independent version designation"; never synthesize a trim from FIPE or engine.
-- Existing rows and their identity keys are untouched. The approved apply RPC remains
-- fail-closed for NULL until its validation, fingerprint and reconciliation contract is upgraded.
ALTER TABLE public.catalog_mmvs ALTER COLUMN official_version_label DROP NOT NULL;
-- Existing constraint accepts NULL by PostgreSQL CHECK semantics. Make intent explicit.
ALTER TABLE public.catalog_mmvs DROP CONSTRAINT IF EXISTS catalog_mmvs_official_version_label_check;
ALTER TABLE public.catalog_mmvs ADD CONSTRAINT catalog_mmvs_official_version_label_check
  CHECK (official_version_label IS NULL OR
    (length(btrim(official_version_label)) BETWEEN 1 AND 200));
