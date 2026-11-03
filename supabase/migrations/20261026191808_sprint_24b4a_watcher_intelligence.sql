-- Local-only 24B.4A proposal. Apply only after the separately authorized QA preflight.
begin;
create table public.watcher_intelligence_receipts (
 id uuid primary key, scope text not null check(scope ~ '^[a-z0-9][a-z0-9_:/.-]{0,199}$'),
 scope_version bigint not null check(scope_version>0),
 commit_key text not null unique check(commit_key ~ '^watcher-intelligence-commit/1:sha256:[a-f0-9]{64}$'),
 engine_version text not null check(engine_version ~ '^watcher-intelligence/[1-9][0-9]{0,2}$'),
 context_fingerprint text not null check(context_fingerprint ~ '^watcher-intelligence-context/1:sha256:[a-f0-9]{64}$'),
 source_ids text[] not null check(cardinality(source_ids) between 1 and 100),
 payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 input_snapshot jsonb not null check(jsonb_typeof(input_snapshot)='object' and octet_length(input_snapshot::text)<=2097152), fence_snapshot jsonb not null,
 receipt jsonb not null check(jsonb_typeof(receipt)='object'),
 created_at timestamptz not null default clock_timestamp(), unique(scope,scope_version), unique(id,scope)
);
create index watcher_intelligence_context_idx on public.watcher_intelligence_receipts(context_fingerprint);
create table public.watcher_intelligence_units (
 unit_key text primary key check(unit_key ~ '^watcher-intelligence-unit/1:sha256:[a-f0-9]{64}$'),
 receipt_id uuid not null, scope text not null, article_id uuid not null, revision_id uuid not null, feed_item_id uuid not null,
 engine_version text not null, context_fingerprint text not null,
 document jsonb not null check(jsonb_typeof(document)='object'), analysis jsonb not null check(jsonb_typeof(analysis)='object'),
 unique(article_id,revision_id,engine_version,scope,context_fingerprint),
 foreign key(receipt_id,scope) references public.watcher_intelligence_receipts(id,scope) on delete restrict,
 foreign key(revision_id,feed_item_id,article_id) references public.watcher_article_revisions(id,feed_item_id,article_id) on delete restrict
);
create index watcher_intelligence_units_receipt_idx on public.watcher_intelligence_units(receipt_id);
create index watcher_intelligence_units_revision_idx on public.watcher_intelligence_units(revision_id);
create index watcher_intelligence_units_feed_idx on public.watcher_intelligence_units(feed_item_id);
create table public.watcher_intelligence_candidates (
 scope text not null, event_key text not null check(event_key ~ '^watcher-event/1:sha256:[a-f0-9]{64}$'),
 candidate_id uuid not null references public.watcher_candidates(id) on delete restrict,
 version bigint not null check(version>0), review_version bigint not null default 0 check(review_version>=0),
 current_commit_id uuid not null, snapshot jsonb not null,
 primary key(scope,event_key), foreign key(current_commit_id,scope) references public.watcher_intelligence_receipts(id,scope) on delete restrict,
 check(coalesce((jsonb_typeof(snapshot)='object' and snapshot->>'key'=event_key and snapshot->>'status' in ('NEW','CORROBORATED','INSUFFICIENT') and snapshot->'applyAllowed'='false'::jsonb),false))
);
create index watcher_intelligence_candidates_root_idx on public.watcher_intelligence_candidates(candidate_id);
create index watcher_intelligence_candidates_commit_idx on public.watcher_intelligence_candidates(current_commit_id);
create table public.watcher_intelligence_reviews (
 id uuid primary key, scope text not null, event_key text not null, scope_version bigint not null,
 candidate_version bigint not null check(candidate_version>0), review_version bigint not null check(review_version>0),
 snapshot_fingerprint text not null, decision text not null check(decision in ('ACCEPT','REJECT','DEFER')),
 actor_id uuid not null, note text not null check(public.watcher_text_ok(note,1000)),
 candidate_snapshot jsonb not null, payload_hash text not null, receipt jsonb not null, fence_snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(scope,event_key,review_version),
 foreign key(scope,event_key) references public.watcher_intelligence_candidates(scope,event_key) on delete restrict
);
create trigger watcher_intelligence_receipts_immutable before update or delete on public.watcher_intelligence_receipts for each row execute function public.watcher_immutable();
create trigger watcher_intelligence_units_immutable before update or delete on public.watcher_intelligence_units for each row execute function public.watcher_immutable();
create trigger watcher_intelligence_reviews_immutable before update or delete on public.watcher_intelligence_reviews for each row execute function public.watcher_immutable();

