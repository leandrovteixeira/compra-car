# Sprint 21 — Spec Source Agent (arquitetura vigente 21.5)

## Fronteira e fluxo

Sprint 21 registra o que a fonte oficial publica. Reconciliação canônica pertence à Sprint 22.

Discovery → Source Policy → Processing Router → Terra Document Intelligence → ExtractionValidator → Sol Repair opcional → Source Fact Inventory → filtro de aplicabilidade → SpecObservations → Sprint 22.

A decisão arquitetural foi autorizada na Sprint 21.5. O benchmark CS55 de uma página mediu Terra USD0,089196 e Terra+Sol USD0,280700. São medições históricas, **não custos garantidos de futuros documentos**.

## Fonte, transporte e estratégia

**OWNER MANUAL = EXCLUDED**, sem fallback. Política central: core/agents/spec-source-policy.ts. Candidatos excluídos recebem SOURCE_KIND_EXCLUDED antes do GET. Fetch impede redirects para manual; provider revalida a classe antes de count/generation. HTTPS/allowlist/DNS/redirects/limites continuam sendo responsabilidade do transporte oficial existente.

| Classe | Política |
|---|---|
| TECHNICAL_SHEET | Permitida; PDF nativo |
| OFFICIAL_MODEL_PAGE | Permitida para dados técnicos |
| OFFICIAL_CONFIGURATOR | Permitida; preservar cards |
| OFFICIAL_STRUCTURED_DATA | Permitida |
| OFFICIAL_TECHNICAL_PAGE | Permitida |
| OWNER_MANUAL / literatura do proprietário | Excluída |
| DEALER | Excluída |
| PRESS / MEDIA_REVIEW | Excluída |
| WEBMOTORS | Excluída |
| FORUM / AGGREGATOR / THIRD_PARTY_DATABASE | Excluída |
| UNKNOWN / PDF ou catálogo genérico | Revisão/exclusão, nunca elegível apenas por ser PDF |

Ficha técnica exata recebe preferência no ranking. Um seed genérico de bootstrap não a desloca quando ela já existe no pool. Papéis continuam distintos de formato.

SpecSourceProcessingRouter/routeSpecSource retorna REJECT_SOURCE, DETERMINISTIC_STRUCTURED quando o adaptador comprova losslessStructured, ou DOCUMENT_INTELLIGENCE. A rota hybrid do runtime usa o novo provider como leitor; não chama o antigo fallback de parágrafos para documentos complexos. A CLI mantém fixture como modo offline seguro; Terra é o modelo primário da estratégia de leitura real, nunca Sol.

## Contratos

DocumentIntelligenceSource suporta PDF_FILE, HTML_DOCUMENT, STRUCTURED_HTML, STRUCTURED_JSON e CONFIGURATOR_SNAPSHOT, com referência/URL final, hash, MIME, tamanho e contexto auditável. PDF é enviado em bytes originais como input_file; texto PDF local serve apenas à validação. HTML preserva título/H1, seções parentLocator, tabelas/células, cards/escopo e JSON embutido. Navegação/footer são removidos. Limite útil de HTML150k caracteres/500 blocos; corte detectado leva a revisão, não a alegação de completude.

TechnicalSheetExtraction conserva identidade, seções sourceHeading/normalizedHeading, item/subgrupo/parentGroup, valores/unidades brutos, tipo/presença, rawText, evidências e aplicabilidade. Metadata de modelo/responseId/usage/pass/duração/hash é atribuída localmente. O schema estrito não aceita campos extras ou IDs canônicos.

Inventário preserva fatos de outras versões. Somente fatos aceitos pelo filtro compõem observações do alvo. Modelo/MY de pesquisa podem ser nulos no replay documental: não se inventa MY para CS55; sem MY resolvido, o inventário pode existir, mas não são emitidas observações MMV+MY para Sprint22.

## Provider e orçamento

OpenAIDocumentTransport deriva do benchmark congelado: Responses input_file direto, low reasoning, strict json_schema, tools=[], store=false, sem retry automático. Prompt versionado: prompts/spec-source-document-intelligence-v1.md. O schema foi expandido deliberadamente para evidência/aplicabilidade/hierarquia; a configuração de modelo/effort permaneceu calibrada.

ValidatedDocumentIntelligence controla primaryModel=gpt-5.6-terra, repairModel=gpt-5.6-sol, maxRepairCalls=1, maxOutputTokens=18000, hardCap<=USD1/documento. Antes de cada geração conta o payload exato e soma custo máximo de entrada+saída ao gasto anterior. Cap impede a geração seguinte e retorna revisão/COST_CAP. Falha de count ou transporte encerra sem retry/reparo especulativo.

