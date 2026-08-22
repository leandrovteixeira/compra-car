# Sprint 10C.4C — Runtime Orchestration

Status: **implementada localmente; default one-shot; smoke segmentado falhou na validação canônica do
Document Map**

> Checkpoint 10C.4D: o Job 42/attempt 5 confirmou source upload/open, OpenAI `response_create`
> bem-sucedido, retorno de Structured Output e reconstrução do transporte. A validação canônica de
> `CommercialDocumentMap/1` falhou com 100 violações. Unit Plan e todos os stages posteriores não
> iniciaram. Classificação: `SEGMENTED SMOKE TECHNICAL FAIL`; stage:
> `DOCUMENT_MAP_CANONICAL_VALIDATION`. Próxima tarefa: `DIAGNOSE DOCUMENT MAP CANONICAL VALIDATION
> FAILURE`.

> Diagnóstico local 10C.4D (2026-08-22): a mensagem com 100 violações era limitada por
> `slice(0, 100)` e não preservava o total real. O validator agora mantém total e contagens completos,
> expõe somente uma amostra estrutural sanitizada de até 30 itens e diferencia schema, referential,
> semantic e invariant. A reconstrução foi tornada schema-aware após teste provar que o algoritmo
> anterior removia também `null` required/nullable legítimo. O próximo retry pode ser diagnóstico,
> mas não foi executado nesta mudança.

> Correção pós-Job 38: `batch.competence = null` não bloqueia mais a entrada do runtime segmentado.
> Os candidatos explícitos de competência/validade extraídos são preservados por merge e semantic
> reconciliation, e uma primitive server-owned resolve o período somente no boundary imediatamente
> anterior ao Domain Mapping. Competência operacional e período documental incompatíveis, candidatos
> conflitantes ou ausência real continuam produzindo `DOMAIN_MAPPING_PERIOD_UNAVAILABLE`; nenhuma data
> é inferida. O Job 38 permanece histórico `failed`, sem chamada OpenAI, e não houve retry neste marco.

## Boundary e modo

Os schemas de Document Map e Unit Extraction possuem duas representações: o contrato canônico core,
usado integralmente pelos validators server-side, e uma projeção OpenAI transport-safe criada pela
mesma primitive genérica. A resposta Structured Outputs é reconstruída antes da validação canônica;
constraints incompatíveis com o wire, como `uniqueItems`, não são removidas do domínio.

A reconstrução consulta o schema canônico recursivamente em objects, arrays e branches `oneOf`:
remove somente `null` usado pelo transporte para preencher propriedade optional/non-nullable e
preserva `null` quando ele pertence ao contrato canônico. Fixtures Geely-like, GWM multipage,
Fiat-like e VW partitioned completam transport round-trip e validação canônica local.

Quando `OPENAI_IMPORT_DIAGNOSTICS=1` fora de produção, uma falha canônica em Document Map emite
`SEGMENTED_DOCUMENT_MAP_VALIDATION` antes da conversão em falha genérica. O evento contém somente
total, contagens por keyword e categoria ampla, amostra `{ path, keyword, category }` e indicador de
truncation. Não contém body, resposta OpenAI, valores comerciais, evidence, params AJV, file/response
IDs ou URLs, e não é persistido em artifact ou audit trail.

## Canonicalização server-owned dos IDs

O retry diagnóstico posterior confirmou 358/358 violações AJV `pattern`, sem qualquer outra keyword
ou categoria. A forma transport estava estruturalmente coerente, mas IDs locais model-owned não
satisfaziam o contrato. O schema não foi relaxado: definitions de Document Map continuam usando
`^<prefix>-[a-z0-9][a-z0-9._-]{0,79}$` para os prefixes `document`, `page`, `block`, `section`,
`table`, `note`, `hint` e `edge`. Não existe table row ID no Document Map; rows pertencem à Unit
Extraction.

O fluxo passa a ser reconstruction → `canonicalizeCommercialDocumentMapIds` → canonical validation.
O canonicalizer cria mapas raw→canonical separados por kind, usa ordinais zero-padded sem dados
comerciais e reescreve definitions, ownership, page/section/table/note/hint/edge lists, metadata/source
blocks, segments/headers, parent sections e context edge endpoints. O `documentId` é derivado do
ordinal server-owned da source, não do texto do modelo.

Duplicidade raw dentro do mesmo kind é ambígua e falha; o mesmo raw ID em kinds distintos é válido
porque refs carregam kind explícito. Definição ausente, referência desconhecida e source mismatch
também falham conservadoramente. `DOCUMENT_MAP_CANONICALIZATION_FAILED` expõe apenas kind, category e
path. O input não é mutado e chamadas repetidas produzem output byte-equivalente e idempotente.

## Hipóteses históricas anteriores ao retry diagnóstico

1. **Constraints removidas no wire:** hipótese principal. `uniqueItems`, `minLength` e `maxLength`
   continuam canônicas, mas não fazem parte do transport schema. Um documento grande possui mais de
   cem arrays sujeitos a unicidade, então duplicatas em muitos deles são compatíveis com volume alto.
2. **Mismatch de reconstrução ainda não representado pelas fixtures:** possível, porém reduzido pelos
   round-trips das quatro topologias e pelos testes recursivos de objects, arrays e unions.
3. **`type`/`required`/`enum`/`pattern`/limites numéricos:** menos provável porque essas constraints
   permanecem no wire strict; o diagnóstico por keyword poderá confirmar ou refutar diretamente.
4. **Nullable/required no Document Map:** improvável para o failure observado porque o schema canônico
   de Document Map não declara tipos nullable. O bug genérico comprovado e corrigido afeta a primitive
   compartilhada, mas não explica sozinho o attempt 5.
