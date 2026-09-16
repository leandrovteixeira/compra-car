# Sprint 20.2 — Structured MY & FIPE Identity Bridge

## Fechamento final — Sprint 20 / 20.1 / 20.2 / 20.2.1

**SPRINT 20 — MODEL YEAR AGENT: COMPLETE / REAL STRUCTURED END-TO-END VALIDATED.**

[Estado final, smoke real, validações e exclusões](SPRINT_20_CHECKPOINT.md). Smoke real COMPLETED, run `97ebfdad-4882-45fd-ae78-638cfa440ba7`, conforme evidência fornecida pelo operador: oito MMVs com MY, oito MODEL_YEAR_MATCHED, quatro NEW_MODEL_YEAR e zero OpenAI. Seções locais/sem commit abaixo são históricas; Spec Intelligence (21) é o próximo passo.

Workspace: C:/Dev/compra-car-model-year. Branch: sprint-20-model-year-agent. Implementação local em 2026-09-15, sobre Sprint 20/20.1 ainda sem commit.

## Gate real posterior

[Gate Webmotors real](SPRINT_20_2_WEBMOTORS_REAL_GATE.md): dois HTTP 200, correção mínima de título dos cards, anos 2027–2021 e quatro matches Nivus 2027 com FIPE. A pendência de captura destas duas páginas foi resolvida; o texto abaixo registra o estado inicial offline. Não foi executado o agente com banco real.

## Status e limite de validação inicial

Fluxo estruturado, reconciliação, fallback e CLI implementados e testados offline. **PENDENTE: validar/adaptar seletores com capturas HTML reais do Webmotors.** O pedido fornece URLs e dados observados, mas nenhum HTML capturado foi encontrado no workspace. Foi solicitada a localização das capturas. As fixtures HTML atuais são explicitamente sintéticas, construídas dos fatos fornecidos; não são apresentadas como captura real. A compatibilidade do parser com a página publicada e ganho de recall/custo real não foram demonstrados. Nenhum endpoint adicional foi inventado.

## 1. Arquitetura estruturada

Resolved MMVs → grupos por marca/modelo → lookup estruturado → linhas de versão/MY → reconciliação determinística → MATCHED/NEW. Um ano na página raiz não gera observação por si só. Cada MY exige linha de versão da página daquele ano, cabeçalho compatível e vínculo único ao MMV resolvido.

MONITOR é padrão: até dois anos mais recentes listados, maiores/iguais ao maior MY conhecido do grupo. BASELINE: três anos recentes, opção do provider limitada a cinco. Não existe reconstrução histórica ilimitada nem inferência a partir do ano corrente. Modelo cuja cobertura mais recente já foi obtida não dispara pesquisa ampla adicional neste run.

## 2. Adapter Webmotors

Novo pacote adapter-webmotors implementa StructuredModelYearProvider com transport e parser injetáveis. URLs: /tabela-fipe/carros/{brand}/{model} e /{MY}. Extrai links de ano e tabela com cabeçalhos Versão/Código FIPE; não usa LLM nem regex gigante para analisar HTML. O cabeçalho de modelo/ano da página deve ser compatível. DOM é analisado sem executar scripts.

A composição da CLI reutiliza node-html-parser já empacotado no Next instalado no monorepo, por uma ponte em model-year-html-parser.ts. Core e adapter não dependem de Next. Essa ponte depende do bundle interno da versão fixada do Next e deve ser revista em upgrades ou extração para execução standalone. Nenhum pacote externo foi baixado; pnpm install foi offline. O lockfile muda apenas para os novos vínculos workspace.

O mapeamento VW → volkswagen é exclusivamente configuração de slug da URL do provider, não alias de identidade/matcher. Outras marcas usam slug normalizado; rotas excepcionais podem ser configuradas no provider. Não se busca URL fornecida pelo LLM.

HTTP usa GET público, hostname fixo www.webmotors.com.br, HTTPS sem credenciais/portas/query, paths permitidos, redirects manuais limitados a dois e à mesma página/host. URLs localhost/IP privado/host externo não passam pela allowlist. Limites: timeout padrão 10s (máximo 15s), corpo 2MB (máximo configurável 4MB), pacing padrão 500ms (mínimo 250ms), nenhuma retentativa. 403/429/5xx, challenge, timeout, resposta incompatível e redirect externo tornam a fonte indisponível; não há bypass, proxy ou sessão automatizada.

