begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_table('public','pricing_import_processing_jobs','processing jobs table exists');
select ok((select relrowsecurity from pg_class where oid='public.pricing_import_processing_jobs'::regclass),'jobs use RLS');
select is((select count(*) from pg_policy where polrelid='public.pricing_import_processing_jobs'::regclass),0::bigint,'jobs remain deny by default');
select ok(not has_table_privilege('anon','public.pricing_import_processing_jobs','SELECT') and not has_table_privilege('authenticated','public.pricing_import_processing_jobs','SELECT') and has_table_privilege('service_role','public.pricing_import_processing_jobs','SELECT,INSERT,UPDATE'),'job grants are server-only');
select ok(not has_function_privilege('public','public.claim_import_processing_job(bigint,uuid,uuid,uuid,integer)','EXECUTE') and not has_function_privilege('anon','public.claim_import_processing_job(bigint,uuid,uuid,uuid,integer)','EXECUTE') and has_function_privilege('service_role','public.claim_import_processing_job(bigint,uuid,uuid,uuid,integer)','EXECUTE'),'claim RPC is server-only');
select ok((select prosecdef and proconfig=array['search_path=""']::text[] from pg_proc where oid='public.claim_import_processing_job(bigint,uuid,uuid,uuid,integer)'::regprocedure),'claim RPC is hardened');

insert into auth.users(id,email,raw_user_meta_data) values('a2000000-0000-4000-8000-000000000001','sprint10c@example.invalid','{"full_name":"Sprint 10C"}');
update public.profiles set role='admin',status='active',accepted_at=pg_catalog.now() where id='a2000000-0000-4000-8000-000000000001';
insert into storage.objects(id,bucket_id,name,owner,metadata) values
('d2000000-0000-4000-8000-000000000001','import-engine-documents','commercial_letters/31000000-0000-4000-8000-000000000001/32000000-0000-4000-8000-000000000001/carta.pdf','a2000000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":100}');

create temporary table hardening(batch_id bigint,job_id bigint,correlation_id uuid,token uuid);
with created as (
  select public.create_import_engine_batch('10C hardening','commercial_letters',date '2026-08-01',null,'31000000-0000-4000-8000-000000000001',
  '[{"documentType":"pdf","originalFileName":"Carta.pdf","storageBucket":"import-engine-documents","storageObjectPath":"commercial_letters/31000000-0000-4000-8000-000000000001/32000000-0000-4000-8000-000000000001/carta.pdf","mimeType":"application/pdf","fileSizeBytes":100,"contentSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","sourceOrder":1,"documentRole":"primary","duplicateAcknowledged":false}]',
  'a2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001') payload
), queued as (
  select (payload->>'batchId')::bigint batch_id, public.enqueue_import_processing_job((payload->>'batchId')::bigint,'1','fake','1','commercial-letter/mmv-payload/1','a2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000002') job from created
)
insert into hardening select batch_id,(job->>'jobId')::bigint,'c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000003' from queued;

select is((select attempt from public.pricing_import_processing_jobs where id=(select job_id from hardening)),1,'enqueue creates attempt 1');
select is((select public.enqueue_import_processing_job(batch_id,'1','fake','1','commercial-letter/mmv-payload/1','a2000000-0000-4000-8000-000000000001',correlation_id)->>'idempotentReplay' from hardening),'true','active enqueue is replayed');
select lives_ok(format('select public.claim_import_processing_job(%s,%L,%L,%L,300)',(select job_id from hardening),(select token from hardening),'a2000000-0000-4000-8000-000000000001',(select correlation_id from hardening)),'valid claim succeeds');
select is((select status::text from public.pricing_import_batches where id=(select batch_id from hardening)),'extracting','claim moves batch to extracting');
select is((select public.enqueue_import_processing_job(batch_id,'1','fake','1','commercial-letter/mmv-payload/1','a2000000-0000-4000-8000-000000000001',correlation_id)->>'jobId' from hardening),(select job_id::text from hardening),'enqueue returns the active processing job while batch is extracting');
select throws_ok(format('select public.claim_import_processing_job(%s,%L,%L,%L,300)',(select job_id from hardening),'c2000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001',(select correlation_id from hardening)),'55000','processing job cannot be claimed','second worker cannot claim a valid lease');

