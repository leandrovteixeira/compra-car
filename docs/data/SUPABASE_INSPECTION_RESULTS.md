# Resultados da Inspeção do Supabase Atual

## Estado em 2026-07-20

Este documento consolida os resultados já analisados dos scripts somente leitura em `supabase/admin-inspection`. Nenhum SQL de alteração foi executado, nenhuma linha de negócio foi consultada e nenhuma mudança foi feita no banco. As estimativas de volume vêm das estatísticas do PostgreSQL e não são contagens exatas.

## Resumo executivo

O schema de negócio atual é `public`, e `products` é o agregado central do domínio. O modelo existente é suficiente para sustentar o MVP, sem uma reestruturação ampla antes da interface. Contudo, RLS desativado e grants amplos para `anon` e `authenticated` constituem risco crítico: o frontend público não deve receber acesso direto irrestrito ao schema atual.

Na data da inspeção, o Appsmith era tratado como backoffice temporário. O ADR-010 posteriormente o descontinuou como arquitetura-alvo; seus consumidores e integrações ainda precisam ser mapeados antes de qualquer remoção. A estratégia de acesso da área `admin` será implementada na mesma aplicação Next.js, após auditoria de segurança, testes e rollback.

## Inventário do schema de negócio

### Tabelas principais

- `products`;
- `product_specs`;
- `specs`;
- `product_price_offers`;
- `product_fipe_map`;
- `product_fipe_values`;
- `fipe_reference_values`;
- `fipe_reference_months`;
- `fipe_vehicle_models`;
- `registrations`;
- `unit_conversions`;
- `price_offer_imports`;
- `price_offer_import_rows`.

### Tabelas legadas ou auxiliares

- `products_active_backup`;
- `price_offers_staging`;
- `registrations_staging`;
- `product_specs_matrix_staging`;
- `specs_category_staging`;
- `specs_import_staging`.

Várias dessas tabelas parecem ser artefatos de importações históricas. Não há evidência suficiente para afirmar que ainda integram um ETL ativo, e seu uso deve ser validado antes de qualquer remoção.

### Views

- `vw_product_value_current`;
- `vw_product_value_by_category`;
- `vw_product_fipe_candidates`;
- `vw_product_fipe_review`.

## Agregado e relacionamentos

`products` é o agregado central. `product_specs`, `product_price_offers`, `registrations`, `product_fipe_map` e `product_fipe_values` relacionam-se conceitualmente ou por foreign key com `products`.

`price_offer_imports` relaciona-se com `price_offer_import_rows`, e `price_offer_import_rows` pode apontar para `products`. Isso evidencia uma estrutura de importação existente, mas não identifica qual processo ou interface a executa atualmente.

### Chave lógica de produto

`products.id` representa uma combinação de marca, modelo, versão, `model_year` e `production_year`, denominada MMV/MY/PY. O índice único `unique_product` cobre `(brand, model, version, model_year, production_year)`, bloqueando duplicidade dessa combinação. Ele apareceu em `04_indexes.sql`, não no inventário de constraints. Ainda é necessário validar com o negócio se essa combinação representa a identidade definitiva de um produto.

### Integridade referencial pendente

`product_specs` possui `UNIQUE(product_id, equipment_id)`, e foi identificada foreign key de `equipment_id` para `specs`. Não foi identificada foreign key de `product_specs.product_id` para `products.id` no inventário analisado. Isso não comprova a existência de órfãos; exige uma consulta específica de validação antes de qualquer decisão estrutural.

## Functions próprias

Foram identificadas:

- `contains_all_tokens`;
- `normalize_text`;
- `duplicate_product_model_year`;
- duas sobrecargas de `duplicate_product_simple`.

`duplicate_product_simple` cria o produto e copia `product_specs`. `duplicate_product_model_year` também copia a oferta mais recente de `product_price_offers`. Existem versões com assinaturas baseadas em `integer`/`smallint` e `bigint`/`integer`, indicando evolução histórica e dívida técnica. Nenhuma function deve ser removida ou consolidada antes da identificação e validação dos consumidores atuais.

O export auditado em 2026-07-22 confirmou que a action `dup_product`, na página `Admin Modelos`, chama `duplicate_product_simple` com produto, novo MY, novo PY e flag de atividade. A action não usa casts; portanto, confirma o nome e o contexto, mas a sobrecarga resolvida em runtime permanece pendente até a correção tipada. Essa function copia produto e specs, mas não a política comercial mensal, coerentemente com preços cadastrados ou importados separadamente.

