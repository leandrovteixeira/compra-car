-- Inventario somente leitura de sequences e vinculos com colunas.
-- Nao le nem avanca o valor atual de nenhuma sequence.
SELECT
    sn.nspname AS schema_name,
    seq.relname AS sequence_name,
    pg_catalog.format_type(ps.seqtypid, NULL) AS data_type,
    ps.seqstart AS start_value,
    ps.seqmin AS minimum_value,
    ps.seqmax AS maximum_value,
    ps.seqincrement AS increment,
    ps.seqcycle AS cycles,
    tn.nspname AS linked_table_schema,
    tbl.relname AS linked_table_name,
    att.attname AS linked_column_name,
    CASE dep.deptype
        WHEN 'a' THEN 'owned_by'
        WHEN 'i' THEN 'identity'
        ELSE NULL
    END AS link_type
FROM pg_catalog.pg_class AS seq
JOIN pg_catalog.pg_namespace AS sn ON sn.oid = seq.relnamespace
JOIN pg_catalog.pg_sequence AS ps ON ps.seqrelid = seq.oid
LEFT JOIN pg_catalog.pg_depend AS dep
    ON dep.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
   AND dep.objid = seq.oid
   AND dep.objsubid = 0
   AND dep.refclassid = 'pg_catalog.pg_class'::pg_catalog.regclass
   AND dep.deptype IN ('a', 'i')
LEFT JOIN pg_catalog.pg_class AS tbl ON tbl.oid = dep.refobjid
LEFT JOIN pg_catalog.pg_namespace AS tn ON tn.oid = tbl.relnamespace
LEFT JOIN pg_catalog.pg_attribute AS att
    ON att.attrelid = dep.refobjid
   AND att.attnum = dep.refobjsubid
WHERE seq.relkind = 'S'
  AND sn.nspname = 'public'
ORDER BY sn.nspname, seq.relname, tn.nspname NULLS FIRST,
         tbl.relname NULLS FIRST, att.attnum NULLS FIRST;
