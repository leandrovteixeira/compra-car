create or replace function public.prevent_terminal_product_public_price_v2_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.status in ('published', 'archived') and (
    new.price_type is distinct from old.price_type
    or new.source_reference is distinct from old.source_reference
    or new.legacy_source_id is distinct from old.legacy_source_id
    or (
      new.ends_on is distinct from old.ends_on
      and not (
        old.status = 'published'
        and pg_catalog.current_user = 'postgres'
        and pg_catalog.current_setting('app.pricing_product_public_price_rollover_id', true) = old.id::text
      )
    )
  ) then
    raise exception using errcode = '55000', message = 'published or archived product public price V2 identity is immutable';
  end if;
  return new;
end;
$$;

create function public.rollover_product_public_price(
  p_previous_price_id bigint,
  p_successor_price_id bigint,
  p_actor_id uuid,
  p_expected_previous_lock_version integer,
  p_expected_successor_lock_version integer,
  p_correlation_id uuid
) returns public.product_public_prices
language plpgsql security definer set search_path = '' as $$
declare
  previous_record public.product_public_prices%rowtype;
  successor_record public.product_public_prices%rowtype;
  before_snapshot jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or p_expected_previous_lock_version is null or p_expected_successor_lock_version is null then
    raise exception using errcode = '22004', message = 'price rollover failed: correlation_id and lock versions are required';
  end if;

  select * into successor_record from public.product_public_prices where id = p_successor_price_id;
  if not found then raise exception using errcode = 'P0002', message = 'price rollover failed: successor does not exist'; end if;
  perform pg_catalog.pg_advisory_xact_lock(9472, successor_record.product_id::integer);
  select * into previous_record from public.product_public_prices where id = p_previous_price_id for update;
  select * into successor_record from public.product_public_prices where id = p_successor_price_id for update;

  if previous_record.id is null or successor_record.id is null
     or previous_record.product_id <> successor_record.product_id
     or previous_record.status <> 'published' or successor_record.status not in ('draft','needs_review','published')
     or previous_record.starts_on >= successor_record.starts_on
     or (previous_record.ends_on is not null and previous_record.ends_on < successor_record.starts_on) then
    raise exception using errcode = '55000', message = 'price rollover failed: predecessor and successor do not form an overlapping published timeline';
  end if;
  if previous_record.lock_version <> p_expected_previous_lock_version or successor_record.lock_version <> p_expected_successor_lock_version then
    raise exception using errcode = '40001', message = 'price rollover failed: stale lock_version';
  end if;
  if exists (
    select 1 from public.product_public_prices p
    where p.product_id = successor_record.product_id and p.status = 'published'
      and p.id not in (previous_record.id, successor_record.id)
      and p.starts_on <= successor_record.starts_on
      and (p.ends_on is null or p.ends_on >= successor_record.starts_on)
  ) then
    raise exception using errcode = '55000', message = 'price rollover failed: timeline has multiple overlapping predecessors';
  end if;

  before_snapshot := pg_catalog.to_jsonb(previous_record);
  perform pg_catalog.set_config('app.pricing_product_public_price_rollover_id', previous_record.id::text, true);
  update public.product_public_prices
     set ends_on = successor_record.starts_on - 1, updated_by = p_actor_id
   where id = previous_record.id returning * into previous_record;
  perform pg_catalog.set_config('app.pricing_product_public_price_rollover_id', '', true);

  insert into public.pricing_audit_events(aggregate_type,aggregate_id,action,before_snapshot,after_snapshot,reason,actor_id,correlation_id)
  values ('product_public_price',previous_record.id,'update',before_snapshot,pg_catalog.to_jsonb(previous_record),'product public price temporal rollover',p_actor_id,p_correlation_id);
  return previous_record;
end;
$$;

alter function public.rollover_product_public_price(bigint,bigint,uuid,integer,integer,uuid) owner to postgres;
revoke all on function public.rollover_product_public_price(bigint,bigint,uuid,integer,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rollover_product_public_price(bigint,bigint,uuid,integer,integer,uuid) to service_role;

create or replace function public.publish_product_public_price(p_price_id bigint,p_actor_id uuid,p_expected_lock_version integer,p_correlation_id uuid)
returns public.product_public_prices language plpgsql security definer set search_path = '' as $$
declare price_record public.product_public_prices%rowtype; predecessor public.product_public_prices%rowtype; before_snapshot jsonb; after_snapshot jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or p_expected_lock_version is null then raise exception using errcode='22004',message='pricing publication failed: correlation_id and expected_lock_version are required'; end if;
  select * into price_record from public.product_public_prices where id=p_price_id;
  if not found then raise exception using errcode='P0002',message='pricing publication failed: product public price does not exist'; end if;
  perform pg_catalog.pg_advisory_xact_lock(9472,price_record.product_id::integer);
  select * into price_record from public.product_public_prices where id=p_price_id for update;
  if price_record.status not in ('draft','needs_review') then raise exception using errcode='55000',message='pricing publication failed: product public price is not publishable'; end if;
  if price_record.lock_version<>p_expected_lock_version then raise exception using errcode='40001',message='pricing publication failed: stale product public price lock_version'; end if;
  if price_record.amount<=0 or price_record.currency_code<>'BRL' or price_record.starts_on is null then raise exception using errcode='23514',message='pricing publication failed: product public price fields are invalid'; end if;
  if price_record.source_type<>'manual' and (price_record.source_import_row_id is null or not exists(select 1 from public.pricing_import_rows r where r.id=price_record.source_import_row_id)) then raise exception using errcode='23514',message='pricing publication failed: non-manual price source row is invalid'; end if;
  if exists(select 1 from public.product_public_prices p where p.id<>price_record.id and p.product_id=price_record.product_id and p.status='published' and p.starts_on>=price_record.starts_on) then raise exception using errcode='23505',message='pricing publication failed: a published price already exists at or after starts_on'; end if;
  select * into predecessor from public.product_public_prices p where p.id<>price_record.id and p.product_id=price_record.product_id and p.status='published' and p.starts_on<price_record.starts_on and (p.ends_on is null or p.ends_on>=price_record.starts_on) order by p.starts_on desc limit 1;
  if predecessor.id is not null then
    perform public.rollover_product_public_price(predecessor.id,price_record.id,p_actor_id,predecessor.lock_version,price_record.lock_version,p_correlation_id);
  end if;
  before_snapshot:=pg_catalog.to_jsonb(price_record);
  update public.product_public_prices set reviewed_at=coalesce(reviewed_at,pg_catalog.now()),reviewed_by=coalesce(reviewed_by,p_actor_id),published_at=pg_catalog.now(),published_by=p_actor_id,updated_by=p_actor_id,status='published' where id=price_record.id returning * into price_record;
  after_snapshot:=pg_catalog.to_jsonb(price_record);
  perform public.insert_pricing_publish_audit('product_public_price',price_record.id,before_snapshot,after_snapshot,p_actor_id,p_correlation_id);
  return price_record;
end; $$;

alter function public.publish_product_public_price(bigint,uuid,integer,uuid) owner to postgres;
revoke all on function public.publish_product_public_price(bigint,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.publish_product_public_price(bigint,uuid,integer,uuid) to service_role;
