-- Validacao somente leitura da identidade logica de public.products.
-- Nenhuma alteracao e realizada.

-- 1. Total de produtos.
SELECT
    COUNT(*) AS total_products
FROM public.products;

-- 2. Duplicidades exatas da chave protegida por unique_product.
-- O resultado esperado e zero linhas.
SELECT
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year,
    COUNT(*) AS duplicate_count
FROM public.products AS p
GROUP BY
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year
HAVING COUNT(*) > 1
ORDER BY
    duplicate_count DESC,
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year
LIMIT 100;

-- 3. Campos nulos na chave logica.
SELECT
    COUNT(*) FILTER (WHERE brand IS NULL) AS null_brand,
    COUNT(*) FILTER (WHERE model IS NULL) AS null_model,
    COUNT(*) FILTER (WHERE version IS NULL) AS null_version,
    COUNT(*) FILTER (WHERE model_year IS NULL) AS null_model_year,
    COUNT(*) FILTER (WHERE production_year IS NULL) AS null_production_year
FROM public.products;

-- 4. Campos vazios ou compostos apenas por espacos.
SELECT
    COUNT(*) FILTER (
        WHERE brand IS NOT NULL AND btrim(brand::text) = ''
    ) AS blank_brand,
    COUNT(*) FILTER (
        WHERE model IS NOT NULL AND btrim(model::text) = ''
    ) AS blank_model,
    COUNT(*) FILTER (
        WHERE version IS NOT NULL AND btrim(version::text) = ''
    ) AS blank_version
FROM public.products;

-- 5. Possiveis duplicidades ignorando caixa e espacos externos.
SELECT
    lower(btrim(p.brand::text)) AS normalized_brand,
    lower(btrim(p.model::text)) AS normalized_model,
    lower(btrim(p.version::text)) AS normalized_version,
    p.model_year,
    p.production_year,
    COUNT(*) AS product_count,
    array_agg(p.id ORDER BY p.id) AS product_ids
FROM public.products AS p
GROUP BY
    lower(btrim(p.brand::text)),
    lower(btrim(p.model::text)),
    lower(btrim(p.version::text)),
    p.model_year,
    p.production_year
HAVING COUNT(*) > 1
ORDER BY
    product_count DESC,
    normalized_brand,
    normalized_model,
    normalized_version,
    p.model_year,
    p.production_year
LIMIT 100;

-- 6. Variacoes de grafia de marca que normalizam para o mesmo texto.
SELECT
    lower(btrim(p.brand::text)) AS normalized_brand,
    COUNT(DISTINCT p.brand) AS distinct_original_values,
    array_agg(DISTINCT p.brand ORDER BY p.brand) AS original_values,
    COUNT(*) AS product_count
FROM public.products AS p
GROUP BY
    lower(btrim(p.brand::text))
HAVING COUNT(DISTINCT p.brand) > 1
ORDER BY
    distinct_original_values DESC,
    normalized_brand
LIMIT 100;

-- 7. Distribuicao dos estados de publicacao e atividade.
SELECT
    p.is_active,
    p.is_public,
    COUNT(*) AS product_count
FROM public.products AS p
GROUP BY
    p.is_active,
    p.is_public
ORDER BY
    p.is_active,
    p.is_public;