## 3. Agrupamento, cache e matching

Uma raiz e cada página de ano são compartilhadas por todas as versões elegíveis do modelo. Cache de promises (inclusive falhas) reiniciado por run; não há cache canônico ou eterno. Marcas/modelos diferentes têm fluxos separados.

Matching exige modelo/marca compatíveis, trim, powertrain quando resolvido e constraints disponíveis de cilindrada/transmissão/propulsão/tração. Sem powertrain estruturado, requer os tokens da versão oficial inteira. A ordem de tokens não importa, mas similaridade fuzzy não autoriza identidade. Sem trim resolvido, rejeita. Múltiplos MMVs candidatos ou versões estruturadas incompatíveis que poderiam mapear ao mesmo target/ano geram ambiguidade. Nenhum nome do catálogo é modificado.

## 4. FIPE code candidate e handoff

Payload preserva sourceTiers, sourceKinds, sourceDomains e fipeCodeCandidates [{code, sourceKind, sourceUrl, modelYear, observedVersionLabel}]. A identidade MMV está no subject/proposal/finding correspondente; confiança continua na observação/finding. Código usa seis dígitos, hífen e um dígito, normalizando somente espaços externos. Código malformado produz FIPE_CODE_INVALID separado, sem descartar MY/version válidos.

Futuro fluxo: MMV ↔ mapeamento FIPE com proveniência/histórico → código → MY → mês de referência → valor. Um código pode aparecer em vários MYs; não pertence inerentemente a um produto/PY. A Sprint 23 FIPE Search Agent consumirá mmvIdentity, modelYear e candidatos, validará o código, persistirá seu próprio mapeamento revisado e atualizará valores/histórico mensal. Nenhuma dessas escritas ou tabelas foi implementada.

## 5. Fallback estruturado → fabricante → concessionária

Structured valida primeiro todos os grupos. Hybrid calcula os alvos sem observações aceitas e solicita uma tarefa oficial por grupo restante, usando ACTIVE e BackgroundResearch da 19C. Uma resposta do modelo só suprime fallback depois de validada pelo core. Dealer é último estágio, apenas com --allow-dealer e alvos ainda não resolvidos; exige página do dealer mais autorização oficial vinculando nome/domínio. Fabricante bem-sucedido impede busca de dealer.

provider=structured não inicializa OpenAI. Hybrid carrega/configura OpenAI somente quando precisa entrar no fallback. Falta de configuração/falha no fallback vira estágio FAILED seguro e preserva resultados estruturados. Supabase é necessário para leituras de catálogo/discovery/connector no CLI real, mesmo sem persistência. O loader 19C.2 permanece compartilhado.

## 6. Fontes e remoção de pesquisa de publicações

Tiers atuais: STRUCTURED_AUTOMOTIVE_DATA, MANUFACTURER_OFFICIAL, AUTHORIZED_DEALER. Source kinds: WEBMOTORS_FIPE, WEBMOTORS_CATALOG, CARROSNAWEB, FIPE_OFFICIAL e os dois kinds de fallback. Só WEBMOTORS_FIPE está habilitado como fonte estruturada implementada; demais kinds são capacidade futura, não bypass de confiança.

Foram removidos registro, corroboração, estágio, métricas e testes exclusivos da estratégia de publicações. Motivo: run 20.1 informado pelo operador cobriu 3/8 com 24 estágios, 47 rejeições e cerca de 25 minutos. Relatórios locais históricos permanecem intactos. CarrosNaWeb e FIPE oficial ficam pendentes para integração suportada/capturada; nenhuma API não oficial foi inventada.

## 7. Limites de custo e auditoria

- MODEL_YEAR_MAX_OPENAI_MODEL_GROUPS: padrão 2, faixa 0–10. Orçamento compartilhado de tarefas modelo/estágio no hybrid, incluindo dealer.
- MODEL_YEAR_MAX_TOOL_CALLS: padrão 3, faixa 1–10, por tarefa. Enviado como max_tool_calls e validado contra calls retornadas. O SDK local expõe o campo no contrato de eventos de criação, mas não no tipo HTTP de criação; a propriedade é enviada por extensão do objeto. Aceitação do limite pelo serviço ainda não foi validada com chamada real.
- MODEL_YEAR_OPENAI_MAX_WAIT_MS: padrão 120000, faixa 60000–300000, por tarefa.
- Concorrência 1; padrão de até 2 tarefas × 3 tools, até 120s por tarefa, além da coleta HTTP limitada. Não é estimativa monetária.

