-- Inventario somente leitura das permissoes relevantes para a aplicacao.
-- Restringe a saida aos papeis usados pelo Supabase e exclui rotinas de extensoes.

WITH table_and_view_grants AS (
    SELECT
        'table_or_view'::text AS object_category,
        table_schema AS schema_name,
        table_name AS object_name,
        grantee,
        privilege_type,
        is_grantable,
        grantee IN ('anon', 'authenticated', 'service_role') AS highlighted_role
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
      AND privilege_type IN (
          'SELECT',
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE'
      )
),
application_routines AS (
    SELECT
        p.oid,
        n.nspname AS schema_name,
        p.proname AS routine_name
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n
        ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_depend AS d
          JOIN pg_catalog.pg_extension AS e
              ON e.oid = d.refobjid
          WHERE d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
            AND d.objid = p.oid
            AND d.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
            AND d.deptype = 'e'
      )
),
routine_grants AS (
    SELECT
        'routine'::text AS object_category,
        r.routine_schema AS schema_name,
        r.routine_name AS object_name,
        r.grantee,
        r.privilege_type,
        r.is_grantable,
        r.grantee IN ('anon', 'authenticated', 'service_role') AS highlighted_role
    FROM information_schema.role_routine_grants AS r
    WHERE r.routine_schema = 'public'
      AND r.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
      AND r.privilege_type = 'EXECUTE'
      AND EXISTS (
          SELECT 1
          FROM application_routines AS ar
          WHERE ar.schema_name = r.routine_schema
            AND ar.routine_name = r.routine_name
      )
)
SELECT
    object_category,
    schema_name,
    object_name,
    grantee,
    privilege_type,
    is_grantable,
    highlighted_role
FROM table_and_view_grants

UNION ALL

SELECT
    object_category,
    schema_name,
    object_name,
    grantee,
    privilege_type,
    is_grantable,
    highlighted_role
FROM routine_grants

ORDER BY
    object_category,
    object_name,
    grantee,
    privilege_type;
