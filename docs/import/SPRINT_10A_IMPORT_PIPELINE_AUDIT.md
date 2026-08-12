# Sprint 10A — Auditoria do pipeline de importação por IA

## 1. Resumo executivo

Auditoria realizada em **2026-08-01**, sem implementação. O repositório foi inspecionado localmente e
o único ambiente remoto consultado foi **Compra Car Staging**, project ref
`shfsjyjxmgwnlexmdkcs`, confirmado antes das consultas. Todas as consultas remotas executadas foram
`SELECT` ou operações de inventário somente leitura. Produção não foi consultada nem alterada.

O projeto já possui uma fundação de importação de Pricing bem protegida e usada pelos fluxos
manuais:

- `pricing_import_batches`, `pricing_import_rows`, `pricing_import_row_reviews` e
  `pricing_import_row_outputs`;
- idempotência por chave única de batch;
- hash, origem de arquivo, modelo, prompt e versão de schema previstos no cabeçalho;
- payload bruto e normalizado, confiança, issues e Product sugerido previstos por row;
- optimistic locking estrutural por `lock_version`;
- auditoria append-only;
- imutabilidade após promoção;
- outputs tipados para preço, Policy e accumulator;
- lifecycle oficial e RPCs administrativas transacionais da Sprint 9.

Essa fundação **não é ainda um pipeline de IA operacional**. Não existem upload, bucket, worker,
fila, extração de PDF, OCR, cliente OpenAI, contrato TypeScript/JSON Schema de extração, UI de
revisão, RPC de review ou RPC que promova uma row/batch já extraída. O uso atual é exclusivamente
manual: 12 batches promovidos, 28 rows promovidas e 28 outputs no Staging.

A recomendação é evoluir, e não substituir, `pricing_import_*` para cartas comerciais. A unidade de
revisão deve ser **uma row por MMV**, com um envelope JSONB versionado e validado. A promoção deve
ser **atômica por MMV**, sempre para registros `draft`, com compare-and-swap da row e idempotência
de promoção. Entretanto, dois gates impedem fechar o desenho sem aprovação:

1. `pricing_import_row_outputs` não rastreia `commercial_offer`, membership, Product ou Product Spec;
2. as RPCs atuais exigem MSRP **published** para criar Offer. Logo, uma nova MSRP extraída não pode
   nascer `draft` e sustentar uma Offer na mesma transação sem mudar uma regra vigente, publicar o
   preço antes, ou adiar a criação da Offer.

As tabelas `price_offer_imports` e `price_offer_import_rows` são antecessoras legadas, estão vazias
no Staging e não têm consumer de aplicação, mas ainda são referenciadas por snapshot/dry-run,
migrations, testes, documentação e allowlists de proveniência. Devem ser preservadas até uma
decisão específica. `specs_import_staging` também está vazio e é legado: não oferece documento,
idempotência, review, proveniência, Product, outputs ou promoção segura para a Sprint 10B.

## 2. Escopo, método e evidências

Foram auditados:

- migrations e pgTAP em `supabase/`;
- código de `apps/web`, `packages/core`, `packages/contracts` e
  `packages/adapter-supabase`;
- scripts operacionais e de reconciliação;
- `AI_CONTEXT.md`, `ROADMAP_MASTER.md`, `CHANGELOG.md`, `docs/data`, `docs/admin`,
  `docs/architecture`, `docs/domain` e contratos;
- catálogo PostgreSQL, dados agregados, ACLs, RLS, triggers, functions, Storage, extensões,
  migrations, Edge Functions e cron do Staging.

Nenhum payload bruto, texto de documento, segredo ou conteúdo de arquivo foi copiado para este
relatório. As chaves JSON documentadas abaixo são nomes de campos agregados, não valores de negócio.

Estado remoto confirmado:

| Item | Observado |
| --- | --- |
| Projeto | Compra Car Staging |
| Project ref | `shfsjyjxmgwnlexmdkcs` |
| Região | `ca-central-1` |
| Estado | `ACTIVE_HEALTHY` |
| PostgreSQL | 17.6 |
| Timezone do banco | UTC |
| Última migration remota | `20260801202216_sprint_9h3_policy_rebate_invoice_discount` |
| Storage | 0 buckets, 0 objects |
| Edge Functions | 0 |
| Cron | 0 jobs |

O banco não está configurado globalmente como read-only; a garantia desta auditoria foi operacional:
somente consultas de leitura foram enviadas.

## 3. Mapa do pipeline atual

### 3.1 Estado conceitual existente

```text
Upload/Source (não implementado para IA)
  → Batch (`pricing_import_batches`; hoje criado por RPCs manuais)
  → Rows (`pricing_import_rows`; hoje uma linha por input manual)
  → Review (`pricing_import_row_reviews`; tabela existe, fluxo não existe)
  → Promotion (não existe para uma importação já extraída)
  → Outputs (`pricing_import_row_outputs`; preço/Policy/accumulator)
```

### 3.2 Fluxos efetivamente ativos

```text
/admin/prices/input
  → Server Action
  → manual-price-batch-service
  → aplicação `executeManualPriceBatchCreation`
  → core `CreateManualPriceBatch`
  → `ManualPriceBatchRepository`
  → `ManualPriceBatchSupabaseAdapter`
  → RPC `create_manual_price_batch`
  → batch + rows + ProductPublicPrice draft + outputs + audit
```

```text
/admin/prices/policies/input
  → Server Action
  → manual-policy-batch-service / commercial-policy-workspace-service
  → core `CreateManualPolicyBatch` / operação de período
  → `ManualPolicyBatchRepository`
  → `ManualPolicyBatchSupabaseAdapter`
  → `create_manual_policy_batch_with_rollover` ou `create_commercial_period_draft`
  → batch + rows + Policies draft + Offers draft/memberships + audit
```

```text
/admin/prices/offers
  → Server Action
  → commercial-offer-builder-service
  → core `CreateCommercialOfferDraft`
  → `CommercialOfferBuilderRepository`
  → `CommercialOfferBuilderSupabaseAdapter`
  → RPCs `create_commercial_offer_*`
  → Offer draft + memberships + audit
```

Publicação permanece separada por entidade e usa `publish_product_public_price`,
`publish_commercial_policy` e `publish_commercial_offer`. Nenhuma RPC de criação manual publica.

### 3.3 O que não existe no código da aplicação

Não foi encontrado fluxo UI → Action → Service → Use case → Repository → Adapter para
`pricing_import_*`. As tabelas são acessadas indiretamente pelas RPCs manuais. Também não foram
encontrados:

- rota ou componente de upload/importação por IA;
- repository, adapter ou contrato de importação documental;
- worker ou job processor;
- dependência OpenAI, PDF, OCR ou vision;
- variáveis OpenAI/Storage/upload nos templates de ambiente;
- mock/test double de extractor;
- prompt template ou JSON Schema versionado;
- UI/RPC de review ou promoção de row.

