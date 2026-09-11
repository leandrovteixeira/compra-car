begin;
set local search_path = extensions, public, pg_catalog;
select plan(7);

select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.products'::regclass
    and conname = 'products_public_requires_active'
    and contype = 'c' and convalidated
), 'products has a validated Public requires Active constraint');

-- Exercise the installed constraint on a disposable table, never real product rows.
create temporary table product_state_probe (is_active boolean, is_public boolean);
do $$
declare definition text;
begin
  select pg_get_constraintdef(oid) into strict definition
  from pg_constraint where conrelid = 'public.products'::regclass
    and conname = 'products_public_requires_active';
  execute 'alter table product_state_probe add constraint products_public_requires_active ' || definition;
end $$;

select lives_ok('insert into product_state_probe values (true, true)', 'Active/Public is valid');
select lives_ok('insert into product_state_probe values (true, false)', 'Active/Private is valid');
select lives_ok('insert into product_state_probe values (false, false)', 'Inactive/Private is valid');
select throws_ok('insert into product_state_probe values (false, true)', '23514', null, 'Inactive/Public is rejected');
select throws_ok('insert into product_state_probe values (null, true)', '23514', null, 'Public also rejects unknown Active');
select throws_ok('update product_state_probe set is_active = false where is_public is true', '23514', null, 'raw deactivation cannot leave Public true');

select * from finish();
rollback;
