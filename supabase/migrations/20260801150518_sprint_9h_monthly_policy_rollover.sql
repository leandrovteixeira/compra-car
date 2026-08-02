-- Sprint 9H: controlled temporal rollover for monthly commercial policy batches.
-- No competence column is persisted: starts_on/ends_on remain authoritative.

create function public.prevent_terminal_commercial_policy_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rollover_is_authorized boolean :=
    old.status = 'published'
    and current_user = 'postgres'
    and coalesce(
      pg_catalog.current_setting('app.pricing_commercial_policy_rollover_id', true),
      ''
    ) = old.id::text;
begin
  if old.status = 'archived' and new.status is distinct from old.status then
    raise exception using errcode = '55000', message = 'archived commercial policies are immutable';
  end if;

  if old.status = 'published' and new.status not in ('published', 'archived') then
    raise exception using errcode = '55000', message = 'published commercial policies may only be archived';
  end if;

  if old.status in ('published', 'archived') and (
    pg_catalog.to_jsonb(new) - array[
      'status', 'updated_at', 'updated_by', 'lock_version', 'ends_on'
    ] is distinct from pg_catalog.to_jsonb(old) - array[
      'status', 'updated_at', 'updated_by', 'lock_version', 'ends_on'
    ]
    or (
      new.ends_on is distinct from old.ends_on
      and not rollover_is_authorized
    )
  ) then
    raise exception using
      errcode = '55000',
      message = 'published or archived commercial policy economic identity is immutable';
  end if;

  return new;
end;
$$;

drop trigger commercial_policies_prevent_terminal_identity_change
  on public.commercial_policies;
drop trigger commercial_policies_prevent_terminal_migration_rule_change
  on public.commercial_policies;

create trigger commercial_policies_prevent_terminal_change
before update on public.commercial_policies
for each row execute function public.prevent_terminal_commercial_policy_change();

create function public.create_manual_policy_batch_with_rollover(
  p_rows jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value jsonb;
  clean_rows jsonb := '[]'::jsonb;
  rollovers jsonb := '[]'::jsonb;
  batch_result jsonb;
  predecessor_record public.commercial_policies%rowtype;
  updated_predecessor public.commercial_policies%rowtype;
  product_id_value integer;
  policy_type_value public.commercial_policy_type;
  starts_on_value date;
  predecessor_count integer;
  expected_predecessor_id bigint;
  expected_lock_version integer;
  row_number integer := 0;
  successor_id bigint;
  rollover_value jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid monthly policy batch';
  end if;
  if pg_catalog.jsonb_array_length(p_rows) < 1
     or pg_catalog.jsonb_array_length(p_rows) > 100 then
    raise exception using errcode = '22023', message = 'monthly policy batch requires between 1 and 100 rows';
  end if;
  if exists (
    select 1
      from pg_catalog.jsonb_array_elements(p_rows) as item(value)
     group by item.value->>'productId', item.value->>'policyType'
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'monthly policy batch contains more than one policy of the same type for a product';
  end if;

  for product_id_value in
    select distinct (item.value->>'productId')::integer
      from pg_catalog.jsonb_array_elements(p_rows) as item(value)
     order by 1
  loop
    perform pg_catalog.pg_advisory_xact_lock(9050, product_id_value);
  end loop;

  for row_value in select value from pg_catalog.jsonb_array_elements(p_rows)
  loop
    row_number := row_number + 1;
    product_id_value := (row_value->>'productId')::integer;
    policy_type_value := (row_value->>'policyType')::public.commercial_policy_type;
    starts_on_value := (row_value->>'startsOn')::date;
    expected_predecessor_id := nullif(row_value->>'expectedPredecessorId', '')::bigint;
    expected_lock_version := nullif(row_value->>'expectedPredecessorLockVersion', '')::integer;

    if exists (
      select 1
        from public.commercial_policies as future_policy
       where future_policy.product_id = product_id_value
         and future_policy.policy_type = policy_type_value
         and future_policy.status in ('draft', 'needs_review', 'published')
         and future_policy.starts_on >= starts_on_value
    ) then
      raise exception using
        errcode = '23505',
        message = 'a current or future policy of the same type already exists; retroactive insertion is not allowed';
    end if;

    select count(*)
      into predecessor_count
      from public.commercial_policies as predecessor
     where predecessor.product_id = product_id_value
       and predecessor.policy_type = policy_type_value
       and predecessor.status in ('draft', 'needs_review', 'published')
       and predecessor.starts_on < starts_on_value
       and (predecessor.ends_on is null or predecessor.ends_on >= starts_on_value);

    if predecessor_count > 1 then
      raise exception using errcode = '23514', message = 'policy timeline has multiple overlapping predecessors';
    end if;

    if predecessor_count = 1 then
      select * into predecessor_record
        from public.commercial_policies as predecessor
       where predecessor.product_id = product_id_value
         and predecessor.policy_type = policy_type_value
         and predecessor.status in ('draft', 'needs_review', 'published')
         and predecessor.starts_on < starts_on_value
         and (predecessor.ends_on is null or predecessor.ends_on >= starts_on_value)
       for update;

      if expected_predecessor_id is null or expected_lock_version is null then
        raise exception using errcode = '40001', message = 'policy rollover requires the loaded predecessor lock version';
      end if;
      if predecessor_record.id <> expected_predecessor_id
         or predecessor_record.lock_version <> expected_lock_version then
        raise exception using errcode = '40001', message = 'policy rollover failed: stale predecessor lock_version';
      end if;
      if exists (
        select 1
          from public.commercial_offer_policies as membership
          join public.commercial_offers as offer
            on offer.id = membership.commercial_offer_id
         where membership.commercial_policy_id = predecessor_record.id
           and offer.status <> 'archived'
           and (offer.valid_to is null or offer.valid_to >= starts_on_value)
      ) then
        raise exception using
          errcode = '55000',
          message = 'policy rollover would invalidate a non-archived commercial offer';
      end if;

      perform pg_catalog.set_config(
        'app.pricing_commercial_policy_rollover_id',
        predecessor_record.id::text,
        true
      );
      update public.commercial_policies
         set ends_on = starts_on_value - 1,
             updated_by = p_actor_id
       where id = predecessor_record.id
      returning * into updated_predecessor;
      perform pg_catalog.set_config('app.pricing_commercial_policy_rollover_id', '', true);

      rollovers := rollovers || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'rowNumber', row_number,
          'predecessorId', predecessor_record.id,
          'productId', product_id_value,
          'policyType', policy_type_value,
          'before', pg_catalog.to_jsonb(predecessor_record),
          'after', pg_catalog.to_jsonb(updated_predecessor)
        )
      );
    elsif expected_predecessor_id is not null or expected_lock_version is not null then
      raise exception using errcode = '40001', message = 'loaded policy timeline is stale';
    end if;

    clean_rows := clean_rows || pg_catalog.jsonb_build_array(
      row_value - array['expectedPredecessorId', 'expectedPredecessorLockVersion']
    );
  end loop;

  batch_result := public.create_manual_policy_batch(clean_rows, p_actor_id, p_correlation_id);

  for rollover_value in select value from pg_catalog.jsonb_array_elements(rollovers)
  loop
    successor_id := (batch_result->'policyIds'->>((rollover_value->>'rowNumber')::integer - 1))::bigint;
    insert into public.pricing_audit_events(
      aggregate_type,
      aggregate_id,
      action,
      before_snapshot,
      after_snapshot,
      reason,
      actor_id,
      correlation_id
    ) values (
      'commercial_policy',
      (rollover_value->>'predecessorId')::bigint,
      'update',
      rollover_value->'before',
      (rollover_value->'after') || pg_catalog.jsonb_build_object(
        'successorPolicyId', successor_id,
        'productId', (rollover_value->>'productId')::integer,
        'policyType', rollover_value->>'policyType'
      ),
      'monthly commercial policy temporal rollover',
      p_actor_id,
      p_correlation_id
    );
  end loop;

  return batch_result || pg_catalog.jsonb_build_object(
    'rolloverCount', pg_catalog.jsonb_array_length(rollovers),
    'rollovers', rollovers
  );
