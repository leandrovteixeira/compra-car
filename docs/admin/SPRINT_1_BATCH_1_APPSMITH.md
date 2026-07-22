# Sprint 1 — Lote 1 no Appsmith `Admin Modelos`

## Objetivo e limites

Este roteiro deve ser aplicado manualmente na página existente `Admin Modelos`. Ele não cria uma página concorrente, não altera o Supabase, não executa migration e não implementa `product_specs`.

O lote:

- evolui `admin_get_products` com `is_public`, `spec_count`, pesquisa e filtros;
- preserva `tbl_products`;
- mantém todas as actions existentes;
- corrige `dup_product` com casts explícitos;
- adiciona validação de seleção, MY/PY, conflito e tratamento de erro.

Antes de editar, confirme visualmente que o datasource `Compra Car` mantém Prepared Statements habilitado. Faça um novo export antes e depois da alteração e não sobrescreva o export original auditado.

## Ordem de aplicação

1. Adicionar os widgets de pesquisa e filtros com os nomes exatos abaixo.
2. Atualizar `admin_get_products` e testá-la somente em leitura.
3. Ajustar as colunas de `tbl_products`.
4. Adicionar `check_duplicate_product` e testá-la somente em leitura.
5. Corrigir o SQL de `dup_product`, sem executá-lo durante a configuração.
6. Configurar validações e callbacks de `BtnDuplicate`.
7. Validar a página com os casos descritos no final.
8. Somente depois de confirmar a migração dos widgets, avaliar actions redundantes em outro lote; não apagar nenhuma agora.

## 1. Pesquisa textual

Adicionar um widget **Input**:

| Propriedade | Valor |
| --- | --- |
| Name | `inpProductSearch` |
| Label | `Pesquisar` |
| Placeholder | `Marca, modelo, versão ou ano` |
| Data type | `Text` |
| Default text | vazio |
| Required | `false` |
| onTextChanged | vazio; a pesquisa será disparada pelo botão para evitar query a cada tecla |

Adicionar um widget **Button**:

| Propriedade | Valor |
| --- | --- |
| Name | `btnSearchProducts` |
| Label | `Pesquisar` |
| Disabled | `{{ admin_get_products.isLoading }}` |
| onClick | binding abaixo |

```javascript
{{
  admin_get_products.run(
    () => {},
    () => showAlert("Não foi possível carregar os produtos.", "error")
  )
}}
```

## 2. Filtros

Adicionar um widget **Select**:

| Propriedade | Valor |
| --- | --- |
| Name | `selActiveFilter` |
| Label | `Ativo` |
| Source data | binding abaixo |
| Label key | `label` |
| Value key | `value` |
| Default selected value | `all` |
| Required | `true` |
| onOptionChange | executar `admin_get_products` com tratamento de erro, conforme binding abaixo |

```javascript
{{
[
  { label: "Todos", value: "all" },
  { label: "Ativos", value: "true" },
  { label: "Inativos", value: "false" }
]
}}
```

```javascript
{{
  admin_get_products.run(
    () => {},
    () => showAlert("Não foi possível aplicar o filtro de atividade.", "error")
  )
}}
```

Adicionar outro widget **Select**:

| Propriedade | Valor |
| --- | --- |
| Name | `selPublicFilter` |
| Label | `Público` |
| Source data | binding abaixo |
| Label key | `label` |
| Value key | `value` |
| Default selected value | `all` |
| Required | `true` |
| onOptionChange | executar `admin_get_products` com tratamento de erro, conforme binding abaixo |

```javascript
{{
[
  { label: "Todos", value: "all" },
  { label: "Públicos", value: "true" },
  { label: "Não públicos", value: "false" }
]
}}
```

```javascript
{{
  admin_get_products.run(
    () => {},
    () => showAlert("Não foi possível aplicar o filtro de publicação.", "error")
  )
}}
```

## 3. Query `admin_get_products`

Preservar o nome, o datasource `Compra Car` e a execução no carregamento da página. Substituir apenas o SQL pelo conteúdo completo abaixo:

```sql
SELECT
    p.id,
    p.is_active,
    p.is_public,
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year,
    COUNT(ps.equipment_id)::integer AS spec_count
FROM public.products AS p
LEFT JOIN public.product_specs AS ps
    ON ps.product_id = p.id
WHERE (
        NULLIF(btrim({{ inpProductSearch.text }}::text), '') IS NULL
        OR p.brand ILIKE '%' || btrim({{ inpProductSearch.text }}::text) || '%'
        OR p.model ILIKE '%' || btrim({{ inpProductSearch.text }}::text) || '%'
        OR p.version ILIKE '%' || btrim({{ inpProductSearch.text }}::text) || '%'
        OR p.model_year::text ILIKE '%' || btrim({{ inpProductSearch.text }}::text) || '%'
        OR p.production_year::text ILIKE '%' || btrim({{ inpProductSearch.text }}::text) || '%'
      )
  AND (
        {{ selActiveFilter.selectedOptionValue }}::text = 'all'
        OR p.is_active::text = {{ selActiveFilter.selectedOptionValue }}::text
      )
  AND (
        {{ selPublicFilter.selectedOptionValue }}::text = 'all'
        OR p.is_public::text = {{ selPublicFilter.selectedOptionValue }}::text
      )
GROUP BY
    p.id,
    p.is_active,
    p.is_public,
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year
ORDER BY
    p.brand,
    p.model,
    p.version,
    p.model_year DESC,
    p.production_year DESC,
    p.id;
```

