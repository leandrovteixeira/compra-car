# Contratos Conceituais do Frontend

Estes contratos preliminares descrevem a fronteira estável entre a interface, os serviços de aplicação e os adaptadores de dados. Eles não representam tabelas, colunas ou respostas atuais do Supabase.

Os campos exatos, obrigatoriedade, paginação e estratégia de versionamento estão **PENDENTE**. Os blocos TypeScript servem apenas como especificação e não constituem implementação.

## Princípios

- IDs são representados por `string`.
- Datas e instantes usam strings ISO 8601.
- Valores ausentes usam status explícito.
- Diferença e vantagem são conceitos separados.
- Uma comparação aceita exatamente 2 ou 3 IDs de versões.
- O resultado informa geração, atualização e qualidade dos dados.
- A UI depende destes contratos, nunca das estruturas legadas.
- A geração de PDF recebe um contrato pronto e não consulta diretamente o banco.

## Tipos e enums preliminares

```ts
type ISODate = string;
type ISODateTime = string;
type EntityId = string;
type PdfContentMode = "COMPLETE" | "CURRENT_VIEW";

enum DataAvailabilityStatus {
  AVAILABLE = "AVAILABLE",
  NOT_AVAILABLE = "NOT_AVAILABLE",
  NOT_APPLICABLE = "NOT_APPLICABLE",
  NOT_INFORMED = "NOT_INFORMED",
  NOT_FOUND = "NOT_FOUND",
  OUTDATED = "OUTDATED",
  CONFLICTING = "CONFLICTING",
}

enum EquipmentAvailabilityStatus {
  STANDARD = "STANDARD",
  OPTIONAL = "OPTIONAL",
  PACKAGE_ONLY = "PACKAGE_ONLY",
  NOT_AVAILABLE = "NOT_AVAILABLE",
  NOT_APPLICABLE = "NOT_APPLICABLE",
  NOT_INFORMED = "NOT_INFORMED",
  NOT_FOUND = "NOT_FOUND",
  OUTDATED = "OUTDATED",
  CONFLICTING = "CONFLICTING",
}

enum ComparisonDisplayMode {
  DIFFERENCES = "DIFFERENCES",
  ALL = "ALL",
  ADVANTAGES = "ADVANTAGES",
}

enum AdvantageStatus {
  ADVANTAGE = "ADVANTAGE",
  DISADVANTAGE = "DISADVANTAGE",
  TIE = "TIE",
  NOT_COMPARABLE = "NOT_COMPARABLE",
  UNKNOWN = "UNKNOWN",
}
```

### DataAvailabilityStatus

- `AVAILABLE`: existe informação utilizável.
- `NOT_AVAILABLE`: a fonte confirma que o item ou valor não está disponível.
- `NOT_APPLICABLE`: o conceito não se aplica ao veículo ou contexto.
- `NOT_INFORMED`: a origem não informou o valor.
- `NOT_FOUND`: o processo não encontrou informação confiável.
- `OUTDATED`: a informação existe, mas está fora do critério de atualidade.
- `CONFLICTING`: existem informações relevantes que não puderam ser reconciliadas.

### EquipmentAvailabilityStatus

- `STANDARD`: equipamento incluído de série na versão.
- `OPTIONAL`: equipamento disponível como opcional individual.
- `PACKAGE_ONLY`: equipamento disponível somente como parte de um pacote.
- `NOT_AVAILABLE`: a fonte confirma que o equipamento não está disponível.
- `NOT_APPLICABLE`: o equipamento não se aplica à versão ou tecnologia.
- `NOT_INFORMED`: a origem não informou a condição do equipamento.
- `NOT_FOUND`: o processo não encontrou informação confiável.
- `OUTDATED`: a informação existe, mas está fora do critério de atualidade.
- `CONFLICTING`: existem informações que não puderam ser reconciliadas.

`STANDARD`, `OPTIONAL` e `PACKAGE_ONLY` são estados comerciais distintos e não podem ser tratados como equivalentes.

### ComparisonDisplayMode