## 4. Inventário de schema e dados

Todos os objetos desta seção pertencem a `postgres` no Staging.

### 4.1 `pricing_import_batches`

**Classificação:** atual e reutilizável, mas incompleta para extração/retry operacionais.

Finalidade: identidade, origem, lifecycle e proveniência de um lote.

| Coluna | Tipo | Nulo | Default/observação |
| --- | --- | --- | --- |
| `id` | bigint identity | não | PK |
| `source_type` | `pricing_source_type` | não | enum |
| `idempotency_key` | text | não | unique; texto não vazio |
| `original_file_name` | text | sim | nome lógico, ainda sem sanitizador implementado |
| `storage_object_path` | text | sim | caminho, não URL |
| `content_sha256` | char(64) | sim | check hexadecimal; índice não unique |
| `campaign_reference` | text | sim | referência livre |
| `valid_from`, `valid_to` | date | sim | fim não pode anteceder início |
| `extractor_provider`, `extractor_model` | text | sim | metadados, não configuração |
| `prompt_version` | text | sim | sem catálogo de prompts |
| `schema_version` | text | não | somente check não vazio |
| `status` | `pricing_import_status` | não | `uploaded` |
| `metadata` | jsonb | não | `{}` |
| `legacy_import_id` | bigint | sim | unique parcial; deliberadamente sem FK |
| atores/datas de create/update/review/promote | uuid/timestamptz | sim conforme campo | FKs para `profiles` nos atores |
| `lock_version` | integer | não | 1; check positivo; incrementado por trigger |

Índices: PK, unique de `idempotency_key`, unique parcial de `legacy_import_id`,
`(status, created_at)`, `content_sha256` e `(source_type, created_at)`.

RLS está habilitado, sem policies. `anon` e `authenticated` não têm ACL. `service_role` possui
somente SELECT/INSERT/UPDATE. Triggers atualizam timestamp/lock, impedem delete terminal e congelam
identidade do batch promovido/arquivado.

Dados no Staging:

- 12 batches, todos `source_type=manual` e `status=promoted`;
- 4 `manual_price_batch` e 8 `manual_policy_batch`;
- nenhuma origem de arquivo, path de Storage, hash, extractor, prompt ou vínculo legado preenchido;
- `schema_version`: 4 `manual-price-batch/1` e 8 `manual-policy-batch/1`.

**Resposta operacional:** hoje o batch é criado dentro de RPCs manuais. Não existe RPC genérica de
abertura/upload, service/application layer, adapter ou UI de importação documental. A unique de
`idempotency_key` é efetiva quando o caller constrói uma chave estável; `content_sha256` sozinho não
deduplica. Não existe histórico de tentativas de extração.

### 4.2 `pricing_import_rows`

**Classificação:** atual e reutilizável, mas precisa de contrato e workflow de review.

| Coluna | Tipo | Nulo | Regra principal |
| --- | --- | --- | --- |
| `id` | bigint identity | não | PK |
| `batch_id` | bigint | não | FK batch, `ON DELETE CASCADE` antes do terminal |
| `source_row_number` | integer | não | positivo; unique com batch |
| `source_page` | integer | sim | positivo |
| `legacy_source_table`, `legacy_source_id` | text/bigint | sim | allowlist e unique parcial |
| `raw_text` | text | sim | sem limite/retention próprio |
| `raw_payload` | jsonb | não | `{}` |
| `normalized_payload` | jsonb | não | `{}`; sem schema validado |
| `confidence_score` | numeric(5,2) | sim | 0..100 |
| `matched_product_id` | integer | sim | FK Product `RESTRICT` |
| `status` | `pricing_import_row_status` | não | `parsed` |
| `issue_codes` | text[] | não | vazio; sem enum/contrato |
| datas/atores | timestamptz/uuid | conforme campo | FKs de atores para profiles |
| `lock_version` | integer | não | 1; incrementado a cada update |

Índices: PK, unique `(batch_id, source_row_number)`, unique parcial da origem legada,
`(batch_id, status)` e `matched_product_id`.

RLS/ACL seguem o mesmo padrão server-only dos batches. Os quatro triggers protegem batch/row
terminal, identidade e lock.

Dados no Staging:

- 28 rows, todas manuais, matched e `promoted`;
- nenhuma page, raw text, confidence, issue ou origem legada;
- 0 payloads vazios;
- chaves observadas correspondem aos DTOs manuais de preço e Policy, não a carta comercial.

Granularidade atual é técnica: uma row representa um input do RPC manual e produz hoje um objeto de
domínio. O schema não obriga que seja linha física, MMV ou condição. Portanto **uma row por MMV é
viável**, mas é uma nova convenção que precisa ser aprovada, versionada e testada.

`matched_product_id`, payload, issues e status podem ser alterados antes da promoção; o trigger
incrementa `lock_version`. Entretanto, não há RPC que exija a versão esperada nem append automático
de review/audit. A capacidade estrutural de concorrência existe, mas o workflow seguro ainda não.

### 4.3 `pricing_import_row_reviews`

**Classificação:** atual e reutilizável, mas sem serviço/RPC e sem vocabulário completo.

| Campo | Regra |
| --- | --- |
| `id` | bigint identity, PK |
| `import_row_id` | FK row `RESTRICT` |
| `decision` | enum fechado |
| `previous_status`, `next_status` | enums de row |
| `notes` | obrigatória para reject/request_changes |
| `snapshot` | JSONB obrigatório |
| `reviewed_at` | timestamptz, default now |
| `reviewed_by` | FK profiles, obrigatório |

Índices cobrem `(import_row_id, reviewed_at DESC)` e `(reviewed_by, reviewed_at DESC)`. A tabela tem
RLS, não tem policies e só `service_role` possui SELECT/INSERT/UPDATE; o trigger, porém, rejeita
qualquer UPDATE/DELETE e novos reviews após row promovida. Logo, o histórico é append-only e suporta
múltiplas revisões pré-promoção.

Decisões disponíveis: `approve`, `reject`, `request_changes`, `match_product`, `classify`.
Não existem decisões explícitas para ignore, correção/edição, promoção concluída ou falha. Esses
eventos podem ser descritos em snapshot/notas, mas isso seria um protocolo informal. No Staging há
0 reviews.

O snapshot é flexível, mas só é suficiente se um contrato obrigar before/after, campos editados,
row version, ator, razão e versão do schema. Hoje não existe tal contrato. A RPC futura de review
deve travar a row, exigir `expected_lock_version`, validar transição, atualizar row e anexar review e
audit na mesma transação.

### 4.4 `pricing_import_row_outputs`

**Classificação:** atual, reutilizável para preço/Policy, incompleta para Offers e Specs.

Cada registro referencia uma row e exatamente um de:

- `public_price_id`;
- `policy_id`;
- `accumulator_id`.

