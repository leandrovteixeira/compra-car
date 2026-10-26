# Watcher QA Postflight 24A.4

Registro histórico da etapa somente leitura. O piloto foi posteriormente executado
uma única vez na 24A.5B; resultados efetivos e URL autorizada estão em
[WATCHER_QA_PILOT_24A5.md](WATCHER_QA_PILOT_24A5.md). O plano abaixo não autoriza
reexecução, replay de persistência ou reconciliação do histórico SQL.

Data: 2026-10-26. Workspace: `C:/Dev/compra-car-s24`.
Branch: `sprint-24-watcher-local`. Referência: `db9021c2e44438ad4c0857b93da144553eb13110`.
Projeto exclusivo: **shfsjyjxmgwnlexmdkcs**.

## Resultado e proveniência

**Postflight HTTPS: PASS.** Dez tabelas vazias; oito consultas de leitura por RPC
(uma direta pelo SDK e sete pelo adapter) compatíveis; oito assinaturas RPC conferidas
no OpenAPI remoto. Dezenove requisições retornaram HTTP 200, sem erros.
**GO para coleta piloto**, exclusivamente no QA e no escopo manual descrito abaixo,
aguardando autorização específica. Nenhuma coleta foi iniciada.

O responsável informou a aplicação administrativa das migrations, PostgreSQL 17.6,
10 tabelas, 17 funções, 5 triggers, RLS nas dez tabelas, ausência de grants públicos
e de EXECUTE para anon/authenticated, SECURITY INVOKER e privilégios service_role.
Esse postflight SQL é evidência fornecida, não uma nova consulta administrativa nesta etapa.
As leituras HTTPS descritas neste relatório foram efetivamente executadas nesta sessão.

O loader seguro leu exclusivamente `C:/Dev/.secrets/compra-car/staging.env`; a guarda
confirmou a URL/ref QA e as credenciais REST. Nenhuma senha, chave ou connection string
foi impressa ou gravada. Não foi usado PostgreSQL direto, pooler, token Management,
OpenAI, coletor, scheduler ou conexão de produção.

## Evidência HTTPS

Instantâneo: **2026-10-26 14:36:07 BRT / 17:36:07 UTC**. As dez consultas usaram
supabase-js, GET com `select('*', {count:'exact'}).limit(1)`. Em todas houve
`count=0`, resposta `[]`, ausência de erro e HTTP 200. Não foram impressas linhas de dados.

| Tabela                     | HTTP | Contagem | Latência (ms) |
| -------------------------- | ---- | -------- | ------------- |
| watcher_sources            | 200  | 0        | 4145          |
| watcher_source_state       | 200  | 0        | 829           |
| watcher_articles           | 200  | 0        | 510           |
| watcher_feed_items         | 200  | 0        | 528           |
| watcher_candidates         | 200  | 0        | 558           |
| watcher_candidate_evidence | 200  | 0        | 562           |
| watcher_hints              | 200  | 0        | 282           |
| watcher_batches            | 200  | 0        | 488           |
| watcher_batch_items        | 200  | 0        | 273           |
| watcher_article_revisions  | 200  | 0        | 595           |

`watcher_query` é STABLE, retorna jsonb e contém somente SELECTs nas migrations
aprovadas. Foi a única função executada remotamente. Seu POST é uma consulta,
não uma mutação. Os argumentos foram `p_kind`, `p_filter`, `p_limit=1`, `p_offset=0`.
Filtros de identificação inexistente foram usados nas consultas dependentes de IDs.

| Chamada                     | p_kind           | Resultado serializado | HTTP | Latência (ms) |
| --------------------------- | ---------------- | --------------------- | ---- | ------------- |
| SDK rpc direto              | SOURCES          | []                    | 200  | 571           |
| adapter.listSources         | SOURCES          | []                    | 200  | 558           |
| adapter.listArticles        | ARTICLES         | []                    | 200  | 262           |
| adapter.getSourceState      | STATE            | null a partir de []   | 200  | 526           |
| adapter.listRevisions       | REVISIONS        | []                    | 200  | 271           |
| adapter.listSourceItems     | SOURCE_ITEMS     | []                    | 200  | 291           |
| adapter.listSourceRevisions | SOURCE_REVISIONS | []                    | 200  | 247           |
| adapter.listBatches         | BATCHES          | []                    | 200  | 323           |

