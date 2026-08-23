# Sprint 10C.3C — Segmented Extraction

Status: **primitive interna e testável implementada; runtime ativo permanece inalterado**
Data: 2026-08-16

## Decisão

A 10C.3C implementa o trecho puramente operacional:

```text
CommercialDocumentMap/1 + CommercialExtractionUnitPlan/1 + source privado
  → source session genérica
  → N structured extraction requests limitados por unit
  → transport validation
  → canonicalização server-owned de IDs locais
  → canonical validation
  → N CommercialDocumentExtraction/1 + metadata operacional em memória
```

Não há merge entre artifacts, domain mapping, matching, persistência, migration ou integração com
`processAdminImportBatch`. O provider `openai/4`, o registry e o prompt one-shot continuam sendo o
caminho ativo.

## Auditoria do provider anterior

O provider atual já oferecia as primitivas úteis: bytes server-only, upload temporário com
`purpose=user_data` e expiração de uma hora, Responses com `store:false`, `AbortSignal`, deadline,
usage sanitizada e cleanup em `finally`. Porém upload, schema, prompt comercial, reconstrução do
payload final e lifecycle estavam reunidos em `OpenAIExtractionProvider.extract`.

A menor extensão foi preservar essa classe e expor separadamente:

- `StructuredExtractionProvider.openSource`, contrato provider-agnostic do core;
- `OpenAIStructuredExtractionProvider`, sessão server-only que faz um upload por documento, permite
  várias respostas estruturadas e remove os files apenas em `close`;
- projeção genérica do JSON Schema para o subset strict de Structured Outputs;
- orchestrator e canonicalizador em subpaths explícitos do core.

O provider genérico conhece somente source, instructions, schema, signal e metadata operacional. Ele
não possui operação comercial e não seleciona Product, Policy ou Offer.

## Input de unit e instructions

Cada request deriva contexto explícito do plano validado: `unitId`, ordinal, kind, documento,
primary/context-only pages e blocks, sections, tables, `logicalTableId`, partition, notes/footnotes,
entity hints, context edges e inherited headers. O arquivo completo pode ser referenciado, mas as
instructions limitam fatos novos às primary pages e tornam context-only somente interpretativo.

O prompt de unit é brand-agnostic e exige extração documental, evidence, scope, exclusões,
eligibility/channel, relações cumulativas/alternativas, PY/MY separados, cautela com MSRP,
ambiguidade e coverage explícitos. Proíbe chain-of-thought, Product, matching, domínio final,
persistência e promoção. Na v8, também define `blocks[].excerpt` como snippet literal curto de até
1.000 Unicode code points e proíbe reproduzir parágrafo/tabela/documento longo, resumir, reescrever,
adicionar reticências, placeholders ou texto inventado.

## Transport e contrato canônico

O contrato normativo continua sendo `CommercialDocumentExtraction/1`. Como o schema Draft 2020-12
possui `oneOf`, opcionais e keywords fora do subset de Structured Outputs, o transporte usa projeção
estrita:

- `oneOf` vira `anyOf`;
- propriedades opcionais tornam-se required+nullable somente no wire;
- keywords não suportadas são removidas somente do wire;
- `enum`/`const` recebem type explícito quando inequivocamente string;
- `null` de ausência é removido na reconstrução.

O round-trip é testado, inclusive para unions discriminadas. Depois da reconstrução, o schema e todas
as invariantes canônicas voltam a ser autoridade; a projeção não relaxa o contrato do core.

## Canonicalização server-owned

Além de remapear IDs locais e suas referências, a fronteira canônica limita somente um
`blocks[].excerpt` excedente ao prefixo literal de 1.000 Unicode code points. Essa defesa é necessária
porque a projection Structured Outputs remove `maxLength`; ela não altera facts, evidence refs,
tables/cells nem qualquer outro campo textual. Excerpt vazio permanece inválido e nenhum conteúdo é
sintetizado.

IDs locais do output não têm autoridade fora da unit. O servidor enumera cada kind na ordem do
artifact e reescreve deterministicamente todos os IDs e referências como
`<kind>-u<unitOrdinal>-<localOrdinal>`. Documents, blocks, tables, columns, rows, vehicles, facts,
scopes, groups, relationships, coverage units e gaps são cobertos. O mesmo input e ordinal produzem
JSON byte-equivalente. Dangling refs passam pela forma de transporte, mas falham na validação
canônica; não são corrigidas silenciosamente.

## Concorrência, deadlines e falhas

O scheduler usa ordem crescente do UnitPlan, concorrência default 2 e faixa explícita 1–4. A ordem
do resultado sempre segue o plano, independentemente da conclusão. Após falha fatal nenhuma unit
nova é retirada da fila; requests em voo recebem abort e units não iniciadas ficam explicitamente
`ABORTED_SIBLING`.

Defaults internos:

- unit/provider operation: 120 s, configurável entre 10 ms e 300 s para permitir testes
  determinísticos; valores baixos não são registrados no runtime;
- orchestration total: 480 s, configurável entre 20 ms e 600 s;
- margem recomendada do runner para cleanup/convergência: 30 s além do deadline total.

Não existe `480 s × N`. O sinal total alcança todas as units e o signal por unit aplica o limite
local. Os códigos seguros são `PROVIDER_TIMEOUT`, `PROVIDER_FAILURE`,
`INVALID_STRUCTURED_OUTPUT`, `CANONICAL_VALIDATION_FAILED`, `ORCHESTRATION_TIMEOUT` e
`ABORTED_SIBLING`. Nenhum raw PDF/output/request/header/token/URL integra o resultado.

## Source reuse e cleanup

A source session ordena documentos, faz upload uma vez e reutiliza os mesmos file IDs em todas as
Responses. Uma unit não remove files enquanto siblings os utilizam. `close` roda após a convergência
de workers e tenta remover todos os files; falha de cleanup é registrada como estado operacional e
não substitui uma falha primária. `store:false` permanece obrigatório, e a expiração de uma hora do
client oficial continua defesa residual.

## Resultado operacional e retry futuro

O resultado em memória preserva correlation ID, schema/prompt version, ordem, status, unit ID/kind
via plano, duração, provider run e usage por unit. Isso permite identificar units sucedidas/falhas e
reexecutá-las futuramente, mas a 10C.3C não implementa retry automático nem persistência. Lifecycle,
retenção e metadata transacional precisam ser decididos junto às fases posteriores antes de qualquer
migration.

## Cobertura sintética

Testes locais cobrem unit isolável, múltiplas units, tabela lógica multipágina 13/13, partitions,
header herdado, footnote/context-only, regra geral posterior, 4 identities com escopo amplo,
100 combinações, 20 identities multicanal, PY/MY, exclusão, cumulativo/alternativo, ambiguidade e
coverage parcial. Também cobrem malformed/dangling, determinismo byte-equivalente, bounded
concurrency, ordem de conclusão, stop scheduling, abort, deadlines, source reuse, cleanup e metadata.

## Fronteira para 10C.3D

Permanecem pendentes merge/dedupe de facts, reconciliação de continuações, aliases, conflitos,
coverage bidirecional entre units, artifact persistence/retention e replay durável. A 10C.3D deverá
consumir somente artifacts unitários canonicamente válidos e seus resultados operacionais.

**RUNTIME SEGMENTED EXTRACTION ACTIVE? NO.**