Há FKs `RESTRICT`, check `num_nonnulls(...) = 1`, índices em todas as FKs e unique parcial por
`(import_row_id, target_id)`. Uma row pode gerar múltiplos outputs por meio de múltiplos registros,
inclusive múltiplas Policies. O trigger congela outputs assim que a row é promovida.

Staging: 28 outputs para 28 rows; 8 preços, 20 Policies e 0 accumulators.

Lacunas confirmadas:

- não há `commercial_offer_id`;
- não há output de `commercial_offer_policies`/membership;
- não há `product_id` como output criado;
- não há `product_spec`;
- Offers não possuem `source_import_row_id` próprio;
- não existe referência explícita a período além do caminho row → batch/payload.

Alternativas para decisão:

1. **Recomendada para Pricing:** adicionar `commercial_offer_id` ao exactly-one e uma tabela filha
   tipada para memberships `(import_row_id, commercial_offer_id, commercial_policy_id)`. Preserva
   FKs e rastreabilidade integral.
2. Guardar membership somente no snapshot do audit/output da Offer. Menor mudança, mas perde FK e
   consulta relacional direta; não atende integralmente ao requisito de output rastreável.
3. Trocar por `aggregate_type + aggregate_id`. Flexível, porém remove integridade referencial; não é
   recomendado para o domínio comercial.

### 4.5 `pricing_audit_events`

**Classificação:** atual e reutilizável.

Tabela append-only com aggregate, action, snapshots before/after, reason, actor, timestamp e
`correlation_id` obrigatório. Possui índices por aggregate, ator e correlation. RLS está habilitado,
sem policies; `service_role` tem somente SELECT/INSERT. UPDATE/DELETE são bloqueados inclusive para
owner pelo trigger.

Staging: 85 eventos no total; 12 eventos de `pricing_import_batch`, todos action `promote`. Não há
eventos de review de row porque o fluxo ainda não existe.

O allowlist atual de `aggregate_type` já foi evoluído para incluir objetos comerciais, mas deve ser
revalidado se attempts, documentos ou outputs de Specs forem introduzidos.

### 4.6 Objetos auxiliares

| Objeto | Estado |
| --- | --- |
| Enums | fechados e ativos; valores detalhados na seção de lifecycle |
| Views de import | nenhuma |
| Sequences | cinco identity de pricing/audit e duas sequences legadas; owner postgres |
| Triggers | 10 relevantes: batch 3, rows 4, outputs 1, reviews 1, audit 1 |
| Edge Functions | nenhuma |
| Cron/jobs | nenhum |
| Worker/fila | nenhum implementado; `pgmq` não está instalado |
| Extensões úteis já instaladas | `pgcrypto`, `pg_trgm`, `unaccent`, `pg_net`, `pg_cron` |
| JSON Schema no banco | `pg_jsonschema` está disponível na plataforma, mas não instalado |

Não há view dependente das tabelas de import. As FKs de entrada para `pricing_import_rows` vêm de
ProductPublicPrice, CommercialPolicy, accumulator, outputs e reviews.

## 5. Legado

### 5.1 `price_offer_imports`

**Classificação:** legado ainda referenciado; candidata a remoção futura, não agora.

Colunas: `id bigint` com sequence/PK, brand, source file, campaign month, validade, status text
default `pending` e created_at. Não há idempotency key, hash, extractor, lock, audit, checks de
status/data ou unique de negócio. Não há RLS, policy ou trigger. `anon`, `authenticated` e
`service_role` mantêm `ALL` da baseline.

Staging: 0 registros.

### 5.2 `price_offer_import_rows`

**Classificação:** legado ainda referenciado; candidata a remoção futura, não agora.

Possui 23 colunas: identidade/import, MMV textual, ano/canal, preço público/promocional, desconto,
bônus, trade-in, participação dealer, taxa, entrada, prazo, parcela, page, raw text, confidence,
status, Product e created_at. Só possui PK e FKs para batch (`CASCADE`) e Product. Não há unique de
linha, checks econômicos/confidence/status, índices adicionais, RLS, policy ou trigger. ACL é `ALL`
para browser roles e service role.

Staging: 0 registros.

### 5.3 Evidência de uso

- nenhum código atual de `apps/web`, core ou adapter lê/escreve essas tabelas;
- nenhuma RPC atual de importação as utiliza;
- `packages/pricing-dry-run` ainda as lê para reconciliação;
- scripts de snapshot ainda as incluem;
- migrations/testes permitem referenciá-las via `legacy_import_id` e
  `legacy_source_table=price_offer_import_rows`;
- ADRs e docs de migração preservam seu papel histórico.

Elas são antecessoras de `pricing_import_*`, mas ainda representam colunas legadas detalhadas e uma
trilha de compatibilidade do dry-run. Estarem vazias no Staging não prova ausência em outros
ambientes. Preservar até inventário de Produção/consumers e plano explícito de aposentadoria.

### 5.4 `price_offers_staging`

**Classificação:** legado sem uso operacional observado, ainda referenciado pela allowlist/docs.

Tabela textual de 20 colunas, sem PK, constraint, índice, RLS ou trigger, com ACL ampla. Está vazia.
Não deve receber o novo fluxo.

### 5.5 `specs_import_staging`

**Classificação:** legado sem uso operacional observado; inadequada para Sprint 10B.

Tem PK bigint sem identity/default e 14 campos de catálogo de Spec. Não tem documento, batch,
Product, hash, idempotência, raw/evidence, confiança por campo, lifecycle, review, output, audit ou
optimistic lock. Não há RLS/policy/trigger e as ACLs são amplas. Está vazia.

## 6. Lifecycle atual

### 6.1 Enums implantados

| Tipo | Valores |
| --- | --- |
| `pricing_source_type` | manual, legacy_backfill, ai_extraction, api_import |
| `pricing_import_status` | uploaded, extracting, needs_review, ready, promoting, promoted, failed, rejected, archived |
| `pricing_import_row_status` | parsed, unmatched, needs_review, approved, rejected, promoted |
| `pricing_review_decision` | approve, reject, request_changes, match_product, classify |
| `pricing_audit_action` | insert, update, publish, reject, archive, link, unlink, promote |
| lifecycle final | draft, needs_review, published, rejected, archived |

O legado usa `status text` sem allowlist, default `pending`.

### 6.2 Proteção real versus máquina de estados

Os triggers garantem:

- `lock_version = old + 1` em updates de batch/row;
- batch `promoted` só permanece promoted ou vira archived;
- batch archived não regride;
- rows de batch promoted/archived ficam congeladas;
- row promoted e seus outputs ficam congelados;
- reviews são append-only e proibidos após promoção;
- delete terminal é rejeitado.

Não existe uma matriz de transições para estados não terminais. Com acesso service role, por
exemplo, `uploaded → promoted` é permitido e é exatamente o caminho dos batches manuais. Assim, o
enum não equivale a workflow protegido.

Comparação com o lifecycle sugerido para Sprint 10:

