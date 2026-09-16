# Fechamento final — Sprint 20 Model Year Agent

Data: 2026-09-15. Workspace: C:/Dev/compra-car-model-year. Branch: sprint-20-model-year-agent. Checkpoint remoto anterior: dfe8adfe22d93ec7ca6c62e89f89878be7c530d3 (`feat(agent): add structured model year discovery`).

## Estado consolidado

**SPRINT 20 — MODEL YEAR AGENT**
**COMPLETE / REAL STRUCTURED END-TO-END VALIDATED**

Fechamento baseado no smoke e na auditoria fornecidos pelo operador. Nenhuma nova chamada
OpenAI, Supabase ou Webmotors foi realizada neste fechamento. A publicação reúne a correção
20.2.1 já validada e a documentação final, sem merge em main. As edições desta etapa são
somente documentais; código, testes, fixtures e migration foram preservados byte a byte.
Registros anteriores de smoke pendente ou trabalho sem commit são históricos.

## Smoke real final — evidência do operador

- Run: `97ebfdad-4882-45fd-ae78-638cfa440ba7`.
- Provider: `structured`; status: `COMPLETED`; schema: `20.2-structured-v1`.
- Monitoring structured-first com parsing Webmotors determinístico. OpenAI não foi
  necessário para este run VW bem-sucedido; fabricante/dealer permanecem capacidades
  de fallback. Imprensa foi removida do runtime.

| Métrica | Valor |
| --- | ---: |
| modelGroups | 3 |
| structuredModelFetches | 3 |
| structuredYearFetches | 4 |
| structuredRowsParsed | 14 |
| structuredRowsMatched | 12 |
| structuredRowsRejected | 2 |
| openAiModelGroupsResearched | 0 |
| dealerModelGroupsResearched | 0 |
| skippedDueToBudget | 0 |
| fipeCodeCandidates | 12 |
| eligibleMmvs | 8 |
| targetsResearched | 8 |
| targetsWithExplicitMy | 8 |
| targetsWithAnyExplicitMy | 8 |
| targetsWithStructuredMy | 8 |
| targetsWithoutExplicitMy | 0 |
| structuredObservationsAccepted | 12 |
| MODEL_YEAR_MATCHED | 8 |
| NEW_MODEL_YEAR | 4 |
| rejectedObservations | 4 |
| rejectionsByReason.STRUCTURED_VERSION_NOT_MATCHED | 4 |
| searchStagesCompleted | 8 |
| searchStagesFailed | 0 |

Duas linhas structured rejeitadas geram quatro registros de rejeição por target;
contadores de linhas e observações rejeitadas não são intercambiáveis. Não há inferência
sobre quais versões compõem essas duas linhas além dos dados fornecidos pelo operador.

### Novos MY reais

Todos `NEW_MODEL_YEAR`, `requiresReview = true`. Códigos FIPE são somente candidatos.

| MMV | MY | FIPE candidate |
| --- | ---: | --- |
| Nivus Comfortline 200 TSI | 2027 | 005525-5 |
| Nivus Highline 200 TSI | 2027 | 005526-3 |
| Nivus Sense 200 TSI | 2027 | 005548-4 |
| Nivus GTS 250 TSI | 2027 | 005553-0 |

### MY reais já conhecidos

Todos `MODEL_YEAR_MATCHED`, `requiresReview = false`.

| MMV | MY |
| --- | ---: |
| Nivus Comfortline 200 TSI | 2026 |
| Nivus Highline 200 TSI | 2026 |
| Nivus Sense 200 TSI | 2026 |
| Nivus GTS 250 TSI | 2026 |
| Taos Comfortline 250 TSI | 2026 |
| Taos Highline 250 TSI | 2026 |
| Tera Comfort | 2026 |
| Tera High | 2026 |

### Auditoria canônica final informada

| Conjunto | Contagem preservada |
| --- | ---: |
| products | 277 |
| specs | 321 |
| product_specs | 37949 |
| product_public_prices | 818 |

Nenhuma escrita canônica ocorreu. Ocorrências de Production Year no subject/proposal/payload
dos findings Model Year: **0**. Production Year permanece fora da lógica Model Year.
FIPE Search Agent (23) será responsável pelo futuro mapeamento canônico MMV ↔ FIPE e pelos
valores FIPE; os 12 candidatos deste run não materializam esse mapeamento.

