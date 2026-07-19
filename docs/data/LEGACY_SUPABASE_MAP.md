# Mapa do Legacy Supabase Adapter

Este documento relaciona os contratos normalizados à superfície física confirmada para o MVP. O adaptador só lê `public.products`, `public.specs` e `public.product_specs`; nomes físicos ficam confinados em `packages/adapter-supabase`.

## Identificação física

| Conceito normalizado | Origem física | Transformação |
|---|---|---|
| `Vehicle.id` | `products.id` | conversão para `string` |
| `Vehicle.brand` | `products.brand` | texto obrigatório |
| `Vehicle.model` | `products.model` | texto obrigatório |
| `Vehicle.version` | `products.version` | texto obrigatório |
| `Vehicle.modelYear` | `products.model_year` | conversão para `string` |
| `Vehicle.productionYear` | `products.production_year` | conversão para `string` |
| `Vehicle.displayName` | campos do produto | derivado pelo domínio |
| `Vehicle.isActive` | `products.is_active` | somente `true` é ativo |
| `Vehicle.isPublic` | `products.is_public` | somente `true` é público |
| `ComparisonItem.id` | `specs.id` | conversão para `string` |
| `ComparisonItem.code` | `specs.code` | texto obrigatório e identidade da linha |
| `ComparisonItem.type` | `specs.type` | `binary`, `scale` ou `numeric`; demais tipos geram erro |
| `ComparisonItem.category` | `specs.group_name` | texto obrigatório |
| `ComparisonItem.equipmentGroup` | `specs.equipment_group` | texto obrigatório |
| `ComparisonItem.specSet` | `specs.spec_set` | texto obrigatório, sem agrupamento de codes distintos |
| `ComparisonItem.label` | `specs.detail` | texto obrigatório, preservado sem correção implícita |
| `ComparisonItem.unit` | `specs.unit` | usada apenas em item `numeric` |
| `ComparisonItem.valueDirection` | `specs.value_direction` | `Positive → positive`; `Negative → negative`; obrigatório em item `numeric` |
| `ComparisonItem.sortOrder` | sem origem | `null` |
| Associação | `product_specs.product_id` + `equipment_id` | `equipment_id → specs.id` possui FK física; `product_id → products.id` é vínculo lógico sem FK |
| Valor `binary`/`scale` | `product_specs.is_present` | `true`/`false` explícitos; `null` ou associação ausente = informação desconhecida |
| Valor `numeric` | `product_specs.value` | número finito ou `null`; inválido gera erro explícito |
| Unidade do valor | `product_specs.input_unit`, `specs.unit` | primeiro valor não vazio, nessa ordem, ou `null` |

## Elegibilidade pública

Um produto só é retornado como disponível quando `is_active = true`, `is_public = true` e existe ao menos uma associação com uma `specs.is_active = true`. Uma lista pública vazia é um resultado válido.

## Estratégia de consulta

- projeções explícitas, sem transportar linhas cruas além do adaptador;
- filtros e lotes com `in(...)`, sem N+1;
- `product_specs` é carregada por todos os veículos e `specs` por todos os `equipment_id` em duas consultas;
- nenhuma operação `insert`, `update`, `upsert`, `delete`, RPC ou migration;
- a chave do servidor nunca integra DTO, erro público, log ou variável `NEXT_PUBLIC_*`.

## Dívida técnica conhecida

- `product_specs.product_id → products.id` não possui foreign key física e depende de integridade lógica;
- textos com mojibake, como `360ï¿½` ou `540ï¿½`, são preservados pelo adaptador e devem ser corrigidos na fonte após o MVP;
- a ordem dos itens não possui fonte física confirmada, portanto `sortOrder = null`;
- cardinalidade de itens `scale`, taxonomia e evolução do importador continuam pós-MVP.

## Regra para evidência histórica

Informações encontradas somente em `Legacy` permanecem `HIPÓTESE HISTÓRICA`. A pasta não foi alterada nem usada como fonte de verdade desta implementação.

## Inventário ampliado do schema `public`

A inspeção somente leitura confirmou `products` como agregado central e também identificou as tabelas principais `product_price_offers`, `product_fipe_map`, `product_fipe_values`, `fipe_reference_values`, `fipe_reference_months`, `fipe_vehicle_models`, `registrations`, `unit_conversions`, `price_offer_imports` e `price_offer_import_rows`. Esses objetos não ampliam automaticamente a superfície do adaptador atual.

As views identificadas são `vw_product_value_current`, `vw_product_value_by_category`, `vw_product_fipe_candidates` e `vw_product_fipe_review`. A relação entre `price_offer_imports` e `price_offer_import_rows`, com possível referência a `products`, confirma uma estrutura de importação, mas não qual processo a utiliza atualmente.

`products_active_backup`, `price_offers_staging`, `registrations_staging`, `product_specs_matrix_staging`, `specs_category_staging` e `specs_import_staging` parecem ser artefatos auxiliares ou de importações históricas. O uso atual permanece **PENDENTE** e deve ser validado antes de qualquer remoção.

