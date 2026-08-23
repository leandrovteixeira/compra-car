# Sprint 10C.3A — Intermediate Extraction Contract

Status: **contrato experimental e fixtures implementados; nenhum runtime ativo**
Data: 2026-08-16
Contrato: `CommercialDocumentExtraction/1`

## Decisão

`CommercialDocumentExtraction/1` é o artifact provider-agnostic que responde somente o que o
documento contém, onde contém e qual é seu escopo/estrutura documental. Ele fica em `packages/core`
e separa **document extraction** de **domain mapping**.

O contrato não seleciona Product, não cria `commercial_policy` ou `commercial_offer`, não decide
matching, não produz plano/ação de promoção e não possui IDs de banco. O pipeline canônico atual
continua usando `commercial-letter/mmv-payload/1` sem qualquer integração com este artifact.

## Estrutura do artifact

O objeto raiz possui `additionalProperties: false` e os campos:

- `schemaVersion`: constante `CommercialDocumentExtraction/1`;
- `documents`: referências lógicas locais, ordenação, page count, tipo documental, candidatos de
  competência/validade e notas;
- `blocks`: evidence curta e localizável por documento/página, com região normalizada opcional e
  associação opcional a tabela/row;
- `tables`: tabela lógica, colunas, rows, páginas, segmentos de continuação, cabeçalhos herdados e
  footnotes;
- `vehicleIdentities`: brand/model/version e PY/MY documentais, sem Product ID;
- `facts`: fatos comerciais atômicos, valor tipado, canal, eligibility, restrições, validade, scope e
  evidence;
- `scopes`: aplicabilidade estruturada e exclusões;
- `composition`: grupos cumulativos/alternativos e relações documentais;
- `coverage`: units, contagens, famílias, gaps, blocks/rows/scopes não resolvidos e estado final.

## Valores documentais

Facts usam uma união discriminada:

- `money`: decimal como string e moeda ISO-like de três letras;
- `percentage`: decimal como string;
- `quantity`: decimal, unidade e texto original opcional;
- `text`: texto documental curto;
- `boolean`: valor e texto original opcional.

Strings decimais evitam perda de precisão binária. `rawText`/`excerpt` preservam somente evidence
curta; o artifact não é dump de PDF. A distinção entre preço público, promocional, bônus, trade-in,
entrada, parcelas e demais fatos permanece em `factType`.

PY e MY são campos independentes. `rawYearText` pode preservar `2025/2026`; os campos estruturados só
devem existir quando o documento torna a ordem inequívoca. O schema aceita ausência dos dois anos e o
validator recusa pares parcialmente preenchidos.

## IDs e referências

Todos os IDs são locais ao artifact, usam prefixos e não possuem semântica de banco:

`document-`, `block-`, `table-`, `column-`, `row-`, `vehicle-`, `fact-`, `scope-`, `group-`,
`relation-`, `unit-` e `gap-`.

Decisão de autoridade: IDs são **server-owned no artifact reconciliado**. O extractor futuro poderá
emitir chaves de origem, mas o document map/assembler deverá atribuir IDs determinísticos por ordem e
provenance e reescrever referências antes da validação final. A 10C.3A não implementa esse assembler,
pois isso pertence ao Document Map/merge das 10C.3B–D. As fixtures representam artifacts já
montados; o validator nunca cria ou corrige IDs silenciosamente.

O validator confirma unicidade e integridade de:

- document → page;
- block → document/table/row;
- table → blocks/columns/rows/segments/footnotes;
- vehicle/fact/candidate → evidence;
- fact → scopes;
- scope → documents/vehicles/groups;
- group/relation → facts/groups/scopes/blocks;
- coverage → units/blocks/tables/rows/scopes.

`coverage.status` distingue `complete`, `partial` e `ambiguous`. Complete exige todas as units
completas, ausência de gaps e unresolved/incomplete references e igualdade das expectativas
declaradas de vehicles/families. Partial representa incompletude conhecida e precisa de evidência
estrutural dessa lacuna. Ambiguous representa interpretação não resolvida e precisa de gap de
ambiguidade, unit ambígua ou scope não resolvido. Os sinais não tornam partial e ambiguous
mutuamente exclusivos; por isso assemblers não reclassificam automaticamente um status sem base
semântica.

## Blocks e tabelas

Blocks guardam `excerpt` literal, não vazio, de até 1.000 Unicode code points, posição por página e
região `[0,1]` opcional. Não há texto integral, bytes, base64, URL privada ou geometria completa. Na
fronteira de Unit Extraction, o canonicalizer limita somente um source block excerpt excedente ao
prefixo literal permitido antes da validação, sem trim, resumo, reticências ou texto sintético;
facts, evidence e demais campos comerciais permanecem intocados.

Uma tabela multipágina possui uma única `tableId`, `pages` ascendentes e `continuation.segments`.
Segmentos posteriores registram `inheritsHeadersFromPage`; `inheritedHeaderBlockIds` e
`footnoteBlockIds` preservam contexto. A página seguinte não se torna tabela independente.

Rows usam cells sparse identificadas explicitamente por `columnId`; a posição no array não substitui
a identidade da column e uma row não precisa repetir todas as columns. Uma interseção visual sem
texto é representada pela ausência da cell correspondente. `cell.text` existe apenas para conteúdo
visível não vazio. O v1 não possui `rowSpan`, `colSpan` nem estado merged/inherited/unknown; esses
valores não são inferidos ou propagados da linha anterior, e ausência material deve permanecer em
coverage como gap/row não resolvida.

