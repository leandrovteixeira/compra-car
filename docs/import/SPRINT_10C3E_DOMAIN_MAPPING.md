# Sprint 10C.3E — Domain Mapping

> Integração runtime 10C.4D: o Domain Mapping continua exigindo um
> `CommercialDocumentDomainMappingPeriod` explícito e válido. A resolução ocorre fora do mapper,
> imediatamente antes de sua chamada: competência operacional server-owned é aceita apenas quando
> compatível com os candidatos documentais; sem ela, somente competência ou validade documental
> explícita preservada por extraction → merge → semantic reconciliation pode formar o período.
> Ambiguidade, conflito ou ausência não são preenchidos por fallback nem por datas fabricadas.

Status: **primitive pura implementada; runtime segmentado permanece inativo**

Data: 2026-08-20

Contratos: `SemanticallyReconciledCommercialDocument/1` →
`CommercialDocumentDomainMappingResult/1` → `commercial-letter/mmv-payload/1`

## Objetivo e decisão

A etapa transforma conhecimento documental já reconciliado em rows comerciais canônicas. Ela não
é extractor, reconciler ou matcher: não interpreta linguagem natural, não procura Product, não usa
fuzzy matching, banco, provider, embedding ou IA e não escolhe valores conflitantes.

Foi criado o wrapper interno `CommercialDocumentDomainMappingResult/1`. O wrapper agrega coverage,
recipients/rules não materializados, provenance e issues que abrangem mais de uma row. Não duplica o
schema comercial: cada elemento de `rows` é o contrato existente
`commercial-letter/mmv-payload/1`. Essa separação é necessária porque o contrato por MMV não
representa recipients descartados nem coverage global.

## Input

`MapCommercialDocumentToDomainInput` contém:

- `semanticDocument`: `SemanticallyReconciledCommercialDocument/1`, fonte de verdade para rules,
  recipients, aplicabilidade, exclusions, conflicts e composition;
- `sources`: associação server-owned entre `documentId`, ordinal e nome original; filename é
  provenance operacional e nunca fonte semântica;
- `commercialPeriod`: competência, kind, início e fim explicitamente informados. O mapper não cria
  datas quando o documento reconciliado não as fornece; esse contexto explícito completa campos
  obrigatórios do contrato canônico.

Para tornar a fronteira autossuficiente sem retorno à foundation, a 10C.3D passou a preservar no
resultado semântico o snapshot da identidade documental, metadata do fact, composition reconciliada
e localizadores document/page/block já existentes na provenance. Nenhum dado novo é inferido.

## Output e row materialization

Cada recipient `VEHICLE` com brand, model e version materializa exatamente uma row. `productionYear`
e `modelYear` permanecem independentes e podem ser `null`, conforme o contrato atual. Identidade sem
campo obrigatório gera `MMV_FIELD_MISSING`, deixa o recipient em `unresolvedRecipientIds` e não cria
uma row parcial ou inventada.

As rows são ordenadas por brand/model/version/PY/MY e renumeradas após a ordenação. Product match,
fingerprints, IDs persistidos e decisões de promoção não são calculados: os campos obrigatórios
server-owned permanecem em estado neutro/bloqueado exigido pelo contrato canônico.

## Tabela Fact → domínio

O objeto exportado `COMMERCIAL_DOCUMENT_FACT_DOMAIN_MAPPING` é a tabela explícita e testável:

| Fact documental | Destino canônico |
|---|---|
| `public_price` | MSRP/publicPrice |
| `promotional_price` | não vira MSRP; review por representação indisponível |
| `bonus` | Policy `retail_bonus` |
| `discount` | Policy `invoice_discount` |
| `trade_in` | Policy `trade_in_bonus` |
| `financing_rate` | Policy `subsidized_financing.customerInterestRateMonthly` |
| `financing_down_payment` | Policy `subsidized_financing.downPaymentPercentage` |
| `financing_installments` | Policy `subsidized_financing.termMonths` |
| `grace_period` | review; parâmetro canônico ausente |
| `registration_bonus` | Policy `free_registration` |
| `wallbox` | Policy `free_wallbox` |
| `charging` | Policy `fuel_or_recharge_voucher` |
| `insurance` | Policy `free_insurance` |
| `maintenance` | Policy `free_maintenance` |
| `accessory` | Policy `other` |
| `eligibility`, `restriction`, `channel_rule` | restrictions/applicability de Policy e Offer |
| `other` | review; sem classificação segura |

Mapping que exige shape incompatível (por exemplo, bônus sem money ou taxa sem percentage) falha de
forma explícita; o mapper não converte texto ou outra dimensão econômica por heurística.

## MSRP

Somente `public_price` monetário em BRL pode preencher `publicPrice.candidate`. Valores promocionais,
bônus, descontos, entrada e parcelas nunca são promovidos a MSRP. Valores MSRP idênticos são
coalescidos; múltiplos valores distintos ou conflictantes deixam `presence=ambiguous`, não usam
last-write-wins e geram `MSRP_AMBIGUOUS`/`MSRP_CONFLICT`.

## Policies e IDs locais