- `DIFFERENCES`: mostra apenas itens semanticamente diferentes.
- `ALL`: mostra todos os itens disponíveis para a comparação.
- `ADVANTAGES`: mostra itens nos quais uma regra auditável identificou vantagem.

`ComparisonDisplayMode` é um estado da interface ou do serviço de apresentação. Ele não faz parte do pedido canônico e não altera nem reduz o conteúdo completo produzido pelo serviço de comparação.

### AdvantageStatus

- `ADVANTAGE`: a regra identificou vantagem para o veículo.
- `DISADVANTAGE`: a regra identificou desvantagem para o veículo.
- `TIE`: os valores são equivalentes segundo a regra.
- `NOT_COMPARABLE`: o item não permite comparação válida.
- `UNKNOWN`: não existe informação ou regra suficiente para concluir.

## Interfaces preliminares

```ts
interface DataQualityStatus {
  sourceLabel?: string;
  sourceReference?: string;
  dataUpdatedAt?: ISODateTime;
  referenceDate?: ISODate;
  warnings: string[];
}

interface BrandSummary {
  id: EntityId;
  name: string;
  displayName: string;
  themeId?: EntityId;
}

interface VehicleSearchOption {
  id: EntityId;
  brand: BrandSummary;
  modelName: string;
  versionName: string;
  productionYear?: string;
  modelYear?: string;
  displayLabel: string;
  isActive: boolean;
  dataQuality: DataQualityStatus;
}

interface VehicleVersionSummary {
  id: EntityId;
  brand: BrandSummary;
  modelName: string;
  versionName: string;
  productionYear?: string;
  modelYear?: string;
  displayLabel: string;
  isActive: boolean;
  startingPrice?: PriceValue;
  dataQuality: DataQualityStatus;
}

interface VehicleVersionDetails extends VehicleVersionSummary {
  generationLabel?: string;
  faceliftLabel?: string;
  powertrainLabel?: string;
  specifications: SpecificationValue[];
  equipment: EquipmentValue[];
  commercialPolicies: CommercialPolicySummary[];
  dataUpdatedAt?: ISODateTime;
}

interface PriceValue {
  availability: DataAvailabilityStatus;
  amount?: number;
  currency?: string;
  referenceDate?: ISODate;
  formattedValue?: string;
  dataQuality: DataQualityStatus;
}

interface SpecificationValue {
  specificationId: EntityId;
  label: string;
  categoryLabel?: string;
  dataType: "TEXT" | "NUMBER" | "BOOLEAN" | "DATE";
  availability: DataAvailabilityStatus;
  rawValue?: string | number | boolean;
  formattedValue?: string;
  unit?: string;
  dataQuality: DataQualityStatus;
}

interface EquipmentValue {
  equipmentId: EntityId;
  label: string;
  categoryId?: EntityId;
  categoryLabel?: string;
  dataType: "PRESENCE" | "TEXT" | "NUMBER" | "BOOLEAN";
  availability: EquipmentAvailabilityStatus;
  rawValue?: string | number | boolean;
  formattedValue?: string;
  dataQuality: DataQualityStatus;
}

interface CommercialPolicySummary {
  id: EntityId;
  title: string;
  summary?: string;
  availability: DataAvailabilityStatus;
  validFrom?: ISODate;
  validUntil?: ISODate;
  contextLabel?: string;
  dataQuality: DataQualityStatus;
}

interface ComparisonRequest {
  vehicleVersionIds:
    | [EntityId, EntityId]
    | [EntityId, EntityId, EntityId];
  locale: string;
  requestedAt: ISODateTime;
}

interface DataSnapshotReference {
  id?: EntityId;
  label?: string;
  importedAt?: ISODateTime;
  sourceReference?: string;
}

interface ComparisonResult {
  id: EntityId;
  request: ComparisonRequest;
  vehicles: VehicleVersionSummary[];
  sections: ComparisonSection[];
  generatedAt: ISODateTime;
  dataUpdatedAt?: ISODateTime;
  dataSnapshot?: DataSnapshotReference;
  dataQuality: DataQualityStatus;
  legalNotice: string;
}

interface ComparisonSection {
  id: EntityId;
  title: string;
  order: number;
  items: ComparisonItem[];
}

interface ComparisonItem {
  id: EntityId;
  label: string;
  dataType: "TEXT" | "NUMBER" | "BOOLEAN" | "DATE";
  unit?: string;
  values: ComparisonVehicleValue[];
  isDifferent: boolean;
  advantageResults: AdvantageResult[];
  dataQuality: DataQualityStatus;
}

interface ComparisonVehicleValue {
  vehicleVersionId: EntityId;
  availability: DataAvailabilityStatus;
  rawValue?: string | number | boolean;
  formattedValue?: string;
  dataQuality: DataQualityStatus;
}

interface AdvantageRuleReference {
  id: EntityId;
  version: string;
  label: string;
  explanation?: string;
}

interface AdvantageResult {
  vehicleVersionId: EntityId;
  status: AdvantageStatus;
  rule?: AdvantageRuleReference;
}

interface BrandTheme {
  id: EntityId;
  brandId?: EntityId;
  name: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  logoUrl?: string;
  isOfficiallyAuthorized: boolean;
  independenceNotice?: string;
}

interface PdfComparisonInput {
  comparison: ComparisonResult;
  theme: BrandTheme;
  documentTitle: string;
  contentMode: PdfContentMode;
}
```

