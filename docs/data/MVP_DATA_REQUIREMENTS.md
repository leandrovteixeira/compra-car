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

A validação do banco confirmou 320 specs — 171 `binary`, 90 `scale` e 59 `numeric` — sem tipo fora do contrato e sem `code` nulo, vazio ou duplicado. Nas 37.251 associações, não há `is_present = false` nem `value` vazio. `Binary` e `scale` usam a presença da associação; `numeric` usa `value`. O adaptador atual está compatível com essa semântica.

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

O histórico existente contém 746 linhas para 287 produtos, originadas de carga histórica de Excel e cobrindo 11 meses, de junho de 2025 a abril de 2026. A tabela mistura preço público/MSRP e política comercial por MMV/MY/PY, identidade representada por `products.id`. `offer_month` é a referência temporal de negócio; `created_at` e `updated_at` são datas técnicas. O contrato público implementado ainda não consome esses dados.

Há duas duplicidades de produto e mês: produto `12` em junho de 2025, ofertas `12` e `37`, com MSRP de 194.800; e produto `13` no mesmo mês, ofertas `13` e `38`, com MSRP de 204.800. Uma linha funciona como base de preço e a outra contém uma combinação de política comercial. Não se recomenda unicidade em `product_id + offer_month` na tabela atual.

`vw_product_value_current` seleciona por maior `created_at`, com `DISTINCT ON (product_id)`, sem `offer_month` ou desempate adicional. Como a carga histórica compartilha o mesmo instante, a escolha pode ser não determinística e não garante o mês comercial mais recente. Além disso, a view filtra produtos ativos, mas não públicos, impedindo seu uso direto como contrato público seguro.

Substituir apenas `created_at` por `offer_month` na view não resolve a mistura de conceitos nem a perda de políticas simultâneas. A separação alvo entre histórico de MSRP, múltiplas políticas e importação assistida por IA está definida na [ADR-008](../architecture/decisions/ADR-008-SEPARACAO-MSRP-POLITICAS-COMERCIAIS.md). Sua implementação está adiada e não é requisito do comparador MVP enquanto preço e política comercial não forem expostos pelo contrato público legado.

Os requisitos do backoffice administrativo, inclusive preços, políticas e monetização de specs, estão em `docs/admin`. Eles não ampliam silenciosamente os contratos TypeScript do MVP público.

## Segurança e acesso

A inspeção confirmou o estado atual de RLS e grants. A superfície de leitura necessária ao MVP e o hardening permanecem pendentes. Nenhuma chave, URL privada ou dado sensível deve ser incluído nos resultados sanitizados.

## Decisão provisória após inspeção

O modelo atual é suficiente para o MVP e não requer reestruturação ampla antes da interface. O Appsmith permanece como backoffice temporário. O frontend público, porém, não deve receber acesso direto irrestrito ao schema atual: RLS está desativado em praticamente todas as tabelas, não foram encontradas policies e há grants amplos para `anon` e `authenticated`.

O contrato definitivo de leitura do MVP será definido em uma etapa específica de segurança. Essa etapa deve separar leitura pública, administração autenticada e processos server-side com `service_role`, que nunca pode ser usado no navegador. Grants e RLS só devem mudar depois do mapeamento de Appsmith, scripts e integrações, com testes, migration de hardening e rollback preparados.

## Validações de dados e segurança

- validar com o negócio a chave lógica de `products` coberta por `unique_product`;
- projetar e testar a separação entre MSRP e ofertas, incluindo vigência, desempate determinístico e filtro público;
- confirmar a action e a assinatura de `duplicate_product_simple` usada no Appsmith;
- identificar consumidores de `anon`, `authenticated` e `service_role`;
- validar quais tabelas staging ainda são utilizadas;
- desenhar o hardening de RLS e grants;
- definir a superfície e o contrato de leitura do MVP.

## Status consolidado

- **CONFIRMADO NO REPOSITÓRIO:** superfície mínima e mapeamentos usados pelo adaptador.
- **CONFIRMADO NA INSPEÇÃO:** schema de negócio `public`, objetos, volumes aproximados, functions, índices, ausência de triggers de aplicação e estado atual de RLS e grants.
- **CONFIRMADO NOS DADOS:** 42 produtos ativos e públicos, todos com itens comparáveis; mínimo 105, máximo 182 e média 139,64 itens sob a regra validada.
- **CONFIRMADO NOS DADOS:** unicidade de `ComparisonItem.code` e semântica de `binary`, `scale`, `numeric` e `is_present` compatíveis com o adaptador.
- **CONFIRMADO NOS DADOS:** 746 políticas mensais para 287 produtos; o produto público ID `750` é o único sem oferta e não bloqueia o comparador atual.
