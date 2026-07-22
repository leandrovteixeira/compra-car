# MVP-a — Sprint 1: Gestão de Produtos

## Status e limites

Este documento consolida o inventário disponível em 2026-07-22 e o plano de implementação da Sprint 1. Nenhuma tela, query no ambiente remoto, migration ou alteração de schema foi executada nesta etapa.

Escopo autorizado: listar, criar e editar produtos; editar suas associações em `product_specs`; duplicar um produto para novo MY/PY. `specs` é somente a fonte de metadados e das regras existentes de Market Value. A Sprint 1 não mantém `specs`, `unit_perceived_value` ou `relative_value`, e não inclui Preços, Comparador ou Exportação Excel.

## Inventário do Appsmith

### Export localizado e integridade

| Propriedade | Valor |
| --- | --- |
| arquivo | `appsmith/exports/Compra Car App MVP.json` |
| data do arquivo no clone | 2026-07-22 14:54:55 |
| tamanho | 71.143 bytes |
| formato | export JSON nativo de aplicação Appsmith |
| `artifactJsonType` | `APPLICATION` |
| schema cliente/servidor | `2.0` / `12.0` |
| aplicação | `Compra Car App MVP` (`compra-car-app-mvp`) |
| SHA-256 | `30a1abb72c341f0832e6402d42bd62b0d01c8f9eaeeadece8983c0210f1b7d84` |

O arquivo original foi somente lido e não foi alterado. A raiz contém `exportedApplication`, um datasource, três páginas, 11 actions, zero action collections/JS Objects, zero bibliotecas JavaScript customizadas e os temas de edição e publicação.

### Publicação e estrutura real

| Página | Slug | Estado no export | Widgets reais |
| --- | --- | --- | --- |
| `Home` | `home` | possui versão publicada, chamada internamente de `Page1` | `MainContainer` |
| `Análise de Valor` | `analise-de-valor` | somente rascunho | `MainContainer`, `SelectBrand`, `SelectModel`, `SelectVersion`, `SelectYear`, `Container1`, `Canvas1`, `Canvas2`, `List1`, `Text1`, `Text1Copy`, `Text1Copy1`, `Text1Copy1Copy`, `Text1Copy2`, `Text1Copy2Copy`, `Text1Copy2Copy1`, `Text1Copy2Copy1Copy` |
| `Admin Modelos` | `admin-modelos` | somente rascunho | `MainContainer`, `tbl_products`, `Container1`, `Canvas1`, `Text1`, `SelectModelYear`, `SelectProductionYear`, `SwitchActive`, `BtnDuplicate` |

O pacote contém 27 ocorrências de widgets. Não contém JS Objects. As páginas `Admin Modelos` e `Análise de Valor` não aparecem como versões publicadas; portanto, o arquivo é suficiente para inventariar o estado de edição, mas não comprova que essas telas estejam disponíveis na versão publicada.

### Datasource e prepared statements

O datasource real chama-se `Compra Car`, usa `postgres-plugin`, não é autogerado e possui um endpoint Supabase com porta configurada. A configuração exportada contém modo de conexão e SSL, mas não contém objeto de autenticação, usuário, senha ou connection string completa. O host não é reproduzido nesta documentação.

Todas as 11 actions possuem `pluginSpecifiedTemplates` com `value: true`. No plugin PostgreSQL esse indicador é consistente com **prepared statements habilitados**, mas o nome da opção não está preservado no JSON. A confirmação visual na instância continua necessária antes de qualquer escrita.

### Auditoria de segredos

A varredura recursiva por nomes de propriedades e padrões de senha, token, JWT, API key, Service Role, connection string e credenciais encontrou:

- referência de infraestrutura em `datasourceList[0].datasourceConfiguration.endpoints[0].host`, sem credencial;
- `PASSWORD_INPUT` dentro do stylesheet genérico do widget de formulário, sem valor e sem relação com credencial configurada.

Não foram encontrados senha, token, chave de API, Service Role, JWT, connection string completa ou credencial PostgreSQL/Supabase preenchida. Com base no conteúdo atual, o export **pode ser versionado**, desde que permaneça sujeito à revisão de segredos em cada novo export. O hostname do projeto Supabase é metadado de infraestrutura e não autentica acesso, mas sua exposição deve ser aceita pelo responsável do projeto.

### Actions e SQL reais

