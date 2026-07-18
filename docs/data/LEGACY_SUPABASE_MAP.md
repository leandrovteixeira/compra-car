# Mapa do Legacy Supabase Adapter

Este template relacionará o domínio e os contratos normalizados à estrutura física confirmada do Supabase atual. Ele não confirma nenhum nome físico nesta etapa.

Os contratos conceituais abaixo são evidência documental do repositório. Todo mapeamento físico e todo status de validação permanecem `PENDENTE` até a inspeção do banco.

## Identificação física

| Conceito de domínio | Contrato do frontend | Schema físico | Tabela ou view | Coluna | Tipo físico |
|---|---|---|---|---|---|
| Brand | `BrandSummary` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| Model | `VehicleSearchOption`, `VehicleVersionSummary` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| VehicleVersion | `VehicleSearchOption`, `VehicleVersionSummary`, `VehicleVersionDetails` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| VehicleVersion.isActive | `VehicleSearchOption.isActive`, `VehicleVersionSummary.isActive` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| ProductionYear | `productionYear` nos contratos de versão | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| ModelYear | `modelYear` nos contratos de versão | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| SpecCode | Contrato PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| Specification | `SpecificationValue` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| Equipment | `EquipmentValue` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| EquipmentCategory | `EquipmentValue`, `ComparisonSection` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| EquipmentValue | `EquipmentValue` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| Price | `PriceValue` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| CommercialPolicy | `CommercialPolicySummary` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| Translation | Campos de apresentação; contrato dedicado PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| DataSource | `DataQualityStatus`, `DataSnapshotReference` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| DataFreshness | `DataQualityStatus`, `DataSnapshotReference` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| VehicleImage | Contrato PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## Transformação e disponibilidade

| Conceito de domínio | Transformação necessária | Estado de disponibilidade | Regra de atividade |
|---|---|---|---|
| Brand | PENDENTE | PENDENTE | PENDENTE |
| Model | PENDENTE | PENDENTE | PENDENTE |
| VehicleVersion | PENDENTE | PENDENTE | PENDENTE |
| VehicleVersion.isActive | PENDENTE | PENDENTE | PENDENTE |
| ProductionYear | PENDENTE | PENDENTE | PENDENTE |
| ModelYear | PENDENTE | PENDENTE | PENDENTE |
| SpecCode | PENDENTE | PENDENTE | PENDENTE |
| Specification | PENDENTE | PENDENTE | PENDENTE |
| Equipment | PENDENTE | PENDENTE | PENDENTE |
| EquipmentCategory | PENDENTE | PENDENTE | PENDENTE |
| EquipmentValue | PENDENTE | PENDENTE | PENDENTE |
| Price | PENDENTE | PENDENTE | PENDENTE |
| CommercialPolicy | PENDENTE | PENDENTE | PENDENTE |
| Translation | PENDENTE | PENDENTE | PENDENTE |
| DataSource | PENDENTE | PENDENTE | PENDENTE |
| DataFreshness | PENDENTE | PENDENTE | PENDENTE |
| VehicleImage | PENDENTE | PENDENTE | PENDENTE |

## Evidência e validação

| Conceito de domínio | Fonte | Data de atualização | Qualidade conhecida | Risco | Evidência | Status de validação |
|---|---|---|---|---|---|---|
| Brand | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| Model | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| VehicleVersion | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| VehicleVersion.isActive | PENDENTE | PENDENTE | PENDENTE | risco de confundir existência histórica com disponibilidade | PENDENTE | PENDENTE |
| ProductionYear | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| ModelYear | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| SpecCode | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| Specification | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| Equipment | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| EquipmentCategory | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| EquipmentValue | PENDENTE | PENDENTE | PENDENTE | estados comerciais podem estar colapsados | PENDENTE | PENDENTE |
| Price | PENDENTE | PENDENTE | PENDENTE | preço sem referência temporal | PENDENTE | PENDENTE |
| CommercialPolicy | PENDENTE | PENDENTE | PENDENTE | vigência, acesso ou confidencialidade desconhecidos | PENDENTE | PENDENTE |
| Translation | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| DataSource | PENDENTE | PENDENTE | PENDENTE | rastreabilidade insuficiente | PENDENTE | PENDENTE |
| DataFreshness | PENDENTE | PENDENTE | PENDENTE | dados desatualizados sem aviso | PENDENTE | PENDENTE |
| VehicleImage | PENDENTE | PENDENTE | PENDENTE | acesso ou autorização de uso desconhecidos | PENDENTE | PENDENTE |

## Regra para evidência histórica

Informações encontradas somente em `Legacy` devem ser registradas como `HIPÓTESE HISTÓRICA`, acompanhadas do caminho de origem e sem preencher o status como confirmado. Somente evidência obtida do Supabase atual pode validar o mapeamento vigente.