end;
$$;

alter function public.prevent_terminal_commercial_policy_change() owner to postgres;
alter function public.create_manual_policy_batch_with_rollover(jsonb, uuid, uuid) owner to postgres;
revoke all on function public.prevent_terminal_commercial_policy_change()
  from public, anon, authenticated, service_role;
revoke all on function public.create_manual_policy_batch_with_rollover(jsonb, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_manual_policy_batch_with_rollover(jsonb, uuid, uuid)
  to service_role;

comment on function public.create_manual_policy_batch_with_rollover(jsonb, uuid, uuid) is
  'Atomically closes an unambiguous predecessor and creates a monthly manual policy batch.';

create function public.create_commercial_offer_batch_at_reference(
  p_rows jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value jsonb;
  reference_date date;
  policy_ids bigint[];
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid referenced offer batch';
  end if;

  for row_value in select value from pg_catalog.jsonb_array_elements(p_rows)
  loop
    if nullif(row_value->>'referenceDate', '') is null then
      continue;
    end if;
    reference_date := (row_value->>'referenceDate')::date;
    select pg_catalog.array_agg((item.value#>>'{}')::bigint)
      into policy_ids
      from pg_catalog.jsonb_array_elements(row_value->'policyIds') as item(value);
    if exists (
      select 1
        from pg_catalog.unnest(policy_ids) as selected(policy_id)
        left join public.commercial_policies as policy on policy.id = selected.policy_id
       where policy.id is null
          or policy.product_id <> (row_value->>'productId')::integer
          or policy.status in ('archived', 'rejected')
          or policy.starts_on > reference_date
          or (policy.ends_on is not null and policy.ends_on < reference_date)
    ) then
      raise exception using
        errcode = '23514',
        message = 'offer batch contains a policy that is not applicable on the reference date';
    end if;
  end loop;

  return public.create_commercial_offer_batch(p_rows, p_actor_id, p_correlation_id);
end;
$$;

alter function public.create_commercial_offer_batch_at_reference(jsonb, uuid, uuid)
  owner to postgres;
revoke all on function public.create_commercial_offer_batch_at_reference(jsonb, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_commercial_offer_batch_at_reference(jsonb, uuid, uuid)
  to service_role;