| Página | Action | Finalidade real |
| --- | --- | --- |
| `Análise de Valor` | `get_product_value` | lê `vw_product_value_current` pelo produto selecionado; não há widget consumidor localizado |
| `Análise de Valor` | `get_model_score` | calcula score contra benchmark de ±5% de preço; não há widget consumidor localizado |
| `Análise de Valor` | `get_category_scores` | calcula score por categoria e alimenta textos da página |
| `Análise de Valor` | `get_brands` | lista marcas ativas |
| `Análise de Valor` | `get_models_by_brand` | lista modelos ativos da marca |
| `Análise de Valor` | `get_versions` | lista versões ativas de marca/modelo |
| `Análise de Valor` | `get_model_year` | lista MY de marca/modelo/versão |
| `Admin Modelos` | `get_models` | lista produtos; a action aparece ligada por dependência em `Análise de Valor`, embora `SelectModel` consuma `get_models_by_brand` |
| `Admin Modelos` | `admin_get_products` | alimenta `tbl_products` e executa ao abrir a página |
| `Admin Modelos` | `upd_active` | atualiza somente `products.is_active` pela linha editada |
| `Admin Modelos` | `dup_product` | chama `duplicate_product_simple` sem casts explícitos |

SQL exato das actions relevantes à Sprint 1:

```sql
-- get_models
select
  id,
  is_active,
  brand,
  model,
  version,
  model_year,
  production_year
from products
order by
  brand,
  model,
  version,
  model_year desc;

-- admin_get_products
select
  id,
  is_active,
  brand,
  model,
  version,
  model_year,
  production_year
from products
order by brand, model, version, model_year desc;

-- upd_active
update products
set is_active = {{ tbl_products.updatedRow.is_active }}
where id = {{ tbl_products.updatedRow.id }}
returning id, is_active;

-- dup_product
select duplicate_product_simple(
  {{ tbl_products.selectedRow.id }},
  {{ SelectModelYear.selectedOptionValue }},
  {{ SelectProductionYear.selectedOptionValue }},
  {{ SwitchActive.isSwitchedOn }}
) as new_product_id;
```

SQL exato das demais actions, somente para completar o inventário; elas não devem ser modificadas durante a Gestão de Produtos:

```sql
-- get_product_value
select *
from vw_product_value_current
where product_id = {{ SelectBrand.selectedOptionValue }};

-- get_model_score
with selected_product as (
  select *
  from vw_product_value_current
  where product_id = {{ SelectBrand.selectedOptionValue }}
),
price_band as (
  select public_price * 0.95 as min_price,
         public_price * 1.05 as max_price
  from selected_product
),
benchmark as (
  select max(pv.perceived_value_total) as benchmark_value
  from vw_product_value_current pv
  cross join price_band pb
  where pv.public_price between pb.min_price and pb.max_price
)
select sp.product_id,
       sp.product_name,
       sp.public_price,
       sp.perceived_value_total,
       b.benchmark_value,
       round(sp.perceived_value_total / nullif(b.benchmark_value, 0) * 100, 1) as tpva_score
from selected_product sp
cross join benchmark b;

-- get_category_scores
with selected_product as (
  select *
  from vw_product_value_current
  where product_id = {{ SelectBrand.selectedOptionValue }}
),
price_band as (
  select public_price * 0.95 as min_price,
         public_price * 1.05 as max_price
  from selected_product
),
products_in_band as (
  select pvc.*
  from vw_product_value_current pvc
  cross join price_band pb
  where pvc.public_price between pb.min_price and pb.max_price
),
category_benchmark as (
  select vc.category,
         max(vc.perceived_value) as benchmark_category_value
  from vw_product_value_by_category vc
  join products_in_band pib on pib.product_id = vc.product_id
  group by vc.category
)
select vc.category,
       case vc.category
         when 'Audio & Conectividade' then 'Áudio & Conectividade'
         when 'Espaco' then 'Espaço'
         when 'Seguranca' then 'Segurança'
         else vc.category
       end as category_label,
       vc.perceived_value,
       cb.benchmark_category_value,
       round(vc.perceived_value / nullif(cb.benchmark_category_value, 0) * 100, 1) as category_score
from vw_product_value_by_category vc
join selected_product sp on sp.product_id = vc.product_id
join category_benchmark cb on cb.category = vc.category
order by category_score desc, vc.category;

-- get_brands
select distinct brand
from products
where is_active = true
order by brand;

-- get_models_by_brand
select distinct model as label,
                model as value
from products
where is_active = true
  and brand = '{{ SelectBrand.selectedOptionValue }}'
order by model;

-- get_versions
select distinct version as label,
                version as value
from products
where is_active = true
  and brand = '{{ SelectBrand.selectedOptionValue }}'
  and model = '{{ SelectModel.selectedOptionValue }}'
  and version is not null
  and trim(version) <> ''
order by version;

-- get_model_year
select distinct model_year as label,
                model_year as value
from products
where is_active = true
  and brand = '{{ SelectBrand.selectedOptionValue }}'
  and model = '{{ SelectModel.selectedOptionValue }}'
  and version = '{{ SelectVersion.selectedOptionValue }}'
order by model_year desc;
```

