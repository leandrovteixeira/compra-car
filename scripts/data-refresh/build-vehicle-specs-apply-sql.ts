import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'shfsjyjxmgwnlexmdkcs';
const sourceSha = '3A50FD77989C187ED465C202FB168B61E2EE846A8DAC16D1EDA4999E7F67E0B6';

function transaction(payload: string, commit: boolean): string {
  const finish = commit
    ? `commit; select jsonb_build_object('committed',true,'specs',(select count(*) from public.specs),'products',(select count(*) from public.products),'product_specs',(select count(*) from public.product_specs)) result;`
    : `rollback; select jsonb_build_object('rolled_back',true,'specs',(select count(*) from public.specs),'products',(select count(*) from public.products),'product_specs',(select count(*) from public.product_specs)) result;`;
  return `begin;
select pg_advisory_xact_lock(hashtext('vehicle-specs-data-refresh-2026-09-01'));
create temp table _payload(doc jsonb) on commit drop;
insert into _payload values ($apply$${payload}$apply$::jsonb);
do $$ begin
 if (select doc->>'projectId' from _payload)<>'${projectId}' then raise exception 'PROJECT_ID_MISMATCH'; end if;
 if (select doc->>'sourceSha256' from _payload)<>'${sourceSha}' then raise exception 'SOURCE_SHA_MISMATCH'; end if;
 if (select jsonb_array_length(doc->'specs') from _payload)<>321 or (select jsonb_array_length(doc->'products') from _payload)<>276 or (select jsonb_array_length(doc->'productSpecs') from _payload)<>37949 or (select (doc->>'pendingMalformedCount')::int from _payload)<>13 then raise exception 'PAYLOAD_COUNTS'; end if;
 if (select count(*) from public.specs)<>190 or (select count(*) from public.products)<>10 or (select count(*) from public.product_specs)<>306 then raise exception 'PRE_APPLY_COUNTS_CHANGED'; end if;
end $$;
create temp table _spec_input on commit drop as
 select (ordinality-1)::int idx,x->>'code' code,x->>'group_name' group_name,x->>'equipment_group' equipment_group,x->>'spec_set' spec_set,x->>'detail' detail,x->>'type' type,nullif(x->>'unit','') unit,nullif(x->>'value_direction','') value_direction,(x->>'unit_perceived_value')::numeric unit_perceived_value,(x->>'relative_value')::numeric relative_value,(x->>'is_baseline')::boolean is_baseline,(x->>'is_active')::boolean is_active,nullif(x->>'notes','') notes,nullif(x->>'commercial_category','') commercial_category
 from _payload,jsonb_array_elements(doc->'specs') with ordinality a(x,ordinality);
create temp table _product_input on commit drop as
 select (ordinality-1)::int idx,x->>'source_column' source_column,x->>'full_name' full_name,x->>'brand' brand,x->>'model' model,x->>'version' version,(x->>'production_year')::smallint production_year,(x->>'model_year')::smallint model_year,nullif(x->>'expected_existing_id','')::int expected_existing_id,lower(regexp_replace(btrim(x->>'brand'),'\\s+',' ','g')) brand_key,lower(regexp_replace(btrim(x->>'model'),'\\s+',' ','g')) model_key,lower(regexp_replace(btrim(x->>'version'),'\\s+',' ','g')) version_key
 from _payload,jsonb_array_elements(doc->'products') with ordinality a(x,ordinality);
create temp table _association_input on commit drop as
 select (x->>0)::int product_idx,(x->>1)::int spec_idx,nullif(x->>2,'')::numeric value,case when jsonb_typeof(x->3)='null' then null else (x->>3)::boolean end is_present
 from _payload,jsonb_array_elements(doc->'productSpecs') a(x);
create temp table _normalization_input on commit drop as
 select (x->>0)::int product_idx,(x->>1)::int spec_idx,x->>2 rule from _payload,jsonb_array_elements(doc->'normalizations') a(x);
do $$ begin
 if (select count(*) from _spec_input)<>321 or (select count(distinct code) from _spec_input)<>321 then raise exception 'SPEC_INPUT_COUNT'; end if;
 if (select count(*) from _spec_input where type='numeric')<>59 or (select count(*) from _spec_input where type='binary')<>172 or (select count(*) from _spec_input where type='scale')<>90 or (select count(*) from _spec_input where is_baseline)<>26 then raise exception 'SPEC_TYPE_COUNTS'; end if;
 if exists(select 1 from _spec_input where code in ('PW_0013','PW_0024','PW_0027','PW_0034')) then raise exception 'KGFM_ALIAS_PRESENT'; end if;
 if (select count(*) from _association_input)<>37949 or exists(select 1 from _association_input group by product_idx,spec_idx having count(*)>1) then raise exception 'ASSOCIATION_INPUT'; end if;
 if (select count(*) from _normalization_input where rule='LEGACY_MIRROR_TILT_RIGHT_BOTH_TO_BOTH')<>33 or (select count(*) from _normalization_input where rule='LEGACY_PARKING_CAMERA_RVM_360_TO_360')<>1 or (select count(*) from _normalization_input where rule='LEGACY_CO_0033_ALERT_CAN_BE_CLOSED_TRUE')<>6 or (select count(*) from _normalization_input where rule='LEGACY_SF_0041_USB_FALSE')<>6 then raise exception 'NORMALIZATION_COUNTS'; end if;
 if exists(select 1 from _product_input group by brand_key,model_key,version_key,production_year,model_year having count(*)>1) then raise exception 'SOURCE_PRODUCT_DUPLICATE'; end if;
end $$;
create temp table _pre_match on commit drop as
 select i.idx,count(p.id)::int matches,min(p.id)::int product_id from _product_input i left join public.products p on lower(regexp_replace(btrim(p.brand),'\\s+',' ','g'))=i.brand_key and lower(regexp_replace(btrim(p.model),'\\s+',' ','g'))=i.model_key and lower(regexp_replace(btrim(p.version),'\\s+',' ','g'))=i.version_key and p.production_year=i.production_year and p.model_year=i.model_year group by i.idx;
do $$ begin
 if (select count(*) from _pre_match where matches=1)<>9 or (select count(*) from _pre_match where matches=0)<>267 or exists(select 1 from _pre_match where matches>1) then raise exception 'PRE_MATCH_COUNTS'; end if;
 if exists(select 1 from _pre_match m join _product_input i using(idx) where m.matches=1 and m.product_id is distinct from i.expected_existing_id) then raise exception 'EXISTING_ID_MISMATCH'; end if;
end $$;
insert into public.specs(group_name,equipment_group,spec_set,detail,code,type,unit,value_direction,unit_perceived_value,relative_value,is_baseline,notes,is_active,commercial_category)
 select group_name,equipment_group,spec_set,detail,code,type,unit,value_direction,unit_perceived_value,relative_value,is_baseline,notes,is_active,commercial_category from _spec_input
 on conflict(code) do update set group_name=excluded.group_name,equipment_group=excluded.equipment_group,spec_set=excluded.spec_set,detail=excluded.detail,type=excluded.type,unit=excluded.unit,value_direction=excluded.value_direction,unit_perceived_value=excluded.unit_perceived_value,relative_value=excluded.relative_value,is_baseline=excluded.is_baseline,notes=excluded.notes,is_active=excluded.is_active,commercial_category=excluded.commercial_category,updated_at=clock_timestamp();
insert into public.products(brand,model,version,renavam_reference,model_year,production_year,is_active,is_public)
 select i.brand,i.model,i.version,null,i.model_year,i.production_year,true,false from _product_input i join _pre_match m using(idx) where m.matches=0;
create temp table _product_map on commit drop as
 select i.idx,min(p.id)::bigint product_id,count(*)::int matches from _product_input i join public.products p on lower(regexp_replace(btrim(p.brand),'\\s+',' ','g'))=i.brand_key and lower(regexp_replace(btrim(p.model),'\\s+',' ','g'))=i.model_key and lower(regexp_replace(btrim(p.version),'\\s+',' ','g'))=i.version_key and p.production_year=i.production_year and p.model_year=i.model_year group by i.idx;
do $$ begin
 if (select count(*) from public.specs)<>321 or (select count(distinct code) from public.specs)<>321 then raise exception 'FINAL_SPEC_COUNT'; end if;
 if (select count(*) from public.specs where type='numeric')<>59 or (select count(*) from public.specs where type='binary')<>172 or (select count(*) from public.specs where type='scale')<>90 or (select count(*) from public.specs where is_baseline)<>26 then raise exception 'FINAL_SPEC_TYPES'; end if;
 if exists(select 1 from public.specs where code in ('PW_0013','PW_0024','PW_0027','PW_0034')) then raise exception 'FINAL_KGFM_ALIAS'; end if;
 if not exists(select 1 from public.specs where code='PW_0045' and type='scale' and spec_set='Engine tech' and detail='REEV') or not exists(select 1 from public.specs where code='PW_1045' and type='scale' and spec_set='Transmission type' and detail='AT') then raise exception 'SPECIAL_SPECS_INVALID'; end if;
 if (select count(*) from public.products)<>277 or (select count(*) from _product_map)<>276 or exists(select 1 from _product_map where matches<>1) then raise exception 'FINAL_PRODUCT_MAP'; end if;
end $$;
delete from public.product_specs ps using _product_map m where ps.product_id=m.product_id;
insert into public.product_specs(product_id,equipment_id,value,is_present,input_unit)
 select pm.product_id,s.id,a.value,a.is_present,case when s.type='numeric' then s.unit else null end from _association_input a join _product_map pm on pm.idx=a.product_idx join _spec_input si on si.idx=a.spec_idx join public.specs s on s.code=si.code;
do $$ begin
 if (select count(*) from public.product_specs ps join _product_map pm on pm.product_id=ps.product_id)<>37949 then raise exception 'FINAL_ASSOCIATION_COUNT'; end if;
 if exists(select 1 from public.product_specs ps left join public.products p on p.id=ps.product_id left join public.specs s on s.id=ps.equipment_id where p.id is null or s.id is null) then raise exception 'ORPHAN_ASSOCIATION'; end if;
 if exists(select 1 from public.product_specs ps join _product_map pm on pm.product_id=ps.product_id join public.specs s on s.id=ps.equipment_id where (s.type='numeric' and (ps.value is null or ps.is_present is not null or ps.input_unit is distinct from s.unit)) or (s.type in ('binary','scale') and (ps.value is not null or ps.is_present is null or ps.input_unit is not null))) then raise exception 'TYPE_OR_UNIT_MISMATCH'; end if;
 if exists(select 1 from public.product_specs ps join _product_map pm on pm.product_id=ps.product_id join public.specs s on s.id=ps.equipment_id where s.type='scale' and ps.is_present=true group by ps.product_id,s.group_name,s.equipment_group,s.spec_set having count(*)>1) then raise exception 'SCALE_CONFLICT'; end if;
 if exists(select 1 from _normalization_input n join _product_map pm on pm.idx=n.product_idx join _spec_input si on si.idx=n.spec_idx left join public.specs s on s.code=si.code left join public.product_specs ps on ps.product_id=pm.product_id and ps.equipment_id=s.id where ps.id is null or (n.rule<>'LEGACY_SF_0041_USB_FALSE' and ps.is_present is distinct from true) or (n.rule='LEGACY_SF_0041_USB_FALSE' and ps.is_present is distinct from false)) then raise exception 'NORMALIZATION_PERSISTENCE'; end if;
 if exists(select 1 from public.product_specs ps join _product_map pm on pm.product_id=ps.product_id join public.specs s on s.id=ps.equipment_id where s.code='PW_0045') then raise exception 'HISTORICAL_PW0045_AS_REEV'; end if;
end $$;
select jsonb_build_object('transaction_valid',true,'specs',(select count(*) from public.specs),'products',(select count(*) from public.products),'target_products',(select count(*) from _product_map),'target_product_specs',(select count(*) from public.product_specs ps join _product_map pm on pm.product_id=ps.product_id),'all_product_specs',(select count(*) from public.product_specs),'normalizations',(select jsonb_object_agg(rule,c) from (select rule,count(*) c from _normalization_input group by rule)x)) validation;
${finish}`;
}

