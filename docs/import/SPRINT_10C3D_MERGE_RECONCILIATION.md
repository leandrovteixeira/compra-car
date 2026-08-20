# Sprint 10C.3D — Merge e reconciliation

Status: **10C.3D-A implementada como primitive pura; 10C.3D-B permanece pendente; runtime inalterado**
Data: 2026-08-20

## Fases

### 10C.3D-A — foundation determinística

Implementa o subpath interno `@compra-car/core/commercial-document-reconciliation`. A entrada combina
`CommercialDocumentMap/1`, `CommercialExtractionUnitPlan/1` e envelopes `{ unitId, ordinal,
artifact }`. O envelope é necessário porque IDs internos de `CommercialDocumentExtraction/1` são
locais/canonicalizados por unit e não substituem a identidade server-owned do UnitPlan.

`reconcileCommercialDocumentExtractions` valida mapa, plano e artifacts sem modificar os inputs e
produz `CommercialDocumentReconciliationResult/1` em memória. O resultado contém source artifacts,
identities, facts, scopes, composition, provenance, coverage, duplicates, conflicts, ambiguidades e
issues. Não foi criado JSON Schema público: TypeScript e validator puro são suficientes neste
checkpoint interno; versionamento explícito permite adicionar uma fronteira de transporte futura.

### 10C.3D-B — semantic reconciliation / scope propagation

Permanece **PENDENTE**: aliases sem equivalência documental exata, aplicação de regras gerais a
grandes conjuntos de MMVs, precedência semântica de errata/complemento, interpretação de headers e
footnotes incompatíveis, propagação de scope, resolução de ambiguidades e decisões assistidas/human
review. A fase B consumirá issues e provenance da fase A; não deve reextrair nem apagar evidência.

## Contrato e provenance

Cada entidade reconciliada possui ID server-owned, valor documental e uma lista canonicamente
ordenada de source refs. Cada source ref identifica artifact, unit, ordinal, ID local e evidence
quando aplicável. Assim, dedupe preserva todos os contributors e permite retornar a
document/block/table/row pelo evidence original. Mensagens de issue são fixas e não incluem conteúdo
bruto do documento.

O status geral é `complete`, `partial` ou `conflicted`. `conflicted` nunca escolhe um valor;
`partial` representa coverage incompleta, ambiguity/review ou issue estrutural; `complete` exige
coverage integral sem issue ou ambiguidade.

## Merge e dedupe

Equivalência usa serialização canônica de campos documentais normalizados: chaves de objeto
ordenadas, whitespace textual normalizado, listas cuja semântica é de conjunto ordenadas antes da
chave e exclusão apenas de ID local, evidence e confidence. Não há fuzzy matching, embedding, LLM ou
last-write-wins.

- identities iguais preservam brand, model, version, productionYear, modelYear e rawYearText;
- facts iguais exigem tipo, valor tipado, channel, eligibility, restrictions, validity e scope iguais;
- scopes iguais exigem tipo, selector, exclusions e flags iguais;
- groups e relationships são remapeados para IDs reconciliados e deduplicados estruturalmente;
- facts diferentes e cumulativos permanecem distintos e composition cumulativa/alternativa é mantida.

Valores incompatíveis no mesmo contexto tipado geram `IDENTITY_CONFLICT`, `FACT_CONFLICT` ou
`SCOPE_CONFLICT`, com os dois lados e sua provenance. A foundation não decide qual lado prevalece.

## UnitPlan, partitions e coverage

A reconciliação detecta unit planejada ausente, artifact não planejado, artifact/unit duplicado,
artifact inválido, ordinal inconsistente e coverage declarada não completa. Artifacts inválidos não
contribuem para entidades reconciliadas.

Partitions usam `logicalTableId` e `{ index, count }` server-owned. O resultado ordena índices,
detecta missing/duplicate partition, preserva inherited-header block IDs vindos do DocumentMap e
marca `structurallyContinuous` somente quando todos os índices planejados aparecem exatamente uma
vez e o plano é coerente. Conteúdo de tabela não é concatenado quando essa prova estrutural falha;
divergências semânticas de header/footnote viram trabalho da 10C.3D-B.

## Issues

Codes implementados: `MISSING_UNIT_ARTIFACT`, `UNPLANNED_ARTIFACT`,
`DUPLICATE_UNIT_ARTIFACT`, `INVALID_ARTIFACT`, `INCONSISTENT_UNIT_ORDINAL`,
`MISSING_TABLE_PARTITION`, `DUPLICATE_TABLE_PARTITION`, `TABLE_CONTINUITY_UNPROVEN`,
`IDENTITY_CONFLICT`, `FACT_CONFLICT`, `SCOPE_CONFLICT`, `DANGLING_REFERENCE` e
`COVERAGE_MISMATCH`. Cada issue possui ID determinístico, severity, affected refs, provenance e
mensagem segura.

## Determinismo, imutabilidade e complexidade

Não são usados relógio, UUID, random, locale do host ou ordem incidental de `Map`/`Set`. Inputs e
provenance são ordenados por comparação ordinal explícita; IDs são atribuídos depois de ordenar as
chaves canônicas. Testes com input permutado exigem `JSON.stringify` byte-equivalente e executam com
inputs deep-frozen.

O merge principal usa índices `Map`: O(N) para agrupar e O(U log U) para ordenar entidades únicas.
Detecção de conflitos agrupa por contexto. Não existe comparação par-a-par global de identities ou
facts, suportando fixtures de 4, 13, 20 e 100 identities sem algoritmo obviamente quadrático.

## Fronteiras

Não há Product matching, Policy/Offer final, `promotionPlan`, domain mapping, persistência, migration,
RPC, Supabase, Storage, provider, OpenAI ou UI. A primitive não foi conectada a
`processAdminImportBatch`, segmented extraction runtime, registry ou Server Actions.

**RUNTIME MERGE/RECONCILIATION ACTIVE? NO.**