As três queries que colocam bindings entre aspas (`get_models_by_brand`, `get_versions` e `get_model_year`) devem ser revisadas mesmo com o indicador de prepared statements ativo; bindings não devem depender de concatenação ou escaping manual.

### Fluxo administrativo atual

1. Ao abrir `Admin Modelos`, `admin_get_products` carrega `tbl_products`.
2. A seleção ocorre pela linha corrente de `tbl_products`; `Text1` monta marca, modelo, versão e MY dessa linha.
3. As colunas `brand`, `model`, `version`, `model_year`, `production_year` e `is_active` estão marcadas como editáveis, mas a coluna de ações Save/Discard está invisível e não existe action para salvar dados gerais. Logo, edição geral não está implementada.
4. Alterar o checkbox `is_active` executa `upd_active` e depois recarrega `admin_get_products`.
5. Não existe formulário, botão ou action de criação.
6. Não há leitura ou manutenção de `product_specs`/`specs` na página administrativa.
7. Para duplicar, o usuário seleciona uma linha, escolhe MY e PY em listas fixas de 2025 a 2028, escolhe `SwitchActive` e aciona `BtnDuplicate`.
8. `BtnDuplicate` chama `dup_product`; no callback de sucesso recarrega a lista e sempre mostra o alerta de sucesso. Não há confirmação prévia, tratamento explícito de erro, validação de seleção, proteção contra duplo clique nem seleção automática do novo ID.

### Função realmente chamada

O export confirma `duplicate_product_simple`, mas a action não aplica casts aos quatro argumentos. Como existem duas sobrecargas, o arquivo não demonstra de forma inequívoca qual assinatura o PostgreSQL resolve em runtime. A recomendação desta sprint permanece usar casts explícitos para `duplicate_product_simple(integer, smallint, smallint, boolean)` depois de validar os tipos reais retornados pelos widgets.

## Evidência de dados usada

O contrato abaixo usa a inspeção validada documentada em `docs/data/SUPABASE_INSPECTION_RESULTS.md`, `docs/data/LEGACY_BASELINE_EXTRACTION_RESULTS.md`, `docs/data/LEGACY_SCHEMA_INVENTORY.md` e `docs/data/LEGACY_SUPABASE_MAP.md`. O DDL em `Legacy` foi consultado apenas como evidência histórica e não foi promovido a fonte de verdade.

Estado confirmado: 288 produtos, 320 specs e 37.251 associações. Há índice único `unique_product` em `(brand, model, version, model_year, production_year)`, unicidade de `product_specs(product_id, equipment_id)`, FK de `equipment_id` para `specs.id` e ausência de FK física confirmada de `product_specs.product_id` para `products.id`.

## Contrato da tela Produtos

### Lista e seleção

`ProductListItem`:

| Campo de tela | Origem | Tipo | Regra |
| --- | --- | --- | --- |
| `id` | `products.id` | integer | somente leitura |
| `brand` | `products.brand` | text | obrigatório |
| `model` | `products.model` | text | obrigatório |
| `version` | `products.version` | text | obrigatório |
| `modelYear` | `products.model_year` | smallint/integer | obrigatório |
| `productionYear` | `products.production_year` | smallint/integer | obrigatório |
| `isActive` | `products.is_active` | boolean | distinto de publicação |
| `isPublic` | `products.is_public` | boolean | distinto de atividade |
| `specCount` | contagem em `product_specs` | bigint | derivado, somente leitura |

A lista aceita pesquisa textual em marca/modelo/versão, filtros opcionais de atividade e publicação, paginação e ordenação determinística. Seleção e edição usam sempre `id`, nunca o índice visual da linha.

### Edição geral

