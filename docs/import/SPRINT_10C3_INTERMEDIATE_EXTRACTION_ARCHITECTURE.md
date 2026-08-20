# Sprint 10C.3 — Arquitetura de extração intermediária

Status: **10C.3 concluída internamente; lifecycle 10C.4A implementada sem runtime ativo**
Data: 2026-08-16
Decisão recomendada: **pipeline intermediário segmentado (Option C)**

Implementação do contrato: `docs/import/SPRINT_10C3A_INTERMEDIATE_CONTRACT.md`. Types, JSON Schema,
validator puro e fixtures sintéticas de 10C.3A vivem em `packages/core`. A 10C.3B adicionou
`CommercialDocumentMap/1`, planner server-owned e `CommercialExtractionUnitPlan/1`. A 10C.3C
adicionou execução interna por unit, source reuse, concorrência/deadlines e canonicalização local;
foundation determinística e Semantic Reconciliation foram implementadas na 10C.3D; Domain Mapping
puro para o payload canônico foi implementado na 10C.3E; benchmark/rollout permanecem pendentes.
Detalhes:
`docs/import/SPRINT_10C3B_DOCUMENT_MAP.md` e
`docs/import/SPRINT_10C3C_SEGMENTED_EXTRACTION.md`.
Contrato da nova fronteira: `docs/import/SPRINT_10C3D_MERGE_RECONCILIATION.md`.

## Resumo executivo

O pipeline atual preserva segurança e autoridade do domínio, mas pede a uma única resposta de modelo
que compreenda o dossiê, enumere tabelas e MMVs, resolva escopo, componha Policies/Offers, repita
evidence e entregue diretamente `commercial-letter/mmv-payload/1`. Os benchmarks mostraram boa
precision local, porém recall e integridade variáveis: perda de linhas e famílias, underpropagation e
referências relacionais inválidas.

A recomendação é pausar tuning de prompt one-shot e separar duas perguntas:

1. **Document extraction:** o que o documento diz, onde diz e em qual estrutura/contexto?
2. **Domain mapping:** como fatos documentais reconciliados viram MMV, Policy e Offer?

Para documentos densos, a primeira pergunta deve ser segmentada. O desenho-alvo é:

```text
PDF privado
  → DOCUMENT MAP
  → EXTRACTION UNITS
  → CommercialDocumentExtraction/1 (fatos intermediários)
  → MERGE + RECONCILE
  → DOMAIN MAP
  → commercial-letter/mmv-payload/1
  → validação/matching/persistência atuais
```

Esta spike não ativa esse fluxo, não muda schemas persistidos e não cria migration.

## Arquitetura atual

O caminho ativo continua:

```text
Supabase Storage privado
  → ImportProcessingRepository.downloadDocument
  → ExtractionProvider.extract(schema + instructions + PDFs)
  → OpenAI Files/Responses ou FakeProvider
  → CommercialLetterExtraction/1
  → reconstrução canônica server-owned
  → commercial-letter/mmv-payload/1
  → Ajv + invariantes canônicas
  → matching server-owned em chunks
  → finalize_import_processing_job
  → pricing_import_rows
```

### Responsabilidades atuais

| Responsabilidade | Classe | Local atual |
|---|---|---|
| leitura do Storage e ordenação do dossiê | server-owned deterministic | adapter/application |
| upload temporário e chamada Structured Outputs | document extraction transport | provider |
| inventário de páginas, tabelas, famílias e MMVs | document extraction | prompt one-shot |
| interpretação de cabeçalhos, notas e continuações | document extraction | prompt one-shot |
| resolução de escopo, eligibility, canal e E/OU | domain interpretation | prompt one-shot |
| criação de Policies e Offers locais | domain interpretation | prompt one-shot |
| evidence e confidence | extraction + interpretation | prompt one-shot |
| schema strict de transporte | deterministic boundary | provider/application |
| reconstrução de campos server-owned | server-owned deterministic | application/core |
| derivação de confidence band | server-owned deterministic | core |
| validação de IDs e Offer→Policy | server-owned deterministic | core |
| parsing/normalização canônica | server-owned deterministic | core/plugin |
| matching de Product | server-owned deterministic | core/adapter |
| lifecycle, auditoria e persistência | server-owned deterministic | core/adapter/RPCs |

O provider não possui autoridade comercial, o que deve ser preservado. A mistura problemática está
no **formato solicitado à IA**: extração documental e modelagem relacional final compartilham uma
única janela de atenção e um único limite de output.

## Failure modes observados

