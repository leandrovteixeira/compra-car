-- Compra Car — prontidão do baseline legado, somente leitura.
-- Consulta apenas metadados. Não executa DDL, DML, functions de negócio ou alterações de grants/RLS.

-- 1. Versão efetiva do PostgreSQL, sem dados de conexão.
SELECT
  current_setting('server_version') AS server_version,
  current_setting('server_version_num') AS server_version_number;

-- 2. Extensões instaladas e schema de instalação.
SELECT
  e.extname AS extension_name,
  e.extversion AS extension_version,
  n.nspname AS extension_schema,
  pg_catalog.pg_get_userbyid(e.extowner) AS owner_name
FROM pg_catalog.pg_extension AS e
JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
ORDER BY e.extname;

-- 3. Schemas não internos, owner e ACL declarada.
SELECT
  n.nspname AS schema_name,
  pg_catalog.pg_get_userbyid(n.nspowner) AS owner_name,
  n.nspacl::text AS declared_acl
FROM pg_catalog.pg_namespace AS n
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname;

-- 4. Enums e domains próprios fora de schemas internos.
SELECT
  n.nspname AS schema_name,
  t.typname AS type_name,
  CASE t.typtype
    WHEN 'e' THEN 'enum'
    WHEN 'd' THEN 'domain'
    ELSE t.typtype::text
  END AS type_kind,
  pg_catalog.format_type(t.typbasetype, t.typtypmod) AS domain_base_type,
  t.typnotnull AS domain_not_null,
  pg_catalog.pg_get_expr(t.typdefaultbin, 0) AS domain_default,
  enum_values.values_in_order
FROM pg_catalog.pg_type AS t
JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
LEFT JOIN LATERAL (
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values_in_order
  FROM pg_catalog.pg_enum AS e
  WHERE e.enumtypid = t.oid
) AS enum_values ON true
WHERE t.typtype IN ('e', 'd')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname, t.typname;

-- 5. Definições atuais de views próprias no schema public.
SELECT
  n.nspname AS schema_name,
  c.relname AS view_name,
  CASE c.relkind
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized_view'
  END AS view_kind,
  pg_catalog.pg_get_userbyid(c.relowner) AS owner_name,
  coalesce(c.reloptions, ARRAY[]::text[]) AS relation_options,
  pg_catalog.pg_get_viewdef(c.oid, true) AS view_definition
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind IN ('v', 'm')
  AND n.nspname = 'public'
ORDER BY c.relname;

-- 6. ACLs de todos os privilégios declarados em objetos public.
SELECT
  g.table_schema AS schema_name,
  g.table_name AS object_name,
  'table_or_view'::text AS object_kind,
  g.grantee,
  g.privilege_type,
  g.is_grantable
FROM information_schema.table_privileges AS g
WHERE g.table_schema = 'public'

UNION ALL

SELECT
  g.routine_schema AS schema_name,
  g.specific_name AS object_name,
  'routine'::text AS object_kind,
  g.grantee,
  g.privilege_type,
  g.is_grantable
FROM information_schema.routine_privileges AS g
WHERE g.routine_schema = 'public'

UNION ALL

SELECT
  g.object_schema AS schema_name,
  g.object_name,
  'sequence'::text AS object_kind,
  g.grantee,
  g.privilege_type,
  g.is_grantable
FROM information_schema.usage_privileges AS g
WHERE g.object_schema = 'public'
  AND g.object_type = 'SEQUENCE'

ORDER BY schema_name, object_kind, object_name, grantee, privilege_type;

-- 7. Privilégios por coluna, quando diferem do grant de tabela.
SELECT
  g.table_schema AS schema_name,
  g.table_name,
  g.column_name,
  g.grantee,
  g.privilege_type,
  g.is_grantable
FROM information_schema.column_privileges AS g
WHERE g.table_schema = 'public'
ORDER BY g.table_name, g.column_name, g.grantee, g.privilege_type;

-- 8. Default privileges declarados para criação futura de objetos.
SELECT
  n.nspname AS schema_name,
  pg_catalog.pg_get_userbyid(d.defaclrole) AS owner_name,
  d.defaclobjtype AS object_type_code,
  d.defaclacl::text AS declared_acl
FROM pg_catalog.pg_default_acl AS d
LEFT JOIN pg_catalog.pg_namespace AS n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public'
   OR d.defaclnamespace = 0
ORDER BY schema_name NULLS FIRST, owner_name, object_type_code;

-- 9. Tabelas próprias incluídas em publications PostgreSQL.
SELECT
  p.pubname AS publication_name,
  p.puballtables AS publishes_all_tables,
  pt.schemaname AS schema_name,
  pt.tablename AS table_name
FROM pg_catalog.pg_publication AS p
LEFT JOIN pg_catalog.pg_publication_tables AS pt ON pt.pubname = p.pubname
WHERE pt.schemaname = 'public'
   OR p.puballtables
ORDER BY p.pubname, pt.schemaname NULLS FIRST, pt.tablename NULLS FIRST;

-- 10. Foreign keys de public para schemas gerenciados ou customizados externos.
SELECT
  source_namespace.nspname AS source_schema,
  source_relation.relname AS source_table,
  constraint_definition.conname AS constraint_name,
  target_namespace.nspname AS target_schema,
  target_relation.relname AS target_table,
  pg_catalog.pg_get_constraintdef(constraint_definition.oid, true) AS constraint_sql
FROM pg_catalog.pg_constraint AS constraint_definition
JOIN pg_catalog.pg_class AS source_relation
  ON source_relation.oid = constraint_definition.conrelid
JOIN pg_catalog.pg_namespace AS source_namespace
  ON source_namespace.oid = source_relation.relnamespace
JOIN pg_catalog.pg_class AS target_relation
  ON target_relation.oid = constraint_definition.confrelid
JOIN pg_catalog.pg_namespace AS target_namespace
  ON target_namespace.oid = target_relation.relnamespace
WHERE constraint_definition.contype = 'f'
  AND source_namespace.nspname = 'public'
  AND target_namespace.nspname <> 'public'
ORDER BY source_relation.relname, constraint_definition.conname;
