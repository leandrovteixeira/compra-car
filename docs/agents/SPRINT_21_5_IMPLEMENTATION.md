# Sprint 21.5 — implementação e checkpoint

## A. Workspace

- Workspace: `C:\Dev\compra-car-spec-intelligence`.
- Branch: `sprint-21-spec-intelligence`.
- HEAD: `dcd67340b69415068ba1ada749865497697ad120`.
- Runtime selecionado em cada processo: Node **v22.23.2**, pnpm **10.34.5**; Node global preservado.
- Estado inicial: working tree já continha a implementação 21.1–21.4 e benchmark, com arquivos modificados e não rastreados. Snapshot completo: `.local-reports/sprint-21-5/initial-status.txt`. Não era clean. Nenhum reset/clean/stash foi executado.
- O workspace original `C:\Dev\compra-car` não foi alterado.

## B. Arquitetura

Anterior: discovery → safe fetch → parsers determinísticos PDF/HTML → fallback semântico → observações.

Atual: discovery → política central → router → Terra Document Intelligence → validator → Sol opcional → nova validação → inventário da fonte → aplicabilidade ao target → SpecObservations para futura Sprint 22.

O modo hybrid usa Document Intelligence como leitor de documentos complexos. PDF original vai ao modelo; extração textual local serve apenas para QA e grounding. HTML preserva blocos, títulos, tabelas, cards, contexto ancestral e JSON embutido. O parser legado foi preservado para discovery, sanitização, contexto, diagnóstico e fontes estruturadas. Não é mais o leitor primário de PDF complexo. O modo fixture permanece padrão seguro da CLI, sem gasto automático.

O router expõe DETERMINISTIC_STRUCTURED para fonte declarada lossless, DOCUMENT_INTELLIGENCE e REJECT_SOURCE. Não supõe que qualquer tabela/JSON seja completo. No hybrid, o provider executa a estratégia Document Intelligence e registra essa estratégia efetiva.

## C. Política de fontes

| Classe | Decisão |
| --- | --- |
| TECHNICAL_SHEET | Permitida |
| OFFICIAL_MODEL_PAGE | Permitida |
| OFFICIAL_CONFIGURATOR | Permitida |
| OFFICIAL_STRUCTURED_DATA | Permitida |
| OFFICIAL_TECHNICAL_PAGE | Permitida |
| OWNER_MANUAL | Excluída |
| DEALER | Excluída |
| PRESS | Excluída |
| MEDIA_REVIEW | Excluída |
| WEBMOTORS | Excluída |
| FORUM | Excluída |
| AGGREGATOR | Excluída |
| THIRD_PARTY_DATABASE | Excluída |
| UNKNOWN / catálogo genérico | Rejeitada sem classificação técnica explícita |

A política está em `spec-source-policy.ts`, reutilizada por discovery, fetch e provider. Exclusões explícitas prevalecem sobre hints. PDF exige TECHNICAL_SHEET. Ficha técnica do target ganha prioridade; candidatos de versão explicitamente conflitante são rejeitados. As proteções existentes de HTTPS, allowlist e redirects permanecem.

## D. Document Intelligence

Contrato: `DocumentIntelligenceProvider.extract(source, target, options)`. Fontes suportam PDF_FILE, HTML_DOCUMENT, STRUCTURED_HTML, STRUCTURED_JSON e CONFIGURATOR_SNAPSHOT.

A saída inclui identidade/evidências, seções, headings publicados, grupos, labels, valores/unidades literais, VALUE/PRESENT/EXPLICIT_ABSENT/TEXT/COMPOSITE/OPTION e aplicabilidade. Metadados de modelo, responseId, uso, custo, duração e hash são adicionados pelo código, sem confiar no modelo para contabilidade. O relatório preserva inventário, blocos da fonte e rejeições; não duplica bytes PDF.

O target de document intelligence admite MY nulo para não inventar ano no replay CS55. Sem MY resolvido, não emite SpecObservations de catálogo.

Terra: `gpt-5.6-terra`, Responses API, reasoning low, strict JSON Schema, tools vazias, máximo 18.000 tokens de saída. PDF utiliza `input_file` com bytes originais em data URI, não texto achatado. HTML utiliza blocos úteis limitados. Prompt versionado: [v1](prompts/spec-source-document-intelligence-v1.md).

