-- Inventario somente leitura de indices, incluindo indices parciais.
SELECT
    n.nspname AS schema_name,
    t.relname AS table_name,
    i.relname AS index_name,
    am.amname AS access_method,
    ix.indisprimary AS is_primary,
    ix.indisunique AS is_unique,
    ix.indisvalid AS is_valid,
    ix.indisready AS is_ready,
    pg_catalog.pg_get_indexdef(i.oid) AS index_definition
FROM pg_catalog.pg_index AS ix
JOIN pg_catalog.pg_class AS i ON i.oid = ix.indexrelid
JOIN pg_catalog.pg_class AS t ON t.oid = ix.indrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
JOIN pg_catalog.pg_am AS am ON am.oid = i.relam
WHERE n.nspname = 'public'
ORDER BY n.nspname, t.relname, i.relname;
