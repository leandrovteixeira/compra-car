create or replace function public.enqueue_import_processing_job(p_batch_id bigint,p_plugin_version text,p_provider_key text,p_provider_version text,p_schema_version text,p_actor_id uuid,p_correlation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.pricing_import_batches%rowtype; j public.pricing_import_processing_jobs%rowtype;
begin
  if p_actor_id is null or p_correlation_id is null then raise exception using errcode='22023',message='actor and correlation are required'; end if;
  select * into b from public.pricing_import_batches where id=p_batch_id for update;
  if not found then raise exception using errcode='P0002',message='batch not found'; end if;
  if b.plugin_key<>'commercial_letters' then raise exception using errcode='55000',message='batch is not eligible for extraction'; end if;
  select * into j from public.pricing_import_processing_jobs where batch_id=p_batch_id and status in ('queued','processing') order by attempt desc limit 1;
  if found then
    if j.correlation_id<>p_correlation_id then raise exception using errcode='22023',message='correlation mismatch'; end if;
    return pg_catalog.jsonb_build_object('jobId',j.id,'batchId',j.batch_id,'attempt',j.attempt,'status',j.status,'idempotentReplay',true);
  end if;
  if b.status not in ('ready','failed') then raise exception using errcode='55000',message='batch is not eligible for extraction'; end if;
  insert into public.pricing_import_processing_jobs(batch_id,attempt,plugin_key,plugin_version,provider_key,provider_version,schema_version,correlation_id,created_by,updated_by)
  values(p_batch_id,coalesce((select max(attempt)+1 from public.pricing_import_processing_jobs where batch_id=p_batch_id),1),'commercial_letters',p_plugin_version,p_provider_key,p_provider_version,p_schema_version,p_correlation_id,p_actor_id,p_actor_id) returning * into j;
  insert into public.pricing_audit_events(aggregate_type,aggregate_id,action,after_snapshot,reason,actor_id,correlation_id)
  values('pricing_import_processing_job',j.id,'insert',pg_catalog.jsonb_build_object('status',j.status,'attempt',j.attempt,'provider',j.provider_key,'providerVersion',j.provider_version,'plugin',j.plugin_key,'pluginVersion',j.plugin_version),'processing attempt queued',p_actor_id,j.correlation_id);
  return pg_catalog.jsonb_build_object('jobId',j.id,'batchId',j.batch_id,'attempt',j.attempt,'status',j.status,'idempotentReplay',false);
end $$;

revoke all on function public.enqueue_import_processing_job(bigint,text,text,text,text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.enqueue_import_processing_job(bigint,text,text,text,text,uuid,uuid) to service_role;