update public.pricing_import_processing_jobs set claimed_at=pg_catalog.now()-interval '10 minutes',claim_expires_at=pg_catalog.now()-interval '5 minutes' where id=(select job_id from hardening);
select lives_ok(format('select public.claim_import_processing_job(%s,%L,%L,%L,300)',(select job_id from hardening),'c2000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000001',(select correlation_id from hardening)),'expired lease can be reclaimed');
update hardening set token='c2000000-0000-4000-8000-000000000005';
select throws_ok(format('select public.finalize_import_processing_job(%s,%L,%L::jsonb,%L,%L::jsonb,%L,%L)',(select job_id from hardening),'c2000000-0000-4000-8000-000000000003','[]','fake','{}','a2000000-0000-4000-8000-000000000001',(select correlation_id from hardening)),'55000','processing claim is invalid or expired','old worker cannot finalize after reclaim');

select throws_ok(format('select public.finalize_import_processing_job(%s,%L,%L::jsonb,%L,%L::jsonb,%L,%L)',(select job_id from hardening),(select token from hardening),
  '[{"sourceRowNumber":1,"sourcePage":1,"rawPayload":{"schemaVersion":"commercial-letter/mmv-payload/1"},"normalizedPayload":{"schemaVersion":"commercial-letter/mmv-payload/1"},"confidenceScore":80,"matchedProductId":null,"status":"unmatched","issueCodes":[]},{"sourceRowNumber":1,"sourcePage":1,"rawPayload":{"schemaVersion":"commercial-letter/mmv-payload/1"},"normalizedPayload":{"schemaVersion":"commercial-letter/mmv-payload/1"},"confidenceScore":80,"matchedProductId":null,"status":"unmatched","issueCodes":[]}]','fake-run','{"inputUnits":10,"outputUnits":2}','a2000000-0000-4000-8000-000000000001',(select correlation_id from hardening)),
  '23505',null,'row failure aborts atomic finalize');
select is((select count(*) from public.pricing_import_rows where batch_id=(select batch_id from hardening)),0::bigint,'failed finalize leaves no partial rows');

update public.pricing_import_batches set status='ready' where id=(select batch_id from hardening);
select throws_ok(format('select public.finalize_import_processing_job(%s,%L,%L::jsonb,%L,%L::jsonb,%L,%L)',(select job_id from hardening),(select token from hardening),
  '[{"sourceRowNumber":1,"sourcePage":1,"rawPayload":{"schemaVersion":"commercial-letter/mmv-payload/1"},"normalizedPayload":{"schemaVersion":"commercial-letter/mmv-payload/1"},"confidenceScore":80,"matchedProductId":null,"status":"unmatched","issueCodes":[]}]','fake-run','{}','a2000000-0000-4000-8000-000000000001',(select correlation_id from hardening)),
  '55000','batch is not extracting','worker cannot overwrite a concurrently changed batch');
update public.pricing_import_batches set status='extracting' where id=(select batch_id from hardening);

select lives_ok(format('select public.finalize_import_processing_job(%s,%L,%L::jsonb,%L,%L::jsonb,%L,%L)',(select job_id from hardening),(select token from hardening),
  '[{"sourceRowNumber":1,"sourcePage":1,"rawPayload":{"schemaVersion":"commercial-letter/mmv-payload/1"},"normalizedPayload":{"schemaVersion":"commercial-letter/mmv-payload/1"},"confidenceScore":80,"matchedProductId":null,"status":"unmatched","issueCodes":["PRODUCT_UNMATCHED"]}]','fake-run','{"inputUnits":10,"outputUnits":1}','a2000000-0000-4000-8000-000000000001',(select correlation_id from hardening)),'valid finalize succeeds');
select is((select status::text from public.pricing_import_processing_jobs where id=(select job_id from hardening)),'succeeded','job succeeds');
select is((select status::text from public.pricing_import_batches where id=(select batch_id from hardening)),'needs_review','batch reaches needs_review after rows');
select is((select status::text from public.pricing_import_documents where batch_id=(select batch_id from hardening)),'processed','documents are processed');
select is((select count(*) from public.pricing_import_rows where generation_job_id=(select job_id from hardening)),1::bigint,'row lineage points to job');
select is((select public.finalize_import_processing_job(job_id,token,'[]','ignored','{}','a2000000-0000-4000-8000-000000000001',correlation_id)->>'idempotentReplay' from hardening),'true','finalize replay after commit is safe');
select is((select count(*) from public.pricing_audit_events where correlation_id=(select correlation_id from hardening) and aggregate_type='pricing_import_processing_job'),4::bigint,'enqueue claim reclaim and success are audited');
select is((select count(*) from public.pricing_audit_events where correlation_id=(select correlation_id from hardening) and aggregate_type='pricing_import_batch'),3::bigint,'batch extraction reclaim and review transitions are audited');
select ok((select updated_at is not null and lock_version>1 from public.pricing_import_processing_jobs where id=(select job_id from hardening)),'job mutation maintains timestamp and increments audit version');

