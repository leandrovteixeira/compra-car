begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_function(
  'public',
  'prevent_terminal_pricing_migration_rule_change',
  array[]::text[],
  'shared terminal pricing trigger function exists'
);
select function_lang_is(
  'public',
  'prevent_terminal_pricing_migration_rule_change',
  array[]::text[],
  'plpgsql',
  'shared terminal pricing trigger is plpgsql'
);
select function_returns(
  'public',
  'prevent_terminal_pricing_migration_rule_change',
  array[]::text[],
  'trigger',
  'shared terminal pricing function returns trigger'
);
select is(
  (select prosecdef from pg_proc
    where oid='public.prevent_terminal_pricing_migration_rule_change()'::regprocedure),
  false,
  'shared terminal pricing trigger remains security invoker'
);
select matches(
  pg_get_functiondef('public.prevent_terminal_pricing_migration_rule_change()'::regprocedure),
  E'if tg_table_name = ''financial_parameter_sets'' then\n    if old.status::text = ''published''',
  'financial rollover field access is structurally isolated by table'
);
select is(
  (select count(*) from pg_trigger
    where tgfoid='public.prevent_terminal_pricing_migration_rule_change()'::regprocedure
      and not tgisinternal),
  4::bigint,
  'all four existing triggers remain attached'
);

select * from finish();
rollback;
