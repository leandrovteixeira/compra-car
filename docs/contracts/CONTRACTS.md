# Contratos Normalizados

## Financial Parameter Set

O contrato persistente usa versões monotônicas, `effective_from`/`valid_to`, `source_type` e
`source_snapshot`. Percentuais são convertidos pelo banco em taxas decimais; a taxa mensal de
referência é CDI mensal mais spread mensal. Para o MVP, a origem é `manual` e o spread é `0,30%`.

`rollover_financial_parameter_set` exige admin ativo, lock versions e correlation ID. Ela encerra a
vigência corrente e chama `publish_financial_parameter_set` para a sucessora na mesma transação.
Apenas `service_role` possui `EXECUTE`; browser roles não escrevem diretamente. `api_import` e
metadados de provedor no snapshot são compatibilidade futura, não integração implementada.

## Batch manual de ProductPublicPrice

`CreateManualPriceBatchInput` contém `rows` com `clientRowId`, `productId`, `amount`, `startsOn` e
`endsOn`. `amount` é sempre string; `clientRowId` é identidade local da grade e correlaciona erros e
resultados, sem participar da identidade persistente do preço.

`ManualPriceBatchResult` retorna `batchId`, `createdCount`, `priceIds` e o mapeamento de cada
`clientRowId` para `importRowId`/`priceId`. IDs atravessam contratos como strings. O repository expõe
somente `listProductOptions` e `createManualPriceBatch`; o primeiro retorna um recorte de Product sem
objeto bruto do banco e o segundo recebe ator e correlation ID gerados no servidor.

`ManualPriceBatchActionStateDto` preserva rows e erros por campo/linha em falha e, em sucesso, informa
quantidade e batch. O cliente não envia ator, status ou currency; o servidor fixa BRL e a RPC fixa
`draft`.

## Escrita de ProductPublicPrice

`ProductPublicPriceWriteInput` transporta `productId`, `amount` decimal canônico em string,
`startsOn` e `endsOn`. `UpdateProductPublicPriceInput` acrescenta `id` e `lockVersion`; nenhum input
de UI aceita ator, status ou timestamps. O repository recebe o ator validado separadamente no
servidor e retorna resultado discriminado para update concluído, inexistente, não editável ou
conflito concorrente.

Create sempre produz `draft`. Update preserva produto e status e só alcança `draft`,
`needs_review` ou `rejected`. `published` e `archived` permanecem fora do contrato de edição.

Estes contratos definem a fronteira entre aplicação, domínio e infraestrutura. A implementação autoritativa está em `packages/core` e `packages/contracts`; nenhum contrato representa tabelas, colunas ou respostas cruas do Supabase.

## Direção das dependências

```text
Next.js / apresentação
→ casos de uso e DTOs públicos
→ entidades e portas do core
← adaptadores de infraestrutura
```

O frontend não conhece o banco legado. `LegacySupabaseAdapter` implementa as portas do domínio e traduz DTOs físicos internos para estes contratos.

## Tipos públicos

`packages/contracts` reutiliza os tipos do core por alias e reexportação, sem manter cópias estruturalmente idênticas.

### VehicleDto

Alias de `Vehicle`, contendo `id`, `brand`, `model`, `version`, `modelYear`, `productionYear`, `displayName`, `isActive` e `isPublic`.

### ComparisonItemDto

Alias de `ComparisonItem`. O campo `code` é a identidade estável de uma linha. `equipmentGroup` e `specSet` são metadados de organização, não agrupadores obrigatórios.

### VehicleComparisonValueDto

Alias da união discriminada `VehicleComparisonValue`:

- `binary` e `scale`: `present: boolean`;
- `numeric`: `value: number | null` e `unit: string | null`.

## Portas de repositório

```ts
interface VehicleRepository {
  listAvailableBrands(): Promise<readonly string[]>;
  listAvailableModels(brand: string): Promise<readonly string[]>;
  listAvailableVehicles(filters?: AvailableVehicleFilters): Promise<readonly Vehicle[]>;
  getVehiclesByIds(ids: readonly VehicleId[]): Promise<readonly Vehicle[]>;
  listPublicEligibleVehicles(filters?: AvailableVehicleFilters): Promise<readonly Vehicle[]>;
}

interface ComparisonRepository {
  getComparisonItemsByVehicleIds(
    vehicleIds: readonly VehicleId[],
  ): Promise<readonly ComparisonItem[]>;
  getComparisonValuesByVehicleIds(
    vehicleIds: readonly VehicleId[],
  ): Promise<readonly VehicleComparisonValue[]>;
}
```

Essas portas não definem cliente Supabase, SQL, paginação física ou nomes legados.

## Casos de uso e DTOs

### ListAvailableBrands