Esta implementação descende do benchmark nativo CS55; o schema foi ampliado explicitamente para evidências, hierarquia e aplicabilidade. Benchmark original permanece reproduzível.

Sol: `gpt-5.6-sol`, somente após REPAIR_REQUIRED e orçamento suficiente, no máximo uma chamada. Recebe fonte original, proposta Terra e issues; não recebe Golden ou taxonomia. Não há terceira chamada ou retry automático.

Custo: alvo USD 0,30, aviso acima de USD 0,50, teto USD 1,00/documento. Antes de gerar, conta tokens do payload e calcula máximo usando saída limitada; antes do reparo soma gasto anterior. Excesso → HUMAN_REVIEW_REQUIRED/COST_CAP. Tarifas do benchmark isoladas, por milhão: Terra input/cached/output = 2/2/12; Sol = 4/4/20. Cache conservador sem desconto não confirmado. Reasoning já integra output, sem dupla cobrança. A garantia depende das tarifas configuradas e do contrato de contagem/uso do provedor; não é garantia de preço futuro.

## E. Validator

- PASS: schema e regras estruturais/evidenciais aprovados; warnings podem reduzir aplicabilidade ou excluir fatos de outra versão.
- REPAIR_REQUIRED: defeitos reparáveis, como schema, evidência ausente/não grounded, truncamento, presença não comprovada, duplicação ou estrutura.
- HUMAN_REVIEW_REQUIRED: identidade/conflito documental ou condição impeditiva; prevalece sobre repair. Falha após reparo também termina em revisão, sem abortar todo o run.
- EXACT_VERSION/VERSION_MATRIX requerem escopo e prova explícita. MODEL_SHARED exige prova de compartilhamento. Caso contrário, UNRESOLVED.
- EXACT_MY requer ano explicitamente comprovado; copyright isolado não comprova MY. CURRENT_LINEUP também exige evidência.
- Escopo filho conflitante prevalece sobre contexto de página. O inventário conserva o fato; o conjunto do target o exclui.
- EXPLICIT_ABSENT comprovado gera polaridade negativa e parsedValue false; não vira presença positiva.

Códigos implementados incluem SCHEMA_INVALID, DOCUMENT_IDENTITY_UNRESOLVED, TARGET_BRAND_CONFLICT, TARGET_MODEL_CONFLICT, TARGET_VERSION_CONFLICT, TARGET_MY_CONFLICT, MODEL_YEAR_UNSUPPORTED, EVIDENCE_MISSING, EVIDENCE_NOT_GROUNDED, LIKELY_TRUNCATED_TEXT, DUPLICATE_ITEM, EMPTY_SECTION, PRESENCE_NOT_PROVEN, EXACT_VERSION_NOT_PROVEN, EXACT_MY_NOT_PROVEN, VERSION_SHARED_NOT_PROVEN, STRUCTURE_INCOMPLETE e SUSPICIOUS_ITEM_COUNT.

Validação usa apenas fonte, resposta e target. Não usa contagens Golden nem conhecimento de atributos automotivos canônicos.

## F. Regressão GTS

Target: VW Nivus Comfortline 200 TSI. Escopo filho: GTS 250 TSI. Fato: 250 TSI.

Resultado dos testes: fato preservado no inventário e **não emitido como observação de Comfortline**, inclusive quando o modelo propõe MODEL_SHARED. Cobertura inclui card explícito, ancestral, parágrafo real com “Nivus GTS” e irmãos no mesmo contexto. A rota legada preservada também bloqueia o caso. “Nivus MY 2026” não é confundido com nome de versão.

## G. Regressão OWNER_MANUAL

OWNER_MANUAL → REJECT_SOURCE / SOURCE_KIND_EXCLUDED → **zero fetch, zero contagem de tokens, zero geração** nos casos classificados antes do acesso. Redirect conhecido para manual é bloqueado antes de buscar o destino.

Os testes legados locais de parser PDF foram preservados; fixtures sintéticas antigas não autorizam manual na produção. A política bloqueia fontes identificadas como manual. Classificação de URLs/conteúdos ainda desconhecidos precisa ampliar corpus na 21.7; não se afirma reconhecimento infalível de qualquer manual mal rotulado.

## H. Replay Golden offline

Artefato final: `.local-reports/sprint-21-5/document-1789733974259.json`.