Configuração da action:

| Propriedade | Valor |
| --- | --- |
| Prepared Statements | `ON` |
| Run query on page load | manter `ON` |
| Request confirmation before running | `OFF` |
| Timeout | manter `10000 ms` |

Não colocar bindings entre aspas.

## 4. Alterações em `tbl_products`

Preservar:

```javascript
{{ admin_get_products.data }}
```

na propriedade **Table data**.

Configurar as colunas:

| Campo | Label | Tipo | Visible | Editable |
| --- | --- | --- | --- | --- |
| `id` | `ID` | Number | `false` | `false` |
| `is_active` | `Ativo` | Checkbox | `true` | manter `true` neste lote |
| `is_public` | `Público` | Checkbox | `true` | `false` |
| `brand` | `Marca` | Text | `true` | `false` |
| `model` | `Modelo` | Text | `true` | `false` |
| `version` | `Versão` | Text | `true` | `false` |
| `model_year` | `Ano Modelo` | Number | `true` | `false` |
| `production_year` | `Ano Produção` | Number | `true` | `false` |
| `spec_count` | `Specs` | Number | `true` | `false` |
| `EditActions1` | `Save / Discard` | Edit actions | `false` | não alterar |

Preservar temporariamente o evento atual da coluna `is_active`:

```javascript
{{ upd_active.run(() => admin_get_products.run()) }}
```

Não ampliar `upd_active` neste lote e não permitir edição inline dos demais campos. Isso remove a indicação enganosa de edição geral sem apagar a action existente.

## 5. Seletores MY/PY da duplicação

Alterar `SelectModelYear`:

| Propriedade | Valor |
| --- | --- |
| Required | `true` |
| Source data | binding abaixo |
| Default selected value | binding abaixo |

```javascript
{{
  Array.from({ length: 8 }, (_, index) => {
    const year = new Date().getFullYear() - 1 + index;
    return { label: String(year), value: year };
  })
}}
```

```javascript
{{
  tbl_products.selectedRow && tbl_products.selectedRow.model_year
    ? Number(tbl_products.selectedRow.model_year) + 1
    : ""
}}
```

Alterar `SelectProductionYear` da mesma forma:

| Propriedade | Valor |
| --- | --- |
| Required | `true` |
| Source data | mesmo binding dinâmico de anos |
| Default selected value | binding abaixo |

```javascript
{{
  tbl_products.selectedRow && tbl_products.selectedRow.production_year
    ? Number(tbl_products.selectedRow.production_year) + 1
    : ""
}}
```

Preservar `SwitchActive`, com `Default switch state` igual a `true`.

## 6. Nova action de validação de conflito

Adicionar uma query PostgreSQL no datasource `Compra Car`:

| Propriedade | Valor |
| --- | --- |
| Name | `check_duplicate_product` |
| Prepared Statements | `ON` |
| Run query on page load | `OFF` |
| Request confirmation before running | `OFF` |

SQL completo:

```sql
SELECT EXISTS (
    SELECT 1
    FROM public.products AS p
    WHERE p.brand = {{ tbl_products.selectedRow.brand }}::text
      AND p.model = {{ tbl_products.selectedRow.model }}::text
      AND p.version = {{ tbl_products.selectedRow.version }}::text
      AND p.model_year = {{ SelectModelYear.selectedOptionValue }}::smallint
      AND p.production_year = {{ SelectProductionYear.selectedOptionValue }}::smallint
) AS product_exists;
```

Esta query reduz erros de uso, mas não substitui o índice único em uma corrida concorrente. O erro da duplicação continua sendo tratado.

## 7. Correção de `dup_product`

Preservar o nome `dup_product`, o datasource e suas referências. Substituir somente o SQL:

```sql
SELECT public.duplicate_product_simple(
    {{ tbl_products.selectedRow.id }}::integer,
    {{ SelectModelYear.selectedOptionValue }}::smallint,
    {{ SelectProductionYear.selectedOptionValue }}::smallint,
    {{ SwitchActive.isSwitchedOn }}::boolean
) AS new_product_id;
```

Configuração:

