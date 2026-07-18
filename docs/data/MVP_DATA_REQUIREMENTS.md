# Requisitos de Dados do MVP

Este inventário define o que deve ser procurado no Supabase atual. Ele não define schemas, tabelas ou colunas físicas. Todos os mapeamentos começam como `PENDENTE`.

## Brand

- **Finalidade no MVP:** organizar busca, identificação e tema da marca.
- **Dados mínimos:** ID estável e nome exibível.
- **Dados desejáveis:** nome normalizado, aliases e referência de tema.
- **Obrigatoriedade:** obrigatória para seleção e comparação.
- **Risco se ausente:** versões não poderão ser agrupadas ou identificadas corretamente.
- **Contrato relacionado:** `BrandSummary`.
- **Evidência a buscar:** objeto, chave e relacionamento confirmado com modelo ou versão.
- **Status inicial:** **PENDENTE**.

## Model

- **Finalidade no MVP:** agrupar versões em uma família comercial e apoiar busca progressiva.
- **Dados mínimos:** ID ou chave estável, nome comercial e relação com `Brand`.
- **Dados desejáveis:** aliases, geração e ordenação.
- **Obrigatoriedade:** obrigatória para identificação comercial.
- **Risco se ausente:** busca ambígua e apresentação incompleta da versão.
- **Contrato relacionado:** `VehicleSearchOption` e `VehicleVersionSummary` por `modelName`.
- **Evidência a buscar:** objetos e relacionamentos que separem modelo de versão.
- **Status inicial:** **PENDENTE**.

## VehicleVersion

- **Finalidade no MVP:** unidade selecionável e comparável.
- **Dados mínimos:** ID estável, nome de versão, relação com marca/modelo e estado ativo.
- **Dados desejáveis:** nome completo, geração, facelift, propulsão e metadados de atualização.
- **Obrigatoriedade:** crítica.
- **Risco se ausente:** o caso de uso principal não pode funcionar.
- **Contrato relacionado:** `VehicleSearchOption`, `VehicleVersionSummary` e `VehicleVersionDetails`.
- **Evidência a buscar:** chave, objeto principal, joins necessários e regra de unicidade.
- **Status inicial:** **PENDENTE**.

## ProductionYear

- **Finalidade no MVP:** diferenciar ano de fabricação de ano-modelo e apoiar busca.
- **Dados mínimos:** valor de ano quando disponível e associação à versão.
- **Dados desejáveis:** intervalos, validade e representação normalizada.
- **Obrigatoriedade:** desejável; impacto final depende dos dados reais.
- **Risco se ausente:** versões podem ficar ambíguas ou ser comparadas fora de contexto.
- **Contrato relacionado:** `VehicleSearchOption` e `VehicleVersionSummary` por `productionYear`.
- **Evidência a buscar:** campo ou relacionamento que represente fabricação, sem confundi-lo com ano-modelo.
- **Status inicial:** **PENDENTE**.

## ModelYear

- **Finalidade no MVP:** distinguir configurações comerciais por ano-modelo.
- **Dados mínimos:** valor ou intervalo e associação à versão.
- **Dados desejáveis:** representação separada de `ProductionYear`.
- **Obrigatoriedade:** desejável e possivelmente obrigatória para identificação única.
- **Risco se ausente:** versões comerciais podem parecer iguais quando não são.
- **Contrato relacionado:** `VehicleSearchOption` e `VehicleVersionSummary` por `modelYear`.
- **Evidência a buscar:** campo ou relacionamento específico e exemplos de combinação de anos.
- **Status inicial:** **PENDENTE**.

## SpecCode

- **Finalidade no MVP:** identificar ou relacionar configurações técnicas e comerciais quando o banco o utilizar.
- **Dados mínimos:** código e vínculo com a versão.
- **Dados desejáveis:** validade, unicidade, fonte e histórico.
- **Obrigatoriedade:** **PENDENTE**; depende do papel real encontrado.
- **Risco se ausente:** joins ou distinções de versões podem ficar incompletos se o banco depender desse código.
- **Contrato relacionado:** **PENDENTE:** avaliar inclusão em `VehicleVersionDetails` ou uso apenas interno no adaptador.
- **Evidência a buscar:** coluna ou objeto com código, restrições e relacionamentos confirmados.
- **Status inicial:** **PENDENTE**.