Preços isolados em document-intelligence-cost.ts: Terra input2/output12, Sol input4/output20 USD/M. cachedInput é configurável e inicialmente igual a input, conservadoramente: benchmark não forneceu desconto. Reasoning é subconjunto de output, nunca cobrado duas vezes. TARGET<=0,30; soft warning>0,50; HARD1,00. O limite depende dos preços configurados e contagem/usage corretos da API.

Sol só recebe source original, proposta Terra e issues do validador; nunca Golden, cadastro canônico ou especificações existentes. PASS e HUMAN_REVIEW_REQUIRED não chamam Sol. REPAIR_REQUIRED pode chamar uma vez sob o cap.

## Validação determinística

AJV valida formato. O validator verifica identidade, proveniência/hash/locator/trecho literal, labels/valores/unidades, presença explícita, tokens truncados, seções vazias, duplicatas e grupos. Não contém expectativa104/73/14 nem conhecimento de especificações automotivas.

- PASS: nenhum issue REPAIR/REVIEW; avisos de downgrade/conflito de item ficam auditáveis.
- REPAIR_REQUIRED: defeitos estruturais/evidenciais reparáveis.
- HUMAN_REVIEW_REQUIRED: identidade inconsistente/ambígua, corte de fonte ou falha/cap/reparo esgotado. Não derruba fontes seguintes do run.
- EXACT_VERSION/EXACT_MY sem contexto comprovado são rebaixados para UNRESOLVED; MODEL_SHARED exige evidência explícita de todas as versões.
- Escopo explícito de filho/versão prevalece sobre página. GTS não é compartilhado com Comfortline.
- Custos e issue paths não são provas de conteúdo; nenhum resultado é aprovado porque bateu contagens esperadas.

Codes: SCHEMA_INVALID, DOCUMENT_IDENTITY_UNRESOLVED, TARGET_MODEL_CONFLICT, TARGET_BRAND_CONFLICT, TARGET_VERSION_CONFLICT, TARGET_MY_CONFLICT, MODEL_YEAR_UNSUPPORTED, EVIDENCE_MISSING, EVIDENCE_NOT_GROUNDED, LIKELY_TRUNCATED_TEXT, DUPLICATE_ITEM, EMPTY_SECTION, PRESENCE_NOT_PROVEN, EXACT_VERSION_NOT_PROVEN, EXACT_MY_NOT_PROVEN, VERSION_SHARED_NOT_PROVEN, STRUCTURE_INCOMPLETE, SUSPICIOUS_ITEM_COUNT. Conflitos de item ficam no inventário e fora das observações.

## Papel dos parsers anteriores

Preservados para descoberta, DOM/contexto, fixtures, formatos simples, auditoria PDF e diagnóstico explícito structured/fixture. OfficialSpecPdf não é chamado pelo runtime para entender fichas técnicas; readPdfPages apenas sustenta QA. Não houve novo parser PDF complexo nem nova dependência/OCR. As regressões antigas de parsing continuam offline; expectativas de manuais elegíveis foram substituídas pela política nova.

## Replay e benchmark manual

Comandos separados do CI:

- pnpm agent:spec-source:replay -- --benchmark-dir .local-reports/benchmarks/cs55-prime --pdf "<arquivo PDF>" --target "<target.json>"
- agent:spec-source:benchmark usa o mesmo tooling; **sem flag explícita é replay**. Uma futura execução paga exige --authorize-openai explicit-manual-benchmark e autorização do operador. Não foi executada nesta sprint.

ReplayDocumentTransport usa somente capturas locais. Capturas CS55 antigas são adaptadas de forma transparente; não se fabrica evidência de identidade ausente. A avaliação histórica Golden continua independente. Artifacts em .local-reports; fontes/Excel em .local-fixtures, agora ignorado pelo Git.

O replay21.5 produz HUMAN_REVIEW_REQUIRED: identidade antiga não tem evidence[] verificável e quotes históricos sintetizados com separadores não são trechos literais do PDF. Sol histórico é auditado separadamente e também requer revisão; a política nova não o chama depois de REVIEW. Custos históricos0,089196/0,280700 preservados; custo real novo0. Isso não invalida o benchmark, mas demonstra trabalho de contrato/evidência para21.6.

## Roadmap preservado

