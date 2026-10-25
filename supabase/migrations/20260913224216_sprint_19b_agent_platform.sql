-- Agent operational data only. Review decisions never execute canonical proposals.
create table public.agent_runs (
 id uuid primary key,
 agent_type text not null check (agent_type in ('BRAND_CONNECTOR','MMV_DISCOVERY','PRODUCT_YEAR','SPEC_INTELLIGENCE','PRICE_INTELLIGENCE')),
 status text not null check (status in ('RUNNING','COMPLETED','FAILED','CANCELLED')),
 market text, brand text, provider text, run_mode text, schema_version text,
 started_at timestamptz not null, completed_at timestamptz,
 input jsonb not null default '{}'::jsonb,
 summary jsonb not null default '{}'::jsonb,
 config_snapshot jsonb not null default '{}'::jsonb,
 error jsonb, source_commit_sha text, created_by uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint agent_runs_completion_check check (status <> 'COMPLETED' or completed_at is not null),
 constraint agent_runs_time_check check (completed_at is null or completed_at >= started_at)
);
create index agent_runs_type_created_idx on public.agent_runs(agent_type, created_at desc);
create index agent_runs_status_created_idx on public.agent_runs(status, created_at desc);
create table public.agent_findings (
 id uuid primary key, run_id uuid not null references public.agent_runs(id) on delete cascade,
 finding_type text not null check (btrim(finding_type) <> ''),
 fingerprint text not null check (btrim(fingerprint) <> ''), subject_key text,
 title text not null check (btrim(title) <> ''), summary text,
 confidence numeric check (confidence between 0 and 1),
 requires_review boolean not null default true,
 subject jsonb not null default '{}'::jsonb, proposal jsonb,
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint agent_findings_run_fingerprint_key unique(run_id, fingerprint)
);
-- The unique index already covers run_id; no redundant index.
create index agent_findings_type_idx on public.agent_findings(finding_type);
create index agent_findings_review_idx on public.agent_findings(requires_review);
create index agent_findings_created_idx on public.agent_findings(created_at desc);
create index agent_findings_fingerprint_idx on public.agent_findings(fingerprint);
create table public.agent_evidence (
 id uuid primary key, finding_id uuid not null references public.agent_findings(id) on delete cascade,
 source_type text not null check (btrim(source_type) <> ''), source_url text not null,
 source_domain text, title text check (length(title) <= 500), excerpt text check (length(excerpt) <= 1000),
 evidence_fingerprint text not null check (btrim(evidence_fingerprint) <> ''),
 metadata jsonb not null default '{}'::jsonb,
 captured_at timestamptz, created_at timestamptz not null default now(),
 constraint agent_evidence_finding_fingerprint_key unique(finding_id, evidence_fingerprint)
);
-- The evidence unique index covers finding_id.
create table public.agent_reviews (
 id uuid primary key, finding_id uuid not null references public.agent_findings(id) on delete cascade,
 decision text not null check (decision in ('ACCEPT','REJECT','DEFER')),
 note text check (length(note) <= 4000), reviewed_by uuid,
 created_at timestamptz not null default now()
);
create index agent_reviews_finding_created_idx on public.agent_reviews(finding_id, created_at desc, id desc);
comment on table public.agent_reviews is 'Append-only human decisions. ACCEPT never executes a proposal or changes the catalog.';
comment on column public.agent_findings.payload is 'Compact structured details; evidence belongs in agent_evidence.';
alter table public.agent_runs enable row level security;
alter table public.agent_findings enable row level security;
alter table public.agent_evidence enable row level security;
alter table public.agent_reviews enable row level security;
-- Revoke inherited baseline grants. Browser roles have no policies or access.
revoke all privileges on table public.agent_runs, public.agent_findings, public.agent_evidence, public.agent_reviews from public, anon, authenticated, service_role;
grant select, insert, update on table public.agent_runs to service_role;
-- Even unfinished observations are insert-only; identity conflicts never overwrite content.
grant select, insert on table public.agent_findings, public.agent_evidence, public.agent_reviews to service_role;
