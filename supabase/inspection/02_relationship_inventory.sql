-- Compra Car — inventário somente leitura de relacionamentos técnicos.
-- As cardinalidades abaixo são inferências estruturais, não regras de negócio.

-- 1. Foreign keys, colunas, destinos e ações referenciais.
SELECT
  src_ns.nspname AS source_schema,
  src.relname AS source_object,
  con.conname AS foreign_key_name,
  ARRAY(
    SELECT src_attr.attname
    FROM unnest(con.conkey) WITH ORDINALITY AS key_col(attnum, position)
    JOIN pg_catalog.pg_attribute AS src_attr
      ON src_attr.attrelid = con.conrelid
     AND src_attr.attnum = key_col.attnum
    ORDER BY key_col.position
  ) AS source_columns,
  dst_ns.nspname AS target_schema,
  dst.relname AS target_object,
  ARRAY(
    SELECT dst_attr.attname
    FROM unnest(con.confkey) WITH ORDINALITY AS key_col(attnum, position)
    JOIN pg_catalog.pg_attribute AS dst_attr
      ON dst_attr.attrelid = con.confrelid
     AND dst_attr.attnum = key_col.attnum
    ORDER BY key_col.position
  ) AS target_columns,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint AS unique_con
      WHERE unique_con.conrelid = con.conrelid
        AND unique_con.contype IN ('p', 'u')
        AND unique_con.conkey = con.conkey
    ) THEN 'zero_or_one_to_one_reference'
    ELSE 'many_to_one_reference'
  END AS technically_inferred_shape,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete_action,
  CASE con.confupdtype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_update_action,
  con.condeferrable AS is_deferrable,
  con.condeferred AS is_initially_deferred
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS src ON src.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS src_ns ON src_ns.oid = src.relnamespace
JOIN pg_catalog.pg_class AS dst ON dst.oid = con.confrelid
JOIN pg_catalog.pg_namespace AS dst_ns ON dst_ns.oid = dst.relnamespace
WHERE con.contype = 'f'
  AND src_ns.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND src_ns.nspname !~ '^pg_toast'
  AND src_ns.nspname !~ '^pg_temp_'
ORDER BY src_ns.nspname, src.relname, con.conname;

-- 2. Chaves primárias e constraints únicas.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'primary_key'
    WHEN 'u' THEN 'unique'
  END AS key_type,
  ARRAY(
    SELECT a.attname
    FROM unnest(con.conkey) WITH ORDINALITY AS key_col(attnum, position)
    JOIN pg_catalog.pg_attribute AS a
      ON a.attrelid = con.conrelid
     AND a.attnum = key_col.attnum
    ORDER BY key_col.position
  ) AS key_columns,
  con.condeferrable AS is_deferrable,
  con.condeferred AS is_initially_deferred
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE con.contype IN ('p', 'u')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname, c.relname, key_type, con.conname;

-- 3. Candidatas técnicas a tabelas de associação.
-- Critério: tabela com duas ou mais foreign keys. A classificação de negócio exige revisão.
WITH table_stats AS (
  SELECT
    c.oid AS table_oid,
    n.nspname AS schema_name,
    c.relname AS table_name,
    count(a.attnum) FILTER (WHERE a.attnum > 0 AND NOT a.attisdropped) AS column_count
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  LEFT JOIN pg_catalog.pg_attribute AS a ON a.attrelid = c.oid
  WHERE c.relkind IN ('r', 'p')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
    AND n.nspname !~ '^pg_toast'
    AND n.nspname !~ '^pg_temp_'
  GROUP BY c.oid, n.nspname, c.relname
), constraint_stats AS (
  SELECT
    con.conrelid AS table_oid,
    count(*) FILTER (WHERE con.contype = 'f') AS foreign_key_count,
    coalesce(sum(cardinality(con.conkey)) FILTER (WHERE con.contype = 'f'), 0) AS foreign_key_column_count,
    coalesce(sum(cardinality(con.conkey)) FILTER (WHERE con.contype = 'p'), 0) AS primary_key_column_count
  FROM pg_catalog.pg_constraint AS con
  GROUP BY con.conrelid
)
SELECT
  t.schema_name,
  t.table_name,
  t.column_count,
  s.foreign_key_count,
  s.foreign_key_column_count,
  s.primary_key_column_count,
  'candidate_only: two_or_more_foreign_keys' AS technical_reason
FROM table_stats AS t
JOIN constraint_stats AS s ON s.table_oid = t.table_oid
WHERE s.foreign_key_count >= 2
ORDER BY t.schema_name, t.table_name;
