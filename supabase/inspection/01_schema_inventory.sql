-- Compra Car — inventário somente leitura de schema e objetos.
-- Executar no SQL Editor apenas no ambiente confirmado para inspeção.
-- Este arquivo consulta metadados e não lê conteúdo de tabelas de negócio.

-- 1. Schemas não internos visíveis ao usuário atual.
SELECT
  n.oid AS schema_oid,
  n.nspname AS schema_name,
  pg_get_userbyid(n.nspowner) AS owner_name,
  has_schema_privilege(current_user, n.oid, 'USAGE') AS current_user_has_usage
FROM pg_catalog.pg_namespace AS n
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname;

-- 2. Tabelas, views, materialized views e estimativa de linhas.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned_table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized_view'
    WHEN 'f' THEN 'foreign_table'
    ELSE c.relkind::text
  END AS object_type,
  pg_get_userbyid(c.relowner) AS owner_name,
  c.relpersistence AS persistence_code,
  c.reltuples::bigint AS estimated_row_count,
  pg_catalog.obj_description(c.oid, 'pg_class') AS object_comment
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname, object_type, c.relname;

-- 3. Colunas, tipos, nulabilidade, defaults e comentários.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  a.attnum AS ordinal_position,
  a.attname AS column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS formatted_type,
  t.typname AS underlying_type_name,
  NOT a.attnotnull AS is_nullable,
  pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
  a.attidentity AS identity_code,
  a.attgenerated AS generated_code,
  pg_catalog.col_description(c.oid, a.attnum) AS column_comment
FROM pg_catalog.pg_attribute AS a
JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_type AS t ON t.oid = a.atttypid
LEFT JOIN pg_catalog.pg_attrdef AS ad
  ON ad.adrelid = a.attrelid
 AND ad.adnum = a.attnum
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname, c.relname, a.attnum;

-- 4. Enums e seus valores ordenados.
SELECT
  n.nspname AS schema_name,
  t.typname AS enum_name,
  e.enumsortorder AS sort_order,
  e.enumlabel AS enum_value
FROM pg_catalog.pg_type AS t
JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
JOIN pg_catalog.pg_enum AS e ON e.enumtypid = t.oid
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname, t.typname, e.enumsortorder;

-- 5. Constraints declaradas, sem inferir regras de negócio.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'primary_key'
    WHEN 'u' THEN 'unique'
    WHEN 'f' THEN 'foreign_key'
    WHEN 'c' THEN 'check'
    WHEN 'x' THEN 'exclusion'
    ELSE con.contype::text
  END AS constraint_type,
  pg_catalog.pg_get_constraintdef(con.oid, true) AS constraint_definition
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname, c.relname, constraint_type, con.conname;

-- 6. Índices e respectivas definições.
SELECT
  i.schemaname AS schema_name,
  i.tablename AS object_name,
  i.indexname AS index_name,
  i.tablespace,
  i.indexdef AS index_definition
FROM pg_catalog.pg_indexes AS i
WHERE i.schemaname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND i.schemaname !~ '^pg_toast'
  AND i.schemaname !~ '^pg_temp_'
ORDER BY i.schemaname, i.tablename, i.indexname;

-- 7. Comentários explícitos em relações e colunas.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  CASE WHEN d.objsubid = 0 THEN NULL ELSE a.attname END AS column_name,
  d.description AS comment_text
FROM pg_catalog.pg_description AS d
JOIN pg_catalog.pg_class AS c ON c.oid = d.objoid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_attribute AS a
  ON a.attrelid = c.oid
 AND a.attnum = d.objsubid
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname, c.relname, d.objsubid;

-- 8. Funções declaradas em schemas não internos; não chama nenhuma função listada.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_catalog.pg_get_function_result(p.oid) AS result_type,
  p.prokind AS function_kind_code,
  p.provolatile AS volatility_code,
  p.prosecdef AS runs_with_owner_privileges,
  pg_catalog.obj_description(p.oid, 'pg_proc') AS function_comment
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname, p.proname, identity_arguments;