## Explicação dos contratos

### BrandSummary

Resumo de marca adequado para listagem, seleção e escolha de tema. Não contém detalhes internos da origem dos dados.

### VehicleSearchOption

Opção compacta retornada pela busca. Deve conter informação suficiente para distinguir uma versão e confirmar que ela está ativa, sem carregar toda a comparação.

### VehicleVersionSummary

Resumo normalizado de uma versão usado em seletores, cabeçalhos e resultados. O preço inicial é opcional e mantém status e data próprios.

### VehicleVersionDetails

Visão detalhada de uma versão já adaptada para os serviços de aplicação. Reúne especificações, equipamentos e políticas sem expor estruturas físicas da fonte.

### PriceValue

Valor monetário normalizado com moeda, data de referência, apresentação e qualidade explícitas. A natureza exata do preço permanece **PENDENTE** de auditoria.

### SpecificationValue

Valor tipado de uma especificação, acompanhado de unidade, apresentação e qualidade. O `rawValue` somente aparece quando o status permitir valor.

### EquipmentValue

Estado ou valor tipado de um equipamento em uma versão. Usa `EquipmentAvailabilityStatus` para distinguir equipamento de série, opcional, disponível somente em pacote, indisponível, não aplicável e diferentes estados de qualidade da informação.

### CommercialPolicySummary

Resumo de uma política comercial com contexto e vigência. `validFrom` e `validUntil` usam `ISODate`; `ISODateTime` somente será adotado se a auditoria confirmar vigência por hora e fuso. Sua exposição no MVP depende de auditoria técnica, de segurança e de negócio.

### ComparisonRequest

Pedido canônico de comparação com uma tupla de exatamente 2 ou 3 IDs distintos. A validação de versões ativas ocorre no serviço de aplicação. O serviço produz a comparação completa; a UI aplica `DIFFERENCES`, `ALL` ou `ADVANTAGES` localmente ou por um serviço de apresentação, sem perder conteúdo.

### ComparisonResult

Resultado completo e independente da UI. Inclui veículos, seções, instante de geração, atualização dos dados, qualidade, aviso legal e, quando disponível, referência da carga ou snapshot utilizado.

### DataSnapshotReference

Referência opcional à carga ou snapshot que originou a comparação. Permite registrar identidade, rótulo, momento de importação e fonte sem acoplar o contrato à estrutura física da origem.

### ComparisonSection

Agrupamento ordenado de itens comparáveis, como equipamentos, especificações ou preços. As categorias finais estão **PENDENTE**.

### ComparisonItem

Linha comparável normalizada. `isDifferent` informa diferença semântica; `advantageResults` informa conclusões separadas de regras de vantagem.

### ComparisonVehicleValue

Valor de um item para uma versão específica, sempre com disponibilidade e qualidade explícitas.

### AdvantageResult

Resultado auditável da avaliação de vantagem. Quando houver regra, usa `AdvantageRuleReference`; na falta de base suficiente, usa `UNKNOWN` ou `NOT_COMPARABLE`.

