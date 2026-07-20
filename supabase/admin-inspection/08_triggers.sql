-- Inventario somente leitura de triggers; nenhum trigger e executado.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    t.tgname AS trigger_name,
    pn.nspname AS function_schema_name,
    p.proname AS function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_identity_arguments,
    CASE
        WHEN (t.tgtype & 2) <> 0 THEN 'BEFORE'
        WHEN (t.tgtype & 64) <> 0 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END AS action_timing,
    concat_ws(', ',
        CASE WHEN (t.tgtype & 4) <> 0 THEN 'INSERT' END,
        CASE WHEN (t.tgtype & 8) <> 0 THEN 'DELETE' END,
        CASE WHEN (t.tgtype & 16) <> 0 THEN 'UPDATE' END,
        CASE WHEN (t.tgtype & 32) <> 0 THEN 'TRUNCATE' END
    ) AS event_manipulation,
    CASE WHEN (t.tgtype & 1) <> 0 THEN 'ROW' ELSE 'STATEMENT' END AS action_orientation,
    CASE t.tgenabled
        WHEN 'O' THEN 'enabled'
        WHEN 'D' THEN 'disabled'
        WHEN 'R' THEN 'replica'
        WHEN 'A' THEN 'always'
        ELSE t.tgenabled::text
    END AS enabled_state,
    t.tgisinternal AS is_internal,
    pg_catalog.pg_get_triggerdef(t.oid, true) AS trigger_definition
FROM pg_catalog.pg_trigger AS t
JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_proc AS p ON p.oid = t.tgfoid
JOIN pg_catalog.pg_namespace AS pn ON pn.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
ORDER BY n.nspname, c.relname, t.tgname;
