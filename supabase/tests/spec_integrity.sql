begin;

set local search_path = extensions, public, pg_catalog;

select plan(10);

with
scale_violations as (
    select
        10 as sort_order,
        format(
            'scale | product_id=%s | brand=%s | model=%s | version=%s | group_name=%s | equipment_group=%s | spec_set=%s | opções selecionadas=%s',
            ps.product_id,
            coalesce(p.brand, '<null>'),
            coalesce(p.model, '<null>'),
            coalesce(p.version, '<null>'),
            string_agg(distinct s.group_name, ', ' order by s.group_name),
            string_agg(distinct s.equipment_group, ', ' order by s.equipment_group),
            s.spec_set,
            string_agg(
                format('%s [%s]', s.detail, s.code),
                ', '
                order by s.code, s.id
            )
        ) as detail
    from public.product_specs as ps
    join public.specs as s
      on s.id = ps.equipment_id
     and s.type = 'scale'
    left join public.products as p
      on p.id = ps.product_id
    where ps.is_present is true
    group by
        ps.product_id,
        p.brand,
        p.model,
        p.version,
        s.spec_set
    having count(*) > 1
),
binary_violations as (
    select
        20 as sort_order,
        format(
            'binary | spec_set=%s | quantidade=%s | spec_ids=%s | specs=%s',
            s.spec_set,
            count(*),
            string_agg(s.id::text, ', ' order by s.id),
            string_agg(format('%s [%s]', s.detail, s.code), ', ' order by s.code, s.id)
        ) as detail
    from public.specs as s
    where s.type = 'binary'
    group by s.spec_set
    having count(*) > 1
),
code_violations as (
    select
        30 as sort_order,
        format(
            'code duplicado | code=%s | quantidade=%s | spec_ids=%s',
            coalesce(s.code, '<null>'),
            count(*),
            string_agg(s.id::text, ', ' order by s.id)
        ) as detail
    from public.specs as s
    group by s.code
    having count(*) > 1
),
orphan_spec_violations as (
    select
        40 as sort_order,
        format(
            'product_specs sem spec | product_spec_id=%s | product_id=%s | equipment_id=%s',
            ps.id,
            ps.product_id,
            ps.equipment_id
        ) as detail
    from public.product_specs as ps
    left join public.specs as s
      on s.id = ps.equipment_id
    where s.id is null
),
orphan_product_violations as (
    select
        50 as sort_order,
        format(
            'product_specs sem product | product_spec_id=%s | product_id=%s | equipment_id=%s',
            ps.id,
            ps.product_id,
            ps.equipment_id
        ) as detail
    from public.product_specs as ps
    left join public.products as p
      on p.id = ps.product_id
    where p.id is null
),
product_spec_duplicate_violations as (
    select
        60 as sort_order,
        format(
            'product_specs duplicado | product_id=%s | equipment_id=%s | quantidade=%s | product_spec_ids=%s',
            ps.product_id,
            ps.equipment_id,
            count(*),
            string_agg(ps.id::text, ', ' order by ps.id)
        ) as detail
    from public.product_specs as ps
    group by
        ps.product_id,
        ps.equipment_id
    having count(*) > 1
),
type_violations as (
    select
        70 as sort_order,
        format(
            'tipo inválido | spec_id=%s | code=%s | spec_set=%s | type=%s',
            s.id,
            coalesce(s.code, '<null>'),
            coalesce(s.spec_set, '<null>'),
            coalesce(s.type, '<null>')
        ) as detail
    from public.specs as s
    where s.type is null
       or s.type not in ('binary', 'scale', 'numeric', 'text')
),
numeric_unit_violations as (
    select
        80 as sort_order,
        format(
            'numeric com input_unit inválida | product_spec_id=%s | product_id=%s | equipment_id=%s | code=%s | unidade esperada=%s | input_unit=%s',
            ps.id,
            ps.product_id,
            ps.equipment_id,
            s.code,
            s.unit,
            coalesce(ps.input_unit, '<null>')
        ) as detail
    from public.product_specs as ps
    join public.specs as s
      on s.id = ps.equipment_id
     and s.type = 'numeric'
    where nullif(btrim(s.unit), '') is not null
      and (
          nullif(btrim(ps.input_unit), '') is null
          or lower(btrim(ps.input_unit)) <> lower(btrim(s.unit))
      )
),
numeric_presence_violations as (
    select
        80 as sort_order,
        format(
            'numeric presente sem value | product_spec_id=%s | product_id=%s | equipment_id=%s | code=%s | input_unit=%s',
            ps.id,
            ps.product_id,
            ps.equipment_id,
            s.code,
            coalesce(ps.input_unit, '<null>')
        ) as detail
    from public.product_specs as ps
    join public.specs as s
      on s.id = ps.equipment_id
     and s.type = 'numeric'
    where ps.is_present is true
      and ps.value is null
),
catalog_duplicate_violations as (
    select
        90 as sort_order,
        format(
            'catálogo duplicado | group_name=%s | equipment_group=%s | spec_set=%s | detail=%s | quantidade=%s | spec_ids=%s | codes=%s',
            s.group_name,
            s.equipment_group,
            s.spec_set,
            s.detail,
            count(*),
            string_agg(s.id::text, ', ' order by s.id),
            string_agg(s.code, ', ' order by s.code, s.id)
        ) as detail
    from public.specs as s
    group by
        s.group_name,
        s.equipment_group,
        s.spec_set,
        s.detail
    having count(*) > 1
),
spec_set_type_violations as (
    select
        100 as sort_order,
        format(
            'spec_set com tipos conflitantes | spec_set=%s | types=%s | spec_ids=%s | codes=%s',
            s.spec_set,
            string_agg(distinct coalesce(s.type, '<null>'), ', ' order by coalesce(s.type, '<null>')),
            string_agg(s.id::text, ', ' order by s.id),
            string_agg(s.code, ', ' order by s.code, s.id)
        ) as detail
    from public.specs as s
    group by s.spec_set
    having count(distinct coalesce(s.type, '<null>')) > 1
),
findings as (
    select * from scale_violations
    union all
    select * from binary_violations
    union all
    select * from code_violations
    union all
    select * from orphan_spec_violations
    union all
    select * from orphan_product_violations
    union all
    select * from product_spec_duplicate_violations
    union all
    select * from type_violations
    union all
    select * from numeric_unit_violations
    union all
    select * from numeric_presence_violations
    union all
    select * from catalog_duplicate_violations
    union all
    select * from spec_set_type_violations
),
outputs as (
    select
        f.sort_order,
        f.detail as output_order,
        diag(f.detail) as output
    from findings as f

    union all

    select
        11,
        'assert scale',
        is(
            (select count(*) from scale_violations),
            0::bigint,
            'scale has at most one selected option per product and spec_set'
        )

    union all

    select
        21,
        'assert binary',
        is(
            (select count(*) from binary_violations),
            0::bigint,
            'binary spec_set has exactly one catalog spec at most'
        )

    union all

    select
        31,
        'assert codes',
        is(
            (select count(*) from code_violations),
            0::bigint,
            'spec codes are unique'
        )

    union all

    select
        41,
        'assert equipment references',
        is(
            (select count(*) from orphan_spec_violations),
            0::bigint,
            'every product_specs.equipment_id references specs'
        )

    union all

    select
        51,
        'assert product references',
        is(
            (select count(*) from orphan_product_violations),
            0::bigint,
            'every product_specs.product_id references products'
        )

    union all

    select
        61,
        'assert product spec uniqueness',
        is(
            (select count(*) from product_spec_duplicate_violations),
            0::bigint,
            'product_specs has no duplicate product_id and equipment_id pair'
        )

    union all

    select
        71,
        'assert valid types',
        is(
            (select count(*) from type_violations),
            0::bigint,
            'spec type is binary, scale, numeric or text'
        )

    union all

    select
        81,
        'assert numeric',
        is(
            (
                (select count(*) from numeric_unit_violations)
                + (select count(*) from numeric_presence_violations)
            ),
            0::bigint,
            'numeric associations have valid input_unit and no true presence without value'
        )

    union all

    select
        91,
        'assert catalog uniqueness',
        is(
            (select count(*) from catalog_duplicate_violations),
            0::bigint,
            'spec catalog structure is unique'
        )

    union all

    select
        101,
        'assert spec_set type coherence',
        is(
            (select count(*) from spec_set_type_violations),
            0::bigint,
            'each spec_set belongs to only one type'
        )

    union all

    select
        999,
        'summary',
        diag(
            case
                when (select count(*) from findings) = 0
                    then '✔ Todos os testes passaram'
                else format(
                    '✖ %s inconsistências encontradas',
                    (select count(*) from findings)
                )
            end
        )
)
select output
from outputs
order by
    sort_order,
    output_order;

select * from finish();

rollback;
