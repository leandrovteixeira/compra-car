# Sprint 10C.4C — Runtime Orchestration

Status: **PAUSED AFTER EXPERIMENTAL SEGMENTED PIPELINE VALIDATION; default one-shot**

> A Sprint 10C foi pausada estrategicamente em 2026-08-23. Não executar novo benchmark ou continuar
> prompt/contract patches sem decisão explícita e simplification review. O código permanece
> versionado e disponível. Ver `SPRINT_10C_PAUSE_CHECKPOINT.md`.

## Unit Extraction coverage reason diagnostics

Quando `/coverage/status: incompleteDataMarkedComplete` ocorre, o diagnostic estrutural opt-in pode
agora informar, em ordem fixa, somente quais predicados estáticos estavam verdadeiros:
`UNIT_COUNT_MISMATCH`, `GAPS_PRESENT`, `INCOMPLETE_BLOCKS_PRESENT`,
`UNRESOLVED_TABLE_ROWS_PRESENT`, `UNRESOLVED_SCOPES_PRESENT`, `VEHICLE_COUNT_MISMATCH` e
`FAMILY_SET_MISMATCH`. A lista não contém counts, valores, family names, IDs, mensagens, excerpts ou
raw output e não é concatenada à mensagem pública do erro.

A mudança é exclusivamente observacional: não altera artifact, canonicalizer, coverage status,
invariants, prompt v8 ou escolha entre partial e ambiguous.

## Unit Extraction source block excerpt

O último retry real alcançou `unit-0003-table`, que falhou na canonical validation somente em
`/blocks/2/excerpt: maxLength`; `unit-0005-section` foi sibling abort. Document Map e Unit Plan
passaram. O schema canônico exige `blocks[].excerpt` presente, não vazio e limitado a 1.000
caracteres, mas a projection Structured Outputs remove `minLength` e `maxLength`; reconstruction
preserva a string longa e transfere a decisão para a fronteira canônica.

O excerpt é um snippet literal auxiliar, não o conteúdo comercial autoritativo nem um dump do PDF.
Proveniência continua em document, page, region, table/row e IDs referenciados; facts, evidence,
tables e cells permanecem independentes. Por isso, o canonicalizer limita apenas
`blocks[].excerpt` ao prefixo literal de 1.000 Unicode code points antes da validação, sem trim,
resumo, reticências ou texto sintético. A string vazia continua falhando em `minLength`, e nenhum
outro campo textual é reduzido.

O prompt da Unit Extraction v8 exige o menor fragmento literal suficiente, dentro do limite, e
proíbe parágrafo/tabela/documento completo, resumo, rewrite, reticências e placeholders. O schema e
seus limites não mudaram.

**READY FOR UNIT EXTRACTION RETRY AFTER EXCERPT BOUNDING FIX.** Nenhum retry foi executado.

## Unit Extraction coverage status

O último retry real alcançou `unit-0005-table`, que falhou na canonical validation somente em
`/coverage/status: incompleteDataMarkedComplete`; `unit-0006-table` foi sibling abort. Document Map e
Unit Plan passaram. O diagnóstico seguro não revela qual dos sete predicados de coverage estava
presente, portanto esse detalhe do artifact real permanece pendente sem consultar output bruto.

`complete` é impossível quando units completas divergem do total, existe qualquer gap, block
incompleto, row ou scope não resolvido, `expectedVehicleCount` diverge do total extraído, ou os
conjuntos de famílias divergem. Os três counters continuam server-owned, mas status das units, gaps,
unresolved, expectativas e materialidade são provider-semantic. Como certos sinais admitem tanto
`partial` quanto `ambiguous`, o servidor não pode escolher um downgrade universal sem reinterpretar
o documento.

O canonicalizer continua preservando `coverage.status` e a invariant permanece estrita. O prompt da
Unit Extraction v7 formaliza `complete`, diferencia incompletude conhecida de ambiguidade e proíbe
ocultar evidence para produzir COMPLETE otimista.

**READY FOR UNIT EXTRACTION RETRY AFTER COVERAGE STATUS FIX.** Nenhum retry foi executado.

## Unit Extraction blank table cells

A execução real mais recente passou por Document Map e Unit Plan. A unit 2 falhou na validação
canônica porque duas `tables[0].rows[8].cells[*].text` eram `""`; a unit 1 foi sibling abort. O wire
aceitou os valores porque a projection remove `minLength`, enquanto o contrato canônico mantém
`text` required, non-nullable e `minLength: 1`.