function postValidation(payload: string): string {
  return `begin;
create temp table _payload(doc jsonb) on commit drop; insert into _payload values ($apply$${payload}$apply$::jsonb);
create temp table _spec_input on commit drop as select (ordinality-1)::int idx,x->>'code' code,x->>'group_name' group_name,x->>'equipment_group' equipment_group,x->>'spec_set' spec_set,x->>'detail' detail,x->>'type' type,nullif(x->>'unit','') unit,nullif(x->>'value_direction','') value_direction,(x->>'unit_perceived_value')::numeric unit_perceived_value,(x->>'relative_value')::numeric relative_value,(x->>'is_baseline')::boolean is_baseline,(x->>'is_active')::boolean is_active,nullif(x->>'notes','') notes,nullif(x->>'commercial_category','') commercial_category from _payload,jsonb_array_elements(doc->'specs') with ordinality a(x,ordinality);
create temp table _product_input on commit drop as select (ordinality-1)::int idx,x->>'full_name' full_name,x->>'brand' brand,x->>'model' model,x->>'version' version,(x->>'production_year')::smallint production_year,(x->>'model_year')::smallint model_year,lower(regexp_replace(btrim(x->>'brand'),'\\s+',' ','g')) brand_key,lower(regexp_replace(btrim(x->>'model'),'\\s+',' ','g')) model_key,lower(regexp_replace(btrim(x->>'version'),'\\s+',' ','g')) version_key from _payload,jsonb_array_elements(doc->'products') with ordinality a(x,ordinality);
create temp table _association_input on commit drop as select (x->>0)::int product_idx,(x->>1)::int spec_idx,nullif(x->>2,'')::numeric value,case when jsonb_typeof(x->3)='null' then null else (x->>3)::boolean end is_present from _payload,jsonb_array_elements(doc->'productSpecs') a(x);
create temp table _product_map on commit drop as select i.idx,min(p.id)::bigint product_id,count(*)::int matches from _product_input i join public.products p on lower(regexp_replace(btrim(p.brand),'\\s+',' ','g'))=i.brand_key and lower(regexp_replace(btrim(p.model),'\\s+',' ','g'))=i.model_key and lower(regexp_replace(btrim(p.version),'\\s+',' ','g'))=i.version_key and p.production_year=i.production_year and p.model_year=i.model_year group by i.idx;
create temp table _expected on commit drop as select pm.product_id,s.id equipment_id,a.value,a.is_present,case when s.type='numeric' then s.unit else null end input_unit from _association_input a join _product_map pm on pm.idx=a.product_idx join _spec_input si on si.idx=a.spec_idx join public.specs s on s.code=si.code;
do $$ begin
 if (select count(*) from public.specs)<>321 or (select count(*) from public.products)<>277 or (select count(*) from public.product_specs)<>37949 then raise exception 'POST_COUNTS'; end if;
 if (select count(*) from _product_map)<>276 or exists(select 1 from _product_map where matches<>1) then raise exception 'POST_PRODUCT_MAP'; end if;
 if exists(select code,group_name,equipment_group,spec_set,detail,type,unit,value_direction,unit_perceived_value,relative_value,is_baseline,is_active,notes,commercial_category from _spec_input except select code,group_name,equipment_group,spec_set,detail,type,unit,value_direction,unit_perceived_value,relative_value,is_baseline,is_active,notes,commercial_category from public.specs) or exists(select code,group_name,equipment_group,spec_set,detail,type,unit,value_direction,unit_perceived_value,relative_value,is_baseline,is_active,notes,commercial_category from public.specs except select code,group_name,equipment_group,spec_set,detail,type,unit,value_direction,unit_perceived_value,relative_value,is_baseline,is_active,notes,commercial_category from _spec_input) then raise exception 'POST_SPEC_DIFF'; end if;
 if exists(select 1 from public.product_specs ps left join public.products p on p.id=ps.product_id left join public.specs s on s.id=ps.equipment_id where p.id is null or s.id is null) then raise exception 'POST_ORPHAN'; end if;
 if exists(select 1 from public.products group by lower(regexp_replace(btrim(brand),'\\s+',' ','g')),lower(regexp_replace(btrim(model),'\\s+',' ','g')),lower(regexp_replace(btrim(version),'\\s+',' ','g')),production_year,model_year having count(*)>1) then raise exception 'POST_PRODUCT_DUPLICATE'; end if;
 if exists(select 1 from public.product_specs ps join public.specs s on s.id=ps.equipment_id where s.type='scale' and ps.is_present=true group by ps.product_id,s.group_name,s.equipment_group,s.spec_set having count(*)>1) then raise exception 'POST_SCALE_CONFLICT'; end if;
end $$;
select jsonb_build_object('project_id','${projectId}','validated_at',clock_timestamp(),'artifact_match',not exists(select product_id,equipment_id,value,is_present,input_unit from _expected except all select product_id,equipment_id,value,is_present,input_unit from public.product_specs) and not exists(select product_id,equipment_id,value,is_present,input_unit from public.product_specs except all select product_id,equipment_id,value,is_present,input_unit from _expected),'missing_count',(select count(*) from (select product_id,equipment_id,value,is_present,input_unit from _expected except all select product_id,equipment_id,value,is_present,input_unit from public.product_specs)x),'unexpected_count',(select count(*) from (select product_id,equipment_id,value,is_present,input_unit from public.product_specs except all select product_id,equipment_id,value,is_present,input_unit from _expected)x),'missing_examples',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select e.product_id,s.code,e.value,e.is_present,e.input_unit from (select product_id,equipment_id,value,is_present,input_unit from _expected except all select product_id,equipment_id,value,is_present,input_unit from public.product_specs)e join public.specs s on s.id=e.equipment_id limit 20)x),'unexpected_examples',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select e.product_id,s.code,e.value,e.is_present,e.input_unit from (select product_id,equipment_id,value,is_present,input_unit from public.product_specs except all select product_id,equipment_id,value,is_present,input_unit from _expected)e join public.specs s on s.id=e.equipment_id limit 20)x),'counts',jsonb_build_object('specs',(select count(*) from public.specs),'products',(select count(*) from public.products),'product_specs',(select count(*) from public.product_specs)),'spec_types',(select jsonb_object_agg(type,c) from (select type,count(*) c from public.specs group by type)x),'baselines',(select count(*) from public.specs where is_baseline),'target_products',(select count(*) from _product_map),'orphans',0,'duplicate_identities',0,'scale_conflicts',0,'special',jsonb_build_object('PW_0045',(select detail from public.specs where code='PW_0045'),'PW_1045',(select detail from public.specs where code='PW_1045'),'target_PW_0045_associations',(select count(*) from public.product_specs ps join public.specs s on s.id=ps.equipment_id where s.code='PW_0045')),'samples',(select jsonb_agg(to_jsonb(x)) from (select p.id,i.full_name,p.brand,p.model,p.version,p.production_year,p.model_year,count(ps.id) spec_count from _product_input i join _product_map pm using(idx) join public.products p on p.id=pm.product_id left join public.product_specs ps on ps.product_id=p.id group by p.id,i.idx,i.full_name order by i.idx limit 10)x)) result;
rollback;`;
}

async function main(): Promise<void> {
  const root = resolve(__dirname, '../..');
  const payload = await readFile(
    resolve(root, 'temp/vehicle-specs-staging-apply-payload.json'),
    'utf8',
  );
  JSON.parse(payload);
  await Promise.all([
    writeFile(
      resolve(root, 'temp/vehicle-specs-staging-apply-rollback.sql'),
      transaction(payload, false),
      'utf8',
    ),
    writeFile(
      resolve(root, 'temp/vehicle-specs-staging-apply-commit.sql'),
      transaction(payload, true),
      'utf8',
    ),
    writeFile(
      resolve(root, 'temp/vehicle-specs-staging-post-validate.sql'),
      postValidation(payload),
      'utf8',
    ),
  ]);
  process.stdout.write('Apply SQL rollback/commit gerado em temp/.\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
