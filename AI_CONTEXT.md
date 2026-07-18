# Contexto para agentes de IA

## Propósito do sistema

Apoiar a venda consultiva de veículos por meio de comparações claras, focadas nas diferenças e vantagens relevantes para o cliente.

## Público-alvo

Vendedores de concessionárias.

## Problema resolvido

O sistema deverá reduzir o esforço necessário para comparar veículos durante o atendimento e gerar um material compartilhável com informações consistentes.

## Escopo do MVP

- experiência mobile-first;
- operação com os dados já existentes no Supabase atual e disponibilização de todas as versões ativas de veículo encontradas, sem limitar o MVP a poucos veículos fictícios;
- nenhuma nova carga do Excel ou reestruturação ampla do banco como pré-requisito para o MVP;
- comparação de 2 ou 3 veículos;
- pesquisa e filtros para localizar versões ativas de veículo;
- exibição apenas das diferenças;
- opção para mostrar todos os itens;
- filtro para mostrar somente vantagens;
- comparação dos equipamentos, especificações e preços disponíveis;
- comparação de políticas comerciais, condicionada à viabilidade técnica e à auditoria do banco atual;
- geração e compartilhamento de PDF;
- geração e compartilhamento de PDF inicialmente incorporados ao fluxo de comparação, sem exigir rota própria;
- aviso legal;
- identidade visual flexível por marca.

## Tecnologias previstas

- Next.js e TypeScript para o frontend;
- Supabase atual como fonte inicial de dados;
- Appsmith como backoffice temporário;
- Railway para publicação;
- GitHub como fonte autoritativa de código e documentação;
- OneDrive para sincronização entre computadores.

Versões, bibliotecas auxiliares e ferramentas de testes estão **PENDENTE**.

## Arquitetura transitória

- Appsmith → operação interna;
- Supabase atual → dados;
- Next.js → experiência do vendedor;
- Railway → publicação;
- Adaptador Legacy → isolamento entre o frontend e o banco atual.

## Arquitetura futura

- Novo backoffice → operação interna;
- Supabase V2 → dados;
- Next.js → experiência do vendedor;
- Railway → publicação;
- Adaptador V2 → acesso ao novo modelo canônico.

## Decisões já tomadas

- A Fase 1 começa pela inspeção mínima e somente leitura do Supabase atual.
- O banco atual é a fonte inicial do MVP e não será alterado durante esta inspeção.
- A inspeção usará metadados para descobrir a superfície real antes de validar consultas de perfil com dados existentes.
- Nenhuma alteração estrutural, migration ou correção de dados será executada nesta etapa.
- Os resultados da inspeção permanecem **PENDENTE** até a execução manual e controlada dos scripts preparados.
- O MVP será mobile-first.
- A comparação aceitará 2 ou 3 veículos.
- A interface exibirá apenas as diferenças.
- Haverá filtro para mostrar apenas vantagens.
- O sistema gerará e permitirá compartilhar PDF.
- A aplicação e o PDF incluirão aviso legal.
- A identidade visual será flexível por marca.
- A aplicação não deverá aparentar vínculo oficial com montadoras sem autorização.
- O banco atual será utilizado inicialmente.
- O catálogo pode conter modelos ativos, mas a unidade selecionável e comparável do MVP é uma `VehicleVersion` ativa.
- O MVP consumirá diretamente os dados já existentes no Supabase atual e disponibilizará todas as versões ativas encontradas.
- A existência histórica de uma versão não comprova sua disponibilidade comercial ativa.
- Nenhuma alteração estrutural ampla do banco é pré-requisito para a UI, o MVP ou o piloto.
- Nenhuma nova carga do Excel é pré-requisito para a UI, o MVP ou o piloto.
- O importador Excel será ajustado posteriormente para respeitar a estrutura vigente do Supabase atual.
- Correções de dados, normalizações, melhorias arquiteturais e evolução do importador ocorrerão gradualmente após o MVP e o piloto.
- O frontend permanecerá isolado do legado por contratos normalizados e adaptadores durante essa evolução.
- O Appsmith permanecerá como backoffice temporário.
- O Next.js será o frontend.
- O Railway será usado para publicação.
- O GitHub será a fonte autoritativa.
- O OneDrive será usado para mobilidade entre computadores.
- O frontend será isolado do banco por contratos e adaptadores.
- A fundação anterior à implementação do Next.js é documentada em `docs/product/PRODUCT_SPEC.md`, `docs/domain/DOMAIN_MODEL.md`, `docs/contracts/CONTRACTS.md` e `docs/ui/UI_FLOW.md`.
- Estados de dados ausentes, não aplicáveis, não encontrados, desatualizados ou conflitantes devem permanecer explícitos.
- Diferença e vantagem são conceitos separados; vantagem depende de regra conhecida e auditável.
- `AdvantageRule` representa conceitualmente a regra explícita, versionada e auditável; `Advantage` é o resultado de sua aplicação.
- Equipamentos distinguem os estados de série, opcional, disponível apenas em pacote, indisponível, não aplicável, não informado, não encontrado, desatualizado e conflitante.
- A geração de PDF será inicialmente um modal, painel inferior ou estado incorporado à comparação; uma rota independente é evolução futura condicionada a novas necessidades.
- A comparação e o PDF devem manter referência à carga ou snapshot utilizado, à fonte e à atualização quando essas informações estiverem disponíveis.
- A primeira versão deverá ser colocada no ar rapidamente.
- Após o MVP, será feita uma auditoria completa e criado o Supabase V2.

