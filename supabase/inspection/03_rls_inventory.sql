-- Compra Car — inventário somente leitura de RLS e permissões.
-- Este arquivo não altera políticas, roles ou grants.

-- 1. Estado de RLS por tabela.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  pg_get_userbyid(c.relowner) AS owner_name
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname, c.relname;

-- 2. Políticas existentes e suas expressões declaradas.
SELECT
  p.schemaname AS schema_name,
  p.tablename AS table_name,
  p.policyname AS policy_name,
  p.permissive,
  p.roles,
  p.cmd AS policy_command,
  p.qual AS using_expression,
  p.with_check AS with_check_expression
FROM pg_catalog.pg_policies AS p
WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND p.schemaname !~ '^pg_toast'
  AND p.schemaname !~ '^pg_temp_'
ORDER BY p.schemaname, p.tablename, p.policyname;

-- 3. Grants de leitura declarados para tabelas e views.
SELECT
  g.table_schema AS schema_name,
  g.table_name AS object_name,
  c.relkind AS object_kind_code,
  g.grantor,
  g.grantee,
  g.privilege_type,
  g.is_grantable,
  g.with_hierarchy
FROM information_schema.table_privileges AS g
JOIN pg_catalog.pg_namespace AS n ON n.nspname = g.table_schema
JOIN pg_catalog.pg_class AS c
  ON c.relnamespace = n.oid
 AND c.relname = g.table_name
WHERE g.privilege_type = 'SELECT'
  AND g.table_schema NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND g.table_schema !~ '^pg_toast'
  AND g.table_schema !~ '^pg_temp_'
ORDER BY g.table_schema, g.table_name, g.grantee;

-- 4. Views e materialized views com possível exposição a roles comuns do Supabase.
-- A presença de grant não confirma que o objeto seja apropriado para o MVP.
SELECT
  n.nspname AS schema_name,
  c.relname AS view_name,
  CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' END AS view_type,
  CASE
    WHEN acl.grantee = 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(acl.grantee)
  END AS grantee,
  acl.privilege_type,
  coalesce(c.reloptions, ARRAY[]::text[]) AS relation_options,
  CASE
    WHEN 'security_invoker=true' = ANY (coalesce(c.reloptions, ARRAY[]::text[]))
      THEN true
    ELSE false
  END AS security_invoker_enabled
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
JOIN LATERAL pg_catalog.aclexplode(
  coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))
) AS acl ON true
WHERE c.relkind IN ('v', 'm')
  AND acl.privilege_type = 'SELECT'
  AND upper(
    CASE
      WHEN acl.grantee = 0 THEN 'PUBLIC'
      ELSE pg_catalog.pg_get_userbyid(acl.grantee)
    END
  ) IN ('PUBLIC', 'ANON', 'AUTHENTICATED')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
  AND n.nspname !~ '^pg_toast'
  AND n.nspname !~ '^pg_temp_'
ORDER BY n.nspname, c.relname, grantee;
