-- Individual MMV decisions: immutable per-identity receipts; no catalog writes.
CREATE TABLE IF NOT EXISTS public.agent_mmv_identity_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES public.agent_findings(id),
  identity_key text NOT NULL CHECK (length(identity_key) BETWEEN 1 AND 2000),
  finding_fingerprint text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('ACCEPT','REJECT','DEFER')),
  reviewed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_mmv_identity_reviews_latest_idx
ON public.agent_mmv_identity_reviews(finding_id,identity_key,created_at DESC,id DESC);
ALTER TABLE public.agent_mmv_identity_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_mmv_identity_reviews FROM anon,authenticated;
