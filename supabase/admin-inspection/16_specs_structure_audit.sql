-- Auditoria estrutural somente leitura para o planejamento do cadastro de specs.
-- O script não altera dados e retorna contagens e inconsistências separadamente.

-- 1. Quantidades por tipo inspecionado.
SELECT
    COUNT(*) FILTER (WHERE s.type = 'numeric') AS numeric_count,
    COUNT(*) FILTER (WHERE s.type = 'binary') AS binary_count,
    COUNT(DISTINCT (s.group_name, s.equipment_group, s.spec_set))
        FILTER (WHERE s.type = 'scale') AS scale_group_count
FROM public.specs AS s;

-- 2. Numeric e binary devem ter detail = spec_set após normalização de espaços.
-- Resultado esperado: zero linhas.
SELECT
    s.id,
    s.code,
    s.type,
    s.spec_set,
    s.detail
FROM public.specs AS s
WHERE s.type IN ('numeric', 'binary')
  AND regexp_replace(btrim(s.detail), '\s+', ' ', 'g')
      IS DISTINCT FROM regexp_replace(btrim(s.spec_set), '\s+', ' ', 'g')
ORDER BY s.type, s.id;

-- 3. Detail deve ser distinto dentro de cada trio scale.
-- Resultado esperado: zero linhas.
SELECT
    s.group_name,
    s.equipment_group,
    s.spec_set,
    regexp_replace(btrim(s.detail), '\s+', ' ', 'g') AS normalized_detail,
    COUNT(*) AS duplicate_count,
    array_agg(s.id ORDER BY s.id) AS spec_ids,
    array_agg(s.code ORDER BY s.id) AS spec_codes
FROM public.specs AS s
WHERE s.type = 'scale'
GROUP BY
    s.group_name,
    s.equipment_group,
    s.spec_set,
    regexp_replace(btrim(s.detail), '\s+', ' ', 'g')
HAVING COUNT(*) > 1
ORDER BY s.group_name, s.equipment_group, s.spec_set, normalized_detail;

-- 4. Cada opção scale precisa de identidade persistível própria.
-- Resultado esperado: zero linhas. A unicidade global de code e a PK de id
-- também devem ser confirmadas pelo inventário de constraints/índices.
SELECT
    s.id,
    s.code,
    s.group_name,
    s.equipment_group,
    s.spec_set,
    s.detail
FROM public.specs AS s
WHERE s.type = 'scale'
  AND (s.id IS NULL OR NULLIF(btrim(s.code), '') IS NULL)
ORDER BY s.group_name, s.equipment_group, s.spec_set, s.detail;