`ProductWriteInput` contém apenas `brand`, `model`, `version`, `modelYear`, `productionYear`, `isActive` e `isPublic`. O `id` é gerado pelo banco. Campos técnicos não confirmados no contrato não aparecem na tela. A chave MMV/MY/PY é validada antes de insert/update e continua protegida pelo índice único.

### Specs do produto

`ProductSpecEditItem`:

| Campo | Origem | Editável? | Regra |
| --- | --- | --- | --- |
| `specId` | `specs.id` / `product_specs.equipment_id` | associação | chave do master |
| `code` | `specs.code` | não | identidade estável |
| `groupName` | `specs.group_name` | não | metadado |
| `equipmentGroup` | `specs.equipment_group` | não | metadado |
| `specSet` | `specs.spec_set` | não | metadado |
| `detail` | `specs.detail` | não | rótulo |
| `type` | `specs.type` | não | `binary`, `scale` ou `numeric` |
| `unit` | `specs.unit` | não | unidade padrão |
| `valueDirection` | `specs.value_direction` | não | regra de comparação |
| `unitPerceivedValue` | `specs.unit_perceived_value` | não | metadado de Market Value |
| `relativeValue` | `specs.relative_value` | não | metadado de Market Value |
| `isBaseline` | `specs.is_baseline` | não | metadado |
| `specIsActive` | `specs.is_active` | não | metadado |
| `isAssociated` | existência em `product_specs` | sim | ausência remove a associação |
| `isPresent` | `product_specs.is_present` | sim conforme tipo | `true` para `binary`/`scale`; `null` para `numeric` nos dados atuais |
| `value` | `product_specs.value` | sim conforme tipo | número para `numeric`; `null` para presença |
| `inputUnit` | `product_specs.input_unit` | sim | unidade informada; padrão visual vem de `specs.unit` |

`unit_perceived_value` e `relative_value` são exibidos, quando necessários, somente para explicar o Market Value vigente. A tela não permite alterá-los nem criar/editar/desativar registros do master `specs`.

## Mapeamento físico confirmado

### `products`

Campos usados nesta sprint: `id`, `brand`, `model`, `version`, `model_year`, `production_year`, `is_active`, `is_public`. A tabela possui 12 colunas no inventário; colunas restantes não são assumidas nem gravadas pela Sprint 1. `id` usa `products_id_seq`. O índice `unique_product` cobre a chave MMV/MY/PY.

### `product_specs`

Campos usados: `product_id`, `equipment_id`, `value`, `is_present`, `input_unit`; o identificador técnico permanece fora do contrato da tela. A associação é única por produto/spec. O nome físico `equipment_id` referencia `specs.id`, apesar da nomenclatura histórica.

Semântica observada: `binary` e `scale` têm `is_present = true` e `value = null`; `numeric` tem `is_present = null` e `value` preenchido. Não havia `is_present = false`, valor vazio, órfão confirmado ou tipo fora do contrato na validação. A ausência da associação representa ausência do item nos dados atuais.

### `specs`

As 17 colunas confirmadas são `id`, `group_name`, `equipment_group`, `spec_set`, `detail`, `code`, `type`, `unit`, `value_direction`, `unit_perceived_value`, `relative_value`, `is_baseline`, `notes`, `is_active`, `created_at`, `updated_at` e `commercial_category`. A Sprint 1 lê as necessárias e não grava nenhuma.

## Funções de duplicação

Foram confirmadas estas assinaturas:

- `duplicate_product_model_year(bigint, integer, integer, boolean default true) returns bigint`;
- `duplicate_product_simple(integer, smallint, smallint, boolean default true) returns integer`;
- `duplicate_product_simple(bigint, integer, integer, boolean default true) returns bigint`.

Todas são PL/pgSQL, `VOLATILE`, `SECURITY INVOKER`, sem `SET search_path`, fazem DML e têm grants amplos. Não há trigger de aplicação. Os corpos completos permaneceram nos artefatos brutos da extração e não estão versionados; por isso atomicidade, tratamento exato de conflito e campos copiados não devem ser inferidos além do comportamento observado.

`duplicate_product_simple` cria o produto e copia `product_specs`, sem copiar preço/política. `duplicate_product_model_year` também copia a oferta mais recente de `product_price_offers`, conceito que mistura MSRP e política e está fora desta sprint.

### Recomendação

