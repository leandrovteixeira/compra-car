# Sprint 10C.4A — Lifecycle & Artifacts

Status: **fundação pura implementada; persistência e runtime segmentado inativos**

Data: 2026-08-20

## Decisão arquitetural

O desenho-alvo permanece **JSON canônico imutável em Storage privado + manifesto operacional mínimo
no Postgres**. Nesta checkpoint foi implementado o contrato provider-agnostic, não a persistência.

| Opção | Auditoria/replay | Custo operacional | Decisão |
|---|---|---|---|
| JSON integral no Postgres | simples, mas amplia banco/backups e mistura corpo com coordenação | alto para payloads grandes | não recomendada |
| JSON no Storage + manifest no DB | corpo imutável, hash verificável e consulta operacional pequena | exige protocolo de convergência | **alvo aprovado** |
| tabelas por estágio | consultas finas, porém acopla schema a seis contratos em evolução | migrations e joins frequentes | não recomendada |
| somente memória | nenhum cleanup persistente, sem retry após restart ou auditoria durável | simples, mas insuficiente | apenas testes/10C.3C |

`MIGRATION REQUIRED = NO` para a 10C.4A. Criar tabela, bucket/RPC e adapter antes do composition root
usar a lifecycle produziria schema sem consumidor e não provaria a integração transacional. A
10C.4B deverá materializar o manifest DB e o adapter Storage ao conectar a orquestração, com migration
incremental, pgTAP, reset local e sem aplicação remota automática.

## Job e artifact

O processing job continua sendo o agregado de execução global: claim, lease, reclaim, attempt do job,
provider run e transição do batch. Artifacts não substituem o job; registram outputs verificáveis de
seus estágios. Um job pode referenciar um Document Map, um Unit Plan, N Unit Extractions, um Merge,
uma Semantic Reconciliation e um Domain Mapping.

O contrato `SegmentedImportArtifactManifest/1` contém identidade de artifact, batch/job,
document/unit quando aplicável, stage, versão do pipeline e do schema do corpo, artifact version,
attempt, status, correlation ID, chave de idempotência, dependências, retry/supersession lineage,
SHA-256/tamanho/canonicalização, locator privado, metadata limitada do provider e timestamps.

O body não pertence ao manifesto. PDF/base64, prompt/request/resposta bruta, headers, credenciais,
claim token, signed URL, file ID temporário, Product ID e IDs persistidos de Policy/Offer são
proibidos nessa fronteira.

## Stages, status e eventos

Stages centralizados e normativos:

1. `document_map`;
2. `unit_plan`;
3. `unit_extraction`;
4. `merge`;
5. `semantic_reconciliation`;
6. `domain_mapping`.

Status é uma dimensão separada e pequena: `queued → processing → succeeded|failed`. Sucesso e falha
são terminais. `superseded` é relação, não status: uma versão nova aponta para a anterior sem alterar
o registro bem-sucedido. Eventos pequenos são `artifact_queued`, `artifact_started`,
`artifact_succeeded`, `artifact_failed`, `artifact_retried` e `artifact_superseded`; carregam refs,
attempt, stage, correlation e métricas seguras, nunca body.

## Conteúdo, hash, versão e idempotência

O payload hashable é **somente o body JSON lógico**, serializado por `canonical-json/1`: object keys
em ordem lexicográfica, arrays preservados, JSON finito, plain objects, UTF-8. Metadata operacional,
timestamps, status e provider usage não entram no content hash. O SHA-256 é calculado server-side via
Web Crypto; tamanho máximo inicial: 8 MiB de JSON canônico.

As dimensões são independentes:

- `artifactSchemaVersion`: contrato do body, por exemplo `CommercialDocumentExtraction/1`;
- `artifactVersion`: revisão material do artifact no mesmo estágio;
- `attempt`: nova execução/retry, preservando tentativas anteriores;
- `pipelineVersion`: compatibilidade do DAG, inicialmente `segmented-import/1`.

A chave de idempotência usa pipeline/schema/artifact version, batch, job, stage, document/unit,
attempt, correlation, hashes das dependências ordenados e provider/model/prompt version quando
aplicáveis. Não usa relógio, duration, usage ou provider run ID. O mesmo replay resolve o mesmo
`artifactId`/key; retry explícito incrementa attempt e cria artifact novo.

