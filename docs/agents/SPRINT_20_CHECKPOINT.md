# Checkpoint — Sprint 20 + 20.1 + 20.2

Data: 2026-09-15. Workspace: C:/Dev/compra-car-model-year. Branch: sprint-20-model-year-agent. Base histórica: 0fe2acfad8c8b0fc705167986e4bd81e0c8514de.

## Estado consolidado

**SPRINT 20.2 IMPLEMENTED**
**REAL WEBMOTORS PARSER GATE VALIDATED**
**END-TO-END STRUCTURED CLI SMOKE PENDING**

Este checkpoint consolida o trabalho legítimo das três sprints para commit/push da branch, sem merge em main. O fechamento altera somente documentação; código, testes, fixtures e SQL permanecem byte-for-byte como no início do fechamento. Os reports das sprints anteriores registram estados históricos locais e não substituem este status consolidado.

## Sprint 20 — Model Year Agent

Pesquisa somente Model Year de MMVs resolvidos, dependente de MMV Discovery e Brand Connector ACTIVE. Production Year não participa da lógica de pesquisa/reconciliação. Exatamente dois findings: MODEL_YEAR_MATCHED e NEW_MODEL_YEAR. Reconciliação exclusivamente positiva; Accept registra review, sem escrita canônica, criação de produto ou alterações de catálogo.

Primeira validação real OpenAI, run 408ee6fd-3049-40f9-bb36-e86cfff01884: oito MMVs elegíveis, dois targets com MY explícito, dois MODEL_YEAR_MATCHED e zero NEW_MODEL_YEAR. Catálogo inalterado. As oito rejeições desse run não preservaram detalhe suficiente para reconstrução posterior; a auditoria local foi melhorada na 20.1.

## Sprint 20.1 — validação histórica, superseded pela 20.2

Run 6457c5fe-b6eb-441e-bb83-f02a436805bd: oito MMVs elegíveis, três targets com MY explícito, dois MODEL_YEAR_MATCHED, um NEW_MODEL_YEAR, 24 estágios de busca e 47 observações rejeitadas. Execução com custo/tempo elevado (cerca de 25 minutos conforme relato do operador), catálogo inalterado e Production Year ausente. Esses resultados motivaram o redesenho structured-first. Não é a estratégia operacional final.

Foram preservados os componentes ainda utilizados: evidência em contexto delimitado, proveniência, auditoria de rejeições e autorização de concessionárias. A pesquisa de imprensa foi posteriormente removida por completo do runtime.

## Sprint 20.2 — estratégia operacional atual

Dados estruturados → fallback fabricante → fallback concessionária autorizada.

O Webmotors é o primeiro adapter estruturado. Agrupamento por marca/modelo compartilha raiz e páginas de ano entre MMVs; parsing determinístico extrai MY/versão/código FIPE e matching conservador exige vínculo único com a identidade resolvida. Cache por run evita fetch repetido. MONITOR é padrão, BASELINE tem janela limitada. Rejeições permanecem em reports locais, nunca como findings.

provider=structured não requer OpenAI. provider=hybrid consulta fabricante apenas para alvos não resolvidos; dealer é último fallback, com opt-in e autorização comprovada pelo fabricante. Orçamento limita tarefas por modelo, chamadas de tools e tempo. Imprensa automotiva não tem registro, estágio, corroboração ou métricas no runtime atual.

FIPE codes são candidatos com proveniência, sem escrita canônica. O agente pode entregar mmvIdentity + modelYear + fipeCodeCandidate. A Sprint 23 FIPE Search Agent será responsável por MMV ↔ código FIPE, com histórico/proveniência, e código + MY + mês de referência → valor/histórico FIPE. Nada desse workflow canônico é implementado neste checkpoint.

## Gate real do parser Webmotors

Captura anterior via mesmo transport do adapter, GET público nativo, sem browser, bypass, proxies, login ou cookies artificiais. Nenhuma nova captura foi feita no fechamento.

| Página | HTTP | Bytes recebidos | Redirects |
| --- | ---: | ---: | ---: |
| Nivus root | 200 | 332637 | 0 |
| Nivus / 2027 | 200 | 212308 | 0 |

