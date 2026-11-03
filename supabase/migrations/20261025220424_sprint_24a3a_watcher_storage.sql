-- Sprint 24A.3a: LOCAL REVIEW ONLY. Do not apply to QA/production in this increment.
-- No canonical catalogue dependencies, backfill, seeds, schedulers or browser access.
begin;
create function public.watcher_text_ok(v text, max_length integer) returns boolean
language sql immutable security invoker set search_path = '' as $$
 select v is not null and length(btrim(v)) > 0 and length(v)+length(regexp_replace(v,U&'[^\+010000-\+10FFFF]','','g')) <= max_length and v !~ '[[:cntrl:]]';
$$;
create function public.watcher_exact_object(v jsonb, fields text[]) returns boolean
language sql immutable security invoker set search_path = '' as $$
 select jsonb_typeof(v) = 'object' and v ?& fields and v - fields = '{}'::jsonb;
$$;
create function public.watcher_url_ok(v text) returns boolean
language sql immutable security invoker set search_path = '' as $$
 select public.watcher_text_ok(v,2048) and v ~ '^https://[a-z0-9][a-z0-9.-]*\.[a-z][a-z0-9-]*(/|[?]|$)' and v !~ '[[:space:]\\#]' and split_part(split_part(v,'://',2),'/',1) !~ '@';
