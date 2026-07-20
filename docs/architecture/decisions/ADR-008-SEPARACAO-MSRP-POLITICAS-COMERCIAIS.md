# ADR-008 — Separação entre MSRP e políticas comerciais

- **Status:** aceito
- **Data:** 2026-07-20
- **Implementação:** adiada; o modelo legado permanece temporariamente durante o MVP

## Contexto

`products.id` representa uma combinação específica de marca, modelo, versão, `model_year` e `production_year`, tratada no domínio como MMV/MY/PY.

A tabela legada `product_price_offers` mistura preço público/MSRP e política comercial. Cada linha contém `product_id`, `offer_month`, `public_price`, bônus, rebates, condições de financiamento, entrada, parcelas, seguro, IPVA, outros benefícios e observações. `offer_month` é a referência temporal de negócio; `created_at` e `updated_at` representam carga e alteração técnica.

A base histórica validada cobre junho de 2025 a abril de 2026. Foram encontrados dois produtos com mais de uma linha no mesmo mês:

- `product_id = 12`, junho de 2025, IDs `12` e `37`, ambas com MSRP de 194.800;
- `product_id = 13`, junho de 2025, IDs `13` e `38`, ambas com MSRP de 204.800.

Esses casos não representam dois preços diferentes: uma linha funciona como registro base de preço, enquanto a outra contém uma combinação de política comercial. Entre os exemplos observados estão bônus de varejo, taxa subsidiada, entrada, parcelas, seguro, IPVA e observação com alternativa como `Insurance OR IPVA`.

No modelo de origem, cada linha representava um MMV/MY/PY com preço e política. Condições alternativas, como bônus de troca OU taxa subsidiada, podiam estar representadas conjuntamente, sem uma linha separada para cada opção. Um produto pode ter somente um MSRP vigente em determinado instante e múltiplas combinações de política comercial vigentes no mesmo período. Políticas distintas são alternativas comerciais; benefícios dentro da mesma política podem ser cumulativos ou alternativos.

`vw_product_value_current` não resolve essa separação: seleciona uma única linha de `product_price_offers` por produto com `created_at DESC`, não usa `offer_month`, não possui desempate determinístico, mistura MSRP e política comercial, descarta políticas simultâneas e não filtra `products.is_public`.

## Decisão

`product_price_offers` é um modelo legado e será mantido durante o MVP sem alteração imediata, desde que preço e políticas comerciais não sejam expostos como contrato público definitivo. O redesenho não bloqueia o comparador MVP atual.

Não será criada uma constraint única simples em `product_id + offer_month` na tabela legada. Um produto pode ter mais de uma combinação comercial no mesmo período, e a estrutura atual não distingue adequadamente preço, políticas alternativas e revisões.

O modelo alvo separará histórico de MSRP de políticas comerciais.

### `product_msrp_history`

Responsabilidade: armazenar exclusivamente o preço público de um produto e sua vigência.

Campos conceituais:

- `id`;
- `product_id`;
- `public_price`;
- `valid_from`;
- `valid_to`;
- `source_import_id`;
- `created_at`;
- `updated_at`.

Regras:

- um produto não pode ter dois MSRP vigentes no mesmo instante;
- alterações de MSRP preservam o histórico;
- preços anteriores não são sobrescritos;
- vigências sobrepostas são impedidas ou detectadas.

### `commercial_offers`

Responsabilidade: armazenar uma combinação completa de política comercial disponível para um produto em determinado período.

Campos conceituais iniciais:

- `id`;
- `product_id`;
- `name`;
- `valid_from`;
- `valid_to`;
- `retail_bonus`;
- `retail_rebate`;
- `trade_in_bonus`;
- `trade_in_rebate`;
- `subsidized_rate_monthly`;
- `down_payment_percent`;
- `installments`;
- `rate_rebate`;
- `insurance_years`;
- `ipva_included`;
- `others_bonus`;
- `total_customer_benefit`;
- `total_dealer_rebate`;
- `notes`;
- `is_active`;
- `source_import_id`;
- `created_at`;
- `updated_at`.

A primeira versão manterá campos comerciais estruturados diretamente em `commercial_offers`, evitando generalização prematura. `commercial_offer_components` poderá ser introduzida quando a variedade de benefícios e condições justificar maior flexibilidade.

Caso alternativas sejam estruturadas, ofertas diferentes representam alternativas **OU** entre campanhas; componentes da mesma oferta representam condições cumulativas **E**; e componentes alternativos dentro da mesma oferta poderão usar `choice_group` ou conceito equivalente.

A migração para o modelo alvo ocorrerá junto com o futuro importador assistido por IA, não como pré-requisito do comparador MVP. O fluxo conterá arquivo original, registro de importação, staging, identificação de MMV/MY/PY, separação entre MSRP e políticas, interpretação de relações E e OU, validação, revisão humana, publicação e rastreabilidade da origem. Na primeira versão, a IA não publicará diretamente sem revisão humana.

`vw_product_value_current` não será corrigida apenas trocando `created_at` por `offer_month`. Uma solução futura criará contratos separados, por exemplo: catálogo público, MSRP vigente e políticas comerciais vigentes.

## Consequências positivas

- separação clara de responsabilidades;
- preservação do histórico de preços;
- suporte a múltiplas campanhas simultâneas;
- melhor auditabilidade;
- melhor interpretação por IA;
- eliminação da ambiguidade entre preço e política;
- possibilidade de contratos públicos mais seguros.

## Consequências negativas e custos

- necessidade futura de migration;
- necessidade de migrar dados legados;
- maior número de tabelas;
- necessidade de regras de vigência;
- necessidade de revisão do backoffice;
- necessidade de definir relações E e OU;
- necessidade de testes de importação e reconciliação.

## Alternativas consideradas

### Manter tudo permanentemente em `product_price_offers`

Rejeitada porque mistura MSRP e políticas e não representa corretamente múltiplas campanhas.

### Criar unique em `product_id + offer_month`

Rejeitada porque um produto pode ter mais de uma combinação comercial no mesmo período.

### Corrigir apenas `vw_product_value_current`

Rejeitada porque uma view não resolve a mistura conceitual do modelo de dados.

### Criar desde já uma estrutura totalmente genérica de componentes

Adiada para evitar complexidade prematura. Campos estruturados em `commercial_offers` atendem à primeira versão; a tabela de componentes será considerada quando houver variedade comprovada.

## Status da implementação

A decisão arquitetural está aceita. Sua implementação está adiada, o modelo legado permanece temporariamente e o redesenho não bloqueia o MVP atual.