- **Geely:** MMVs/MSRP e precision corretos; rule scope amplo ainda não fecha em todos os
  destinatários, mesmo após Prompts v3/v4.
- **GWM:** uma row de treze MMVs nominais; perda de cobertura de tabela antes do domínio.
- **Fiat:** duas rows para aproximadamente cem combinações e dez de doze famílias ausentes; contexto,
  escala e enumeração falharam juntos.
- **Volvo:** fatos locais plausíveis, mas Offers referenciaram Policies inexistentes; o backend
  recusou corretamente o payload.

Esses resultados indicam falhas diferentes dentro da mesma resposta monolítica. Hoje não é possível
reexecutar apenas uma tabela, distinguir fato extraído de decisão de domínio nem auditar em qual etapa
uma família desapareceu.

## Por que Excel era mais fácil

Na ingestão de planilha, linhas, colunas, cabeçalhos e células já constituem uma representação
intermediária. A transformação começa com unidades enumeráveis e pode validar contagens antes de
mapear o domínio. No PDF, o pipeline atual tenta criar essa estrutura e o payload final ao mesmo
tempo.

O intermediate model recria a vantagem da planilha:

```text
PDF caótico
  → seções/tabelas/linhas/fatos documentais enumerados
  → transformação semelhante a linhas estruturadas
  → MMVs/Policies/Offers finais
```

Isso permite detectar perda de linha/família antes do domain mapping, propagar regras por relações de
escopo explícitas, gerar client IDs determinísticos e validar referências antes do payload final.

## Opções avaliadas

### Option A — continuar one-shot e criar Prompt v5

Menor esforço e latência nominal de uma chamada, mas preserva acoplamento, failure blast radius,
pressão de output e baixa observabilidade. Os v3/v4 mostram retorno decrescente: mais instruções não
garantem que o modelo mantenha inventário, escopo e materialização relacional simultaneamente.

### Option B — two-stage intermediate model sem segmentação

Separa fatos documentais de domínio e melhora auditoria. É opção aceitável para documentos pequenos,
mas uma primeira etapa monolítica ainda pode perder famílias/tabelas em documentos densos e continua
limitada pelo output global.

### Option C — intermediate pipeline segmentado

Usa document map, unidades limitadas, merge/reconciliation e domain mapping. Tem maior esforço,
latência agregada e número de operações, porém oferece melhor recall, isolamento de falha,
auditabilidade e escala. É a opção recomendada. Documentos pequenos podem usar uma única extraction
unit sem abandonar as mesmas fronteiras contratuais.

| Critério | A: one-shot | B: two-stage | C: segmentado |
|---|---|---|---|
| precision | boa atual | preservável | preservável |
| recall | instável | melhor | melhor e verificável por unidade |
| observability/audit | baixa | média | alta |
| failure isolation/retry | batch inteiro | por etapa | por unidade/etapa |
| latência nominal | menor | média | maior |
| custo nominal | uma chamada grande | duas grandes | várias menores; medir |
| escala >100 | inadequada | limitada | adequada com merge paginado |
| complexidade/esforço | baixo | médio | alto |

## Contrato intermediário proposto

Nome conceitual: `CommercialDocumentExtraction/1`.

O contrato preserva semântica documental e referências internas. Ele não contém Product ID, matching,
IDs persistidos, locks, ações de promoção, `promotionPlan`, Policy ou Offer final.

```ts
interface CommercialDocumentExtractionV1 {
  schemaVersion: 'CommercialDocumentExtraction/1';
  dossier: {
    documents: SourceDocument[];
    competenceCandidates: SourcedValue<string>[];
    validityStatements: SourcedText[];
    globalNotes: SourcedText[];
  };
  blocks: DocumentBlock[];
  tables: DocumentTable[];
  vehicles: DocumentVehicleIdentity[];
  facts: CommercialDocumentFact[];
  relations: DocumentRelation[];
  coverage: DocumentCoverage;
}
```

### Menor representação útil

**SourceDocument** contém somente ID efêmero do documento no dossiê, role, ordinal e page count
observado. Filename continua provenance, nunca fonte semântica.

**DocumentBlock**:

- `blockId` determinístico dentro do artifact;
- documento, página e região opcional;
- `kind`: heading, paragraph, note, footnote, table, image ou unknown;
- seção/título/rótulo semântico;
- excerpt curto e hash/proveniência.

**DocumentTable**:

- `tableId`, páginas e block IDs;
- cabeçalhos ordenados e linhas com `rowId`;
- células por coluna, sem forçar significado comercial final;
- `continuesTableId`/`continuedByTableId`;
- notas e rodapés referenciados por ID.

Não é necessário guardar geometria completa de PDF no primeiro rollout. Região é opcional e deve ser
adicionada apenas quando o provider a obtiver de forma confiável.

**DocumentVehicleIdentity**:

- `vehicleRef` local;
- brand/model/version como valores documentais;
- productionYear e modelYear separados;
- external labels/codes observados;
- referências ao bloco, tabela e linha de origem;
- nenhuma seleção de Product.

**CommercialDocumentFact**:

- `factId`, `factType` documental e raw semantic label;
- valor textual e, quando inequívoco, valor normalizado/unidade;
- channel, eligibility e restrictions como fatos documentais;
- `scopeRef` e referências de source;
- evidence curta;
- confidence da extração do fato, não de Policy final.

O vocabulário de `factType` deve ser menor que o catálogo de Policies: public price, promotional
price, monetary benefit, financing condition, included item/service, validity, restriction,
eligibility, unknown commercial condition. A etapa documental não decide `retail_bonus` versus outra
Policy quando a fonte não sustentar a distinção.

**DocumentRelation** usa IDs locais e tipos explícitos:

- fact applies-to vehicle/version/channel/offer-group;
- table row identifies vehicle;
- note qualifies block/table/fact;
- alternative-with / cumulative-with;
- excludes / overrides;
- table continuation.

**DocumentCoverage** registra contagens e gaps observáveis: páginas mapeadas, units esperadas/
concluídas, tabelas/linhas enumeradas, famílias e relações sem destino. Não declara o payload pronto
para promoção.

## Invariantes do intermediário

- todo fato referencia block/table row existente;
- toda evidence referencia documento e página válidos;
- IDs locais são únicos e determinísticos no artifact;
- relações não podem apontar para IDs ausentes;
- PY e MY são campos distintos;
- tabela continuada forma grafo acíclico;
- unidades não podem desaparecer do merge sem status/justificativa;
- ausência e ambiguidade permanecem explícitas;
- nenhum campo server-owned do domínio final é aceito.

## Segmentação e extraction units

Unidade padrão recomendada: **seção ou tabela com contexto adjacente**, não página isolada. A página é
boa fronteira operacional, mas notas, cabeçalhos e tabelas frequentemente atravessam páginas.

Prioridade de particionamento:

1. tabela e suas continuações;
2. seção/família/modelo;
3. bloco comercial ou canal;
4. intervalo de páginas somente como fallback físico.

Cada unit recebe seu conteúdo mais document map mínimo necessário: título da seção, cabeçalhos
herdados, notas relacionadas, páginas anterior/seguinte quando continuidade foi indicada e IDs
estáveis. Units podem sobrepor contexto; o merge deduplica fatos por chave e provenance, sem descartar
evidence divergente.

### Estratégia por volume

- **<20 rows estimadas:** uma ou poucas units; mesmas quatro etapas, sem fast path sem contrato.
- **20–100 rows:** units por tabela/família/canal e merge único antes do domain map.
- **>100 rows:** múltiplos artifacts intermediários e domain-map partitions; a saída canônica atual
  continua limitada a 100 rows por tentativa/artifact. Não truncar nem aumentar o limite agora.

## Orquestração map/reduce

### Pass 1 — DOCUMENT MAP

Produz inventário barato de documentos, páginas, seções, tabelas, famílias, canais, notas e relações
de continuidade. Não produz Policies/Offers.

### Pass 2 — EXTRACT UNIT

Extrai identities, cells/facts, evidence e relações somente da unit. Cada resultado valida contra um
subcontrato do intermediário e possui ID/idempotency key próprios.

### Pass 3 — MERGE + RECONCILE

Une continuações, deduplica identities/facts, resolve aliases determinísticos, preserva provenance e
executa coverage bidirecional fato↔destinatário. Conflitos permanecem como gaps revisáveis; não são
resolvidos por last-write-wins.

### Pass 4 — DOMAIN MAP

Consome apenas o intermediate reconciliado e mapeia para MMV/Policy/Offer. A entrada agora se parece
com planilha estruturada. O mapper gera IDs locais determinísticos e o validator atual confirma
Offer→Policy antes de matching/persistência.

## Fronteiras determinísticas

Devem sair da IA ou ser verificados obrigatoriamente pelo servidor:

- criação/dedupe de IDs e chaves de artifact/unit;
- parsing monetário, percentual e datas quando formato é canônico;
- parsing PY/MY de pares explicitamente rotulados;
- merge por IDs/source keys e união de evidence;
- joins de continuações declaradas;
- contagens página/tabela/linha/família/unit;
- cobertura e referências órfãs;
- clientPolicyId/clientOfferId finais;
- schema/Ajv e invariantes;
- batching, tamanho, idempotência, lifecycle e retry;
- Product matching, fingerprint, confidence band e promoção.

Continuam interpretativos:

- semântica de tabela/célula mesclada;
- associação de nota/rodapé;
- escopo e exceções expressos em linguagem natural;
- eligibility e canal implícitos;
- relações E/OU quando não estruturadas;
- precedência de errata/complemento;
- aplicabilidade ambígua.

A IA pode propor essas relações, mas o artifact deve torná-las explícitas, evidenciadas e revisáveis.

## Provider e plugin

Não expandir `ExtractionProvider` para incorporar métodos comerciais como `mapToDomain`. O provider
deve permanecer uma capacidade genérica de structured extraction por request/unit. Orquestração e
contratos pertencem ao plugin.

Fronteiras propostas:

- **provider:** upload/transport, chamada estruturada, usage, timeout, cleanup e erro seguro;
- **Import Engine orchestration:** jobs/stages/units, idempotência, concorrência, retry e artifacts;
- **plugin `commercial_letters`:** document-map schema/instructions, unit strategy, intermediate
  schema, merge rules, reconciliation e domain mapper;
- **core:** tipos/invariantes puros e autoridade server-owned;
- **adapter:** Storage privado e persistência futura de artifacts/jobs, sem lógica comercial.

O OpenAI provider atual pode implementar as primitivas futuras, mas não deve conhecer Policy,
Offer, catálogo ou tabelas Supabase.

## Persistência do intermediário

| Opção | Auditoria/debug | Reprocessamento | Complexidade/privacy |
|---|---|---|---|
| memória | baixa | repete extração | simples, perde evidência operacional |
| JSON no banco | alta | boa | payloads grandes, migrations e pressão no Data API |
| tabela relacional staged | máxima/queryável | excelente | maior schema, migração e acoplamento precoce |
| JSON privado no Object Storage | alta via artifact imutável | boa | exige manifest, retenção e controle de acesso |

Recomendação: **artifact JSON imutável no mesmo Storage privado**, com hash, versão, tamanho, stage,
unit ID e correlation ID em um manifest persistido futuramente. O conteúdo fica fora das rows finais;
o banco guarda somente metadata operacional mínima. Essa opção isola payload volumoso, permite replay
do merge/domain map sem nova extração e mantém acesso server-only.

Antes de implementar, definir retenção, criptografia padrão, remoção/expiração, limites por artifact,
redação de logs e grants/RLS. Novas tabelas públicas devem ser explicitamente expostas ou mantidas
server-only conforme as regras atuais da Data API; nenhuma tabela/migration é criada nesta spike.

## Lifecycle e retry futuros

Estados conceituais, não enums ativos:

```text
mapping_document
→ extracting_units
→ merging
→ reconciling
→ mapping_domain
→ needs_review | failed
```

Cada stage registra attempt, input/output artifact hashes, provider run/usage quando aplicável e erro
seguro. Retry é granular:

- unit falhou: reexecutar somente a unit;
- tabela incompleta: criar/reabrir units relacionadas;
- merge falhou: repetir deterministicamente usando os mesmos artifacts;
- reconciliation falhou: review ou correção do artifact, sem nova leitura do PDF;
- domain map falhou: repetir a partir do intermediário versionado;
- mudança de schema/prompt: nova artifact version, nunca sobrescrever baseline.

Finalize de rows continua transacional apenas depois de domain mapping validado. Não alterar enums,
RPCs ou tabelas até o desenho de 10C.3A ser aprovado.

## Human review

Review deve ocorrer no nível mais informativo possível:

```text
source page/block/table row
  → extracted fact
  → scope/relation/exclusion
  → target vehicle rows/offer groups
  → domain Policy/Offer proposal
```

Perguntas como “esta nota se aplica a quais versões?” são revisáveis antes que se transformem em uma
Policy faltante. A UI futura pode mostrar painel lado a lado, evidence destacada, destinatários
esperados/cobertos, conflitos de merge e impacto downstream. A aprovação continua humana e não
promove automaticamente.

## Pressão de tokens, custo e latência

O one-shot repete evidence, metadata, Policies compartilhadas e Offers em até 100 payloads canônicos.
Uma resposta grande falha como unidade e exige repetir input/output inteiro.