PDF original: 410.902 bytes, uma página. SHA-256: `1D7EA3C93BC01D208201BE3C536303513A8F1753A7886C3C2F236968647874AC`. PDF/Excel locais permanecem ignorados pelo Git.

| Medida | Resultado |
| --- | --- |
| Terra capturado | HUMAN_REVIEW_REQUIRED |
| Issues Terra | DOCUMENT_IDENTITY_UNRESOLVED × 2; EVIDENCE_NOT_GROUNDED × 103 |
| Routing atual | Uma resposta Terra reproduzida; Sol não selecionado |
| Motivo final | IDENTITY_AMBIGUOUS |
| Sol capturado, validado separadamente | HUMAN_REVIEW_REQUIRED; mesmos issues + EMPTY_SECTION × 1 |
| Custo histórico Terra | USD 0.089196 |
| Custo histórico Sol | USD 0.191504 |
| Histórico total | USD 0.280700 |
| Novas chamadas API / novo custo | 0 / USD 0 |

O capture antigo não possui evidência de identidade no novo formato e usa citações sintetizadas, como “PRIME — label — value”, que não coincidem com trechos contíguos da camada textual local. O adapter não fabrica prova nem modifica a fonte para passar. Identidade gráfica e grounding de layout são pendências concretas da 21.6.

Sol NÃO foi chamado pelo fluxo porque REVIEW não autoriza repair. Sua captura existente foi avaliada independentemente para diagnóstico. Duração histórica ausente no response é representada por zero no adapter, não como latência medida nesta execução.

O benchmark histórico continua documentando 104 itens, 100 sem cores, 73 PRESENT, Terra 13/14 seções e Terra+Sol 14/14; comparação normalizada teve ambiguidade de heading CORES versus impressão. Essas métricas não são critérios do validator. Qualidade Golden histórica aprovada não equivale a PASS do novo contrato evidencial.

Comando executado, com caminho real do PDF local:

```powershell
pnpm agent:spec-source:replay -- --benchmark-dir .local-reports/benchmarks/cs55-prime --pdf $pdfPath --target .local-reports/sprint-21-5/cs55-target.json
```

O comando manual `agent:spec-source:benchmark` exige opt-in explícito `--authorize-openai explicit-manual-benchmark` para API real. Não foi usado e não integra CI.

## I. Validação

| Comando na raiz | Resultado |
| --- | --- |
| pnpm --filter @compra-car/agents test --maxWorkers 1 | 185 testes, 9 arquivos |
| pnpm --filter @compra-car/core test document-intelligence.test.ts spec-source.test.ts | 87 testes, 2 arquivos |
| pnpm --filter @compra-car/adapter-openai test | 101 testes, 7 arquivos |
| pnpm --filter @compra-car/adapter-supabase test spec-source-context.test.ts | 10 testes, 1 arquivo; mocks, sem acesso Supabase |
| Total distinto | **383 aprovados**, dos quais 65 novos |
| typecheck core, adapter-openai, agents | Aprovados |
| lint core, adapter-openai, agents | Aprovados |
| Prettier scoped | Aprovado |
| pnpm build | Aprovado; build final do estado atual registrado em build-current.log |
| git diff --check | Aprovado |

Logs locais: `.local-reports/sprint-21-5/*-final.log`, `*-typecheck.log`, `build-current.log`. A primeira execução paralela dos testes agents teve dois timeouts de PDF.js; execução serial passou sem aumentar timeouts ou alterar configuração.

Falhas globais **históricas**, não retestadas nem corrigidas nesta sprint: cinco TS2554 em `apps/web/test/admin-product-public-prices.test.ts:101–105`; cinco timeouts de 5s em três arquivos comerciais (1.149 testes passaram naquele gate); diagnóstico daqueles arquivos passou 67 testes com 20s/um worker; 609 avisos globais de formato. Fonte: [gate 21.3](SPRINT_21_3_REAL_GATE.md). Não se apresenta gate global completo como verde.

## J. Arquivos

Criados nesta 21.5:

- `packages/core/src/agents/document-intelligence-types.ts`
- `packages/core/src/agents/document-intelligence-schema.ts`
- `packages/core/src/agents/document-intelligence-cost.ts`
- `packages/core/src/agents/document-intelligence-scope.ts`
- `packages/core/src/agents/document-intelligence-validator.ts`
- `packages/core/src/agents/document-intelligence.ts`
- `packages/core/src/agents/spec-source-policy.ts`
- `packages/core/test/document-intelligence-fixture.ts`
- `packages/core/test/document-intelligence.test.ts`
- `packages/adapter-openai/src/document-intelligence-provider.ts`
- `packages/adapter-openai/test/document-intelligence-provider.test.ts`
- `scripts/agents/document-intelligence-source.ts`
- `scripts/agents/document-intelligence-replay.ts`
- `scripts/agents/document-intelligence-cli.ts`
- `scripts/agents/document-intelligence.test.ts`
- `docs/agents/prompts/spec-source-document-intelligence-v1.md`
- `docs/agents/SPRINT_21_5_IMPLEMENTATION.md`

Atualizados nesta sprint, inclusive arquivos já não rastreados no checkpoint inicial:

- `.gitignore`, `package.json`, `AI_CONTEXT.md`, `CHANGELOG.md`.
- `docs/agents/SPEC_SOURCE_AGENT_21.md`, `docs/agents/AGENT_PLATFORM_ARCHITECTURE.md`.
- `packages/core/src/agents/index.ts`, `spec-source-types.ts`, `spec-source-discovery.ts`, `spec-source-roles.ts`.
- `packages/adapter-openai/src/index.ts`.
- `scripts/agents/run-spec-source.ts`, `spec-source-runtime.ts`, `spec-source-fetch.ts`, `spec-source-html-sections.ts`.
- `scripts/agents/spec-source.test.ts`, `spec-source-discovery.test.ts`, `spec-source-technical.test.ts`, `spec-source-quality.test.ts`.

Nenhuma nova dependência da 21.5. AJV, SDK OpenAI e infraestrutura PDF existentes foram reutilizados. Mudanças anteriores em adapter-supabase, lockfile e demais arquivos foram preservadas. Artefatos de replay/logs permanecem locais e ignorados.

## K. Invariantes

Confirmado nesta execução: nenhuma leitura do Spec Master; nenhum código canônico na saída de produção; nenhuma comparação com product_specs; nenhuma chamada ou escrita Supabase; nenhuma migration/DDL; nenhuma persistência Agent Platform; nenhum manual aceito como fonte; nenhuma nova chamada OpenAI; nenhum smoke web; nenhuma pesquisa real VW/Jeep/Toyota; nenhum stage/commit/push/merge. Strings proibidas aparecem apenas em instruções negativas e testes que verificam rejeição, não como campos do contrato.

## L. Avaliação e próxima etapa

1. **Pipeline CS55 representado na arquitetura de produção? Sim.** Mesma linhagem de PDF nativo → Terra → validar → Sol condicional, com contratos evidenciais novos.
2. **Terra leitor padrão? Sim**, no caminho documental hybrid; fixture continua modo CLI seguro.
3. **Sol condicional? Sim.** Apenas REPAIR_REQUIRED, orçamento disponível e uma tentativa.
4. **Teto USD 1 aplicável? Sim**, com contagem prévia, limite de saída e tarifas configuradas; depende dessas premissas.
5. **Manuais impedidos? Sim para fontes identificadas pela política**, inclusive antes de fetch/model; reconhecimento de fontes desconhecidas permanece trabalho da 21.7.
6. **GTS → Comfortline bloqueado? Sim**, nas regressões de card, ancestral e texto real cobertas.
7. **PDF e website compartilham abstração? Sim**, com inputs específicos e contrato de saída/validator comum.
8. **Pronto para 21.6? Sim como base implementada e testada.** Não significa gate real de produção/cross-brand aprovado.
9. **Lacunas exatas:** grounding de identidade gráfica/PDF; citações que atravessam layout e linhas; migração de capturas antigas sem inventar evidências; detecção de omissões sem Golden; validação ampliada de matrizes/JSON e grupos; corpus de classificação de fontes; calibração de preços/contagem em futura execução autorizada; prova real do prompt/schema novos. MY ausente continua nulo e não deve ser inferido.

Roadmap preservado: 21.1–21.4 exploração; **21.5 provider**; 21.6 validator/repair; 21.7 discovery/policy; 21.8 gate real VW/Jeep/Toyota; 22 reconciliação; 23 preço; 24 FIPE; 25 orquestração; 26 UX operador.

**Checkpoint para revisão. Nenhuma próxima sprint ou chamada real iniciada.**