## Specification

- **Finalidade no MVP:** definir características técnicas comparáveis.
- **Dados mínimos:** ID, rótulo, tipo, valor por versão e unidade quando aplicável.
- **Dados desejáveis:** categoria, ordem, precisão, tradução e regra de equivalência.
- **Obrigatoriedade:** obrigatória para comparação técnica.
- **Risco se ausente:** comparação limitada ou semanticamente incorreta.
- **Contrato relacionado:** `SpecificationValue` e `ComparisonItem`.
- **Evidência a buscar:** catálogo, valores, tipos, unidades e vínculo com versões.
- **Status inicial:** **PENDENTE**.

## Equipment

- **Finalidade no MVP:** representar itens comparáveis de conteúdo do veículo.
- **Dados mínimos:** ID, rótulo e vínculo com valores por versão.
- **Dados desejáveis:** descrição, categoria, aliases, ordem e tradução.
- **Obrigatoriedade:** obrigatória para o escopo principal.
- **Risco se ausente:** perda de um dos principais argumentos de comparação.
- **Contrato relacionado:** `EquipmentValue` e `ComparisonItem`.
- **Evidência a buscar:** catálogo de itens, chaves e relacionamento com versões.
- **Status inicial:** **PENDENTE**.

## EquipmentCategory

- **Finalidade no MVP:** agrupar equipamentos em seções legíveis.
- **Dados mínimos:** identificador ou rótulo de categoria e vínculo com equipamentos.
- **Dados desejáveis:** ordem, descrição e hierarquia.
- **Obrigatoriedade:** desejável; pode exigir fallback de apresentação.
- **Risco se ausente:** lista extensa e difícil de navegar no mobile.
- **Contrato relacionado:** `EquipmentValue` e `ComparisonSection`.
- **Evidência a buscar:** catálogo de categorias, relacionamento e cobertura dos equipamentos.
- **Status inicial:** **PENDENTE**.

## EquipmentValue

- **Finalidade no MVP:** informar a condição de um equipamento em cada versão.
- **Dados mínimos:** versão, equipamento e estado distinguindo série, opcional, pacote, indisponível e estados desconhecidos.
- **Dados desejáveis:** valor adicional, pacote, custo, fonte e atualização.
- **Obrigatoriedade:** obrigatória para comparar equipamentos.
- **Risco se ausente:** ausência de dado pode ser interpretada incorretamente como ausência do item.
- **Contrato relacionado:** `EquipmentValue` e `EquipmentAvailabilityStatus`.
- **Evidência a buscar:** objeto associativo, domínio de valores, nulos, duplicidades e cobertura.
- **Status inicial:** **PENDENTE**.

## Price

- **Finalidade no MVP:** comparar preços disponíveis com contexto temporal.
- **Dados mínimos:** versão, valor, moeda ou convenção confirmada e data de referência.
- **Dados desejáveis:** tipo de preço, região, fonte e validade.
- **Obrigatoriedade:** obrigatória quando o MVP exibir preço; cobertura pode variar.
- **Risco se ausente:** comparação incompleta ou apresentação de valor sem contexto.
- **Contrato relacionado:** `PriceValue`.
- **Evidência a buscar:** objetos de preço, relacionamento com versão, datas, moeda e duplicidades.
- **Status inicial:** **PENDENTE**.

## CommercialPolicy

- **Finalidade no MVP:** apresentar condições comerciais, somente se viáveis e autorizadas.
- **Dados mínimos:** título, versão aplicável, contexto, vigência e permissão de exposição.
- **Dados desejáveis:** resumo, precedência, canal, região, concessionária e fonte.
- **Obrigatoriedade:** condicional e não bloqueante.
- **Risco se ausente:** funcionalidade omitida sem bloquear o restante do MVP.
- **Contrato relacionado:** `CommercialPolicySummary`.
- **Evidência a buscar:** existência, vigência, relacionamentos, RLS, grants e classificação de confidencialidade.
- **Status inicial:** **PENDENTE**.

