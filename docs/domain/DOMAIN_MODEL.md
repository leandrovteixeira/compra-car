# Modelo de Domínio Conceitual

Este documento descreve o domínio de negócio sem reproduzir o schema do Supabase atual. Nomes, campos e cardinalidades físicas dependem de auditoria e estão **PENDENTE**.

## Brand

- **Definição:** fabricante ou marca comercial do veículo.
- **Finalidade:** organizar o catálogo, a busca e a personalização visual.
- **Exemplos:** uma marca comercial de automóveis; exemplos reais dependem do catálogo auditado.
- **Relacionamentos:** agrupa `Model` e pode possuir um `BrandTheme`.
- **Dúvidas pendentes:** **PENDENTE:** distinguir fabricante, grupo econômico e marca comercial.
- **Legado:** **PENDENTE:** auditar como marcas são identificadas e normalizadas na fonte atual.

## Model

- **Definição:** família comercial de veículos oferecida por uma `Brand`.
- **Finalidade:** agrupar gerações e versões reconhecidas comercialmente como o mesmo modelo.
- **Exemplos:** uma linha comercial com versões diferentes; exemplos reais dependem do catálogo auditado.
- **Relacionamentos:** pertence a uma `Brand` e pode conter `Generation` e `VehicleVersion`.
- **Dúvidas pendentes:** **PENDENTE:** definir o tratamento de nomes reutilizados e variantes de carroceria.
- **Legado:** **PENDENTE:** verificar duplicidades, grafias e nível de granularidade do modelo atual.

## Generation

- **Definição:** geração técnica ou comercial de um `Model`.
- **Finalidade:** separar mudanças estruturais relevantes dentro da história de um modelo.
- **Exemplos:** geração anterior e geração atual de uma mesma família comercial.
- **Relacionamentos:** pertence a um `Model` e pode conter `Facelift` e `VehicleVersion`.
- **Dúvidas pendentes:** **PENDENTE:** confirmar se geração será necessária para busca e comparação no MVP.
- **Legado:** **PENDENTE:** identificar se a fonte atual representa gerações explicitamente.

## Facelift

- **Definição:** atualização relevante ocorrida dentro de uma `Generation`, sem necessariamente criar uma nova geração.
- **Finalidade:** distinguir alterações de design, equipamentos ou especificações dentro da mesma geração.
- **Exemplos:** configuração anterior e posterior a uma atualização de meio de ciclo.
- **Relacionamentos:** pertence a uma `Generation` e pode agrupar `VehicleVersion`.
- **Dúvidas pendentes:** **PENDENTE:** definir os critérios que distinguem facelift, ano-modelo e nova geração.
- **Legado:** **PENDENTE:** verificar se essa informação existe ou deverá ser inferida durante a auditoria.

## VehicleVersion

- **Definição:** configuração comercial específica disponível para comparação.
- **Finalidade:** representar a unidade selecionável pelo vendedor no MVP.
- **Exemplos:** uma combinação comercial de modelo, versão, motorização e ano-modelo.
- **Relacionamentos:** pertence a `Brand` e `Model`, pode se relacionar a `Generation`, `Facelift`, anos, propulsão, preços, equipamentos, especificações e políticas.
- **Dúvidas pendentes:** **PENDENTE:** definir a chave de identidade e os critérios exatos de versão ativa.
- **Legado:** **PENDENTE:** mapear identificadores, duplicidades e registros ativos sem acoplar o domínio ao schema atual.

### Existência da versão versus disponibilidade no catálogo

`VehicleVersion` representa uma configuração comercial. Uma versão pode existir historicamente sem estar ativa ou disponível para seleção no momento atual. O catálogo selecionável do MVP deve conter somente versões consideradas ativas após validação dos dados e do contexto comercial.

Uma representação futura pode exigir uma entidade como `CatalogEntry` ou `VehicleOffering` para separar a identidade histórica da versão de sua oferta em determinado mercado, período ou canal. Essa entidade não é uma decisão definitiva e não deve ser criada antes da auditoria.

## ProductionYear

- **Definição:** ano de fabricação física de uma unidade ou configuração.
- **Finalidade:** evitar confusão entre fabricação e posicionamento comercial por ano-modelo.
- **Exemplos:** ano de produção anterior ao `ModelYear` em uma configuração comercial.
- **Relacionamentos:** qualifica uma `VehicleVersion` ou uma oferta, conforme o modelo auditado.
- **Dúvidas pendentes:** **PENDENTE:** confirmar se o catálogo atual representa ano de produção por versão ou por unidade.
- **Legado:** **PENDENTE:** auditar formato, completude e possíveis campos combinados de ano.

