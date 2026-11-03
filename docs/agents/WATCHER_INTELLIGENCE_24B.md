# Watcher 24B — arquitetura e inventário de reutilização

Base oficial local: `8f31a447ed4ad0716a5af3bc0d5d10a4aeb53fc2`, branch
`sprint-24-watcher-local`. Worktree inicialmente limpo. Essa base inclui o commit
final da 24A publicado e o piloto QA validado; `main` não foi usado como baseline.
Lidos os documentos de entrada e os contratos, serviços, testes e SQLs relevantes.

## Atualização 24B.4A

A extensão transacional foi posteriormente autorizada e implementada somente
localmente. O bloqueio arquitetural histórico abaixo foi tratado pelo draft e
pelos testes descritos em [WATCHER_ATOMIC_INTELLIGENCE_24B4A.md](WATCHER_ATOMIC_INTELLIGENCE_24B4A.md).
A aplicação remota, ativação do writer e análise dos vinte artigos continuam
pendentes de autorização própria. As seções seguintes registram a fundação 24B.

## Escopo e decisão desta entrega

Proposta apresentada antes da implementação: evolução aditiva no Core, sem trocar
o pipeline ou criar persistência paralela. Implementação local das fundações
24B.1–24B.3 e planejamento da 24B.4; **Sprint 24B completa permanece PENDENTE**.
O pedido limita o avanço a trabalho sem operação remota ou decisão arquitetural
não autorizada. Não foram feitas leituras/escritas no Supabase, RSS, IA, migrations,
deploy, commit ou push nesta entrega. Nenhum scheduler ou handoff foi habilitado.

O motor recebe snapshots normalizados já disponíveis. Não tem client, transporte,
provider, relógio, configuração de ambiente ou capacidade de gravação. Texto
integral é opcional e somente aceito quando já estiver disponível; não há crawler.

## Inventário

| Recurso existente                                            | Reutilização / limite                                                                                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `WatcherStoredRevision`, `WatcherFeedItem`, `WatcherSource`  | Entradas da 24A; validação, UUIDs, timestamps, canonicalização de URL e hash original conferidos                                          |
| `BrandIdentityResolution`                                    | Registro canônico/aliases BR injetado; não criar lista estática de marcas nem descobrir aliases por notícia                               |
| `CanonicalMmv` / `CanonicalMmvRepository`                    | Snapshot mínimo de `catalog_mmvs`: id, marca, modelo, versão oficial, mercado; nenhuma aplicação de MMV/MMVY                              |
| `CatalogMmvIdentity`, `mmvDiscoveryIdentityKey`, matcher MMV | Auditados; o matcher oficial exige atributos/evidência oficial ausentes no RSS. Não fabricar `OfficialProductCandidate` para chamá-lo     |
| `MmvDiscoveryReasonCode`, `MmvDiscoverySourceKind`           | Reutilizados nos tipos NEW_MODEL, NEW_COMMERCIAL_VARIANT, POSSIBLE_DISCONTINUATION e classificação MANUFACTURER/SECONDARY/FIPE            |
| `ModelYearReasonCode`                                        | NEW_MODEL_YEAR reutilizado; só extrair ano explicitamente ligado a linha/ano-modelo                                                       |
| `AgentFindingType`, Price Agent                              | PRICE_CHANGE reutilizado; valor monetário literal não vira MSRP ou PriceObservation comercial                                             |
| `AgentReviewDecision`                                        | ACCEPT/REJECT/DEFER reutilizados no comando puro de review; ACCEPT encaminha para revisão, nunca aplica                                   |
| `AGENT_COST_POLICY`, `PriceAiUsage`                          | Política e formato de telemetria reutilizados; uso/custo efetivo permanecem zero                                                          |
| `AgentCostAdmission`, admission Supabase, usage events       | Auditados; futuras chamadas pagas exigem o admission atômico já existente e seus eventos. Nenhum ledger/provider alternativo implementado |
| `WatcherSupabaseAdapter`, executor QA                        | Preservados; consultas e review de candidatos da 24A já existem. Não duplicar esses métodos                                               |

Não foram alterados contratos de outros agentes nem o significado das categorias
coarse PRODUCTS/MARKET/IRRELEVANT da 24A. POWERTRAIN e FACELIFT são categorias de
interpretação locais adicionais, não novos finding types persistidos.

## Motor determinístico

