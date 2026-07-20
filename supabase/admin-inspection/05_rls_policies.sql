-- Inventario somente leitura do estado de RLS e das policies.
-- A tabela public.products, quando existente, e incluida pelo mesmo filtro.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    p.polname AS policy_name,
    CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
        ELSE p.polcmd::text
    END AS command,
    p.polpermissive AS is_permissive,
    ARRAY(
        SELECT pg_catalog.pg_get_userbyid(role_oid)
        FROM unnest(p.polroles) AS role_oid
        ORDER BY pg_catalog.pg_get_userbyid(role_oid)
    ) AS roles,
    pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS using_expression,
    pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_policy AS p ON p.polrelid = c.oid
WHERE c.relkind IN ('r', 'p')
  AND n.nspname = 'public'
ORDER BY n.nspname, c.relname, p.polname NULLS FIRST;
