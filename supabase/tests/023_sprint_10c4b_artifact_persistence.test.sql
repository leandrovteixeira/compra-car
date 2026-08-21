begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_table('public','pricing_import_processing_artifacts','artifact manifests exist');
select has_table('public','pricing_import_processing_artifact_dependencies','artifact DAG junction exists');
select has_column('public','pricing_import_processing_artifacts','content_sha256','manifest has content hash');
select has_column('public','pricing_import_processing_artifacts','retry_of_artifact_id','manifest has retry lineage');
select has_column('public','pricing_import_processing_artifacts','supersedes_artifact_id','manifest has supersession lineage');
select col_is_pk('public','pricing_import_processing_artifacts','id','artifact ID is primary key');
select col_is_pk('public','pricing_import_processing_artifact_dependencies',array['artifact_id','source_artifact_id'],'dependency edge is unique');
select has_index('public','pricing_import_processing_artifacts','pricing_import_processing_artifacts_job_stage_idx','latest-stage lookup is indexed');
select has_index('public','pricing_import_processing_artifact_dependencies','pricing_import_processing_artifact_dependencies_source_idx','reverse lineage is indexed');
select col_is_fk('public','pricing_import_processing_artifacts','batch_id','batch FK exists');
select col_is_fk('public','pricing_import_processing_artifacts','processing_job_id','job FK exists');
select col_is_fk('public','pricing_import_processing_artifacts','document_id','document FK exists');
select col_is_fk('public','pricing_import_processing_artifact_dependencies','source_artifact_id','source FK exists');

select ok((select relrowsecurity from pg_class where oid='public.pricing_import_processing_artifacts'::regclass),'manifest RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.pricing_import_processing_artifact_dependencies'::regclass),'dependency RLS enabled');
select is((select count(*) from pg_policy where polrelid='public.pricing_import_processing_artifacts'::regclass),0::bigint,'manifest has zero policies');
select is((select count(*) from pg_policy where polrelid='public.pricing_import_processing_artifact_dependencies'::regclass),0::bigint,'dependency has zero policies');
select ok(not has_table_privilege('public','public.pricing_import_processing_artifacts','SELECT')
  and not has_table_privilege('anon','public.pricing_import_processing_artifacts','SELECT')
  and not has_table_privilege('authenticated','public.pricing_import_processing_artifacts','SELECT')
  and has_table_privilege('service_role','public.pricing_import_processing_artifacts','SELECT,INSERT,UPDATE')
  and not has_table_privilege('service_role','public.pricing_import_processing_artifacts','DELETE'),'manifest grants are server-only and exclude delete');
select ok(has_table_privilege('service_role','public.pricing_import_processing_artifact_dependencies','SELECT,INSERT')
  and not has_table_privilege('service_role','public.pricing_import_processing_artifact_dependencies','UPDATE,DELETE'),'dependency grants exclude mutation and delete');

select ok((select bool_and(prosecdef and proconfig=array['search_path=""']::text[])
  from pg_proc where proname in ('reserve_import_processing_artifact','start_import_processing_artifact','succeed_import_processing_artifact','fail_import_processing_artifact','attach_import_processing_artifact_dependencies')),
  'artifact RPCs are security definer with empty search_path');
