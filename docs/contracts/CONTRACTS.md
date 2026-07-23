# Contratos Normalizados

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

## Contratos futuros não implementados

Continuam planejados, mas não fazem parte desta entrega:

- estados detalhados de qualidade e disponibilidade de equipamentos;
- ranking de itens `scale`;
- preços, políticas comerciais e snapshots;
- tema de marca;
- entrada autocontida para PDF;
- autenticação e autorização, planejadas em `docs/architecture/AUTHENTICATION_ARCHITECTURE.md` e ainda sem contratos implementados. O futuro contrato de profile terá roles `admin`/`seller`, status `pending`/`active`/`disabled` e os campos conceituais `id`, `full_name`, `role`, `status`, `invited_by`, `disabled_by`, `invited_at`, `accepted_at`, `disabled_at`, `created_at` e `updated_at`, sem `last_login_at` nesta fase;
- paginação e cache.

Para os contratos futuros de administração, todo convite produzirá `seller`/`pending`; aceite produzirá `active` e registrará `accepted_at`; desativação produzirá `disabled` e registrará ator/data; reativação produzirá `active` e limpará os dados de desativação. Promoção para `admin` será uma operação explícita, separada do convite e do aceite. Os contratos não confiarão em `user_metadata` para privilégios e não exporão operações administrativas sem autorização server-side anterior ao uso de Service Role.

Os contratos futuros atenderão às áreas `seller` e `admin` da mesma aplicação Next.js. `admin` inclui acesso aos casos de uso permitidos a `seller`, mas cada operação administrativa continuará exigindo autorização explícita. Appsmith, seus widgets e suas queries não constituem contratos e permanecem somente como referência histórica.

Nenhum schema de validação externo foi adicionado. As validações atuais são funções e factories TypeScript do próprio core.