## Vehicle identities e fatos

`vehicleIdentityId` identifica somente um candidato documental. Brand/model são obrigatórios;
version e anos podem permanecer ausentes quando a fonte for ambígua. Confidence é factual e contém
score, ambiguidade, review e razões; não mede confiança de matching.

Os fact types v1 são: preços público/promocional, bônus, desconto, trade-in, taxa/entrada/parcelas de
financiamento, carência, emplacamento, acessório, wallbox, recarga, seguro, manutenção, eligibility,
restrição, regra de canal e `other`.

## Scope

Os tipos versionados são `DOCUMENT`, `BRAND_LINE`, `MODEL`, `VERSION_SET`, `VEHICLE`, `CHANNEL` e
`GROUP`. Cada scope exige o seletor coerente com seu tipo e pode conter exclusões estruturadas. Um
fact pode referenciar vários scopes, permitindo sobreposição, model+channel e um único fato aplicado
a muitas identidades sem duplicação.

Scope ambíguo exige `requiresReview=true`. Ausência, exclusão e ambiguidade ficam explícitas e não são
resolvidas por proximidade textual.

## Composição comercial documental

`composition.groups` representa:

- `ALTERNATIVE`: `memberFactIds` mutuamente exclusivos;
- `CUMULATIVE`: `memberFactIds` que se aplicam juntos;
- `sharedFactIds`: fatos gerais presentes em todas as alternativas;
- `parentGroupId`: composição hierárquica quando documentada.

`relationships` registra `APPLIES_TOGETHER`, `MUTUALLY_EXCLUSIVE`, `GENERAL_RULE`, `EXCEPTION`,
`EXCLUDES` e `OVERRIDES`, sempre com evidence e referências válidas. Isso não cria Offer final.

## Coverage

Coverage suporta `complete`, `partial` e `ambiguous` e registra:

- units esperadas e concluídas;
- itens esperados/extraídos por unit;
- identidades esperadas/extraídas quando a expectativa é conhecida;
- famílias esperadas/encontradas;
- gaps, blocks incompletos, rows não resolvidas e scopes não resolvidos.

`complete` exige todas as units concluídas, contagens conhecidas reconciliadas, famílias iguais e zero
gap/unresolved. `partial` exige diferença ou gap observável. `ambiguous` exige ambiguity, unit ambígua
ou scope não resolvido.

## Limites experimentais

| Elemento | Limite |
|---|---:|
| artifact serializado | 8 MiB |
| documentos | 20 |
| blocks | 2.000 |
| tables | 200 |
| rows por table | 2.000 |
| vehicle identities | 2.000 |
| facts | 10.000 |
| scopes | 5.000 |
| composition groups | 2.000 |
| relationships | 10.000 |
| extraction units | 2.000 |
| excerpt | 1.000 caracteres |
| texto individual | 2.000 caracteres |

Esses limites contêm artifacts abusivos sem reproduzir o limite canônico de 100 rows. A fixture de
escala usa 100 identities, 400 facts, 100 groups e 100 relationships. O limite de
`pricing_import_rows` permanece inalterado.

## JSON Schema e validator

O JSON Schema usa Draft 2020-12, arrays tipados, enums versionados, limites e
`additionalProperties: false` em todos os objetos. Datas usam formato calendário ISO. Integridade
referencial dinâmica permanece no validator puro com Ajv + invariantes, sem banco.

Além das referências, o validator verifica páginas, anos 1886–2100, pares PY/MY, formato monetário,
percentuais, datas, continuação de tabela, ciclos de parent group, shape das relações e consistência de
coverage. Payload acima de 8 MiB é recusado antes da travessia do schema.

## Fixtures sintéticas

- **Geely-like:** quatro identities, regra ampla com exclusão, regras por versão, duas alternativas,
  regra cumulativa compartilhada e zero referência quebrada;
- **GWM-like:** treze rows/identities/facts, tabela lógica em duas páginas, headers herdados,
  footnote e coverage 13/13;
- **Fiat-like:** doze famílias, cem identities, três canais, PY/MY explícitos, bônus, trade-in,
  financiamento, facts floor-plan-like e muitas relações;
- **Volvo-like:** vinte identities, três canais, sessenta prices, financiamento apenas em dois canais,
  restrição compartilhada e relações válidas.

Nenhum valor ou texto comercial real foi copiado.

## Diferença para `commercial-letter/mmv-payload/1`

| Intermediate extraction | Payload canônico |
|---|---|
| fatos e identities documentais | MMV e domínio comercial final |
| scope/relações explícitos | Policies/Offers materializados |
| coverage de source/units/rows | rows canônicas limitadas a 100 |
| confidence factual | confidence do payload processado |
| sem matching/persistência | matching e gates server-owned posteriores |

## Fora da 10C.3A

Permanecem **PENDENTE**: Document Map real (10C.3B), segmented extraction, merge/reconciliation,
domain mapper, artifact persistence/retention, migrations, jobs/states, runtime, benchmark e qualquer
execução de provider. O próximo passo autorizado pelo roadmap é **10C.3B — Document Map**.
