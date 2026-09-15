# Sprint 20 — implementação e validação

## Checkpoint consolidado — Sprint 20 / 20.1 / 20.2

**SPRINT 20.2 IMPLEMENTED · REAL WEBMOTORS PARSER GATE VALIDATED · END-TO-END STRUCTURED CLI SMOKE PENDING.**

[Estado final, validações históricas, exclusões e próximo gate](SPRINT_20_CHECKPOINT.md). O smoke completo structured/monitor/persist-findings ainda não foi executado. Seções com estado local/sem commit abaixo registram o histórico anterior a este checkpoint.

## Sprint 20.2 — estratégia vigente

Pesquisa estruturada primeiro, agrupada por modelo, com candidatos FIPE e fallback oficial limitado. Ver [relatório 20.2](SPRINT_20_2_STRUCTURED_MY_FIPE_BRIDGE.md). O restante deste documento registra gates históricos da Sprint 20. Migration já aplicada em Staging segundo o operador; a 20.2 não altera SQL nem executa chamadas remotas.

## 1. Branch / worktree

- Worktree: C:\Dev\compra-car-model-year.
- Branch: sprint-20-model-year-agent.
- Base e HEAD final: 0fe2acfad8c8b0fc705167986e4bd81e0c8514de.
- Worktree 19C conferido limpo antes e depois, no mesmo HEAD; não foi modificado.
- Sem stage, commit, push ou merge. Alterações preexistentes em compra-car preservadas.

## 2. Arquivos criados (17)

- docs/agents/MODEL_YEAR_AGENT_20.md
- docs/agents/SPRINT_20_VALIDATION.md
- docs/agents/prompts/model-year-agent-v1.md
- packages/adapter-openai/src/background-research.ts
- packages/adapter-openai/src/model-year-research-provider.ts
- packages/adapter-openai/test/model-year-research-provider.test.ts
- packages/adapter-supabase/test/model-year-migration.test.ts
- packages/core/src/agents/model-year-agent.ts
- packages/core/src/agents/model-year-discovery-reader.ts
- packages/core/src/agents/model-year-fixture.ts
- packages/core/src/agents/model-year-types.ts
- packages/core/test/model-year.test.ts
- scripts/agents/model-year-cli.ts
- scripts/agents/run-model-year.ts
- scripts/agents/test/model-year-cli.test.ts
- supabase/migrations/20260915163527_sprint_20_model_year.sql
- supabase/tests/model_year_20_local.sql

## 3. Arquivos alterados (13)

- AI_CONTEXT.md
- CHANGELOG.md
- apps/web/test/agent-platform.test.tsx
- docs/agents/AGENT_PLATFORM_ARCHITECTURE.md
- docs/agents/NEW_PRODUCT_CHECK_AGENT.md
- package.json
- packages/adapter-openai/src/index.ts
- packages/adapter-openai/src/product-research-provider.ts
- packages/adapter-supabase/test/agent-platform-supabase-adapter.test.ts
- packages/core/src/agent-platform/types.ts
- packages/core/src/agents/index.ts
- packages/core/test/agent-platform.test.ts
- scripts/agents/agent-diagnostics.ts

## 4. Migration

20260915163527_sprint_20_model_year.sql, criada pelo CLI local em cache.
Amplia somente agent_runs_agent_type_check para MODEL_YEAR e mantém PRODUCT_YEAR
para dados históricos. finding_type já aceita texto não vazio; nenhum CHECK adicional
é necessário. Não altera migrations históricas, RLS, grants, policies ou dados canônicos.

Validada em PostgreSQL 15 descartável, --network none e sem portas expostas:
primeiro com 19B, depois em outro banco com 19B + 19C. O teste SQL verificou registros
legados preservados, RLS/ACLs idênticos, nenhuma policy/grant de browser, ausência de
UPDATE em findings/DELETE em reviews para service_role, os dois findings MY,
evidência e ACCEPT sem mudança da proposta. Resultado: SPRINT_20_LOCAL_SQL_PASSED.
O container compra-car-sprint20-pg foi encerrado e removido ao final.
**Nenhuma aplicação remota.**

## 5–6. Contrato MY e exclusão de Production Year

