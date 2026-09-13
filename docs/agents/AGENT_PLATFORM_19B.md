# Sprint 19B — Agent Platform

## Entrega e fronteira

Worktree C:\Dev\compra-car-agent-platform, branch sprint-19b-agent-platform.
HEAD inicial: **0b81aa89deeb50d460a2362d4c8df8c991aa5286**, status inicialmente limpo.
Implementação local para revisão, **sem commit e sem staging**.

A plataforma persiste Run → Finding → Evidence → Human Review. Accept, Reject e
Defer apenas acrescentam uma decisão operacional. **Accept não executa proposal,
não cria Product/Model/Version e não modifica catálogo, specs, preços ou dados comerciais.**
Não existe botão Execute, canonical action, agente futuro, scheduler ou worker.

## Schema e migration

Arquivo gerado com Supabase CLI 2.117.0, recuperado do cache local sem instalar
dependência: supabase/migrations/20260913220406_sprint_19b_agent_platform.sql.
**Não aplicada a nenhum banco.** Não há backfill nem seed automático.

| Tabela | Conteúdo | Identidade / relações |
| --- | --- | --- |
| agent_runs | agent_type, status, market, brand, provider, run_mode, schema_version, started_at/completed_at, input, summary, config_snapshot, error, source_commit_sha, created_by, created_at/updated_at | UUID do agente/report |
| agent_findings | finding_type, fingerprint, subject_key, title, summary, confidence, requires_review, subject, proposal, payload e timestamps | UUID; run_id FK CASCADE; UNIQUE(run_id, fingerprint) |
| agent_evidence | source_type/url/domain, title, excerpt, evidence_fingerprint, metadata, captured_at/created_at | UUID; finding_id FK CASCADE; UNIQUE(finding_id, evidence_fingerprint) |
| agent_reviews | decision, note, reviewed_by, created_at | UUID; finding_id FK CASCADE; eventos append-only |

Os JSONB não nulos usam default {}. Agent type, run status e decision usam text +
CHECK. Finding type permanece text não vazio no banco para extensão incremental;
TypeScript centraliza os dez tipos iniciais. Confidence é nullable, no intervalo
0–1; não é probabilidade calibrada de novidade. Excerpt tem até 1.000 caracteres,
título de evidence até 500, nota até 4.000. JSON operacional tem limite de 64 KiB
por campo na aplicação; metadata de evidence, 8 KiB. Dumps HTML/base64 são recusados.

Índices: runs por (agent_type, created_at DESC) e (status, created_at DESC);
findings por finding_type, requires_review, created_at DESC e fingerprint;
reviews por (finding_id, created_at DESC, id DESC). Os UNIQUEs já cobrem run_id
em findings e finding_id em evidence, evitando índices redundantes. Nenhum GIN.
Fingerprint de finding **não é globalmente unique**: pode reaparecer em outra run.
Created_by/reviewed_by são UUIDs de auditoria sem FK, preservados mesmo após
remoção futura da conta; a ação web deriva reviewed_by do profile autorizado.

## Segurança