-- Core watcherKey: NFKD, combining-mark removal, ASCII folding, stable token boundaries.
create function public.watcher_intelligence_key(p_text text) returns text
language sql immutable strict security invoker set search_path='' as $$
 select btrim(regexp_replace(lower(regexp_replace(normalize(p_text,NFKD),'[̀-ͯ]','','g') collate "C"),'[^a-z0-9]+',' ','g'));
$$;
-- Core offsets are UTF-16, PostgreSQL substrings count Unicode code points.
create function public.watcher_intelligence_slice(p_text text,p_start integer,p_end integer) returns text
language plpgsql immutable strict security invoker set search_path='' as $$
declare i integer; units integer:=0; start_char integer; end_char integer; width integer;
begin
 if p_start<0 or p_end<=p_start or length(p_text)>20000 then return null; end if;
 for i in 1..length(p_text) loop
  if units=p_start then start_char:=i; end if;
  if units=p_end then end_char:=i; exit; end if;
  width:=case when ascii(substr(p_text,i,1))>65535 then 2 else 1 end; units:=units+width;
 end loop;
 if units=p_end and end_char is null then end_char:=length(p_text)+1; end if;
 if start_char is null or end_char is null then return null; end if;
 return substr(p_text,start_char,end_char-start_char);
end $$;
create function public.watcher_intelligence_evidence_ok(e jsonb,d jsonb,p_engine text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare r public.watcher_article_revisions; raw_text text; source_value text;
begin
 if public.watcher_exact_object(e,array['articleId','revisionId','sourceId','url','revisionFingerprint','field','start','end','quote','ruleId','sourceKind','official','originGroup']) is not true then return false; end if;
 select * into r from public.watcher_article_revisions where id=(d#>>'{revision,id}')::uuid;
 if not found then return false; end if;
 select source_id into source_value from public.watcher_feed_items where id=r.feed_item_id;
 if coalesce((e->>'articleId'<>r.article_id::text or e->>'revisionId'<>r.id::text or e->>'sourceId'<>source_value or e->>'url'<>r.item_payload->>'url' or e->>'revisionFingerprint'<>r.evidence_fingerprint or jsonb_typeof(e->'start')<>'number' or jsonb_typeof(e->'end')<>'number' or jsonb_typeof(e->'quote')<>'string' or jsonb_typeof(e->'official')<>'boolean' or e->>'sourceKind' not in ('MANUFACTURER','SECONDARY','FIPE') or e->>'ruleId' not like p_engine||':%' or (e->>'originGroup' is not null and public.watcher_text_ok(e->>'originGroup',200) is not true)),true) then return false; end if;
 case e->>'field' when 'title' then raw_text:=r.item_payload->>'title'; when 'excerpt' then raw_text:=r.item_payload->>'excerpt'; when 'content' then raw_text:=d->>'content'; else return false; end case;
 return coalesce(public.watcher_intelligence_slice(raw_text,(e->>'start')::integer,(e->>'end')::integer)=e->>'quote',false);
exception when others then return false;
end $$;
-- Locks only, never a standalone write path. Same source/state lock order as 24A.
create function public.watcher_intelligence_lock_fences(p_fences jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare f jsonb; s public.watcher_sources; st public.watcher_source_state; result jsonb:='[]'; seen text[]:=array[]::text[];
begin
 if jsonb_typeof(p_fences) is distinct from 'array' then raise exception 'WATCHER_INVALID_FENCES'; end if;
 if jsonb_array_length(p_fences) not between 1 and 100 then raise exception 'WATCHER_INVALID_FENCES'; end if;
 for f in select value from jsonb_array_elements(p_fences) order by value->>'sourceId' collate "C" loop
  if public.watcher_exact_object(f,array['sourceId','token','configVersion','stateVersion']) is not true or coalesce(f->>'sourceId' !~ '^[a-z0-9][a-z0-9_-]{0,199}$',true) or f->>'sourceId'=any(seen) or coalesce((f->>'configVersion')::bigint<1 or (f->>'stateVersion')::bigint<0,true) then raise exception 'WATCHER_INVALID_FENCES'; end if;
  seen:=array_append(seen,f->>'sourceId');
  select * into strict s from public.watcher_sources where id=f->>'sourceId' for share;
  select * into strict st from public.watcher_source_state where source_id=s.id for update;
  if st.lease_token is distinct from (f->>'token')::uuid or st.lease_expires_at is null or st.lease_expires_at<=clock_timestamp() then raise exception 'WATCHER_STALE_LEASE'; end if;
  if s.definition->>'enabled'<>'true' or s.config_version is distinct from (f->>'configVersion')::bigint or st.state_version is distinct from (f->>'stateVersion')::bigint then raise exception 'WATCHER_STALE_STATE'; end if;
  result:=result||jsonb_build_array(jsonb_build_object('sourceId',s.id,'stateVersion',st.state_version+1,'expiresAt',st.lease_expires_at));
 end loop;
 return result;
end $$;

create function public.watcher_commit_intelligence(p_commit_id uuid,p_fences jsonb,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare sc text; eng text; ctx text; ids text[]; keys text[]; natural_key text; input_hash text;
 b public.watcher_intelligence_receipts; prior public.watcher_intelligence_receipts; u jsonb; a jsonb; d jsonb; sig jsonb; ev jsonb; cw jsonb; c jsonb; old public.watcher_intelligence_candidates; pointer_keys text;
 r public.watcher_article_revisions; f public.watcher_feed_items; root public.watcher_candidates; unit_value public.watcher_intelligence_units;
 guards jsonb; expiry timestamptz; source_versions jsonb; cv jsonb:='[]'; answer jsonb; next_scope bigint;
 evidence_expected jsonb; active_expected jsonb; candidate_keys jsonb; root_key text; fp text; n bigint;
begin
 if p_commit_id is null or public.watcher_exact_object(p_payload,array['schemaVersion','scope','engineVersion','contextFingerprint','context','currentRevisionIds','currentPointers','units','candidates']) is not true then raise exception 'WATCHER_INVALID_INTELLIGENCE_COMMIT'; end if;
 sc:=p_payload->>'scope'; eng:=p_payload->>'engineVersion'; ctx:=p_payload->>'contextFingerprint';
 if coalesce((p_payload->>'schemaVersion'<>'watcher-intelligence-commit/1' or sc !~ '^[a-z0-9][a-z0-9_:/.-]{0,199}$' or eng !~ '^watcher-intelligence/[1-9][0-9]{0,2}$' or ctx !~ '^watcher-intelligence-context/1:sha256:[a-f0-9]{64}$' or jsonb_typeof(p_payload->'units')<>'array' or jsonb_typeof(p_payload->'candidates')<>'array' or jsonb_typeof(p_payload->'currentRevisionIds')<>'array' or jsonb_typeof(p_payload->'context')<>'object' or jsonb_typeof(p_fences)<>'array' or octet_length(p_payload::text)>2097152),true) then raise exception 'WATCHER_INVALID_INTELLIGENCE_COMMIT'; end if;
 if jsonb_array_length(p_payload->'units')>100 or jsonb_array_length(p_payload->'candidates')>1000 or jsonb_array_length(p_payload->'currentRevisionIds')>100 or jsonb_array_length(p_fences) not between 1 and 100 then raise exception 'WATCHER_INVALID_INTELLIGENCE_COMMIT'; end if;
 select array_agg(value->>'sourceId' order by value->>'sourceId' collate "C") into ids from jsonb_array_elements(p_fences);
 if exists(select 1 from unnest(ids) x where x is null or x !~ '^[a-z0-9][a-z0-9_-]{0,199}$') or cardinality(ids)<>(select count(distinct x) from unnest(ids)x) then raise exception 'WATCHER_INVALID_FENCES'; end if;
 select coalesce(array_agg(value->>'key' order by value->>'key' collate "C"),array[]::text[]) into keys from jsonb_array_elements(p_payload->'units');
 if exists(select 1 from unnest(keys)x where x is null or x !~ '^watcher-intelligence-unit/1:sha256:[a-f0-9]{64}$') or cardinality(keys)<>(select count(distinct x) from unnest(keys)x) then raise exception 'WATCHER_INVALID_INTELLIGENCE_COMMIT'; end if;
 if jsonb_typeof(p_payload->'currentPointers') is distinct from 'array' then raise exception 'WATCHER_INVALID_INTELLIGENCE_COMMIT'; end if;
 select coalesce(string_agg(public.watcher_array_digest('watcher-intelligence-pointer/1',array[value->>'feedItemId',value->>'revisionId',value->>'observedAt']),chr(31) order by value->>'feedItemId' collate "C"),'') into pointer_keys from jsonb_array_elements(p_payload->'currentPointers');
 natural_key:=public.watcher_array_digest('watcher-intelligence-commit/1',array[sc,eng,ctx,array_to_string(ids,chr(31)),array_to_string(keys,chr(31)),pointer_keys]);
 -- CAS expectations are controls, not deterministic analysis content; replay never reapplies them.
 input_hash:=encode(sha256(convert_to(jsonb_set(p_payload,'{candidates}',(select coalesce(jsonb_agg(value-'expectedVersion'-'expectedReviewVersion' order by value#>>'{snapshot,key}' collate "C"),'[]') from jsonb_array_elements(p_payload->'candidates')))::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('watcher-intelligence-id:'||p_commit_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('watcher-intelligence-scope:'||sc,0));
 select * into b from public.watcher_intelligence_receipts where id=p_commit_id or commit_key=natural_key order by id=p_commit_id desc limit 1;
 if found then
  if b.commit_key<>natural_key or b.payload_hash<>input_hash then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
  return b.receipt||jsonb_build_object('replayed',true);
 end if;
 select * into prior from public.watcher_intelligence_receipts where scope=sc order by scope_version desc limit 1;
 if found and prior.source_ids<>ids then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
 if exists(select 1 from public.watcher_intelligence_receipts x where x.context_fingerprint=ctx and x.input_snapshot->'context' is distinct from p_payload->'context') then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
 guards:=public.watcher_intelligence_lock_fences(p_fences);
 select min((value->>'expiresAt')::timestamptz),jsonb_agg(value-'expiresAt' order by value->>'sourceId' collate "C") into expiry,source_versions from jsonb_array_elements(guards);
 -- Full journal for a pinned source set: no stale/partial projection may erase another origin.
 select count(*) into n from public.watcher_article_revisions rr join public.watcher_feed_items ff on ff.id=rr.feed_item_id where ff.source_id=any(ids);
 if n<>cardinality(keys) then raise exception 'WATCHER_STALE_STATE'; end if;
 if (select coalesce(jsonb_agg(current_revision_id::text order by current_revision_id::text collate "C"),'[]') from public.watcher_feed_items where source_id=any(ids)) is distinct from p_payload->'currentRevisionIds' then raise exception 'WATCHER_STALE_STATE'; end if;
 if (select coalesce(jsonb_agg(jsonb_build_object('feedItemId',id,'revisionId',current_revision_id,'observedAt',to_char(current_observed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by id::text collate "C"),'[]') from public.watcher_feed_items where source_id=any(ids)) is distinct from p_payload->'currentPointers' then raise exception 'WATCHER_STALE_STATE'; end if;
 for u in select value from jsonb_array_elements(p_payload->'units') loop
  if public.watcher_exact_object(u,array['key','document','analysis']) is not true then raise exception 'WATCHER_INVALID_UNIT_SHAPE'; end if;
  d:=u->'document'; a:=u->'analysis';
  if public.watcher_exact_object(d,array['revision','content','originGroup']) is not true or public.watcher_exact_object(a,array['revision','documentFingerprint','contextFingerprint','normalized','relevant','signals','abstentions']) is not true then raise exception 'WATCHER_INVALID_UNIT_SHAPE'; end if;
  select * into strict r from public.watcher_article_revisions where id=(d#>>'{revision,id}')::uuid;
  select * into strict f from public.watcher_feed_items where id=r.feed_item_id;
  if not f.source_id=any(ids) or d->'revision' is distinct from a->'revision' or coalesce((d#>>'{revision,articleId}'<>r.article_id::text or d#>>'{revision,feedItemId}'<>r.feed_item_id::text or d#>>'{revision,evidenceFingerprint}'<>r.evidence_fingerprint or d#>'{revision,item}'<>r.item_payload or (d#>>'{revision,firstObservedAt}')::timestamptz<>date_trunc('milliseconds',r.first_observed_at) or (d#>>'{revision,createdAt}')::timestamptz<>date_trunc('milliseconds',r.created_at) or a->>'contextFingerprint'<>ctx or jsonb_typeof(a->'signals')<>'array' or jsonb_typeof(a->'relevant')<>'boolean' or jsonb_typeof(a->'abstentions')<>'array' or (d->>'content' is not null and (jsonb_typeof(d->'content')<>'string' or length(d->>'content')>20000)) or (d->>'originGroup' is not null and public.watcher_text_ok(d->>'originGroup',200) is not true)),true) then raise exception 'WATCHER_INVALID_UNIT'; end if;
  if not exists(select 1 from jsonb_array_elements(p_payload#>'{context,sources}') cs join public.watcher_sources ss on ss.id=f.source_id where cs#>>'{source,id}'=ss.id and cs->'source'=ss.definition) then raise exception 'WATCHER_STALE_STATE'; end if;
  if u->>'key'<>public.watcher_array_digest('watcher-intelligence-unit/1',array[r.article_id::text,r.id::text,eng,sc,ctx]) or jsonb_array_length(a->'signals')>2000 or a#>>'{normalized,title}' is distinct from public.watcher_intelligence_key(r.item_payload->>'title') or a#>>'{normalized,excerpt}' is distinct from public.watcher_intelligence_key(coalesce(r.item_payload->>'excerpt','')) or a#>>'{normalized,content}' is distinct from public.watcher_intelligence_key(coalesce(d->>'content','')) then raise exception 'WATCHER_INVALID_UNIT'; end if;
  select * into unit_value from public.watcher_intelligence_units where unit_key=u->>'key';
  if found and (unit_value.document<>d or unit_value.analysis<>a) then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
  for sig in select value from jsonb_array_elements(a->'signals') loop
   if public.watcher_exact_object(sig,array['fingerprint','eventKey','identity','category','applicability','claim','decision','reasons','value','modelYear','observationWindow','evidence','qualifiers']) is not true or public.watcher_exact_object(sig->'identity',array['resolution','brandId','brand','model','version','mmvIds']) is not true or coalesce((sig->>'category' not in ('NEW_MODEL','NEW_COMMERCIAL_VARIANT','NEW_MODEL_YEAR','POWERTRAIN','FACELIFT','PRICE_CHANGE','POSSIBLE_DISCONTINUATION') or sig#>>'{identity,resolution}' not in ('EXISTING','PROBABLE_NEW','UNRESOLVED') or public.watcher_text_ok(sig#>>'{identity,brandId}',200) is not true or public.watcher_text_ok(sig#>>'{identity,brand}',100) is not true or (sig#>>'{identity,model}' is not null and public.watcher_text_ok(sig#>>'{identity,model}',100) is not true) or (sig#>>'{identity,version}' is not null and public.watcher_text_ok(sig#>>'{identity,version}',200) is not true) or jsonb_typeof(sig#>'{identity,mmvIds}')<>'array' or (sig->>'value' is not null and (jsonb_typeof(sig->'value')<>'string' or length(sig->>'value')>2000 or position(sig->>'value' in sig#>>'{evidence,quote}')=0)) or (sig->>'modelYear' is not null and (sig->>'modelYear' !~ '^(19|20|21)[0-9]{2}$' or position(sig->>'modelYear' in sig#>>'{evidence,quote}')=0))),true) then raise exception 'WATCHER_INVALID_SIGNAL'; end if;
   if coalesce((sig->>'fingerprint' !~ '^watcher-signal/1:sha256:[a-f0-9]{64}$' or sig->>'eventKey' !~ '^watcher-event/1:sha256:[a-f0-9]{64}$' or sig->>'decision' not in ('REVIEW','ABSTAIN') or sig->>'claim' not in ('CONFIRMED','ATTRIBUTED','EDITORIAL_ASSERTION','SPECULATION','RUMOR','INSUFFICIENT') or sig->>'applicability' not in ('CONFIRMED','UNKNOWN','NOT_APPLICABLE') or jsonb_typeof(sig->'qualifiers')<>'array' or jsonb_typeof(sig->'reasons')<>'array' or public.watcher_intelligence_evidence_ok(sig->'evidence',d,eng) is not true),true) then raise exception 'WATCHER_INVALID_EVIDENCE'; end if;
   if sig->>'decision'='REVIEW' and (sig->>'applicability'<>'CONFIRMED' or sig->>'claim' in ('RUMOR','SPECULATION','INSUFFICIENT') or jsonb_array_length(sig->'reasons')<>0) then raise exception 'WATCHER_INVALID_SIGNAL'; end if;
   if sig#>>'{evidence,official}'='true' and not exists(select 1 from jsonb_array_elements(p_payload#>'{context,sources}') cs where cs#>>'{source,id}'=f.source_id and cs->>'kind'='MANUFACTURER' and cs->>'officialBrandId'=sig#>>'{identity,brandId}' and cs->'officialHosts' ? substring(r.item_payload->>'url' from '^https://([^/]+)')) then raise exception 'WATCHER_INVALID_EVIDENCE'; end if;
   if sig->>'claim'='CONFIRMED' and sig#>>'{evidence,official}'<>'true' then raise exception 'WATCHER_INVALID_SIGNAL'; end if;
   for ev in select value from jsonb_array_elements(sig->'qualifiers') loop
    if public.watcher_intelligence_evidence_ok(ev,d,eng) is not true then raise exception 'WATCHER_INVALID_EVIDENCE'; end if;
   end loop;
  end loop;
 end loop;
 -- Exactly one generated snapshot for every resolved event in the complete journal.
 select coalesce(jsonb_agg(k order by k collate "C"),'[]') into candidate_keys from (select distinct sigv->>'eventKey' k from jsonb_array_elements(p_payload->'units') uv cross join lateral jsonb_array_elements(uv#>'{analysis,signals}') sigv where sigv#>>'{identity,model}' is not null and sigv#>>'{identity,resolution}'<>'UNRESOLVED') q;
 if candidate_keys is distinct from (select coalesce(jsonb_agg(value#>>'{snapshot,key}' order by value#>>'{snapshot,key}' collate "C"),'[]') from jsonb_array_elements(p_payload->'candidates')) then raise exception 'WATCHER_INVALID_CANDIDATES'; end if;
 for cw in select value from jsonb_array_elements(p_payload->'candidates') order by value#>>'{snapshot,key}' collate "C" loop
  if public.watcher_exact_object(cw,array['snapshot','rootIdentityKey','expectedVersion','expectedReviewVersion']) is not true then raise exception 'WATCHER_INVALID_CANDIDATE'; end if;
  c:=cw->'snapshot';
  select * into old from public.watcher_intelligence_candidates where scope=sc and event_key=c->>'key' for update;
  if old.candidate_id is not null and not exists(select 1 from public.watcher_candidates anchor where anchor.id=old.candidate_id and anchor.identity_key=cw->>'rootIdentityKey') then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
  if coalesce((cw->>'expectedVersion')::bigint,-1)<>coalesce(old.version,0) then raise exception 'WATCHER_STALE_STATE'; end if;
  if coalesce((cw->>'expectedReviewVersion')::bigint,-1)<>coalesce(old.review_version,0) then raise exception 'WATCHER_REVIEW_CONFLICT'; end if;
  select coalesce(jsonb_agg(sigv order by sigv->>'fingerprint' collate "C"),'[]') into evidence_expected from jsonb_array_elements(p_payload->'units') uv cross join lateral jsonb_array_elements(uv#>'{analysis,signals}') sigv where sigv->>'eventKey'=c->>'key';
  select coalesce(jsonb_agg(sigv->>'fingerprint' order by sigv->>'fingerprint' collate "C"),'[]') into active_expected from jsonb_array_elements(p_payload->'units') uv join public.watcher_feed_items ff on ff.current_revision_id=(uv#>>'{document,revision,id}')::uuid cross join lateral jsonb_array_elements(uv#>'{analysis,signals}') sigv where sigv->>'eventKey'=c->>'key' and sigv->>'decision'='REVIEW';
  if c->'evidence' is distinct from evidence_expected or c->'activeSignalIds' is distinct from active_expected or c->'identity' is distinct from evidence_expected#>'{0,identity}' or c->>'category' is distinct from evidence_expected#>>'{0,category}' or coalesce((c->'applyAllowed'<>'false'::jsonb or c->>'status' not in ('NEW','CORROBORATED','INSUFFICIENT') or c#>>'{quality,score}' not in ('0','20','60','80') or jsonb_typeof(c#>'{quality,reasons}')<>'array'),true) then raise exception 'WATCHER_INVALID_CANDIDATE'; end if;
  if exists(select 1 from jsonb_array_elements_text(c#>'{quality,reasons}') reason where reason !~ '^[A-Z_]{1,100}$') then raise exception 'WATCHER_INVALID_CANDIDATE'; end if;
  fp:='watcher-candidate-snapshot/1:sha256:'||encode(sha256(convert_to(replace(jsonb_build_array(c->>'key',(select jsonb_agg(x->>'fingerprint' order by x->>'fingerprint' collate "C") from jsonb_array_elements(evidence_expected)x),active_expected,(c#>>'{quality,score}')::integer,c#>'{quality,reasons}')::text,' ',''),'UTF8')),'hex');
  if c->>'fingerprint' is distinct from fp then raise exception 'WATCHER_INVALID_FINGERPRINT'; end if;
  root_key:=public.watcher_array_digest('watcher-candidate/1',array['BR',public.watcher_intelligence_key(c#>>'{identity,brand}'),public.watcher_intelligence_key(c#>>'{identity,model}'),null]);
  if cw->>'rootIdentityKey' is distinct from root_key then raise exception 'WATCHER_INVALID_CANDIDATE'; end if;
  cv:=cv||jsonb_build_array(jsonb_build_object('key',c->>'key','version',coalesce(old.version,0)+1,'reviewVersion',coalesce(old.review_version,0)));
 end loop;
 if expiry<=clock_timestamp() then raise exception 'WATCHER_STALE_LEASE'; end if;
 next_scope:=coalesce(prior.scope_version,0)+1;
 answer:=jsonb_build_object('commitId',p_commit_id,'commitKey',natural_key,'scope',sc,'scopeVersion',next_scope,'unitKeys',to_jsonb(keys),'candidateVersions',cv,'sourceVersions',source_versions,'replayed',false);
 insert into public.watcher_intelligence_receipts(id,scope,scope_version,commit_key,engine_version,context_fingerprint,source_ids,payload_hash,input_snapshot,receipt,fence_snapshot) values(p_commit_id,sc,next_scope,natural_key,eng,ctx,ids,input_hash,p_payload,answer,(select jsonb_agg(value-'token' order by value->>'sourceId' collate "C") from jsonb_array_elements(p_fences)));
 for u in select value from jsonb_array_elements(p_payload->'units') loop
  d:=u->'document';
  insert into public.watcher_intelligence_units(unit_key,receipt_id,scope,article_id,revision_id,feed_item_id,engine_version,context_fingerprint,document,analysis) values(u->>'key',p_commit_id,sc,(d#>>'{revision,articleId}')::uuid,(d#>>'{revision,id}')::uuid,(d#>>'{revision,feedItemId}')::uuid,eng,ctx,d,u->'analysis') on conflict(unit_key) do nothing;
 end loop;
 -- Same lock order for shared 24A identity anchors, across different execution scopes.
 for cw in select value from jsonb_array_elements(p_payload->'candidates') order by value->>'rootIdentityKey' collate "C",value#>>'{snapshot,key}' collate "C" loop
  c:=cw->'snapshot'; root_key:=cw->>'rootIdentityKey';
  perform pg_advisory_xact_lock(hashtextextended('watcher-intelligence-root:'||root_key,0));
  insert into public.watcher_candidates(id,identity_key,brand,model_hint,project_code,aliases,status) values(gen_random_uuid(),root_key,c#>>'{identity,brand}',c#>>'{identity,model}',null,'[]','OBSERVED') on conflict(identity_key) do nothing;
  select * into strict root from public.watcher_candidates where identity_key=root_key for share;
  if root.brand<>c#>>'{identity,brand}' or root.model_hint is distinct from c#>>'{identity,model}' then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
  insert into public.watcher_intelligence_candidates(scope,event_key,candidate_id,version,review_version,current_commit_id,snapshot) values(sc,c->>'key',root.id,1,0,p_commit_id,c)
   on conflict(scope,event_key) do update set version=watcher_intelligence_candidates.version+1,current_commit_id=excluded.current_commit_id,snapshot=excluded.snapshot
   where watcher_intelligence_candidates.candidate_id=excluded.candidate_id;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
 end loop;
 if expiry<=clock_timestamp() then raise exception 'WATCHER_STALE_LEASE'; end if;
 for u in select value from jsonb_array_elements(source_versions) loop
  update public.watcher_source_state set state_version=(u->>'stateVersion')::bigint,lease_token=null,lease_owner=null,lease_expires_at=null where source_id=u->>'sourceId';
 end loop;
 if expiry<=clock_timestamp() then raise exception 'WATCHER_STALE_LEASE'; end if;
 return answer;
end $$;

create function public.watcher_review_intelligence(p_fences jsonb,p_review jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare sc text; rid uuid; h text; old_review public.watcher_intelligence_reviews; c public.watcher_intelligence_candidates; b public.watcher_intelligence_receipts;
 guards jsonb; source_versions jsonb; expiry timestamptz; ids text[]; answer jsonb; x jsonb;
begin
 if public.watcher_exact_object(p_review,array['reviewId','scope','scopeVersion','eventKey','expectedVersion','expectedReviewVersion','snapshotFingerprint','decision','actorId','note']) is not true then raise exception 'WATCHER_INVALID_REVIEW'; end if;
 sc:=p_review->>'scope'; rid:=(p_review->>'reviewId')::uuid;
 if coalesce((rid is null or sc !~ '^[a-z0-9][a-z0-9_:/.-]{0,199}$' or p_review->>'decision' not in ('ACCEPT','REJECT','DEFER') or public.watcher_text_ok(p_review->>'note',1000) is not true or (p_review->>'actorId')::uuid is null),true) then raise exception 'WATCHER_INVALID_REVIEW'; end if;
 h:=encode(sha256(convert_to(p_review::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('watcher-intelligence-review:'||rid::text,0));
 select * into old_review from public.watcher_intelligence_reviews where id=rid;
 if found then
  if old_review.payload_hash<>h then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
  return old_review.receipt||jsonb_build_object('replayed',true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('watcher-intelligence-scope:'||sc,0));
 select * into strict b from public.watcher_intelligence_receipts where scope=sc order by scope_version desc limit 1;
 guards:=public.watcher_intelligence_lock_fences(p_fences);
 select array_agg(value->>'sourceId' order by value->>'sourceId' collate "C"),min((value->>'expiresAt')::timestamptz),jsonb_agg(value-'expiresAt' order by value->>'sourceId' collate "C") into ids,expiry,source_versions from jsonb_array_elements(guards);
 if ids<>b.source_ids or (p_review->>'scopeVersion')::bigint is distinct from b.scope_version then raise exception 'WATCHER_REVIEW_CONFLICT'; end if;
 select * into strict c from public.watcher_intelligence_candidates where scope=sc and event_key=p_review->>'eventKey' for update;
 if c.current_commit_id<>b.id or c.version is distinct from (p_review->>'expectedVersion')::bigint or c.review_version is distinct from (p_review->>'expectedReviewVersion')::bigint or c.snapshot->>'fingerprint' is distinct from p_review->>'snapshotFingerprint' then raise exception 'WATCHER_REVIEW_CONFLICT'; end if;
 if expiry<=clock_timestamp() then raise exception 'WATCHER_STALE_LEASE'; end if;
 answer:=jsonb_build_object('reviewId',rid,'scope',sc,'scopeVersion',b.scope_version,'eventKey',c.event_key,'candidateVersion',c.version,'reviewVersion',c.review_version+1,'sourceVersions',source_versions,'replayed',false);
 insert into public.watcher_intelligence_reviews(id,scope,event_key,scope_version,candidate_version,review_version,snapshot_fingerprint,decision,actor_id,note,candidate_snapshot,payload_hash,receipt,fence_snapshot) values(rid,sc,c.event_key,b.scope_version,c.version,c.review_version+1,c.snapshot->>'fingerprint',p_review->>'decision',(p_review->>'actorId')::uuid,p_review->>'note',c.snapshot,h,answer,(select jsonb_agg(value-'token' order by value->>'sourceId' collate "C") from jsonb_array_elements(p_fences)));
 update public.watcher_intelligence_candidates set review_version=review_version+1 where scope=sc and event_key=c.event_key;
 for x in select value from jsonb_array_elements(source_versions) loop
  update public.watcher_source_state set state_version=(x->>'stateVersion')::bigint,lease_token=null,lease_owner=null,lease_expires_at=null where source_id=x->>'sourceId';
 end loop;
 if expiry<=clock_timestamp() then raise exception 'WATCHER_STALE_LEASE'; end if;
 return answer;
end $$;

create function public.watcher_intelligence_query(p_kind text,p_scope text,p_filter text default null,p_limit integer default 25,p_offset integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_scope is null or p_scope !~ '^[a-z0-9][a-z0-9_:/.-]{0,199}$' or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'WATCHER_INVALID_QUERY'; end if;
 case p_kind
 when 'RECEIPTS' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select * from public.watcher_intelligence_receipts where scope=p_scope and (p_filter is null or id::text=p_filter) order by scope_version limit p_limit offset p_offset)t;
 when 'UNITS' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select * from public.watcher_intelligence_units where scope=p_scope and (p_filter is null or revision_id::text=p_filter) order by unit_key limit p_limit offset p_offset)t;
 when 'REVIEWS' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select * from public.watcher_intelligence_reviews where scope=p_scope and (p_filter is null or event_key=p_filter) order by event_key,review_version limit p_limit offset p_offset)t;
 when 'CANDIDATES' then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (
   select c.*,c.current_commit_id=latest.id as current,
    case when root.status='DISMISSED' then 'DISMISSED' when c.current_commit_id<>latest.id then 'INSUFFICIENT' when review.snapshot_fingerprint=c.snapshot->>'fingerprint' then case review.decision when 'REJECT' then 'DISMISSED' when 'DEFER' then 'INSUFFICIENT' else 'REVIEW_REQUIRED' end when review.id is not null and c.snapshot->>'status'<>'INSUFFICIENT' then 'REVIEW_REQUIRED' else c.snapshot->>'status' end as effective_status,
    coalesce(c.current_commit_id=latest.id and review.snapshot_fingerprint=c.snapshot->>'fingerprint',false) as review_current,
    to_jsonb(review) as latest_review
   from public.watcher_intelligence_candidates c join public.watcher_candidates root on root.id=c.candidate_id
   cross join lateral (select id from public.watcher_intelligence_receipts where scope=p_scope order by scope_version desc limit 1) latest
   left join lateral (select * from public.watcher_intelligence_reviews r where r.scope=c.scope and r.event_key=c.event_key order by review_version desc limit 1) review on true
   where c.scope=p_scope and (p_filter is null or c.event_key=p_filter) order by c.event_key limit p_limit offset p_offset)t;
 else raise exception 'WATCHER_INVALID_QUERY'; end case;
 return result;
end $$;

do $$declare t text; begin
 foreach t in array array['watcher_intelligence_receipts','watcher_intelligence_units','watcher_intelligence_candidates','watcher_intelligence_reviews'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on table public.%I to service_role',t);
 end loop;
end $$;
grant update(version,review_version,current_commit_id,snapshot) on public.watcher_intelligence_candidates to service_role;
revoke all on function public.watcher_intelligence_key(text),public.watcher_intelligence_slice(text,integer,integer),public.watcher_intelligence_evidence_ok(jsonb,jsonb,text),public.watcher_intelligence_lock_fences(jsonb),public.watcher_commit_intelligence(uuid,jsonb,jsonb),public.watcher_review_intelligence(jsonb,jsonb),public.watcher_intelligence_query(text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.watcher_intelligence_key(text),public.watcher_intelligence_slice(text,integer,integer),public.watcher_intelligence_evidence_ok(jsonb,jsonb,text),public.watcher_intelligence_lock_fences(jsonb),public.watcher_commit_intelligence(uuid,jsonb,jsonb),public.watcher_review_intelligence(jsonb,jsonb),public.watcher_intelligence_query(text,text,text,integer,integer) to service_role;
commit;