| Conceito desejado | Equivalente atual | Lacuna |
| --- | --- | --- |
| batch extracted | nenhum | usar metadata não é estado formal |
| batch review | needs_review | nome aproximado |
| batch partially_promoted | nenhum | necessário se promoção é por MMV |
| row extracted | parsed | semântica aproximada |
| row ready | approved | nome aproximado |
| row promoting | nenhum | lock transacional pode evitar estado persistente intermediário |
| row ignored | nenhum | rejected não distingue rejeição de ignore |
| row failed | nenhum | issue/status não distinguem falha operacional |

Recomendação: não alterar enums antes de decidir se status de batch é derivado das rows. Para o MVP,
é preferível derivar contagens/fila das rows e adicionar apenas estados realmente necessários. Um
estado `promoting` persistente em uma transação curta pode ser desnecessário; para worker/retry,
attempts separados são mais informativos.

## 7. RPCs e promoção

### 7.1 Inventário relevante implantado

Todas as RPCs operacionais abaixo pertencem a postgres, são `SECURITY DEFINER`, usam
`search_path=''` e concedem EXECUTE somente a postgres e `service_role`.

| RPC | Assinatura resumida | Papel atual |
| --- | --- | --- |
| `create_manual_price_batch` | rows, actor, correlation | cria provenance e preços draft atomicamente |
| `create_manual_policy_batch` | rows, actor, correlation | cria provenance e Policies draft |
| `create_manual_policy_batch_with_rollover` | rows, actor, correlation | aplica rollover oficial e cria Policies draft |
| `create_commercial_offer_with_policies` | product, price, dates, policies, actor, correlation | cria Offer draft/memberships |
| `create_commercial_offer_batch` | rows, actor, correlation | lote de Offers draft |
| `create_commercial_offer_batch_at_reference` | rows, actor, correlation | lote por referência temporal |
| `create_commercial_period_draft` | product, period, policy/offer rows, expected locks, actor, correlation | rollover + Policies/Offers draft por período |
| `update_commercial_policy_draft` | id, expected lock, changes, actor, correlation | edição oficial |
| `replace_commercial_offer_draft` | id, expected lock, policies, actor, correlation | troca atômica de memberships |
| `publish_product_public_price` | id, actor, expected lock, correlation | publicação individual |
| `publish_commercial_policy` | id, actor, expected lock, correlation | publicação individual |
| `publish_commercial_offer` | id, actor, expected lock, correlation | publicação individual |
| archive/link/unlink/rollover | ids, expected locks, actor, correlation | lifecycle e composição oficiais |

Helpers/trigger functions relacionados permanecem sem EXECUTE operacional direto. A exceção legada
é `normalize_text`, que tem search path mutável e EXECUTE amplo; o advisor do Staging a sinaliza. Não
deve ser adotada como boundary de matching da Sprint 10 sem hardening específico.

### 7.2 Existe RPC de promoção de import?

**Não.** As RPCs manuais criam o batch e os objetos finais draft no mesmo comando. Elas não recebem
um `batch_id`/`row_id` já extraído, não registram review e não promovem uma preview existente.

As RPCs manuais demonstram atomicidade e rollback PostgreSQL, mas não podem ser chamadas diretamente
por um importador de IA sem duplicar provenance e usar `source_type=manual`. Uma nova RPC deve
consumir a row aprovada e reutilizar validators/helpers oficiais; copiar regras SQL para o worker ou
para o prompt é proibido.

### 7.3 `create_commercial_period_draft`

É reutilizável como fonte de invariantes e, talvez, após refatoração interna, como helper. **Não é
reutilizável as-is** para promoção de IA porque:

- chama `create_manual_policy_batch`, criando outro batch/rows com origem manual;
- não recebe import row nem cria outputs de Offer;
- grava `source_system/source_reference` manual na Offer;
- exige exatamente um MSRP published que cubra o período;
- pode encerrar predecessors e Offers, exigindo locks e exibindo impacto temporal;
- aceita no máximo 100 Policies e 100 Offers, limite do fluxo manual, não limite aprovado de PDF.

Ela é transacional, usa advisory lock por Product, row locks, expected lock versions, ator,
correlation ID, auditoria e rollback integral. Essas propriedades devem ser preservadas na nova
fronteira.

## 8. Storage e upload

Staging possui **zero buckets e zero objects**. `storage.buckets` e `storage.objects` têm RLS, sem
policies. Não existe bucket de cartas nem de fichas, upload, signed upload, path convention,
retenção, descarte, malware scanning ou deduplicação de arquivo.

Logo, hoje:

- `storage_object_path` nunca foi preenchido;
- arquivo original não é preservado pelo pipeline;
- não há isolamento lógico por ambiente/batch/ator;
- não existe backend que baixe o arquivo;
- não há exposição pública atual porque não há bucket, mas criar bucket público seria um risco grave.

Recomendação mínima, dependente de aprovação:

- bucket **privado**, distinto por ambiente, com MIME allowlist e limite explícito;
- path opaco e determinístico, por exemplo `imports/{batch-id}/{content-sha256}/{safe-name}`;
- browser recebe apenas autorização temporária de upload, nunca service role;
- backend/worker obtém o objeto por credencial server-side ou URL assinada curta;
- persistir somente path lógico, hash e metadados sanitizados;
- definir retenção para original e derivados antes do go-live;
- bloquear upsert/overwrite; reprocessamento não substitui evidência histórica;
- validar assinatura real do arquivo, não apenas MIME/extensão;
- malware scanning/quarentena é gate de segurança, não detalhe posterior.

Supabase documenta que buckets privados submetem download a controle de acesso e podem usar URLs
assinadas temporárias; limites de tamanho e MIME são propriedades do bucket. Referências:
[Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) e
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## 9. OpenAI, IA, PDF e OCR

### 9.1 Estado atual

Não há client OpenAI, Responses API, Structured Outputs, Files API, model config, provider
abstraction, prompt, retry, timeout, usage/cost tracking, mock ou secret template. Nenhuma chave é
exposta no client porque nenhuma integração existe.

Também não há biblioteca/código para:

- extração de texto ou tabelas de PDF;
- leitura de page coordinates/bounding boxes;
- renderização de páginas para vision;
- OCR de PDFs escaneados;
- evidence snippets estruturados;
- fallback entre texto, imagem e PDF original.

Os usos de “PDF” encontrados na documentação referem-se à futura exportação da comparação, não à
ingestão.

### 9.2 Estratégia recomendada, ainda não aprovada

Não assumir que todo PDF possui text layer. A arquitetura deve separar:

1. inspeção determinística do arquivo e extração de texto/page map quando disponível;
2. classificação de qualidade do texto;
3. OCR/vision somente quando necessário;
4. extração estruturada por provider sobre conteúdo e evidências controlados;
5. validação determinística do JSON antes de persistir preview.

