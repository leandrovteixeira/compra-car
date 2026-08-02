-- Sprint 9H.2: derive a commercial period from existing temporal columns and
-- persist Policy/Offer successors in one transaction. No campaign/period table
-- is introduced: product_id + the validated date interval remain authoritative.

create or replace function public.prevent_terminal_pricing_migration_rule_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status::text = 'archived' and new.status is distinct from old.status then
    raise exception using errcode = '55000', message = 'archived pricing records are immutable';
  end if;

  if tg_table_schema = 'public'
     and tg_table_name = 'commercial_offers'
     and old.status::text = 'published'
     and new.status::text = 'published'
     and current_user = 'postgres'
     and current_setting('app.pricing_commercial_period_offer_rollover_id', true) = old.id::text
     and new.valid_to is distinct from old.valid_to
     and pg_catalog.to_jsonb(new) - array[
       'valid_to', 'updated_at', 'updated_by', 'lock_version'
     ] = pg_catalog.to_jsonb(old) - array[
       'valid_to', 'updated_at', 'updated_by', 'lock_version'
     ] then
    return new;
  end if;

  if old.status::text = 'published' and new.status::text not in ('published', 'archived') then
    raise exception using errcode = '55000', message = 'published pricing records may only be archived';
  end if;
  if old.status::text in ('published', 'archived')
     and pg_catalog.to_jsonb(new) - array['status','updated_at','updated_by','lock_version']
       is distinct from pg_catalog.to_jsonb(old) - array['status','updated_at','updated_by','lock_version'] then
    raise exception using errcode = '55000', message = 'published or archived pricing migration fields are immutable';
  end if;
  return new;
end;
$$;