Usar `duplicate_product_simple(integer, smallint, smallint, boolean)` com casts explícitos. Ela respeita o escopo de Produtos e evita copiar preços/políticas implicitamente. A escolha da sobrecarga `integer/smallint` acompanha o tipo atual de `products.id` documentado na extração e evita a ambiguidade observada na action exportada; deve ser validada em runtime antes de publicar a tela. Não remover, consolidar ou alterar nenhuma função existente.

## Comparação entre export e plano

### Divergências confirmadas

- o admin real chama-se `Admin Modelos`, não `Produtos`;
- a lista real não contém `is_public`, contagem de specs, pesquisa, filtros nem paginação server-side;
- o admin só persiste `is_active`; as demais colunas parecem editáveis, mas não possuem action de save;
- criação de produto e edição geral não existem;
- `product_specs` e o master `specs` não são consultados pela tela;
- a duplicação usa anos fixos até 2028, não valida conflito e não pede confirmação;
- `dup_product` confirma o nome da função, mas não a sobrecarga por falta de casts;
- o fluxo não trata erros explicitamente e exibe sucesso apenas no callback positivo;
- `is_public` não integra nenhum fluxo administrativo do export;
- as duas páginas funcionais aparecem apenas como rascunho no pacote;
- `get_models` duplica parcialmente `admin_get_products` e aparenta uma dependência residual na página de análise;
- o export contém a página de análise de valor, mas o Comparador/Análise permanece fora da Sprint 1 e não será alterado.

### Reutilização das queries propostas

| Query proposta | Situação após o export | Decisão |
| --- | --- | --- |
| `qProductsList` | `admin_get_products` já oferece a base da listagem | **ajustar e substituir**: preservar `tbl_products`, adicionar `is_public`, `spec_count`, filtros e paginação; não manter duas actions equivalentes |
| `qProductGet` | não existe equivalente | **reutilizar**, trocando apenas o binding proposto pelo estado real de `tbl_products.selectedRow.id` ou por store explícito |
| `qProductSpecsGet` | não existe equivalente | **reutilizar**, após criar a grade e confirmar os nomes reais dos novos widgets |
| `qProductInsert` | não existe equivalente | **reutilizar com ajuste de bindings**, após criar formulário e validar defaults/constraints |
| `qProductUpdate` | `upd_active` cobre apenas uma flag | **ajustar/substituir**: criar update geral e decidir se `upd_active` continua como atalho ou é removida do fluxo, sem apagar a action antes da migração da tela |
| `qProductSpecsSave` | não existe equivalente | **bloqueada para implementação** até confirmar suporte do datasource a transação multi-statement; o SQL conceitual permanece válido, mas não deve ser dividido em actions não atômicas |
| `qProductDuplicate` | `dup_product` já chama a função correta por nome | **reutilizar com ajuste obrigatório**: manter widgets reais ou renomeá-los de forma controlada, adicionar casts, validação, confirmação e erro explícito |

Os nomes `inpProductSearch`, `selActiveFilter`, `selPublicFilter`, `frmProduct`, `tblProductSpecs` e demais controles descritos abaixo continuam propostos porque não existem no export. Os nomes existentes que podem ser preservados são `tbl_products`, `SelectModelYear`, `SelectProductionYear`, `SwitchActive` e `BtnDuplicate`.

## Queries SQL propostas

Os marcadores `{{...}}` são bindings do Appsmith. **Prepared Statements deve permanecer habilitado**. Nenhum valor deve ser concatenado como SQL. As queries de escrita só devem ser habilitadas após teste em ambiente autorizado, confirmação do datasource/role e revisão do export.

### Listar produtos — `qProductsList`

```sql
SELECT
    p.id,
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year,
    p.is_active,
    p.is_public,
    COUNT(ps.equipment_id)::bigint AS spec_count
FROM public.products AS p
LEFT JOIN public.product_specs AS ps ON ps.product_id = p.id
WHERE (
        NULLIF(btrim({{ inpProductSearch.text }}::text), '') IS NULL
        OR p.brand ILIKE '%' || btrim({{ inpProductSearch.text }}::text) || '%'
        OR p.model ILIKE '%' || btrim({{ inpProductSearch.text }}::text) || '%'
        OR p.version ILIKE '%' || btrim({{ inpProductSearch.text }}::text) || '%'
      )
  AND ({{ selActiveFilter.selectedOptionValue }}::text = 'all'
       OR p.is_active = ({{ selActiveFilter.selectedOptionValue }}::text = 'true'))
  AND ({{ selPublicFilter.selectedOptionValue }}::text = 'all'
       OR p.is_public = ({{ selPublicFilter.selectedOptionValue }}::text = 'true'))
GROUP BY p.id, p.brand, p.model, p.version, p.model_year, p.production_year,
         p.is_active, p.is_public
ORDER BY p.brand, p.model, p.version, p.model_year DESC, p.production_year DESC, p.id
LIMIT {{ tblProducts.pageSize }}::integer
OFFSET ({{ tblProducts.pageNo }}::integer - 1) * {{ tblProducts.pageSize }}::integer;
```

