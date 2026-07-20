-- Validacao somente leitura do modelo de precos.
-- Nenhuma alteracao e realizada.

-- 1. Estrutura temporal e cobertura por produto.
SELECT
    COUNT(*) AS total_price_offers,
    COUNT(DISTINCT ppo.product_id) AS products_with_price_offers,
    MIN(ppo.created_at) AS earliest_created_at,
    MAX(ppo.created_at) AS latest_created_at
FROM public.product_price_offers AS ppo;

-- 2. Quantidade de ofertas por produto.
SELECT
    ppo.product_id,
    COUNT(*) AS offer_count,
    MIN(ppo.created_at) AS earliest_created_at,
    MAX(ppo.created_at) AS latest_created_at
FROM public.product_price_offers AS ppo
GROUP BY
    ppo.product_id
ORDER BY
    offer_count DESC,
    ppo.product_id
LIMIT 100;

-- 3. Produtos ativos e publicos sem oferta de preco.
SELECT
    COUNT(*) AS eligible_products_without_price
FROM public.products AS p
LEFT JOIN public.product_price_offers AS ppo
    ON ppo.product_id = p.id
WHERE p.is_active IS TRUE
  AND p.is_public IS TRUE
  AND ppo.id IS NULL;

-- 4. Exemplos de produtos ativos e publicos sem oferta.
SELECT
    p.id,
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year
FROM public.products AS p
LEFT JOIN public.product_price_offers AS ppo
    ON ppo.product_id = p.id
WHERE p.is_active IS TRUE
  AND p.is_public IS TRUE
  AND ppo.id IS NULL
ORDER BY
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year,
    p.id
LIMIT 100;

-- 5. Referencias orfas de produto em product_price_offers.
SELECT
    COUNT(*) AS orphan_price_offer_references
FROM public.product_price_offers AS ppo
LEFT JOIN public.products AS p
    ON p.id = ppo.product_id
WHERE p.id IS NULL;

-- 6. Inventario resumido das colunas preenchidas.
-- Usa row_to_json para evitar pressupor nomes adicionais de campos comerciais.
SELECT
    key AS column_name,
    COUNT(*) FILTER (WHERE value IS NOT NULL AND value <> 'null'::jsonb) AS populated_rows
FROM public.product_price_offers AS ppo
CROSS JOIN LATERAL jsonb_each(to_jsonb(ppo)) AS fields(key, value)
GROUP BY
    key
ORDER BY
    key;

-- 7. Comparacao entre quantidade total e view de valor atual.
SELECT
    (SELECT COUNT(*) FROM public.product_price_offers) AS total_offer_rows,
    (SELECT COUNT(*) FROM public.vw_product_value_current) AS current_value_rows,
    (
        SELECT COUNT(DISTINCT product_id)
        FROM public.product_price_offers
    ) AS products_with_offer_history;

-- 8. Quantidade de linhas nas views de valor.
SELECT
    'vw_product_value_current'::text AS view_name,
    COUNT(*) AS row_count
FROM public.vw_product_value_current

UNION ALL

SELECT
    'vw_product_value_by_category'::text AS view_name,
    COUNT(*) AS row_count
FROM public.vw_product_value_by_category
ORDER BY
    view_name;
