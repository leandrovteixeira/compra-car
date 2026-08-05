begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_table('public', 'pricing_import_documents', 'Import Engine document table exists');
select columns_are(
  'public', 'pricing_import_documents',
  array[
    'id','batch_id','document_type','original_file_name','storage_bucket','storage_object_path',
    'mime_type','file_size_bytes','content_sha256','page_count','status','source_order',
    'document_role','provider_metadata','index_payload','error_code','error_message','lock_version',
    'created_at','updated_at','created_by','updated_by'
  ],
  'document columns match the Import Engine contract'
);
select col_is_fk('public','pricing_import_documents','batch_id','document belongs to one batch');
select col_is_unique('public','pricing_import_documents',array['batch_id','content_sha256'],'hash is unique inside a batch');
select col_is_unique('public','pricing_import_documents',array['batch_id','source_order'],'source order is unique inside a batch');
select ok(
  (select relrowsecurity from pg_class where oid='public.pricing_import_documents'::regclass),
  'RLS is enabled on documents'
);
select ok(
  not has_table_privilege('anon','public.pricing_import_documents','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.pricing_import_documents','SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role','public.pricing_import_documents','SELECT,INSERT,UPDATE'),
  'browser roles cannot access documents and service role has server access'
);
select is(
  (select count(*) from pg_policy where polrelid='public.pricing_import_documents'::regclass),
  0::bigint,
  'documents remain deny-by-default without browser policies'
);
select is(
  (select public from storage.buckets where id='import-engine-documents'),
  false,
  'Import Engine bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id='import-engine-documents'),
  33554432::bigint,
  'bucket enforces the 32 MiB limit'
);
select is(
  (select allowed_mime_types from storage.buckets where id='import-engine-documents'),
  array['application/pdf']::text[],
  'bucket accepts only PDF'
);
select is(
  (select count(*) from pg_policy where polrelid='storage.objects'::regclass
    and (pg_get_expr(polqual,polrelid) like '%import-engine-documents%'
      or pg_get_expr(polwithcheck,polrelid) like '%import-engine-documents%')),
  0::bigint,
  'no browser Storage policy exposes the private bucket'
);

select has_function(
  'public','create_import_engine_batch',
  array['text','text','date','text','text','jsonb','uuid','uuid'],
  'atomic Import Engine batch RPC exists'
);
select ok(
  (select prosecdef from pg_proc where oid='public.create_import_engine_batch(text,text,date,text,text,jsonb,uuid,uuid)'::regprocedure),
  'batch RPC is security definer'
);
select is(
  (select proconfig from pg_proc where oid='public.create_import_engine_batch(text,text,date,text,text,jsonb,uuid,uuid)'::regprocedure),
  array['search_path=""']::text[],
  'batch RPC has empty search_path'
);
select ok(
  has_function_privilege('service_role','public.create_import_engine_batch(text,text,date,text,text,jsonb,uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.create_import_engine_batch(text,text,date,text,text,jsonb,uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.create_import_engine_batch(text,text,date,text,text,jsonb,uuid,uuid)','EXECUTE'),
  'only service role can call batch RPC'
);
select has_function(
  'public','add_import_engine_documents',
  array['bigint','integer','uuid','jsonb','uuid','uuid'],
  'atomic add-documents RPC exists'
);
select ok(
  (select prosecdef from pg_proc where oid='public.add_import_engine_documents(bigint,integer,uuid,jsonb,uuid,uuid)'::regprocedure)
  and (select proconfig from pg_proc where oid='public.add_import_engine_documents(bigint,integer,uuid,jsonb,uuid,uuid)'::regprocedure) = array['search_path=""']::text[]
  and has_function_privilege('service_role','public.add_import_engine_documents(bigint,integer,uuid,jsonb,uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.add_import_engine_documents(bigint,integer,uuid,jsonb,uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.add_import_engine_documents(bigint,integer,uuid,jsonb,uuid,uuid)','EXECUTE'),
  'add-documents RPC is hardened and server-only'
);

insert into auth.users (id,email,raw_user_meta_data) values
  ('a1000000-0000-4000-8000-000000000001','import-admin@example.invalid','{"full_name":"Import Admin"}'),
  ('a1000000-0000-4000-8000-000000000002','import-seller@example.invalid','{"full_name":"Import Seller"}');
update public.profiles set role='admin',status='active',accepted_at=pg_catalog.now()
  where id='a1000000-0000-4000-8000-000000000001';
update public.profiles set role='seller',status='active',accepted_at=pg_catalog.now()
  where id='a1000000-0000-4000-8000-000000000002';

insert into storage.objects(id,bucket_id,name,owner,metadata) values
  ('d1000000-0000-4000-8000-000000000001','import-engine-documents',
   'commercial_letters/11000000-0000-4000-8000-000000000001/12000000-0000-4000-8000-000000000001/carta.pdf',
   'a1000000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":100}'::jsonb);

create temporary table import_result(payload jsonb);
insert into import_result select public.create_import_engine_batch(
  'Jeep — Julho/2026','commercial_letters',date '2026-07-01','Carta principal',
  '11000000-0000-4000-8000-000000000001',
  '[{"documentType":"pdf","originalFileName":"Carta.pdf","storageBucket":"import-engine-documents","storageObjectPath":"commercial_letters/11000000-0000-4000-8000-000000000001/12000000-0000-4000-8000-000000000001/carta.pdf","mimeType":"application/pdf","fileSizeBytes":100,"contentSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sourceOrder":1,"documentRole":"primary","duplicateAcknowledged":false}]'::jsonb,
  'a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001'
);