Budget esgotado registra skippedDueToBudget por grupo/estágio pulado, sem descartar findings existentes. As contagens de jobs estão no summary; tentativas por target referenciam tarefas compartilhadas, portanto não se deve somar webSearchCount entre targets para calcular jobs/custo.

Métricas: modelGroups, structuredModelFetches, structuredYearFetches, structuredRowsParsed/Matched/Rejected, openAiModelGroupsResearched, dealerModelGroupsResearched, skippedDueToBudget, fipeCodeCandidates e cobertura MY. structuredRowsRejected conta linhas rejeitadas; rejectedObservations pode ter mais registros por ligar a rejeição aos targets afetados. FIPE inválido é rejeição de candidato separada, não linha/MY rejeitada.

Rejeições estruturadas incluem VERSION_NOT_MATCHED, VERSION_AMBIGUOUS, YEAR_PAGE_INVALID, SOURCE_UNAVAILABLE (prefixo STRUCTURED_) e FIPE_CODE_INVALID. Observed label, target, MY, fonte e reasonCode são preservados no report. Rejeições não viram agent_findings. Dados completos de HTML/output OpenAI não são armazenados. COMPLETED significa reconciliação finalizada; conferir FAILED/skips para completude da pesquisa.

## 8. Testes

Fixtures Webmotors: anos 2027/2026 e quatro versões Nivus com códigos 005525-5, 005526-3, 005548-4 e 005553-0. Testes cobrem parsing, agrupamento/cache, quatro NEW MYs de uma página, códigos, erros HTTP/redirect/timeout/tamanho, ambiguidade, código inválido separado, MATCHED/NEW, múltiplos MYs, ausência de PY e escritas canônicas, fallback e orçamento. Toyota e Jeep mantêm regressões oficiais/dealer e matching estruturado genérico.

Resultados e gates finais são registrados ao final deste documento. Testes de transporte usam mocks; nenhuma fixture executa HTTP real.

## 9. Gates e baseline

Baseline 20.1: cinco TS2554 em apps/web/test/admin-product-public-prices.test.ts:101–105; timeouts intermitentes em commercial-document-domain-mapping.test.ts; 576 arquivos com avisos de formatação. Não se corrigem problemas fora do escopo. Node local é 24.15.0, projeto declara 22.x. Logs em .local-reports/agents/model-year/validation-20-2 (ignorados pelo Git).

## 10. Arquivos

Criados: packages/adapter-webmotors (src, testes, duas fixtures HTML, package/tsconfig); core model-year-structured.ts, model-year-structured-match.ts e teste; scripts/agents/model-year-html-parser.ts; este relatório.

Alterados: core MY types/evidence/agent/index e testes de coverage; adapter-openai MY provider/test; scripts/agents/run-model-year.ts, teste CLI e package.json; pnpm-lock.yaml; prompt MY; MODEL_YEAR_AGENT_20, SPRINT_20_VALIDATION, SPRINT_20_1_COVERAGE_EVIDENCE, AGENT_PLATFORM_ARCHITECTURE, AI_CONTEXT e CHANGELOG. Removido model-year-source-policy.ts (somente política antiga). Arquivos preexistentes não listados aqui pertencem à Sprint 20/20.1.

## 11. Migration e contrato preservados

Nenhuma migration criada/aplicada/alterada. 20260915163527_sprint_20_model_year.sql conserva SHA-256 4B81C6A5E1DB814271DFF29A50D7E445DC391C5651BFE77B2175236DE892AFAA. Só MODEL_YEAR_MATCHED e NEW_MODEL_YEAR; Accept review-only, sem produtos, FIPE canônico, preços, Production Year, RLS/policies/grants ou Legacy alterados.

## 12. Chamadas remotas

Zero OpenAI, Supabase remoto, Webmotors, CarrosNaWeb, FIPE, Railway ou Vercel durante implementação/testes/build. Instalação de workspace foi offline com cache local. Nenhum run real executado.

## 13. Git

Trabalho permanece sem stage/commit/push na branch sprint-20-model-year-agent. Índice vazio; status acumulado da Sprint 20/20.1/20.2 registrado abaixo na validação final.