`packages/core/src/agents/watcher-intelligence.ts`:

- Valida entradas em runtime e normaliza título/resumo/conteúdo com a normalização
  Watcher existente. O texto original permanece disponível para prova literal.
- `watcher-intelligence/1` identifica regras explícitas em português para as sete
  categorias. Um evento específico evita também criar NEW_MODEL genérico.
- Marca exige token/alias exato do registro; múltiplas marcas no mesmo trecho
  bloqueiam resolução. Modelo/versão exigem termos completos, não distância textual.
- Resoluções EXISTING, PROBABLE_NEW e UNRESOLVED. Uma versão nova de um modelo conhecido
  também pode ser proposta pelo padrão literal “nova versão Nome”, sem MMV canônico.
  Um novo nome de modelo só é proposto no
  padrão explícito marca + apresenta/lança/anuncia + novo + nome próprio de um token
  com contexto automotivo. Nomes desconhecidos compostos se abstêm em vez de truncar.
- CONFIRMED exige fonte MANUFACTURER, marca e host previamente revisados. Uma notícia
  editorial declarativa é EDITORIAL_ASSERTION; anúncio atribuído é ATTRIBUTED.
  Negação, rumor, especulação, pergunta e informação insuficiente são distintos.
- A aplicabilidade BR exige menção explícita; a sede/idioma do veículo editorial
  não confirmam disponibilidade no Brasil. Mercado estrangeiro ou misto se abstém.
- Ressalvas em outro trecho/campo vetam a conclusão positiva de forma conservadora;
  os trechos de ressalva também têm localização verificável. Isso prioriza precisão
  e pode produzir falsas abstenções em comparações internacionais ou “não só”.
- Evidência preserva URL, artigo, revisão, fonte, fingerprint da revisão, campo,
  start/end em unidades UTF-16, trecho e regra. O verificador testa igualdade literal
  com o snapshot; isso não representa verificação factual externa da notícia.
- Preço, motor e ano não são sintetizados. Datas de publicação nunca viram datas
  de lançamento. “Janela de observação” mensal é agrupamento editorial, não um fato
  sobre lançamento, vigência comercial ou ano-modelo.

Limites: 100 documentos/revisões por projeção, 200 marcas, 2000 MMVs, 100 fontes,
30 aliases/marca, 20 hosts/fonte, conteúdo disponível até 20.000 caracteres e 200
trechos por campo. Limites da 24A para título (500), resumo (1000), URLs e datas
continuam aplicados. Excesso/conflito rejeita a operação em memória, sem estado parcial.

## Candidate Discovery, evidência e review

`watcher-candidate-discovery.ts` mantém artigo, sinal e candidato separados da
identidade canônica. A chave de evento versionada usa marca canônica, modelo,
versão, categoria, atributo literal, ano explícito e janela mensal de publicação.
Sem publicação, a janela é isolada por artigo: não inventar um período de evento.
Modelos, versões, preços, anos e janelas diferentes não são fundidos por similaridade.
Essa chave é uma correlação conservadora para review, não prova de equivalência
entre anúncios. O mesmo evento atravessando meses pode gerar propostas separadas.

`appendWatcherIntelligenceJournal` acrescenta revisões sem reescrever IDs antigos,
reconhece replay e reprojeta um journal limitado com o mesmo motor. Não possui cursor
durável ou cache externo; reprojeção CPU-only é intencional e não custa IA/rede.
O último snapshot observado de cada feed item controla evidências ativas; evidências
anteriores continuam no candidato histórico. Empate temporal entre revisões distintas
é rejeitado em vez de resolver ordem por UUID. Metadados/conteúdo alterados com ID
imutável ou IDs diferentes para a mesma revisão natural também são rejeitados.

Estados da projeção: NEW, CORROBORATED, INSUFFICIENT, DISMISSED, REVIEW_REQUIRED.
Compatibilidade local com 24A: DISMISSED → DISMISSED, demais → OBSERVED. Nunca
promover automaticamente para EXPECTED_BR, BR_CONFIRMED ou handoff. Identidades
não resolvidas continuam como sinais/abstenções, sem candidatos inventados.

Qualidade reproduzível: 0 sem sinal atual suportado; 20 para editorial isolada ou
origem independente desconhecida; 60 para pelo menos duas origens independentes
explicitamente revisadas; 80 para evidência oficial literal. São pontos de política,
não probabilidades. Todos os estados têm `applyAllowed=false`.