| Etapa | Escopo |
|---|---|
| 21.1–21.4 | Exploração, discovery, aplicabilidade, protótipos |
| 21.5 (atual) | Document Intelligence Provider |
| 21.6 | Extraction Validator + Repair Hardening |
| 21.7 | Official Source Discovery Final / política |
| 21.8 | Gate real VW + Jeep + Toyota, ainda não autorizado |
| 22 | Spec Reconciliation Agent |
| 23 | Price Intelligence Agent |
| 24 | FIPE Search Agent |
| 25 | Orchestration / Scheduler |
| 26 | Agent Operator UX |

## Pendências explícitas

Calibrar grounding para layout/quotes PDF sem afrouxar fidelidade; identidade em logos/cabeçalhos gráficos; detectar omissões sem Golden; ampliar isolamento de matrizes/JSON de fabricantes; distinguir título literal de seção normalizada; validar política em corpus real autorizado. Não há prova de qualidade cross-brand nem aprovação de importação automática.

---
## Histórico 21.1 (preservado; decisões vigentes acima substituem o fluxo antigo)

# Sprint 21.1 — Spec Source Agent

## Fronteira

**Sprint 21: “What did the manufacturer say?”** O fluxo é Brand Connector ACTIVE → MMV resolvida + MY do catálogo → descoberta oficial → GET seguro → snapshot em memória → extração determinística → fallback semântico limitado → observações atômicas.

**Sprint 22: “What does that observation mean in the Compra-Car canonical model?”** Reconciliação ao catálogo de especificações, revisão e materialização pertencem a outra etapa. Não há códigos canônicos, contexto Spec Master, comparação de especificações existentes, findings operacionais, persistência de plataforma ou escrita no banco neste slice.

## Implementação e reutilização

- `core/agents/spec-source-types.ts`: alvo, observação, snapshot, escopo, documentos, interface PDF e provider semântico.
- `core/agents/spec-source.ts`: reutiliza `buildModelYearTargets` e CatalogMmvIdentity; projeta MYs distintos, sem Production Year; decisões de cache e validação de evidência/aplicabilidade.
- `scripts/agents/spec-source-documents.ts`: adaptadores de HTML/JSON no composition root, usando o helper existente `modelYearHtmlParser` (parser inerte instalado com Next, sem requisições Webmotors).
- `scripts/agents/spec-source-fetch.ts`: GET público manual, HTTPS, política `officialEvidenceUrl` do connector, sem credenciais, queries, IP literal, imprensa/dealer ou redirects externos. Máximo 2 redirects por fonte, timeout total 10s, 2MB de bytes descomprimidos. 403/429/challenge encerram o run. Registra status, URL, hostname, MIME, bytes, redirects e SHA-256, sem HTML integral.
- `adapter-openai/spec-source-provider.ts`: reutiliza `BackgroundResearch`, strict JSON schema, zero tools/search, até 8 parágrafos de 2000 caracteres, no máximo 1 fallback no run. Só é chamado se não houver observações determinísticas e existirem parágrafos com binding comprovado.
- `adapter-supabase/spec-source-context.ts`: reutiliza leitores de connector, plataforma e catálogo. Um transport adicional aceita apenas GET/HEAD nas tabelas de contexto; bloqueia mutations, RPCs e tabelas de especificações. O cliente não sai dessa fronteira.
- `run-spec-source.ts`: reutiliza `loadAgentEnvironment` e `redactSecrets`. Sem nova dependência, migration ou alteração de arquitetura canônica.

## Formatos suportados e limites conservadores

1. Tabelas de versões nas linhas, versões nas colunas, ou duas colunas item/valor com escopo comprovado. Células vazias/dash não significam ausência; texto explícito “não disponível” pode ser negativo. Colspan/rowspan ambíguos são rejeitados.
2. `dl/dt/dd` e pares `data-label/data-value` que coincidam com o conteúdo visível.
3. JSON-LD `Vehicle/Car/Product` com `model`, `vehicleConfiguration`, `vehicleModelDate` e `additionalProperty/PropertyValue`. Não há varredura recursiva arbitrária de JSON.
4. PDF: somente boundary `SpecPdfAdapter`; `PDF_UNSUPPORTED` nesta etapa. Não existe dependência adequada instalada; não foi adicionada stack PDF/OCR.

Escopo reconhecido: atributos estruturais model/version/model-year ou headings/captions explicitamente rotulados `Modelo:`, `Versão:`, `MY` / `ano-modelo`. Um título genérico ou a URL não prova versão/MY. Isso limita recall em layouts reais não rotulados; uma nova estrutura deve ser suportada com fixture, não por promoção implícita do alvo solicitado.