A representação física como entidade, value object ou atributo de `VehicleVersion` permanece **PENDENTE** e será decidida após auditoria.

## ModelYear

- **Definição:** ano-modelo usado comercialmente para caracterizar o veículo.
- **Finalidade:** permitir busca e diferenciação de versões que mudam entre ciclos comerciais.
- **Exemplos:** ano-modelo posterior ao ano de fabricação.
- **Relacionamentos:** qualifica `VehicleVersion`, preços, equipamentos e especificações quando houver variação temporal.
- **Dúvidas pendentes:** **PENDENTE:** definir como representar intervalos e combinações de anos.
- **Legado:** **PENDENTE:** verificar se produção e ano-modelo estão separados na fonte atual.

A representação física como entidade, value object ou atributo de `VehicleVersion` permanece **PENDENTE** e será decidida após auditoria.

## Powertrain

- **Definição:** conjunto de componentes responsáveis por gerar e transmitir força para movimentar o veículo.
- **Finalidade:** representar de forma unificada configurações a combustão, elétricas, híbridas ou outras.
- **Exemplos:** conjunto a combustão; conjunto elétrico; conjunto híbrido.
- **Relacionamentos:** pode combinar `Engine`, `ElectricMotor`, `Transmission` e `Drivetrain` e equipar uma `VehicleVersion`.
- **Dúvidas pendentes:** **PENDENTE:** definir taxonomia de tecnologias e combinações suportadas.
- **Legado:** **PENDENTE:** auditar se os componentes estão separados ou descritos em texto livre.

## Engine

- **Definição:** motor a combustão de um `Powertrain`, quando aplicável.
- **Finalidade:** organizar atributos técnicos próprios da combustão.
- **Exemplos:** motor aspirado ou sobrealimentado; combustível e valores concretos dependem dos dados auditados.
- **Relacionamentos:** compõe um `Powertrain` e possui valores de `Specification`.
- **Dúvidas pendentes:** **PENDENTE:** definir identificação, combustíveis e unidades canônicas.
- **Legado:** **PENDENTE:** verificar consistência das descrições e especificações do motor.

## ElectricMotor

- **Definição:** motor elétrico de um `Powertrain`, quando aplicável.
- **Finalidade:** representar propulsão elétrica sem forçá-la ao modelo de motor a combustão.
- **Exemplos:** um ou mais motores elétricos em diferentes eixos.
- **Relacionamentos:** compõe um `Powertrain` e possui valores de `Specification`.
- **Dúvidas pendentes:** **PENDENTE:** definir como representar múltiplos motores e potência combinada.
- **Legado:** **PENDENTE:** auditar disponibilidade e granularidade dos dados elétricos.

## Transmission

- **Definição:** sistema que transmite ou gerencia a entrega de força do conjunto de propulsão.
- **Finalidade:** permitir comparação do tipo e das características da transmissão.
- **Exemplos:** manual, automática ou outra configuração tecnicamente aplicável.
- **Relacionamentos:** compõe um `Powertrain` associado à `VehicleVersion`.
- **Dúvidas pendentes:** **PENDENTE:** definir taxonomia e tratamento de veículos sem transmissão convencional.
- **Legado:** **PENDENTE:** normalizar descrições e evitar inferências não confirmadas.

## Drivetrain

- **Definição:** configuração de tração que indica como a força chega às rodas.
- **Finalidade:** comparar a arquitetura de tração das versões.
- **Exemplos:** tração em um eixo ou em mais de um eixo.
- **Relacionamentos:** integra o `Powertrain` ou qualifica diretamente a `VehicleVersion`.
- **Dúvidas pendentes:** **PENDENTE:** definir catálogo de valores e variações acionáveis.
- **Legado:** **PENDENTE:** verificar formatos, abreviações e dados ausentes.

## Specification

