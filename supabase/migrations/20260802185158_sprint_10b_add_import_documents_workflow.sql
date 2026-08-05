-- Preserve every aggregate type already authorized before extending Import Engine audit.
alter table public.pricing_audit_events
  drop constraint pricing_audit_events_aggregate_type_check;
alter table public.pricing_audit_events
  add constraint pricing_audit_events_aggregate_type_check check (
    aggregate_type in (
      'product_public_price',
      'financial_parameter_set',
      'commercial_policy',
      'commercial_policy_application',
      'commercial_policy_accumulator',
      'commercial_offer',
      'pricing_import_batch',
      'pricing_import_row',
      'pricing_import_document'
    )
  );

create function public.add_import_engine_documents(
  p_batch_id bigint,
  p_expected_lock_version integer,
  p_operation_id uuid,
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
  batch_before public.pricing_import_batches%rowtype;
  batch_after public.pricing_import_batches%rowtype;
  document_record public.pricing_import_documents%rowtype;
  item jsonb;
  document_ids jsonb := '[]'::jsonb;
  existing_ids jsonb;
  current_count integer;
  added_count integer;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or p_operation_id is null or p_expected_lock_version is null then
    raise exception using errcode = '22004', message = 'add documents requires correlation, operation and lock keys';
  end if;

  select pg_catalog.jsonb_agg(id order by source_order)
    into existing_ids
    from public.pricing_import_documents
   where batch_id = p_batch_id
     and provider_metadata->>'uploadOperationId' = p_operation_id::text;
  if existing_ids is not null then
    return pg_catalog.jsonb_build_object(
      'batchId', p_batch_id,
      'documentIds', existing_ids,
      'idempotentReplay', true
    );
  end if;

  select * into batch_before
    from public.pricing_import_batches
   where id = p_batch_id
     and plugin_key = 'commercial_letters'
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'import dossier not found';
  end if;
  if batch_before.lock_version <> p_expected_lock_version then
    raise exception using errcode = '40001', message = 'stale import batch lock version';
  end if;
  if batch_before.status not in ('uploaded', 'ready') then
    raise exception using errcode = '55000', message = 'import dossier does not accept new documents';
  end if;
  if pg_catalog.jsonb_typeof(p_documents) <> 'array' then
    raise exception using errcode = '22023', message = 'documents must be an array';
  end if;
  added_count := pg_catalog.jsonb_array_length(p_documents);
  select count(*) into current_count
    from public.pricing_import_documents
   where batch_id = p_batch_id;
  if added_count < 1 or current_count + added_count > 20 then
    raise exception using errcode = '22023', message = 'an import dossier accepts at most 20 documents';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_documents) d(value)
    group by value->>'contentSha256' having count(*) > 1
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
       or item->>'documentRole' not in (
         'primary','errata','complement','financial_appendix','trade_in_appendix','technical_appendix','other'
       ) then
      raise exception using errcode = '22023', message = 'invalid import document metadata';
    end if;
    if not exists (
      select 1 from storage.objects
       where bucket_id = item->>'storageBucket'
         and name = item->>'storageObjectPath'
    ) then
      raise exception using errcode = '23503', message = 'import document storage object does not exist';
    end if;
    if exists (
      select 1 from public.pricing_import_documents
       where batch_id = p_batch_id
         and content_sha256 = (item->>'contentSha256')::character(64)
    ) then
      raise exception using errcode = '23505', message = 'document already belongs to this import dossier';
    end if;
    if coalesce((item->>'duplicateAcknowledged')::boolean, false) = false and exists (
      select 1 from public.pricing_import_documents
       where batch_id <> p_batch_id
         and content_sha256 = (item->>'contentSha256')::character(64)
    ) then
      raise exception using errcode = '23505', message = 'document already belongs to another import dossier';
    end if;
  end loop;

  for item in select value from pg_catalog.jsonb_array_elements(p_documents)
  loop
    insert into public.pricing_import_documents (
      batch_id, document_type, original_file_name, storage_bucket, storage_object_path,
      mime_type, file_size_bytes, content_sha256, status, source_order, document_role,
      provider_metadata, created_by, updated_by
    ) values (
      p_batch_id, 'pdf', pg_catalog.btrim(item->>'originalFileName'),
      item->>'storageBucket', item->>'storageObjectPath', item->>'mimeType',
      (item->>'fileSizeBytes')::bigint, (item->>'contentSha256')::character(64), 'ready',
      current_count + (item->>'sourceOrder')::integer,
      (item->>'documentRole')::public.pricing_import_document_role,
      pg_catalog.jsonb_build_object(
        'duplicateAcknowledged', coalesce((item->>'duplicateAcknowledged')::boolean, false),
        'uploadOperationId', p_operation_id
      ),
      p_actor_id, p_actor_id
    ) returning * into document_record;
    document_ids := document_ids || pg_catalog.jsonb_build_array(document_record.id);
    insert into public.pricing_audit_events (
      aggregate_type, aggregate_id, action, after_snapshot, reason, actor_id, correlation_id
    ) values (
      'pricing_import_document', document_record.id, 'insert', pg_catalog.to_jsonb(document_record),
      'validated PDF added to import dossier', p_actor_id, p_correlation_id
    );
  end loop;

  update public.pricing_import_batches
     set status = 'ready',
         metadata = metadata || pg_catalog.jsonb_build_object(
           'documentCount', current_count + added_count,
           'lastUploadOperationId', p_operation_id,
           'correlationId', p_correlation_id
         ),
         updated_by = p_actor_id
   where id = p_batch_id
   returning * into batch_after;
  insert into public.pricing_audit_events (
    aggregate_type, aggregate_id, action, before_snapshot, after_snapshot, reason, actor_id, correlation_id
  ) values (
    'pricing_import_batch', p_batch_id, 'update', pg_catalog.to_jsonb(batch_before),
    pg_catalog.to_jsonb(batch_after), 'documents added to import dossier', p_actor_id, p_correlation_id
  );

  return pg_catalog.jsonb_build_object(
    'batchId', p_batch_id,
    'documentIds', document_ids,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.add_import_engine_documents(bigint,integer,uuid,jsonb,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.add_import_engine_documents(bigint,integer,uuid,jsonb,uuid,uuid)
  to service_role;