O OpenAPI PostgREST em `/rest/v1/` retornou HTTP 200 em 942 ms. Foram comparados
nomes e formatos dos parâmetros das oito RPCs públicas usadas pelo adapter; todos
conferem com o SQL aprovado. Nenhum endpoint de mutação foi invocado para descobrir
assinaturas. O transporte da verificação permitiu somente GET das dez tabelas e
OpenAPI, ou POST de watcher_query com tipos de consulta de leitura explicitamente
permitidos. Destino diferente, redirect e outras operações foram bloqueados localmente;
TLS manteve a verificação padrão e houve timeout de 15 segundos por chamada.

Latências: mínimo 247 ms, mediana 526 ms, máximo 4145 ms; primeira requisição 4145 ms.
Não há evidência de falha de schema cache, privilégio, assinatura ou serialização.
Isso comprova exposição e leitura dos objetos pelo servidor, não autenticação de usuários
ou comportamento de escrita. Leituras vazias não exercitam a desserialização de linhas
reais; fixtures não vazias e respostas inválidas são cobertas nos testes locais.

A evidência detalhada, sanitizada, está em `.local-reports/watcher-24a4/https-postflight.json`,
ignorada pelo Git. Este relatório contém os resultados necessários sem depender desse arquivo.

## Matriz adapter ↔ RPCs

Todos os nomes/formats abaixo foram vistos no OpenAPI QA. jsonb é objeto JSON;
bigint/integer são números, com validação de inteiro seguro pelo contrato Core;
uuid/text são strings. Os retornos e dados não vazios foram exercitados com fixtures.

| Método do adapter                                                                                     | RPC / argumentos SQL                                                                                                   | Retorno e validação                                             | Evidência                                                   |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| registerSource (criar/atualizar)                                                                      | watcher_register_source(p_source jsonb, p_settings jsonb, p_expected_version bigint)                                   | jsonb → fonte, settings, configVersion e instantes              | Assinatura remota; mocks de registro e CAS                  |
| claimLease                                                                                            | watcher_claim_source(p_source_id text, p_owner text, p_ttl_seconds integer)                                            | jsonb → lease ou null                                           | Assinatura remota; mocks de token, dono, versões e null     |
| releaseLease                                                                                          | watcher_release_source(p_source_id text, p_token uuid, p_failure_code text)                                            | boolean                                                         | Assinatura remota; mocks de token e erro                    |
| persistBatch                                                                                          | watcher_persist_batch(p_batch_id uuid, p_token uuid, p_config_version bigint, p_state_version bigint, p_payload jsonb) | jsonb → receipt COMMITTED/PARTIAL/FAILED, replayed e checkpoint | Assinatura remota; mocks de payload, fencing e replay       |
| listSources/getSourceState/listArticles/listRevisions/listSourceItems/listSourceRevisions/listBatches | watcher_query(p_kind text, p_filter text, p_limit integer, p_offset integer)                                           | jsonb[] → DTOs; estado ausente → null                           | Assinatura e execução reais; mocks com linhas completas     |
| stageCandidate/listCandidates                                                                         | watcher_stage_candidate(p_candidate jsonb, p_expected_version bigint) / watcher_query(CANDIDATES)                      | candidato versionado e identityKey validado                     | Assinaturas remotas; mocks; bloqueado no executor de coleta |
| attachCandidateEvidence/listCandidateEvidence                                                         | watcher_attach_evidence(p_evidence jsonb) / watcher_query(EVIDENCE)                                                    | evidência e snapshot do candidato                               | Assinaturas remotas; mocks; bloqueado no executor de coleta |
| prepareHint                                                                                           | watcher_prepare_hint(p_candidate_id uuid, p_evidence_id uuid, p_expected_version bigint)                               | hint validado, somente PREPARED                                 | Assinatura remota; mocks; bloqueado no executor de coleta   |