Enviar sempre o PDF original ao provider pode preservar layout, mas aumenta dependência, custo e
superfície de dados. Enviar só texto perde tabelas/imagens. A recomendação preliminar é combinação
adaptativa: texto + page map quando confiável; páginas/imagens apenas para trechos sem cobertura;
PDF original somente se o provider/modelo e a política de dados forem aprovados.

Limitações pendentes: provider/modelo, região/processamento de dados, retention do provider,
qualidade OCR, formatos aceitos, páginas, resolução, timeout e custo.

Documentos são **dados não confiáveis**. Texto que instrua o modelo deve ser tratado como conteúdo,
nunca como comando. Prompt, tools e schema não podem permitir ao documento selecionar tabelas,
executar SQL, escolher lifecycle ou publicar.

## 10. Contrato intermediário

Não existe schema documentado/validado de `normalized_payload` para carta comercial. Há apenas
JSONB genérico e `schema_version` não vazio. Os payloads atuais são DTOs manuais e não incluem
document envelope, evidência estruturada, confiança por campo, Offers ou operator edits.

JSONB é suficiente para o MVP **se** houver:

- uma row por MMV;
- schema versionado em código;
- validação estrita na ingestão, review e RPC de promoção;
- rejeição de campos desconhecidos;
- decimals/dates como strings canônicas;
- IDs de proposta estáveis e únicos;
- limite de tamanho/profundidade;
- raw payload imutável e edits separados/auditados.

Proposta ilustrativa, deliberadamente não fechada:

```json
{
  "schemaVersion": "commercial-letter/mmv-preview/1",
  "document": {
    "documentType": "commercial_letter",
    "brand": "string|null",
    "sourceFileName": "string",
    "competence": "YYYY-MM",
    "period": {
      "kind": "monthly|special",
      "startsOn": "YYYY-MM-DD",
      "endsOn": "YYYY-MM-DD"
    },
    "confidence": 0,
    "warnings": ["code"]
  },
  "vehicle": {
    "sourceVehicleLabel": "string",
    "brand": "string|null",
    "model": "string|null",
    "version": "string|null",
    "modelYear": 2027,
    "productionYear": 2026,
    "matchedProductId": 123,
    "matchConfidence": 0,
    "evidence": [{ "page": 1, "text": "bounded snippet", "locator": "opaque|null" }]
  },
  "price": {
    "amount": "199900.00",
    "currency": "BRL",
    "startsOn": "YYYY-MM-DD",
    "endsOn": "YYYY-MM-DD|null",
    "confidence": 0,
    "sourcePage": 1,
    "sourceText": "bounded snippet"
  },
  "policies": [
    {
      "clientRowId": "stable-id",
      "type": "retail_bonus",
      "amount": "10000.00|null",
      "rebate": "1000.00|null",
      "termMonths": null,
      "ratePercent": null,
      "downPaymentPercent": null,
      "description": "string|null",
      "confidence": 0,
      "sourcePage": 1,
      "sourceText": "bounded snippet",
      "warnings": []
    }
  ],
  "offers": [
    {
      "clientRowId": "stable-id",
      "policyClientRowIds": ["stable-id"],
      "confidence": 0,
      "sourcePage": 1,
      "sourceText": "bounded snippet",
      "warnings": []
    }
  ],
  "review": {
    "issues": [],
    "operatorEdits": [],
    "readyToPromote": false
  }
}
```

Notas de compatibilidade:

- `confidence` atual é 0..100; o schema deve manter essa escala ou migrá-la explicitamente;
- `rebate` precisa mapear `dealer_rebate_amount`, sem entrar no benefício/total da Offer;
- Desconto NF deve mapear `invoice_discount`, não `retail_bonus` ou `other`;
- período mensal/especial deve ser validado pelas regras atuais, não inferido como autoridade pela IA;
- `issue_codes` precisa de catálogo versionado; texto livre fica em detalhe/snapshot;
- `operatorEdits` não substitui review append-only. É uma projeção conveniente do histórico;
- evidence text deve ter limite e redaction; arquivo/page continuam fonte autoritativa.

## 11. UX de revisão por MMV

A UX proposta é viável com uma row por MMV e JSONB versionado.

```text
Menu lateral
  Pendentes | Revisar | Prontos | Concluídos | Ignorados
    → item = uma pricing_import_row/MMV

Painel principal
  Product sugerido + match confidence
  período/impacto temporal
  preço editável
  Policies editáveis
  Offers/editable memberships
  warnings/issues
  evidências por campo
  histórico de revisões
  ação “Importar modelo”
```

O status visual do menu deve ser derivado do status da row e dos issues, não de estado local do
React. Após sucesso, a row vira promoted, sai da fila pendente e continua consultável com outputs.
Em falha, a transação reverte e a row permanece no estado anterior; a falha operacional deve ser
registrada fora do audit de domínio revertido, por exemplo em attempt/event append-only.

Para editar parcialmente sem perder auditabilidade:

1. browser envia patch permitido + `expected_lock_version`;
2. servidor autentica admin e gera correlation ID;
3. RPC trava row e compara versão;
4. valida patch contra schema e domínio preliminar;
5. anexa review com before/after e operator edits;
6. atualiza normalized payload, match, issues/status;
7. trigger incrementa lock;
8. resposta retorna projeção nova.

Subtabelas não são necessárias no primeiro MVP para price/policy/offer proposals, mas JSONB não
deve ser usado para consultas analíticas complexas. Se o volume/edição concorrente crescer ou for
necessário validar cada proposta por FK antes da promoção, subtabelas tipadas tornam-se evolução.

## 12. Promoção atômica por MMV

### 12.1 Fronteira recomendada

Uma transação por row/MMV deve:

- autenticar admin ativo;
- exigir correlation ID e `expected_lock_version`;
- travar row/batch e Product;
- confirmar batch/row elegíveis e schema suportado;
- revalidar payload inteiro no banco/casos de uso oficiais;
- resolver preço existente ou criar preço draft;
- criar Policies draft e aplicar somente rollovers explicitamente aprovados;
- criar Offers draft/memberships quando houver MSRP published compatível;
- criar todos os outputs tipados;
- anexar review de promoção;
- atualizar row para promoted;
- recalcular estado derivado do batch;
- anexar audit;
- retornar IDs e versões.

Qualquer falha deve reverter tudo. Se preço faz parte do conjunto aprovado e falha, Policies e
Offers também falham. Não há justificativa para partial commit dentro de um MMV.

### 12.2 Preço existente

Sem decisão de negócio não deve haver upsert. Recomendação preliminar:

- mesmo Product/data/valor/moeda e origem compatível: reutilizar o preço existente e registrar
  output/reason de reuse;
- mesma chave física `(product_id, starts_on)` com valor/período divergente: bloquear para review;
- novo preço: criar draft;
- rollover/publicação continuam operações explícitas oficiais.

### 12.3 Bloqueio Price → Offer