## DAG e retry granular

`sourceArtifactIds` formam o DAG obrigatório:

`document_map → unit_plan → unit_extraction[1..N] → merge → semantic_reconciliation → domain_mapping`.

O validator rejeita dependência ausente/dangling, self-reference, ciclos, predecessor de stage
errado, batch/job divergente, pipeline incompatível e predecessor não concluído. Merge permite fan-in
de N units. Assim um retry de unit cria apenas uma nova tentativa dessa unit e o Merge seguinte pode
reutilizar todas as demais units válidas. `resolveLatestSucceededSegmentedArtifact` seleciona a
versão/attempt bem-sucedida mais recente sem promover uma tentativa failed/queued.

## Storage e protocolo de atomicidade

Bucket-alvo privado: `import-artifacts`. O locator server-owned é
`<batch>/<job>/<stage>/<artifact-id>.json`; o nome original nunca participa do path e nenhum texto
comercial/PII é embutido nele. O prefixo do bucket não é duplicado no object path do SDK.

Protocolo normativo:

1. reservar manifest `queued` por chave única de idempotência;
2. compare-and-set para `processing` e auditar start;
3. escrever o body canônico no Storage privado;
4. confirmar existência, reler e verificar tamanho/SHA-256;
5. finalizar o manifest `succeeded` por compare-and-set;
6. auditar success.

Falha antes do write tenta persistir manifest failed e não cria orphan. Falha de verificação ou de
finalização depois do write produz resultado failed, informa se a compensação do manifest foi de fato
persistida e expõe um locator de orphan para cleanup eventual. Se o DB estiver indisponível, o estado
durável pode continuar `processing` até reconciliação; o contrato não mascara isso. Falha isolada do
audit sink após finalização não reabre nem rebaixa um artifact succeeded e fica observável em
`auditRecorded=false`. O core não apaga automaticamente evidência. A implementação DB futura precisa de unique
constraint para idempotency e RPCs service-role que serializem reserva/transições; Storage e DB não
formam transação distribuída, portanto verificação + compensação observável é a garantia possível.

## Retention e cleanup

Política inicial conservadora, sujeita à validação jurídica/privacidade antes da 10C.4B:

- succeeded e superseded: mínimo 365 dias;
- manifests failed: mínimo 180 dias;
- orphan bodies: elegíveis para revisão após 30 dias, nunca remoção cega;
- auditoria: conforme retenção normativa do Import Engine, independente do body;
- deletion automática: **desligada**.

Cleanup futuro deve listar apenas objects sob bucket/prefixo conhecido, cruzar manifest/hash,
respeitar holds, registrar evento/ator/correlation e usar janela de segurança. Reprocessamento e
investigação devem preservar lineage mesmo após eventual expiração autorizada do body.

## Provider metadata e segurança

Allow-list: provider key/version, prompt version, provider run ID sanitizado, model, duration e usage
numérico. Run ID não participa da idempotência. Campos extras e métricas negativas/não inteiras são
recusados. Mensagens de falha persistíveis são fixas/bounded; erro bruto de adapter não é copiado.

Quando a persistência for criada: bucket privado; acesso exclusivamente server-side; tabela/RPC com
RLS deny-by-default, grants somente a `service_role`, `SECURITY DEFINER`, `search_path = ''`, revokes
de PUBLIC/anon/authenticated e nenhuma signed URL no pipeline. O core não importa Supabase, OpenAI,
adapter ou provider e expõe ports de manifest, body Storage e audit sink.

## Boundary e cobertura

`processAdminImportBatch`, provider registry, provider `openai/4`, Prompt v4, Server Actions, RPCs,
matching, persistência comercial, promotion e pipeline one-shot não foram alterados. Domain Mapping
continua produzindo somente payload canônico intermediário; não cria Product, CommercialPolicy ou
CommercialOffer persistido.

Quarenta testes locais cobrem canonicalização/hash, limites, identidade/idempotência, manifest e
metadata hostis, lifecycle/imutabilidade, retry/lineage/supersession, paths, retenção, DAG completo,
fan-in, dangling/cycle/self/wrong-stage/cross-job/cross-batch, latest succeeded, replay sem duplicata,
Storage failure, verificação de hash, DB finalization, orphan observável e eventos seguros.

**SEGMENTED PIPELINE ACTIVE? NO.**