Cells são sparse e identificadas por `columnId`; seu índice no array não determina alinhamento, e o
validator não exige uma cell por column. Assim, uma interseção visual sem texto pode ser omitida sem
deslocar as demais. O contrato não diferencia blank, unknown, not-applicable ou merged/inherited e
não possui `rowSpan`/`colSpan`; permitir `""` acrescentaria um estado ambíguo desnecessário. O schema
permanece estrito.

O prompt da Unit Extraction v6 agora manda emitir apenas cells com texto visível não vazio, omitir a
cell blank preservando os `columnId` das demais, não inventar placeholders ou propagar “same as
above”, e registrar coverage gap/unresolved row quando a ausência for material. Texto ou símbolo
literalmente impresso continua preservado.

**READY FOR UNIT EXTRACTION RETRY AFTER BLANK CELL FIX.** Nenhum retry foi executado.

## Document Map required collections

O último retry real retornou Structured Output, mas a defesa local de transport validation recusou
`documents[0]` porque `issuerHints` foi omitido. A property é required e non-nullable tanto no
schema canônico quanto no wire, mas seu array pode ser `[]`. O fato observado é uma divergência do
payload retornado apesar do schema strict; provider, projection e validator não foram alterados.

O prompt v3 exigia provenance real para cada hint presente, mas não mandava emitir as quatro
collections required quando não houvesse candidato. O prompt v4 agora exige sempre `titleHints`,
`issuerHints`, `competenceHints` e `validityHints`, usa `[]` para ausência legítima, proíbe omissão e
proíbe inventar hint. A mesma regra geral cobre qualquer collection required vazia do Document Map.
O transport validator continua executando sobre o raw wire antes de reconstruction e não preenche
campos ausentes no servidor.

**READY FOR DOCUMENT MAP RETRY AFTER REQUIRED COLLECTION FIX.** Nenhum retry foi executado.

## Document Map metadata source refs

O último retry real retornou Structured Output e passou por wire validation e reconstruction, mas
falhou em `canonicalizeCommercialDocumentMapIds` com uma única
`unknown_reference` originada em `metadataHints`; o Unit Plan não iniciou. O smoke antigo não
publicou o diagnostic interno, portanto o path real completo permanece pendente entre
`/documents/{d}/{titleHints|issuerHints|competenceHints|validityHints}/{h}/sourceBlockIds/{r}`. Não há
base para concluir sobre qualidade documental antes de observar esse path em um retry futuro.

Os quatro tipos de metadata hint têm a mesma forma: `{ value, sourceBlockIds }`. Cada hint exige ao
menos um source block real do namespace `contentBlocks[].contentBlockId`; a lista de hints pode ser
vazia. Não existem page/section/table/note/hint/edge refs nesse objeto. Provenance não é redundante:
nenhuma relação inversa permite ao servidor inferir qual block sustenta título, emissor, competência
ou validade.

Não há bug de ordem. Todos os maps de definitions, inclusive blocks, são construídos globalmente
antes que documentos e metadata hints sejam remapeados. Definition posterior no JSON passa;
same-kind duplicate continua falhando; o mesmo raw ID em kinds distintos continua válido; e o hint
resolve exclusivamente no namespace block.

Com diagnostics opt-in, canonicalization agora emite
`SEGMENTED_DOCUMENT_MAP_CANONICALIZATION` com total, contagens por category, amostra
`{ path, kind, category }` e truncation. Raw IDs, values, metadata text, evidence e provider output
não são incluídos. O prompt do Document Map v3 exige que toda ref resolva para objeto real emitido no
mesmo mapa, manda omitir o hint quando nenhum source block real for identificável e proíbe criar
placeholder apenas para satisfazer refs. Unknown refs, schema e canonicalizer permanecem estritos.

**READY FOR DOCUMENT MAP RETRY AFTER METADATA REF FIX.** Nenhum retry foi executado.

## Unit Extraction relationship factIds

O retry real seguinte passou pelo Document Map e Unit Plan. A unit 4 falhou em
`transport_validation` com duas violações `minItems` em
`composition.relationships[*].factIds`; a unit 5 foi abortada como sibling. O erro final foi
`UNIT_EXTRACTION_INVALID_STRUCTURED_OUTPUT`.

