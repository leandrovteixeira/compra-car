-- QA-only: auditable administrative correction of a published public price.
-- This RPC is only callable through the service role; its actor must be an active pricing admin.
create or replace function public.guard_product_public_price_identity_for_correction()
returns trigger language plpgsql set search_path = '' as $$
declare allowed boolean;
begin
  allowed := current_user = 'postgres'
    and coalesce(pg_catalog.current_setting('app.pricing_admin_correction_id',true),'') = old.id::text;
  if old.status::text in ('published','archived') and not allowed and (
    (old.status::text = 'published' and new.status::text not in ('published','archived'))
    or (old.status::text = 'archived' and new.status::text <> 'archived')
    or new.product_id is distinct from old.product_id
    or new.amount is distinct from old.amount
    or new.currency_code is distinct from old.currency_code
    or new.starts_on is distinct from old.starts_on
    or new.source_type is distinct from old.source_type
    or new.source_import_row_id is distinct from old.source_import_row_id
    or new.source_snapshot is distinct from old.source_snapshot
  ) then
    raise exception using errcode='55000',message='published pricing economic identity is immutable outside audited correction';
  end if;
  return new;
end;
$$;
create or replace function public.guard_product_public_price_v2_for_correction()
returns trigger language plpgsql set search_path = '' as $$
declare allowed boolean;
begin
  allowed := current_user = 'postgres'
    and coalesce(pg_catalog.current_setting('app.pricing_admin_correction_id',true),'') = old.id::text;
  if old.status::text in ('published','archived') and (
    new.price_type is distinct from old.price_type
    or new.source_reference is distinct from old.source_reference
    or new.legacy_source_id is distinct from old.legacy_source_id
    or (new.ends_on is distinct from old.ends_on and not allowed and not (
      old.status::text='published' and current_user='postgres'
      and coalesce(pg_catalog.current_setting('app.pricing_product_public_price_rollover_id',true),'')=old.id::text
    ))
  ) then
    raise exception using errcode='55000', message='published pricing V2 identity is immutable outside audited correction';
  end if;
  return new;
end;
$$;
drop trigger if exists product_public_prices_prevent_terminal_identity_change on public.product_public_prices;
create trigger product_public_prices_prevent_terminal_identity_change
before update on public.product_public_prices for each row
execute function public.guard_product_public_price_identity_for_correction();
drop trigger if exists product_public_prices_prevent_terminal_v2_change on public.product_public_prices;
create trigger product_public_prices_prevent_terminal_v2_change
before update on public.product_public_prices for each row
execute function public.guard_product_public_price_v2_for_correction();

create or replace function public.correct_published_product_public_price(
  p_price_id bigint, p_actor_id uuid, p_expected_lock_version integer,
  p_amount numeric, p_starts_on date, p_ends_on date,
  p_reason text, p_correlation_id uuid
) returns public.product_public_prices
language plpgsql security definer set search_path = '' as $$
declare old_record public.product_public_prices%rowtype;
  changed public.product_public_prices%rowtype;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or p_reason is null or length(trim(p_reason)) < 8
     or p_expected_lock_version is null then
    raise exception using errcode='22023',message='correction requires reason, correlation ID and lock version';
  end if;
  if p_amount is null or p_amount <= 0 or p_starts_on is null
     or (p_ends_on is not null and p_ends_on < p_starts_on) then
    raise exception using errcode='23514',message='invalid corrected price or dates';
  end if;
  select * into old_record from public.product_public_prices where id=p_price_id;
  if not found then raise exception using errcode='P0002',message='price does not exist'; end if;
  perform pg_catalog.pg_advisory_xact_lock(9472,old_record.product_id);
  select * into old_record from public.product_public_prices where id=p_price_id for update;
  if old_record.status::text <> 'published' then
    raise exception using errcode='55000',message='only published prices can be corrected via this action';
  end if;
  if old_record.lock_version <> p_expected_lock_version then
    raise exception using errcode='40001',message='stale price version, reload the record';
  end if;
  if exists(
    select 1 from public.product_public_prices other
    where other.product_id=old_record.product_id and other.id<>old_record.id
      and other.status::text='published'
      and pg_catalog.daterange(other.starts_on,other.ends_on,'[]')
          && pg_catalog.daterange(p_starts_on,p_ends_on,'[]')
  ) then
    raise exception using errcode='23505',message='corrected dates overlap another published price';
  end if;
  if old_record.amount is not distinct from p_amount
    and old_record.starts_on is not distinct from p_starts_on
    and old_record.ends_on is not distinct from p_ends_on then
    return old_record;
  end if;
  perform pg_catalog.set_config('app.pricing_admin_correction_id',old_record.id::text,true);
  update public.product_public_prices
    set amount=p_amount, starts_on=p_starts_on, ends_on=p_ends_on,
      updated_by=p_actor_id, lock_version=lock_version+1
    where id=old_record.id returning * into changed;
  perform pg_catalog.set_config('app.pricing_admin_correction_id','',true);
  insert into public.pricing_audit_events
    (aggregate_type,aggregate_id,action,before_snapshot,after_snapshot,reason,actor_id,correlation_id)
    values ('product_public_price',old_record.id,'update',
       pg_catalog.to_jsonb(old_record),pg_catalog.to_jsonb(changed),
       trim(p_reason),p_actor_id,p_correlation_id);
  return changed;
end;
$$;
revoke all on function public.correct_published_product_public_price(bigint,uuid,integer,numeric,date,date,text,uuid) from PUBLIC;
revoke all on function public.correct_published_product_public_price(bigint,uuid,integer,numeric,date,date,text,uuid) from authenticated;
grant execute on function public.correct_published_product_public_price(bigint,uuid,integer,numeric,date,date,text,uuid) to service_role;