### Buscar um produto — `qProductGet`

```sql
SELECT id, brand, model, version, model_year, production_year, is_active, is_public
FROM public.products
WHERE id = {{ appsmith.store.selectedProductId }}::integer;
```

### Carregar master e valores — `qProductSpecsGet`

```sql
SELECT
    s.id AS spec_id,
    s.code,
    s.group_name,
    s.equipment_group,
    s.spec_set,
    s.detail,
    s.type,
    s.unit,
    s.value_direction,
    s.unit_perceived_value,
    s.relative_value,
    s.is_baseline,
    s.is_active AS spec_is_active,
    (ps.product_id IS NOT NULL) AS is_associated,
    ps.is_present,
    ps.value,
    ps.input_unit
FROM public.specs AS s
LEFT JOIN public.product_specs AS ps
  ON ps.equipment_id = s.id
 AND ps.product_id = {{ appsmith.store.selectedProductId }}::integer
ORDER BY s.group_name, s.equipment_group, s.spec_set, s.detail, s.code;
```

### Inserir produto — `qProductInsert`

```sql
INSERT INTO public.products (
    brand, model, version, model_year, production_year, is_active, is_public
)
VALUES (
    btrim({{ inpBrand.text }}::text),
    btrim({{ inpModel.text }}::text),
    btrim({{ inpVersion.text }}::text),
    {{ inpModelYear.text }}::smallint,
    {{ inpProductionYear.text }}::smallint,
    {{ swActive.isSwitchedOn }}::boolean,
    {{ swPublic.isSwitchedOn }}::boolean
)
RETURNING id, brand, model, version, model_year, production_year, is_active, is_public;
```

### Atualizar produto — `qProductUpdate`

```sql
UPDATE public.products
SET brand = btrim({{ inpBrand.text }}::text),
    model = btrim({{ inpModel.text }}::text),
    version = btrim({{ inpVersion.text }}::text),
    model_year = {{ inpModelYear.text }}::smallint,
    production_year = {{ inpProductionYear.text }}::smallint,
    is_active = {{ swActive.isSwitchedOn }}::boolean,
    is_public = {{ swPublic.isSwitchedOn }}::boolean,
    updated_at = CURRENT_TIMESTAMP
WHERE id = {{ appsmith.store.selectedProductId }}::integer
RETURNING id, brand, model, version, model_year, production_year, is_active, is_public;
```

### Salvar `product_specs` — `qProductSpecsSave`

O widget envia `tblProductSpecs.updatedRows` como JSON. A action deve validar o tipo no cliente e mostrar uma confirmação com quantidade de inclusões, alterações e remoções. A query executa todas as mudanças em uma única transação.

```sql
BEGIN;

WITH payload AS (
    SELECT
        {{ appsmith.store.selectedProductId }}::integer AS product_id,
        x.spec_id::bigint AS equipment_id,
        x.is_associated,
        CASE WHEN x.type = 'numeric' THEN x.value ELSE NULL END AS value,
        CASE WHEN x.type IN ('binary', 'scale') THEN x.is_present ELSE NULL END AS is_present,
        NULLIF(btrim(x.input_unit), '') AS input_unit
    FROM jsonb_to_recordset({{ JSON.stringify(tblProductSpecs.updatedRows) }}::jsonb)
      AS x(
          spec_id bigint,
          type text,
          is_associated boolean,
          value numeric,
          is_present boolean,
          input_unit text
      )
), deleted AS (
    DELETE FROM public.product_specs AS ps
    USING payload AS p
    WHERE ps.product_id = p.product_id
      AND ps.equipment_id = p.equipment_id
      AND p.is_associated IS FALSE
    RETURNING ps.equipment_id
)
INSERT INTO public.product_specs (product_id, equipment_id, value, is_present, input_unit)
SELECT product_id, equipment_id, value, is_present, input_unit
FROM payload
WHERE is_associated IS TRUE
ON CONFLICT (product_id, equipment_id) DO UPDATE
SET value = EXCLUDED.value,
    is_present = EXCLUDED.is_present,
    input_unit = EXCLUDED.input_unit;

COMMIT;
```

