# Sprint 10C.4B — Artifact Persistence & Security

## Escopo e estado

A 10C.4B materializa localmente o contrato da 10C.4A sem ativar o pipeline segmentado. O body é JSON
canônico UTF-8 imutável no bucket privado `import-processing-artifacts`; o Postgres mantém somente o
manifest, lifecycle, locator, hash, lineage, dependencies e metadata allow-listed. Nenhum consumidor
foi conectado a `processAdminImportBatch`, UI, Server Actions, provider registry ou fluxo one-shot.

**SEGMENTED PIPELINE ACTIVE = NO.**

## Modelo persistido

`pricing_import_processing_artifacts` usa ID `bigint` server-owned e `artifact_key` determinística do
core. A chave global de idempotência é segura porque incorpora pipeline/schema/artifact versions,
batch, job, stage, attempt, inputs e identidade do provider; timestamps, provider run ID e body não
participam. FKs `RESTRICT` preservam batch, job, document, retry e supersession. `succeeded` e
`failed` são terminais e imutáveis; retry cria outra row com `attempt + 1` e `retry_of_artifact_id`.
Supersession também cria outra row e preserva a anterior.

`pricing_import_processing_artifact_dependencies` é a junction ordenada de `sourceArtifactIds`.
Triggers/RPC validam source existente e succeeded, mesmo batch/job, predecessor exato, ausência de
self-reference e ciclo. Edges são imutáveis.

## Storage e verificação

O locator é `<batch-id>/<processing-job-id>/<stage>/<artifact-key>.json`. Não contém filename,
correlation ID, MMV, marca, modelo ou conteúdo comercial. O bucket é privado, aceita somente JSON até
8 MiB e não tem policy para `anon`/`authenticated`. O adapter server-only grava sem upsert, relê os
bytes, recalcula SHA-256 e compara tamanho antes de chamar `succeed`.

## Lifecycle transacional e convergência

Os RPCs `reserve`, `start`, `succeed` e `fail` são `SECURITY DEFINER`, usam `search_path = ''`, exigem
claim/lease/correlation/lock válidos e só podem ser executados por `service_role`. Reserve serializa
double-submit pela unique idempotency key e retorna replay. Succeed recebe somente metadata já
verificada, nunca o body. Fail sanitiza código e mensagem. Audit snapshots são pequenos e não contêm
body nem resposta de provider.

DB e Storage não formam transação distribuída. O protocolo de convergência é:

1. reserve DB falha: nenhum body;
2. start; Storage falha: manifest failed;
3. Storage grava, read/hash/size confirmam e succeed fecha: succeeded;
4. Storage grava e finalize DB falha: body orphan observável; o manifest pode permanecer processing
   ou ser compensado para failed;
5. mismatch de hash/tamanho: nunca succeeded e segue para failed/orphan review.

Não há remoção automática nem compensação destrutiva. Retenção documentada: succeeded por pelo menos
365 dias, failed manifests por pelo menos 180 dias e candidatos a orphan revisados depois de 30 dias.
Cleanup será política/sprint separada.

## Segurança de metadata

Provider metadata aceita somente provider/version, prompt version, model, provider run ID bounded,
duration não negativa e usage numérico inteiro (`inputUnits`, `outputUnits`, `totalUnits`). Não são
persistidos request/response brutos, headers, credentials, signed URLs, claim tokens, PDF/base64,
temporary provider file IDs ou artifact body. RLS está habilitado sem policies; tabelas e sequence
têm grants mínimos para `service_role`, sem DELETE.

## Boundary e próximo passo

O core continua sem imports Supabase/OpenAI. Product IDs, matching, Policies/Offers persistidos,
promotion e `promotionPlan` permanecem fora desta camada. A migration é somente local até autorização
separada; não houve `db push`. Próximo passo planejado: **10C.4C — Runtime Orchestration / End-to-End
Dry Run**, ainda não ativo.

## Validação local

Com Supabase CLI `2.109.1` via `pnpm dlx` e Docker Desktop `29.6.1`, o reset completo aplicou todas
as migrations do zero, inclusive `20260820203801`. O pgTAP 023 passou com 43/43 assertions,
incluindo replay, retry, lifecycle terminal, grants, dependencies válidas, cross-batch,
non-succeeded, self-reference, cycle e sanitização. A suíte completa executou 25 arquivos e 693
assertions: 691 passaram; as duas únicas falhas são o baseline histórico das assertions 24–25 do
teste 016, cuja fixture reutiliza o mesmo SHA-256 com `duplicateAcknowledged=false`. O baseline foi
reproduzido após reset até `20260812202957`, antes desta migration. Migration list local está coerente
e `db push --local --dry-run` informa que o banco local está atualizado. Nenhum projeto foi linked e
nenhum ambiente remoto foi acessado.