Host final: www.webmotors.com.br. Content-type: text/html; charset=utf-8. Bytes referem-se ao corpo decodificado entregue por fetch. Anos extraídos: 2027, 2026, 2025, 2024, 2023, 2022, 2021.

| MMV Nivus, MY 2027 | Código FIPE | Resultado |
| --- | --- | --- |
| Comfortline 200 TSI | 005525-5 | MATCH UNIQUE |
| Highline 200 TSI | 005526-3 | MATCH UNIQUE |
| Sense 200 TSI | 005548-4 | MATCH UNIQUE |
| GTS 250 TSI | 005553-0 | MATCH UNIQUE |

HTML real concatena ano e preço no link/card. A correção lê o título separado e exige correspondência com o ano da URL. Parser da tabela de versões e matcher não precisaram de correção. Duas fixtures mínimas derivadas da captura complementam as fixtures sintéticas deliberadas; respostas grandes e scripts de captura não são versionados.

Depois da correção: 29 testes do adapter passaram; typecheck relevante, lint, build via cache, formatação dos arquivos alterados e git diff --check passaram. O gate valida as duas respostas e os quatro MMVs fornecidos, não uma execução completa contra catálogo real. [Relatório detalhado](SPRINT_20_2_WEBMOTORS_REAL_GATE.md).

## Gates e limitações conhecidas

A implementação 20.2 registrou 561 testes direcionados aprovados antes dos cinco testes adicionais do gate real. No fechamento não houve alteração de código e não foi repetida a suíte, conforme escopo solicitado. Foi executado git diff --check e verificada a integridade dos arquivos funcionais.

Gates globais anteriores não estão todos verdes: cinco TS2554 em apps/web/test/admin-product-public-prices.test.ts:101–105; timeout intermitente de 5s no caso Fiat-like recipients em commercial-document-domain-mapping.test.ts; 575 arquivos com avisos de formatação no worktree acumulado. Nenhuma correção fora do escopo. Ambiente anterior Node 24.15.0, projeto declara 22.x.

## Migration

Canônica: supabase/migrations/20260915163527_sprint_20_model_year.sql. Já aplicada em Staging conforme informação do operador. SQL preservado, SHA-256 confirmado antes do commit:

~~~text
4B81C6A5E1DB814271DFF29A50D7E445DC391C5651BFE77B2175236DE892AFAA
~~~

Nenhuma nova migration. Ampliação somente do vocabulário de agent_runs, mantendo PRODUCT_YEAR histórico; sem mudanças em dados, RLS/policies/grants ou schema canônico.

## Exclusões de publicação

Não integram o commit: .env/.env.local, valores de OPENAI_API_KEY/SUPABASE_SERVER_KEY ou outros segredos, C:/Dev/.secrets, .local-reports, node_modules, .next, coverage, caches, temporários, scripts locais de captura ou HTML bruto grande. Referências a nomes de configuração no código não contêm credenciais. As fixtures HTML versionadas são pequenas e deliberadas, sintéticas ou fragmentos reais minimizados/sanitizados.

Esses artefatos locais ignorados não serão transportados pelo Git. O novo notebook precisará das configurações locais apropriadas; não se copiam credenciais para documentação/repositório. Nenhum arquivo estranho às sprints foi identificado na seleção do checkpoint.

## Roadmap

| Sprint | Agente/componente | Estado |
| --- | --- | --- |
| 19A | MMV Discovery Agent | ✅ |
| 19B | Agent Platform | ✅ |
| 19C | Brand Connector Agent | ✅ |
| 20 | Model Year Agent | checkpoint atual |
| 21 | Spec Intelligence Agent | futuro |
| 22 | Price Intelligence Agent | futuro |
| 23 | FIPE Search Agent | futuro |
| 24 | Orchestration / Scheduler | futuro |
| 25 | Agent Operator UX | futuro |

## Próximo gate — NÃO executado

O smoke real completo com provider=structured, mode=monitor e persist-findings ainda não foi executado após a Sprint 20.2. Comando reservado ao próximo gate autorizado:

~~~powershell
pnpm agent:model-year:dry-run -- --brand VW --provider structured --mode monitor --persist-findings
~~~

Este fechamento não faz chamadas OpenAI, Supabase, Webmotors, Railway/Vercel, nem executa esse comando. Somente a publicação Git da branch está autorizada nesta etapa.
