alter table public.financial_parameter_sets
  add constraint financial_parameter_sets_mvp_spread_check
  check (spread_monthly_percentage = 0.300000);

create function public.derive_financial_parameter_rates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.monthly_cdi_rate := pg_catalog.round(new.cdi_monthly_percentage / 100, 12);
  new.monthly_spread_rate := pg_catalog.round(new.spread_monthly_percentage / 100, 12);
  new.monthly_reference_rate := pg_catalog.round(
    new.monthly_cdi_rate + new.monthly_spread_rate,
    12
  );
  new.annual_cdi_rate := pg_catalog.round(
    pg_catalog.power(1 + new.monthly_cdi_rate, 12) - 1,
    12
  );
  new.methodology := 'effective_annual_cdi_plus_monthly_spread';
  return new;
end;
$$;

alter function public.derive_financial_parameter_rates() owner to postgres;
revoke all on function public.derive_financial_parameter_rates()
from public, anon, authenticated, service_role;

create trigger financial_parameter_sets_derive_rates
before insert or update on public.financial_parameter_sets
for each row execute function public.derive_financial_parameter_rates();

create function public.prevent_overlapping_financial_parameter_sets()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published'::public.pricing_workflow_status then
    perform pg_catalog.pg_advisory_xact_lock(9130, 1);
    if exists (
      select 1
        from public.financial_parameter_sets as existing
       where existing.id <> new.id
         and existing.status = 'published'::public.pricing_workflow_status
         and pg_catalog.daterange(
               existing.effective_from,
               coalesce(existing.valid_to, 'infinity'::date),
               '[]'
             ) && pg_catalog.daterange(
               new.effective_from,
               coalesce(new.valid_to, 'infinity'::date),
               '[]'
             )
    ) then
      raise exception using
        errcode = '23P01',
        message = 'published financial parameter set validity overlaps an existing reference';
    end if;
  end if;
  return new;
end;
$$;

alter function public.prevent_overlapping_financial_parameter_sets() owner to postgres;
revoke all on function public.prevent_overlapping_financial_parameter_sets()
from public, anon, authenticated, service_role;

create trigger financial_parameter_sets_prevent_published_overlap
before insert or update on public.financial_parameter_sets
for each row execute function public.prevent_overlapping_financial_parameter_sets();

create or replace function public.prevent_terminal_pricing_migration_rule_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'financial_parameter_sets'
     and old.status::text = 'published'
     and new.status::text = 'published'
     and current_setting('app.pricing_financial_parameter_rollover_id', true) = old.id::text
     and new.valid_to is not null
     and new.valid_to >= old.effective_from
     and to_jsonb(new) - array['valid_to','updated_at','updated_by','lock_version']
       is not distinct from
         to_jsonb(old) - array['valid_to','updated_at','updated_by','lock_version'] then
    return new;
  end if;

  if old.status::text = 'archived' and new.status is distinct from old.status then
    raise exception using errcode = '55000', message = 'archived pricing records are immutable';
  end if;
  if old.status::text = 'published' and new.status::text not in ('published', 'archived') then
    raise exception using errcode = '55000', message = 'published pricing records may only be archived';
  end if;
  if old.status::text in ('published', 'archived')
     and to_jsonb(new) - array['status','updated_at','updated_by','lock_version']
       is distinct from to_jsonb(old) - array['status','updated_at','updated_by','lock_version'] then
    raise exception using errcode = '55000', message = 'published or archived pricing migration fields are immutable';
  end if;
  return new;
end;
$$;

alter function public.prevent_terminal_pricing_migration_rule_change() owner to postgres;
revoke all on function public.prevent_terminal_pricing_migration_rule_change()
from public, anon, authenticated, service_role;

create function public.rollover_financial_parameter_set(
  p_current_parameter_set_id bigint,
  p_next_parameter_set_id bigint,
  p_actor_id uuid,
  p_expected_current_lock_version integer,
  p_expected_next_lock_version integer,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_record public.financial_parameter_sets%rowtype;
  next_record public.financial_parameter_sets%rowtype;
  current_before jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null then
    raise exception using errcode = '22004', message = 'financial parameter rollover requires correlation_id';
  end if;
  if p_current_parameter_set_id = p_next_parameter_set_id then
    raise exception using errcode = '22023', message = 'financial parameter rollover requires distinct parameter sets';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(9130, 1);
  select * into current_record
    from public.financial_parameter_sets
   where id = p_current_parameter_set_id
   for update;
  select * into next_record
    from public.financial_parameter_sets
   where id = p_next_parameter_set_id
   for update;

  if current_record.id is null or next_record.id is null then
    raise exception using errcode = 'P0002', message = 'financial parameter rollover record does not exist';
  end if;
  if current_record.status <> 'published'::public.pricing_workflow_status
     or current_record.valid_to is not null then
    raise exception using errcode = '55000', message = 'financial parameter rollover requires an open published current reference';
  end if;
  if next_record.status not in (
       'draft'::public.pricing_workflow_status,
       'needs_review'::public.pricing_workflow_status
     ) then
    raise exception using errcode = '55000', message = 'financial parameter rollover requires a publishable next reference';
  end if;
  if current_record.lock_version <> p_expected_current_lock_version
     or next_record.lock_version <> p_expected_next_lock_version then
    raise exception using errcode = '40001', message = 'stale financial parameter rollover lock_version';
  end if;
  if next_record.version <= current_record.version
     or next_record.effective_from <= current_record.effective_from then
    raise exception using errcode = '23514', message = 'next financial reference must have a later version and effective date';
  end if;

  current_before := to_jsonb(current_record);
  perform pg_catalog.set_config(
    'app.pricing_financial_parameter_rollover_id',
    current_record.id::text,
    true
  );
  update public.financial_parameter_sets
     set valid_to = next_record.effective_from - 1,
         updated_by = p_actor_id
   where id = current_record.id
  returning * into current_record;

  insert into public.pricing_audit_events (
    aggregate_type,
    aggregate_id,
    action,
    before_snapshot,
    after_snapshot,
    reason,
    actor_id,
    correlation_id
  ) values (
    'financial_parameter_set',
    current_record.id,
    'update',
    current_before,
    to_jsonb(current_record),
    'financial parameter set temporal rollover',
    p_actor_id,
    p_correlation_id
  );

  select * into next_record
    from public.publish_financial_parameter_set(
      next_record.id,
      p_actor_id,
      p_expected_next_lock_version,
      p_correlation_id
    );

  return pg_catalog.jsonb_build_object(
    'previous', to_jsonb(current_record),
    'current', to_jsonb(next_record)
  );
end;
$$;

alter function public.rollover_financial_parameter_set(bigint, bigint, uuid, integer, integer, uuid)
owner to postgres;
revoke all on function public.rollover_financial_parameter_set(bigint, bigint, uuid, integer, integer, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.rollover_financial_parameter_set(bigint, bigint, uuid, integer, integer, uuid)
to service_role;

comment on function public.rollover_financial_parameter_set(bigint, bigint, uuid, integer, integer, uuid)
is 'Atomically closes the current published financial reference and publishes its prepared successor.';
