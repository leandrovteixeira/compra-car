create or replace view public.vw_admin_product_spec_started as
select product_id
from public.product_specs
where value is not null or is_present is not null
group by product_id;
grant select on public.vw_admin_product_spec_started to authenticated, service_role;