Hoje todas as RPCs de Offer exigem MSRP published. Portanto:

- se já há MSRP published compatível, preço pode ser reutilizado e Offer draft criada;
- se a carta traz nova MSRP ainda inexistente, a promoção pode criar preço/Policies draft, mas não
  criar a Offer pelo workflow atual;
- publicar a MSRP dentro da promoção violaria a decisão de nenhuma publicação automática;
- permitir Offer draft sobre price draft altera uma invariante da Sprint 9.

Esse gate precisa ser decidido antes da implementação. A opção de menor risco é promoção em duas
etapas retomável: price/Policies draft primeiro; após publicação individual da MSRP, uma ação
idempotente conclui Offers draft e outputs. Ela sacrifica a atomicidade integral “price + policies +
offers” para preservar o lifecycle. A alternativa é aprovar explicitamente Offer draft sobre price
draft e ajustar todas as validações afetadas.

## 13. Idempotência e reprocessamento

### 13.1 O que existe

- unique global em `batch.idempotency_key`;
- `content_sha256` validado e indexado, mas não unique;
- unique `(batch_id, source_row_number)`;
- unique parcial de origem legada;
- unique de cada par row/output;
- constraints de domínio nos destinos;
- row/batch lock_version;
- outputs e rows promovidos imutáveis.

### 13.2 O que falta

- regra de composição da idempotency key de arquivo;
- identidade estável de MMV/proposta entre reprocessamentos;
- claim/lease de worker;
- attempt number e histórico de retries;
- chave única de promoção por row/schema/version;
- resposta idempotente de promoção já concluída;
- prevenção explícita de duas Policies/Offers semanticamente iguais quando chaves físicas não cobrem
  a composição;
- relação entre reprocessamento com prompt novo e batch anterior.

Mesmo PDF pode hoje originar outro batch se o caller usar nova idempotency key. O hash não impede.
Uma row não pode receber o mesmo target duas vezes, mas dois calls concorrentes podem tentar criar
targets diferentes antes de a row virar promoted se não houver RPC com lock.

Recomendação:

- upload identity = hash do conteúdo + tipo de documento + ambiente;
- processamento identity = upload identity + extractor/prompt/schema versions;
- novo prompt/schema cria novo attempt imutável; não sobrescreve raw result anterior;
- reprocessamento pode atualizar a preview ativa somente via review/audit e CAS, ou criar novo batch
  `supersedes`; decisão necessária;
- promotion RPC retorna os outputs existentes se a mesma row já foi promovida com a mesma key e
  rejeita contexto divergente.

## 14. Segurança

### 14.1 Controles atuais reutilizáveis

- área admin usa `requireRole('admin')` server-side;
- adapters de Pricing são server-only e usam service role fora do browser;
- RPCs oficiais repetem `assert_active_pricing_admin`;
- RPCs operacionais são SECURITY DEFINER, `search_path=''`, EXECUTE só para service role;
- tabelas novas têm RLS e nenhuma ACL de browser;
- ator, correlation ID, locks e audit existem nos workflows oficiais;
- publicação direta e mutação terminal são protegidas por triggers.

### 14.2 Riscos e gaps

- tabelas legadas de import e Specs têm RLS desabilitado e `ALL` para anon/authenticated;
- raw text/payload não têm surface sanitizada para o browser;
- não há bucket privado/policies/signed upload;
- não há MIME/signature/size/page limits ou malware scanning;
- não há política de retenção e descarte;
- não há provider/data-processing policy;
- não há proteção implementada contra prompt injection/document bombs;
- não há redaction de logs;
- service role tem escrita direta nas tabelas operacionais, embora o app deva usar RPCs;
- `normalize_text` legado tem search path mutável e EXECUTE amplo;
- advisor também sinaliza RLS desabilitado em `products`, `specs` e `product_specs`, risco já
  conhecido do legado e relevante para Sprint 10B.

Antes do go-live, somente admin ativo deve poder iniciar upload, revisar e promover. O browser não
deve ler `raw_payload`, `raw_text`, provider response, object path irrestrito ou audit snapshot
completo. Criar uma projection/RPC sanitizada para a review UI.

Nunca logar: API keys/service role, signed URLs, arquivo/texto integral, payload bruto integral,
headers de autorização, PII eventualmente presente, response completa do provider ou snapshots
econômicos sem redaction. Logs devem usar IDs, versões, códigos de erro, duração e contagens.

## 15. Observabilidade

Já existem campos para batch ID, row ID, correlation ID, provider/model, prompt/schema version e
review/promotion timestamps. Não existem latency, tokens, custo, attempts ou erros estruturados.

Métricas mínimas propostas:

- uploads aceitos/rejeitados por MIME/size/hash;
- batches por status e idade no status;
- duração de queue, extração determinística, OCR, provider e persistência;
- attempts/retries por etapa e código de erro;
- páginas/bytes/MMVs por documento;
- provider/model/prompt/schema version;
- tokens de entrada/saída e custo reportado pelo provider, sem estimativa inventada;
- rows por status, match class e faixa de confidence;
- issue codes por frequência;
- taxa de correção humana por campo/tipo;
- aprovação, rejeição, ignore e rematch;
- promoções bem-sucedidas/falhas/conflitos/retries;
- outputs por tipo e tempo até publicação individual.

Um registro de extraction/promotion attempt append-only é necessário para falhas: eventos inseridos
na mesma transação que reverte não sobrevivem. Não enviar documentos/payloads para telemetria.

## 16. Custos e limites

Não há configuração no repositório ou Staging para:

- tamanho máximo de upload;
- MIME types;
- páginas por PDF;
- MMVs por documento;
- timeout;
- chunking;
- retries/backoff;
- concorrência;
- token budget;
- custo máximo por documento.

Nenhum valor deve ser assumido. O limite de 100 rows das RPCs manuais não é automaticamente limite
de carta comercial. Custo aproximado também está **PENDENTE** até provider, modelo, estratégia
PDF/texto/vision e amostra representativa serem aprovados.

Processamento síncrono dentro de Server Action cria risco de timeout, retry do browser e abandono.
Recomendação: upload e criação do batch síncronos; extração assíncrona com claim/lease/idempotência;
review e promoção curtas/síncronas. O runtime do worker — Edge Function, processo dedicado ou outro
executor — é gate, pois hoje nenhum existe.

## 17. Fichas técnicas (Sprint 10B)

### 17.1 Estado atual

O fluxo manual de Specs é:

```text
/admin/products/[id]/specs
  → Server Action
  → admin-product-specs service
  → core Load/SaveAdministrativeProductSpecs
  → `AdministrativeProductSpecsRepository`
  → `LegacySupabaseAdapter`
  → PostgREST direto em specs/product_specs/unit_conversions
```

O save faz um upsert coletivo seguido de delete coletivo. Não há transação entre requests; uma
falha no delete pode deixar escrita parcial. Não há import provenance, audit ou optimistic lock.

