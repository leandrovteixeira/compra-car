# Sprint 10C.4C — Runtime Orchestration

Status: **implementada localmente; default one-shot; smoke segmentado falhou na validação canônica do
Document Map**

> Checkpoint 10C.4D: o Job 42/attempt 5 confirmou source upload/open, OpenAI `response_create`
> bem-sucedido, retorno de Structured Output e reconstrução do transporte. A validação canônica de
> `CommercialDocumentMap/1` falhou com 100 violações. Unit Plan e todos os stages posteriores não
> iniciaram. Classificação: `SEGMENTED SMOKE TECHNICAL FAIL`; stage:
> `DOCUMENT_MAP_CANONICAL_VALIDATION`. Próxima tarefa: `DIAGNOSE DOCUMENT MAP CANONICAL VALIDATION
> FAILURE`.

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

`IMPORT_EXTRACTION_MODE` aceita somente `one_shot` e `segmented`. Ausência ou vazio preserva
`one_shot`; valor inválido falha antes da extração. O caminho one-shot, provider `openai/4`, Prompt
v4, matching, confidence server-owned, persistência de rows, finalização e bloqueio de promotion
permanecem os mesmos.

**SEGMENTED PIPELINE IMPLEMENTED IN RUNTIME = YES.**

**DEFAULT PIPELINE = ONE_SHOT.**

**REAL SEGMENTED PIPELINE = PROGRESSED THROUGH OPENAI DOCUMENT MAP RESPONSE BUT NOT YET THROUGH
CANONICAL DOCUMENT MAP VALIDATION.**

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

Nenhuma migration foi criada. Nenhum ambiente remoto ou chamada OpenAI foi usado.