Nenhuma tabela é gravada diretamente pelo adapter: a única capacidade injetada é
`rpc(name,args)`. Cada mutação corresponde a uma transação servidor. O novo teste
`watcher-runtime-contract.test.ts` compara os oito contratos com as declarações SQL,
verifica nomes/tipos/SECURITY INVOKER e exatamente uma chamada RPC por operação.

Proteções auditadas:

- Idempotência: batchId estável, hash do payload e receipt persistido; reenvio preserva
  conteúdo e retorna replay sem avançar o checkpoint antigo. Há advisory lock por batchId.
- Isolamento: itemKey inclui sourceId; filtros de consulta são explícitos. O SQL valida
  que lease, lote, itens e checkpoint pertencem à mesma fonte; o Core rejeita mistura antes da RPC.
- Concorrência: locks de estado/fonte, lease com token e expiração, fencing por versões,
  CAS em configurações/candidatos e ordem canônica dos locks de artigos. Erros de estado,
  lease e CAS viram códigos sanitizados no adapter.
- Evidências/hints: versão do candidato, evidência BR explícita, ator e revisão atual
  são exigidos; não existe handoff ou criação canônica neste procedimento.

Os testes desta etapa são mocks/fixtures e auditoria do SQL, não corridas transacionais
reais em QA. Nenhuma lease foi adquirida, nenhuma fonte registrada e nenhum batch,
candidato, evidência ou hint foi criado remotamente. Corridas PostgreSQL não foram
reexecutadas; a suíte SQL descartável anterior permanece evidência histórica separada.
O primeiro piloto será a primeira validação controlada de escrita via HTTPS.

## Reconciliação das migrations — proposta, NÃO executada

| Artefato aprovado                 | Versão local   | Versão QA informada | SHA-256                                                          |
| --------------------------------- | -------------- | ------------------- | ---------------------------------------------------------------- |
| sprint_24a3a_watcher_storage      | 20261025220424 | 20261026172631      | 0d43e3f5473b08e7b0cb4b2eca30567069c108ecc7946433354997dd80d31e23 |
| sprint_24a3a_watcher_transactions | 20261025220427 | 20261026172646      | 41b2a300a53291b44bfd62dda293a6c31ec2e3b9475361c35e0cf2d3ee9a0f06 |

As versões QA e aplicação são informações fornecidas pelo responsável; esta sessão
não consultou nem alterou a tabela de histórico. Os bytes locais e o manifesto são
conferidos independentemente. O timestamp diferente não implica SQL diferente.

**Recomendação imediata:** preservar arquivos e histórico, manter o mapeamento acima
como registro auditável e seguir com validação/runtime pela API. Não usar `db push`,
`db reset`, `--include-all`, renomear SQL ou gerar cópias/no-op para ocultar a divergência.
O piloto não executa DDL nem depende de sincronizar o histórico.

Para futura adoção de CLI/CI no QA, propor uma janela administrativa separadamente
autorizada, com bloqueio de aplicadores concorrentes, snapshot das quatro versões
envolvidas (existência/ausência), nomes/statements e prova de equivalência por hashes:

1. Validar o projeto QA e a ausência das versões locais no remoto; verificar que as
   duas versões geradas correspondem exatamente aos dois SQL aprovados.
2. Executar, em ambiente administrativo controlado e não neste notebook, o procedimento
   oficial `supabase migration repair`, após conferir `--help` da versão instalada.
   Marcar as duas versões geradas como `reverted` no histórico e as versões originais
   como `applied`. Isso altera somente o registro: não reverte nem reaplica SQL.
3. Registrar cada comando/resultado sanitizado e conferir o histórico final: uma entrada
   por migration, somente com o timestamp original; equivalência de objetos/grants e
   contagens antes/depois. Não executar `db push` dentro desse procedimento.
