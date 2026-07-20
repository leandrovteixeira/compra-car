-- Inventario somente leitura das funcoes e procedures de aplicacao no schema public.
-- Exclui rotinas que pertencem a extensoes PostgreSQL, como pg_trgm e unaccent.
SELECT
    n.nspname AS schema_name,
    p.proname AS routine_name,
    CASE p.prokind
        WHEN 'f' THEN 'function'
        WHEN 'p' THEN 'procedure'
        ELSE p.prokind::text
    END AS routine_type,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    pg_catalog.pg_get_function_result(p.oid) AS result_type,
    l.lanname AS language_name,
    pg_catalog.pg_get_userbyid(p.proowner) AS owner_name,
    CASE
        WHEN p.prosecdef THEN 'definer'
        ELSE 'invoker'
    END AS security_mode,
    p.proleakproof AS leakproof,
    p.proisstrict AS returns_null_on_null_input,
    p.proretset AS returns_set,
    CASE p.provolatile
        WHEN 'i' THEN 'immutable'
        WHEN 's' THEN 'stable'
        WHEN 'v' THEN 'volatile'
        ELSE p.provolatile::text
    END AS volatility,
    pg_catalog.pg_get_functiondef(p.oid) AS routine_definition
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n
    ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language AS l
    ON l.oid = p.prolang
WHERE p.prokind IN ('f', 'p')
  AND n.nspname = 'public'
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
ORDER BY
    n.nspname,
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid);
