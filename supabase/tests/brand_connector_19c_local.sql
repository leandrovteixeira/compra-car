-- Run after 19B and 19C on an isolated local database. No remote execution.
begin;
set local role service_role;
do $test$
declare
  target_uuid uuid := gen_random_uuid(); run_uuid uuid := gen_random_uuid();
  finding_uuid uuid := gen_random_uuid(); drift_uuid uuid := gen_random_uuid(); actor uuid := gen_random_uuid();
  p jsonb := '{"brand":"Synthetic Motors","market":"BR","allowedDomains":["synthetic.com.br"],"sourceEntries":[],"searchHints":[],"terminologyHints":[]}';
  fp text := repeat('a',64); fp2 text := repeat('b',64);
  c public.brand_connectors; c2 public.brand_connectors; review_id uuid; d text; blocked boolean;
begin
  insert into public.brand_connector_targets(id,brand,brand_key,market,origin) values(target_uuid,'Synthetic Motors','synthetic motors','BR','MANUAL');
  insert into public.agent_runs(id,agent_type,status,market,brand,started_at,completed_at) values(run_uuid,'BRAND_CONNECTOR','COMPLETED','BR','Synthetic Motors',now(),now());
  insert into public.agent_findings(id,run_id,finding_type,fingerprint,title,requires_review,subject,proposal,payload)
  values(finding_uuid,run_uuid,'NEW_BRAND_CONNECTOR','synthetic-finding','Synthetic',true,'{"brand":"Synthetic Motors","market":"BR"}',p,jsonb_build_object('connectorFingerprint',fp));
  -- OPEN, REJECT and DEFER must not activate.
  foreach d in array array['OPEN','REJECT','DEFER'] loop
    if d <> 'OPEN' then insert into public.agent_reviews(id,finding_id,decision,reviewed_by,created_at) values(gen_random_uuid(),finding_uuid,d,actor,clock_timestamp()); end if;
    blocked := false;
    begin perform public.activate_brand_connector(finding_uuid,actor,target_uuid,p,fp);
    exception when raise_exception then blocked := true; end;
    if not blocked then raise exception 'Review gate failed: %', d; end if;
  end loop;
  insert into public.agent_reviews(id,finding_id,decision,reviewed_by,created_at) values(gen_random_uuid(),finding_uuid,'ACCEPT',actor,clock_timestamp());
  if exists(select 1 from public.brand_connectors where target_id = target_uuid) then raise exception 'ACCEPT activated connector'; end if;
  update public.agent_runs set status = 'RUNNING' where id = run_uuid;
  blocked := false;
  begin perform public.activate_brand_connector(finding_uuid,actor,target_uuid,p,fp);
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Incomplete run activated'; end if;
  update public.agent_runs set status = 'COMPLETED' where id = run_uuid;
  c := public.activate_brand_connector(finding_uuid,actor,target_uuid,p,fp);
  if c.version <> 1 or c.status <> 'ACTIVE' or c.activated_by <> actor then raise exception 'Invalid v1'; end if;
  c2 := public.activate_brand_connector(finding_uuid,actor,target_uuid,p,fp);
  if c2.id <> c.id then raise exception 'Not idempotent'; end if;
  p := jsonb_set(p,'{searchHints}','["new source"]');
  insert into public.agent_findings(id,run_id,finding_type,fingerprint,title,requires_review,subject,proposal,payload)
  values(drift_uuid,run_uuid,'CONNECTOR_DRIFT','synthetic-drift','Synthetic drift',true,'{"brand":"Synthetic Motors","market":"BR"}',p,jsonb_build_object('connectorFingerprint',fp2,'previousConnectorFingerprint',fp));
  insert into public.agent_reviews(id,finding_id,decision,reviewed_by) values(gen_random_uuid(),drift_uuid,'ACCEPT',actor);
  c2 := public.activate_brand_connector(drift_uuid,actor,target_uuid,p,fp2);
  if c2.version <> 2 then raise exception 'Invalid v2'; end if;
  if (select status from public.brand_connectors where id = c.id) <> 'SUPERSEDED' then raise exception 'History not superseded'; end if;
  if (select count(*) from public.brand_connectors where target_id = target_uuid and status = 'ACTIVE') <> 1 then raise exception 'Multiple ACTIVE'; end if;
  if (select count(*) from public.brand_connectors where target_id = target_uuid) <> 2 then raise exception 'History lost'; end if;
  -- Transaction rollback retains the prior active version on invalid/stale calls.
  blocked := false;
  begin perform public.activate_brand_connector(finding_uuid,actor,target_uuid,p,fp);
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Stale activation accepted'; end if;
  raise notice 'PASS: review gates, ACCEPT separation, versioning, idempotency, history, single ACTIVE and stale rejection';
end;
$test$;
reset role;
do $security$
declare role_name text; table_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    foreach table_name in array array['brand_connector_targets','brand_connectors'] loop
      if has_table_privilege(role_name,'public.'||table_name,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Browser privilege leak'; end if;
      if not (select relrowsecurity from pg_class where oid = ('public.'||table_name)::regclass) then raise exception 'RLS disabled'; end if;
    end loop;
    if has_function_privilege(role_name,'public.activate_brand_connector(uuid,uuid,uuid,jsonb,text)','EXECUTE') then raise exception 'Browser RPC leak'; end if;
  end loop;
  raise notice 'PASS: RLS and browser privilege isolation';
end;
$security$;
rollback;