## Translation

- **Finalidade no MVP:** apresentar rótulos claros sem controlar a lógica de comparação.
- **Dados mínimos:** conceito ou chave, idioma e rótulo.
- **Dados desejáveis:** descrição, fallback, versão e responsável.
- **Obrigatoriedade:** **PENDENTE**; pode haver rótulos já prontos na fonte.
- **Risco se ausente:** termos técnicos ou inconsistentes na interface.
- **Contrato relacionado:** campos de apresentação dos contratos; contrato dedicado **PENDENTE**.
- **Evidência a buscar:** objetos de tradução, idiomas, cobertura e mecanismo de associação.
- **Status inicial:** **PENDENTE**.

## DataSource

- **Finalidade no MVP:** rastrear a origem das informações exibidas.
- **Dados mínimos:** referência ou rótulo de origem quando disponível.
- **Dados desejáveis:** ID, versão, arquivo, processo de importação e prioridade.
- **Obrigatoriedade:** desejável para rastreabilidade.
- **Risco se ausente:** dificuldade para auditar divergências e responder sobre a origem.
- **Contrato relacionado:** `DataQualityStatus` e `DataSnapshotReference`.
- **Evidência a buscar:** colunas, objetos, comentários ou metadados de importação.
- **Status inicial:** **PENDENTE**.

## DataFreshness

- **Finalidade no MVP:** informar referência, atualização, validade e possíveis defasagens.
- **Dados mínimos:** data de referência ou atualização quando disponível.
- **Dados desejáveis:** atualização por categoria, vigência, snapshot e fuso horário.
- **Obrigatoriedade:** desejável; preço e política exigem contexto temporal.
- **Risco se ausente:** uso de informação desatualizada sem aviso.
- **Contrato relacionado:** `DataQualityStatus`, `DataSnapshotReference`, `PriceValue` e `CommercialPolicySummary`.
- **Evidência a buscar:** timestamps, datas de referência, vigências e metadados de carga.
- **Status inicial:** **PENDENTE**.

## BrandTheme

- **Finalidade no MVP:** personalizar a experiência sem implicar vínculo oficial indevido.
- **Dados mínimos:** relação com marca e configuração visual segura ou fallback neutro.
- **Dados desejáveis:** cores, logo autorizado, textos e registro de autorização.
- **Obrigatoriedade:** desejável; fallback neutro é obrigatório.
- **Risco se ausente:** experiência genérica; sem fallback, risco de identidade inconsistente.
- **Contrato relacionado:** `BrandTheme`.
- **Evidência a buscar:** verificar se o banco contém temas ou se serão configuração externa ao catálogo.
- **Status inicial:** **PENDENTE**.

## ActiveStatus

- **Finalidade no MVP:** limitar a seleção às versões comercialmente ativas.
- **Dados mínimos:** regra verificável que classifique `VehicleVersion` como ativa ou inativa.
- **Dados desejáveis:** motivo, vigência, mercado, região, canal e histórico.
- **Obrigatoriedade:** crítica.
- **Risco se ausente:** versões históricas ou indisponíveis podem aparecer como selecionáveis.
- **Contrato relacionado:** `VehicleSearchOption.isActive` e `VehicleVersionSummary.isActive`.
- **Evidência a buscar:** coluna, estado derivado, view, datas ou relacionamento que sustentem a regra, além de validação comercial.
- **Status inicial:** **PENDENTE**.

## VehicleImage

- **Finalidade no MVP:** apoiar identificação visual da versão, caso existam imagens utilizáveis.
- **Dados mínimos:** referência da imagem, versão associada e permissão de uso.
- **Dados desejáveis:** texto alternativo, ordem, variante, dimensões, fonte e atualização.
- **Obrigatoriedade:** opcional e não bloqueante.
- **Risco se ausente:** experiência menos visual, sem impedir seleção ou comparação.
- **Contrato relacionado:** contrato dedicado **PENDENTE**; possível extensão de `VehicleSearchOption` ou `VehicleVersionDetails`.
- **Evidência a buscar:** metadados de imagem, vínculo com versão, acesso de leitura e autorização de uso.
- **Status inicial:** **PENDENTE**.