4. Se houver interrupção, manter a janela bloqueada e reconciliar o estado com o snapshot;
   não tentar reaplicar SQL. Os comandos de repair não formam uma única transação.
   Qualquer restauração de metadados exige revisão própria, não escrita ad hoc na tabela.

Essa proposta não cria infraestrutura SQL operacional nem exige conexão direta do
notebook. Se não houver executor administrativo autorizado compatível, permanecer
na trilha API e manter a adoção da CLI bloqueada. Nada foi reparado nesta etapa.

A Management API de PATCH de migration só documenta `name`/`rollback`, não a versão;
o PUT sem aplicar também não documenta um timestamp alvo. Portanto não há base para
prometer um rename de versão por esses endpoints, nem usar upserts para gerar registros
duplicados. Uma mudança estritamente por API requer primeiro um procedimento suportado
e revisado pelo provedor. Não editar a tabela de histórico por tentativa e erro.

Consequências:

- **CLI:** compara versões dos arquivos com o histórico; um mapeamento documental não
  modifica seu comportamento. Pode recusar o histórico ou considerar SQL local pendente.
  Não autorizar push automático enquanto houver divergência.
- **CI/CD:** exigir um gate QA de histórico/equivalência antes de qualquer aplicação;
  nenhum pipeline foi criado ou alterado agora. Após repair, dry-run/listagem devem mostrar
  as duas como aplicadas. Versões futuras devem ser únicas e posteriores ao estado atual.
- **Management API:** novas aplicações continuam exigindo uma única submissão, ordem,
  hash e reconciliação da versão efetiva; não repetir migrations já aplicadas. Até decidir
  uma fonte única de versionamento, registrar sourceVersion → remoteVersion por ambiente.
- **Produção:** intocada e fora desta proposta de execução. Não inferir estado por analogia.