Policies são materializadas antes das Offers. A chave de dedupe inclui fact type/value, canais,
eligibility, restrictions, validity e contexto aplicável. Policies semanticamente diferentes não são
fundidas. A mesma regra compartilhada é reutilizada dentro da row; como o contrato mantém Policies
locais à row, IDs são `policy_0001...`, determinísticos, estáveis e locais.

Depois da ordenação e atribuição dos IDs, um índice rule→Policy resolve todas as referências. Uma
regra não materializável em composition gera `OFFER_COVERAGE_GAP`; não existe placeholder, correção
fuzzy ou remoção silenciosa. O integrity check rejeita qualquer referência fora do índice.

## Offer composition

Composition é consumida, não recalculada:

- `CUMULATIVE`: une member rules e shared rules na mesma Offer;
- `ALTERNATIVE`: cria uma Offer por branch e inclui shared rules em todas;
- grupos aninhados são expandidos recursivamente; `(A E B) OU (C E D)` produz duas Offers;
- rules com Policy e sem grupo explícito produzem Offer `standalone`;
- exclusions e general rules já chegam pelo `recipientApplicability` reconciliado.

## Channels, validity e restrictions

Channels do input permanecem materialmente distintos como restrictions `channel:<valor>`; a engine
não cria taxonomia nova. Eligibility e restrictions documentais também são preservadas. Quando a
distinção não cabe no contrato, é gerado review em vez de perda silenciosa.

Validity específica de rule preenche Policy/MSRP; na ausência, usa o período operacional explícito
do input. Períodos disjuntos permanecem em Policies distintas. Conflicts sobrepostos sem precedência
continuam bloqueantes; nenhuma regra de “mais recente” existe.

## Evidence, provenance e confidence

Provenance reconciliada fornece document/page/block. Evidence canônica só é emitida quando há também
excerpt documental; nada é inventado. O wrapper preserva a provenance completa quando o schema por
row não a comporta. Ausência de localizador necessário impede a row e gera
`OUTPUT_PROVENANCE_UNSUPPORTED`.

Scores factuais são convertidos deterministicamente para 0–100. O band usa exclusivamente
`deriveConfidenceBand`, já server-owned. Conflicts, gaps ou issues limitam a row a low; coverage
parcial sem issue local impede high. O mapper não aceita band do provider como autoridade.

## Issues e coverage

Os códigos reutilizam o vocabulário canônico sempre que possível. O wrapper informa recipient/rule
afetados e separa:

- recipients esperados versus materializados;
- rules esperadas versus representadas em MSRP, Policy ou applicability;
- composition groups esperados versus materializados;
- issues, rules e recipients não resolvidos.

Coverage não é sinônimo de quantidade de rows. Qualquer item não resolvido muda o status para
`review_required`; recipient não materializado muda para `blocked`.

## Determinismo, imutabilidade e complexidade

Não há clock, random, UUID, locale do host, promise ordering, fuzzy matching ou chamada externa.
Rows, Policies, Offers, refs, issues, evidence, provenance e detalhes de coverage têm ordenação
explícita. Testes cobrem permutation invariance, byte equivalence e input deep-frozen.

Índices por rule, recipient, group, source e Policy evitam varredura global rule×recipient×scope. O
custo é aproximadamente `O(A + P log P + B)`, onde `A` é a aplicabilidade já materializada, `P` as
Policies por row e `B` as branches de composition efetivamente aplicáveis. A fixture Fiat-like de
100 identities permanece uma sanity check local, não benchmark de produção.

## Boundaries

O mapper vive em `packages/core/src/import/` e é exposto apenas por subpath explícito. Ele não entra
no barrel raiz, não importa Ajv, OpenAI, Supabase, Storage ou adapter e não alcança o grafo Edge. A
validação Ajv canônica continua pelo subpath server-only já existente e é exercitada nos testes.

Não foram alterados `processAdminImportBatch`, registry, provider `openai/4`, Prompt v4, Server
Actions, RPCs, migrations, matching, persistence ou promotion workflows. O pipeline one-shot ativo
permanece intacto.

## Testes e limitações

Fixtures sintéticas cobrem Geely-like 4, GWM-like 13, Volvo-like 20, Fiat-like 100, channels,
eligibility, exclusions herdadas da 10C.3D, MSRP, Policies financeiras, IDs, zero orphan, E/OU
aninhado, conflicts, evidence/provenance, determinismo, imutabilidade e validação do JSON Schema
canônico.

Limitações deliberadas:

- `promotional_price`, `grace_period` e `other` não possuem representação canônica inequívoca e
  geram review;
- nome original e período operacional são contexto server-owned obrigatório;
- o wrapper é interno e ainda não possui persistência/retention;
- nenhum benchmark real ou documento de fabricante foi executado.

O rollout foi replanejado: 10C.4A define lifecycle/artifacts; 10C.4B orquestração; 10C.4C dry run;
10C.4D mede precision, recall, coverage, custo e latência antes de qualquer ativação ampla.

**RUNTIME SEGMENTED DOMAIN MAPPING ACTIVE? NO.**
