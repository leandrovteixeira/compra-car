-- Inventario somente leitura de colunas de objetos de aplicacao.
SELECT
    c.table_schema AS schema_name,
    c.table_name,
    c.ordinal_position,
    c.column_name,
    c.data_type,
    c.udt_schema,
    c.udt_name,
    c.is_nullable,
    c.column_default,
    c.is_identity,
    c.identity_generation,
    c.is_generated,
    c.generation_expression,
    c.collation_schema,
    c.collation_name
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
ORDER BY c.table_schema, c.table_name, c.ordinal_position;
