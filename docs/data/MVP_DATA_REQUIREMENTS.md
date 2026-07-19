# Requisitos de Dados do MVP

Este inventário define o que deverá ser procurado no Supabase atual. Ele não confirma schemas, tabelas ou colunas físicas. Todo mapeamento permanece `PENDENTE` até a inspeção somente leitura.

## Vehicle

- **Finalidade:** unidade selecionável e comparável.
- **Dados mínimos:** ID estável, marca, modelo, versão, ano-modelo, ano de produção, nome exibível, `isActive` e `isPublic`.
- **Obrigatoriedade:** crítica.
- **Contrato:** `VehicleDto`.
- **Evidência:** objetos, chaves, joins, unicidade e origem de cada estado.
- **Risco:** combinar ou publicar registros incorretos.

### Brand e Model

Marca e modelo integram `Vehicle` e sustentam listagens progressivas. A inspeção deve confirmar seus identificadores e relacionamentos sem exigir entidades físicas equivalentes às entidades conceituais.

### ProductionYear e ModelYear

Os dois anos precisam permanecer separados no contrato. A inspeção deve confirmar formato, cobertura e possíveis valores combinados na origem.

## Elegibilidade pública

### ActiveStatus

- **Significado:** vigência comercial da combinação veículo/modelo-ano.
- **Contrato:** `Vehicle.isActive`.
- **Evidência:** flag, datas, view ou regra confirmada e validação comercial.
- **Risco:** tratar existência histórica como disponibilidade vigente.

### PublicStatus

- **Significado:** cadastro revisado e liberado editorialmente.
- **Contrato:** `Vehicle.isPublic`.
- **Evidência:** flag ou processo editorial confirmado.
- **Risco:** publicar cadastro não revisado.

### Comparabilidade

Um veículo precisa possuir pelo menos um item comparável. A inspeção deve confirmar como determinar essa existência sem inferir que vazio numeric é zero ou que prefixes definem tipos.

As três condições são independentes e obrigatórias para o catálogo público.

## ComparisonItem

- **Finalidade:** representar uma linha independente de comparação.
- **Dados mínimos:** ID, `code`, tipo, categoria, grupo, `specSet`, label, unidade e ordem quando disponível.
- **Tipos:** `binary`, `numeric` e `scale`.
- **Contrato:** `ComparisonItemDto`.
- **Evidência:** catálogo, unicidade e estabilidade de codes, tipos e relacionamentos.
- **Risco:** codes duplicados, instáveis ou colapsados incorretamente.

Cada `code` forma uma linha. Dois codes do mesmo `specSet` não podem ser consolidados pelo adaptador. Prefixes de origem são compatibilidade operacional e não determinam tipo ou categoria.

## VehicleComparisonValue

### Binary e scale

- associação presente: `present: true`;
- associação ausente: `present: false`;
- `scale` continua como linha independente no MVP.

### Numeric

- valor: número ou `null`;
- unidade: string ou `null`;
- ausência nunca é convertida em zero.

A inspeção deve identificar nulos, duplicidades, unidades conflitantes e cobertura por veículo/item.

## Categorias e organização

Grupos como `Powertrain`, `Exterior`, `Interior`, `Convenience`, `Safety`, `Dimensions` e `Ownership` devem ser tratados como dados de origem. A taxonomia definitiva permanece no backlog pós-MVP.

`equipmentGroup` e `specSet` devem ser preservados para organização futura, sem impor cardinalidade ou agrupamento obrigatório.

## Dados futuros ou condicionais

Os itens abaixo continuam relevantes, mas não integram os contratos implementados nesta fase:

- preços, moeda e data de referência;
- políticas comerciais, vigência, autorização e confidencialidade;
- estados detalhados de equipamentos de série, opcionais e pacotes;
- fonte, atualização, snapshot e qualidade;
- traduções e imagens autorizadas;
- tema de marca;
- regras de vantagem.

Sua ausência não altera as invariantes já implementadas e não autoriza inferências silenciosas.

## Segurança e acesso

A inspeção deverá registrar RLS, grants e superfície de leitura necessária ao MVP. Nenhuma chave, URL privada ou dado sensível deve ser incluído nos resultados sanitizados.

## Status

- **PENDENTE:** executar a inspeção somente leitura.
- **PENDENTE:** confirmar os mapeamentos físicos.
- **PENDENTE:** validar `isActive`, `isPublic` e comparabilidade com dados reais.
- **PENDENTE:** confirmar unicidade e estabilidade de `ComparisonItem.code`.
- **PENDENTE:** medir cobertura e qualidade dos valores.
