-- Estimativas do planejador; nao consulta linhas nem executa contagem exata.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    CASE c.relkind
        WHEN 'r' THEN 'table'
        WHEN 'p' THEN 'partitioned_table'
        WHEN 'm' THEN 'materialized_view'
    END AS object_type,
    GREATEST(c.reltuples, 0)::bigint AS estimated_rows,
    c.relpages AS estimated_pages,
    pg_catalog.pg_total_relation_size(c.oid) AS approximate_total_bytes,
    pg_catalog.pg_size_pretty(pg_catalog.pg_total_relation_size(c.oid)) AS approximate_total_size,
    s.last_analyze,
    s.last_autoanalyze
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_stat_all_tables AS s ON s.relid = c.oid
WHERE c.relkind IN ('r', 'p', 'm')
  AND n.nspname = 'public'
ORDER BY n.nspname, c.relname;