## Triggers

Nenhum trigger de aplicação foi encontrado. Portanto, não foi identificada lógica automática de atualização ou propagação por triggers. Caso o domínio dependa de atualização automática de `updated_at`, essa ausência precisa ser validada.

## Segurança

### RLS — CRÍTICO

RLS está desativado em praticamente todas as tabelas, e nenhuma policy foi encontrada. `product_specs_matrix_staging` é a exceção observada: possui RLS ativado, mas sem policy.

### Grants — CRÍTICO

`anon` e `authenticated` possuem privilégios amplos em tabelas centrais, incluindo `SELECT`, `INSERT`, `UPDATE`, `DELETE` e `TRUNCATE`. As functions de duplicação possuem `EXECUTE` para `PUBLIC`, `anon` e `authenticated` e são mutáveis.

A chave `anon` é pública por natureza e não deve ser tratada como segredo. Justamente por isso, o banco atual não deve ser exposto diretamente pelo frontend público antes da correção de segurança. `service_role` nunca deve ser usado no navegador.

### Orientação de hardening

Não alterar grants ou RLS imediatamente. Antes disso:

1. mapear Appsmith, scripts e integrações;
2. identificar consumidores de `anon`, `authenticated` e `service_role`;
3. separar acesso público de leitura, acesso administrativo autenticado e processos server-side com `service_role`;
4. preparar testes e rollback;
5. criar posteriormente uma migration de hardening.

## Índices e nomenclatura

Existem índices únicos relevantes para `products`, `product_specs`, `specs` e entidades FIPE. Não foram observados índices inválidos ou não prontos. Há nomenclatura legada `equipments` em objetos relacionados à tabela `specs`.

## Volumes e validações de dados

| Relação | Linhas confirmadas |
| --- | ---: |
| `products` | 288 |
| `specs` | 320 |
| `product_specs` | 37.251 |
| `product_price_offers` | 746 |
| `registrations` | 25 mil |
| `fipe_vehicle_models` | 55 mil |

Os valores de `products`, `specs`, `product_specs` e `product_price_offers` foram confirmados por contagens completas. Os volumes de `registrations` e `fipe_vehicle_models` continuam aproximados. O volume atual não representa risco imediato de escala para o MVP.

### Produtos e catálogo público

Dos 288 produtos:

- 245 possuem `is_active = false` e `is_public = false`;
- 1 possui `is_active = true` e `is_public = false`;
- 42 possuem `is_active = true` e `is_public = true`;
- nenhum possui `is_active = false` e `is_public = true`.

Existem 16 produtos sem associações em `product_specs`. Nenhum está público: 15 estão inativos e não públicos; o produto ID `678`, Jetour T2 Premium 1.5 TGDI PHEV DHT, ano-modelo 2027 e produção 2026, está ativo mas não público. Esses registros não afetam o catálogo público atual.

Todos os 42 produtos ativos e públicos possuem ao menos um item comparável. Considerando apenas specs ativas e excluindo o caso hipotético de `is_present = false`, cada produto possui entre 105 e 182 itens, com média de 139,64 e nenhum produto com zero itens.

### Semântica de specs

As 320 specs dividem-se em 171 `binary`, 90 `scale` e 59 `numeric`. Não há tipo fora do contrato, nem `code` nulo, vazio ou duplicado.

As 37.251 associações em `product_specs` dividem-se em:

- 20.830 `binary` com `is_present = true` e `value = null`;
- 5.560 `scale` com `is_present = true` e `value = null`;
- 10.861 `numeric` com `is_present = null` e `value` preenchido.

Não há linha com `is_present = false` nem `value` vazio. A semântica observada é consistente: `binary` e `scale` usam a presença da associação, `numeric` usa `value`, e a ausência da associação representa ausência do item. O `LegacySupabaseAdapter` está compatível com os dados atuais e não requer correção por causa de `is_present`.

## Modelo de preços

`product_price_offers` contém 746 linhas para 287 produtos, sem referências órfãs a `products`. A tabela legada mistura dois conceitos: preço público/MSRP e política comercial. As linhas vieram de carga histórica de Excel e cobrem 11 meses, de junho de 2025 a abril de 2026.

No modelo de origem, cada linha representava um MMV/MY/PY com preço e política comercial. Condições alternativas, como bônus de troca OU taxa subsidiada, podiam estar representadas conjuntamente, sem uma linha separada para cada opção. `offer_month` é a referência temporal de negócio; `created_at` e `updated_at` registram carga e alteração técnica, não o mês comercial. Os campos cobrem preço público, bônus, rebates, taxa subsidiada, entrada, parcelas, seguro, IPVA, benefícios e observações.