O contrato não permite relationship group-only. Todas as properties do objeto são required e
non-nullable; `factIds` exige ao menos um fact concreto e `evidenceBlockIds` ao menos um block.
`groupIds` e `scopeIds` podem ser arrays vazios. `APPLIES_TOGETHER` e `MUTUALLY_EXCLUSIVE` ainda
exigem ao menos dois subjects fact/group no total; `GENERAL_RULE`, `EXCEPTION`, `EXCLUDES` e
`OVERRIDES` não acrescentam outra cardinalidade além do fact obrigatório. A collection externa
`relationships` pode ser `[]`.

O prompt efetivo era v4, não v3: já dizia “at least one actual fact”, mas ainda permitiu uma leitura
group-only/placeholder sob o objeto completo required pelo Structured Outputs. O prompt v5 agora
proíbe literalmente `factIds: []`, declara que `groupIds` não substitui o fact, manda omitir a relação
quando houver somente group e fornece exemplos abstratos válidos/inválidos. Schema, `minItems`,
projection, validator e canonicalizer não mudaram. Nenhuma sanitização raw foi adicionada porque uma
relação inválida pode ainda conter intenção semântica que o servidor não pode apagar com segurança.

**READY FOR UNIT EXTRACTION RETRY AFTER RELATIONSHIP PROMPT FIX.** Nenhum retry foi executado.

## Document Map page–section back-reference

O último retry real passou por Structured Output, validação do wire, reconstruction, canonicalização
de IDs e JSON Schema canônico. A única falha foi referencial:
`/sections/4/pageIds: missingPageBackReference`; por isso o Unit Plan não iniciou. Esse avanço confirma
que os blockers anteriores de ID/pattern e `table.headerBlockIds minItems` foram superados nessa
execução.

`page.sectionIds` e `section.pageIds` são projeções redundantes do mesmo membership estrutural. Antes,
ambas eram authority do provider: o canonicalizer remapeava cada lista independentemente e o
validator exigia somente que cada par declarado em `section.pageIds` estivesse repetido em
`page.sectionIds`. Agora, depois que todas as referências são resolvidas para IDs canônicos, o
canonicalizer forma a união dos pares explicitamente declarados em qualquer dos lados, elimina
duplicatas e reprojeta a relação nos dois sentidos. Nenhum par é criado sem observação em ao menos um
lado, e dangling refs continuam falhando antes da normalização.

A auditoria não generalizou a união. Tabela–página está acoplada à lista ordenada de segments e não
permite fabricar o segmento ausente; note/content block possuem ownership singular pela entidade;
entity hints e context edges não têm uma projeção inversa semanticamente equivalente; e os arrays de
blocks da tabela distinguem header, source e segment provenance. Schema, invariant, transport,
planner e prompt permanecem inalterados.

**READY FOR DOCUMENT MAP RETRY AFTER BACK-REFERENCE NORMALIZATION.** Nenhum retry foi executado.

## Unit Extraction coverage server-owned

A execução real seguinte chegou à validação canônica da unit 1 e falhou em
`/coverage/completedUnitCount: inconsistentWithUnits`; a unit 3 recebeu sibling abort. No contrato
`CommercialDocumentExtraction/1`, não existe `totalUnitCount`: o campo equivalente é
`expectedUnitCount`. O validator define `expectedUnitCount` como `coverage.units.length`,
`completedUnitCount` como o número de units com `status === complete` e `extractedVehicleCount` como
`vehicleIdentities.length`.

Esses três contadores eram required no wire e copiados do provider pelo canonicalizer, embora sejam
projeções exatas do artefato. Agora são reconstruídos deterministicamente antes da validação
canônica. O contrato continua genérico: uma resposta segmentada descreve somente a unit corrente,
mas fixtures e outros usos agregados podem conter várias `coverage.units`; portanto nenhuma contagem
foi hardcoded como `1`.

O provider ainda tem autoridade interpretativa sobre `coverage.status`, o status de cada unit,
`expectedVehicleCount`, famílias esperadas, gaps e itens unresolved. O canonicalizer não transforma
partial/ambiguous em complete e não remove evidência de incompletude. O prompt da Unit Extraction v4
orienta `0` apenas como sentinel transport para os três contadores required e informa que o servidor
os substitui; isso não relaxa schema nem invariants semânticos.

**READY FOR UNIT EXTRACTION RETRY AFTER COVERAGE FIX.** Nenhum retry foi executado.

## Unit Extraction composition sem placeholders

