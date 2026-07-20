-- Validacao somente leitura da semantica de public.product_specs.
-- Nenhuma alteracao e realizada.

-- 1. Distribuicao dos tipos cadastrados em specs.
SELECT
    s.type,
    COUNT(*) AS spec_count
FROM public.specs AS s
GROUP BY
    s.type
ORDER BY
    spec_count DESC,
    s.type;

-- 2. Distribuicao de is_active em specs.
SELECT
    s.is_active,
    COUNT(*) AS spec_count
FROM public.specs AS s
GROUP BY
    s.is_active
ORDER BY
    s.is_active;

-- 3. Colunas relevantes de product_specs e quantidade de nulos.
SELECT
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE ps.value IS NULL) AS null_value,
    COUNT(*) FILTER (
        WHERE ps.value IS NOT NULL
          AND btrim(ps.value::text) = ''
    ) AS blank_value,
    COUNT(*) FILTER (WHERE ps.input_unit IS NULL) AS null_input_unit,
    COUNT(*) FILTER (
        WHERE ps.input_unit IS NOT NULL
          AND btrim(ps.input_unit::text) = ''
    ) AS blank_input_unit,
    COUNT(*) FILTER (WHERE ps.is_present IS NULL) AS null_is_present,
    COUNT(*) FILTER (WHERE ps.is_present IS TRUE) AS true_is_present,
    COUNT(*) FILTER (WHERE ps.is_present IS FALSE) AS false_is_present
FROM public.product_specs AS ps;

-- 4. Combinacao entre tipo da spec e is_present.
SELECT
    s.type,
    ps.is_present,
    COUNT(*) AS association_count
FROM public.product_specs AS ps
JOIN public.specs AS s
    ON s.id = ps.equipment_id
GROUP BY
    s.type,
    ps.is_present
ORDER BY
    s.type,
    ps.is_present;

-- 5. Combinacao entre tipo, presenca e existencia de value.
SELECT
    s.type,
    ps.is_present,
    CASE
        WHEN ps.value IS NULL THEN 'null'
        WHEN btrim(ps.value::text) = '' THEN 'blank'
        ELSE 'filled'
    END AS value_state,
    COUNT(*) AS association_count
FROM public.product_specs AS ps
JOIN public.specs AS s
    ON s.id = ps.equipment_id
GROUP BY
    s.type,
    ps.is_present,
    CASE
        WHEN ps.value IS NULL THEN 'null'
        WHEN btrim(ps.value::text) = '' THEN 'blank'
        ELSE 'filled'
    END
ORDER BY
    s.type,
    ps.is_present,
    value_state;

-- 6. Exemplos em que existe associacao, mas is_present = false.
SELECT
    ps.id AS product_spec_id,
    ps.product_id,
    ps.equipment_id,
    s.code,
    s.type,
    ps.is_present,
    ps.value,
    ps.input_unit
FROM public.product_specs AS ps
JOIN public.specs AS s
    ON s.id = ps.equipment_id
WHERE ps.is_present IS FALSE
ORDER BY
    s.type,
    s.code,
    ps.product_id,
    ps.id
LIMIT 100;

-- 7. Valores preenchidos quando is_present = false.
SELECT
    COUNT(*) AS false_presence_with_value
FROM public.product_specs AS ps
WHERE ps.is_present IS FALSE
  AND ps.value IS NOT NULL
  AND btrim(ps.value::text) <> '';

-- 8. Tipos de specs fora do contrato atual do adaptador.
SELECT
    s.type,
    COUNT(*) AS spec_count
FROM public.specs AS s
WHERE s.type IS NULL
   OR s.type NOT IN ('binary', 'numeric', 'scale')
GROUP BY
    s.type
ORDER BY
    spec_count DESC,
    s.type;

-- 9. Codes nulos, vazios ou duplicados.
SELECT
    COUNT(*) FILTER (WHERE s.code IS NULL) AS null_code,
    COUNT(*) FILTER (
        WHERE s.code IS NOT NULL
          AND btrim(s.code::text) = ''
    ) AS blank_code
FROM public.specs AS s;

SELECT
    s.code,
    COUNT(*) AS duplicate_count,
    array_agg(s.id ORDER BY s.id) AS spec_ids
FROM public.specs AS s
GROUP BY
    s.code
HAVING COUNT(*) > 1
ORDER BY
    duplicate_count DESC,
    s.code
LIMIT 100;

-- 10. Conflitos entre input_unit e unidade da spec.
SELECT
    ps.input_unit,
    s.unit AS spec_unit,
    COUNT(*) AS association_count
FROM public.product_specs AS ps
JOIN public.specs AS s
    ON s.id = ps.equipment_id
WHERE ps.input_unit IS NOT NULL
  AND btrim(ps.input_unit::text) <> ''
  AND s.unit IS NOT NULL
  AND btrim(s.unit::text) <> ''
  AND lower(btrim(ps.input_unit::text)) <> lower(btrim(s.unit::text))
GROUP BY
    ps.input_unit,
    s.unit
ORDER BY
    association_count DESC,
    ps.input_unit,
    s.unit
LIMIT 100;