## Restrições

- Não alterar `Legacy` sem autorização e auditoria.
- Manter a inspeção inicial do Supabase estritamente somente leitura.
- Não tratar hipótese histórica ou documental como estrutura atual sem evidência do banco.
- Não expor chaves, senhas ou segredos.
- Não acoplar componentes de interface diretamente às tabelas legadas.
- Não presumir detalhes técnicos ainda não confirmados.
- Preservar a abordagem mobile-first.

## Riscos conhecidos

- estrutura e qualidade do banco atual ainda não auditadas;
- regras de comparação ainda não formalizadas;
- dependência temporária do Appsmith e do modelo legado;
- risco de acoplamento ao banco atual sem contratos estáveis;
- texto legal e permissões de identidade de marca ainda não validados;
- sincronização pelo OneDrive exige cuidado com conflitos de arquivos.

## Estado atual

Em 2026-07-18, foi criada a estrutura inicial do Engineering Hub. A aplicação Next.js ainda não foi criada, o Supabase não foi conectado e nenhuma dependência foi instalada.

Foram criados os quatro documentos de fundação do produto: especificação do produto, modelo de domínio, contratos conceituais e fluxo de interface mobile-first. A implementação do Next.js ainda não foi executada. Uma nova carga do Excel não é necessária para iniciar ou concluir o MVP.

A Fase 1 foi iniciada com a preparação da inspeção mínima e somente leitura do Supabase atual. Foram preparados o plano, os requisitos de dados, o mapa do legado, o registro de resultados e consultas de inventário. Nenhuma consulta foi executada e os resultados permanecem **PENDENTE**. O Legacy Supabase Adapter e o frontend ainda não foram iniciados.

## Próximos passos

1. Revisar e aprovar o Engineering Hub.
2. Confirmar o estado do repositório Git e do remoto.
3. Identificar a próxima atividade aplicável em `ROADMAP_MASTER.md`.
4. Revisar e aprovar `PRODUCT_SPEC.md`, `DOMAIN_MODEL.md`, `CONTRACTS.md` e `UI_FLOW.md` antes de criar o Next.js.
5. Revisar os artefatos de inspeção somente leitura preparados em `docs/data/` e `supabase/inspection/`.
6. Executar manualmente os inventários aprovados no ambiente confirmado e registrar resultados sanitizados.
7. Mapear o Legacy Supabase Adapter a partir das evidências encontradas.
8. Validar os contratos normalizados com os dados reais existentes.
9. Implementar a UI sobre os contratos, sem acesso direto às estruturas legadas.
10. Concluir o MVP e executar o piloto.
11. Após o piloto, planejar correções graduais e ajustar o importador Excel à estrutura vigente.

## Pendências

- **PENDENTE:** validar regras e critérios de comparação.
- **PENDENTE:** definir o texto do aviso legal.
- **PENDENTE:** selecionar três veículos-piloto.
- **PENDENTE:** confirmar a marca piloto, os modelos do catálogo e a lista completa de versões ativas.
- **PENDENTE:** definir, após o piloto, a evolução do importador Excel e o processo seguro para cargas futuras.
- **PENDENTE:** confirmar identidade visual provisória e permissões de marca.
- **PENDENTE:** auditar o Supabase atual e seus controles de acesso.
- **PENDENTE:** executar os scripts de inspeção aprovados e preencher `SUPABASE_INSPECTION_RESULTS.md`.
- **PENDENTE:** definir versões e ferramentas do frontend quando sua criação for autorizada.
