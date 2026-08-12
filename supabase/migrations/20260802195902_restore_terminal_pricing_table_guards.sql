-- Restore the historical financial rollover exception while preserving the
-- narrowly scoped commercial-period Offer closure introduced in Sprint 9H.2.
-- Table-specific columns are referenced only inside their table guard.
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

  if tg_table_name = 'financial_parameter_sets' then
    if old.status::text = 'published'
       and new.status::text = 'published'
       and pg_catalog.current_setting(
         'app.pricing_financial_parameter_rollover_id', true
       ) = old.id::text
       and new.valid_to is not null
       and new.valid_to >= old.effective_from
       and pg_catalog.to_jsonb(new) - array[
         'valid_to', 'updated_at', 'updated_by', 'lock_version'
       ] is not distinct from pg_catalog.to_jsonb(old) - array[
         'valid_to', 'updated_at', 'updated_by', 'lock_version'
       ] then
      return new;
    end if;
  end if;

  if tg_table_name = 'commercial_offers' then
    if old.status::text = 'published'
       and new.status::text = 'published'
       and current_user = 'postgres'
       and pg_catalog.current_setting(
         'app.pricing_commercial_period_offer_rollover_id', true
       ) = old.id::text
       and new.valid_to is distinct from old.valid_to
       and pg_catalog.to_jsonb(new) - array[
         'valid_to', 'updated_at', 'updated_by', 'lock_version'
       ] = pg_catalog.to_jsonb(old) - array[
         'valid_to', 'updated_at', 'updated_by', 'lock_version'
       ] then
      return new;
    end if;
  end if;

  if old.status::text = 'published' and new.status::text not in ('published', 'archived') then
    raise exception using errcode = '55000', message = 'published pricing records may only be archived';
  end if;
  if old.status::text in ('published', 'archived')
     and pg_catalog.to_jsonb(new) - array[
       'status', 'updated_at', 'updated_by', 'lock_version'
     ] is distinct from pg_catalog.to_jsonb(old) - array[
       'status', 'updated_at', 'updated_by', 'lock_version'
     ] then
    raise exception using errcode = '55000', message = 'published or archived pricing migration fields are immutable';
  end if;
  return new;
end;
$$;

alter function public.prevent_terminal_pricing_migration_rule_change() owner to postgres;
revoke all on function public.prevent_terminal_pricing_migration_rule_change()
from public, anon, authenticated, service_role;