insert into public.pricing_import_batches(source_type,idempotency_key,schema_version,status,plugin_key,dossier_title,competence,created_by,updated_by)
values('document_upload','41000000-0000-4000-8000-000000000001','import-engine/batch/1','ready','commercial_letters','Failure retry',date '2026-08-01','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001');
insert into public.pricing_import_documents(batch_id,document_type,original_file_name,storage_bucket,storage_object_path,mime_type,file_size_bytes,content_sha256,status,source_order,document_role,created_by,updated_by)
select id,'pdf','failure.pdf','import-engine-documents','commercial_letters/41000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000001/failure.pdf','application/pdf',100,'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','ready',1,'primary','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001'
from public.pricing_import_batches where idempotency_key='41000000-0000-4000-8000-000000000001';
create temporary table retry_case(batch_id bigint,first_job bigint,second_job bigint,correlation_id uuid,token uuid);
insert into retry_case(batch_id,correlation_id,token)
select id,'c2000000-0000-4000-8000-000000000010','c2000000-0000-4000-8000-000000000011' from public.pricing_import_batches where idempotency_key='41000000-0000-4000-8000-000000000001';
update retry_case set first_job=(public.enqueue_import_processing_job(batch_id,'1','fake','1','commercial-letter/mmv-payload/1','a2000000-0000-4000-8000-000000000001',correlation_id)->>'jobId')::bigint;
select lives_ok(format('select public.claim_import_processing_job(%s,%L,%L,%L,300)',(select first_job from retry_case),(select token from retry_case),'a2000000-0000-4000-8000-000000000001',(select correlation_id from retry_case)),'failure case is claimed');
select throws_ok(format('select public.fail_import_processing_job(%s,%L,%L,%L,%L,%L)',(select first_job from retry_case),'c2000000-0000-4000-8000-000000000099','INVALID','invalid','a2000000-0000-4000-8000-000000000001',(select correlation_id from retry_case)),'55000','processing claim is invalid or expired','wrong token cannot fail job');
select lives_ok(format('select public.fail_import_processing_job(%s,%L,%L,%L,%L,%L)',(select first_job from retry_case),(select token from retry_case),'PROVIDER_ERROR','safe failure','a2000000-0000-4000-8000-000000000001',(select correlation_id from retry_case)),'valid failure is recorded');
select is((select status::text from public.pricing_import_batches where id=(select batch_id from retry_case)),'failed','failure moves batch to failed');
select is((select status::text from public.pricing_import_documents where batch_id=(select batch_id from retry_case)),'failed','failure moves documents to failed');
update retry_case set correlation_id='c2000000-0000-4000-8000-000000000012',token='c2000000-0000-4000-8000-000000000013';
update retry_case set second_job=(public.enqueue_import_processing_job(batch_id,'1','fake','1','commercial-letter/mmv-payload/1','a2000000-0000-4000-8000-000000000001',correlation_id)->>'jobId')::bigint;
select is((select attempt from public.pricing_import_processing_jobs where id=(select second_job from retry_case)),2,'retry creates attempt 2');
select is((select count(*) from public.pricing_import_processing_jobs where batch_id=(select batch_id from retry_case)),2::bigint,'retry preserves prior attempt');
select lives_ok(format('select public.claim_import_processing_job(%s,%L,%L,%L,300)',(select second_job from retry_case),(select token from retry_case),'a2000000-0000-4000-8000-000000000001',(select correlation_id from retry_case)),'retry claim restores documents and extraction');
select is((select count(*) from public.pricing_audit_events where correlation_id='c2000000-0000-4000-8000-000000000010' and aggregate_type='pricing_import_processing_job'),3::bigint,'failed attempt audit is reconstructable');

insert into public.pricing_import_batches(source_type,idempotency_key,schema_version,status,plugin_key,dossier_title,competence,created_by,updated_by)
values('document_upload','41000000-0000-4000-8000-000000000099','import-engine/batch/1','extracting','commercial_letters','Extracting without job',date '2026-08-01','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001');
select throws_ok(format('select public.enqueue_import_processing_job(%s,%L,%L,%L,%L,%L,%L)',(select id from public.pricing_import_batches where idempotency_key='41000000-0000-4000-8000-000000000099'),'1','fake','1','commercial-letter/mmv-payload/1','a2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000099'),'55000','batch is not eligible for extraction','extracting batch without an active job remains rejected');

select * from finish();
rollback;
