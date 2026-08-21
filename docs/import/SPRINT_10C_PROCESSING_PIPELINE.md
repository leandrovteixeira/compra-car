# Sprint 10C — Fundação do processamento do Import Engine

## Fundação 10C.4A — lifecycle de artifacts (runtime inativo)

O pipeline segmentado possui agora contrato puro para manifests versionados, lifecycle
`queued → processing → succeeded|failed`, SHA-256 do JSON canônico, idempotência, lineage, DAG e ports
de Storage/manifest/auditoria. O alvo persistente aprovado é body imutável em Storage privado com
metadata mínima no Postgres. A migration/adapter foi adiada para 10C.4B, quando houver orquestração
consumidora e testes pgTAP do boundary service-role.

O caminho one-shot descrito abaixo permanece o único runtime ativo. `processAdminImportBatch`,
registry, provider `openai/4`, Prompt v4, matching, RPCs e finalize não consomem artifacts 10C.4A.
Detalhes: `SPRINT_10C4A_LIFECYCLE_ARTIFACTS.md`.

Status: implementada e validada funcionalmente no Staging `shfsjyjxmgwnlexmdkcs` em 2026-08-12.

## Escopo entregue

- job auditável por tentativa (`queued`, `processing`, `succeeded`, `failed`), claim token e índices de concorrência;
- provider genérico, registry e provider `fake` determinístico;
- plugin `commercial_letters` sobre `commercial-letter/mmv-payload/1`;
- uma `pricing_import_row` por MMV, com ordinal semântico independente do nome do arquivo;
- matching na ordem normativa: código externo, chave exata, tokens somente como sugestão;
- persistência atômica das rows e transição do batch para `needs_review`;
- retry explícito de batch `failed`, sem apagar rows e sem duas tentativas ativas;
- ação administrativa mínima para processar um dossiê `ready`.

## Hardening pré-Staging

O resultado do provider é entrada não confiável. A pipeline remove previamente toda autoridade sobre `productMatch`, IDs persistidos, resoluções, locks, `validation` e `promotionPlan`; força ações de promoção a `blocked`; executa o JSON Schema Draft 2020-12 com Ajv; aplica invariantes complementares de IDs locais, referências de Offer e coerência confidence/band; faz matching e enriquecimento no servidor; e executa novamente o schema antes da persistência.

### Integridade referencial de Policy/Offer

`clientPolicyId` e `policyClientIds` são obrigatórios no contrato transport e são copiados sem
renomeação pela leitura JSON, normalização de opcionais, reconstrução canônica e sanitização
server-owned. Não existe remoção nem deduplicação de Policies nessa cadeia. Structured Outputs garante
a forma definida pelo subset de JSON Schema aceito, mas não consegue impor a relação dinâmica entre
IDs de dois arrays; essa integridade permanece uma invariante server-side.

No Volvo batch 113/Job 35, cinco Offers chegaram à validação com referências ausentes em Policies.
Como não existe transformação server-side capaz de originar ou remapear essa perda, o resultado
correto permanece `CANONICAL_PAYLOAD_INVALID`. Offers parcialmente válidas e totalmente órfãs são
recusadas por inteiro: remover referências não tem representação explícita de REVIEW nesta etapa e
mascararia perda semântica. Não se cria Policy placeholder, não há associação textual/fuzzy e não se
inventa destino. O diagnóstico permitido contém somente contagens de Policies, Offers, referências,
órfãs, remappings determinísticos (atualmente zero) e paths de Offers afetadas.

O Job 35 não foi reexecutado após esta auditoria; Prompt v2, schema semântico, provider e benchmark
continuam congelados. A investigação e os testes sintéticos fizeram zero chamadas OpenAI e Supabase.

Para até 100 rows, o boundary de catálogo normaliza e deduplica a chave
`brand/model/version/modelYear/productionYear`, processando no máximo 10 chaves simultaneamente.
Cada consulta continua dirigida; não há scan global nem `.or()` textual. Uma chave completa usa os
dois anos numéricos na busca exata. Se qualquer ano estiver ausente ou não for um ano canônico de
quatro dígitos, a busca exata é omitida e somente candidatos conservadores podem ser sugeridos pelo
matcher; nunca há confirmação por chave incompleta. Falha em qualquer chunk aborta todo o matching,
sem tratar catálogo parcial como sucesso.

