# Sprint 10C.3B — Document Map e plano determinístico de units

Status: **contrato e planner puros implementados; nenhuma integração runtime**
Data: 2026-08-16

## Decisão

A etapa foi dividida em dois contratos provider-agnostic:

```text
provider structured output
  → CommercialDocumentMap/1
  → JSON Schema + invariantes server-owned
  → planner puro e determinístico
  → CommercialExtractionUnitPlan/1
```

`CommercialDocumentMap/1` é um inventário estrutural menor que
`CommercialDocumentExtraction/1`. Ele não contém células comerciais, facts finais, Policy, Offer,
MSRP por Product, matching, IDs de banco ou promoção. `CommercialExtractionUnitPlan/1` não é output
de IA: o servidor o deriva do mapa validado. Assim, uma resposta interpretativa não controla IDs,
limites, particionamento ou coverage.

Os types puros são exportados pelo barrel raiz de `@compra-car/core`. Schema, validator e planner
possuem subpaths explícitos e ficam fora do barrel raiz. Ajv, portanto, não volta ao grafo do
Middleware/Edge; essa é a mesma fronteira estabelecida na 10C.3A.

## `CommercialDocumentMap/1`

O artifact registra:

- documentos, ordinais, quantidade de páginas, kind candidato e hints de título, emissor,
  competência e validade;
- toda página com role, seções, tabelas, notas, entity hints, context edges e content blocks;
- blocks estruturais (`HEADING`, `BODY`, `TABLE_REGION`, `NOTE_REGION`, `OTHER`), sem transcrever o
  PDF;
- seções ordenadas com papel semântico, páginas, parent opcional, hints e source blocks;
- tabelas lógicas sem células, com páginas, segmentos `START|CONTINUE|END|WHOLE`, headers, row
  estimate, labels de coluna, footnotes e context edges;
- notas localizadas document/section/table-wide, footnote, eligibility, general rule, exception ou
  errata;
- hints locais de brand, family, model, version e channel;
- edges tipadas para continuação, header herdado, footnote, regra de escopo, errata e contexto
  compartilhado.

JSON Schema Draft 2020-12 usa `additionalProperties: false` em todos os objetos. O validator puro
impõe bytes, contagens, IDs únicos, páginas contíguas, ownership documento/página, back-references,
ordem, parents acíclicos, segmentos de tabela, headers herdados e context edges sem dangling ou
cross-document references.

## `CommercialExtractionUnitPlan/1`

Cada unit possui ID e ordinal server-owned, tipo `TABLE|SECTION|FAMILY|CHANNEL|PAGE_RANGE_FALLBACK`,
páginas e blocks separados entre primary e context-only, refs de section/table/note/hint, row
estimate, motivo e overlaps rastreáveis. Partitions carregam `logicalTableId` e `{ index, count }`.

Prioridade do planner:

1. tabela lógica e contexto obrigatório;
2. seção/família coerente ainda não atribuída;
3. seção de canal;
4. intervalo físico limitado somente para conteúdo residual.

Uma tabela multipágina permanece uma unit quando cabe nos limites. Se exceder páginas ou row
estimate, o planner cria partitions ordenadas da mesma tabela. A primeira carrega o header como
primary; as seguintes recebem o header original como context-only com reason `INHERITED_HEADER`.
Footnotes e notas aplicáveis entram por ID e source block como context-only. Uma nota geral posterior
é ligada às units destinatárias por scope/context edges e pela classificação document-wide; não
depende de proximidade visual.

Overlap é explícito por ref, uso (`CONTEXT_ONLY` ou `PARTITION_PRIMARY`) e reason. Contexto repetido
nunca vira primary silenciosamente. O merge futuro poderá distinguir contexto reiterado de dois
fatos distintos.

## Limites experimentais

| Limite | Valor | Rationale |
|---|---:|---|
| mapa serializado | 4 MiB | estrutura sem células; margem para documentos densos |
| documentos/páginas | 20 / 2.000 | compatível com dossiê atual, sem limite por fabricante |
| blocks/sections/tables | 10.000 / 1.000 / 1.000 | inventário estrutural, não rows comerciais |
| notes/hints/edges | 4.000 / 5.000 / 10.000 | contexto denso e relações explícitas |
| páginas por unit | 8 | evita unit monolítica sem reduzir tabelas pequenas a páginas |
| tabelas por unit | 4 | teto defensivo; o planner atual usa uma tabela lógica por TABLE unit |
| rows aproximadas por unit | 60 | divide tabelas densas e preserva casos de ~13 rows |
| context pages adicionais | 4 | header, nota geral e vizinhos de continuação |
| total de units | 1.000 | impede explosão acidental e unit por veículo |
| fallback | 6 páginas | intervalo limitado quando não há estrutura melhor |

Os limites são experimentais, independentes de marca e devem ser medidos na 10C.3F. Excedê-los
falha explicitamente; não trunca o mapa.

## Coverage estrutural

O planner calcula deterministicamente listas atribuídas e órfãs. `allPagesClassified` somente é
verdadeiro quando não existem páginas, seções, tabelas, relevant notes ou content blocks sem unit.
O validator recalcula coverage a partir das units e do mapa; confidence do provider não participa.

IDs do mapa são locais ao artifact e serão canonicalizados pelo assembler do plugin/servidor na
integração futura; labels propostas pelo provider não têm autoridade persistente. Nesta entrega sem
runtime, fixtures exercitam essa forma local. IDs e ordinais das units já são criados exclusivamente
pelo planner server-owned.

## Fixtures sintéticas

- **Geely-like:** seis páginas, duas tabelas/famílias e regra geral posterior alcançável pelas units
  anteriores.
- **GWM-like:** uma tabela lógica em duas páginas, header herdado, footnote e estimate 13/13.
- **Fiat-like:** dezessete páginas, doze family hints distintos, seis tabelas/100 combinações,
  financiamento, canal direto e seção geral; segmentação por tabela/seção, nunca por veículo.
- **Volvo-like:** vinte combinações em tabelas de dois canais, eligibility específica e nota
  compartilhada sem contaminar o outro canal.
- **VW-like:** 48 páginas, tabelas densas de 240/180 rows, partitions determinísticas e fallback
  limitado para anexo não estruturado.

Todo conteúdo é estrutural e sintético; nenhum PDF ou valor comercial real foi copiado.

## Provider futuro

O core não importa SDK. A integração futura deve oferecer uma primitive genérica semelhante a:

```ts
interface StructuredExtractionProvider {
  extractStructured(request: {
    documents: readonly ServerDocument[];
    instructions: string;
    schemaName: string;
    schema: Readonly<Record<string, unknown>>;
  }): Promise<{ output: unknown; run: SafeProviderRunMetadata }>;
}
```

O plugin/orchestrator fornece schema, instructions e estratégia; o provider cuida apenas de
transport, structured output, timeout, usage e cleanup. O servidor valida o output como
`CommercialDocumentMap/1` e cria o UnitPlan. Nenhuma interface foi conectada ao provider ativo nesta
Sprint.

## Fronteira desta entrega

Não mudaram `processAdminImportBatch`, `OpenAIExtractionProvider`, registry, prompt/commercial
extraction atual, smoke harness, adapter Supabase, RPC, banco ou lifecycle. Não houve migration,
batch, Staging, Production, Legacy ou chamada de modelo. Execução por unit, merge, reconciliation,
domain mapping, artifacts e retry pertencem às Sprints 10C.3C–E.
