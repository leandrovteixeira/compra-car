-- Validacao somente leitura da elegibilidade do catalogo publico.
-- Nenhuma alteracao e realizada.

-- 1. Funil de elegibilidade.
SELECT
    COUNT(*) AS total_products,
    COUNT(*) FILTER (
        WHERE p.is_active IS TRUE
    ) AS active_products,
    COUNT(*) FILTER (
        WHERE p.is_public IS TRUE
    ) AS public_products,
    COUNT(*) FILTER (
        WHERE p.is_active IS TRUE
          AND p.is_public IS TRUE
    ) AS active_and_public_products
FROM public.products AS p;

-- 2. Produtos ativos e publicos com ao menos uma associacao a spec ativa.
SELECT
    COUNT(*) AS eligible_by_current_adapter_rule
FROM public.products AS p
WHERE p.is_active IS TRUE
  AND p.is_public IS TRUE
  AND EXISTS (
      SELECT 1
      FROM public.product_specs AS ps
      JOIN public.specs AS s
          ON s.id = ps.equipment_id
      WHERE ps.product_id = p.id
        AND s.is_active IS TRUE
  );

-- 3. Comparacao entre a regra atual e uma regra que exige is_present diferente de false.
SELECT
    COUNT(*) AS eligible_when_false_presence_is_excluded
FROM public.products AS p
WHERE p.is_active IS TRUE
  AND p.is_public IS TRUE
  AND EXISTS (
      SELECT 1
      FROM public.product_specs AS ps
      JOIN public.specs AS s
          ON s.id = ps.equipment_id
      WHERE ps.product_id = p.id
        AND s.is_active IS TRUE
        AND ps.is_present IS DISTINCT FROM FALSE
  );

-- 4. Produtos que entram na regra atual, mas sairiam ao excluir is_present = false.
SELECT
    p.id,
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year
FROM public.products AS p
WHERE p.is_active IS TRUE
  AND p.is_public IS TRUE
  AND EXISTS (
      SELECT 1
      FROM public.product_specs AS ps
      JOIN public.specs AS s
          ON s.id = ps.equipment_id
      WHERE ps.product_id = p.id
        AND s.is_active IS TRUE
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.product_specs AS ps
      JOIN public.specs AS s
          ON s.id = ps.equipment_id
      WHERE ps.product_id = p.id
        AND s.is_active IS TRUE
        AND ps.is_present IS DISTINCT FROM FALSE
  )
ORDER BY
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year,
    p.id
LIMIT 100;

-- 5. Produtos ativos e publicos sem specs ativas.
SELECT
    p.id,
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year
FROM public.products AS p
WHERE p.is_active IS TRUE
  AND p.is_public IS TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM public.product_specs AS ps
      JOIN public.specs AS s
          ON s.id = ps.equipment_id
      WHERE ps.product_id = p.id
        AND s.is_active IS TRUE
  )
ORDER BY
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year,
    p.id
LIMIT 100;

-- 6. Distribuicao da quantidade de itens comparaveis por produto elegivel.
WITH eligible_products AS (
    SELECT
        p.id
    FROM public.products AS p
    WHERE p.is_active IS TRUE
      AND p.is_public IS TRUE
),
item_counts AS (
    SELECT
        ep.id AS product_id,
        COUNT(*) FILTER (
            WHERE s.is_active IS TRUE
              AND ps.is_present IS DISTINCT FROM FALSE
        ) AS comparable_item_count
    FROM eligible_products AS ep
    LEFT JOIN public.product_specs AS ps
        ON ps.product_id = ep.id
    LEFT JOIN public.specs AS s
        ON s.id = ps.equipment_id
    GROUP BY
        ep.id
)
SELECT
    MIN(comparable_item_count) AS minimum_items,
    MAX(comparable_item_count) AS maximum_items,
    AVG(comparable_item_count)::numeric(12,2) AS average_items,
    COUNT(*) FILTER (
        WHERE comparable_item_count = 0
    ) AS products_with_zero_items
FROM item_counts;