Fotografia do Staging:

- 10 Products, todos ativos/públicos e sem MMV duplicado normalizado observado;
- 190 Specs ativos: 115 binary, 49 numeric, 26 scale;
- 0 code nulo/duplicado;
- 306 Product Specs, cobrindo somente 2 Products; 8 Products têm zero Specs;
- nenhuma inconsistência observada de semântica numeric/binary/scale nas 306 associações;
- 0 rows em `specs_import_staging`, `product_specs_matrix_staging` e
  `specs_category_staging`;
- 0 `product_fipe_map` e 0 `unit_conversions`.

O catálogo tem unique de `specs.code` e da estrutura, e Product Specs tem unique
`(product_id,equipment_id)` e FK para Specs. A inspeção não encontrou FK de `product_specs.product_id`
para Products no Staging; isso deve ser revalidado/endereçado no desenho transacional da 10B.

### 17.2 Compartilhamento recomendado

Compartilhar:

- upload privado, hash, document metadata e retention;
- dispatcher/worker, attempts, provider abstraction e métricas;
- princípios de evidence, schema versioning, review append-only, CAS e RBAC;
- matching inicial de Product/MMV e UI shell de fila.

Manter específico por domínio:

- JSON Schema de carta versus ficha;
- match de Policy/Offer versus match de spec code/conceito;
- validações, issue catalog e preview;
- RPC/output de promoção;
- regras para criar Product/Spec versus apenas associar Product Spec.

`pricing_source_type=ai_extraction` é tecnicamente genérico, mas o nome, audit allowlist e outputs de
`pricing_import_*` são específicos de Pricing. Forçar Specs nessa estrutura geraria colunas nulas e
outputs sem FK. Para o MVP, usar a mesma infraestrutura lógica/serviços, mas decidir entre:

1. um cabeçalho documental genérico compartilhado com subpipelines Pricing/Specs; ou
2. batches tipados separados que compartilham contratos de aplicação.

Não reutilizar `specs_import_staging` como pipeline produtivo. Normalized payloads precisam de
schemas separados. Novos conceitos/Specs não devem ser criados automaticamente; diferenças vão para
aprovação de domínio.

## 18. Product matching

Não existe matcher de carta comercial. O que há:

- unique index case-sensitive em Product por brand/model/version/modelYear/productionYear;
- normalização de texto no core administrativo para create/edit;
- `pg_trgm`/`unaccent` disponíveis;
- função legada `normalize_text` insegura para adoção direta;
- `product_fipe_map` com lifecycle de match, mas 0 rows e semântica específica de FIPE;
- nenhum alias/dicionário de nomenclatura de montadora.

Recomendação: deterministic exact match sobre chave normalizada primeiro; depois candidatos
token/trigram com score explicável; IA apenas sugere; operador confirma. Persistir source label,
candidatos/versão do algoritmo, match aprovado e correções. Não usar confidence do modelo como
probabilidade calibrada sem medição.

## 19. Inconsistências entre documentação, banco e código

1. `PRICE_AND_POLICY_TARGET_SCHEMA.md` ainda afirma que batch não aceita `manual`; a constraint foi
   removida na Sprint 9A e o uso atual é todo manual.
2. `AI_IMPORTS.md` diz que modelo/local do staging estão pendentes. O staging de Pricing já existe;
   o que continua pendente é o pipeline operacional e o staging de Specs adequado.
3. documentos históricos citam 320 Specs/37.251 associações. O Staging atual, após preparação
   controlada das Sprints 9H, tem 190/306 e somente 2 Products cobertos.
4. seções antigas dos ADRs/target schema ainda dizem que objetos foram validados só localmente ou
   permanecem pendentes; o Staging possui migrations até 9H.3.
5. à época desta auditoria, a migration local
   `20260801201504_sprint_9h3_policy_rebate_invoice_discount.sql` aparecia no remoto com versão
   `20260801202216` e mesmo nome lógico. O conteúdo equivalente não foi provado nesta auditoria
   histórica e a provenance permaneceu pendente naquele momento.
6. ROADMAP e CHANGELOG estão coerentes ao marcar Sprint 10/IA como próxima etapa, ainda não entregue.

Este relatório não altera os documentos históricos.

## 20. Matriz de reutilização

| Componente | Existe? | Reutilizar? | Alterar/substituir | Risco | Decisão |
| --- | --- | --- | --- | --- | --- |
| `pricing_import_batches` | sim/ativo | sim | evoluir attempts/lifecycle | médio | aprovar lifecycle/idempotência |
| `pricing_import_rows` | sim/ativo | sim | contrato uma row/MMV + review CAS | médio | gate |
| `pricing_import_row_reviews` | sim/vazio | sim | RPC e vocabulário/snapshot | médio | gate |
| `pricing_import_row_outputs` | sim/ativo | sim parcial | Offer + membership | alto | gate obrigatório |
| `pricing_audit_events` | sim/ativo | sim | allowlists/attempts se necessário | baixo/médio | preservar append-only |
| `price_offer_imports` | sim/vazio | não no novo fluxo | preservar legado | médio | remover só após investigação externa |
| `price_offer_import_rows` | sim/vazio | não no novo fluxo | preservar legado | médio | idem |
| `price_offers_staging` | sim/vazio | não | legado | alto se reutilizado | preservar por enquanto |
| `specs_import_staging` | sim/vazio | não como pipeline | substituir por desenho 10B | alto | gate 10B |
| Storage | não | criar depois | bucket privado/policies/retention | alto | gate |
| Upload | não | criar depois | signed/authorized + validation | alto | gate |
| OpenAI client | não | criar abstraction | provider adapter server-only | alto | gate provider/model |
| PDF extraction | não | criar | deterministic + OCR fallback | alto | gate estratégia |
| Review UI | não | criar | shell por MMV + projection segura | médio | gate row/MMV |
| Review RPC | não | criar | CAS + append-only review/audit | alto | necessário |
| Promotion RPC | não | criar | atômica por MMV e idempotente | alto | necessário |
| `create_commercial_period_draft` | sim/ativo | regras/helpers | não chamar as-is para AI | alto | decidir price/Offer |
| Price publication | sim/ativo | sim | permanecer individual | baixo | já aprovado |
| Policy/Offer publication | sim/ativo | sim | permanecer individual | baixo | já aprovado |
| Product matching | parcial | core/conceitos | criar matcher/audit/aliases | médio | gate algoritmo/threshold |
| fluxo manual de Specs | sim | leitura/validação | import precisa RPC atômica | alto | gate 10B |

## 21. Lacunas e riscos priorizados

### Bloqueadores

1. decisão de row por MMV e contrato versionado;
2. output relacional de Offer/membership;
3. incompatibilidade entre nova MSRP draft e Offer que exige MSRP published;
4. ausência de RPC de review e promoção com locks/idempotência;
5. ausência de Storage privado, upload policy e retention;
6. ausência de worker/attempt/retry;
7. provider/model e política de dados não aprovados;
8. estratégia PDF/text/OCR e evidence não aprovada.

