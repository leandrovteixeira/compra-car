# Sprint 10C.4C — Runtime Orchestration

Status: **implementada localmente; default one-shot; smoke OpenAI segmentado não executado**

## Boundary e modo

`IMPORT_EXTRACTION_MODE` aceita somente `one_shot` e `segmented`. Ausência ou vazio preserva
`one_shot`; valor inválido falha antes da extração. O caminho one-shot, provider `openai/4`, Prompt
v4, matching, confidence server-owned, persistência de rows, finalização e bloqueio de promotion
permanecem os mesmos.

**SEGMENTED PIPELINE IMPLEMENTED IN RUNTIME = YES.**

**DEFAULT PIPELINE = ONE_SHOT.**

**REAL SEGMENTED OPENAI SMOKE = NOT EXECUTED.**

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
