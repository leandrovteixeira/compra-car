-- All-or-nothing manual batch save+publish, using existing audited publication routines.
create or replace function public.create_and_publish_manual_price_batch(
  p_rows jsonb, p_actor_id uuid, p_correlation_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; item record; price public.product_public_prices%rowtype;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  result := public.create_manual_price_batch(p_rows,p_actor_id,p_correlation_id);
  for item in
    select (entry.value)::bigint as id
    from pg_catalog.jsonb_array_elements_text(result->'priceIds') as entry(value)
    join public.product_public_prices p on p.id=(entry.value)::bigint
    order by p.product_id,p.starts_on,p.id
  loop
    select * into price from public.product_public_prices where id=item.id;
    perform public.publish_product_public_price(
      price.id,p_actor_id,price.lock_version,pg_catalog.gen_random_uuid()
    );
  end loop;
  return result || pg_catalog.jsonb_build_object('published',true);
end;
$$;
revoke all on function public.create_and_publish_manual_price_batch(jsonb,uuid,uuid) from PUBLIC;
revoke all on function public.create_and_publish_manual_price_batch(jsonb,uuid,uuid) from authenticated;
grant execute on function public.create_and_publish_manual_price_batch(jsonb,uuid,uuid) to service_role;