ModelYearResearchTarget preserva targetKey opaco, identidade MMV local, identidade
canônica/oficial, atributos estruturados, aliases, MYs conhecidos e evidência discovery.
ModelYearObservation contém somente targetKey, modelYear, confidence, applicability
e evidence. O schema OpenAI é estrito, sem productionYear e sem mmvIdentity.
A projeção de entrada allowlist não envia linhas do catálogo nem campos extras,
mesmo se um objeto runtime trouxer productionYear. Teste direcionado comprova isso.

Busca textual nos arquivos de contrato/core/provider MY não encontrou productionYear.
As fixtures contêm esse campo apenas como dado histórico de entrada do catálogo para
provar que não participa da decisão. JSON final/targets também foram testados sem ele.
ano/modelo 2026/2027 contribui apenas MY 2027; um ano sem marcador explícito não basta.

## 7. Dependência MMV Discovery

PlatformMmvDiscoveryReader usa somente listRuns/getRun/getLatestReview por port.
Seleciona a última COMPLETED da marca/BR por completedAt; empate por UUID. Percorre
páginas, carrega evidências e review efetiva, e não recua para run antiga se a última
não tiver alvos. Somente MMV_MATCHED com uma identidade ainda existente no catálogo
é elegível. REJECT/DEFER, AMBIGUOUS_MMV, NEW_MODEL e NEW_VERSION ficam fora,
mesmo quando uma proposta nova foi ACCEPTed. Skips geram métricas, não findings MY.
skippedUnresolved conta findings discovery excluídos; métricas de pesquisa contam
identidades MMV distintas. Nenhuma identidade é inventada pelo LLM.

## 8. Brand Connector

CLI real exige ACTIVE via OperationalBrandConnectorResolver. Sem branches de marca,
sem constantes de domínio em lógica de produção MY e sem novo fallback.
Source entries e terminology hints chegam incorporados aos hints do resolver existente.
Snapshot e fingerprint do source efetivo são preservados. UUID/version do connector
não são expostos pelo contrato atual do resolver, portanto não foram fabricados.
Testes cobrem VW operacional e regressões do fallback existente Toyota/Jeep no MMV.

## 9. Projeção do catálogo

Reutiliza AdministrativeProductCatalogReader e a consulta administrativa existente,
sem duplicar queries legadas. catalogMmvIdentityId preserva a identidade existente.
knownModelYears lê apenas distinct modelYear, ordenado: linhas 2025/2026 e 2026/2026
resultam em [2026]. Nenhuma consulta/inserção/alteração de catálogo foi adicionada.
Active/Public, naming, matcher e parser permanecem intactos.

## 10. Apenas dois findings

| Finding | requiresReview | proposal | Efeito de ACCEPT |
| --- | --- | --- | --- |
| MODEL_YEAR_MATCHED | false | null | Review apenas, se registrado |
| NEW_MODEL_YEAR | true | mmvIdentity + modelYear | Reconhece observação; não materializa produto |

Reconciliação positiva por MMV + MY. Múltiplos MYs coexistem; duplicatas unem evidências.
Ausência de MY explícito produz zero findings e métricas. Não há conflitos de ano,
unknowns, remoções, revisão de anos históricos ausentes ou ação canônica.

## 11. Pesquisa OpenAI

Provider dedicado e prompt versionado. BackgroundResearch extrai o transporte
19C.4 preservando a API pública MMV: Responses, background:true, store:false,
maxRetries:0, timeout/AbortSignal por operação, deadline total, polling e retries
limitados pelo deadline. Não repete create e não faz fallback síncrono silencioso.
Erros crus/cause/headers não são propagados; logs usam códigos seguros.

Web search recebe allowed_domains do connector. JSON estrito valida targetKey,
inteiro MY, confidence, applicability e evidence. Core descarta URLs externas/sem
suporte explícito e preserva contagem de rejeições. Excerpt deve conter MY + modelo
+ versão na mesma frase, sem exclusão; MODEL_LINE exige marcador de linha.
Evidence usa domínio e fingerprint SHA-256 e persiste em agent_evidence.

## 12. Benchmarks de fixtures executados no CLI

