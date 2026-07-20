# Requisitos de Dados do MVP

Este inventário registra os requisitos de dados do MVP público. A superfície mínima de `products`, `specs` e `product_specs` foi mapeada a partir das evidências disponíveis e está documentada em `SUPABASE_INSPECTION_RESULTS.md` e `LEGACY_SUPABASE_MAP.md`. A validação online, a cobertura quantitativa e objetos fora dessa superfície continuam pendentes.

## Vehicle

- **Finalidade:** unidade selecionável e comparável.
- **Dados mínimos:** ID estável, marca, modelo, versão, ano-modelo, ano de produção, nome exibível, `isActive` e `isPublic`.
- **Obrigatoriedade:** crítica.
- **Contrato:** `VehicleDto`.
- **Evidência:** objetos, chaves, joins, unicidade e origem de cada estado.
- **Risco:** combinar ou publicar registros incorretos.

### Brand e Model

Marca e modelo integram `Vehicle` e sustentam listagens progressivas. O adaptador atual os lê de `products.brand` e `products.model`; cobertura, qualidade e relacionamentos no ambiente real ainda devem ser validados.

### ProductionYear e ModelYear

Os dois anos permanecem separados no contrato e são lidos de `products.production_year` e `products.model_year`. Formato e cobertura no ambiente real ainda devem ser validados.

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

Um veículo precisa possuir pelo menos um item comparável com valor válido conforme a semântica confirmada de `product_specs`. O adaptador atual exige ao menos uma associação com spec ativa, mas essa implementação não encerra a validação da regra de negócio. Numeric vazio não é zero e prefixes não definem tipos.

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

A implementação preserva nulos, rejeita valores numéricos inválidos e usa `input_unit` com fallback para `specs.unit`. Duplicidades, unidades conflitantes e cobertura no ambiente real ainda devem ser medidas.

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

Os requisitos do backoffice administrativo, inclusive preços, políticas e monetização de specs, estão em `docs/admin`. Eles não ampliam silenciosamente os contratos TypeScript do MVP público.

## Segurança e acesso

A inspeção online deverá confirmar RLS, grants e a superfície de leitura necessária ao MVP. Nenhuma chave, URL privada ou dado sensível deve ser incluído nos resultados sanitizados.

## Status

- **CONFIRMADO NO REPOSITÓRIO:** superfície mínima e mapeamentos usados pelo adaptador.
- **PENDENTE:** validar online os mapeamentos no ambiente autorizado.
- **PENDENTE:** validar `isActive`, `isPublic` e comparabilidade com dados reais.
- **PENDENTE:** confirmar unicidade e estabilidade de `ComparisonItem.code`.
- **PENDENTE:** medir cobertura e qualidade dos valores.
- **PENDENTE:** confirmar como `product_specs.is_present = false` afeta presença, validade e comparabilidade.
