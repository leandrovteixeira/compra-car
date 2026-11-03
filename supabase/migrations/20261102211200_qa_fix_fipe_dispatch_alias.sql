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