Se o driver Appsmith não aceitar múltiplas instruções em uma action, não separar essa operação em duas actions sem atomicidade. Nesse caso, a implementação fica bloqueada até confirmar um mecanismo transacional já existente; criar RPC nova violaria a restrição de não alterar o schema.

### Duplicar produto — `qProductDuplicate`

```sql
SELECT public.duplicate_product_simple(
    {{ appsmith.store.selectedProductId }}::integer,
    {{ inpDuplicateModelYear.text }}::smallint,
    {{ inpDuplicateProductionYear.text }}::smallint,
    {{ swDuplicateActive.isSwitchedOn }}::boolean
) AS new_product_id;
```

A função não recebe `is_public`; após duplicar, buscar o novo produto e confirmar que permanece não público antes de oferecer edição. Se o corpo real definir outro comportamento, a publicação é bloqueada — não se deve executar um update compensatório silencioso.

## Plano detalhado da Sprint 1

1. **Gate de evidência:** preservar o export auditado; confirmar visualmente na instância a role efetiva, prepared statements, estado de publicação e resolução da sobrecarga de duplicação.
2. **Gate de escrita:** em ambiente autorizado, executar apenas as queries de validação abaixo; confirmar tipos/defaults, constraint `unique_product`, grants, semântica de `updated_at` e comportamento transacional do datasource.
3. **Lista:** criar página Produtos com pesquisa, filtros, paginação, estados de loading/vazio/erro e refresh explícito.
4. **Dados gerais:** criar modal/página de formulário compartilhado para criação e edição; validar obrigatórios, anos, conflito MMV/MY/PY e diferenciar ativo/público.
5. **Specs:** criar grade agrupável baseada no master, com metadados somente leitura e edição tipada da associação; salvar apenas linhas alteradas em transação.
6. **Duplicação:** mostrar resumo da origem e destino, validar conflito, pedir confirmação e chamar a sobrecarga explícita de `duplicate_product_simple`.
7. **Concorrência e cache:** após cada escrita, reler o registro e a lista; documentar que não há controle otimista confirmado. Invalidar o cache do catálogo Next.js antes de operação real ou registrar a defasagem esperada.
8. **Validação:** executar casos funcionais, integridade e regressão, sem usar produtos reais irreversivelmente; preservar evidências sanitizadas.
9. **Entrega:** exportar novamente a aplicação, revisar segredos, registrar hash/data/versão, revisar diff e atualizar documentação.

## Configuração proposta no Appsmith

Página `Produtos`:

- `inpProductSearch`, `selActiveFilter`, `selPublicFilter` e `tblProducts` executam `qProductsList` com debounce na pesquisa;
- clique de linha grava `selectedProductId` e executa em paralelo `qProductGet` e `qProductSpecsGet`;
- `btnNewProduct` abre o formulário vazio; `btnEditProduct` abre os dados retornados, não valores antigos de widget;
- `frmProduct` contém marca, modelo, versão, MY, PY, ativo e público; botão Salvar escolhe insert/update pelo modo explícito do formulário;
- `tblProductSpecs` usa colunas de metadados somente leitura. `value` só edita numeric; `isPresent` só edita binary/scale; Market Value é somente leitura;
- `btnSaveSpecs` fica desabilitado sem alterações ou com validação inválida e exige confirmação;
- `mdlDuplicateProduct` mostra a chave da origem, recebe novo MY/PY e `make_active`; não oferece cópia de preços;
- sucessos fecham modal, limpam estado, refazem lista e selecionam o ID retornado; falhas mantêm dados do usuário e mostram mensagem sem dados sensíveis;
- erros `23505` são apresentados como conflito da chave MMV/MY/PY; demais erros recebem mensagem genérica e contexto técnico apenas no canal administrativo seguro;
- botões de escrita ficam invisíveis ou desabilitados sem autorização administrativa confirmada. O datasource nunca deve expor Service Role no browser.

## Plano de testes

### Casos funcionais