### Altos

- ACL/RLS amplos nas tabelas legadas e de Specs;
- documento malicioso/prompt injection/malware/decompression bomb;
- duplicação de Policies/Offers em retry concorrente;
- audit de falha perdido por rollback se não houver attempt externo;
- raw payload/text exposto por uma futura API genérica;
- reprocessamento sobrescrever evidência sem tabela de attempts;
- importar período especial/rollover sem mostrar impactos e expected locks.

### Médios

- schema JSONB informal e issue codes livres;
- falta de alias/dicionário para Product;
- confiança não calibrada;
- drift de migration local/remota;
- documentação histórica com contagens antigas;
- `product_specs.product_id` sem FK observada;
- métricas e custos ausentes.

## 22. Gates de decisão

Antes de implementar, aprovar explicitamente:

1. **Unidade:** uma `pricing_import_row` por MMV, mesmo que apareça em várias páginas.
2. **Payload:** envelope `commercial-letter/mmv-preview/1`, escala de confidence e issue catalog.
3. **Outputs:** adicionar Offer e membership com FKs tipadas.
4. **Lifecycle:** estados novos versus projeção derivada; significado de ignored/failed/partial.
5. **Preço e Offer:** duas etapas retomáveis ou Offer draft autorizada sobre price draft.
6. **Preço existente:** reuse exato versus conflito; nunca upsert silencioso.
7. **Atomicidade:** uma transação por MMV e limites de locks/rows.
8. **Storage:** bucket, path, MIME/size, signed upload, retention, delete e malware scan.
9. **Runtime:** executor assíncrono, claim/lease, timeout, retry e dead-letter.
10. **OpenAI:** provider/model, dados, região, retention, structured output, budget e fallback.
11. **PDF:** texto, PDF original, vision/OCR e qualidade mínima.
12. **Matching:** algoritmo, candidatos, thresholds e confirmação humana.
13. **Legado:** coexistência e hardening sem remoção nesta Sprint.
14. **Specs:** cabeçalho documental compartilhado ou batch separado; schemas sempre separados.
15. **Observabilidade:** dados permitidos em logs e custo/usage source of truth.

## 23. Arquitetura mínima recomendada para Sprint 10

```text
Admin Next.js
  → autoriza admin e solicita upload
  → Storage privado (arquivo imutável, hash e MIME validados)
  → abre `pricing_import_batch` idempotente
  → despacha job

Worker server-side
  → claim/attempt idempotente
  → extração determinística PDF/page map
  → OCR/vision somente se necessário
  → `DocumentExtractor` provider adapter
  → Structured Output versionado
  → validação de schema + normalização determinística
  → matching de Product com candidatos
  → persiste uma row por MMV em needs_review

Review UI
  → projection sanitizada por batch/row
  → patches via RPC com expected_lock_version
  → review append-only + audit

Promotion RPC por MMV
  → lock + idempotency + validação oficial
  → price/Policies/Offers draft conforme gate aprovado
  → memberships + outputs tipados + audit
  → row promoted

Lifecycle oficial existente
  → publicação individual posterior de Price, Policy e Offer
```

Fronteiras de código recomendadas:

- `contracts`: DTOs versionados de upload, preview, review e status; sem nomes físicos;
- `core`: schema/domain validation, matching policy, readiness e use cases; sem Supabase/OpenAI;
- `adapter-supabase`: Storage, projections, review/promotion repositories/RPCs;
- adapter de provider server-only atrás de `DocumentExtractor`;
- `apps/web`: auth, actions, upload/review UI e orchestration curta;
- worker: execução assíncrona, sem regras econômicas duplicadas;
- PostgreSQL: atomicidade, locks, idempotência final, lifecycle e audit.

## 24. Roadmap proposto

### 10A.1 — decisões e contratos

- aprovar gates 1–15;
- fechar JSON Schema/DTO v1, issue catalog e state projections;
- definir limites, retention, threat model e métricas;
- reconciliar versão da migration 9H.3.

### 10A.2 — foundation segura

- migration versionada para outputs/attempts/lifecycle aprovado;
- bucket privado e policies versionadas;
- RPC idempotente de abrir batch e projection sanitizada;
- testes pgTAP de RLS, grants, search path e terminal states.

### 10A.3 — ingestão assíncrona

- signed/authorized upload;
- hash/signature/MIME/size validation;
- dispatcher, claim/lease, retries e error taxonomy;
- PDF deterministic extraction e OCR fallback aprovado;
- provider adapter + mock + structured output versionado;
- métricas de usage/cost sem payload sensível.

### 10A.4 — preview e review por MMV

- matcher determinístico + candidates;
- uma row por MMV;
- UI lateral e painel editável;
- review RPC com CAS, snapshots e audit;
- testes de concorrência e prompt-injection fixtures.

### 10A.5 — promoção

- promotion RPC por MMV;
- reuse/conflict de MSRP conforme decisão;
- Prices/Policies/Offers/memberships/outputs com rollback integral;
- publication individual preservada;
- idempotency/retry/concurrency pgTAP e integração.

### 10A.6 — homologação

- corpus de cartas reais sanitizado e aprovado;
- medir extraction/match/correction/cost/latency;
- validar retenção, acesso, logs e recuperação;
- decidir rollout e limites com base nas métricas.

### 10B — fichas técnicas

- manter separada até estabilizar a foundation;
- schema de ficha e diff por Product/Spec;
- RPC de promoção atômica específica;
- aprovação explícita para novos Products/Specs;
- não reutilizar `specs_import_staging` como atalho.

## 25. Conclusão

O projeto não precisa de um segundo sistema de batch para cartas comerciais. A base
`pricing_import_*`, as proteções da Sprint 9 e as RPCs oficiais são ativos reais e devem ser
evoluídos. O trabalho principal da Sprint 10 é construir as fronteiras ausentes — arquivo,
extração, contrato, review, outputs completos e promoção — sem transformar a IA em autoridade de
negócio.

A implementação não deve começar antes de resolver o gate Price/Offer, pois ele define se a
promoção pode ser verdadeiramente atômica por MMV sem violar publicação individual. Fichas técnicas
podem compartilhar a infraestrutura de documentos e operação, mas precisam de schema, outputs e
promoção próprios.

## 26. Confirmações da auditoria

- Staging consultado: somente `shfsjyjxmgwnlexmdkcs`, somente leitura.
- Produção: não consultada e não alterada.
- Staging: não alterado.
- Migrations: nenhuma criada ou aplicada.
- Buckets/Edge Functions/jobs: nenhum criado.
- Pacotes/chaves/OpenAI: nada instalado ou configurado; nenhuma chamada realizada.
- Código/SQL/Legacy: não alterados.
- Commit/push: não realizados.