## Integridade e identidade

O índice único `unique_product` bloqueia duplicidades de `(brand, model, version, model_year, production_year)`. Sua adequação como identidade definitiva permanece **PENDENTE** de validação com o negócio.

`product_specs` possui unicidade em `(product_id, equipment_id)` e FK de `equipment_id` para `specs`. A inspeção não identificou FK de `product_id` para `products.id`; isso é um risco a validar, não evidência de órfãos.

## Functions, IDs e legado técnico

As functions próprias identificadas são `contains_all_tokens`, `normalize_text`, `duplicate_product_model_year` e duas sobrecargas de `duplicate_product_simple`. As rotinas de duplicação copiam dados de produto e specs; `duplicate_product_model_year` também copia a oferta de preço mais recente. Assinaturas com `integer`/`smallint` e `bigint`/`integer` indicam evolução histórica. Consumidores devem ser mapeados antes de consolidar ou remover rotinas.

Também há mistura entre IDs `integer` e `bigint`: `products` e `registrations` usam sequences `integer`, enquanto várias tabelas mais novas usam `bigint`. Não há necessidade comprovada para migrar esses tipos agora. A nomenclatura `equipments` em objetos ligados a `specs` é mantida como legado de baixo impacto.

## Semântica confirmada de specs

As 320 specs usam exclusivamente os tipos aceitos pelo adaptador: 171 `binary`, 90 `scale` e 59 `numeric`. Não existem codes nulos, vazios ou duplicados. Nas 37.251 associações, `binary` e `scale` têm `is_present = true` e `value = null`, enquanto `numeric` tem `is_present = null` e `value` preenchido. Não foi encontrada nenhuma linha com `is_present = false` ou `value` vazio.

Assim, a presença da associação representa `binary` e `scale`, `value` representa `numeric`, e a ausência da associação representa ausência do item. O `LegacySupabaseAdapter` está compatível com os dados atuais; `is_present = false` não é um problema ativo.

## Mapeamento de preços

`products.id` representa o MMV/MY/PY: marca, modelo, versão, `model_year` e `production_year`. `product_price_offers` contém 746 linhas para 287 produtos, sem referências órfãs, mas mistura preço público/MSRP e política comercial. As linhas vieram de carga histórica de Excel e representam um MMV/MY/PY com preço e política durante 11 meses, de junho de 2025 a abril de 2026. `offer_month` é a referência temporal de negócio. `created_at` e `updated_at` representam carga e alteração técnica.

No formato de origem, condições alternativas, como bônus de troca OU taxa subsidiada, podiam coexistir na mesma linha, sem uma linha por opção. Portanto, a estrutura não distingue adequadamente MSRP, políticas alternativas e revisões.

As políticas podem conter preço público, bônus, rebates, taxa subsidiada, entrada, parcelas, seguro, IPVA, benefícios e observações. Existem duas duplicidades em `product_id + offer_month`: produto `12` em junho de 2025, ofertas `12` e `37`, ambas com MSRP de 194.800; e produto `13` no mesmo mês, ofertas `13` e `38`, ambas com MSRP de 204.800. Em cada caso, uma linha funciona como base de preço e a outra contém uma combinação de política comercial. Não se recomenda unicidade nessa combinação na tabela legada.

Entre os 42 produtos ativos e públicos, somente o ID `750` — Omoda C5, Luxury 1.5 TGDI HEV DHT, ano-modelo 2027 e produção 2026 — não possui oferta. A view `vw_product_value_current` retorna 41 linhas. Isso não bloqueia o comparador implementado, cujo contrato público ainda não inclui preços.

`vw_product_value_current` usa `DISTINCT ON` por `product_id`, escolhendo a maior `created_at`, sem considerar `offer_month` nem aplicar desempate adicional. A view filtra produtos ativos, mas não públicos; exige product specs, specs ativas e preço não nulo; e agrega `perceived_value_total`. Como todas as linhas históricas foram carregadas no mesmo instante, as 41 linhas indicam atendimento aos joins e filtros, não necessariamente o preço comercial mais recente, e a escolha pode ser não determinística.

Trocar apenas `created_at` por `offer_month` não corrige o problema conceitual: a view mistura MSRP e política e elimina múltiplas políticas simultâneas. A [ADR-008](../architecture/decisions/ADR-008-SEPARACAO-MSRP-POLITICAS-COMERCIAIS.md) é a fonte da decisão sobre o modelo alvo e o futuro importador assistido por IA. A implementação está adiada e não bloqueia o comparador MVP enquanto preços e políticas permanecerem fora do contrato público legado.

## Consumo pelo Appsmith

Foi encontrada uma única ocorrência de `duplicate_product_simple`, principal candidata a function consumida pelo Appsmith. A confirmação depende do registro da action, do contexto e da assinatura exata. A rotina copia produto e specs, mas não a política comercial mensal, coerentemente com o cadastro ou importação separada de preços.
