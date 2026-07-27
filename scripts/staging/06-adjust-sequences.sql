-- STAGING ONLY: shfsjyjxmgwnlexmdkcs.supabase.co
-- The caller MUST verify supabase/.temp/project-ref before sending this file.
-- Never run this artifact against the operational project or production.

begin;

lock table public.products, public.specs, public.product_specs in share row exclusive mode;

create temporary table sequence_adjustment (
  table_name regclass primary key,
  column_name name not null,
  expected_sequence regclass not null,
  actual_sequence regclass,
  maximum_id bigint not null,
  before_last_value bigint,
  before_is_called boolean,
  target_last_value bigint,
  after_last_value bigint,
  after_is_called boolean
) on commit drop;

insert into sequence_adjustment (table_name, column_name, expected_sequence, actual_sequence, maximum_id)
values
  ('public.products'::regclass, 'id', 'public.products_id_seq'::regclass,
   pg_get_serial_sequence('public.products', 'id')::regclass, coalesce((select max(id) from public.products), 0)),
  ('public.specs'::regclass, 'id', 'public.equipments_id_seq'::regclass,
   pg_get_serial_sequence('public.specs', 'id')::regclass, coalesce((select max(id) from public.specs), 0)),
  ('public.product_specs'::regclass, 'id', 'public.product_specs_id_seq'::regclass,
   pg_get_serial_sequence('public.product_specs', 'id')::regclass, coalesce((select max(id) from public.product_specs), 0));

do $$
declare
  item record;
  sequence_last_value bigint;
  sequence_is_called boolean;
begin
  for item in select * from sequence_adjustment order by table_name::text loop
    if item.actual_sequence is null then
      raise exception 'No sequence found for %.%', item.table_name, item.column_name;
    end if;
    if item.actual_sequence <> item.expected_sequence then
      raise exception 'Unexpected sequence for %.%: expected %, found %',
        item.table_name, item.column_name, item.expected_sequence, item.actual_sequence;
    end if;
    execute format('select last_value, is_called from %s', item.actual_sequence)
      into sequence_last_value, sequence_is_called;
    update sequence_adjustment
       set before_last_value = sequence_last_value,
           before_is_called = sequence_is_called,
           target_last_value = greatest(sequence_last_value, item.maximum_id)
     where table_name = item.table_name;
    raise notice 'BEFORE table=%, sequence=%, max_id=%, last_value=%, is_called=%, next_value=%',
      item.table_name, item.actual_sequence, item.maximum_id, sequence_last_value,
      sequence_is_called, case when sequence_is_called then sequence_last_value + 1 else sequence_last_value end;
  end loop;
end $$;

select setval(actual_sequence, target_last_value, true) from sequence_adjustment;

do $$
declare
  item record;
  sequence_last_value bigint;
  sequence_is_called boolean;
begin
  for item in select * from sequence_adjustment order by table_name::text loop
    execute format('select last_value, is_called from %s', item.actual_sequence)
      into sequence_last_value, sequence_is_called;
    update sequence_adjustment
       set after_last_value = sequence_last_value, after_is_called = sequence_is_called
     where table_name = item.table_name;
    if sequence_last_value < item.before_last_value or
       sequence_last_value < item.maximum_id or
       not sequence_is_called then
      raise exception 'Unsafe sequence result for %.%', item.table_name, item.column_name;
    end if;
    raise notice 'AFTER table=%, sequence=%, max_id=%, last_value=%, is_called=%, next_value=%',
      item.table_name, item.actual_sequence, item.maximum_id, sequence_last_value,
      sequence_is_called, sequence_last_value + 1;
  end loop;
end $$;

select table_name::text, column_name, actual_sequence::text, maximum_id,
       before_last_value, before_is_called, target_last_value,
       after_last_value, after_is_called, after_last_value + 1 as next_value
from sequence_adjustment
order by table_name::text;

commit;