select is((select payload->>'status' from import_result),'ready','valid dossier reaches ready');
select is(
  (select count(*) from public.pricing_import_batches where id=(select (payload->>'batchId')::bigint from import_result)
    and plugin_key='commercial_letters' and source_type='document_upload' and status='ready'
    and dossier_title='Jeep — Julho/2026' and competence=date '2026-07-01'),
  1::bigint,
  'batch stores explicit plugin and dossier fields'
);
select is(
  (select count(*) from public.pricing_import_documents where batch_id=(select (payload->>'batchId')::bigint from import_result)
    and status='ready' and document_role='primary' and file_size_bytes=100),
  1::bigint,
  'document metadata and lifecycle are persisted'
);
select is(
  (select count(*) from public.pricing_audit_events where correlation_id='c1000000-0000-4000-8000-000000000001'
    and aggregate_type in ('pricing_import_batch','pricing_import_document')),
  3::bigint,
  'batch creation records append-only dossier and document audit events'
);

select is(
  (select public.create_import_engine_batch(
    'Jeep — Julho/2026','commercial_letters',date '2026-07-01','retry',
    '11000000-0000-4000-8000-000000000001','[]'::jsonb,
    'a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002'
  )->>'idempotentReplay')::boolean,
  true,
  'retry returns the existing batch before revalidating transient input'
);

select throws_ok(
  $$select public.create_import_engine_batch(
    'Unauthorized','commercial_letters',date '2026-07-01',null,
    '11000000-0000-4000-8000-000000000002','[]'::jsonb,
    'a1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000003')$$,
  '42501',null,'seller cannot create a dossier'
);
select is(
  (select count(*) from public.pricing_import_batches where idempotency_key='11000000-0000-4000-8000-000000000002'),
  0::bigint,
  'unauthorized creation writes nothing'
);

insert into storage.objects(id,bucket_id,name,owner,metadata) values
  ('d1000000-0000-4000-8000-000000000002','import-engine-documents',
   'commercial_letters/21000000-0000-4000-8000-000000000001/22000000-0000-4000-8000-000000000001/errata.pdf',
   'a1000000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":80}'::jsonb);
create temporary table add_result(payload jsonb);
insert into add_result select public.add_import_engine_documents(
  (select (payload->>'batchId')::bigint from import_result),2,
  '21000000-0000-4000-8000-000000000001',
  '[{"documentType":"pdf","originalFileName":"Errata.pdf","storageBucket":"import-engine-documents","storageObjectPath":"commercial_letters/21000000-0000-4000-8000-000000000001/22000000-0000-4000-8000-000000000001/errata.pdf","mimeType":"application/pdf","fileSizeBytes":80,"contentSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","sourceOrder":1,"documentRole":"errata","duplicateAcknowledged":false}]'::jsonb,
  'a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000007'
);
select is(
  (select count(*) from public.pricing_import_documents
    where batch_id=(select (payload->>'batchId')::bigint from import_result)
      and source_order=2 and document_role='errata' and status='ready'),
  1::bigint,
  'a validated document can be added with the next source order'
);
select is(
  (select count(*) from public.pricing_audit_events
    where correlation_id='c1000000-0000-4000-8000-000000000007'),
  2::bigint,
  'adding a document audits both document and dossier'
);
select is(
  (select public.add_import_engine_documents(
    (select (payload->>'batchId')::bigint from import_result),2,
    '21000000-0000-4000-8000-000000000001','[]'::jsonb,
    'a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000008'
  )->>'idempotentReplay')::boolean,
  true,
  'add-documents retry returns the committed operation before CAS validation'
);
select throws_ok(
  format(
    'select public.add_import_engine_documents(%s,3,%L,%L::jsonb,%L,%L)',
    (select (payload->>'batchId')::bigint from import_result),
    '21000000-0000-4000-8000-000000000002','[]',
    'a1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000009'
  ),
  '42501',null,'seller cannot add documents'
);

select lives_ok(
  format(
    'select public.update_import_engine_document_role(%s,%L,1,%L,%L)',
    (select (payload->'documentIds'->>0)::bigint from import_result),
    'errata','a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000004'
  ),
  'document role can be changed with the expected lock'
);
select throws_ok(
  format(
    'select public.update_import_engine_document_role(%s,%L,1,%L,%L)',
    (select (payload->'documentIds'->>0)::bigint from import_result),
    'primary','a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000005'
  ),
  '40001',null,'stale document role update is rejected'
);
select throws_ok(
  format('delete from public.pricing_import_documents where id=%s',(select (payload->'documentIds'->>0)::bigint from import_result)),
  '55000','pricing import documents are retained for audit','physical document deletion is blocked'
);

select lives_ok(
  format(
    'select public.archive_import_engine_batch(%s,3,%L,%L,%L)',
    (select (payload->>'batchId')::bigint from import_result),
    'Teste de arquivamento','a1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000006'
  ),
  'ready dossier can be archived with CAS and reason'
);
select is(
  (select status::text from public.pricing_import_documents where id=(select (payload->'documentIds'->>0)::bigint from import_result)),
  'archived','archiving a dossier logically archives its documents'
);

select * from finish();
rollback;