Foi reutilizado o padrão dos módulos internos de Pricing/artifacts:
RLS nas quatro tabelas, nenhuma policy pública/authenticated, revogação explícita
dos grants herdados para PUBLIC/anon/authenticated/service_role. Service role
recebe SELECT/INSERT/UPDATE somente em runs e SELECT/INSERT em findings, evidence
e reviews. Não recebe DELETE, TRUNCATE ou UPDATE de review/observação.
Grants e RLS são camadas separadas, conforme a
[documentação Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
Nenhuma policy/grant/tabela preexistente foi alterada.

Não há helper RLS authenticated-admin genérico reutilizado: o projeto usa guard
server-side para estas capacidades privilegiadas. Layout Admin e cada loader/ação
exigem requireRole('admin') antes de construir o repository. Esse guard usa o
profile ativo verificado, não user_metadata. Browser/seller não recebem cliente
privilegiado, segredo, tabela física ou capability de publicação.

O adapter está exclusivamente em packages/adapter-supabase e só referencia as
quatro tabelas operacionais. O mapper/CLI recebe somente persistRunBundle; a ação
web só chama getFinding/addReview. Erros públicos são genéricos; erros crus de
provider/SDK e configuração de ambiente não são persistidos/exibidos.
Links de evidence aceitam HTTP(S), recusam credenciais embutidas, abrem com
noopener noreferrer e usam escaping do React, sem HTML bruto.

## Domínio, repository e estado

Subpath @compra-car/core/agent-platform exporta AgentType, AgentRunStatus,
AgentFindingType, AgentReviewDecision, AgentRun, AgentFinding, AgentEvidence,
AgentReview, AgentRunBundle, read models e AgentPlatformRepository.
StoredAgentPlatformRepository implementa regras sobre AgentPlatformStore.
AgentPlatformSupabaseAdapter fornece o store com supabase-js já instalado.
O subpath /agent-platform/testing contém fixture sintética e store em memória;
não é carregado nem semeado pela aplicação.

Operações: createRun, completeRun, failRun, persistFinding, persistEvidence,
persistRunBundle, getRun, listRuns, listFindings, getFinding, addReview e
getLatestReview. Não existem updateReview/delete/canonical-action methods.

RUNNING permite inserir observações. COMPLETED é terminal e congela run,
findings e evidence na aplicação. FAILED pode ser retomada explicitamente com
mesma identidade/configuração; CANCELLED não reabre. Revisões podem ser adicionadas
após COMPLETED. A plataforma não cria rows PENDING.

Decisão efetiva: maior created_at; empate usa UUID decrescente deterministicamente.
Esse desempate não pretende representar ordem causal de requests simultâneos.
Histórico é preservado integralmente, inclusive repetição da mesma decisão.

| Filtro da fila | Regra |
| --- | --- |
| Abertos | requires_review=true, run concluída e nenhuma review |
| Aceitos | requires_review=true e última decisão ACCEPT |
| Rejeitados | requires_review=true e última decisão REJECT |
| Adiados | requires_review=true e última decisão DEFER |
| Todos | todos os findings de revisão em runs concluídas |

Informativos ficam disponíveis no detalhe da run. O repository também permite
consultar todos os findings de uma run, inclusive uma execução parcial; a UI não
libera review antes da conclusão. Listagens web usam 25 itens/página e filtro de
agent type. Estatísticas de review em Run History são calculadas pelas decisões
atuais, sem reescrever summary histórico da run.

## Persistência, consistência e idempotência

O bundle usa o UUID já presente no JSON/Markdown. O protocolo é:

1. inserir run RUNNING ou retomar FAILED com a mesma identidade;
2. inserir findings por run_id/fingerprint;
3. inserir evidence por finding_id/evidence_fingerprint;
4. reler e comparar o conjunto persistido completo;
5. transicionar condicionalmente RUNNING → COMPLETED por último.

INSERT com conflito de unicidade relê a row existente e compara conteúdo.
Observações nunca recebem UPSERT que sobrescreva dados. UUIDs gerados de filhos e
timestamps de persistência não alteram identidade de replay; conteúdo, provenance,
fingerprints e ownership são comparados deterministicamente. Datas equivalentes
com offsets diferentes são comparadas pelo instante. Evidence usa SHA-256 de uma
tupla versionada, mantendo o índice compacto e distinguindo excerpts diferentes
na mesma URL. Evidence não é duplicada em payload.

Reenvio de bundle COMPLETED equivalente retorna sem writes. Conteúdo divergente,
evidência ausente/extra ou conjunto diferente é conflito; a run completa permanece
intacta. Falha intermediária tenta marcar FAILED com código seguro; a causa
original é preservada se até essa marcação falhar. Nesse caso, RUNNING pode ficar
pendente de inspeção. Não há limpeza ou retry automático. Reviews não são criadas
por persistRunBundle e nunca são deduplicadas pela decisão.

**Limite de concorrência:** protocolo sequencial, destinado a um writer por run.
CAS no status impede sobrescrever uma conclusão com uma falha tardia, mas as
leituras/INSERTs de filhos e a finalização não são uma transação única nem têm
lock distribuído. Writers concorrentes com o mesmo runId não são um modo suportado;
a futura orquestração precisará RPC transacional/lease antes de liberar isso.
As restrições UNIQUE continuam protegendo duplicidade no banco.

**Limite de escala:** reads são paginados no adapter em blocos de 500 para evitar
truncamento pelo teto REST. Filtros/estatísticas agregadas usam o conjunto em
memória, e detalhe de run lê evidence por finding. Não é snapshot transacional.
Paginação/aggregations no banco e bulk evidence são follow-ups para volume maior;
não há índices JSONB especulativos nem um segundo workflow nesta Sprint.

## Integração MMV

mapMmvRunToPlatform pertence à camada do agente, não à plataforma genérica.

| Resultado MMV | Finding | Requires review | Detalhes preservados |
| --- | --- | --- | --- |
| MATCHED | MMV_MATCHED | false | MMV oficial/canônica, matchMode, warnings e todas as product rows |
| NEW_MODEL | NEW_MODEL | true | marca/modelo, variantes resolvidas e warnings |
| NEW_VERSION | NEW_VERSION | true | marca/modelo/officialVersionLabel |
| AMBIGUOUS | AMBIGUOUS_MMV | true | identidade e correspondências ambíguas |

Fingerprints dos findings 19A são preservados. Matches, antes sem fingerprint de
finding, recebem tupla versionada mmv-matched:v1 baseada na identidade oficial já
existente. Evidence preserva URL/type/title/excerpt; textos longos são limitados
literalmente com indicador de truncamento em metadata. Hash considera a observação
original, sem armazenar seu texto integral no fingerprint. Payload contém candidate
estruturado sem evidence, variantes sem evidence, warnings e associatedProductRows.
Input/config são allowlists compactas; metadata bruta e ambiente não são copiados.
Segredos conhecidos são removidos antes do mapping no CLI. source_commit_sha é
nullable; pode ser fornecido ao mapper, e o CLI atual deixa null.

Default permanece JSON + Markdown locais, sem persistência:

```powershell
pnpm agent:new-products:dry-run -- --brand Jeep --provider fixture
```

Opt-in explícito, preparado para execução posterior à revisão/aplicação da migration:

```powershell
pnpm agent:new-products:dry-run -- --brand Jeep --provider fixture --persist-findings
```

Com opt-in real, SUPABASE_URL e SUPABASE_SERVER_KEY são obrigatórios, mesmo com
provider fixture. Nesta implementação a flag foi executada **somente com repository
injetado em memória/mock**, nunca contra Supabase real. Sem flag, credenciais ou
capability injetada não provocam persistência. Falha operacional preserva os reports
já gerados e retorna exit != 0. A persistência começa após pesquisa/report bem-sucedidos;
falhas anteriores a esse ponto não criam agent_runs. Não foi adicionado replay CLI
de arquivo nem automática repetição de chamadas; persistRunBundle permite replay
programático explícito do mesmo resultado.

## Admin

Navegação interna: Agentes. Rotas:

- /admin/agents: Fila de revisão e Runs, filtros na URL, paginação e estados vazios;
- /admin/agents/runs/[id]: metadata, input/config/summary/error, findings de revisão
  separados de informativos MMV_MATCHED;
- /admin/agents/findings/[id]: tipo/título/confiança/run, subject/proposal/payload,
  evidence e audit trail completo.

Aceitar/Rejeitar/Adiar usam Server Action, nota opcional, pending com controles
desabilitados e reviewed_by derivado do profile. Revalidam fila, run e finding.
Falha de revalidação após INSERT bem-sucedido não transforma sucesso em convite
para reenviar. Erro de transporte ambíguo orienta recarregar o histórico antes de
repetir, pois reviews são eventos independentes. A UI sempre comunica:
“Esta decisão não altera o catálogo.” Nenhuma canonical action é executada.

## Issue conhecido: source-to-variant technical binding

**Relatado pelo operador, não revalidado nesta Sprint:** na run real Jeep, algumas
fontes/extrações ligaram incorretamente motor 1.995 L a Commander T270 MHEV;
o operador informa que T270 MHEV é 1.3. A 19B não corrige isso nem hardcodeia Jeep.
O binding técnico fonte → variante exige refinamento futuro do Spec Intelligence
e, se necessário, do extraction provider. Candidate, warnings, URL e excerpt
ficam disponíveis para auditar esse tipo de erro.

## Validação

Fixtures são sintéticas/offline: um matched informativo, NEW_MODEL/NEW_VERSION/
AMBIGUOUS_MMV abertos, um aceito, um rejeitado e um adiado, todos com evidence.
Os testes cobrem os 47 critérios solicitados: vocabulário/lifecycle/idempotência,
run/finding/evidence/review, filtros, mapping MMV, capabilities do CLI, auth,
renderização SSR, links seguros, decisões e preservação do catálogo.

| Verificação | Resultado final |
| --- | --- |
| Core direcionado: plataforma + mapper + cinco suítes MMV | **286 passed** |
| Adapter operacional + migration estática | **14 passed** |
| Admin plataforma + navegação existente | **31 passed** |
| CLI/reports e opt-in mock | **18 passed** |
| Provider: transporte simulado, sem OpenAI real | **17 passed** |
| Total direcionado (sem contar repetições) | **366 passed** |
| Core completo no gate global | **942 passed** |
| pnpm lint | exit 0 |
| pnpm typecheck | exit 2; cinco TS2554 preexistentes |
| pnpm test | exit 1; uma falha preexistente do adapter de preços |
| pnpm format:check | exit 1; mesmos 15 arquivos preexistentes |
| pnpm build | exit 0, incluindo as três rotas de Agentes |
| git diff --check | exit 0 |

As falhas globais foram comparadas com o histórico 19A.4 versionado no HEAD,
não com uma nova execução da base. Logs históricos brutos não estavam disponíveis
neste ambiente. A comparação automatizada confirma os mesmos diagnósticos:
TS2554 em apps/web/test/admin-product-public-prices.test.ts:101–105;
product-public-price-supabase-adapter.test.ts, caso “lists a page with exact count
and deterministic range”, .in is not a function; e a lista idêntica de 15 paths
de formatação. Pacote adapter: 1 failed, 122 passed, 3 skipped (14 novos testes
passando). Nenhuma falha preexistente foi corrigida fora do escopo.

Logs finais: .local-reports/agents/platform/validation/final-*.log; suítes
direcionadas: target-*.log; comparação: diagnostic-comparison.json. Integrações
Supabase, smokes OpenAI e benchmark remoto foram explicitamente desabilitados
no processo. Turbo interrompe tarefas após a falha do adapter; as suítes de UI,
CLI e provider do escopo foram executadas também separadamente.

Comandos direcionados reproduzíveis:

```powershell
pnpm --filter @compra-car/core exec vitest run test/agent-platform.test.ts test/mmv-platform-mapper.test.ts test/new-product-check-agent.test.ts test/legacy-product-version-parser.test.ts test/product-reconciliation.test.ts test/cross-brand-product-check.test.ts test/mmv-product-reconciliation.test.ts --maxWorkers=2
pnpm --filter @compra-car/adapter-supabase exec vitest run test/agent-platform-supabase-adapter.test.ts test/agent-platform-migration.test.ts
pnpm --filter @compra-car/web exec vitest run test/agent-platform.test.tsx test/admin-foundation.test.ts
pnpm --filter @compra-car/agents test
pnpm --filter @compra-car/adapter-openai exec vitest run test/product-research-provider.test.ts
```

Dry-runs locais executados com exit 0, sem flag de persistência:

- Jeep: 84c04ead-37e1-40ce-924d-fd0efc3fc45c; 4/4 MMVs, um NEW_MODEL,
  um NEW_VERSION e um AMBIGUOUS.
- Toyota: b251114d-a354-4515-8be3-639939ce8246; 8/8 MMVs, três NEW_MODEL,
  dois NEW_VERSION e um AMBIGUOUS.

Ambas com zero falsos novos na fixture. Reports JSON/Markdown estão em
.local-reports/agents/new-product-check/<UUID>.{json,md}, ignorados pelo Git.
O replay capturado Jeep permanece coberto pelos testes, sem revalidar pesquisa
ou disponibilidade real. A infração nova de lint (import de tipo inline no
teste CLI) e o ajuste de tipos do formulário foram corrigidos antes dos gates finais.

**PENDENTE:** aplicação autorizada da migration, validação SQL/RLS real e smoke
manual autenticado no navegador. Docker Desktop instalado, mas daemon Linux
indisponível (pipe dockerDesktopLinuxEngine ausente); nenhum reset ou SQL executado.
A validação estática cobre as quatro tabelas, FKs, índices, CHECKs, unicidade,
RLS e grants, e não substitui o exercício em PostgreSQL real.

Node local 24.18.0 versus 22.x declarado; pnpm 10.34.5. Dependências instaladas
pelo lockfile com cache offline, zero downloads e nenhuma dependência nova.
Zero OpenAI calls, zero remote Supabase writes, zero canonical writes; nenhum
Brand Connector novo, Product Year, Spec Agent, Price Agent ou scheduler/orchestrator.

## Arquivos e auditoria Git

Criados (23):

- apps/web/src/app/admin/agents/actions.ts
- apps/web/src/app/admin/agents/error.tsx
- apps/web/src/app/admin/agents/findings/[id]/page.tsx
- apps/web/src/app/admin/agents/loading.tsx
- apps/web/src/app/admin/agents/page.tsx
- apps/web/src/app/admin/agents/runs/[id]/page.tsx
- apps/web/src/application/admin/agent-platform.ts
- apps/web/src/components/admin/agent-platform-views.tsx
- apps/web/src/components/admin/agent-review-form.tsx
- apps/web/test/agent-platform.test.tsx
- docs/agents/AGENT_PLATFORM_19B.md
- packages/adapter-supabase/src/agent-platform-supabase-adapter.ts
- packages/adapter-supabase/test/agent-platform-migration.test.ts
- packages/adapter-supabase/test/agent-platform-supabase-adapter.test.ts
- packages/core/src/agent-platform/index.ts
- packages/core/src/agent-platform/repository.ts
- packages/core/src/agent-platform/rules.ts
- packages/core/src/agent-platform/testing.ts
- packages/core/src/agent-platform/types.ts
- packages/core/src/agents/mmv-platform-mapper.ts
- packages/core/test/agent-platform.test.ts
- packages/core/test/mmv-platform-mapper.test.ts
- supabase/migrations/20260913220406_sprint_19b_agent_platform.sql

Modificados (11):

- AI_CONTEXT.md
- CHANGELOG.md
- apps/web/src/components/admin/admin-navigation.ts
- apps/web/test/admin-foundation.test.ts
- docs/agents/AGENT_PLATFORM_ARCHITECTURE.md
- docs/agents/NEW_PRODUCT_CHECK_AGENT.md
- packages/adapter-supabase/src/index.ts
- packages/core/package.json
- packages/core/src/agents/index.ts
- scripts/agents/run-new-product-check.ts
- scripts/agents/test/new-product-check-cli.test.ts

git diff --stat (somente rastreados; os novos continuam untracked):

```text
 AI_CONTEXT.md                                     |  17 ++++
 CHANGELOG.md                                      |  17 ++++
 apps/web/src/components/admin/admin-navigation.ts |   1 +
 apps/web/test/admin-foundation.test.ts            |   1 +
 docs/agents/AGENT_PLATFORM_ARCHITECTURE.md        |  44 +++++----
 docs/agents/NEW_PRODUCT_CHECK_AGENT.md            |   7 +-
 packages/adapter-supabase/src/index.ts            |   2 +
 packages/core/package.json                        |   4 +-
 packages/core/src/agents/index.ts                 |   2 +
 scripts/agents/run-new-product-check.ts           |  47 ++++++++--
 scripts/agents/test/new-product-check-cli.test.ts | 103 ++++++++++++++++++++++
 11 files changed, 217 insertions(+), 28 deletions(-)
```

git status --short --untracked-files=all:

```text
 M AI_CONTEXT.md
 M CHANGELOG.md
 M apps/web/src/components/admin/admin-navigation.ts
 M apps/web/test/admin-foundation.test.ts
 M docs/agents/AGENT_PLATFORM_ARCHITECTURE.md
 M docs/agents/NEW_PRODUCT_CHECK_AGENT.md
 M packages/adapter-supabase/src/index.ts
 M packages/core/package.json
 M packages/core/src/agents/index.ts
 M scripts/agents/run-new-product-check.ts
 M scripts/agents/test/new-product-check-cli.test.ts
?? apps/web/src/app/admin/agents/actions.ts
?? apps/web/src/app/admin/agents/error.tsx
?? apps/web/src/app/admin/agents/findings/[id]/page.tsx
?? apps/web/src/app/admin/agents/loading.tsx
?? apps/web/src/app/admin/agents/page.tsx
?? apps/web/src/app/admin/agents/runs/[id]/page.tsx
?? apps/web/src/application/admin/agent-platform.ts
?? apps/web/src/components/admin/agent-platform-views.tsx
?? apps/web/src/components/admin/agent-review-form.tsx
?? apps/web/test/agent-platform.test.tsx
?? docs/agents/AGENT_PLATFORM_19B.md
?? packages/adapter-supabase/src/agent-platform-supabase-adapter.ts
?? packages/adapter-supabase/test/agent-platform-migration.test.ts
?? packages/adapter-supabase/test/agent-platform-supabase-adapter.test.ts
?? packages/core/src/agent-platform/index.ts
?? packages/core/src/agent-platform/repository.ts
?? packages/core/src/agent-platform/rules.ts
?? packages/core/src/agent-platform/testing.ts
?? packages/core/src/agent-platform/types.ts
?? packages/core/src/agents/mmv-platform-mapper.ts
?? packages/core/test/agent-platform.test.ts
?? packages/core/test/mmv-platform-mapper.test.ts
?? supabase/migrations/20260913220406_sprint_19b_agent_platform.sql
```

Índice vazio, HEAD preservado. Nenhum git add/commit/push. Legacy, lockfile,
providers, prompt, matcher e regras técnicas existentes sem alterações.
Auditoria local: .local-reports/agents/platform/validation/git-audit.json.
