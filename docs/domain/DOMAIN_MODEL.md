# Modelo de Domínio

Este documento descreve o domínio normalizado do Compra Car sem reproduzir o schema do Supabase atual. O código autoritativo desta fase está em `packages/core`.

## Vehicle

`Vehicle` é a unidade comercial selecionável e comparável do MVP. Representa uma combinação específica de:

- `brand`;
- `model`;
- `version`;
- `modelYear`;
- `productionYear`.

Também possui:

- `id: VehicleId`;
- `displayName: VehicleDisplayName`;
- `isActive: boolean`;
- `isPublic: boolean`.

`displayName` pode ser informado ou derivado da combinação comercial. IDs e nomes obrigatórios não aceitam texto vazio.

O termo anterior `VehicleVersion` permanece útil em documentos históricos e como conceito mais amplo de catálogo, mas o tipo implementado e o contrato público do MVP usam `Vehicle`. Nenhum campo físico do banco legado integra essa entidade.

## Elegibilidade do catálogo público

Um veículo aparece no catálogo público do MVP somente quando as três condições forem verdadeiras:

1. `isActive = true`: a combinação veículo/modelo-ano está comercialmente vigente;
2. `isPublic = true`: o cadastro editorial foi revisado e liberado para publicação;
3. existe pelo menos um `ComparisonItem` associado à superfície comparável do veículo.

Atividade comercial e liberação editorial são estados independentes. A existência histórica de um veículo não comprova nenhuma dessas condições.

## ComparisonItem

`ComparisonItem` representa exatamente uma linha normalizada de comparação:

```ts
interface ComparisonItem {
  id: string;
  code: ComparisonItemCode;
  type: "binary" | "numeric" | "scale";
  category: string;
  equipmentGroup: string;
  specSet: string;
  label: string;
  unit: string | null;
  sortOrder: number | null;
}
```

Regras:

- `code` é obrigatório, estável e identifica a linha;
- um `code` não pode aparecer duas vezes no mesmo resultado;
- `label` contém o rótulo apresentável, mas não controla regras;
- `category`, `equipmentGroup` e `specSet` permitem organização futura da UI;
- itens `binary` e `scale` não possuem unidade;
- prefixes como `PW_`, `EX_`, `IN_`, `CO_`, `SF_`, `DM_` e `OW_` não determinam tipo, categoria ou arquitetura.

### Um code, uma linha

Cada `ComparisonItem.code` produz uma linha independente. Dois codes do mesmo `specSet` continuam sendo duas linhas. O MVP não possui cardinalidade `single` ou `multiple` e não agrupa obrigatoriamente conjuntos de opções.

Itens `scale` usam a mesma semântica de presença dos itens `binary` nesta fase. Eles não representam uma escolha exclusiva nem uma escala ordinal no domínio do MVP.

## Valores de comparação

Os valores formam uma união discriminada:

```ts
type VehicleComparisonValue =
  | {
      vehicleId: VehicleId;
      itemCode: ComparisonItemCode;
      type: "binary" | "scale";
      present: boolean;
    }
  | {
      vehicleId: VehicleId;
      itemCode: ComparisonItemCode;
      type: "numeric";
      value: number | null;
      unit: string | null;
    };
```

- associação presente para `binary` ou `scale` significa `present: true`;
- associação ausente para `binary` ou `scale` significa `present: false`;
- ausência numeric permanece `value: null` e nunca é convertida em zero;
- `false` e `null` representam estados diferentes;
- o domínio não formata `Sim`, `Não` ou travessão; essa responsabilidade pertence à apresentação.

## Resultado da comparação

`ComparisonResult` preserva a ordem solicitada dos veículos e agrupa as linhas por categoria:

```text
ComparisonResult
├── vehicles
└── categories
    ├── category
    └── rows
        ├── item
        ├── valuesByVehicle
        └── isDifferent
```

Cada linha corresponde a um único `code` e contém uma célula tipada por veículo. O domínio calcula `isDifferent` por igualdade tipada, mas não aplica filtro visual. Vantagens não são inferidas nesta fase.

## Invariantes implementados

- uma comparação recebe 2 ou 3 IDs distintos;
- os veículos precisam existir, estar ativos e públicos;
- a ordem dos IDs solicitados é preservada;
- cada linha possui identidade exclusiva por `code`;
- o tipo de cada valor precisa coincidir com o tipo do item;
- valores fora dos veículos ou itens solicitados são rejeitados;
- valores duplicados para o mesmo par veículo/item são rejeitados;
- linhas são agrupadas pela categoria normalizada, sem interpretação de prefixo;
- diferença e vantagem permanecem conceitos separados.

## Categorias

Os dados atuais podem conter `Powertrain`, `Exterior`, `Interior`, `Convenience`, `Safety`, `Dimensions` e `Ownership`. Esses nomes são dados normalizados de origem e não uma taxonomia definitiva.

## Portas de repositório

`VehicleRepository` e `ComparisonRepository` são portas assíncronas do domínio. Elas retornam entidades e valores normalizados e não mencionam Supabase, tabelas, colunas, `products`, `specs` ou `product_specs`.

## Conceitos preservados para evolução

Os conceitos abaixo continuam válidos no modelo conceitual mais amplo, mas não foram implementados nesta fase:

- `Brand`, `Model`, `Generation`, `Facelift` e ofertas por mercado ou período;
- `Powertrain`, `Engine`, `ElectricMotor`, `Transmission` e `Drivetrain`;
- estados comerciais detalhados de equipamentos: série, opcional e pacote;
- `Price`, `CommercialPolicy`, `DataSource`, `DataFreshness` e snapshots;
- `Translation`, `BrandTheme` e geração de PDF;
- `AdvantageRule` e `Advantage`.

Uma vantagem somente poderá existir a partir de regra explícita, versionada e auditável. Ausência de dado nunca cria vantagem ou desvantagem automaticamente.

## Backlog pós-MVP

- cardinalidade explícita `single`/`multiple` para conjuntos de opções;
- eventual agrupamento visual de itens `scale`;
- validação de combinações incompatíveis;
- evolução da taxonomia de categorias;
- substituição futura do importador Excel;
- revisão dos prefixes legados;
- rastreabilidade detalhada de fonte, atualização e qualidade;
- catálogo e versionamento das regras de vantagem.

## Pendências

- **PENDENTE:** validar o mapeamento dos contratos com dados reais do Supabase atual.
- **PENDENTE:** confirmar ordenação final das categorias e linhas.
- **PENDENTE:** definir regras de vantagem.
- **PENDENTE:** confirmar estados detalhados de equipamentos necessários após o MVP.
- **PENDENTE:** definir preço, moeda, referência temporal e políticas comerciais.