## Sprint 20.2.1 — causa raiz e correção

O primeiro run structured (`efabe25f-34c9-4c8f-b419-0ac6090242ed`) processou
14 linhas e casou apenas Tera (dois matches). O matcher Model Year duplicava um parser
local inferior, que não reconhecia o feminino português presente no MMV Discovery:
“Automática de 6 velocidades” e “Automática de 8 velocidades”, contra “Automático” no Webmotors.

A correção reutiliza `normalizeTransmissionFamily()` para target e label observado,
sem regra específica de marca. Mantém comparação conservadora de famílias e fallback
literal para target desconhecido. Regressões: Nivus 4/4, Taos 2/2, Tera 2/2.
O gate real agora compartilha a fixture de targets com transmissão explícita do runtime.
[Implementação, fixtures e totais exatos dos testes](SPRINT_20_2_1_TRANSMISSION_MATCHING.md).

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

HTML real concatena ano e preço no link/card. A correção lê o título separado e exige correspondência com o ano da URL. Naquele gate, o parser da tabela e o matcher não foram alterados; os targets usavam transmissão nula. O smoke posterior revelou a lacuna corrigida na 20.2.1. Duas fixtures mínimas derivadas da captura complementam as fixtures sintéticas deliberadas; respostas grandes e scripts de captura não são versionados.

Depois da correção: 29 testes do adapter passaram; typecheck relevante, lint, build via cache, formatação dos arquivos alterados e git diff --check passaram. O gate valida as duas respostas e os quatro MMVs fornecidos, não uma execução completa contra catálogo real. [Relatório detalhado](SPRINT_20_2_WEBMOTORS_REAL_GATE.md).

## Gates e limitações conhecidas

Gates 20.2.1 já executados: 179 testes dirigidos passaram (150 core + 29 adapter),
typecheck dos pacotes envolvidos, lint global, build sem cache, formatação dos arquivos
alterados e git diff --check passaram. Suíte global: 1.433 passaram, um falhou em mock
não alterado de preços públicos (método .in ausente), três integrações ignoradas.
Typecheck global: cinco TS2554 preexistentes em admin-product-public-prices.test.ts:101–105.
Formatação global: 611 arquivos com avisos fora desta correção. Node local 24.18.0;
o projeto declara 22.x, cujo smoke continua pendente como limitação de ambiente.

Neste fechamento documental, a suíte não foi repetida conforme pedido. Foram revisados
git diff --check, git status --short, git diff --stat, seleção explícita para publicação
e integridade da migration. Nenhuma correção funcional além da 20.2.1 foi incluída.

## Migration

Canônica: supabase/migrations/20260915163527_sprint_20_model_year.sql. Já aplicada em Staging conforme informação do operador. SQL preservado. SHA-256 dos bytes versionados no Git (LF), confirmado antes do commit:

~~~text
4B81C6A5E1DB814271DFF29A50D7E445DC391C5651BFE77B2175236DE892AFAA
~~~

O arquivo físico local usa CRLF e tem SHA-256 `768CADD6CCC9CF55A487C3013CE2D599BE144448FFA91CACC92DEC8454065EC1`. Sua projeção LF coincide com o SHA esperado acima e `git hash-object` coincide com o blob HEAD (`98862e116a8d72e09e311af86cc0b06ae57a635d`). Nenhum byte do arquivo foi alterado neste fechamento.

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
| 20 | Model Year Agent | ✅ |
| 21 | Spec Intelligence | ← NEXT |
| 22 | Price Intelligence Agent | futuro |
| 23 | FIPE Search Agent | futuro |
| 24 | Orchestration / Scheduler | futuro |
| 25 | Agent Operator UX | futuro |

## Próximo passo

**21 Spec Intelligence ← NEXT.** Sprint 20 está concluída com smoke real structured
end-to-end validado conforme evidência do operador. Não repetir esse smoke neste fechamento.
A publicação autorizada é somente commit/push da branch sprint-20-model-year-agent,
com mensagem `fix(agent): complete structured model year matching`, sem merge em main.
