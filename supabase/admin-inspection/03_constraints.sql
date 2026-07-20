-- Inventario somente leitura de constraints e respectivas definicoes.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    con.conname AS constraint_name,
    CASE con.contype
        WHEN 'p' THEN 'primary_key'
        WHEN 'u' THEN 'unique'
        WHEN 'f' THEN 'foreign_key'
        WHEN 'c' THEN 'check'
        ELSE con.contype::text
    END AS constraint_type,
    rn.nspname AS referenced_schema_name,
    rc.relname AS referenced_table_name,
    con.condeferrable AS is_deferrable,
    con.condeferred AS initially_deferred,
    con.convalidated AS is_validated,
    pg_catalog.pg_get_constraintdef(con.oid, true) AS constraint_definition
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_class AS rc ON rc.oid = con.confrelid
LEFT JOIN pg_catalog.pg_namespace AS rn ON rn.oid = rc.relnamespace
WHERE con.contype IN ('p', 'u', 'f', 'c')
  AND n.nspname = 'public'
ORDER BY n.nspname, c.relname, constraint_type, con.conname;