5. **IDs, referências ou invariantes:** IDs malformados podem falhar no AJV por `pattern`; referências
   dangling e demais invariantes não explicam o primeiro erro observado, pois o validator parou no
   schema antes de executar a fase referential/semantic.

O total anterior de 100 não discriminava essas hipóteses: era apenas o limite aplicado à lista antes
da mensagem. O retry diagnóstico seguinte resolveu a incerteza ao revelar 358/358 falhas `pattern`.

`IMPORT_EXTRACTION_MODE` aceita somente `one_shot` e `segmented`. Ausência ou vazio preserva
`one_shot`; valor inválido falha antes da extração. O caminho one-shot, provider `openai/4`, Prompt
v4, matching, confidence server-owned, persistência de rows, finalização e bloqueio de promotion
permanecem os mesmos.

**SEGMENTED PIPELINE IMPLEMENTED IN RUNTIME = YES.**

**DEFAULT PIPELINE = ONE_SHOT.**

**REAL SEGMENTED PIPELINE = DOCUMENT MAP AND UNIT PLAN SUCCEEDED; FIRST BLOCKER IS NOW UNIT
EXTRACTION.**

## Call graph segmentado

`processAdminImportBatch → Document Map structured extraction → planner determinístico → N unit
extractions → artifacts 10C.4B → merge → semantic reconciliation → domain mapping →
commercial-letter/mmv-payload/1 → validação/matching/enrichment/finalize existentes → needs_review`.

Document Map e units reutilizam uma única source session. O runtime consulta artifacts succeeded
antes de chamadas estruturadas e pode executar somente units ausentes. Cada stage publica body JSON
canônico, verifica hash/tamanho e preserva a DAG normativa.

## Correção de provenance

A canonicalização por unit atribui IDs documentais locais. O runtime agora deriva `sources` do body
canônico de cada unit e os associa ao ordinal/filename original server-owned. Antes dessa correção, o
Domain Mapping bloqueava corretamente porque recebia somente o ID pré-canonicalização do batch.
Nenhuma regra do mapper foi relaxada.

## Gate local

O E2E fake usa Document Map sintético Geely-like e outputs unit-aware: duas units carregam duas
identidades cada; as demais carregam somente contexto estrutural. Prova quatro rows canônicas,
PY/MY distintos, referências Offer→Policy sem órfãos, uma abertura/cleanup da source, usage agregado,
artifacts dos seis stages, fan-in do Merge, replay sem novas chamadas, matching e finalize em
`needs_review`. Não existe promotion no fluxo.

Partial retry entre novos jobs/attempts permanece evolução futura: o runtime reutiliza artifacts
compatíveis dentro do mesmo job/attempt, mas o lifecycle atual não promete reuso cross-job.

Nenhuma migration foi criada. Nenhum ambiente remoto ou chamada OpenAI foi usado durante a correção
local. O gate atual é
**HISTORICAL GATE SUPERSEDED BELOW: READY FOR SEGMENTED RETRY AFTER DOCUMENT MAP ID
CANONICALIZATION.**

## Primeiro Unit Extraction real — Job 44/attempt 7

A leitura do Staging em 2026-08-22 confirmou que o Document Map e o Unit Plan foram persistidos antes
da falha. O plano possui 18 units: seis `TABLE`, seis `SECTION`, duas `FAMILY`, duas `CHANNEL` e duas
`PAGE_RANGE_FALLBACK`. Com concorrência default 2, `unit-0001-table` e `unit-0002-table` foram as
primeiras chamadas elegíveis. Nenhum artifact `unit_extraction` ou row foi publicado.

O erro final `UNIT_EXTRACTION_INVALID_STRUCTURED_OUTPUT` é selecionado pela ordem do plano e aponta
para a unit 1. A telemetria isolada da unit 2 (`APIUserAbortError` convertido pelo provider em
`PROVIDER_TIMEOUT`) não prova expiração do timer: o orchestrator verificava esse código antes de
reconhecer que outra unit já havia marcado fatal e abortado a chamada. Uma regressão concorrente
reproduz exatamente a sequência unit 1 inválida + unit 2 aguardando e confirma que a classificação
correta da segunda é `ABORTED_SIBLING`. Timeout real de unit permanece `PROVIDER_TIMEOUT`, deadline
total permanece `ORCHESTRATION_TIMEOUT` e o limite de 120 s não foi alterado.

O fluxo de Unit Extraction agora é transport reconstruction → validação da projeção transport-safe →
canonicalização server-owned → validação canônica. A projeção wire aceita IDs locais livres para
document, block, table, column, row, vehicle, fact, scope, group, relation, unit e gap; todos os
patterns e invariantes continuam intactos no schema core e são aplicados após o remapeamento de IDs e
referências. Fixture transport-like com IDs fora dos patterns prova esse boundary, e output realmente
malformado continua falhando.

Com `OPENAI_IMPORT_DIAGNOSTICS=1` fora de produção, falhas em `transport_decode`,
`transport_validation`, `canonicalization` e `canonical_validation` emitem somente unit ID/ordinal,
total, contagens por keyword, amostra `{ path, keyword, category }` e truncation. Raw output, commercial
values, evidence, raw local IDs, PDF e provider body não são observados nem persistidos.

Limitação mantida: o runtime só publica Unit Extraction artifacts e agrega usage/providerRunId depois
que `executeSegmentedExtraction` retorna sem nenhuma unit failed. Portanto, uma resposta que falha
localmente perde sua metadata, e uma sibling succeeded pode não ser persistida quando outra falha.
Esse comportamento deve ser redesenhado apenas na evolução de retry granular.

**READY FOR UNIT EXTRACTION DIAGNOSTIC RETRY.** Nenhum retry ou chamada OpenAI foi executado nesta
correção.