| Propriedade | Valor |
| --- | --- |
| Prepared Statements | `ON` |
| Run query on page load | `OFF` |
| Request confirmation before running | `OFF` |

Não executar a query diretamente pelo editor com um produto real. Validá-la pelo fluxo controlado do botão e em ambiente autorizado.

## 8. Validação e callbacks de `BtnDuplicate`

Preservar o nome `BtnDuplicate` e alterar:

| Propriedade | Valor |
| --- | --- |
| Label | `Duplicar produto` |
| Disabled | `{{ check_duplicate_product.isLoading || dup_product.isLoading || admin_get_products.isLoading }}` |
| onClick | binding completo abaixo |

```javascript
{{
  (() => {
    const source = tbl_products.selectedRow;
    const modelYear = Number(SelectModelYear.selectedOptionValue);
    const productionYear = Number(SelectProductionYear.selectedOptionValue);

    if (!source || !Number.isInteger(Number(source.id))) {
      showAlert("Selecione um produto para duplicar.", "warning");
      return;
    }

    if (!Number.isInteger(modelYear) || !Number.isInteger(productionYear)) {
      showAlert("Informe MY e PY válidos.", "warning");
      return;
    }

    if (modelYear < 1900 || modelYear > 2100 || productionYear < 1900 || productionYear > 2100) {
      showAlert("MY e PY devem estar entre 1900 e 2100.", "warning");
      return;
    }

    if (modelYear < productionYear) {
      showAlert("O ano-modelo não pode ser menor que o ano de produção.", "warning");
      return;
    }

    check_duplicate_product.run(
      () => {
        const conflict = Boolean(check_duplicate_product.data?.[0]?.product_exists);

        if (conflict) {
          showAlert("Já existe um produto com a mesma marca, modelo, versão, MY e PY.", "warning");
          return;
        }

        dup_product.run(
          () => {
            const newProductId = dup_product.data?.[0]?.new_product_id;

            admin_get_products.run(
              () => showAlert(
                newProductId
                  ? `Produto duplicado com sucesso. Novo ID: ${newProductId}.`
                  : "Produto duplicado com sucesso.",
                "success"
              ),
              () => showAlert(
                "O produto foi duplicado, mas a lista não pôde ser atualizada. Recarregue a página.",
                "warning"
              )
            );
          },
          () => showAlert(
            "Não foi possível duplicar o produto. Verifique se o MY/PY já existe e tente novamente.",
            "error"
          )
        );
      },
      () => showAlert("Não foi possível validar o conflito de MY/PY.", "error")
    );
  })()
}}
```

O fluxo não exibe mensagens técnicas nem conteúdo do erro retornado pelo banco.

## 9. Ordem de execução em runtime

### Abertura da página

```text
defaults de inpProductSearch/selActiveFilter/selPublicFilter
→ admin_get_products
→ tbl_products
```

### Pesquisa e filtros

```text
usuário informa pesquisa ou filtro
→ btnSearchProducts.onClick ou Select.onOptionChange
→ admin_get_products
→ tbl_products
```

### Duplicação

```text
BtnDuplicate.onClick
→ validação local de seleção e MY/PY
→ check_duplicate_product
→ se houver conflito: alerta e encerra
→ dup_product
→ admin_get_products
→ alerta de sucesso
```

## 10. Testes manuais do lote

1. Abrir `Admin Modelos` com pesquisa vazia e filtros `all`; a lista deve carregar.
2. Pesquisar trechos de marca, modelo, versão, MY e PY.
3. Combinar ativo/inativo com público/não público.
4. Conferir `spec_count` em amostras conhecidas, sem editar specs.
5. Confirmar que marca, modelo, versão e anos não oferecem edição inline.
6. Confirmar que o checkbox ativo ainda executa `upd_active` e recarrega a lista.
7. Acionar duplicação sem linha selecionada e conferir o alerta sem query DML.
8. Testar MY/PY vazio, fora do intervalo e MY menor que PY; nenhuma duplicação deve ocorrer.
9. Selecionar uma combinação já existente; `check_duplicate_product` deve impedir a duplicação.
10. Em ambiente autorizado, duplicar para combinação inédita e conferir o ID retornado, atualização da lista e origem inalterada.
11. Simular falha de leitura e falha de duplicação; nenhuma mensagem técnica ou segredo deve aparecer.
12. Confirmar que nenhuma action existente foi removida e que `product_specs` não ganhou escrita.

## Bloqueios para aplicar

- role efetiva e permissão de `SELECT`/`EXECUTE` do datasource ainda precisam ser confirmadas;
- Prepared Statements precisa ser confirmado visualmente, embora o export indique configuração compatível;
- a execução DML exige ambiente e autorização adequados;
- o estado publicado de `Admin Modelos` precisa ser confirmado antes do rollout;
- salvar `product_specs` permanece explicitamente fora deste lote.