- listar 288 produtos no total sem filtros e conferir paginação/ordenação;
- pesquisar por marca, modelo e versão; combinar filtros ativo/público;
- criar com chave inédita e rejeitar campos vazios/anos inválidos;
- provocar conflito de chave e conferir que nenhum produto parcial foi criado;
- editar campo geral e confirmar que somente o ID selecionado mudou;
- carregar todas as 320 specs e conferir associação/valor de amostras dos três tipos;
- associar, editar e remover spec em transação; falha simulada não pode deixar alteração parcial;
- duplicar para MY/PY inédito, conferir origem intacta, nova chave e igualdade das associações;
- confirmar que nenhuma linha de `product_price_offers` foi copiada;
- confirmar que `specs`, `unit_perceived_value` e `relative_value` não mudaram;
- confirmar estados de loading, vazio, erro, duplo clique e reenvio.

### Queries de validação somente leitura

```sql
-- Estrutura usada pela Sprint 1
SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_specs', 'specs')
ORDER BY table_name, ordinal_position;

-- Índices/constraints relevantes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('products', 'product_specs', 'specs')
ORDER BY tablename, indexname;

-- Assinaturas e propriedades, sem executar as funções
SELECT p.oid::regprocedure::text AS signature,
       pg_get_function_result(p.oid) AS result_type,
       p.provolatile, p.prosecdef, p.proconfig
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('duplicate_product_model_year', 'duplicate_product_simple')
ORDER BY signature;

-- Integridade lógica
SELECT COUNT(*) AS orphan_product_specs
FROM public.product_specs AS ps
LEFT JOIN public.products AS p ON p.id = ps.product_id
WHERE p.id IS NULL;

SELECT product_id, equipment_id, COUNT(*)
FROM public.product_specs
GROUP BY product_id, equipment_id
HAVING COUNT(*) > 1;

-- Semântica por tipo
SELECT s.type, ps.is_present,
       COUNT(*) FILTER (WHERE ps.value IS NULL) AS null_values,
       COUNT(*) FILTER (WHERE ps.value IS NOT NULL) AS filled_values,
       COUNT(*) AS total
FROM public.product_specs AS ps
JOIN public.specs AS s ON s.id = ps.equipment_id
GROUP BY s.type, ps.is_present
ORDER BY s.type, ps.is_present;

-- Snapshot de validação da duplicação: executar antes e depois com IDs controlados
SELECT p.id, p.brand, p.model, p.version, p.model_year, p.production_year,
       p.is_active, p.is_public,
       COUNT(DISTINCT ps.equipment_id) AS spec_count,
       COUNT(DISTINCT ppo.id) AS price_offer_count
FROM public.products AS p
LEFT JOIN public.product_specs AS ps ON ps.product_id = p.id
LEFT JOIN public.product_price_offers AS ppo ON ppo.product_id = p.id
WHERE p.id IN ({{ sourceProductId }}::integer, {{ duplicatedProductId }}::integer)
GROUP BY p.id, p.brand, p.model, p.version, p.model_year, p.production_year,
         p.is_active, p.is_public
ORDER BY p.id;

-- Prova de que o master não mudou durante o teste
SELECT COUNT(*) AS spec_count,
       SUM(unit_perceived_value) AS unit_perceived_value_checksum,
       SUM(relative_value) AS relative_value_checksum,
       MAX(updated_at) AS latest_spec_update
FROM public.specs;
```

## Riscos e bloqueios reais

- **BLOQUEIO para escrita real:** identidade/role efetiva, autorização administrativa e comportamento de transação do datasource ainda precisam ser confirmados.
- **BLOQUEIO para publicação:** `Admin Modelos` e `Análise de Valor` existem apenas como rascunho no export; é necessário confirmar qual versão está efetivamente publicada na instância.
- **RISCO CRÍTICO:** RLS está desabilitado na maior parte do schema e há grants amplos; isso não deve ser “corrigido” nesta sprint sem o plano de hardening aprovado.
- **RISCO ALTO:** `product_specs.product_id` não possui FK confirmada; a aplicação e a função precisam preservar integridade lógica.
- **RISCO:** não há mecanismo de concorrência otimista confirmado e nenhum trigger atualiza `updated_at` automaticamente.
- **PENDENTE:** confirmar em runtime qual sobrecarga a action sem casts resolve e inspecionar o corpo versionável/sanitizado das funções antes da publicação.
- **PENDENTE:** definir a invalidação do cache do catálogo público após escrita administrativa.
