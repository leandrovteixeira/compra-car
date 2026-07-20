-- Validacao somente leitura da integridade de public.product_specs.
-- Nenhuma alteracao e realizada.

-- 1. Quantidade total de associacoes.
SELECT
    COUNT(*) AS total_product_specs
FROM public.product_specs;

-- 2. Associacoes cujo product_id nao possui produto correspondente.
SELECT
    COUNT(*) AS orphan_product_references
FROM public.product_specs AS ps
LEFT JOIN public.products AS p
    ON p.id = ps.product_id
WHERE p.id IS NULL;

-- 3. Exemplos de referencias orfas de produto.
SELECT
    ps.id AS product_spec_id,
    ps.product_id,
    ps.equipment_id
FROM public.product_specs AS ps
LEFT JOIN public.products AS p
    ON p.id = ps.product_id
WHERE p.id IS NULL
ORDER BY
    ps.product_id,
    ps.equipment_id,
    ps.id
LIMIT 100;

-- 4. Associacoes cujo equipment_id nao possui spec correspondente.
SELECT
    COUNT(*) AS orphan_spec_references
FROM public.product_specs AS ps
LEFT JOIN public.specs AS s
    ON s.id = ps.equipment_id
WHERE s.id IS NULL;

-- 5. Exemplos de referencias orfas de spec.
SELECT
    ps.id AS product_spec_id,
    ps.product_id,
    ps.equipment_id
FROM public.product_specs AS ps
LEFT JOIN public.specs AS s
    ON s.id = ps.equipment_id
WHERE s.id IS NULL
ORDER BY
    ps.equipment_id,
    ps.product_id,
    ps.id
LIMIT 100;

-- 6. Duplicidades logicas em product_id + equipment_id.
-- O resultado esperado e zero linhas porque existe indice unico.
SELECT
    ps.product_id,
    ps.equipment_id,
    COUNT(*) AS duplicate_count
FROM public.product_specs AS ps
GROUP BY
    ps.product_id,
    ps.equipment_id
HAVING COUNT(*) > 1
ORDER BY
    duplicate_count DESC,
    ps.product_id,
    ps.equipment_id
LIMIT 100;

-- 7. Produtos sem qualquer associacao em product_specs.
SELECT
    COUNT(*) AS products_without_specs
FROM public.products AS p
LEFT JOIN public.product_specs AS ps
    ON ps.product_id = p.id
WHERE ps.id IS NULL;

-- 8. Exemplos de produtos sem associacoes.
SELECT
    p.id,
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year,
    p.is_active,
    p.is_public
FROM public.products AS p
LEFT JOIN public.product_specs AS ps
    ON ps.product_id = p.id
WHERE ps.id IS NULL
ORDER BY
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year,
    p.id
LIMIT 100;