Versão incompatível ou ano explicitamente diferente é rejeitado. Linha/coluna de matriz mantém `VERSION_MATRIX`. “Todas as versões” permite `MODEL_SHARED`. MY ausente permanece `UNRESOLVED`; “linha atual” permite `CURRENT_LINEUP`, nunca ano exato inferido pelo relógio. Versão sem evidência permanece não resolvida na função pura e é rejeitada no pipeline (`VERSION_UNRESOLVED`).

Cada parágrafo semântico é um bloco isolado. O modelo só retorna locator, label, valor/unidade literais e evidência; o código calcula o restante e exige evidência existente no bloco, label/valor/unidade suportados e escopo válido. Não há conversões de unidade ou mapeamento canônico.

Fixture Jeep sintética reproduz a adjacência T270/1.3 e Other/1.995, sem regra por marca. Não é evidência sobre disponibilidade atual do Commander.

## Descoberta, custo e cache

Somente entradas ACTIVE de modelo/ficha/configurador contendo o modelo no caminho, ou um índice oficial como ponto de partida. Links seguintes precisam permanecer no domínio permitido e no caminho do modelo. Sem fonte segura: `OFFICIAL_SOURCE_DISCOVERY_GAP`. Nenhuma busca semântica de descoberta foi adicionada.

`maxSources` limita tentativas de fontes no run inteiro; redirects aparecem separadamente na auditoria HTTP. Snapshots e cache são locais à execução. Reuso exige mesma URL final, hash, alvo e versão do extractor; mudança de hash reextrai. `baseline` e `monitor` compartilham a extração neste slice; monitor não pressupõe cache persistido.

## CLI

Executar com Node 22.23.2 portátil e pnpm 10.34.5, a partir da raiz:

```powershell
pnpm agent:spec-source:dry-run -- --brand VW --model Nivus --version "Comfortline 200 TSI" --my 2026 --discovery-run 36c6d79b-45ca-49a6-abaa-66bd86d81d95 --provider hybrid --mode baseline --max-targets 1 --max-sources 3 --max-semantic-calls 1
```

Os filtros exatos são obrigatórios. Sem provider, usa fixture; sem orçamento semântico, usa zero. Provider structured não usa OpenAI. Fixture usa transporte sintético sem rede. Sem `--discovery-run`, lê o último MMV Discovery COMPLETED apropriado. Com esse argumento, valida o run conhecido e usa suas resoluções; não redescobre MMVs.

Reports em `.local-reports/agents/spec-source/` (ignorados pelo Git) contêm métricas, hashes, auditoria HTTP e todas as observações com proveniência. Não contêm HTML integral. Contagens de rejeição de observações/documentos são separadas de falhas de fetch.

## Validação e smoke

Os testes offline cobrem identidade sem PY, ausência versus negativo explícito, atomização, matrizes, contaminação de versão/MY, protocolos/redirects/timeout/size, cache, JSON/DOM/HTML, fronteiras semântica e Supabase e orçamento de execução.

Gates scoped: 93 testes, tipos, lint, formato e build aprovados. Único smoke: índice VW HTTP 200, 0 observações, NO_BOUND_TECHNICAL_FACTS, 0 OpenAI. [Relatório completo e limitações globais](SPRINT_21_1_REAL_SMOKE.md).

## Atualização 21.6 — grounding e QA estrutural

O prompt [v2](prompts/spec-source-document-intelligence-v2.md) adiciona page, evidenceType, sectionHeading e parentContext à evidência. O schema de geração exige esses campos; o validator aceita a forma histórica v1 para replay, sem inventar provas ausentes.

Grounding registra EXACT_TEXT, NORMALIZED_TEXT, BOUNDED_WINDOW, STRUCTURAL_CONTEXT ou NOT_GROUNDED. Normalização NFKC/whitespace/pontuação preserva números e ordem. Janela permite apenas marcadores de layout entre tokens, no mesmo bloco/página; título com letras espaçadas tem regra delimitada por linha. Reading order do PDF.js é alternativa de QA, não entrada achatada do modelo.

IDENTITY_OUTPUT_INCOMPLETE e MODEL_OUTPUT_EVIDENCE_MISSING/MALFORMED podem exigir Sol. IDENTITY_SOURCE_AMBIGUOUS exige revisão humana. Fonte sem suporte não valida um fato inventado. Censo independente do Golden conta headings, bullets, linhas prováveis, tabelas/cards/listas/JSON e densidade; diferenças relevantes geram STRUCTURE_INCOMPLETE, com confiança HIGH/MEDIUM/LOW.

Teto USD1, uma Terra e até uma Sol, exclusão de manuais e regras de aplicabilidade permanecem. Resultado do gate real único e limitações: [Sprint 21.6](SPRINT_21_6_REAL_GATE.md).