create function public.create_commercial_period_draft(
  p_product_id integer,
  p_period_start date,
  p_period_end date,
  p_period_kind text,
  p_policy_rows jsonb,
  p_offer_rows jsonb,
  p_expected_offers jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  policy_row jsonb;
  offer_row jsonb;
  policy_ref jsonb;
  expected_offer jsonb;
  clean_policy_rows jsonb := '[]'::jsonb;
  policy_map jsonb := '{}'::jsonb;
  policy_result jsonb := pg_catalog.jsonb_build_object(
    'batchId', null,
    'createdCount', 0,
    'policyIds', '[]'::jsonb,
    'rolloverCount', 0,
    'rollovers', '[]'::jsonb
  );
  created_offers jsonb := '[]'::jsonb;
  rollovers jsonb := '[]'::jsonb;
  affected_offer_ids bigint[] := '{}';
  expected_offer_ids bigint[] := '{}';
  policy_ids bigint[];
  policy_client_id text;
  offer_client_id text;
  policy_type_value public.commercial_policy_type;
  predecessor_record public.commercial_policies%rowtype;
  updated_predecessor public.commercial_policies%rowtype;
  offer_record public.commercial_offers%rowtype;
  updated_offer public.commercial_offers%rowtype;
  predecessor_count integer;
  expected_predecessor_id bigint;
  expected_predecessor_lock integer;
  expected_offer_id bigint;
  expected_offer_lock integer;
  referenced_policy_id bigint;
  row_number integer := 0;
  successor_id bigint;
  policy_count integer;
  type_count integer;
  price_count integer;
  price_id bigint;
  price_amount numeric(14,2);
  benefit_amount numeric(14,2);
  new_offer_id bigint;
  close_on date;
  operational_today date;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or p_actor_id is null then
    raise exception using errcode = '22004', message = 'commercial period requires actor and correlation id';
  end if;
  if p_period_kind not in ('monthly', 'special')
     or p_period_start is null
     or p_period_end is null
     or p_period_end < p_period_start
     or pg_catalog.date_trunc('month', p_period_start)::date
       <> pg_catalog.date_trunc('month', p_period_end)::date then
    raise exception using errcode = '22023', message = 'invalid commercial period';
  end if;
  if p_period_kind = 'monthly'
     and (
       p_period_start <> pg_catalog.date_trunc('month', p_period_start)::date
       or p_period_end <> (
         pg_catalog.date_trunc('month', p_period_start)
         + interval '1 month - 1 day'
       )::date
     ) then
    raise exception using errcode = '22023', message = 'monthly commercial period must cover the complete competence';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception using errcode = '23503', message = 'unknown commercial period product';
  end if;
  if pg_catalog.jsonb_typeof(p_policy_rows) <> 'array'
     or pg_catalog.jsonb_typeof(p_offer_rows) <> 'array'
     or pg_catalog.jsonb_typeof(p_expected_offers) <> 'array'
     or pg_catalog.jsonb_array_length(p_policy_rows) > 100
     or pg_catalog.jsonb_array_length(p_offer_rows) > 100 then
    raise exception using errcode = '22023', message = 'invalid commercial period payload';
  end if;
  if pg_catalog.jsonb_array_length(p_policy_rows) = 0
     and pg_catalog.jsonb_array_length(p_offer_rows) = 0 then
    raise exception using errcode = '22023', message = 'commercial period requires policies or offers';
  end if;

  operational_today := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
  close_on := p_period_start - 1;
  perform pg_catalog.pg_advisory_xact_lock(9051, p_product_id);

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_policy_rows) as item(value)
    where (item.value->>'productId')::integer <> p_product_id
       or nullif(pg_catalog.btrim(item.value->>'clientRowId'), '') is null
  ) then
    raise exception using errcode = '22023', message = 'commercial period contains an invalid policy row';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_policy_rows) as item(value)
    group by item.value->>'clientRowId'
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'commercial period contains duplicate policy clientRowId';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_policy_rows) as item(value)
    group by item.value->>'policyType'
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'commercial period contains more than one new policy of the same type';
  end if;

  for policy_row in select value from pg_catalog.jsonb_array_elements(p_policy_rows)
  loop
    row_number := row_number + 1;
    policy_client_id := pg_catalog.btrim(policy_row->>'clientRowId');
    policy_type_value := (policy_row->>'policyType')::public.commercial_policy_type;
    expected_predecessor_id := nullif(policy_row->>'expectedPredecessorId', '')::bigint;
    expected_predecessor_lock := nullif(policy_row->>'expectedPredecessorLockVersion', '')::integer;

    if exists (
      select 1 from public.commercial_policies as future_policy
      where future_policy.product_id = p_product_id
        and future_policy.policy_type = policy_type_value
        and future_policy.status in ('draft', 'needs_review', 'published')
        and future_policy.starts_on >= p_period_start
    ) then
      raise exception using errcode = '23505', message = 'a current or future policy of the same type already exists for the commercial period';
    end if;

    select count(*) into predecessor_count
    from public.commercial_policies as predecessor
    where predecessor.product_id = p_product_id
      and predecessor.policy_type = policy_type_value
      and predecessor.status in ('draft', 'needs_review', 'published')
      and predecessor.starts_on < p_period_start
      and (predecessor.ends_on is null or predecessor.ends_on >= p_period_start);
    if predecessor_count > 1 then
      raise exception using errcode = '23514', message = 'policy timeline has multiple overlapping predecessors';
    end if;
    if predecessor_count = 1 then
      select * into predecessor_record
      from public.commercial_policies as predecessor
      where predecessor.product_id = p_product_id
        and predecessor.policy_type = policy_type_value
        and predecessor.status in ('draft', 'needs_review', 'published')
        and predecessor.starts_on < p_period_start
        and (predecessor.ends_on is null or predecessor.ends_on >= p_period_start)
      for update;
      if expected_predecessor_id is null or expected_predecessor_lock is null then
        raise exception using errcode = '40001', message = 'commercial period rollover requires predecessor lock version';
      end if;
      if predecessor_record.id <> expected_predecessor_id
         or predecessor_record.lock_version <> expected_predecessor_lock then
        raise exception using errcode = '40001', message = 'commercial period predecessor changed by another operator';
      end if;
      affected_offer_ids := affected_offer_ids || array(
        select distinct membership.commercial_offer_id
        from public.commercial_offer_policies as membership
        join public.commercial_offers as offer on offer.id = membership.commercial_offer_id
        where membership.commercial_policy_id = predecessor_record.id
          and offer.status <> 'archived'
          and (offer.valid_to is null or offer.valid_to >= p_period_start)
      );
      perform pg_catalog.set_config(
        'app.pricing_commercial_policy_rollover_id',
        predecessor_record.id::text,
        true
      );
      update public.commercial_policies
      set ends_on = close_on, updated_by = p_actor_id
      where id = predecessor_record.id
      returning * into updated_predecessor;
      perform pg_catalog.set_config('app.pricing_commercial_policy_rollover_id', '', true);
      rollovers := rollovers || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'rowNumber', row_number,
          'predecessorId', predecessor_record.id,
          'policyClientRowId', policy_client_id,
          'before', pg_catalog.to_jsonb(predecessor_record),
          'after', pg_catalog.to_jsonb(updated_predecessor)
        )
      );
    elsif expected_predecessor_id is not null or expected_predecessor_lock is not null then
      raise exception using errcode = '40001', message = 'commercial period policy timeline is stale';
    end if;

    clean_policy_rows := clean_policy_rows || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
          policy_row - array['expectedPredecessorId', 'expectedPredecessorLockVersion'],
          '{startsOn}', pg_catalog.to_jsonb(p_period_start::text), true
        ),
        '{endsOn}', pg_catalog.to_jsonb(p_period_end::text), true
      )
    );
  end loop;

  select coalesce(pg_catalog.array_agg(distinct id order by id), '{}')
  into affected_offer_ids
  from pg_catalog.unnest(affected_offer_ids) as affected(id);
  select coalesce(pg_catalog.array_agg((item.value->>'offerId')::bigint order by (item.value->>'offerId')::bigint), '{}')
  into expected_offer_ids
  from pg_catalog.jsonb_array_elements(p_expected_offers) as item(value);
  if pg_catalog.cardinality(expected_offer_ids) <> (
    select count(distinct id) from pg_catalog.unnest(expected_offer_ids) as expected(id)
  ) then
    raise exception using errcode = '23505', message = 'commercial period contains duplicate expected Offer IDs';
  end if;
  if not (affected_offer_ids <@ expected_offer_ids) then
    raise exception using errcode = '40001', message = 'commercial period is missing an affected Offer lock';
  end if;

  for expected_offer in select value from pg_catalog.jsonb_array_elements(p_expected_offers)
  loop
    expected_offer_id := (expected_offer->>'offerId')::bigint;
    expected_offer_lock := nullif(expected_offer->>'expectedLockVersion', '')::integer;
    if expected_offer_lock is null then
      raise exception using errcode = '40001', message = 'commercial period requires every affected Offer lock version';
    end if;
    select * into offer_record from public.commercial_offers
    where id = expected_offer_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'affected commercial Offer does not exist';
    end if;
    if offer_record.product_id <> p_product_id
       or offer_record.status = 'archived'
       or (offer_record.valid_to is not null and offer_record.valid_to < p_period_start) then
      raise exception using errcode = '23514', message = 'affected Offer is not eligible for temporal closing';
    end if;
    if offer_record.lock_version <> expected_offer_lock then
      raise exception using errcode = '40001', message = 'affected Offer changed by another operator';
    end if;
    if close_on < offer_record.valid_from then
      raise exception using errcode = '23514', message = 'commercial Offer cannot end before its valid_from';
    end if;
    if p_period_kind = 'monthly'
       and offer_record.status = 'published'
       and p_period_start < operational_today then
      raise exception using errcode = '55000', message = 'retroactive closing of a published Offer is not allowed for a monthly period';
    end if;
    perform pg_catalog.set_config(
      'app.pricing_commercial_period_offer_rollover_id',
      offer_record.id::text,
      true
    );
    update public.commercial_offers
    set valid_to = close_on, updated_by = p_actor_id
    where id = offer_record.id
    returning * into updated_offer;
    perform pg_catalog.set_config(
      'app.pricing_commercial_period_offer_rollover_id',
      '',
      true
    );
    insert into public.pricing_audit_events(
      aggregate_type, aggregate_id, action, before_snapshot, after_snapshot,
      reason, actor_id, correlation_id
    ) values (
      'commercial_offer', offer_record.id, 'update',
      pg_catalog.jsonb_build_object(
        'offer', pg_catalog.to_jsonb(offer_record),
        'policyIds', (
          select pg_catalog.jsonb_agg(commercial_policy_id order by commercial_policy_id)
          from public.commercial_offer_policies where commercial_offer_id = offer_record.id
        )
      ),
      pg_catalog.jsonb_build_object(
        'offer', pg_catalog.to_jsonb(updated_offer),
        'policyIds', (
          select pg_catalog.jsonb_agg(commercial_policy_id order by commercial_policy_id)
          from public.commercial_offer_policies where commercial_offer_id = offer_record.id
        )
      ),
      'commercial period temporal closing', p_actor_id, p_correlation_id
    );
  end loop;

  if pg_catalog.jsonb_array_length(clean_policy_rows) > 0 then
    policy_result := public.create_manual_policy_batch(
      clean_policy_rows, p_actor_id, p_correlation_id
    );
    row_number := 0;
    for policy_row in select value from pg_catalog.jsonb_array_elements(clean_policy_rows)
    loop
      row_number := row_number + 1;
      policy_client_id := policy_row->>'clientRowId';
      successor_id := (policy_result->'policyIds'->>(row_number - 1))::bigint;
      policy_map := policy_map || pg_catalog.jsonb_build_object(policy_client_id, successor_id);
    end loop;
    for policy_row in select value from pg_catalog.jsonb_array_elements(rollovers)
    loop
      successor_id := (policy_map->>(policy_row->>'policyClientRowId'))::bigint;
      insert into public.pricing_audit_events(
        aggregate_type, aggregate_id, action, before_snapshot, after_snapshot,
        reason, actor_id, correlation_id
      ) values (
        'commercial_policy', (policy_row->>'predecessorId')::bigint, 'update',
        policy_row->'before',
        policy_row->'after' || pg_catalog.jsonb_build_object('successorPolicyId', successor_id),
        'commercial period temporal rollover', p_actor_id, p_correlation_id
      );
    end loop;
    policy_result := policy_result || pg_catalog.jsonb_build_object(
      'rolloverCount', pg_catalog.jsonb_array_length(rollovers),
      'rollovers', rollovers
    );
  end if;

  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_offer_rows) as item(value)
    group by item.value->>'clientRowId'
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'commercial period contains duplicate Offer clientRowId';
  end if;

  for offer_row in select value from pg_catalog.jsonb_array_elements(p_offer_rows)
  loop
    offer_client_id := pg_catalog.btrim(offer_row->>'clientRowId');
    if offer_client_id is null
       or offer_client_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'
       or pg_catalog.jsonb_typeof(offer_row->'policyRefs') <> 'array'
       or pg_catalog.jsonb_array_length(offer_row->'policyRefs') < 1 then
      raise exception using errcode = '22023', message = 'invalid commercial period Offer row';
    end if;
    policy_ids := '{}';
    for policy_ref in select value from pg_catalog.jsonb_array_elements(offer_row->'policyRefs')
    loop
      if nullif(policy_ref->>'policyClientRowId', '') is not null then
        referenced_policy_id := nullif(policy_map->>(policy_ref->>'policyClientRowId'), '')::bigint;
      else
        referenced_policy_id := nullif(policy_ref->>'policyId', '')::bigint;
      end if;
      if referenced_policy_id is null then
        raise exception using errcode = '23503', message = 'commercial period Offer references an unknown Policy';
      end if;
      policy_ids := pg_catalog.array_append(policy_ids, referenced_policy_id);
    end loop;
    select pg_catalog.array_agg(id order by id) into policy_ids
    from pg_catalog.unnest(policy_ids) as selected(id);
    if pg_catalog.cardinality(policy_ids) <> (
      select count(distinct id) from pg_catalog.unnest(policy_ids) as selected(id)
    ) then
      raise exception using errcode = '23505', message = 'commercial period Offer Policy references must be unique';
    end if;
    perform policy.id from public.commercial_policies as policy
    where policy.id = any(policy_ids) order by policy.id for key share;
    select count(*), count(distinct policy_type), coalesce(sum(customer_benefit_amount), 0)
    into policy_count, type_count, benefit_amount
    from public.commercial_policies
    where id = any(policy_ids)
      and product_id = p_product_id
      and status in ('draft', 'needs_review', 'published')
      and starts_on <= p_period_start
      and (ends_on is null or ends_on >= p_period_end);
    if policy_count <> pg_catalog.cardinality(policy_ids) then
      raise exception using errcode = '23514', message = 'every Offer Policy must cover the complete commercial period';
    end if;
    if type_count <> policy_count then
      raise exception using errcode = '23514', message = 'commercial period Offer contains more than one Policy of the same type';
    end if;
    select count(*), min(id), min(amount)
    into price_count, price_id, price_amount
    from public.product_public_prices
    where product_id = p_product_id
      and status = 'published'
      and currency_code = 'BRL'
      and amount > 0
      and (price_type is null or price_type = 'msrp')
      and starts_on <= p_period_start
      and (ends_on is null or ends_on >= p_period_end);
    if price_count = 0 then
      raise exception using errcode = '23514', message = 'no published MSRP covers the complete commercial period';
    end if;
    if price_count > 1 then
      raise exception using errcode = '23514', message = 'more than one published MSRP covers the commercial period';
    end if;
    if benefit_amount > price_amount then
      raise exception using errcode = '23514', message = 'commercial period Offer benefit exceeds MSRP';
    end if;
    if exists (
      select 1 from public.commercial_offers as duplicate_offer
      where duplicate_offer.product_id = p_product_id
        and duplicate_offer.status = 'draft'
        and duplicate_offer.valid_from = p_period_start
        and duplicate_offer.valid_to = p_period_end
        and (
          select pg_catalog.array_agg(commercial_policy_id order by commercial_policy_id)
          from public.commercial_offer_policies
          where commercial_offer_id = duplicate_offer.id
        ) = policy_ids
    ) then
      raise exception using errcode = '23505', message = 'an identical draft Offer already exists for the commercial period';
    end if;
    insert into public.commercial_offers(
      product_id, public_price_id, source_system, source_reference,
      valid_from, valid_to, status, blocking_issues, created_by, updated_by
    ) values (
      p_product_id, price_id, 'manual',
      'commercial-period:' || p_correlation_id::text || ':' || offer_client_id,
      p_period_start, p_period_end, 'draft', '[]'::jsonb, p_actor_id, p_actor_id
    ) returning id into new_offer_id;
    insert into public.commercial_offer_policies(
      commercial_offer_id, commercial_policy_id, created_by
    )
    select new_offer_id, selected.id, p_actor_id
    from pg_catalog.unnest(policy_ids) as selected(id);
    insert into public.pricing_audit_events(
      aggregate_type, aggregate_id, action, after_snapshot,
      reason, actor_id, correlation_id
    ) values (
      'commercial_offer', new_offer_id, 'insert',
      pg_catalog.jsonb_build_object(
        'id', new_offer_id,
        'productId', p_product_id,
        'publicPriceId', price_id,
        'validFrom', p_period_start,
        'validTo', p_period_end,
        'status', 'draft',
        'policyIds', policy_ids,
        'benefitAmount', benefit_amount,
        'transactionalPrice', price_amount - benefit_amount
      ),
      'commercial period draft creation', p_actor_id, p_correlation_id
    );
    created_offers := created_offers || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'offerId', new_offer_id,
        'clientRowId', offer_client_id,
        'productId', p_product_id,
        'publicPriceId', price_id,
        'publicPriceAmount', price_amount::text,
        'validFrom', p_period_start,
        'validTo', p_period_end,
        'status', 'draft',
        'policyIds', policy_ids,
        'lockVersion', 1,
        'benefitAmount', benefit_amount::text,
        'transactionalPrice', (price_amount - benefit_amount)::text
      )
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'periodKind', p_period_kind,
    'periodStart', p_period_start,
    'periodEnd', p_period_end,
    'policyBatch', policy_result,
    'policyMap', policy_map,
    'closedOfferIds', expected_offer_ids,
    'createdOfferCount', pg_catalog.jsonb_array_length(created_offers),
    'offers', created_offers
  );
end;
$$;

alter function public.prevent_terminal_pricing_migration_rule_change() owner to postgres;
alter function public.create_commercial_period_draft(
  integer, date, date, text, jsonb, jsonb, jsonb, uuid, uuid
) owner to postgres;

revoke all on function public.prevent_terminal_pricing_migration_rule_change()
  from public, anon, authenticated, service_role;
revoke all on function public.create_commercial_period_draft(
  integer, date, date, text, jsonb, jsonb, jsonb, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_commercial_period_draft(
  integer, date, date, text, jsonb, jsonb, jsonb, uuid, uuid
) to service_role;

comment on function public.create_commercial_period_draft(
  integer, date, date, text, jsonb, jsonb, jsonb, uuid, uuid
) is 'Atomically closes expected Policy/Offer predecessors and creates draft Policies and Offers for one derived commercial period.';
