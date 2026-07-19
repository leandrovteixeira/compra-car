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
| `ComparisonItem.sortOrder` | sem origem | `null` |
| Associação | `product_specs.product_id` + `equipment_id` | `equipment_id → specs.id` possui FK física; `product_id → products.id` é vínculo lógico sem FK |
| Valor `binary`/`scale` | existência em `product_specs` | associação existente = `true`; ausente = `false` |
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