A execução real seguinte chegou às units. A unit 3 (`TABLE`) falhou em `transport_validation` com
quatro violações `minItems`: dois groups com `memberFactIds: []` e duas relationships com
`factIds: []`. A unit 4 foi abortada como sibling depois da falha fatal.

O contrato canônico e transport têm a mesma semântica de cardinalidade. `composition` é required;
Structured Outputs também exige suas propriedades `groups` e `relationships`. As coleções externas,
porém, não têm `minItems`: `groups: []` e `relationships: []` representam legitimamente ausência de
composição. Um elemento interno não é sentinel. `compositionGroup.memberFactIds` tem `minItems: 2`,
pois ALTERNATIVE/CUMULATIVE precisa relacionar membros reais, e `compositionRelation.factIds` tem
`minItems: 1`; relationships também exigem evidence, e `APPLIES_TOGETHER`/`MUTUALLY_EXCLUSIVE`
precisam de dois subjects fact/group no total pelo invariant validator.

O prompt v2 mencionava relações cumulative/alternative atribuíveis à unit, mas não mandava criar
composition sempre, nem usar arrays vazios como sentinel. O gap era não distinguir explicitamente a
coleção vazia válida de um objeto-placeholder inválido no schema completo. O prompt da Unit
Extraction v3 agora cria group apenas com ao menos dois member facts e scope reais, cria relationship
apenas com fact/evidence reais, proíbe placeholders e orienta composition ausente para arrays externos
vazios. Não há marca ou fixture hardcoded.

Outros arrays internos com cardinalidade positiva foram auditados e não alterados: documents;
evidence block IDs; cells/source blocks de rows; segments/source blocks de tables; pages/columns e
source blocks de tables; fact scope IDs; scope evidence; composition group scope IDs; relationship
evidence; e coverage unit source blocks. Eles são potenciais próximos riscos de placeholder, mas não
há evidência atual para mudar schema ou prompt fora de composition.

**READY FOR UNIT EXTRACTION RETRY AFTER COMPOSITION FIX.** Nenhum retry foi executado.

## Alinhamento do Document Map transport validator

O retry seguinte teve provider call succeeded e Structured Output returned, mas parou no wire
validator do Document Map com 82 violações, todas `pattern`, antes de reconstruction, canonicalization
e Unit Plan. O provider request e o AJV local já recebiam por identidade a mesma constante
`openAITransportDocumentMapSchema`; portanto não havia uma segunda transformação independente.

A divergência era entre a política arquitetural e a projeção efetiva. O detector de ID local removia
patterns apenas de uma lista parcial de prefixos. O schema wire ainda continha 20 patterns de
`page`, `section`, `note`, `hint` e `edge`, que explicam os paths observados em `pageId`,
`entityHintIds` e `contextEdgeIds`. A regra agora reconhece o formato estrutural exato de IDs
server-owned em vez de enumerar prefixos. O Document Map transport fica com zero ID patterns; a Unit
Extraction continua sem ID patterns, mas preserva patterns comerciais de amount, currency e
percentage.

O schema passado ao provider e o compilado pelo AJV têm guards de identidade para os dois stages.
Unit Extraction também passa a executar a fronteira na ordem correta: raw wire validation,
reconstruction, canonicalization e canonical validation. A antiga reprojeção do payload reconstruído
foi removida porque podia converter propriedades ausentes no wire em sentinelas `null` antes do AJV.

IDs model-local fora do pattern canônico passam no wire, são remapeados pelo canonicalizer e passam na
validação canônica. Constraints deliberadamente preservadas continuam ativas: `headerBlockIds: []`
falha por `minItems`, tipo inválido falha por `type` e propriedade ausente falha por `required`.
Schemas/patterns canônicos, canonicalizers, prompt v2 e planner não mudaram.

**READY FOR SEGMENTED RETRY AFTER TRANSPORT VALIDATOR ALIGNMENT.** Nenhum retry foi executado.

## Document Map table header minItems

O retry mais recente parou antes do Unit Plan com uma única violação canônica em
`/tables/6/headerBlockIds`, keyword `minItems`. O trace local provou que o campo é required e
non-nullable em ambos os schemas, com `minItems: 1`, `maxItems: 500` e items string/block. A projeção
transport preserva `minItems`/`maxItems`, não torna items nullable e mantém o campo required. Somente
propriedades opcionais são representadas no wire por uma união com `null`.