- **Definição:** característica técnica mensurável ou descritiva que pode ser comparada.
- **Finalidade:** formar linhas comparáveis com significado, tipo e unidade conhecidos.
- **Exemplos:** dimensão, capacidade, desempenho ou descrição técnica; valores concretos dependem da fonte.
- **Relacionamentos:** define um item cujo valor se associa a `VehicleVersion` e pode originar `ComparisonItem`.
- **Dúvidas pendentes:** **PENDENTE:** definir catálogo, tipos, unidades, precisão e regras de equivalência.
- **Legado:** **PENDENTE:** auditar nomes, unidades, traduções e valores armazenados como texto.

## Equipment

- **Definição:** item que pode ser de série, opcional, indisponível, não aplicável ou não informado em uma versão.
- **Finalidade:** permitir comparação de conteúdo e disponibilidade sem confundir ausência de dado com ausência do item.
- **Exemplos:** item de segurança, conforto, conectividade ou conveniência.
- **Relacionamentos:** pertence a uma `EquipmentCategory` e recebe um `EquipmentValue` por `VehicleVersion`.
- **Dúvidas pendentes:** **PENDENTE:** definir catálogo canônico, sinônimos, opcionais e pacotes.
- **Legado:** **PENDENTE:** normalizar itens, categorias, traduções e estados encontrados na carga atual.

## EquipmentCategory

- **Definição:** categoria de agrupamento de `Equipment` para organização e apresentação.
- **Finalidade:** facilitar leitura, navegação e ordenação da comparação.
- **Exemplos:** segurança, conforto ou conectividade; taxonomia final está **PENDENTE**.
- **Relacionamentos:** agrupa vários `Equipment` e pode formar uma seção da comparação.
- **Dúvidas pendentes:** **PENDENTE:** definir categorias, ordem e possibilidade de subcategorias.
- **Legado:** **PENDENTE:** auditar categorias existentes e itens sem classificação.

## EquipmentValue

- **Definição:** valor ou estado de um `Equipment` em uma `VehicleVersion`.
- **Finalidade:** representar a condição comercial e a qualidade da informação com semântica explícita.
- **Exemplos:** de série; opcional; disponível apenas em pacote; indisponível; não aplicável; não informado; não encontrado; desatualizado; conflitante; ou um valor tipado quando necessário.
- **Relacionamentos:** associa `Equipment` a `VehicleVersion` e pode compor um `ComparisonItem`.
- **Dúvidas pendentes:** **PENDENTE:** definir tipos permitidos, identificação de pacotes, custos e regras comerciais dos opcionais.
- **Legado:** **PENDENTE:** mapear valores atuais sem converter automaticamente vazios em ausência.

Um equipamento opcional não equivale a um equipamento de série. Da mesma forma, disponibilidade apenas em pacote deve permanecer distinta de disponibilidade opcional individual.

## Price

- **Definição:** preço associado a uma `VehicleVersion` e a uma data de referência.
- **Finalidade:** permitir comparação monetária contextualizada no tempo.
- **Exemplos:** preço de referência de uma versão em determinada data; origem e natureza estão **PENDENTE**.
- **Relacionamentos:** pertence a uma `VehicleVersion`, possui `DataSource` e `DataFreshness` e pode se relacionar a `CommercialPolicy`.
- **Dúvidas pendentes:** **PENDENTE:** moeda, natureza do preço, impostos, localidade e critérios de vigência.
- **Legado:** **PENDENTE:** auditar múltiplos preços, datas, formatos e fontes.

## CommercialPolicy

- **Definição:** política comercial vigente em determinado contexto e período.
- **Finalidade:** apresentar condições comerciais comparáveis quando houver dados confiáveis e viabilidade técnica.
- **Exemplos:** condição aplicável a uma versão, região, canal ou período; detalhes reais estão **PENDENTE**.
- **Relacionamentos:** pode se aplicar a `VehicleVersion` e `Price`, com origem e vigência explícitas.
- **Dúvidas pendentes:** **PENDENTE:** escopo, elegibilidade, vigência, precedência e dados sensíveis.
- **Legado:** **PENDENTE:** auditar estrutura, qualidade, permissões e possibilidade de exposição no MVP.

## Comparison

- **Definição:** comparação solicitada entre 2 ou 3 `VehicleVersion`.
- **Finalidade:** reunir contexto, modo de exibição, resultados e informações de qualidade.
- **Exemplos:** comparação de duas versões; comparação de três versões.
- **Relacionamentos:** contém versões selecionadas, vários `ComparisonItem`, referências às `AdvantageRule` aplicadas e resultados de `Advantage`.
- **Dúvidas pendentes:** **PENDENTE:** persistência, validade, compartilhamento e identificação de sessão.
- **Legado:** não deve depender de nomes ou estruturas físicas do banco atual.