$$;
create function public.watcher_hosts_ok(v jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare h jsonb;
begin
 if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) not between 1 and 20 then return false; end if;
 for h in select value from jsonb_array_elements(v) loop
  if jsonb_typeof(h) <> 'string' or not public.watcher_url_ok('https://' || (h #>> '{}') || '/') or (h #>> '{}') ~ '[/?:@]' then return false; end if;
 end loop;
 return true;
end $$;
create function public.watcher_strings_ok(v jsonb, required text[], nullable text[]) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare k text;
begin
 foreach k in array required loop if jsonb_typeof(v->k) is distinct from 'string' then return false; end if; end loop;
 foreach k in array nullable loop if jsonb_typeof(v->k) not in ('string','null') or not(v?k) then return false; end if; end loop;
 return true;
end $$;
create function public.watcher_aliases_ok(v jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare a jsonb;
begin
 if jsonb_typeof(v) is distinct from 'array' then return false; end if;
 if jsonb_array_length(v)>20 then return false; end if;
 for a in select value from jsonb_array_elements(v) loop if jsonb_typeof(a)<>'string' or public.watcher_text_ok(a#>>'{}',100) is not true then return false; end if; end loop;
 return true;
end $$;
create table public.watcher_sources (
 id text primary key check (public.watcher_text_ok(id,200)),
 feed_url text not null unique check (public.watcher_url_ok(feed_url)),
 definition jsonb not null check(coalesce((public.watcher_exact_object(definition,array['id','feedUrl','editorialMarket','language','sourceRank','enabled']) and public.watcher_strings_ok(definition,array['id','feedUrl','editorialMarket','language'],array[]::text[]) and jsonb_typeof(definition->'sourceRank')='number' and definition->>'id'=id and definition->>'feedUrl'=feed_url and definition->>'editorialMarket' in ('BR','GLOBAL') and public.watcher_text_ok(definition->>'language',35) and (definition->>'sourceRank')::bigint between 0 and 9007199254740991 and jsonb_typeof(definition->'enabled')='boolean'),false)),
 settings jsonb not null check(coalesce((public.watcher_exact_object(settings,array['requestUrl','allowedHosts','allowedArticleHosts','allowRelativeUrls','pollIntervalSeconds']) and public.watcher_strings_ok(settings,array['requestUrl'],array[]::text[]) and jsonb_typeof(settings->'pollIntervalSeconds')='number' and public.watcher_url_ok(settings->>'requestUrl') and public.watcher_hosts_ok(settings->'allowedHosts') and public.watcher_hosts_ok(settings->'allowedArticleHosts') and jsonb_typeof(settings->'allowRelativeUrls')='boolean' and (settings->>'pollIntervalSeconds')::integer between 60 and 86400),false)),
 config_version bigint not null default 1 check (config_version > 0),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create table public.watcher_source_state (
 source_id text primary key references public.watcher_sources(id) on delete restrict,
 state_version bigint not null default 0 check (state_version >= 0),
 etag text check (etag is null or public.watcher_text_ok(etag,1024)),
 last_modified text check (last_modified is null or public.watcher_text_ok(last_modified,128)),
 last_successful_observed_at timestamptz, last_attempt_at timestamptz,
 consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
 last_failure_code text check (last_failure_code in ('TIMEOUT','UNAVAILABLE','LIMIT_EXCEEDED','INVALID_FEED','INVALID_ITEM','CONFLICT','PERSISTENCE_FAILED','LEASE_EXPIRED')),
 lease_token uuid, lease_owner text check (lease_owner is null or public.watcher_text_ok(lease_owner,200)), lease_expires_at timestamptz,
 check ((lease_token is null and lease_owner is null and lease_expires_at is null) or (lease_token is not null and lease_owner is not null and lease_expires_at is not null)),
 check (last_successful_observed_at is null or last_successful_observed_at <= last_attempt_at)
);
create index watcher_source_state_lease_idx on public.watcher_source_state(lease_expires_at) where lease_token is not null;
create table public.watcher_batches (
 id uuid primary key, source_id text not null references public.watcher_sources(id) on delete restrict,
 source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object' and octet_length(source_snapshot::text)<=32768),
 config_version bigint not null check(config_version>0), payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null, status text not null check(status in ('COMMITTED','PARTIAL','FAILED')),
 checkpoint_advanced boolean not null, state_version bigint not null check(state_version>0),
 failures jsonb not null check(jsonb_typeof(failures)='array' and jsonb_array_length(failures)<=100),
 diagnostics jsonb not null check(jsonb_typeof(diagnostics)='array' and jsonb_array_length(diagnostics)<=301),
 blocked_reason text check(blocked_reason in ('CONFLICT','LIMIT_EXCEEDED')),
 committed_at timestamptz not null default clock_timestamp(),
 check(checkpoint_advanced = (status='COMMITTED'))
);
create index watcher_batches_source_observed_idx on public.watcher_batches(source_id,observed_at desc,id);
create table public.watcher_articles (
 id uuid primary key default gen_random_uuid(), canonical_url text not null unique check(public.watcher_url_ok(canonical_url)),
 canonicalization_version text not null default 'watcher-url/1' check(canonicalization_version='watcher-url/1'),
 first_seen_at timestamptz not null, last_seen_at timestamptz not null, check(first_seen_at<=last_seen_at)
);
create index watcher_articles_last_seen_idx on public.watcher_articles(last_seen_at desc,id);
create table public.watcher_feed_items (
 id uuid primary key, source_id text not null references public.watcher_sources(id) on delete restrict,
 item_key text not null check(item_key ~ '^watcher-item/1:sha256:[a-f0-9]{64}$'), guid text check(guid is null or public.watcher_text_ok(guid,2048)),
 article_id uuid not null references public.watcher_articles(id) on delete restrict,
 current_revision_id uuid not null, current_observed_at timestamptz not null check(isfinite(current_observed_at)),
 first_seen_at timestamptz not null, last_seen_at timestamptz not null, check(first_seen_at<=last_seen_at),
 check(first_seen_at<=current_observed_at and current_observed_at<=last_seen_at),
 unique(source_id,item_key)
);
create index watcher_feed_items_article_idx on public.watcher_feed_items(article_id);
create table public.watcher_article_revisions (
 id uuid primary key, article_id uuid not null references public.watcher_articles(id) on delete restrict,
 feed_item_id uuid not null references public.watcher_feed_items(id) on delete restrict,
 evidence_fingerprint text not null check(evidence_fingerprint ~ '^watcher-evidence/1:sha256:[a-f0-9]{64}$'),
 item_payload jsonb not null check(coalesce((public.watcher_exact_object(item_payload,array['sourceId','guid','url','title','excerpt','publishedAt','updatedAt']) and public.watcher_strings_ok(item_payload,array['sourceId','url','title'],array['guid','excerpt','publishedAt','updatedAt']) and public.watcher_text_ok(item_payload->>'sourceId',200) and public.watcher_url_ok(item_payload->>'url') and public.watcher_text_ok(item_payload->>'title',500) and (item_payload->>'excerpt' is null or public.watcher_text_ok(item_payload->>'excerpt',1000)) and (item_payload->>'guid' is null or public.watcher_text_ok(item_payload->>'guid',2048))),false)),
 first_observed_at timestamptz not null, created_at timestamptz not null default clock_timestamp(),
 unique(feed_item_id,evidence_fingerprint), unique(id,feed_item_id,article_id)
);
create index watcher_revisions_article_idx on public.watcher_article_revisions(article_id,first_observed_at desc,id);
alter table public.watcher_feed_items add constraint watcher_feed_current_revision_fk foreign key(current_revision_id,id,article_id)
 references public.watcher_article_revisions(id,feed_item_id,article_id) deferrable initially deferred;
create table public.watcher_batch_items (
 batch_id uuid not null references public.watcher_batches(id) on delete restrict,
 feed_item_id uuid not null references public.watcher_feed_items(id) on delete restrict,
 revision_id uuid not null references public.watcher_article_revisions(id) on delete restrict,
 observed_at timestamptz not null, decision text not null check(decision in ('NEW','UPDATED','UNCHANGED')),
 primary key(batch_id,feed_item_id)
);
create index watcher_batch_items_revision_idx on public.watcher_batch_items(revision_id);
create index watcher_batch_items_feed_idx on public.watcher_batch_items(feed_item_id);
create table public.watcher_candidates (
 id uuid primary key, identity_key text not null unique check(identity_key ~ '^watcher-candidate/1:sha256:[a-f0-9]{64}$'),
 brand text not null check(public.watcher_text_ok(brand,100)), market text not null default 'BR' check(market='BR'),
 model_hint text check(model_hint is null or public.watcher_text_ok(model_hint,100)), project_code text check(project_code is null or public.watcher_text_ok(project_code,100)),
 aliases jsonb not null check(public.watcher_aliases_ok(aliases)),
 status text not null check(status in ('OBSERVED','EXPECTED_BR','DISMISSED')), version bigint not null default 1 check(version>0),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check(model_hint is not null or project_code is not null)
);
create index watcher_candidates_status_idx on public.watcher_candidates(status,updated_at desc,id);
create table public.watcher_candidate_evidence (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.watcher_candidates(id) on delete restrict,
 revision_id uuid not null references public.watcher_article_revisions(id) on delete restrict,
 candidate_version bigint not null check(candidate_version>0),
 candidate_snapshot jsonb not null check(coalesce(jsonb_typeof(candidate_snapshot)='object' and (candidate_snapshot->>'version')::bigint=candidate_version,false)),
 assertion text not null check(assertion in ('MENTION','BR_EXPECTED','BR_CONFIRMED')), actor_id uuid, note text not null check(public.watcher_text_ok(note,1000)),
 created_at timestamptz not null default clock_timestamp(), unique(candidate_id,candidate_version,revision_id,assertion),
 check(assertion<>'BR_CONFIRMED' or actor_id is not null), unique(id,candidate_id,candidate_version)
);
create index watcher_candidate_evidence_revision_idx on public.watcher_candidate_evidence(revision_id);
create table public.watcher_hints (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.watcher_candidates(id) on delete restrict,
 candidate_version bigint not null check(candidate_version>0), evidence_id uuid not null,
 payload jsonb not null check(coalesce((public.watcher_exact_object(payload,array['schemaVersion','watcherCandidateId','brand','market','modelHint','projectCode','aliases','evidenceFingerprint']) and public.watcher_strings_ok(payload,array['schemaVersion','watcherCandidateId','brand','market','evidenceFingerprint'],array['modelHint','projectCode']) and public.watcher_text_ok(payload->>'brand',100) and public.watcher_aliases_ok(payload->'aliases') and payload->>'schemaVersion'='watcher-brand-hint/1' and payload->>'market'='BR' and payload->>'watcherCandidateId'=candidate_id::text and payload->>'evidenceFingerprint' ~ '^watcher-evidence/1:sha256:[a-f0-9]{64}$'),false)),
 status text not null default 'PREPARED' check(status='PREPARED'), prepared_at timestamptz not null default clock_timestamp(),
 unique(candidate_id,candidate_version,evidence_id), foreign key(evidence_id,candidate_id,candidate_version) references public.watcher_candidate_evidence(id,candidate_id,candidate_version) on delete restrict
);
create index watcher_hints_evidence_idx on public.watcher_hints(evidence_id);
create function public.watcher_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception using message='WATCHER_IMMUTABLE',errcode='P0001'; end $$;
create trigger watcher_revisions_immutable before update or delete on public.watcher_article_revisions for each row execute function public.watcher_immutable();
create trigger watcher_batches_immutable before update or delete on public.watcher_batches for each row execute function public.watcher_immutable();
create trigger watcher_batch_items_immutable before update or delete on public.watcher_batch_items for each row execute function public.watcher_immutable();
create trigger watcher_evidence_immutable before update or delete on public.watcher_candidate_evidence for each row execute function public.watcher_immutable();
create trigger watcher_hints_immutable before update or delete on public.watcher_hints for each row execute function public.watcher_immutable();
-- Explicit ACLs on every newly created object; no policies grant browser access.
do $$
declare t text;
begin
 foreach t in array array['watcher_sources','watcher_source_state','watcher_batches','watcher_articles','watcher_feed_items','watcher_article_revisions','watcher_batch_items','watcher_candidates','watcher_candidate_evidence','watcher_hints'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on table public.%I to service_role',t);
 end loop;
end $$;
grant update(feed_url,definition,settings,config_version,updated_at) on public.watcher_sources to service_role;
grant update(state_version,etag,last_modified,last_successful_observed_at,last_attempt_at,consecutive_failures,last_failure_code,lease_token,lease_owner,lease_expires_at) on public.watcher_source_state to service_role;
grant update(first_seen_at,last_seen_at) on public.watcher_articles to service_role;
grant update(article_id,current_revision_id,current_observed_at,last_seen_at) on public.watcher_feed_items to service_role;
grant update(identity_key,brand,model_hint,project_code,aliases,status,version,updated_at) on public.watcher_candidates to service_role;
revoke all on function public.watcher_text_ok(text,integer),public.watcher_exact_object(jsonb,text[]),public.watcher_url_ok(text),public.watcher_hosts_ok(jsonb),public.watcher_strings_ok(jsonb,text[],text[]),public.watcher_aliases_ok(jsonb),public.watcher_immutable() from public,anon,authenticated;
grant execute on function public.watcher_text_ok(text,integer),public.watcher_exact_object(jsonb,text[]),public.watcher_url_ok(text),public.watcher_hosts_ok(jsonb),public.watcher_strings_ok(jsonb,text[],text[]),public.watcher_aliases_ok(jsonb),public.watcher_immutable() to service_role;
commit;
