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
        and current_user = 'postgres'
        and coalesce(pg_catalog.current_setting('app.pricing_product_public_price_rollover_id', true), '') = old.id::text
      )
    )
  ) then
    raise exception using errcode = '55000', message = 'published or archived product public price V2 identity is immutable';
  end if;
  return new;
end;
$$;