Foram encontradas duas duplicidades em `product_id + offer_month`:

- produto ID `12`, junho de 2025: ofertas IDs `12` e `37`;
- produto ID `13`, junho de 2025: ofertas IDs `13` e `38`.

Não se recomenda `UNIQUE(product_id, offer_month)` em `product_price_offers`, pois a tabela atual não distingue corretamente MSRP, políticas alternativas e eventuais revisões. Nos dois casos observados, o MSRP se repete — 194.800 para o produto `12` e 204.800 para o produto `13` — e uma linha funciona como base de preço enquanto a outra contém uma combinação de política comercial.

Há 42 produtos ativos e públicos, enquanto `vw_product_value_current` retorna 41 linhas. O único produto ativo e público sem oferta é o ID `750`, Omoda C5, versão Luxury 1.5 TGDI HEV DHT, ano-modelo 2027 e produção 2026. Essa ausência não bloqueia o comparador atual, pois preços ainda não integram o contrato público implementado.

### Comportamento validado de `vw_product_value_current`

A view usa `DISTINCT ON` por `product_id` e escolhe a linha de maior `created_at`, sem usar `offer_month` e sem desempate adicional. Ela filtra `products.is_active = true`, mas não `products.is_public = true`; exige `product_specs`, specs ativas e preço não nulo; e agrega `perceived_value_total`.

As 41 linhas representam produtos que atendem aos joins e filtros atuais. Não significam necessariamente 41 preços ou políticas comerciais vigentes corretos. `created_at` não representa vigência e, como todas as linhas históricas foram carregadas no mesmo instante, a seleção pode ser não determinística. A view chamada `current` não garante o maior mês comercial, e a ausência de filtro `is_public` impede seu uso direto como contrato público seguro.

### Arquitetura futura proposta

A separação futura entre histórico de MSRP e múltiplas políticas comerciais, incluindo o fluxo de importação assistido por IA, foi aceita na [ADR-008](../architecture/decisions/ADR-008-SEPARACAO-MSRP-POLITICAS-COMERCIAIS.md). A implementação está adiada, e o modelo legado permanece durante o MVP enquanto preços e políticas não integrarem o contrato público definitivo.

## Sequences e tipos de ID

Há mistura histórica de IDs `integer` e `bigint`. `products` e `registrations` usam sequences `integer`, enquanto várias tabelas mais novas usam `bigint`. Os tipos não devem ser migrados agora sem necessidade comprovada.

## Classificação dos achados

### CRÍTICO

- RLS desativado e grants amplos para `anon` e `authenticated`;
- functions mutáveis executáveis por `anon` e `PUBLIC`.

### ALTO

- possível ausência de FK `product_specs.product_id -> products.id`;
- necessidade de mapear consumidores antes do hardening.
- `vw_product_value_current` usa `created_at` técnico, sem desempate, e mistura MSRP com políticas comerciais, podendo escolher conteúdo não vigente de forma não determinística;
- ausência de filtro `is_public` impede usar a view diretamente como contrato público seguro.

### MÉDIO

- functions duplicadas e sobrecarregadas;
- mistura de `integer` e `bigint`;
- tabelas staging e backup ainda presentes;
- ausência de triggers para `updated_at`, caso o domínio dependa desse comportamento.

### BAIXO

- nomes legados `equipments` em constraints, índices e sequences.

## Decisão arquitetural provisória

- o modelo atual é suficiente para sustentar o MVP;
- nenhuma reestruturação ampla deve preceder a interface;
- o frontend público não deve receber acesso direto irrestrito ao schema atual;
- a estratégia definitiva de acesso será decidida em uma etapa específica de segurança;
- o Appsmith, considerado temporário na data da inspeção, foi posteriormente descontinuado como arquitetura-alvo pelo ADR-010 e permanece apenas como referência histórica.

## Próximas validações

- validar a chave lógica de `products`;
- desenhar e testar a separação futura entre histórico de MSRP e múltiplas ofertas comerciais;
- confirmar em runtime a sobrecarga de `duplicate_product_simple` enquanto `dup_product` não possuir casts explícitos;
- identificar consumidores de `anon`, `authenticated` e `service_role`;
- validar quais tabelas staging ainda são utilizadas;
- desenhar o hardening de RLS e grants;
- definir o contrato de leitura do MVP.