`originGroup` identifica a origem informacional revisada por artigo, não o domínio
do publicador. Ausência de proveniência não confirma independência. Mesmo trecho
normalizado une grupos declarados distintos; republicação não aumenta corroboração.
Paráfrases exigem atribuição correta da origem pelo snapshot revisado, não um chute.

O comando puro de review valida fingerprint de snapshot e candidato (CAS local),
preserva a sequência histórica e é idempotente para o mesmo comando. Review de
evidência antiga não é aplicado silenciosamente a um snapshot novo. Não há botão,
RPC nova ou API de aplicação comercial. Snapshots retornados devem ser arquivados
integralmente pelo futuro writer para preservar também contextos/regras anteriores.

## AI Gate

`watcher-intelligence-ai-gate.ts` apenas planeja a eventual revisão de ambiguidades
atuais relevantes (especulação ou versão não resolvida), excluindo rumor, negação,
mercado estrangeiro e ambiguidades superadas. Default DISABLED. Habilitação sem
autorização explícita é NOT_AUTHORIZED. Sem ambiguidade é NOT_NEEDED.

Limites de chamadas, tokens de entrada/saída, custo, gasto já ocorrido e reserva
pendente são verificados; dados ausentes/negativos/não finitos ou orçamento esgotado
resultam em BUDGET_BLOCKED. Mesmo com orçamento válido, o resultado exige
EXTERNAL_ATOMIC_ADMISSION_REQUIRED e `providerExecutionAllowed=false`.
Não há provider ou chamada de IA a ativar por uma variável. Uma futura integração
deverá reutilizar AgentCostAdmission/usage events existentes, reter reservas quando
usage for desconhecido e respeitar billing hard stop. Não copiar o guard local do
Price Agent como substituto do ledger atômico. Indisponibilidade de IA não afeta
o processamento determinístico.

## Auditoria da persistência 24A e gate 24B.4

O SQL versionado já contém artigos, feed items, revisões imutáveis, batches com
receipt/journal, estado/lease/fencing, candidatos versionados e evidências com
candidate_snapshot. `watcher_stage_candidate` usa CAS; `watcher_attach_evidence`
preserva snapshot e valida versão. Consultas de candidatos/evidências e comandos
de review/hint já existem no adapter. O executor de coleta bloqueia essas mutações.

Lacunas confirmadas no código, sem consultar remotamente:

1. `watcher_candidates.identity_key` identifica BR/marca/modelHint/projectCode;
   não distingue evento, versão, preço, ano, regra/contexto ou janela de observação.
2. O lifecycle SQL é OBSERVED/EXPECTED_BR/DISMISSED; não comporta diretamente os
   estados locais de qualidade/review nem avaliações históricas de cada regra.
3. `watcher_persist_batch` grava ingestão, não a projeção de inteligência. As RPCs de
   candidato/evidência são transações separadas e não recebem lease/fencing/receipt
   da análise. Usá-las em sequência não fornece o commit atômico solicitado.
4. `note` limitado e snapshots de candidato não substituem o journal de sinais,
   locators, decisões e versões de contexto. A plataforma de agentes tem evidências
   e reviews genéricos, mas não tem tipo WATCHER e suas aplicações oficiais têm
   contratos de elegibilidade próprios. Não publicar notícias como achados oficiais.

**Bloqueio:** nenhum writer 24B foi conectado. Não serializar o snapshot inteiro em
aliases/note, usar um GUID falso como modelo, emitir novo batch de ingestão para
receipting de inteligência nem afrouxar a guarda de coleta.

Antes de qualquer migration, apresentar e aprovar desenho aditivo que reutilize
FKs/revisões/candidatos/review existentes e grave sinal, contexto/regra, decisões e
receipt da análise em uma única RPC sob fencing. Definir escopo da lease, conflito
com ingestão e atomicidade entre fontes, unicidade de evento/processamento e política
de retries por receipt. Alternativa de integrar o ledger da plataforma de agentes
também exige decisão explícita. Não foram escolhidos novos nomes de tabelas, escritos
SQLs ou presumida autorização para essa mudança. Testes transacionais da 24A são
regressão; ACID/concorrência da futura persistência 24B permanecem PENDENTES.

Plano controlado e cobertura: [WATCHER_QA_INTELLIGENCE_24B.md](WATCHER_QA_INTELLIGENCE_24B.md).
