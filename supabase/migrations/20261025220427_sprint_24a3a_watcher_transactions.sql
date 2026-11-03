begin;
create function public.watcher_register_source(p_source jsonb,p_settings jsonb,p_expected_version bigint default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.watcher_sources; st public.watcher_source_state;
begin
 insert into public.watcher_sources(id,feed_url,definition,settings) values(p_source->>'id',p_source->>'feedUrl',p_source,p_settings) on conflict(id) do nothing;
 select * into strict s from public.watcher_sources where id=p_source->>'id' for update;
 insert into public.watcher_source_state(source_id) values(s.id) on conflict do nothing;
 select * into strict st from public.watcher_source_state where source_id=s.id for update;
 if s.definition<>p_source or s.settings<>p_settings then
  if p_expected_version is null or p_expected_version<>s.config_version then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
  if st.lease_expires_at>clock_timestamp() then raise exception 'WATCHER_SOURCE_BUSY'; end if;
  update public.watcher_sources set feed_url=p_source->>'feedUrl',definition=p_source,settings=p_settings,config_version=config_version+1,updated_at=clock_timestamp() where id=s.id returning * into s;
  update public.watcher_source_state set state_version=state_version+1,etag=null,last_modified=null,last_successful_observed_at=null,lease_token=null,lease_owner=null,lease_expires_at=null where source_id=s.id;
 end if;
 return to_jsonb(s);
end $$;
create function public.watcher_claim_source(p_source_id text,p_owner text,p_ttl_seconds integer default 60) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.watcher_sources; st public.watcher_source_state; n timestamptz;
begin
 if not public.watcher_text_ok(p_owner,200) or p_ttl_seconds is null or p_ttl_seconds not between 1 and 300 then raise exception 'WATCHER_INVALID_LEASE'; end if;
 select * into strict s from public.watcher_sources where id=p_source_id for share;
 if s.definition->>'enabled'<>'true' then return null; end if;
 select * into strict st from public.watcher_source_state where source_id=p_source_id for update;
 n:=clock_timestamp();
 if st.lease_expires_at>n then return null; end if;
 update public.watcher_source_state set lease_token=gen_random_uuid(),lease_owner=p_owner,lease_expires_at=n+make_interval(secs=>p_ttl_seconds),
 consecutive_failures=consecutive_failures+case when st.lease_token is not null then 1 else 0 end,
 last_failure_code=case when st.lease_token is not null then 'LEASE_EXPIRED' else last_failure_code end
 where source_id=p_source_id returning * into st;
 return jsonb_build_object('source_id',s.id,'token',st.lease_token,'owner',st.lease_owner,'expires_at',st.lease_expires_at,'config_version',s.config_version,'state_version',st.state_version);
end $$;
create function public.watcher_release_source(p_source_id text,p_token uuid,p_failure_code text default null) returns boolean
language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 if p_failure_code is not null and p_failure_code not in ('PERSISTENCE_FAILED','UNAVAILABLE','TIMEOUT') then raise exception 'WATCHER_INVALID_FAILURE'; end if;
 update public.watcher_source_state set lease_token=null,lease_owner=null,lease_expires_at=null,state_version=state_version+1,
 consecutive_failures=case when p_failure_code is not null then consecutive_failures+1 else consecutive_failures end,
 last_failure_code=coalesce(p_failure_code,last_failure_code)
 where source_id=p_source_id and lease_token=p_token and lease_expires_at>clock_timestamp();
 get diagnostics changed=row_count;
 return changed=1;
end $$;
-- Hashes reproduce the compact ordered string arrays used by Core, not jsonb's whitespace format.
create function public.watcher_array_digest(p_namespace text,p_fields text[]) returns text
language sql immutable security invoker set search_path='' as $$
 select p_namespace||':sha256:'||encode(sha256(convert_to(array_to_json(p_fields)::text,'UTF8')),'hex');
$$;
create function public.watcher_batch_receipt(b public.watcher_batches,p_replayed boolean) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('batch_id',b.id,'source_id',b.source_id,'status',b.status,'state_version',b.state_version,'checkpoint_advanced',b.checkpoint_advanced,'replayed',p_replayed);
$$;
create function public.watcher_persist_batch(p_batch_id uuid,p_token uuid,p_config_version bigint,p_state_version bigint,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.watcher_sources; st public.watcher_source_state; b public.watcher_batches; f public.watcher_feed_items;
 o jsonb; item jsonb; cp jsonb; observed timestamptz; source_id_value text; payload_hash_value text;
 article_id_value uuid; revision_id_value uuid; feed_id_value uuid; item_key_value text; fingerprint_value text; decision_value text; seen_keys text[]:='{}';
 advance_value boolean; n timestamptz; failure_code_value text;
begin
 if coalesce((p_batch_id is null or p_config_version is null or p_config_version<1 or p_state_version is null or p_state_version<0),true) then raise exception 'WATCHER_INVALID_BATCH'; end if;
 if coalesce((public.watcher_exact_object(p_payload,array['batch','checkpoint','advanceCheckpoint','checkpointBlockedReason','diagnostics']) is not true or octet_length(p_payload::text)>2097152),true) then raise exception 'WATCHER_INVALID_BATCH'; end if;
 if coalesce((public.watcher_exact_object(p_payload->'batch',array['schemaVersion','sourceId','observedAt','observations','failures']) is not true or public.watcher_strings_ok(p_payload->'batch',array['schemaVersion','sourceId','observedAt'],array[]::text[]) is not true or p_payload#>>'{batch,schemaVersion}'<>'watcher-ingestion/1' or jsonb_typeof(p_payload#>'{batch,observations}')<>'array' or jsonb_typeof(p_payload#>'{batch,failures}')<>'array' or jsonb_typeof(p_payload->'diagnostics')<>'array' or jsonb_typeof(p_payload->'advanceCheckpoint')<>'boolean'),true) then raise exception 'WATCHER_INVALID_BATCH'; end if;
 if coalesce((jsonb_array_length(p_payload#>'{batch,observations}')>100 or jsonb_array_length(p_payload#>'{batch,failures}')>100 or jsonb_array_length(p_payload->'diagnostics')>301),true) then raise exception 'WATCHER_INVALID_BATCH'; end if;
 source_id_value:=p_payload#>>'{batch,sourceId}'; observed:=(p_payload#>>'{batch,observedAt}')::timestamptz;
 cp:=p_payload->'checkpoint'; advance_value:=(p_payload->>'advanceCheckpoint')::boolean;
 if coalesce((observed is null or not isfinite(observed) or observed>clock_timestamp()+interval '5 minutes' or public.watcher_exact_object(cp,array['sourceId','etag','lastModified','lastSuccessfulObservedAt']) is not true or public.watcher_strings_ok(cp,array['sourceId'],array['etag','lastModified','lastSuccessfulObservedAt']) is not true or cp->>'sourceId'<>source_id_value or (cp->>'etag' is not null and not public.watcher_text_ok(cp->>'etag',1024)) or (cp->>'lastModified' is not null and not public.watcher_text_ok(cp->>'lastModified',128))),true) then raise exception 'WATCHER_INVALID_CHECKPOINT'; end if;
 if coalesce((p_payload->>'checkpointBlockedReason' is not null and p_payload->>'checkpointBlockedReason' not in ('CONFLICT','LIMIT_EXCEEDED')),true) then raise exception 'WATCHER_INVALID_BATCH'; end if;
 for o in select value from jsonb_array_elements(p_payload->'diagnostics') loop
  if coalesce((public.watcher_exact_object(o,array['code','itemIndex']) is not true or jsonb_typeof(o->'code')<>'string' or jsonb_typeof(o->'itemIndex') not in ('number','null') or o->>'code' not in ('MISSING_DATE','INVALID_DATE','INVALID_ITEM','EXCERPT_TRUNCATED','ITEMS_TRUNCATED') or (o->>'itemIndex' is not null and (o->>'itemIndex')::integer<0)),true) then raise exception 'WATCHER_INVALID_BATCH'; end if;
 end loop;
 for o in select value from jsonb_array_elements(p_payload#>'{batch,failures}') loop
  if coalesce((public.watcher_exact_object(o,array['sourceId','itemKey','observedAt','stage','code','retryable']) is not true or public.watcher_strings_ok(o,array['sourceId','observedAt','stage','code'],array['itemKey']) is not true or o->>'sourceId'<>source_id_value or o->>'stage' not in ('FETCH','PARSE','NORMALIZE','PERSIST') or o->>'code' not in ('UNAVAILABLE','TIMEOUT','LIMIT_EXCEEDED','INVALID_FEED','INVALID_ITEM','CONFLICT') or jsonb_typeof(o->'retryable')<>'boolean' or (o->>'observedAt')::timestamptz>observed or (o->>'itemKey' is not null and o->>'itemKey' !~ '^watcher-item/1:sha256:[a-f0-9]{64}$')),true) then raise exception 'WATCHER_INVALID_BATCH'; end if;
 end loop;
 if advance_value and (jsonb_array_length(p_payload#>'{batch,failures}')<>0 or p_payload->>'checkpointBlockedReason' is not null or exists(select 1 from jsonb_array_elements(p_payload->'diagnostics') d where d->>'code'<>'MISSING_DATE') or (cp->>'lastSuccessfulObservedAt')::timestamptz is distinct from observed) then raise exception 'WATCHER_CHECKPOINT_BLOCKED'; end if;
 if coalesce((not advance_value and jsonb_array_length(p_payload#>'{batch,failures}')=0 and p_payload->>'checkpointBlockedReason' is null),true) then raise exception 'WATCHER_INVALID_BATCH'; end if;
 payload_hash_value:=encode(sha256(convert_to(jsonb_build_array(p_config_version,p_payload)::text,'UTF8')),'hex');
 -- Receipt first: a lost response can be recovered even after its original lease expired/released.
 perform pg_advisory_xact_lock(hashtextextended(p_batch_id::text,0));
 select * into b from public.watcher_batches where id=p_batch_id;
 if found then
  if b.source_id<>source_id_value or b.payload_hash<>payload_hash_value then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
  return public.watcher_batch_receipt(b,true);
 end if;
 select * into strict s from public.watcher_sources where id=source_id_value for share;
 select * into strict st from public.watcher_source_state where source_id=source_id_value for update;
 n:=clock_timestamp();
 if st.lease_token is distinct from p_token or st.lease_expires_at is null or st.lease_expires_at<=n then raise exception 'WATCHER_STALE_LEASE'; end if;
 if s.definition->>'enabled'<>'true' or s.config_version<>p_config_version or st.state_version<>p_state_version or (st.last_attempt_at is not null and observed<st.last_attempt_at) then raise exception 'WATCHER_STALE_STATE'; end if;
 insert into public.watcher_batches(id,source_id,source_snapshot,config_version,payload_hash,observed_at,status,checkpoint_advanced,state_version,failures,diagnostics,blocked_reason)
 values(p_batch_id,s.id,to_jsonb(s),s.config_version,payload_hash_value,observed,case when advance_value then 'COMMITTED' when jsonb_array_length(p_payload#>'{batch,observations}')>0 then 'PARTIAL' else 'FAILED' end,advance_value,st.state_version+1,p_payload#>'{batch,failures}',p_payload->'diagnostics',p_payload->>'checkpointBlockedReason') returning * into b;
 -- Canonical URL order gives concurrent sources a consistent article-row lock order.
 for o in select value from jsonb_array_elements(p_payload#>'{batch,observations}') order by value#>>'{item,url}',value->>'itemKey',value->>'evidenceFingerprint' loop
  if coalesce((public.watcher_exact_object(o,array['item','itemKey','evidenceFingerprint','observedAt']) is not true or public.watcher_strings_ok(o,array['itemKey','evidenceFingerprint','observedAt'],array[]::text[]) is not true),true) then raise exception 'WATCHER_INVALID_OBSERVATION'; end if;
  item:=o->'item';
  if coalesce((public.watcher_exact_object(item,array['sourceId','guid','url','title','excerpt','publishedAt','updatedAt']) is not true or item->>'sourceId'<>s.id or public.watcher_url_ok(item->>'url') is not true or (o->>'observedAt')::timestamptz>observed or (o->>'observedAt')::timestamptz is null or not isfinite((o->>'observedAt')::timestamptz)),true) then raise exception 'WATCHER_INVALID_OBSERVATION'; end if;
  if item->>'publishedAt' is not null then
   if coalesce((item->>'publishedAt'<>to_char((item->>'publishedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),true) then raise exception 'WATCHER_INVALID_OBSERVATION'; end if;
  end if;
  if item->>'updatedAt' is not null then
   if coalesce((item->>'updatedAt'<>to_char((item->>'updatedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') or (item->>'publishedAt' is not null and (item->>'updatedAt')::timestamptz<(item->>'publishedAt')::timestamptz)),true) then raise exception 'WATCHER_INVALID_OBSERVATION'; end if;
  end if;
  item_key_value:=public.watcher_array_digest('watcher-item/1',array[s.id,case when item->>'guid' is null then 'URL' else 'GUID' end,coalesce(item->>'guid',item->>'url')]);
  fingerprint_value:=public.watcher_array_digest('watcher-evidence/1',array['watcher-url/1',item_key_value,item->>'url',item->>'title',item->>'excerpt',item->>'publishedAt',item->>'updatedAt']);
  if o->>'itemKey' is distinct from item_key_value or o->>'evidenceFingerprint' is distinct from fingerprint_value then raise exception 'WATCHER_INVALID_FINGERPRINT'; end if;
  if item_key_value=any(seen_keys) then raise exception 'WATCHER_BATCH_CONFLICT'; end if;
  seen_keys:=array_append(seen_keys,item_key_value);
  insert into public.watcher_articles(canonical_url,first_seen_at,last_seen_at) values(item->>'url',(o->>'observedAt')::timestamptz,(o->>'observedAt')::timestamptz)
   on conflict(canonical_url) do update set first_seen_at=least(watcher_articles.first_seen_at,excluded.first_seen_at),last_seen_at=greatest(watcher_articles.last_seen_at,excluded.last_seen_at) returning id into article_id_value;
  select * into f from public.watcher_feed_items where source_id=s.id and item_key=item_key_value for update;
  if not found then
   feed_id_value:=gen_random_uuid(); revision_id_value:=gen_random_uuid(); decision_value:='NEW';
   insert into public.watcher_feed_items(id,source_id,item_key,guid,article_id,current_revision_id,current_observed_at,first_seen_at,last_seen_at)
    values(feed_id_value,s.id,item_key_value,item->>'guid',article_id_value,revision_id_value,(o->>'observedAt')::timestamptz,(o->>'observedAt')::timestamptz,(o->>'observedAt')::timestamptz);
  else
   if (o->>'observedAt')::timestamptz<f.last_seen_at then raise exception 'WATCHER_STALE_STATE'; end if;
   feed_id_value:=f.id;
   select id into revision_id_value from public.watcher_article_revisions where feed_item_id=f.id and evidence_fingerprint=fingerprint_value;
   if revision_id_value is null then revision_id_value:=gen_random_uuid(); end if;
   decision_value:=case when f.current_revision_id=revision_id_value then 'UNCHANGED' else 'UPDATED' end;
  end if;
  insert into public.watcher_article_revisions(id,article_id,feed_item_id,evidence_fingerprint,item_payload,first_observed_at)
   values(revision_id_value,article_id_value,feed_id_value,fingerprint_value,item,(o->>'observedAt')::timestamptz) on conflict(feed_item_id,evidence_fingerprint) do nothing;
  if not exists(select 1 from public.watcher_article_revisions where id=revision_id_value and article_id=article_id_value and item_payload=item) then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
  update public.watcher_feed_items set article_id=article_id_value,current_revision_id=revision_id_value,current_observed_at=case when decision_value='UNCHANGED' then current_observed_at else (o->>'observedAt')::timestamptz end,last_seen_at=greatest(last_seen_at,(o->>'observedAt')::timestamptz) where id=feed_id_value;
  insert into public.watcher_batch_items(batch_id,feed_item_id,revision_id,observed_at,decision) values(p_batch_id,feed_id_value,revision_id_value,(o->>'observedAt')::timestamptz,decision_value);
 end loop;
 -- Recheck after all writes: expiry during persistence rolls the ENTIRE transaction back.
 if st.lease_expires_at<=clock_timestamp() then raise exception 'WATCHER_STALE_LEASE'; end if;
 failure_code_value:=coalesce(p_payload#>>'{batch,failures,0,code}',p_payload->>'checkpointBlockedReason');
 update public.watcher_source_state set state_version=b.state_version,last_attempt_at=observed,
 etag=case when advance_value then cp->>'etag' else etag end,last_modified=case when advance_value then cp->>'lastModified' else last_modified end,
 last_successful_observed_at=case when advance_value then observed else last_successful_observed_at end,
 consecutive_failures=case when advance_value then 0 else consecutive_failures+1 end,last_failure_code=case when advance_value then null else failure_code_value end,
 lease_token=null,lease_owner=null,lease_expires_at=null where source_id=s.id;
 return public.watcher_batch_receipt(b,false);
end $$;
create function public.watcher_stage_candidate(p_candidate jsonb,p_expected_version bigint default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.watcher_candidates; alias_value jsonb;
begin
 if public.watcher_exact_object(p_candidate,array['id','identityKey','brand','modelHint','projectCode','aliases','status']) is not true then raise exception 'WATCHER_INVALID_CANDIDATE'; end if;
 for alias_value in select value from jsonb_array_elements(p_candidate->'aliases') loop
  if jsonb_typeof(alias_value)<>'string' or public.watcher_text_ok(alias_value#>>'{}',100) is not true then raise exception 'WATCHER_INVALID_CANDIDATE'; end if;
 end loop;
 insert into public.watcher_candidates(id,identity_key,brand,model_hint,project_code,aliases,status)
 values((p_candidate->>'id')::uuid,p_candidate->>'identityKey',p_candidate->>'brand',p_candidate->>'modelHint',p_candidate->>'projectCode',p_candidate->'aliases',p_candidate->>'status') on conflict(id) do nothing;
 select * into strict c from public.watcher_candidates where id=(p_candidate->>'id')::uuid for update;
 if (c.identity_key,c.brand,c.model_hint,c.project_code,c.aliases,c.status) is distinct from (p_candidate->>'identityKey',p_candidate->>'brand',p_candidate->>'modelHint',p_candidate->>'projectCode',p_candidate->'aliases',p_candidate->>'status') then
  if p_expected_version is null or p_expected_version<>c.version then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
  update public.watcher_candidates set identity_key=p_candidate->>'identityKey',brand=p_candidate->>'brand',model_hint=p_candidate->>'modelHint',project_code=p_candidate->>'projectCode',aliases=p_candidate->'aliases',status=p_candidate->>'status',version=version+1,updated_at=clock_timestamp() where id=c.id returning * into c;
 end if;
 return to_jsonb(c);
end $$;
create function public.watcher_attach_evidence(p_evidence jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.watcher_candidate_evidence; c public.watcher_candidates;
begin
 if public.watcher_exact_object(p_evidence,array['candidateId','candidateVersion','revisionId','assertion','actorId','note']) is not true then raise exception 'WATCHER_INVALID_EVIDENCE'; end if;
 select * into c from public.watcher_candidates where id=(p_evidence->>'candidateId')::uuid for update;
 if not found then raise exception 'WATCHER_NOT_FOUND'; end if;
 if (p_evidence->>'candidateVersion')::bigint is distinct from c.version then raise exception 'WATCHER_STALE_STATE'; end if;
 insert into public.watcher_candidate_evidence(candidate_id,candidate_version,candidate_snapshot,revision_id,assertion,actor_id,note)
 values((p_evidence->>'candidateId')::uuid,c.version,to_jsonb(c),(p_evidence->>'revisionId')::uuid,p_evidence->>'assertion',(p_evidence->>'actorId')::uuid,p_evidence->>'note') on conflict(candidate_id,candidate_version,revision_id,assertion) do nothing;
 select * into strict e from public.watcher_candidate_evidence where candidate_id=(p_evidence->>'candidateId')::uuid and candidate_version=c.version and revision_id=(p_evidence->>'revisionId')::uuid and assertion=p_evidence->>'assertion';
 if e.actor_id is distinct from (p_evidence->>'actorId')::uuid or e.note is distinct from p_evidence->>'note' then raise exception 'WATCHER_CONTENT_CONFLICT'; end if;
 return to_jsonb(e);
end $$;
create function public.watcher_prepare_hint(p_candidate_id uuid,p_evidence_id uuid,p_expected_version bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.watcher_candidates; e public.watcher_candidate_evidence; r public.watcher_article_revisions; h public.watcher_hints;
begin
 select * into strict c from public.watcher_candidates where id=p_candidate_id for update;
 if p_expected_version is null or c.version<>p_expected_version or c.status<>'EXPECTED_BR' then raise exception 'WATCHER_HINT_NOT_READY'; end if;
 select * into strict e from public.watcher_candidate_evidence where id=p_evidence_id and candidate_id=c.id;
 if e.assertion<>'BR_CONFIRMED' or e.actor_id is null or e.candidate_version<>c.version then raise exception 'WATCHER_HINT_NOT_READY'; end if;
 select * into strict r from public.watcher_article_revisions where id=e.revision_id;
 perform 1 from public.watcher_feed_items where id=r.feed_item_id and current_revision_id=r.id for share;
 if not found then raise exception 'WATCHER_HINT_NOT_READY'; end if;
 insert into public.watcher_hints(candidate_id,candidate_version,evidence_id,payload) values(c.id,c.version,e.id,
 jsonb_build_object('schemaVersion','watcher-brand-hint/1','watcherCandidateId',c.id::text,'brand',c.brand,'market','BR','modelHint',c.model_hint,'projectCode',c.project_code,'aliases',c.aliases,'evidenceFingerprint',r.evidence_fingerprint)) on conflict(candidate_id,candidate_version,evidence_id) do nothing;
 select * into strict h from public.watcher_hints where candidate_id=c.id and candidate_version=c.version and evidence_id=e.id;
 return to_jsonb(h);
end $$;
create function public.watcher_query(p_kind text,p_filter text default null,p_limit integer default 25,p_offset integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'WATCHER_INVALID_PAGE'; end if;
 case p_kind
 when 'SOURCES' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select * from public.watcher_sources order by id limit p_limit offset p_offset)t;
 when 'STATE' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select st.*,s.config_version from public.watcher_source_state st join public.watcher_sources s on s.id=st.source_id where st.source_id=p_filter)t;
 when 'ARTICLES' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select * from public.watcher_articles order by last_seen_at desc,id limit p_limit offset p_offset)t;
 when 'REVISIONS' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select * from public.watcher_article_revisions where article_id=p_filter::uuid order by first_observed_at desc,id limit p_limit offset p_offset)t;
 when 'SOURCE_ITEMS' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select f.*,r.item_payload,r.evidence_fingerprint from public.watcher_feed_items f join public.watcher_article_revisions r on r.id=f.current_revision_id where f.source_id=p_filter order by f.item_key limit p_limit offset p_offset)t;
 when 'SOURCE_REVISIONS' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select r.* from public.watcher_article_revisions r join public.watcher_feed_items f on f.id=r.feed_item_id where f.source_id=p_filter order by r.first_observed_at,r.id limit p_limit offset p_offset)t;
 when 'BATCHES' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select * from public.watcher_batches where source_id=p_filter order by observed_at desc,id limit p_limit offset p_offset)t;
 when 'CANDIDATES' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select * from public.watcher_candidates order by updated_at desc,id limit p_limit offset p_offset)t;
 when 'EVIDENCE' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select * from public.watcher_candidate_evidence where candidate_id=p_filter::uuid order by created_at,id limit p_limit offset p_offset)t;
 else raise exception 'WATCHER_INVALID_QUERY'; end case;
 return result;
end $$;
-- RPCs are server-only. No SECURITY DEFINER, role mutation, remote environment detection or jobs.
revoke all on function
 public.watcher_register_source(jsonb,jsonb,bigint),
 public.watcher_claim_source(text,text,integer),
 public.watcher_release_source(text,uuid,text),
 public.watcher_array_digest(text,text[]),
 public.watcher_batch_receipt(public.watcher_batches,boolean),
 public.watcher_persist_batch(uuid,uuid,bigint,bigint,jsonb),
 public.watcher_stage_candidate(jsonb,bigint),
 public.watcher_attach_evidence(jsonb),
 public.watcher_prepare_hint(uuid,uuid,bigint),
 public.watcher_query(text,text,integer,integer)
 from public,anon,authenticated;
grant execute on function
 public.watcher_register_source(jsonb,jsonb,bigint),
 public.watcher_claim_source(text,text,integer),
 public.watcher_release_source(text,uuid,text),
 public.watcher_array_digest(text,text[]),
 public.watcher_batch_receipt(public.watcher_batches,boolean),
 public.watcher_persist_batch(uuid,uuid,bigint,bigint,jsonb),
 public.watcher_stage_candidate(jsonb,bigint),
 public.watcher_attach_evidence(jsonb),
 public.watcher_prepare_hint(uuid,uuid,bigint),
 public.watcher_query(text,text,integer,integer)
 to service_role;
commit;