### AdvantageRuleReference

Referência estável à regra explícita que produziu o resultado de vantagem, com identidade, versão, rótulo e explicação opcional.

### DataQualityStatus

Metadados comuns sobre origem, atualização e alertas. A disponibilidade pertence exclusivamente ao objeto de valor correspondente. Os critérios que determinam cada alerta estão **PENDENTE**.

### BrandTheme

Configuração visual normalizada. A flag de autorização e o aviso de independência evitam que personalização seja confundida com vínculo oficial.

### PdfComparisonInput

Entrada autocontida para o gerador de PDF. O instante de geração e o aviso legal já pertencem a `ComparisonResult` e não são duplicados. O MVP deve usar `COMPLETE` por padrão; `CURRENT_VIEW` fica disponível para uma evolução explicitamente escolhida. O gerador não consulta o banco nem conhece o legado.

## Invariantes e validações

- `vehicleVersionIds` deve conter 2 ou 3 IDs distintos.
- Todos os IDs recebidos devem representar versões ativas no momento da comparação.
- Campos de data devem conter ISO 8601 válido.
- Um valor sem conteúdo utilizável deve informar o motivo em `availability`.
- `NOT_INFORMED`, `NOT_FOUND`, `OUTDATED` e `CONFLICTING` não podem ser tratados como `NOT_AVAILABLE`.
- Equipamento `OPTIONAL` ou `PACKAGE_ONLY` não pode ser tratado como `STANDARD`.
- `isDifferent` deve resultar de comparação semântica, não apenas de comparação textual.
- Um item diferente pode não ter qualquer vantagem conhecida.
- Uma vantagem exige regra explícita; ausência de dado nunca cria vantagem ou desvantagem automaticamente.
- O resultado deve manter a mesma ordem dos veículos solicitados, salvo decisão posterior documentada.
- O número de valores por item deve corresponder ao número de veículos no resultado.
- O serviço de comparação deve produzir conteúdo completo, independentemente do `ComparisonDisplayMode` escolhido pela UI.
- Quando disponível, `dataSnapshot` deve identificar a carga ou snapshot que originou a comparação.
- O PDF deve refletir o `ComparisonResult` recebido, não refazer consultas e usar `COMPLETE` por padrão no MVP.

## Camada de adaptação

Arquitetura transitória:

```text
Next.js UI
→ serviços de aplicação
→ contratos
→ Legacy Supabase Adapter
→ Supabase atual
```

Arquitetura futura:

```text
Next.js UI
→ serviços de aplicação
→ contratos
→ Supabase V2 Adapter
→ Supabase V2
```

O adaptador traduz a fonte para os contratos e preserva os estados de disponibilidade e qualidade. Os serviços aplicam casos de uso e regras auditáveis. A troca do adaptador não deve exigir mudanças nos componentes visuais quando os contratos permanecerem compatíveis.

**Regra obrigatória:** nenhum componente visual deve acessar diretamente nomes de tabelas ou colunas legadas.

## Pendências

- **PENDENTE:** campos exatos e obrigatoriedade de cada contrato após auditoria.
- **PENDENTE:** catálogo e versionamento das regras de vantagem.
- **PENDENTE:** mapeamento confiável dos estados comerciais de equipamentos.
- **PENDENTE:** estrutura e autorização de políticas comerciais.
- **PENDENTE:** contratos e origem de imagens.
- **PENDENTE:** estratégia de autenticação e autorização.
- **PENDENTE:** nível de rastreabilidade de fontes e transformações.
- **PENDENTE:** disponibilidade e granularidade da referência de carga ou snapshot.
- **PENDENTE:** catálogo e fallback de traduções.
- **PENDENTE:** estratégia e invalidação de cache.
- **PENDENTE:** formato de paginação e ordenação da busca.
- **PENDENTE:** metas de desempenho e limites de resultados.
- **PENDENTE:** estratégia de compatibilidade e versionamento dos contratos.
- **PENDENTE:** confirmar se `CURRENT_VIEW` será necessário no MVP ou somente em evolução futura.