## ComparisonItem

- **Definição:** linha semântica comparável entre os veículos selecionados.
- **Finalidade:** alinhar valores equivalentes e indicar diferença, disponibilidade e qualidade.
- **Exemplos:** uma especificação, um equipamento, um preço ou uma política comparável.
- **Relacionamentos:** pertence a uma `Comparison`, referencia um conceito comparável, contém um valor por veículo e pode ser avaliado por uma `AdvantageRule` para produzir `Advantage`.
- **Dúvidas pendentes:** **PENDENTE:** ordenação, agrupamento, equivalência, formatação e tolerâncias.
- **Legado:** deve ser produzido pelo adaptador e pelos serviços, não refletir diretamente registros legados.

## AdvantageRule

- **Definição:** regra explícita, versionada e auditável aplicada a um `ComparisonItem` para avaliar vantagem.
- **Finalidade:** separar o critério de avaliação do resultado produzido e permitir revisão, justificativa e rastreabilidade.
- **Exemplos:** maior é melhor; menor é melhor; presença de série é melhor; regra específica para o contexto; não avaliar automaticamente.
- **Relacionamentos:** avalia um `ComparisonItem` e produz um ou mais resultados `Advantage` para as `VehicleVersion` comparadas.
- **Dúvidas pendentes:** **PENDENTE:** definir catálogo, unidade, tolerância, contexto, versão, justificativa e responsável ou origem de cada regra.
- **Legado:** **PENDENTE:** auditar regras existentes e evitar inferências baseadas apenas em posição, vazio ou convenção não documentada.

Uma `AdvantageRule` pode precisar de unidade, tolerância, contexto, versão, justificativa e responsável ou origem. Quando não houver regra confiável, a estratégia deve ser não avaliar automaticamente.

## Advantage

- **Definição:** resultado da aplicação de uma `AdvantageRule` que indica vantagem de um veículo em determinado item.
- **Finalidade:** transformar valores comparáveis em um sinal auditável de vantagem, desvantagem, empate ou impossibilidade de comparação.
- **Exemplos:** maior valor é melhor; menor valor é melhor; presença é melhor, apenas quando uma regra aprovada determinar isso.
- **Relacionamentos:** pertence a um `ComparisonItem` e a uma ou mais `VehicleVersion`, mantendo referência à `AdvantageRule` aplicada.
- **Dúvidas pendentes:** **PENDENTE:** catálogo, prioridade, contexto e versionamento das regras.
- **Legado:** nunca deve ser inferida apenas de vazio, posição de coluna ou convenção não auditada.

## Translation

- **Definição:** rótulo de apresentação em português ou outro idioma para um conceito do catálogo.
- **Finalidade:** separar termos exibidos da lógica bruta de comparação.
- **Exemplos:** rótulo e descrição amigável de uma especificação ou equipamento.
- **Relacionamentos:** pode rotular entidades e valores de catálogo na camada de apresentação.
- **Dúvidas pendentes:** **PENDENTE:** idiomas, fallback, governança e revisão dos textos.
- **Legado:** **PENDENTE:** auditar traduções existentes e evitar que rótulos controlem regras de negócio.

## DataSource

- **Definição:** origem identificável de uma informação.
- **Finalidade:** permitir rastreabilidade, auditoria e avaliação de confiança.
- **Exemplos:** carga controlada de uma planilha ou outra fonte oficializada; a identificação concreta está **PENDENTE**.
- **Relacionamentos:** qualifica preços, equipamentos, especificações, políticas e outros dados apresentados.
- **Dúvidas pendentes:** **PENDENTE:** granularidade, prioridade entre fontes e metadados obrigatórios.
- **Legado:** **PENDENTE:** verificar quais dados preservam sua origem e quais precisam de reconciliação.

## DataFreshness

- **Definição:** informação sobre atualização, referência, validade ou defasagem de um dado.
- **Finalidade:** permitir que usuário e sistema avaliem se um valor ainda é adequado para uso.
- **Exemplos:** data de referência, instante da última atualização ou período de vigência.
- **Relacionamentos:** acompanha dados provenientes de `DataSource`, como `Price` e `CommercialPolicy`.
- **Dúvidas pendentes:** **PENDENTE:** limites de defasagem, fusos horários e regras por tipo de dado.
- **Legado:** **PENDENTE:** auditar datas disponíveis e não inventar atualização quando ela não puder ser comprovada.