Cada payload por MMV é limitado a 256 KiB, cada tentativa a 100 rows e o envelope transacional a 10 MiB somando `raw_payload` e `normalized_payload`. `raw_payload` é o rascunho já sanitizado de campos server-owned; `normalized_payload` é o documento canônico final enriquecido. Bytes/base64/texto integral de PDF não pertencem a esses campos. A retenção definitiva permanece uma decisão futura antes do provider real.

Claims possuem lease entre 30 e 900 segundos; o worker web usa 300 segundos. Um job `processing` expirado pode ser recuperado na mesma tentativa por novo token. O token anterior não pode finalizar nem falhar. `claim`, `finalize` e `fail` bloqueiam job e batch e revalidam `ready|failed → extracting`, `extracting → needs_review` e `extracting → failed`.

O correlation ID é estável por tentativa e deve coincidir em enqueue, claim/reclaim, finalize e fail. Auditoria append-only registra enqueue, claim/reclaim, success/failure e as transições correspondentes do batch, sem bytes, URLs, secrets ou payload integral. `lock_version` é uma versão auditável incrementada pelo trigger; a exclusão concorrente é feita por row locks e claim token, não por optimistic locking de cliente.

Matching consulta primeiro a chave exata e, quando necessário, um conjunto direcionado e limitado de candidatos da mesma marca/modelo; não existe truncamento silencioso do catálogo em 5.000 linhas. External codes continuam apenas no contrato puro até existir fonte canônica — nenhuma tabela legada é consultada. Tokens nunca confirmam automaticamente.

O ordinal usa MMV, competência, início/fim, restrições/canal serializados e block keys, com desempate pelo payload canônico. Filename não participa da chave. O teste de filename invariance usa os mesmos bytes com nomes descritivo e opaco e compara MMV, período, preço, Policies, Offers e evidências.

As garantias PostgreSQL possuem pgTAP local em `supabase/tests/022_sprint_10c_processing_hardening.test.sql`, cobrindo grants/RLS, enqueue, claim concorrente, lease/reclaim, token antigo, atomicidade, replay, batch concorrente, failure, retry, lineage e auditoria.

O ambiente remoto não disponibiliza pgTAP. O reset local e a suíte SQL completa passaram com 648/648 assertions; no Staging, application flow, adapters, Storage, RPCs e FakeProvider reais validaram os cenários funcionais críticos, incluindo reclaim, matching suggested e invariância de filename. Os smokes não alteraram Products, preços públicos, Policies, Offers ou memberships, e seus objetos transitórios de Storage foram removidos.

## Transação e idempotência

O provider executa fora do banco. `enqueue_import_processing_job` serializa por batch; `claim_import_processing_job` registra a posse e move documentos/batch para processamento. `finalize_import_processing_job` valida e insere todas as rows, conclui documentos/job e move o batch para `needs_review` numa única transação. Se a resposta se perder após commit, repetir a finalização com o mesmo claim retorna o resultado persistido.

Uma falha antes da finalização não deixa rows parciais. O retry cria nova tentativa somente quando o batch não tem rows. Reprocessamento deliberado de um resultado concluído fica fora deste sprint, pois exigiria política explícita de versionamento em vez de exclusão.

## Segurança

Storage continua privado e é lido apenas no servidor. A tabela de jobs usa RLS sem policies para clientes; tabelas, sequência e RPCs são concedidas exclusivamente a `service_role`. RPCs usam `security definer`, `search_path = ''`, ator, correlation ID e locks de linha. Erros persistidos são limitados a 2.000 caracteres e não armazenam bytes, prompts secretos ou credenciais.

## Limites conhecidos

- O provider fake prova orquestração e persistência, mas não interpreta o PDF.
- O provider fake usa fixtures e não interpreta precedência documental; cenários de primary/errata/complement são representados por fixtures configuráveis, não por heurística falsa.
- O catálogo canônico atual não expõe códigos externos. O algoritmo e testes suportam código inequívoco, mas o adapter retorna somente a chave de negócio até existir um contrato canônico de códigos — sem consultar tabelas legadas.
- Provider real existe, mas Prompt v4, limites de volume/custo e política definitiva de retenção
  ainda exigem validação. Nenhuma promoção comercial faz parte da Sprint 10C.

## Prompt v3 estático

