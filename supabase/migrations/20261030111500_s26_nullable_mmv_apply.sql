-- Sprint 26: upgrade the existing guarded MMV apply RPC for unnamed commercial versions.
-- Keep authorization, review, fingerprint, stale-proposal and FIPE provenance gates intact.
DO $migration$
DECLARE
  body text;
BEGIN
  SELECT pg_get_functiondef('public.apply_catalog_mmvs(uuid,uuid,jsonb,text)'::regprocedure) INTO body;
  IF body IS NULL
    OR position('or coalesce(length(btrim(v_version)), 0) not between 1 and 200' in body) = 0
    OR position('btrim(v_model), btrim(v_version),' in body) = 0
    OR position('existing.official_version_label is distinct from btrim(v_version)' in body) = 0
    OR position('lower(btrim(v_version))' in body) = 0
  THEN RAISE EXCEPTION 'MMV_APPLY_CONTRACT_CHANGED'; END IF;

  body := replace(body,
    'or coalesce(length(btrim(v_version)), 0) not between 1 and 200',
    'or (v_version is not null and coalesce(length(btrim(v_version)), 0) not between 1 and 200)');
  body := replace(body,
    'btrim(v_model), btrim(v_version),',
    'btrim(v_model), nullif(btrim(v_version), ''''),');
  body := replace(body,
    'existing.official_version_label is distinct from btrim(v_version)',
    'existing.official_version_label is distinct from nullif(btrim(v_version), '''')');
  -- No version name => no accidental FIPE mapping by a fabricated label.
  body := replace(body,
    'lower(btrim(value->>''manufacturerVersionLabel'')) = lower(btrim(v_version))',
    'v_version is not null and lower(btrim(value->>''manufacturerVersionLabel'')) = lower(btrim(v_version))');
  EXECUTE body;
END;
$migration$;