Segmentação tende a:

- reduzir output por chamada e isolar retries;
- repetir algum contexto de input entre units;
- aumentar número de chamadas e latência agregada;
- permitir paralelismo limitado e medição por tabela/família;
- evitar repetir o payload canônico verboso durante document extraction;
- tornar custo atribuível por stage/unit.

Não há base para prometer redução líquida de custo ou latência. O benchmark 10C.3F deve medir tokens,
cache, retries, wall time, completeness e custo total. Precisão/recall e auditabilidade são os gates
primários.

## Test cases arquiteturais

- **Geely-like:** regra ampla com exceções e cobertura fato↔todas as rows/Offers.
- **GWM-like:** todas as linhas de tabela aparecem no document map, nas units e no merge.
- **Fiat-like:** doze famílias, múltiplos canais e aproximadamente cem combinações sem truncamento;
  >100 deve particionar artifacts.
- **Volvo-like:** colunas/canais distintos e geração determinística de Policies antes das Offers, com
  zero referência órfã.

Fixtures futuras devem ser sintéticas e não conter fabricantes/valores reais no prompt de produção.

## Rollout proposto

### 10C.3A — architecture and contract

**Implementada em 2026-08-16:** TypeScript/JSON Schema experimental, validator puro e fixtures
sintéticas. Nenhum runtime.

### 10C.3B — document map

**Implementada em 2026-08-16 sem runtime:** contrato versionado, schema/validator, planner puro,
coverage estrutural e fixtures sintéticas de escala. O provider ativo não foi conectado.

### 10C.3C — segmented extraction

**Implementada em 2026-08-16 sem runtime ativo:** source session genérica, instructions por unit,
projeção strict de transporte, canonicalização server-owned, concorrência limitada, deadlines,
artifacts e resultado retryable em memória. O pipeline one-shot não foi conectado.

### 10C.3D — merge and reconciliation

**Implementada em 2026-08-20 sem runtime:** Foundation com merge/dedupe/provenance/coverage e
Semantic Reconciliation com documentary rules, scope propagation, exclusions, aliases explícitos,
coverage bidirecional, validity e precedência documental explícita. Julgamento de linguagem natural
permanece fora do core determinístico.

### 10C.3E — domain mapping

**Implementada em 2026-08-20 sem runtime:** mapper determinístico
`SemanticallyReconciledCommercialDocument/1` → `CommercialDocumentDomainMappingResult/1`, com rows
`commercial-letter/mmv-payload/1`, Policies/Offers/IDs locais, integrity, coverage e provenance. A
validação canônica foi exercitada localmente; matching/finalize atuais continuam desconectados.

### 10C.3F — benchmark

Replanejado como **10C.4D — Real Benchmark**, depois de Lifecycle & Artifacts, Runtime Orchestration
e End-to-End Dry Run. A 10C.3 encerra as primitives internas sem ativação.

## Riscos e decisões pendentes

A 10C.4A encerrou as decisões pendentes de contrato mínimo, versionamento, hash, idempotência, DAG,
atomicidade compensável e retenção inicial. O alvo é Storage privado + manifest DB; a migration e o
adapter ficam para 10C.4B, junto ao consumidor runtime e ao security/pgTAP review. Deletion
automática permanece desligada até validação jurídica/privacidade.

- qualidade do document map pode virar novo ponto único de falha;
- overlap de units pode duplicar ou conflitar fatos;
- paralelismo sem limite aumenta rate limit/custo;
- artifacts ampliam retenção de dados e superfície operacional;
- correção humana de intermediário exige modelo de autorização/auditoria;
- merge semântico não pode fingir ser determinístico quando aliases/escopo forem ambíguos;
- PDFs escaneados/OCR exigem estratégia própria;
- cache e reuse de arquivos do provider dependem de política de privacidade/retention.

Blockers antes de runtime: implementar migration/adapter com security/pgTAP, definir autorização de
orquestração e cleanup, validar limites de units/concurrency e executar dry run local sem efeito
comercial. Lifecycle/versioning/hash/retention inicial foram definidos na 10C.4A.

## Decisão

Adotar **Option C** como direção da Sprint 10C.3. Pausar Prompt v5 e tuning one-shot até que o
intermediate contract e o document map sejam testáveis. Option B pode existir como configuração de
uma única unit para documentos pequenos, mas não como arquitetura paralela. O pipeline ativo
continua inalterado em `openai/4` até aprovação e implementação faseada.