O benchmark v2 mostrou padrões cross-brand: GWM 1/13 MMVs; Fiat duas rows para cerca de 100
combinações, famílias omitidas e PY/MY compactados; Volvo com cinco Offers órfãs corretamente
recusadas; e Geely ainda com underpropagation/confidence alta. O Prompt v3 adiciona inventários
documental e nominal, enumeração exaustiva de tabelas, Policy-first, reconciliação quantitativa e
familiar, checagem Offer→Policy, canais, contexto multipágina e confidence orientada a completeness.
Prompt v1/v2 permanecem preservados e o provider dessa iteração foi `openai/3`.

O schema v1 não mudou: testes sintéticos validam 20/100 rows, PY/MY separados, canais, Policies
compartilhadas, referências válidas e REVIEW com códigos existentes. Mais de 100 combinações e risco
de output excessivo permanecem problemas arquiteturais; o request não configura `max_output_tokens`.
O A/B Geely v3 posterior produziu 4/4 MMVs/MSRP, E/OU e integridade corretos e recuperou coverage
substancial, mas ainda omitiu uma regra ampla de duas rows abrangidas com confidence 97–98/high.

## Prompt v4 estático

O v4 preserva integralmente as dimensões do v3 e acrescenta um `RULE INVENTORY / SCOPE LEDGER`
interno. A reconciliação passa a fechar tanto row→regras quanto regra→rows/Offers, depois de computar
exceções explícitas e sem usar proximidade visual como substituto de escopo documental. Regras gerais
cumulativas integram todas as alternativas aplicáveis; gaps usam issues existentes e proíbem HIGH nas
rows afetadas. O provider ativo é `openai/4`; `CommercialLetterExtraction/1`, o schema canônico v1,
matching e thresholds server-owned permanecem inalterados.

Fixtures sintéticas validam escopos DOCUMENT/MODEL, exceção, Policy compartilhada, alternativas e
coverage issue. O ledger não é retornado, portanto não acrescenta campos nem resolve a pressão de
output: limite de 100 rows e necessidade futura de segmentation/extraction units permanecem. O v4
foi executado posteriormente: preservou precision e estrutura, mas não resolveu a broad-rule
propagation. VW continua não executado.

## Direção 10C.3 — intermediate extraction

Prompt tuning one-shot foi pausado. A spike
`SPRINT_10C3_INTERMEDIATE_EXTRACTION_ARCHITECTURE.md` recomenda document map, extraction units,
`CommercialDocumentExtraction/1` conceitual, merge/reconciliation e domain mapping separado. O
provider deve continuar genérico; contratos e estratégia pertencem ao plugin `commercial_letters`.
Essa direção não alterou runtime, schemas, jobs, RPCs ou persistência atuais.

### Execução segmentada interna da 10C.3C

A implementação interna agora consegue abrir uma source session genérica, reutilizar uploads em N
requests delimitados pelo `CommercialExtractionUnitPlan/1`, reconstruir a projeção strict de
transporte, canonicalizar IDs locais server-side e validar N artifacts
`CommercialDocumentExtraction/1`. O scheduler usa concorrência/deadlines limitados, ordem lógica,
abort de siblings e resultado operacional em memória por unit.

Essa primitive não está registrada no composition root: `processAdminImportBatch`, provider
`openai/4`, prompt one-shot, matching, RPCs e persistência continuam exatamente no caminho acima.
Merge/reconciliation e qualquer ativação pertencem a checkpoints posteriores.

## Gate de Staging

Único alvo remoto autorizado: Compra Car Staging, ref `shfsjyjxmgwnlexmdkcs`. Antes de qualquer `db push`, revisar o diff local, confirmar o alvo novamente e executar o smoke test com PDF real. Produção permanece proibida.

## Persistência segmentada local da 10C.4B

Manifest e DAG foram materializados localmente em Postgres, e bodies canônicos usam o bucket privado
`import-processing-artifacts`. RPCs service-role protegem reserve/start/succeed/fail, replay, locks,
claim e lineage; o adapter verifica read-back, SHA-256 e tamanho. Não há transaction distribuída:
falha pós-write gera orphan observável e nunca deletion automática. Essa infraestrutura não foi
registrada no fluxo descrito acima: one-shot, matching, finalização de rows e runtime principal
continuam inalterados. Ver `SPRINT_10C4B_ARTIFACT_PERSISTENCE.md`.

**SEGMENTED PIPELINE ACTIVE = NO.**
