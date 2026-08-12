-- Competence is an optional operator hint during physical ingestion. The column and its
-- month-boundary constraint already accept null, so only the RPC validation changes.
create or replace function public.create_import_engine_batch(
  p_title text,
  p_plugin_key text,
  p_competence date,
  p_notes text,
  p_idempotency_key text,
  p_documents jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_record public.pricing_import_batches%rowtype;
  document_record public.pricing_import_documents%rowtype;
  item jsonb;
  document_ids jsonb := '[]'::jsonb;
  total integer;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or nullif(pg_catalog.btrim(p_idempotency_key), '') is null then
    raise exception using errcode = '22004', message = 'import batch requires correlation and idempotency keys';
  end if;
  select * into batch_record from public.pricing_import_batches
    where idempotency_key = pg_catalog.btrim(p_idempotency_key);
  if found then
    return pg_catalog.jsonb_build_object(
      'batchId', batch_record.id, 'status', batch_record.status,
      'documentIds', coalesce((select pg_catalog.jsonb_agg(id order by source_order)
        from public.pricing_import_documents where batch_id = batch_record.id), '[]'::jsonb),
      'idempotentReplay', true
    );
  end if;
  if p_plugin_key <> 'commercial_letters' then
    raise exception using errcode = '22023', message = 'unsupported import plugin';
  end if;
  if nullif(pg_catalog.btrim(p_title), '') is null or pg_catalog.length(pg_catalog.btrim(p_title)) > 160 then
    raise exception using errcode = '22023', message = 'invalid import dossier title';
  end if;
  if p_competence is not null
     and p_competence <> pg_catalog.date_trunc('month', p_competence)::date then
    raise exception using errcode = '22023', message = 'invalid import competence';
  end if;
  if pg_catalog.jsonb_typeof(p_documents) <> 'array' then
    raise exception using errcode = '22023', message = 'documents must be an array';
  end if;
  total := pg_catalog.jsonb_array_length(p_documents);
  if total < 1 or total > 20 then
    raise exception using errcode = '22023', message = 'an import dossier requires between 1 and 20 documents';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_documents) d(value)
    group by value->>'contentSha256' having count(*) > 1
  ) or exists (
    select 1 from pg_catalog.jsonb_array_elements(p_documents) d(value)
    group by (value->>'sourceOrder')::integer having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'duplicate document in import dossier';
  end if;
  for item in select value from pg_catalog.jsonb_array_elements(p_documents)
  loop
    if item->>'documentType' <> 'pdf'
       or item->>'mimeType' <> 'application/pdf'
       or item->>'storageBucket' <> 'import-engine-documents'
       or (item->>'fileSizeBytes')::bigint <= 0
       or (item->>'fileSizeBytes')::bigint > 33554432
       or item->>'contentSha256' !~ '^[0-9a-f]{64}$'
       or (item->>'sourceOrder')::integer <= 0
       or item->>'documentRole' not in (
         'primary','errata','complement','financial_appendix','trade_in_appendix','technical_appendix','other'
       ) then
      raise exception using errcode = '22023', message = 'invalid import document metadata';
    end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = item->>'storageBucket' and name = item->>'storageObjectPath'
    ) then
      raise exception using errcode = '23503', message = 'import document storage object does not exist';
    end if;
    if coalesce((item->>'duplicateAcknowledged')::boolean, false) = false and exists (
      select 1 from public.pricing_import_documents
      where content_sha256 = (item->>'contentSha256')::character(64)
    ) then
      raise exception using errcode = '23505', message = 'document already belongs to another import dossier';
    end if;
  end loop;

  insert into public.pricing_import_batches (
    source_type, idempotency_key, schema_version, status, metadata,
    plugin_key, dossier_title, competence, notes, created_by, updated_by
  ) values (
    'document_upload', pg_catalog.btrim(p_idempotency_key), 'import-engine/batch/1', 'uploaded',
    pg_catalog.jsonb_build_object('kind','import_engine','documentCount',total,'correlationId',p_correlation_id),
    p_plugin_key, pg_catalog.btrim(p_title), p_competence, nullif(pg_catalog.btrim(p_notes), ''),
    p_actor_id, p_actor_id
  ) returning * into batch_record;

  insert into public.pricing_audit_events (
    aggregate_type, aggregate_id, action, after_snapshot, reason, actor_id, correlation_id
  ) values (
    'pricing_import_batch', batch_record.id, 'insert', pg_catalog.to_jsonb(batch_record),
    'import dossier created', p_actor_id, p_correlation_id
  );

  for item in select value from pg_catalog.jsonb_array_elements(p_documents)
  loop
    insert into public.pricing_import_documents (
      batch_id, document_type, original_file_name, storage_bucket, storage_object_path,
      mime_type, file_size_bytes, content_sha256, status, source_order, document_role,
      provider_metadata, created_by, updated_by
    ) values (
      batch_record.id, (item->>'documentType')::public.pricing_import_document_type,
      pg_catalog.btrim(item->>'originalFileName'), item->>'storageBucket', item->>'storageObjectPath',
      item->>'mimeType', (item->>'fileSizeBytes')::bigint,
      (item->>'contentSha256')::character(64), 'ready', (item->>'sourceOrder')::integer,
      (item->>'documentRole')::public.pricing_import_document_role,
      pg_catalog.jsonb_build_object('duplicateAcknowledged',coalesce((item->>'duplicateAcknowledged')::boolean,false)),
      p_actor_id, p_actor_id
    ) returning * into document_record;
    document_ids := document_ids || pg_catalog.jsonb_build_array(document_record.id);
    insert into public.pricing_audit_events (
      aggregate_type, aggregate_id, action, after_snapshot, reason, actor_id, correlation_id
    ) values (
      'pricing_import_document', document_record.id, 'insert', pg_catalog.to_jsonb(document_record),
      'validated PDF stored privately', p_actor_id, p_correlation_id
    );
  end loop;

  update public.pricing_import_batches set status = 'ready', updated_by = p_actor_id
    where id = batch_record.id returning * into batch_record;
  insert into public.pricing_audit_events (
    aggregate_type, aggregate_id, action, before_snapshot, after_snapshot, reason, actor_id, correlation_id
  ) values (
    'pricing_import_batch', batch_record.id, 'update',
    pg_catalog.jsonb_build_object('status','uploaded'), pg_catalog.to_jsonb(batch_record),
    'all dossier documents are validated and ready', p_actor_id, p_correlation_id
  );
  return pg_catalog.jsonb_build_object(
    'batchId', batch_record.id, 'status', batch_record.status,
    'documentIds', document_ids, 'idempotentReplay', false
  );
end;
$$;

revoke all on function public.create_import_engine_batch(text,text,date,text,text,jsonb,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_import_engine_batch(text,text,date,text,text,jsonb,uuid,uuid)
  to service_role;