`reconstructCanonicalValueFromOpenAITransport` não remove array items: `['block-x']`, `[null]`,
`['block-x', null]` e `[]` preservam exatamente a mesma cardinalidade. Logo a reconstruction não pode
converter um array válido de um item em vazio. O canonicalizer também apenas remapeia IDs existentes.
Para o validator final observar `[]`, esse array vazio já precisava ter atravessado o response wire.

O gap local era validação defensiva assimétrica: Unit Extraction tinha AJV transport, enquanto o
Document Map confiava em `strict: true`, fazia `JSON.parse` e seguia diretamente para reconstruction.
O runtime agora valida o raw Document Map contra o schema transport efetivo antes de reconstruir ou
canonicalizar. Falhas continuam usando diagnóstico sanitizado `{ path, keyword, category }` e não
publicam artifact.

O contrato existente não admite table sem header. Tabelas multipágina são uma única table com
`headerBlockIds` originais; segmentos `CONTINUE` exigem `inheritedHeaderBlockIds` que resolvem dentro
desse conjunto. Não há tipo atual para continuation-only table, fragment table ou layout table sem
header. O prompt v2 agora exige ao menos um header block real e orienta conteúdo sem header
identificável a permanecer em content blocks/sections. `minItems: 1`, schema, canonicalizer e planner
não mudaram.

**READY FOR DOCUMENT MAP RETRY AFTER MINITEMS FIX.** Nenhum retry foi executado.

## Evidence source provenance e seleção da falha causal — Job 45/attempt 8

A reconciliação read-only do batch 117/documento 48 encontrou o Job 45/attempt 8, correlation
`33776123-5d8a-49d7-a18d-161277e4f17a`, failed e sem job ativo. O artifact 3 (`document_map`) e o
artifact 4 (`unit_plan`) estão succeeded, ligados pela dependency 4→3. Não há artifact
`unit_extraction` nem `pricing_import_rows`. A resposta da unit 2 chegou, mas falhou na validação
canônica com dois `unknownRef` em candidates/evidence; a unit 1 foi abortada como sibling.

O namespace de `CommercialDocumentEvidence.blockIds` é exclusivamente o dos `blocks` definidos no
mesmo artifact de extração. Os IDs de `Document Map.contentBlocks` são source provenance do Unit
Context, não refs canônicas diretas do artifact final. O mismatch ocorria no prompt: ele fornecia os
IDs do mapa sem explicar que o conteúdo usado também precisava ser materializado em
`CommercialDocumentExtraction.blocks`. O transport reconstruction não altera esses IDs; o
canonicalizer cria um mapa old→new apenas a partir das definições de `blocks`, remapeia todas as refs
conhecidas e preserva refs desconhecidas para que o validator as rejeite. Portanto a validação
referencial estava correta.

O Unit Context passa a fornecer os objetos `primaryContentBlocks` e `contextOnlyContentBlocks`. O
prompt v2 estabelece a ponte sem mudar schema: para uma fonte realmente usada, a extração deve criar
um bloco real a partir do PDF e reutilizar temporariamente o ID canônico do source block como
`blockId`. Definição e evidence entram no mesmo mapa e sobrevivem à canonicalization. Não se cria
placeholder. Source context-only pode apoiar interpretação/evidence materializada, mas não criar fato
exclusivo. Ref sem definição permanece `unknownRef`, e ref duplicada permanece inválida por
`uniqueItems`.

O runtime não usa mais o primeiro failed na ordem do plano. A seleção ordena por classe causal e usa
ordinal/unit ID apenas para desempate estável: `INVALID_STRUCTURED_OUTPUT`,
`CANONICAL_VALIDATION_FAILED`, `PROVIDER_FAILURE`, `PROVIDER_TIMEOUT` e
`ORCHESTRATION_TIMEOUT` precedem `ABORTED_SIBLING`. Assim, unit 1 abortada + unit 2 canonicamente
inválida resulta em `UNIT_EXTRACTION_CANONICAL_VALIDATION_FAILED`, independentemente da ordem do
array.

A persistência não foi redesenhada: a unit 2 inválida não publica artifact, a unit 1 abortada também
não, e os artifacts succeeded de Document Map/Unit Plan permanecem. Como o resultado failed de unit
não carrega usage/providerRunId e a agregação só ocorre para success, o usage da resposta da unit 2
continua perdido. Essa dívida e reuso cross-job seguem fora do escopo.

**READY FOR UNIT EXTRACTION RETRY AFTER EVIDENCE REF FIX.** Não executar retry automaticamente.

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