## BrandTheme

- **Definição:** configuração visual usada para personalizar a experiência para uma marca.
- **Finalidade:** adaptar cores, recursos e textos sem alterar a lógica da aplicação.
- **Exemplos:** paleta, logotipo autorizado e tokens visuais; itens concretos estão **PENDENTE**.
- **Relacionamentos:** pode ser associado a uma `Brand` e consumido pela camada de apresentação.
- **Dúvidas pendentes:** **PENDENTE:** ativos autorizados, fallback, contraste e governança.
- **Legado:** não deve depender do modelo de dados legado nem implicar vínculo oficial sem autorização.

## Estados possíveis de informação

Os estados abaixo têm significados distintos e devem permanecer explícitos:

- **possui:** a fonte confirma que o item está presente ou que o valor está disponível;
- **não possui:** a fonte confirma que o item não está presente;
- **não se aplica:** o conceito não é aplicável à versão ou tecnologia avaliada;
- **não informado:** a origem foi consultada, mas não forneceu a informação;
- **informação não encontrada:** o processo não localizou um registro confiável para o conceito;
- **dado desatualizado:** existe informação, mas ela ultrapassou o critério de atualidade aplicável;
- **dado conflitante:** duas ou mais informações relevantes não puderam ser reconciliadas.

Esses estados não podem ser todos convertidos para `null`. Essa conversão eliminaria diferenças essenciais, poderia criar falsas desvantagens e impediria a rastreabilidade da qualidade dos dados.

## Regras conceituais

- Uma comparação contém exatamente 2 ou 3 versões.
- Apenas versões ativas podem ser selecionadas no MVP.
- Mostrar diferenças depende de comparação semântica dos valores, incluindo tipo, unidade, normalização e estado de disponibilidade.
- Uma vantagem deve resultar de uma `AdvantageRule` conhecida, explícita, versionada e auditável.
- `AdvantageRule` é o critério aplicado; `Advantage` é o resultado dessa aplicação.
- Uma `AdvantageRule` pode usar estratégias como maior é melhor, menor é melhor, presença de série é melhor, regra específica ou não avaliar automaticamente.
- Regras podem exigir unidade, tolerância, contexto, versão, justificativa e responsável ou origem.
- Ausência de dado não significa desvantagem.
- Todo preço precisa ter uma data de referência.
- Toda política comercial precisa ter vigência e contexto aplicável.
- Todo equipamento deve possuir um tipo de dado definido.
- Tradução pertence à camada de apresentação ou catálogo, não à lógica bruta do comparador.
- O tema da marca não pode implicar vínculo oficial sem autorização.
- Diferença e vantagem são conceitos separados: valores podem ser diferentes sem que exista uma regra de vantagem.
- Dados conflitantes, desatualizados ou não comparáveis devem ser apresentados como tal, sem inferência silenciosa.

## Questões em aberto

- **PENDENTE:** confirmar a chave conceitual de uma versão e a definição de ativo.
- **PENDENTE:** definir taxonomias de marca, modelo, geração, facelift, carroceria e propulsão.
- **PENDENTE:** confirmar como anos de produção e ano-modelo são representados.
- **PENDENTE:** definir catálogo, tipos, unidades e equivalências de especificações.
- **PENDENTE:** definir catálogo, categorias, estados, opcionais e pacotes de equipamentos.
- **PENDENTE:** definir natureza, moeda, referência e atualização dos preços.
- **PENDENTE:** confirmar viabilidade, permissões, vigência e estrutura das políticas comerciais.
- **PENDENTE:** definir o catálogo de `AdvantageRule`, suas estratégias, versões, tolerâncias, justificativas e responsáveis.
- **PENDENTE:** definir critérios de atualidade e resolução de conflitos por tipo de dado.
- **PENDENTE:** definir rastreabilidade mínima das fontes.
- **PENDENTE:** definir traduções, categorias e ordenação para apresentação.
- **PENDENTE:** confirmar persistência e compartilhamento das comparações.
- **PENDENTE:** auditar o banco atual e mapear o adaptador sem levar nomes físicos aos contratos.
- **PENDENTE:** confirmar a identidade visual autorizada para o piloto.