select ok((select bool_and(has_function_privilege('service_role',oid,'EXECUTE')
  and not has_function_privilege('public',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE')
  and not has_function_privilege('authenticated',oid,'EXECUTE')) from pg_proc
  where proname in ('reserve_import_processing_artifact','start_import_processing_artifact','succeed_import_processing_artifact','fail_import_processing_artifact','attach_import_processing_artifact_dependencies')),
  'artifact RPC execution is service_role only');
select ok((select bool_and(not has_function_privilege(role_name,signature,'EXECUTE')) from
  (values ('public'),('anon'),('authenticated'),('service_role')) roles(role_name) cross join
  (values ('public.protect_import_processing_artifact()'),('public.validate_import_processing_artifact_dependency()'),
    ('public.protect_import_processing_artifact_dependency()')) functions(signature)),
  'artifact trigger helpers cannot be executed directly');
select ok((select not public and file_size_limit=8388608 and allowed_mime_types=array['application/json']::text[]
  from storage.buckets where id='import-processing-artifacts'),'artifact bucket is private and JSON-only');
select is((select count(*) from pg_catalog.pg_policies where schemaname='storage' and (qual like '%import-processing-artifacts%' or with_check like '%import-processing-artifacts%')),0::bigint,'artifact bucket has no client policy');

insert into auth.users(id,email,raw_user_meta_data)
values('b4000000-0000-4000-8000-000000000001','artifact-admin@example.invalid','{"full_name":"Artifact Admin"}');
update public.profiles set role='admin',status='active',accepted_at=pg_catalog.now()
where id='b4000000-0000-4000-8000-000000000001';
insert into public.pricing_import_batches(source_type,idempotency_key,schema_version,status,plugin_key,dossier_title,competence,created_by,updated_by)
values('document_upload','b4000000-0000-4000-8000-000000000010','import-engine/batch/1','extracting','commercial_letters','Artifact persistence',date '2026-08-01','b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001');
insert into public.pricing_import_processing_jobs(batch_id,attempt,status,plugin_key,plugin_version,provider_key,provider_version,schema_version,
  claim_token,claimed_at,claim_expires_at,correlation_id,created_by,updated_by)
select id,1,'processing','commercial_letters','1','fake','1','commercial-letter/mmv-payload/1',
  'b4000000-0000-4000-8000-000000000020',pg_catalog.now(),pg_catalog.now()+interval '10 minutes',
  'b4000000-0000-4000-8000-000000000030','b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001'
from public.pricing_import_batches where idempotency_key='b4000000-0000-4000-8000-000000000010';
create temporary table artifact_case(batch_id bigint,job_id bigint,job_lock integer,artifact_id bigint,artifact_lock integer);
insert into artifact_case(batch_id,job_id,job_lock)
select b.id,j.id,j.lock_version from public.pricing_import_batches b join public.pricing_import_processing_jobs j on j.batch_id=b.id
where b.idempotency_key='b4000000-0000-4000-8000-000000000010';

with reserved as (
  select public.reserve_import_processing_artifact(
    p_artifact_key=>'artifact-'||repeat('a',64),p_batch_id=>batch_id,p_processing_job_id=>job_id,p_document_id=>null,p_unit_id=>null,
    p_stage=>'document_map',p_manifest_schema_version=>'SegmentedImportArtifactManifest/1',p_artifact_schema_version=>'DocumentMapArtifact/1',
    p_artifact_version=>1,p_pipeline_version=>'segmented-import/1',p_attempt=>1,p_content_sha256=>repeat('b',64),p_content_size_bytes=>17,
    p_storage_bucket=>'import-processing-artifacts',p_storage_object_path=>batch_id||'/'||job_id||'/document_map/artifact-'||repeat('a',64)||'.json',
    p_idempotency_key=>'segmented-artifact-'||repeat('c',64),p_retry_of_artifact_id=>null,p_supersedes_artifact_id=>null,
    p_provider=>'fake',p_provider_version=>'1',p_prompt_version=>'1',p_model=>'fake-model',p_source_artifact_ids=>array[]::bigint[],
    p_claim_token=>'b4000000-0000-4000-8000-000000000020',p_expected_job_lock_version=>job_lock,
    p_actor_id=>'b4000000-0000-4000-8000-000000000001',p_correlation_id=>'b4000000-0000-4000-8000-000000000030') payload from artifact_case
) update artifact_case set artifact_id=(reserved.payload->>'artifactId')::bigint,artifact_lock=(reserved.payload->>'lockVersion')::integer from reserved;
select is((select status from public.pricing_import_processing_artifacts where id=(select artifact_id from artifact_case)),'queued','reserve creates queued manifest');
select is((select public.reserve_import_processing_artifact(
    p_artifact_key=>'artifact-'||repeat('a',64),p_batch_id=>batch_id,p_processing_job_id=>job_id,p_document_id=>null,p_unit_id=>null,
    p_stage=>'document_map',p_manifest_schema_version=>'SegmentedImportArtifactManifest/1',p_artifact_schema_version=>'DocumentMapArtifact/1',
    p_artifact_version=>1,p_pipeline_version=>'segmented-import/1',p_attempt=>1,p_content_sha256=>repeat('b',64),p_content_size_bytes=>17,
    p_storage_bucket=>'import-processing-artifacts',p_storage_object_path=>batch_id||'/'||job_id||'/document_map/artifact-'||repeat('a',64)||'.json',
    p_idempotency_key=>'segmented-artifact-'||repeat('c',64),p_retry_of_artifact_id=>null,p_supersedes_artifact_id=>null,
    p_provider=>'fake',p_provider_version=>'1',p_prompt_version=>'1',p_model=>'fake-model',p_source_artifact_ids=>array[]::bigint[],
    p_claim_token=>'b4000000-0000-4000-8000-000000000020',p_expected_job_lock_version=>job_lock,
    p_actor_id=>'b4000000-0000-4000-8000-000000000001',p_correlation_id=>'b4000000-0000-4000-8000-000000000030')->>'idempotentReplay' from artifact_case),'true','double reserve is replay-safe');
select lives_ok((select format('select public.start_import_processing_artifact(%s,%L,%s,%L,%L)',artifact_id,'b4000000-0000-4000-8000-000000000020',artifact_lock,'b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000030') from artifact_case),'queued artifact starts');
update artifact_case set artifact_lock=(select lock_version from public.pricing_import_processing_artifacts where id=artifact_id);
select lives_ok((select format('select public.succeed_import_processing_artifact(%s,%L,%s,%L,%s,%L,%L,%L,%L::jsonb,%s,%L,%L)',artifact_id,
  'b4000000-0000-4000-8000-000000000020',artifact_lock,repeat('b',64),17,'import-processing-artifacts',
  batch_id||'/'||job_id||'/document_map/artifact-'||repeat('a',64)||'.json','safe-run','{"inputUnits":3,"outputUnits":2,"totalUnits":5}',10,
  'b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000030') from artifact_case),'processing artifact succeeds');
select is((select status from public.pricing_import_processing_artifacts where id=(select artifact_id from artifact_case)),'succeeded','artifact is succeeded');
select throws_ok(format('update public.pricing_import_processing_artifacts set content_size_bytes=18 where id=%s',(select artifact_id from artifact_case)),
  '55000','terminal processing artifact is immutable','succeeded artifact is immutable');
select is((select count(*) from public.pricing_audit_events where aggregate_type='pricing_import_processing_artifact' and aggregate_id=(select artifact_id from artifact_case)),3::bigint,'queued processing and succeeded use small audit events');
select ok((select bool_and(after_snapshot ? 'artifactId' and not after_snapshot ? 'body') from public.pricing_audit_events where aggregate_type='pricing_import_processing_artifact'),'artifact audits never contain body');

create temporary table retry_artifact(id bigint,lock_version integer);
with reserved as (
  select public.reserve_import_processing_artifact(
    p_artifact_key=>'artifact-'||repeat('f',64),p_batch_id=>batch_id,p_processing_job_id=>job_id,p_document_id=>null,p_unit_id=>null,
    p_stage=>'document_map',p_manifest_schema_version=>'SegmentedImportArtifactManifest/1',p_artifact_schema_version=>'DocumentMapArtifact/1',
    p_artifact_version=>1,p_pipeline_version=>'segmented-import/1',p_attempt=>1,p_content_sha256=>repeat('1',64),p_content_size_bytes=>2,
    p_storage_bucket=>'import-processing-artifacts',p_storage_object_path=>batch_id||'/'||job_id||'/document_map/artifact-'||repeat('f',64)||'.json',
    p_idempotency_key=>'segmented-artifact-'||repeat('2',64),p_retry_of_artifact_id=>null,p_supersedes_artifact_id=>null,
    p_provider=>'fake',p_provider_version=>'1',p_prompt_version=>null,p_model=>null,p_source_artifact_ids=>array[]::bigint[],
    p_claim_token=>'b4000000-0000-4000-8000-000000000020',p_expected_job_lock_version=>job_lock,
    p_actor_id=>'b4000000-0000-4000-8000-000000000001',p_correlation_id=>'b4000000-0000-4000-8000-000000000030') payload from artifact_case
) insert into retry_artifact select (payload->>'artifactId')::bigint,(payload->>'lockVersion')::integer from reserved;
select lives_ok((select format('select public.fail_import_processing_artifact(%s,%L,%s,%L,%L,%s,%L,%L)',id,
  'b4000000-0000-4000-8000-000000000020',lock_version,'provider_error','Authorization: bearer x',5,
  'b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000030') from retry_artifact),'queued artifact can fail safely');
select ok((select status='failed' and error_code='PROVIDER_ERROR' and error_message='[REDACTED]'
  from public.pricing_import_processing_artifacts where id=(select id from retry_artifact)),'failed diagnostic is bounded and redacted');
with retried as (
  select public.reserve_import_processing_artifact(
    p_artifact_key=>'artifact-'||repeat('3',64),p_batch_id=>c.batch_id,p_processing_job_id=>c.job_id,p_document_id=>null,p_unit_id=>null,
    p_stage=>'document_map',p_manifest_schema_version=>'SegmentedImportArtifactManifest/1',p_artifact_schema_version=>'DocumentMapArtifact/1',
    p_artifact_version=>1,p_pipeline_version=>'segmented-import/1',p_attempt=>2,p_content_sha256=>repeat('4',64),p_content_size_bytes=>2,
    p_storage_bucket=>'import-processing-artifacts',p_storage_object_path=>c.batch_id||'/'||c.job_id||'/document_map/artifact-'||repeat('3',64)||'.json',
    p_idempotency_key=>'segmented-artifact-'||repeat('5',64),p_retry_of_artifact_id=>r.id,p_supersedes_artifact_id=>null,
    p_provider=>'fake',p_provider_version=>'1',p_prompt_version=>null,p_model=>null,p_source_artifact_ids=>array[]::bigint[],
    p_claim_token=>'b4000000-0000-4000-8000-000000000020',p_expected_job_lock_version=>c.job_lock,
    p_actor_id=>'b4000000-0000-4000-8000-000000000001',p_correlation_id=>'b4000000-0000-4000-8000-000000000030') payload
  from artifact_case c cross join retry_artifact r
) select is((payload->>'status')::text,'queued','retry creates a new queued artifact') from retried;
select is((select count(*) from public.pricing_import_processing_artifacts where retry_of_artifact_id=(select id from retry_artifact)),1::bigint,'retry lineage preserves failed attempt');

create temporary table dependent_artifact(id bigint);
with dependent as (
  select public.reserve_import_processing_artifact(
    p_artifact_key=>'artifact-'||repeat('6',64),p_batch_id=>batch_id,p_processing_job_id=>job_id,p_document_id=>null,p_unit_id=>null,
    p_stage=>'unit_plan',p_manifest_schema_version=>'SegmentedImportArtifactManifest/1',p_artifact_schema_version=>'UnitPlanArtifact/1',
    p_artifact_version=>1,p_pipeline_version=>'segmented-import/1',p_attempt=>1,p_content_sha256=>repeat('7',64),p_content_size_bytes=>2,
    p_storage_bucket=>'import-processing-artifacts',p_storage_object_path=>batch_id||'/'||job_id||'/unit_plan/artifact-'||repeat('6',64)||'.json',
    p_idempotency_key=>'segmented-artifact-'||repeat('8',64),p_retry_of_artifact_id=>null,p_supersedes_artifact_id=>null,
    p_provider=>null,p_provider_version=>null,p_prompt_version=>null,p_model=>null,p_source_artifact_ids=>array[artifact_id],
    p_claim_token=>'b4000000-0000-4000-8000-000000000020',p_expected_job_lock_version=>job_lock,
    p_actor_id=>'b4000000-0000-4000-8000-000000000001',p_correlation_id=>'b4000000-0000-4000-8000-000000000030') payload from artifact_case
) insert into dependent_artifact select (payload->>'artifactId')::bigint from dependent;
select is((select count(*) from public.pricing_import_processing_artifact_dependencies where artifact_id=(select id from dependent_artifact)),1::bigint,'valid predecessor dependency is persisted');
select throws_ok(format('insert into public.pricing_import_processing_artifact_dependencies(artifact_id,source_artifact_id,ordinal) values(%s,%s,98)',
  (select id from dependent_artifact),(select id from retry_artifact)),'55000','artifact dependency must be succeeded','non-succeeded dependency is rejected');

insert into public.pricing_import_batches(source_type,idempotency_key,schema_version,status,plugin_key,dossier_title,competence,created_by,updated_by)
values('document_upload','b4000000-0000-4000-8000-000000000040','import-engine/batch/1','ready','commercial_letters','Cross batch source',date '2026-08-01','b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001');
create temporary table cross_source(id bigint);
with cross_job as (
  insert into public.pricing_import_processing_jobs(batch_id,attempt,status,plugin_key,plugin_version,provider_key,provider_version,schema_version,correlation_id,created_by,updated_by)
  select id,1,'queued','commercial_letters','1','fake','1','commercial-letter/mmv-payload/1','b4000000-0000-4000-8000-000000000041','b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001'
  from public.pricing_import_batches where idempotency_key='b4000000-0000-4000-8000-000000000040' returning id,batch_id
), artifact as (
  insert into public.pricing_import_processing_artifacts(artifact_key,batch_id,processing_job_id,stage,status,manifest_schema_version,artifact_schema_version,artifact_version,pipeline_version,attempt,correlation_id,content_sha256,content_size_bytes,storage_bucket,storage_object_path,idempotency_key,provider,provider_version,started_at,completed_at,created_by,updated_by)
  select 'artifact-'||repeat('b',64),batch_id,id,'document_map','succeeded','SegmentedImportArtifactManifest/1','DocumentMapArtifact/1',1,'segmented-import/1',1,
    'b4000000-0000-4000-8000-000000000041',repeat('c',64),2,'import-processing-artifacts',batch_id||'/'||id||'/document_map/artifact-'||repeat('b',64)||'.json',
    'segmented-artifact-'||repeat('d',64),'fake','1',pg_catalog.now(),pg_catalog.now(),'b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001' from cross_job returning id
) insert into cross_source select id from artifact;
select throws_ok(format('insert into public.pricing_import_processing_artifact_dependencies(artifact_id,source_artifact_id,ordinal) values(%s,%s,97)',
  (select id from dependent_artifact),(select id from cross_source)),'23514','artifact dependency must belong to the same batch and job','cross-batch dependency is rejected');

select throws_ok(format('insert into public.pricing_import_processing_artifact_dependencies(artifact_id,source_artifact_id,ordinal) values(%s,%s,99)',
  (select id from dependent_artifact),(select id from dependent_artifact)),'23514',null,'self dependency is rejected');

update public.pricing_import_processing_artifacts set status='processing',started_at=pg_catalog.now() where id=(select id from dependent_artifact);
update public.pricing_import_processing_artifacts set status='succeeded',completed_at=pg_catalog.now() where id=(select id from dependent_artifact);
create temporary table cycle_target(id bigint);
with inserted as (
  insert into public.pricing_import_processing_artifacts(artifact_key,batch_id,processing_job_id,stage,status,manifest_schema_version,artifact_schema_version,artifact_version,pipeline_version,attempt,correlation_id,content_sha256,content_size_bytes,storage_bucket,storage_object_path,idempotency_key,provider,provider_version,created_by,updated_by)
  select 'artifact-'||repeat('9',64),batch_id,job_id,'document_map','queued','SegmentedImportArtifactManifest/1','DocumentMapArtifact/1',1,'segmented-import/1',1,
    'b4000000-0000-4000-8000-000000000030',repeat('e',64),2,'import-processing-artifacts',batch_id||'/'||job_id||'/document_map/artifact-'||repeat('9',64)||'.json',
    'segmented-artifact-'||repeat('0',64),'fake','1','b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001' from artifact_case returning id
) insert into cycle_target select id from inserted;
set local session_replication_role='replica';
insert into public.pricing_import_processing_artifact_dependencies(artifact_id,source_artifact_id,ordinal)
select d.id,c.id,99 from dependent_artifact d cross join cycle_target c;
set local session_replication_role='origin';
select throws_ok(format('insert into public.pricing_import_processing_artifact_dependencies(artifact_id,source_artifact_id,ordinal) values(%s,%s,0)',
  (select id from cycle_target),(select id from dependent_artifact)),'23514','artifact dependency cycle is forbidden','cycle is rejected by recursive DB guard');

select throws_ok(format($q$insert into public.pricing_import_processing_artifacts(artifact_key,batch_id,processing_job_id,stage,manifest_schema_version,artifact_schema_version,artifact_version,pipeline_version,attempt,correlation_id,content_sha256,content_size_bytes,storage_bucket,storage_object_path,idempotency_key,provider,provider_version,usage_metadata,created_by,updated_by)
values('artifact-%s',%s,%s,'document_map','SegmentedImportArtifactManifest/1','DocumentMapArtifact/1',1,'segmented-import/1',1,%L,repeat('d',64),1,'import-processing-artifacts','%s/%s/document_map/artifact-%s.json','segmented-artifact-%s','fake','1','{"raw":1}',%L,%L)$q$,
repeat('d',64),(select batch_id from artifact_case),(select job_id from artifact_case),'b4000000-0000-4000-8000-000000000030',(select batch_id from artifact_case),(select job_id from artifact_case),repeat('d',64),repeat('e',64),'b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001'),
  '23514',null,'arbitrary provider metadata is rejected');
select throws_ok(format('delete from public.pricing_import_processing_artifacts where id=%s',(select artifact_id from artifact_case)),
  '55000','processing artifacts are retained for audit','artifact delete is guarded even for owner');

select * from finish();
rollback;