Fontes oficiais: [tracking e repair](https://supabase.com/docs/guides/deployment/database-migrations),
[CLI repair](https://supabase.com/docs/reference/cli/supabase-migration-repair),
[PATCH histórico](https://supabase.com/docs/reference/api/v1-patch-a-migration),
[PUT sem aplicar](https://supabase.com/docs/reference/api/v1-upsert-a-migration).

## Plano da primeira coleta piloto — NÃO executado

Uma fonte, uma execução manual no QA, sem OpenAI, scheduler, handoff, candidatos,
hints ou escrita em veículos canônicos. Preferência: **Motor1 Brasil**.
ID proposto: `motor1-br-pilot`; editorialMarket `BR`, idioma `pt-BR`, sourceRank `1`.
Endpoint candidato: `https://br.motor1.com/rss/news/all/`, **hipótese não verificada**.
Não foi feita requisição RSS nesta etapa; não substituir pelo feed global em inglês.
A URL e o uso da fonte precisam ser confirmados no início do piloto autorizado.

Procedimento manual proposto:

1. Obter autorização específica contendo fonte/URL, janela e limite de uma execução.
   Revalidar o loader/destino QA, contagens e ausência de outro coletor ativo. Não rodar
   o preflight de instalação 24A.3b: objetos presentes são esperados após o deployment.
2. Registrar somente essa fonte por `registerSource`, com `requestUrl` exato (incluindo
   barra final), allowedHosts/allowedArticleHosts somente `br.motor1.com`, URLs relativas
   desabilitadas e configuração versionada. Não ampliar allowlists em caso de falha.
3. Consultar o estado e adquirir uma lease pelo executor QA, TTL proposto 120 s (máximo
   aceito 300 s). Usar as versões/token retornados, batchId e observedAt únicos e estáveis.
   Lease ocupada/configuração divergente encerram a execução; não criar loop de polling.
4. Usar `nodeWatcherFeedNetwork` + `createWatcherFeedTransport`, concorrência 1/host,
   timeout 15 s e até 2 MiB, seguidos de `ingestWatcherFeed`; parser limitado a 100 itens.
   Fazer somente o GET do feed, sem páginas de artigos/imagens, redirects ou fontes extras.
   Em 429/503 ou falha, registrar e terminar, sem scheduler/retry de coleta automático.
5. Preservar evidências e deduplicação determinísticas. Falha, conflito, item rejeitado,
   truncamento ou lease vencida bloqueiam o avanço de checkpoint. Para este piloto,
   interromper antes da persistência em vez de aceitar lote parcial silenciosamente.
6. Se íntegro, usar uma única `persistBatch` transacional com token/configVersion/stateVersion.
   Em resposta perdida, consultar receipt/estado e revisar o outcome; eventual reenvio
   deve reutilizar o mesmo batchId/payload, nunca buscar o RSS novamente para reconstruí-lo.
7. Ler receipt, fonte, artigos/revisões e métricas; liberar a lease em encerramento.
   Desabilitar a fonte por atualização CAS somente depois da liberação, se aprovado
   na mesma autorização. Nenhum outro consumidor é ativado.
8. Encerrar e apresentar o resultado. Não disparar Brand Connector ou uma segunda coleta.

Métricas e custo propostos:

| Métrica              | Definição                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| recebidos            | entries/items encontrados no XML; items válidos + rejeitados quando não truncado; em truncamento registrar limite inferior e flag, sem inventar total                   |
| válidos / rejeitados | resultado do parser e diagnósticos; contar antes da projeção                                                                                                            |
| novos / duplicados   | newItems e unchangedItems; related mede pares de similaridade separadamente, não somar como número de artigos                                                           |
| revisões             | updatedItems e delta de history; distinguir nova evidência de reversão para uma evidência já vista                                                                      |
| persistência         | batchId, status, replayed, checkpointAdvanced e stateVersion, sem tokens                                                                                                |
| transporte           | HTTP, latência, bytes do feed, timeout/retryAfter, erros sanitizados                                                                                                    |
| OpenAI               | 0 chamadas, 0 tokens, custo LLM incremental 0                                                                                                                           |
| infraestrutura       | requisições HTTPS/RPC, bytes transferidos e delta de armazenamento multiplicados pelos preços marginais do plano; valores monetários PENDENTES, sem presumir gratuidade |

O contador bruto não é exposto por `ingestWatcherFeed`; no futuro runner, registrar
o resumo do mesmo XML/resultado do parser, sem novo fetch nem mudança na persistência.
Não há novo CLI coletor ativado nesta entrega. O plano usa os componentes existentes;
a montagem do runner manual e a execução exigem a autorização seguinte.

## Validações locais, bloqueios e limites

- PASS: 334 testes direcionados únicos — 66 adapter/segurança/Management/contratos,
  135 Core Watcher e 133 transporte/parser/ingestão/loader/plano.
- O novo teste contém 12 casos. O erro inicial de lint de parâmetros não usados foi
  corrigido nesse teste; nenhuma regra de lint foi desativada.
- PASS: typecheck global, build global e typecheck final do adapter após o ajuste do teste.
- PASS: ESLint do teste alterado, Prettier dos arquivos alterados e `git diff --check`.
- Falhas globais preexistentes, separadas do escopo Watcher: lint Web com 51 warnings
  e limite zero; seis testes Core falhando/1233 passando; format:check com 782 arquivos.
  O lint final passou em oito tarefas e falhou apenas em Web. Nenhum desses arquivos
  de aplicação/Core foi alterado para ocultar as falhas.
- Execução real de mutações, concorrência SQL real, população/desserialização remota de
  linhas e custo marginal medido são limites intencionais desta validação somente leitura.
- Reconciliação de histórico: PENDENTE para futura CLI/CI administrativa; não executada
  e não necessária para um piloto de dados por RPC sobre o esquema já aplicado.
- Endpoint Motor1 Brasil: PENDENTE de confirmação dentro da autorização do piloto.
- Autorização para a coleta: PENDENTE; este relatório não autoriza nenhum dado remoto.

Nenhuma migration adicional, alteração de RLS/grants, escrita remota, coleta, chamada
OpenAI, deploy, modificação de Legacy, commit ou push foi realizado nesta Sprint 24A.4.