| Marca | Run | MMVs | MY matched | MY novo | Sem MY / externas rejeitadas |
| --- | --- | ---: | ---: | ---: | --- |
| VW | 8f82e6ba-c43d-4ae4-b2d8-2a67604221e8 | 1 | 1 | 1 | 0 / 0 |
| Toyota | 57c9493a-fefe-4dc2-9bf2-5a0794fd47f4 | 1 | 1 | 1 | 0 / 0 |
| Jeep | dfbdf86d-a262-437d-aa6a-f6f87d15e381 | 1 | 1 | 1 | 0 / 0 |

Catálogo conhecido [2025, 2026], observações 2026 e 2027. São fixtures sintéticas,
sem alegação de disponibilidade real. Reports JSON/Markdown ignorados pelo Git,
sem persistência nas três execuções. Persist opt-in foi testado com mocks.

## 13. Testes

| Conjunto direcionado | Arquivos | Aprovados |
| --- | ---: | ---: |
| Core MY + plataforma + MMV/cross-brand/connector | 7 | 290 |
| adapter-openai completo, transportes mockados | 4 | 86 |
| adapter-supabase operacional/connector/migrations, SDK mockado | 4 | 23 |
| CLI agentes completo | 4 | 58 |
| Admin plataforma e connector, renderização SSR | 2 | 34 |
| **Total direcionado** | **21** | **491** |

Inclui regras A–I, zero findings sem MY, MY múltiplo/deduplicado, histórico ausente,
identidade oficial VW versus catálogo, exclusão de findings/reviews inelegíveis,
URL externa/credenciais/URL-year, aplicabilidade e exclusões textuais, chave inventada,
JSON MY-only, polling/deadline/erros seguros, imutabilidade/replay, ACCEPT review-only,
CLI configuração/opt-in/segredos e apresentação genérica Informativo/Aberto.

## 14. Gates

- pnpm lint final: **passou**, 9 tasks; duas com cache compartilhado de worktree.
- pnpm build final: **passou**, Next.js 15.5.20, execução sem cache de build.
- Typechecks core/adapter-openai/adapter-supabase/agents: **passaram**.
- pnpm typecheck global final: somente os cinco TS2554 de preços públicos já documentados.
- pnpm test global: 1030 testes core passaram, um timeout comercial preexistente;
  Turbo interrompeu o restante. Suites relevantes restantes foram executadas diretamente.
- pnpm format:check global: reportou 577 arquivos; comparação com base registrada abaixo.
- Formatação de todos os arquivos TS/TSX/JSON alterados: **passou**. Docs/SQL são excluídos
  pelo .prettierignore existente. Falha inicial de passagem de argumentos foi corrigida
  usando pnpm.cmd; a execução final retornou zero.
- git diff --check: **passou**. Índice vazio; nenhum diff em Legacy/migrations 19B/19C.

Logs locais: .local-reports/agents/model-year/validation/.
Runtime usado: Node 24.15.0, pnpm 10.34.5. Node 22.x é o declarado pelo projeto.

## 15. Baseline e limitações

A referência é SPRINT_19C_VALIDATION.md / SPRINT_19C4_BACKGROUND_RESEARCH.md.
Os cinco TS2554 em apps/web/test/admin-product-public-prices.test.ts:101–105
correspondem à base. O timeout de 5000ms em commercial-document-domain-mapping.test.ts
(Fiat-like recipients) também está documentado na base. Não foram corrigidos.
As demais falhas globais antigas de UI/preços não foram reexecutadas integralmente
após o Turbo interromper; não são alegadas como novos resultados desta Sprint.

A comparação dos 577 warnings com o commit base encontrou 15 arquivos cujo conteúdo
versionado já falha no Prettier, 561 warnings em arquivos inalterados deste checkout
(evidência amostral: CRLF no working tree versus LF no Git, mesmo conteúdo normalizado)
e um warning intermediário no teste Admin editado, já corrigido. O check final de
todos os arquivos alterados passou. Portanto não se equipara a contagem desta máquina
à contagem histórica de 537 da 19C; a base e o checkout explicam a diferença observada.
Detalhes locais: format-baseline-comparison.json.

**PENDENTE:** Node 22 smoke, migration Staging, contagem remota de registros legados e
pesquisa real autorizada. Não se afirma que a base remota tenha zero registros antigos.
Validação visual em browser não foi feita; Admin foi testado por SSR.