- request: nenhum;
- response: `readonly string[]`.

### ListAvailableModels

- request: `{ brand: string }`;
- response: `readonly string[]`.

### ListAvailableVehicles

- request: `{ brand?: string; model?: string }`;
- response: `readonly VehicleDto[]` elegíveis ao catálogo público.

### GetVehiclesByIds

- request: `{ vehicleIds: readonly string[] }`;
- response: `readonly VehicleDto[]` na ordem solicitada;
- falha quando algum ID não existe.

### CompareVehicles

- request: `{ vehicleIds: readonly string[] }`;
- response: `ComparisonResult`;
- aceita 2 ou mais IDs distintos;
- preserva ordem e valores ausentes;
- agrupa linhas por categoria;
- usa `ComparisonItem.code` como identidade.

## ComparisonResult

```ts
interface ComparisonResult {
  vehicles: readonly Vehicle[];
  categories: readonly {
    category: string;
    rows: readonly {
      item: ComparisonItem;
      valuesByVehicle: Readonly<Record<string, VehicleComparisonValue>>;
      comparisonByVehicle: Readonly<Record<string, ComparisonOutcome>>;
      hasReferenceAdvantage: boolean;
    }[];
  }[];
}
```

O primeiro veículo é a referência. `comparisonByVehicle` contém o resultado completo contra cada concorrente (`advantage`, `disadvantage`, `tie`, `unknown` ou `not-applicable`) e `hasReferenceAdvantage` informa se a referência vence ao menos um concorrente.

## Erros de domínio

- `DomainValidationError`;
- `ComparisonVehicleCountError`;
- `DuplicateVehicleSelectionError`;
- `VehicleNotFoundError`;
- `VehicleNotEligibleError`;
- `DuplicateComparisonItemCodeError`;
- `InvalidComparisonDataError`.

O adaptador legado traduz falhas técnicas em erros próprios sem expor credenciais ou respostas cruas à aplicação. Adaptadores futuros devem preservar a mesma fronteira.

## Invariantes

- IDs e codes não podem ser vazios.
- Cada `code` representa uma linha independente.
- Dois codes do mesmo `specSet` não são consolidados.
- `binary`/`scale` usam `product_specs.is_present`; ausência de informação produz `present: null`.
- `numeric` sem valor produz `value: null`, nunca zero.
- Um valor precisa ter o mesmo tipo do item.
- O repositório não pode retornar valores fora da seleção nem pares duplicados.
- Atividade comercial (`isActive`) e liberação editorial (`isPublic`) não são equivalentes.

## Contratos implementados e futuros

Auth está implementado em `packages/contracts`: `AppRole` aceita `admin`/`seller`, `UserStatus` aceita `pending`/`active`/`disabled` e `AuthProfile` expõe `id`, `fullName`, `role` e `status`. As factories e consultas Auth ficam em `packages/adapter-supabase`; cookies, redirects e proteção de routes ficam em `apps/web`. A autorização não usa `user_metadata`.

Pricing Domain V2 expõe `CommercialPolicy`, `CommercialOffer`,
`CommercialOfferPolicyMembership`, `CommercialPricingRepository` e `CommercialPolicyInput`. O
último é uma união discriminada pelos tipos atuais de Policy, com campos obrigatórios e proibidos
validados no core. IDs são strings nas fronteiras; valores monetários são strings decimais BRL e
nunca `number` em cálculos. `CommercialOffer.policyIds` representa somente memberships explícitas.

A listagem administrativa usa um DTO local e estreito, `AdminProductListItem`, em `apps/web/src/server/admin-product-service.ts`. Ele transporta somente os campos renderizados: `id`, `brand`, `model`, `version`, `modelYear`, `productionYear`, `isActive` e `isPublic`. Esse DTO não é um contrato público do domínio e não expõe a resposta bruta do Supabase.

Continuam planejados, mas não fazem parte desta entrega:

- estados detalhados de qualidade e disponibilidade de equipamentos;
- ranking de itens `scale`;
- telas em lote de Policies e montagem de Offers;
- tema de marca;
- entrada autocontida para PDF;
- operações de criação, edição e duplicação de veículos;
- cadastro de equipamentos em `product_specs`;
- paginação e cache.

Convite, aceite, desativação administrativa e promoção de role continuam fora da implementação atual.

Os contratos futuros atenderão às áreas `seller` e `admin` da mesma aplicação Next.js. `admin` inclui acesso aos casos de uso permitidos a `seller`, mas cada operação administrativa continuará exigindo autorização explícita. Appsmith, seus widgets e suas queries não constituem contratos e permanecem somente como referência histórica.

Nenhum schema de validação externo foi adicionado. As validações atuais são funções e factories TypeScript do próprio core.
