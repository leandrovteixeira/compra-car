-- Public requires Active. Validate existing rows; fail without repairing data.
alter table public.products
  add constraint products_public_requires_active
  check (is_public IS NOT TRUE OR is_active IS TRUE);