## 14. Próxima validação real ZERO-OPENAI — não executada

Após validar/adaptar o parser contra captura real e autorizar a execução de rede/persistência:

~~~powershell
pnpm agent:model-year:dry-run -- --brand VW --provider structured --mode monitor --persist-findings
~~~

Exige SUPABASE_URL/SUPABASE_SERVER_KEY para leituras e findings; não exige OPENAI_API_KEY nem OPENAI_AGENT_MODEL. Inspecionar contagens de páginas/linhas, rejeições, códigos candidatos e coverage. Em indisponibilidade do Webmotors, structured reporta falha da fonte sem acionar OpenAI; hybrid é escolha explícita separada.

## Validação final executada

| Suíte direcionada | Testes aprovados | Arquivos |
| --- | ---: | ---: |
| Core MY + Agent Platform/Brand Connector/MMV/produto | 352 | 9 |
| Webmotors parser/HTTP | 24 | 1 |
| OpenAI (mocks, incluindo BackgroundResearch) | 86 | 4 |
| CLI de agentes | 62 | 4 |
| Supabase adapter/migration (mocks/leitura local) | 13 | 2 |
| Admin Agent Platform | 24 | 1 |
| **Total** | **561** | **21** |

- Typechecks relevantes (core, adapter-webmotors, adapter-openai, agents): passaram; core foi reconferido após a última alteração de dedupe FIPE.
- pnpm lint: passou (10 projetos).
- pnpm build: passou; build final repetido após alterações finais, 1m17s.
- Prettier dos arquivos TypeScript/HTML/JSON do incremento: passou. Markdown segue exclusão do repositório.
- git diff --check: passou.
- pnpm typecheck global: cinco TS2554 prévios em admin-product-public-prices.test.ts:101–105, demais projetos passaram.
- pnpm test global: core com 1.093 aprovações e um timeout de 5s no caso Fiat-like recipients de commercial-document-domain-mapping.test.ts; interrupção da suíte global. Mesmo caso já falhava na baseline 20.1. Não alterado nem aumentado timeout.
- pnpm format:check global: 575 arquivos com avisos de estilo no worktree acumulado (baseline 20.1: 576). Nenhuma reformatação em massa.
- Nenhum gate global foi declarado verde quando falhou. Logs preservados localmente.

HEAD preservado: 0fe2acfad8c8b0fc705167986e4bd81e0c8514de. Índice vazio, sem stage/commit/push. Status acumulado final (inclui alterações preexistentes da Sprint 20/20.1):

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
 M pnpm-lock.yaml
 M scripts/agents/agent-diagnostics.ts
 M scripts/agents/package.json
?? docs/agents/MODEL_YEAR_AGENT_20.md
?? docs/agents/SPRINT_20_1_COVERAGE_EVIDENCE.md
?? docs/agents/SPRINT_20_2_STRUCTURED_MY_FIPE_BRIDGE.md
?? docs/agents/SPRINT_20_VALIDATION.md
?? docs/agents/prompts/model-year-agent-v1.md
?? packages/adapter-openai/src/background-research.ts
?? packages/adapter-openai/src/model-year-research-provider.ts
?? packages/adapter-openai/test/model-year-research-provider.test.ts
?? packages/adapter-supabase/test/model-year-migration.test.ts
?? packages/adapter-webmotors/
?? packages/core/src/agents/model-year-agent.ts
?? packages/core/src/agents/model-year-discovery-reader.ts
?? packages/core/src/agents/model-year-evidence.ts
?? packages/core/src/agents/model-year-fixture.ts
?? packages/core/src/agents/model-year-structured-match.ts
?? packages/core/src/agents/model-year-structured.ts
?? packages/core/src/agents/model-year-types.ts
?? packages/core/test/fixtures/model-year-coverage.ts
?? packages/core/test/model-year-coverage.test.ts
?? packages/core/test/model-year-structured.test.ts
?? packages/core/test/model-year.test.ts
?? scripts/agents/model-year-cli.ts
?? scripts/agents/model-year-html-parser.ts
?? scripts/agents/run-model-year.ts
?? scripts/agents/test/model-year-cli.test.ts
?? supabase/migrations/20260915163527_sprint_20_model_year.sql
?? supabase/tests/model_year_20_local.sql
~~~
