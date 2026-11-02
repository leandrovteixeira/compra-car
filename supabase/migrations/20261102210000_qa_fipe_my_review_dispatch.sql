-- QA S26: FIPE/My common agent_findings inbox + guarded dispatch.
-- No unconditional automatic OpenAI calls. Idempotent candidate-level findings.
create or replace function public.qa_stage_fipe_review_findings(p_brand text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_run uuid:=gen_random_uuid();
 v_now timestamptz:=now();
 v_map record; v_my record; v_finding uuid;
 v_count integer:=0;
begin
 if p_brand is null or length(btrim(p_brand)) not between 1 and 100 then
   raise exception 'FIPE_BRAND_REQUIRED';
 end if;
 if not exists(
   select 1 from public.agent_fipe_mapping_candidates c
   join public.catalog_mmvs m on m.id=c.mmv_id
   where lower(m.brand)=lower(btrim(p_brand))
     and c.decision in ('PENDING','DEFER')
     and not exists(select 1 from public.agent_findings f
       where f.finding_type='FIPE_MAPPING_CANDIDATE'
         and f.subject->>'candidateId'=c.id::text)
 ) and not exists(
   select 1 from public.agent_fipe_model_year_candidates c
   join public.catalog_mmvs m on m.id=c.mmv_id
   join public.catalog_mmv_fipe_mappings mp on mp.mmv_id=c.mmv_id
     and mp.fipe_code=c.fipe_code and mp.status='CONFIRMED'
   where lower(m.brand)=lower(btrim(p_brand))
     and c.decision in ('PENDING','DEFER')
     and not exists(select 1 from public.agent_findings f
       where f.finding_type='FIPE_MODEL_YEAR_CANDIDATE'
         and f.subject->>'candidateId'=c.id::text)
 ) then return null; end if;
 insert into public.agent_runs(id,agent_type,status,market,brand,provider,run_mode,
     schema_version,started_at,completed_at,input,summary)
 values(v_run,'FIPE_DISCOVERY','COMPLETED','BR',btrim(p_brand),
   'deterministic','FIPE_REVIEW_STAGING','FIPE-REV-1',v_now,v_now,
   pg_catalog.jsonb_build_object('brand',p_brand),
   pg_catalog.jsonb_build_object('aiCalls',0,'httpRequests',0,'reviewStaging',true));

 for v_map in
  select c.*,m.brand,m.model,m.official_version_label
  from public.agent_fipe_mapping_candidates c
  join public.catalog_mmvs m on m.id=c.mmv_id
  where lower(m.brand)=lower(btrim(p_brand)) and c.decision in ('PENDING','DEFER')
    and not exists(select 1 from public.agent_findings f
      where f.finding_type='FIPE_MAPPING_CANDIDATE'
        and f.subject->>'candidateId'=c.id::text)
  order by c.created_at,c.id
 loop
  v_finding:=gen_random_uuid();
  insert into public.agent_findings(id,run_id,finding_type,fingerprint,subject_key,
    title,summary,confidence,requires_review,subject,proposal,payload)
  values(v_finding,v_run,'FIPE_MAPPING_CANDIDATE',
    md5('fipe-map:'||v_map.id::text),v_map.mmv_id::text||':'||v_map.fipe_code,
    v_map.brand||' '||v_map.model||' — FIPE '||v_map.fipe_code,
    'Código FIPE candidato: '||v_map.fipe_model_label||'. Conferir identidade antes de aprovar.',
    v_map.match_confidence,true,
    pg_catalog.jsonb_build_object('candidateId',v_map.id,'mmvId',v_map.mmv_id,
      'brand',v_map.brand,'model',v_map.model,'version',v_map.official_version_label),
    pg_catalog.jsonb_build_object('action','REVIEW_FIPE_MAPPING',
      'candidateId',v_map.id,'mmvId',v_map.mmv_id,'fipeCode',v_map.fipe_code),
    pg_catalog.jsonb_build_object('source','FIPE','reviewDecision',v_map.decision,
      'sourceUrl',v_map.source_url,'provider',v_map.provider));
  insert into public.agent_evidence(id,finding_id,source_type,source_url,source_domain,
    title,excerpt,evidence_fingerprint,metadata,captured_at)
  values(gen_random_uuid(),v_finding,'FIPE',
    v_map.source_url,pg_catalog.split_part(pg_catalog.split_part(v_map.source_url,'/',3),':',1),
    'Candidato código FIPE',left(v_map.fipe_model_label,900),
    md5('fipe-map:'||v_map.id::text||':'||v_map.fipe_code),
    pg_catalog.jsonb_build_object('candidateId',v_map.id,'provider',v_map.provider),v_now);
  v_count:=v_count+1;
 end loop;

 for v_my in
  select c.*,m.brand,m.model,m.official_version_label
  from public.agent_fipe_model_year_candidates c
  join public.catalog_mmvs m on m.id=c.mmv_id
  join public.catalog_mmv_fipe_mappings mp on mp.mmv_id=c.mmv_id
    and mp.fipe_code=c.fipe_code and mp.status='CONFIRMED'
  where lower(m.brand)=lower(btrim(p_brand)) and c.decision in ('PENDING','DEFER')
    and not exists(select 1 from public.agent_findings f
      where f.finding_type='FIPE_MODEL_YEAR_CANDIDATE'
        and f.subject->>'candidateId'=c.id::text)
  order by c.created_at,c.id
 loop
  v_finding:=gen_random_uuid();
  insert into public.agent_findings(id,run_id,finding_type,fingerprint,subject_key,
    title,summary,confidence,requires_review,subject,proposal,payload)
  values(v_finding,v_run,'FIPE_MODEL_YEAR_CANDIDATE',
    md5('fipe-my:'||v_my.id::text),v_my.mmv_id::text||':'||v_my.model_year::text,
    v_my.brand||' '||v_my.model||' — FIPE MY'||v_my.model_year::text,
    'Ano-modelo FIPE '||v_my.model_year::text||' para código '||v_my.fipe_code||
      '. A aprovação registra o MY, não prova comercialização atual.',
    0.90,true,
    pg_catalog.jsonb_build_object('candidateId',v_my.id,'mmvId',v_my.mmv_id,
      'brand',v_my.brand,'model',v_my.model,'modelYear',v_my.model_year),
    pg_catalog.jsonb_build_object('action','REVIEW_FIPE_MY','candidateId',v_my.id,
      'mmvId',v_my.mmv_id,'modelYear',v_my.model_year,'fipeCode',v_my.fipe_code),
    pg_catalog.jsonb_build_object('source','FIPE','priceIsMSRP',false,
      'sourceUrl',v_my.source_url,'valuationBrl',v_my.valuation_brl));
  insert into public.agent_evidence(id,finding_id,source_type,source_url,source_domain,
    title,excerpt,evidence_fingerprint,metadata,captured_at)
  values(gen_random_uuid(),v_finding,'FIPE',
    v_my.source_url,pg_catalog.split_part(pg_catalog.split_part(v_my.source_url,'/',3),':',1),
    'Ano-modelo FIPE','Código '||v_my.fipe_code||'; MY '||v_my.model_year::text,
    md5('fipe-my:'||v_my.id::text||':'||v_my.model_year::text),
    pg_catalog.jsonb_build_object('candidateId',v_my.id,'provider','parallelum-v2'),v_now);
  v_count:=v_count+1;
 end loop;
 update public.agent_runs set summary=summary||
   pg_catalog.jsonb_build_object('findings',v_count,'reviewRequired',v_count)
 where id=v_run;
 return v_run;
end $$;
revoke all on function public.qa_stage_fipe_review_findings(text) from public,anon,authenticated;
grant execute on function public.qa_stage_fipe_review_findings(text) to service_role;

-- Review-sync hook reuses existing FIPE candidate acceptance procedure.
create or replace function public.qa_sync_fipe_reviews()
returns trigger language plpgsql security definer set search_path='' as $$
declare f record; c record; existing_id uuid; brand_name text;
begin
 select id,finding_type,subject,proposal into f
   from public.agent_findings where id=new.finding_id;
 if not found or f.finding_type not in
   ('FIPE_MAPPING_CANDIDATE','FIPE_MODEL_YEAR_CANDIDATE') then return new; end if;
 if new.reviewed_by is null then raise exception 'FIPE_OPERATOR_REVIEW_REQUIRED'; end if;
 if new.decision not in ('ACCEPT','REJECT','DEFER') then
   raise exception 'FIPE_REVIEW_DECISION_INVALID'; end if;
 if f.proposal->>'candidateId' is distinct from f.subject->>'candidateId' then
   raise exception 'FIPE_REVIEW_STALE_PROPOSAL'; end if;
 if f.finding_type='FIPE_MAPPING_CANDIDATE' then
   perform public.s26_decide_fipe_candidate(
     (f.subject->>'candidateId')::uuid,new.decision,new.reviewed_by);
   if new.decision='ACCEPT' then
     select m.brand into brand_name
       from public.agent_fipe_mapping_candidates c
       join public.catalog_mmvs m on m.id=c.mmv_id
       where c.id=(f.subject->>'candidateId')::uuid;
     perform public.qa_stage_fipe_review_findings(brand_name);
   end if;
 else
   select c.* into c from public.agent_fipe_model_year_candidates c
     where c.id=(f.subject->>'candidateId')::uuid for update;
   if not found or c.mmv_id::text is distinct from f.subject->>'mmvId'
     or c.model_year::text is distinct from f.subject->>'modelYear'
     or c.fipe_code is distinct from f.proposal->>'fipeCode'
     then raise exception 'FIPE_MY_CANDIDATE_STALE'; end if;
   if c.decision='ACCEPT' and new.decision<>'ACCEPT' then
     raise exception 'FIPE_MY_ALREADY_APPLIED'; end if;
   if new.decision='ACCEPT' then
     if not exists(select 1 from public.catalog_mmv_fipe_mappings mp
       where mp.mmv_id=c.mmv_id and mp.fipe_code=c.fipe_code
         and mp.status='CONFIRMED')
       then raise exception 'FIPE_MY_MAPPING_NOT_CONFIRMED'; end if;
     select id into existing_id from public.catalog_mmv_model_years
       where mmv_id=c.mmv_id and model_year=c.model_year limit 1;
     if existing_id is null then
       insert into public.catalog_mmv_model_years(mmv_id,production_year,
         model_year,status,confidence,source_finding_id,
         last_confirmed_finding_id,created_by)
       values(c.mmv_id,null,c.model_year,'UNKNOWN',0.90,f.id,f.id,new.reviewed_by);
     end if;
   end if;
   update public.agent_fipe_model_year_candidates
     set decision=new.decision,reviewed_by=new.reviewed_by,reviewed_at=now()
     where id=c.id;
 end if;
 return new;
end $$;
drop trigger if exists qa_sync_fipe_reviews_after_review on public.agent_reviews;
create trigger qa_sync_fipe_reviews_after_review
after insert on public.agent_reviews for each row
execute function public.qa_sync_fipe_reviews();

-- Scoped zero-AI dispatcher. Brand-wide MMV completion no longer queues MY.
-- FIPE runs once per MMV over 30 days, then MY only when eligibility is ELIGIBLE
-- and FIPE has been attempted without a candidate. A human-approved
-- on-sale MMV or explicit bootstrap dispatcher invocation is required.
create or replace function public.qa_dispatch_fipe_my(
  p_brand text,p_mmv_id uuid default null,p_allow_paid_my boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_target record; n_fipe integer:=0; n_my integer:=0; n_blocked integer:=0; e text;
begin
 if p_brand is null or length(btrim(p_brand)) not between 1 and 100 then
   raise exception 'FIPE_DISPATCH_BRAND_REQUIRED'; end if;
 for v_target in
   select catalog.id,catalog.brand,e.eligibility
   from public.catalog_mmvs catalog
   join public.agent_my_launch_eligibility e on e.mmv_id=catalog.id
   where catalog.market='BR' and catalog.status='ACTIVE'
    and lower(catalog.brand)=lower(btrim(p_brand))
    and (p_mmv_id is null or catalog.id=p_mmv_id)
   order by catalog.created_at,catalog.id limit 20
 loop
  if v_target.eligibility='HAS_CANONICAL_MY' then continue; end if;
  if v_target.eligibility='ELIGIBLE' and
     not exists(select 1 from public.agent_jobs j
        where j.job_type='FIPE_DISCOVERY'
          and j.status='COMPLETED'
          and j.input->>'mmvId'=v_target.id::text
          and j.completed_at>now()-interval '30 days')
   then
    if not exists(select 1 from public.agent_jobs j
        where j.job_type='FIPE_DISCOVERY'
          and j.status in ('QUEUED','RUNNING')
          and j.input->>'mmvId'=v_target.id::text) then
      insert into public.agent_jobs(job_type,status,market,brand,input)
       values('FIPE_DISCOVERY','QUEUED','BR',v_target.brand,
         pg_catalog.jsonb_build_object('mmvId',v_target.id,'reason','MMV_CANONICAL_FIPE_FIRST'));
      n_fipe:=n_fipe+1;
    end if;
  elsif v_target.eligibility='ELIGIBLE' and p_allow_paid_my
     and not exists(select 1 from public.agent_jobs j
       where j.job_type='PRODUCT_YEAR' and j.status in ('QUEUED','RUNNING')
         and j.input->>'mmvId'=v_target.id::text)
  then
    insert into public.agent_jobs(job_type,status,market,brand,input)
     values('PRODUCT_YEAR','QUEUED','BR',v_target.brand,
       pg_catalog.jsonb_build_object('mmvId',v_target.id,'provider','openai',
         'reason','FIPE_UNAVAILABLE_MY_RESEARCH'));
    n_my:=n_my+1;
  else
    n_blocked:=n_blocked+1;
  end if;
 end loop;
 return pg_catalog.jsonb_build_object('fipeQueued',n_fipe,'myQueued',n_my,
   'blockedOrPending',n_blocked,'paidMyEnabled',p_allow_paid_my);
end $$;
revoke all on function public.qa_dispatch_fipe_my(text,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.qa_dispatch_fipe_my(text,uuid,boolean) to service_role;

-- Disable old MMV→MY brand-wide shortcut. Routing now occurs only via scoped
-- dispatcher after appropriate operator decision, not on research completion.
create or replace function public.enqueue_product_year_job(
 p_brand text,p_created_by uuid,p_parent_run_id uuid
) returns public.agent_jobs language plpgsql set search_path='' as $$
begin
 raise exception 'LEGACY_MMV_TO_MY_DISABLED_USE_FIPE_DISPATCH';
end $$;