O filtro textual é conservador: evidência válida distribuída em tabelas/frases pode
ser omitida; não é prova semântica completa ou verificação independente da página.
Compatibilidade real background:true/store:false permanece pendente do teste autorizado.
Leituras de catálogo/reviews não são snapshot; persistência pressupõe writer único por
run. Labels continuam formando a identidade virtual. Esses limites estão documentados.

## 16–17. Segurança e operações remotas

- **Zero chamadas reais OpenAI. Zero leituras/escritas Supabase remotas.**
- Zero operações Railway/Vercel, scheduler, FIPE, specs, preços ou políticas comerciais.
- Sem produtos criados/atualizados/excluídos e sem alterações de Active/Public.
- Nenhum segredo, .env ou report local incluído no diff; entradas conhecidas redigidas.
- Supabase permanece isolado no adapter existente. A nova leitura é port, sem tabelas no core.
- SQL somente em PostgreSQL descartável sem rede. Migration remota não autorizada/executada.
- Nenhum conteúdo de Legacy alterado. Nenhuma alteração no worktree concluído da 19C.

## 18. git status --short

~~~text
 M AI_CONTEXT.md
 M CHANGELOG.md
 M apps/web/test/agent-platform.test.tsx
 M docs/agents/AGENT_PLATFORM_ARCHITECTURE.md
 M docs/agents/NEW_PRODUCT_CHECK_AGENT.md
 M package.json
 M packages/adapter-openai/src/index.ts
 M packages/adapter-openai/src/product-research-provider.ts
 M packages/adapter-supabase/test/agent-platform-supabase-adapter.test.ts
 M packages/core/src/agent-platform/types.ts
 M packages/core/src/agents/index.ts
 M packages/core/test/agent-platform.test.ts
 M scripts/agents/agent-diagnostics.ts
?? docs/agents/MODEL_YEAR_AGENT_20.md
?? docs/agents/SPRINT_20_VALIDATION.md
?? docs/agents/prompts/model-year-agent-v1.md
?? packages/adapter-openai/src/background-research.ts
?? packages/adapter-openai/src/model-year-research-provider.ts
?? packages/adapter-openai/test/model-year-research-provider.test.ts
?? packages/adapter-supabase/test/model-year-migration.test.ts
?? packages/core/src/agents/model-year-agent.ts
?? packages/core/src/agents/model-year-discovery-reader.ts
?? packages/core/src/agents/model-year-fixture.ts
?? packages/core/src/agents/model-year-types.ts
?? packages/core/test/model-year.test.ts
?? scripts/agents/model-year-cli.ts
?? scripts/agents/run-model-year.ts
?? scripts/agents/test/model-year-cli.test.ts
?? supabase/migrations/20260915163527_sprint_20_model_year.sql
?? supabase/tests/model_year_20_local.sql
~~~

## 19. Procedimento recomendado de Staging — não executado

1. Após autorização separada, revisar este diff e executar smoke em Node 22.
2. Confirmar Staging correto, versões 19B/19C e backup; consultar somente então
   quantidades de PRODUCT_YEAR/NEW_PRODUCT_YEAR e baseline das tabelas canônicas.
3. Aplicar apenas 20260915163527_sprint_20_model_year.sql. Conferir CHECK, RLS,
   grants e ausência de policies de browser; não alterar migrations históricas.
4. Confirmar connector VW/BR ACTIVE e última MMV_DISCOVERY COMPLETED com MMV_MATCHED
   resolvidos; rejeições/adiamentos devem ficar fora. Não criar identidades faltantes.
5. Autorizar uma execução real explícita:
   pnpm agent:model-year:dry-run -- --brand VW --provider openai --persist-findings
6. Conferir run MODEL_YEAR COMPLETED, targets oficiais/canônicos, known MY, domínio,
   suporte explícito e fingerprints em agent_evidence. Somente os dois tipos permitidos;
   ausência de evidência deve aumentar métrica, sem item de review.
7. Conferir Admin e, se houver NEW_MODEL_YEAR, registrar ACCEPT apenas como review.
   Comparar counts/conteúdo canônico antes/depois: produtos, specs e preços invariantes.
8. Registrar resultado real, duração, custos/uso se disponíveis e pendências. Novas
   execuções Toyota/Jeep ou scheduler exigem o escopo de autorização correspondente.

A evolução futura MMV → MY → revisão de configuração e possível obsolescência de
Production Year está documentada, sem implementação ou schema nesta Sprint.
