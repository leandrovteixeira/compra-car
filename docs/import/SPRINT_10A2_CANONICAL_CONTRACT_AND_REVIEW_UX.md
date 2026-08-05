# Sprint 10A.2 — Contrato canônico e UX da prévia de importação por MMV

Status: especificação técnica documental. Nenhuma funcionalidade, migration ou alteração de banco é
parte desta entrega.

## 1. Escopo e decisões normativas

Os termos **DEVE**, **NÃO DEVE**, **PODE** e **REVIEW** são normativos.

Esta especificação transforma a interpretação documentada em
[`SPRINT10_IMPORT_GUIDE.md`](./SPRINT10_IMPORT_GUIDE.md) em um contrato implementável. Ela mantém o
domínio comercial da Sprint 9 como autoridade final e incorpora as conclusões da
[`SPRINT_10A_IMPORT_PIPELINE_AUDIT.md`](./SPRINT_10A_IMPORT_PIPELINE_AUDIT.md).

Decisões fechadas preservadas:

1. uma `pricing_import_row` representa exatamente um MMV encontrado na carta;
2. a prévia normalizada é um JSONB versionado e editável;
3. IA, parser ou worker nunca escrevem nas tabelas comerciais finais;
4. evidência é embutida nos campos normalizados, não uma entidade persistida separada;
5. revisão, confirmação e promoção ocorrem por MMV;
6. somente o que consta do bloco completo aplicável ao MMV pode virar candidato;
7. relações `E` e `OU` viram composições explícitas, sem expansão inferida;
8. a promoção usa regras e workflows oficiais e cria somente rascunhos;
9. preço, Policy e Offer continuam com publicação individual;
10. nenhum efeito comercial ocorre sem confirmação humana explícita.

Fora do escopo: OCR, escolha de modelo de IA, prompt, upload, Storage, crawler, Edge Function,
fichas técnicas e implementação dos contratos aqui propostos.

## 2. Fontes e auditoria realizada

Foram lidos o guia canônico, a auditoria da Sprint 10A, `AI_CONTEXT.md`, `ROADMAP_MASTER.md`,
`CHANGELOG.md`, as documentações 9B, 9C, 9D, 9G, 9H, Price Management, Pricing Audit e os ADRs 011
e 012. Também foram auditados os use cases, entidades, repositórios, adapters Supabase e migrations
atuais de preço público, Policy, Offer, memberships, importação, lifecycle, auditoria, publicação,
rollover e Product matching.

### 2.1 Verificação read-only do Staging

Antes da consulta foi confirmado explicitamente o único alvo autorizado:

- projeto: **Compra Car Staging**;
- project ref: **`shfsjyjxmgwnlexmdkcs`**.

Foram executadas somente consultas `SELECT` de catálogo. O projeto respondeu como
`ACTIVE_HEALTHY`, PostgreSQL 17, e confirmou:

- RLS habilitada em `pricing_import_batches`, `pricing_import_rows`,
  `pricing_import_row_reviews` e `pricing_import_row_outputs`;
- batch statuses atuais: `uploaded`, `extracting`, `needs_review`, `ready`, `promoting`,
  `promoted`, `failed`, `rejected`, `archived`;
- row statuses atuais: `parsed`, `unmatched`, `needs_review`, `approved`, `rejected`, `promoted`;
- review decisions atuais: `approve`, `reject`, `request_changes`, `match_product`, `classify`;
- `confidence_score` limitado a `0..100` e `issue_codes` como `text[]`;
- `normalized_payload` e snapshots de review em JSONB;
- output atual apontando exatamente para um `public_price_id`, `policy_id` ou `accumulator_id`;
- ausência de output para Offer;
- Policies de fonte não manual exigindo `source_import_row_id`;
- preços de fonte não manual exigindo `source_import_row_id`;
- Offer com proveniência por `source_system`/`source_reference`, mas sem FK direta para a row;
- workflows oficiais protegidos por ator administrativo, correlation ID, optimistic lock, auditoria
  e `search_path = ''`.

Produção não foi consultada nem tocada.

## 3. Unidade canônica: um MMV

Uma row contém um único recorte comercial indivisível:

```text
carta + bloco aplicável + marca + modelo + versão + ano/modelo + ano/fabricação
                                   ↓
                              uma import row
                                   ↓
             Product sugerido + período + MSRP + Policies + Offers
```

MMVs diferentes nunca compartilham a mesma row, mesmo que preço, campanha ou página sejam iguais.
O mesmo MMV em canais ou períodos incompatíveis também deve ser separado, pois uma única promoção
precisa ter escopo temporal e comercial inequívoco.

O identificador físico continua sendo `pricing_import_rows.id`. `source_row_number` é ordinal dentro
do batch e deve ser estável em reprocessamentos idempotentes do mesmo documento.

## 4. Contrato JSON canônico v1

O contrato normativo está em
[`commercial-letter-mmv-payload-v1.schema.json`](./schemas/commercial-letter-mmv-payload-v1.schema.json).
O valor de `schemaVersion` é imutável: `commercial-letter/mmv-payload/1`.

### 4.1 Princípios de serialização

- Datas usam `YYYY-MM-DD`; competência usa `YYYY-MM`.
- Dinheiro usa string decimal canônica com duas casas e `currency: BRL`. Nunca usar `number` para
  dinheiro.
- Percentuais preservam a unidade: `percent` para `60` = 60%; `decimal_rate` para `0.04` = 4%.
- IDs persistidos são inteiros positivos. IDs locais usam `clientPolicyId` e `clientOfferId`.
- Campos desconhecidos são rejeitados por `additionalProperties: false`.
- Arrays de Policies e Offers aceitam no máximo 100 itens, alinhados aos lotes atuais.
- `registration` é legado e não é aceito como novo tipo; usar `free_registration`.
- `null` significa “não localizado/não aplicável”; nunca significa zero, string vazia ou inferência.
- Valores corrigidos pelo operador preservam `origin: operator`; valores derivados por regra
  determinística usam `origin: system`.

### 4.2 Seções da raiz

| Seção | Responsabilidade |
|---|---|
| `source` | arquivo, ordinal, páginas e blocos que delimitam o recorte completo |
| `mmv` | identidade encontrada na carta, sem substituir o Product persistido |
| `productMatch` | candidatos, seleção e confirmação do Product |
| `commercialPeriod` | competência, tipo mensal/especial e janela em São Paulo |
| `publicPrice` | presença e candidato de MSRP; preço promocional não ocupa este campo |
| `policies` | benefícios atômicos mencionados no bloco |
| `offers` | composições explícitas de Policies por `E`/`OU` |
| `promotionPlan` | resolução de dependências, rollovers e fase de promoção |
| `issues` | catálogo instanciado de conflitos e lacunas |
| `overallConfidence` | menor confiança relevante para a interpretação econômica da row |
| `validation` | projeção determinística calculada pelo servidor |

`validation`, `promotionPlan`, `productMatch.expectedProductFingerprint`, candidatos de Product,
locks e resoluções de registros existentes são enriquecimento do servidor. O extrator não é
autoridade para esses campos.

### 4.3 Presença versus ausência

`publicPrice.presence` distingue:

- `mentioned`: MSRP inequívoco no bloco;
- `not_mentioned`: bloco completo lido e sem MSRP;
- `ambiguous`: há valor candidato, mas não é seguro classificá-lo como MSRP.

Uma ausência não gera entidade. Array vazio de Policies ou Offers significa “nenhuma entidade desse
tipo foi mencionada no bloco completo”; não autoriza criar defaults, completar uma matriz ou herdar
campanhas de outro MMV. Policies já vigentes no domínio podem continuar vigentes sem que uma nova
Policy seja criada.

`source.fullApplicableBlockRead = false` sempre cria `SOURCE_BLOCK_INCOMPLETE` bloqueante. A
ausência só é semanticamente confiável depois da leitura do bloco, páginas de regras herdadas e
erratas aplicáveis.

### 4.4 Identidade local e referências

`clientPolicyId` e `clientOfferId` são estáveis durante edição. Offer referencia somente
`policyClientIds` da própria row. Não referencia posição de array, título ou tipo.

Regras:

- todo `policyClientId` deve ser único;
- todo `clientOfferId` deve ser único;
- uma Offer contém ao menos uma Policy;
- a mesma Policy não aparece duas vezes na mesma Offer;
- composições com o mesmo conjunto de Policies são duplicadas e bloqueadas;
- uma Offer não pode referenciar Policy `unsupported`, excluída ou bloqueada;
- todos os componentes devem pertencer ao Product confirmado e cobrir a vigência integral.

### 4.5 Exemplo

[`commercial-letter-mmv-example-v1.json`](./examples/commercial-letter-mmv-example-v1.json) mostra uma
extração ainda bloqueada. O exemplo usa o Golden Example GE-02: MSRP provável de R$ 205.800,
preço promocional de R$ 195.800 e candidato a `invoice_discount` de R$ 10.000.

[`commercial-letter-mmv-review-example-v1.json`](./examples/commercial-letter-mmv-review-example-v1.json)
mostra o comando de aprovação com Product e interpretação confirmados. IDs são ilustrativos e não
afirmam a existência desses registros em qualquer ambiente.

## 5. Evidência por campo

Todo valor normalizado é acompanhado de `meta`:

```json
{
  "value": "EX5",
  "meta": {
    "origin": "source",
    "confidence": {
      "score": 99,
      "band": "high",
      "rationale": "Modelo explícito no título do quadro."
    },
    "evidence": [
      {
        "documentPage": 4,
        "excerpt": "Geely EX5",
        "blockKey": "geely-ex5-pro-junho-2026"
      }
    ]
  }
}
```

### 5.1 Regras de evidência

1. evidência é anexa ao campo, mesmo quando o mesmo trecho sustenta vários campos;
2. `documentPage` é a página humana, iniciada em 1;
3. `excerpt` deve ser curto, fiel e suficiente para localizar a decisão;
4. `blockKey` identifica o bloco lógico dentro da row, não uma nova entidade persistida;
5. `region` é opcional e usa coordenadas no sistema original da página; não é requisito do MVP;
6. evidência de rodapé, regra geral ou errata usa a página real onde aparece;
7. valor de origem `source` sem evidência gera `EVIDENCE_MISSING`;
8. campo de origem `operator` registra a razão na confidence e mantém evidência documental quando a
   correção interpreta a carta;
9. campo de origem `system` referencia a evidência de entrada sempre que for derivação comercial;
10. evidências contraditórias não são eliminadas: ambas permanecem e geram `EVIDENCE_CONFLICT`.

O snapshot integral de cada revisão preserva as evidências antigas. A edição nunca reescreve um
snapshot de review existente.

## 6. Confidence

Confidence mede confiança na interpretação, não probabilidade de promoção nem qualidade visual.

| Score | Band | Semântica |
|---:|---|---|
| 90–100 | `high` | valor e escopo explícitos, com contexto completo e sem contradição |
| 70–89 | `medium` | leitura provável, mas há decomposição, herança ou confirmação necessária |
| 0–69 | `low` | campo ausente, contraditório, implícito ou não suportado |

O servidor deve rejeitar incoerência entre score e band. `overallConfidence` é o menor score dos
campos críticos efetivamente usados: Product, período, MSRP quando usado, tipo/valor/parâmetros de
cada Policy e composição de cada Offer.

Confidence nunca aprova automaticamente uma row. Mesmo com 100, a promoção exige revisão,
aprovação e confirmação humana. Score baixo gera `CONFIDENCE_LOW`; esse issue é bloqueante quando o
campo participa da promoção e apenas informativo quando o candidato foi explicitamente excluído.

## 7. Issue codes

Um issue tem `issueId`, `code`, severidade, flag `blocking`, JSON Pointer em `path`, mensagem,
evidências, status e resolução. `issue_codes` físico é uma projeção única dos codes abertos no JSONB;
o JSONB é a fonte do detalhe.

### 7.1 Fonte e evidência

| Code | Padrão | Bloqueia quando |
|---|---|---|
| `SOURCE_BLOCK_INCOMPLETE` | páginas/regras não foram lidas | sempre |
| `SOURCE_PRECEDENCE_UNRESOLVED` | errata ou carta conflitante | sempre |
| `EVIDENCE_MISSING` | campo de fonte sem trecho | campo será promovido |
| `EVIDENCE_CONFLICT` | trechos incompatíveis | sempre |
| `CONFIDENCE_LOW` | score abaixo de 70 | campo será promovido |

### 7.2 MMV, Product e período

| Code | Uso |
|---|---|
| `MMV_FIELD_MISSING` | marca, modelo ou versão ausente |
| `MMV_YEAR_AMBIGUOUS` | ano/modelo e fabricação não distinguíveis |
| `PRODUCT_UNMATCHED` | nenhum Product plausível |
| `PRODUCT_MATCH_AMBIGUOUS` | mais de um Product plausível |
| `PRODUCT_MATCH_STALE` | Product/fingerprint mudou após revisão |
| `PERIOD_MISSING` | vigência comercial não resolvida |
| `PERIOD_INVALID` | data final anterior à inicial ou data inválida |
| `PERIOD_OUTSIDE_COMPETENCE` | especial fora da competência |
| `OPEN_ENDED_PERIOD_UNRESOLVED` | “até nova carta” sem sucessora conhecida |

### 7.3 Preço

| Code | Uso |
|---|---|
| `MSRP_AMBIGUOUS` | “de/por”, PPS e preço venda não foram distinguidos |
| `MSRP_INVALID` | moeda, valor ou janela inválidos |
| `MSRP_CONFLICT` | existe preço na mesma chave com conteúdo diferente |
| `MSRP_LOCK_STALE` | preço/predecessor mudou |
| `MSRP_PUBLICATION_REQUIRED_FOR_OFFER` | nova Offer aguarda publicação individual do MSRP |

### 7.4 Policies e rebate

| Code | Uso |
|---|---|
| `POLICY_TYPE_UNSUPPORTED` | benefício não cabe no enum atual |
| `POLICY_VALUE_MISSING` | benefício monetizado sem valor |
| `POLICY_PARAMETERS_INCOMPLETE` | taxa, seguro, IPVA, manutenção etc. incompletos |
| `POLICY_PERIOD_CONFLICT` | Policy não cobre a janela pretendida |
| `POLICY_PREDECESSOR_AMBIGUOUS` | mais de uma predecessora sobreposta |
| `POLICY_PREDECESSOR_LOCK_STALE` | predecessor ou lock mudou |
| `REBATE_UNATTRIBUTED` | rebate não ligado a uma Policy elegível |
| `REBATE_EXCEEDS_BENEFIT` | rebate maior que benefício ao cliente |

### 7.5 Offers, promoção e revisão

| Code | Uso |
|---|---|
| `OFFER_RELATION_AMBIGUOUS` | `E/OU` não resolvido |
| `OFFER_EMPTY` | composição vazia |
| `OFFER_REFERENCES_UNKNOWN_POLICY` | referência local inexistente |
| `OFFER_DUPLICATE_COMPOSITION` | mesmo conjunto de Policies repetido |
| `OFFER_COVERAGE_GAP` | preço ou Policy não cobre toda a Offer |
| `OFFER_CHANNEL_UNSUPPORTED` | elegibilidade de canal não representável |
| `OFFER_RESTRICTION_UNSUPPORTED` | cota, cor, região ou regra não representável |
| `OFFER_PREDECESSOR_AMBIGUOUS` | Offers afetadas não puderam ser determinadas |
| `OFFER_PREDECESSOR_LOCK_STALE` | Offer afetada mudou |
| `RETROACTIVE_PUBLISHED_OFFER_ROLLOVER` | mensal retroativo de Offer publicada em São Paulo |
| `OUTPUT_PROVENANCE_UNSUPPORTED` | output atual não representa uma Offer criada |
| `PROMOTION_CONFLICT` | conflito transacional/idempotente não classificado acima |
| `OPERATOR_EXCLUSION_REQUIRES_REASON` | exclusão sem justificativa |
| `CHANGES_REQUESTED` | operador devolveu a row para correção |

Issues `error` devem ser bloqueantes. `warning` pode ser aceito somente se a regra do code permitir;
o aceite exige justificativa e permanece auditável. `info` nunca dispensa confirmação.

## 8. Product matching

O Product persistido é identificado por `brand + model + version + model_year + production_year`.
O matching deve seguir esta ordem:

1. código externo explicitamente mapeado e não ambíguo;
2. chave de negócio exata, após normalização apenas de caixa e espaços;
3. candidatos por tokens para auxiliar o operador;
4. seleção manual.

Busca por tokens nunca confirma automaticamente. Não fazer fuzzy match silencioso, não trocar marca,
não completar versão e não assumir a ordem de “25/26”. Um candidato confirmado grava
`selectedProductId`, `selectedBy: operator` e o fingerprint dos cinco campos. A promoção recarrega o
Product e compara o fingerprint; divergência gera `PRODUCT_MATCH_STALE`.

## 9. Lifecycle de batch

O enum físico existente é suficiente para o MVP se o estado “parcial” for uma projeção, não um novo
status persistido.

| Estado físico | Entrada | Saída permitida |
|---|---|---|
| `uploaded` | arquivo e identidade persistidos | `extracting`, `rejected`, `failed` |
| `extracting` | worker possui claim idempotente | `needs_review`, `failed` |
| `needs_review` | ao menos uma row requer ação | `ready`, `promoted`, `rejected`, `archived` |
| `ready` | todas as rows não terminais estão aprovadas | `promoting`, `needs_review`, `promoted` |
| `promoting` | operação administrativa em andamento | `ready`, `needs_review`, `promoted`, `failed` |
| `promoted` | todas as rows são `promoted` ou `rejected`, com ao menos uma promovida | `archived` |
| `failed` | falha do batch, com diagnóstico | `extracting` por retry explícito, `archived` |
| `rejected` | nenhuma row será promovida | `archived` |
| `archived` | terminal de retenção | nenhum |

Projeções de UI:

- `partially_promoted`: batch físico `needs_review`/`ready` com ao menos uma row promovida e outra
  pendente;
- `awaiting_price_publication`: existe row aguardando o gate de MSRP;
- contadores são derivados por status de row e nunca gravados como fonte de verdade.

O batch não é unidade de aprovação ou promoção. Uma row promovida não espera as demais.

## 10. Lifecycle de row

### 10.1 Estados-alvo

| Estado | Significado |
|---|---|
| `parsed` | JSON v1 persistido, ainda não classificado |
| `unmatched` | Product não confirmado |
| `needs_review` | prévia editável, com ou sem issues |
| `approved` | snapshot aprovado e ainda sem efeito comercial |
| `promoting` | claim transacional curto da promoção |
| `awaiting_price_publication` | fase A criou/reutilizou MSRP, fase B aguarda publicação oficial |
| `promoted` | todos os outputs aprovados foram criados/reutilizados e registrados |
| `rejected` | operador encerrou a row sem promover |
| `failed` | falha operacional não absorvida por retry |

`promoting`, `awaiting_price_publication` e `failed` ainda não existem no enum atual e são lacuna de
schema para a implementação. Não devem ser simulados dentro de `issue_codes`.

### 10.2 Transições

```text
parsed ──► unmatched ──match_product──► needs_review
   │                                      │  ▲
   └──────────────────────────────────────┘  │ edit após aprovação
                                             │
needs_review ──approve──► approved ──confirm──► promoting
     │                         ▲                 │
     └────reject────────► rejected              ├──► promoted
                                               ├──► awaiting_price_publication
                                               └──► failed ──retry──► approved

awaiting_price_publication ──preço publicado + confirmar──► promoting ──► promoted
```

Regras:

- qualquer edição em `approved` invalida a aprovação e retorna a `needs_review`;
- `promoted` e `rejected` são imutáveis, exceto metadados de arquivamento do batch;
- uma row com output criado não volta a ser editável sem um workflow explícito de compensação;
- claim `promoting` deve ter timeout e token idempotente; timeout não implica rollback de transação
  já confirmada;
- falha transacional antes de commit não cria outputs parciais;
- conclusão remove a row da fila pendente, mas mantém row, reviews, outputs e auditoria consultáveis.

## 11. Revisão humana

### 11.1 Comando de review

O comando lógico é:

```json
{
  "schemaVersion": "commercial-letter/mmv-review/1",
  "importRowId": 9001,
  "expectedLockVersion": 3,
  "decision": "approve",
  "notes": "Confirmação do bloco completo.",
  "confirmation": {
    "confirmed": true,
    "summaryHash": "sha256:..."
  },
  "payload": {}
}
```

O ator vem da sessão autenticada e não do JSON do cliente. Correlation ID é criado/validado no
servidor. `summaryHash` liga o clique de confirmação ao resumo econômico exato exibido.

### 11.2 Decisões e auditoria

As decisões atuais `approve`, `reject`, `request_changes`, `match_product` e `classify` permanecem.
É necessário acrescentar `edit` antes da implementação; usar `classify` para qualquer alteração
esconderia a natureza da ação.

Cada ação DEVE, em uma única transação:

1. verificar admin ativo, row e `expected_lock_version`;
2. validar o JSON Schema e as invariantes cruzadas;
3. salvar novo `normalized_payload`, `confidence_score` e projeção `issue_codes`;
4. incrementar `lock_version`;
5. inserir review append-only com status anterior/próximo, decisão, nota e snapshot completo;
6. inserir auditoria com ator, correlation ID e before/after;
7. retornar a row atualizada.

`reject` e `request_changes` exigem nota. Excluir um candidato individual exige
`promotionAction: exclude_by_operator`, origem do ajuste, nota e issue resolvido; exclusão nunca
apaga o candidato nem sua evidência.

### 11.3 Gates de aprovação

Uma row só pode ser aprovada se:

- bloco completo e precedência documental resolvidos;
- Product confirmado e fingerprint atual;
- competência e janela válidas;
- nenhum issue bloqueante aberto;
- toda entidade promotível possui evidência nos campos críticos;
- toda Policy promotível usa tipo atual e parâmetros suficientes;
- rebate está atribuído, não compõe o total e não supera o benefício;
- Offers representam exatamente as relações observadas;
- locks de predecessoras e Offers afetadas foram resolvidos imediatamente antes do review;
- o resumo mostra tudo que será criado, reutilizado, encerrado ou excluído.

## 12. Promoção por MMV

### 12.1 Regra geral

A promoção é server-only, SECURITY DEFINER, `search_path = ''`, restrita a admin ativo, com row lock,
`expected_lock_version`, correlation ID, advisory lock por Product, idempotência e auditoria
append-only. O payload do cliente nunca fornece ator confiável nem valores financeiros finais.

A função de promoção futura **não deve chamar `create_commercial_period_draft` como está**. Essa RPC
cria batch/rows de origem `manual`, o que quebraria a proveniência. Ela deve reutilizar as mesmas
regras de domínio — preferencialmente extraídas para helpers SQL internos — e gravar
`source_type = ai_extraction`, `source_import_row_id` e outputs da row original.

### 12.2 Preflight repetido no commit

Mesmo depois da aprovação, a promoção recalcula:

- Product/fingerprint;
- schema version e hash do payload aprovado;
- períodos mensal/especial;
- MSRP publicado compatível;
- cálculos de Policy com money canônico e financial parameter set vigente;
- predecessoras por Product/tipo e respectivos locks;
- Offers afetadas e respectivos locks;
- coberturas temporais de todas as memberships;
- total da Offer como soma apenas de `customer_benefit_amount`;
- preço transacional como MSRP menos benefícios;
- rebate apenas como funding, fora do total;
- idempotency key e outputs já existentes.

Qualquer divergência faz rollback integral da fase e retorna a row para revisão ou retry, sem
sobrescrever dado concorrente.

### 12.3 Gate de MSRP e promoção em duas fases

O domínio atual exige MSRP **publicado** para criar Offer e para calcular algumas Policies. Como a
publicação automática é proibida, uma row com novo MSRP e Policies/Offers usa uma saga por MMV:

```text
Fase A — transação atômica
  cria o novo MSRP como draft + output
  row => awaiting_price_publication

Operador
  revisa e publica o MSRP pelo workflow oficial e individual

Fase B — nova confirmação + transação atômica
  recarrega MSRP publicado
  cria Policies draft
  executa rollovers autorizados
  cria Offers draft e memberships
  grava outputs/auditoria
  row => promoted
```

Na fase A não se encerram Policies ou Offers e não se criam Policies dependentes. Assim, a espera
pela publicação do MSRP não deixa o workspace comercial parcialmente rolado.

Se já existe exatamente um MSRP publicado que cobre toda a janela, a row usa `single_phase`. Se a
row não cria entidades dependentes de MSRP, o servidor pode usar fase única. Retry de cada fase deve
detectar o output existente e devolver o mesmo resultado, nunca duplicá-lo.

Depois de qualquer output na fase A, o payload econômico fica congelado. Cancelar ou corrigir essa
row requer compensação explícita do draft gerado; essa operação ainda não existe e é decisão
bloqueadora da Sprint 10B.

### 12.4 Preço público

- “Preço público”, “PPS” ou MSRP inequívoco vira candidato; “preço de venda”, “por” e valor líquido
  não substituem MSRP.
- Chave atual: `(product_id, starts_on)`.
- Registro inexistente: criar `draft`, BRL, `price_type = msrp`, `source_type = ai_extraction`,
  `source_import_row_id = row.id` e snapshot da fonte.
- Registro idêntico existente pode ser reutilizado somente após validação de Product, valor, janela e
  proveniência; registrar output de reutilização.
- Mesma chave com valor/janela diferente gera `MSRP_CONFLICT`; nunca atualizar silenciosamente.
- Publicação é individual e chama o workflow oficial com lock e correlation ID.
- O rollover de preço ocorre na publicação oficial; não é antecipado pela importação.

### 12.5 Policies

- Criar somente tipos atuais: `retail_bonus`, `invoice_discount`, `trade_in_bonus`,
  `loyalty_bonus`, `subsidized_financing`, `free_ipva`, `free_insurance`, `free_wallbox`,
  `free_registration`, `free_maintenance`, `fuel_or_recharge_voucher`, `other`.
- Candidato sem tipo suportado permanece no JSON, fica bloqueado e não é convertido em `other`
  automaticamente.
- `other` exige descrição e valor positivo, além de confirmação humana.
- Valores e parâmetros da fonte são inputs; `customer_benefit_amount`, principal financiado, IPVA,
  seguro e subsídio são recalculados pelo domínio atual.
- `dealer_rebate_amount` exige vínculo explícito, não soma no benefício e não pode excedê-lo.
- No máximo uma nova Policy por tipo no mesmo período comercial, como exige o fluxo mensal atual.
- Predecessora sobreposta deve ser única e trazer ID/lock esperados; termina em `D-1`.
- `D-1` nunca pode anteceder `starts_on` da predecessora.
- Nova Policy é sempre `draft`; publicação permanece individual.
- Policy não mencionada não é clonada. Uma Policy existente que continua vigente apenas permanece
  vigente.

### 12.6 Offers e `E/OU`

- `A E B` gera uma Offer `[A,B]`.
- `A OU B` gera duas Offers: `[A]` e `[B]`.
- `(A E B) OU (B E C) OU (A E C)` gera exatamente três Offers explícitas; não gerar `[A,B,C]`.
- Policies comuns devem aparecer por referência em cada Offer aplicável.
- O servidor não infere combinação ausente, produto cartesiano ou “melhor oferta”.
- Todas as Policies devem ser combináveis, do mesmo Product e cobrir toda a janela.
- MSRP publicado deve cobrir toda a janela.
- Memberships são gravadas atomicamente com a Offer.
- Nova Offer é `draft`; publicação é individual.
- Offer publicada só pode ter `valid_to` alterado pela exceção controlada do período comercial.
- Offer arquivada é imutável.
- Toda Offer afetada exige ID e lock esperados, com snapshots da Offer e memberships.
- Encerramento mensal retroativo de Offer publicada é rejeitado usando
  `America/Sao_Paulo`; período especial mantém a exceção já autorizada.

### 12.7 Idempotência e outputs

Uma chave recomendada é:

```text
ai-mmv-promotion:{batch_id}:{row_id}:{approved_payload_sha256}:{phase}
```

Outputs precisam distinguir `created` de `reused`, guardar fase e apontar para todos os agregados
promovidos. O modelo atual suporta preço, Policy e accumulator, mas não Offer. Antes da Sprint 10B é
obrigatório estender `pricing_import_row_outputs` para `commercial_offer_id` (ou adotar um modelo
tipado equivalente) e atualizar a restrição “exactly one”. Memberships podem permanecer
representadas pelo output da Offer mais snapshot ordenado de `policyIds` na auditoria; não precisam
de entidade `Evidence Unit` nem output próprio.

## 13. UX da revisão por MMV

### 13.1 Modelo de navegação

A tela tem uma fila lateral persistente e um painel de revisão. A fila é por row/MMV, nunca por
Policy. Ao concluir ou rejeitar, o item sai da visão “Pendentes”, permanece nos filtros “Concluídos”
e “Todos” e continua auditável.

Ordenação padrão:

1. bloqueados por ação humana;
2. Product não encontrado;
3. baixa confidence;
4. prontos para aprovação;
5. aguardando publicação de MSRP;
6. ordem original da carta.

Filtros: pendentes, bloqueados, prontos, aguardando MSRP, promovidos, rejeitados e todos. Busca por
marca/modelo/versão ou ordinal. Contadores vêm do servidor.

### 13.2 Wireframe desktop

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Carta: Geely Junho 2026    12 MMVs   3 bloqueados   6 pendentes   3 concluídos             │
├──────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ FILA POR MMV                 │ MMV 04/12 — Geely EX5 PRO              [Needs review]        │
│ [Pendentes] [Todos]          │ Product sugerido: [Geely EX5 PRO 25/26 ▼]  [Confirmar]       │
│ [Buscar MMV...............]  │ Competência: 06/2026  Período: 01/06–30/06                 │
│                              ├─────────────────────────────────────────────────────────────┤
│ ● 01 Dolphin GS      2 erros │ PREÇO PÚBLICO                                               │
│ ● 02 Sealion 7       1 erro  │ MSRP  R$ 205.800,00   [evidência p.4]   [editar]             │
│ ▶ 04 EX5 PRO         revisar │ “Por” R$ 195.800,00 → confirmar como desconto              │
│ ○ 05 EX5 MAX         pronto  ├─────────────────────────────────────────────────────────────┤
│ ◐ 06 EX5 EM-i       ag. MSRP │ POLICIES                                                     │
│ ✓ 07 EX2 PRO         concluído│ [Desconto NF] R$ 10.000,00  Rebate R$ 0,00 [evidência]      │
│                              ├─────────────────────────────────────────────────────────────┤
│                              │ OFFERS                                                       │
│                              │ Offer 1: [Desconto NF]  Total R$ 10.000,00                   │
│                              ├─────────────────────────────────────────────────────────────┤
│                              │ ISSUES                                                       │
│                              │ ⛔ Confirmar Product   ⛔ Confirmar interpretação De/Por      │
│                              ├─────────────────────────────────────────────────────────────┤
│                              │ [Rejeitar] [Salvar revisão]          [Revisar e aprovar →]   │
└──────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### 13.3 Wireframe de evidência

```text
┌────────────────────────────── Evidência ──────────────────────────────┐
│ Campo: MSRP                                  Página 4 de 18           │
│                                                                       │
│ [recorte da página, quando disponível]                                │
│                                                                       │
│ “Geely EX5 — De: R$ 205.800 — Por: R$ 195.800”                       │
│ Bloco: geely-ex5-pro-junho-2026                                      │
│ Confidence: 76 · medium                                               │
│                                                                       │
│ [Abrir página completa]                                      [Fechar] │
└───────────────────────────────────────────────────────────────────────┘
```

O recorte nunca substitui “Abrir página completa”, pois regras podem estar no rodapé ou em outra
página herdada.

### 13.4 Wireframe mobile

```text
┌──────────────────────────────┐
│ MMV 04/12          [Fila  ▾] │
│ Geely EX5 PRO    Needs review│
├──────────────────────────────┤
│ Product                      │
│ [Geely EX5 PRO 25/26      ▾] │
│ [Confirmar Product]          │
├──────────────────────────────┤
│ Preço público                │
│ R$ 205.800,00  [p.4] [Editar]│
├──────────────────────────────┤
│ Policies (1)                 │
│ Desconto NF · R$ 10.000 [p.4]│
├──────────────────────────────┤
│ Offers (1)                   │
│ Desconto NF                  │
├──────────────────────────────┤
│ 2 bloqueios                  │
│ [Salvar] [Revisar e aprovar] │
└──────────────────────────────┘

[Fila ▾] abre um drawer com busca, filtros e próximo/anterior.
```

### 13.5 Comportamentos obrigatórios

- Checkbox/relação de Offer atualiza composição, total e issues imediatamente no cliente, sem
  salvar ou refetch, preservando a regra da Sprint 9H.4.
- Edição marca a row como “alterações não salvas”; trocar de MMV pede confirmação.
- Salvar usa CAS. Em `40001`, mostrar diff entre versão local e atual; nunca fazer last-write-wins.
- “Aprovar” abre um resumo final de criações, reutilizações, exclusões, rollovers e gate de MSRP.
- “Promover” é separado de “Aprovar” e exige nova confirmação.
- Em promoção bifásica, o CTA vira “Publicar MSRP no workflow oficial”; após a publicação,
  “Continuar promoção do MMV”.
- Issues apontam e focam o campo correspondente.
- Confidence nunca é mostrada apenas por cor; usar número, band e texto.
- Evidências são acessíveis por teclado e leitores de tela.
- A fila preserva posição e filtros após concluir um item e seleciona o próximo pendente.
- Histórico mostra extração, cada edição, aprovação, fases da promoção e outputs com correlation ID.

## 14. Segurança, concorrência e auditoria

- O browser não acessa diretamente tabelas protegidas; usa camada server e adapter Supabase.
- RLS continua deny-by-default para clientes; privilégios de função permanecem somente no papel
  server autorizado.
- Toda RPC mutável futura deve revogar `PUBLIC`, `anon` e `authenticated`, concedendo apenas ao papel
  operacional necessário.
- `SECURITY DEFINER` exige nomes totalmente qualificados e `search_path = ''`.
- Ator é validado como administrador ativo em cada transação.
- `expected_lock_version` é obrigatório em review, promoção, publicação e todo rollover.
- Correlation ID é obrigatório e único por intenção do operador; retries reutilizam a mesma intenção.
- Reviews e pricing audit events são append-only e incluem before/after completos.
- Raw payload, normalized payload aprovado, schema version, source hash, provider/model/prompt version e
  outputs permanecem rastreáveis.
- Nenhum log deve conter documento completo, credenciais ou dados pessoais desnecessários.

## 15. Lacunas arquiteturais e decisões bloqueadoras

### B1 — Proveniência de Offer — bloqueador de promoção

`pricing_import_row_outputs` não possui `commercial_offer_id`. Decisão recomendada: adicionar esse
destino e manter membership no snapshot auditável ordenado. Sem isso uma row não pode ser marcada
`promoted` com Offers de forma canônica.

### B2 — Estados intermediários de row — bloqueador do gate de preço

Faltam `promoting`, `awaiting_price_publication` e `failed`. Decisão recomendada: evoluir o enum de
row; não sobrecarregar `approved` ou `issue_codes`.

### B3 — Decisão `edit` — bloqueador de auditoria fiel

O enum de review não distingue edição humana. Decisão recomendada: acrescentar `edit`; manter
`classify` para classificação semântica e `match_product` para matching.

### B4 — RPCs de review e promoção — bloqueador de segurança

Não existem boundaries transacionais canônicos para review CAS nem promoção por row. Precisam ser
desenhados como server-only, idempotentes, auditados e baseados nos helpers oficiais. Escritas
diretas por adapter não são aceitáveis.

### B5 — Compensação após fase A — bloqueador de cancelamento

Se o MSRP draft já foi criado e o operador detectar erro, a row não pode simplesmente voltar a
`needs_review`. É necessário decidir entre:

1. workflow explícito que rejeita/arquiva o draft gerado e registra compensação; ou
2. impedir cancelamento e exigir conclusão/correção pelo workflow oficial do preço.

Recomendação: opção 1, sempre com lock, ator, correlation ID e auditoria.

### B6 — Tipos de Policy ausentes — bloqueador por candidato, não do pipeline inteiro

Balão, carência, bônus de primeira parcela, voucher de instalação/acessórios, carregador portátil,
assistência, proteção de bateria e recompra garantida não cabem no domínio. Cada candidato fica
`POLICY_TYPE_UNSUPPORTED`; não converter para `other`. É preciso decidir novos tipos/parâmetros antes
de promovê-los.

### B7 — Canal, região, cor, cota e elegibilidade — bloqueador por Offer

O domínio atual não representa adequadamente canal, região, cor, volume, estoque ou público
restrito. Enquanto não houver contrato de elegibilidade, Offers com essas restrições não podem ser
publicadas como gerais.

### B8 — Matching externo — bloqueador de automação, não de revisão manual

Não existe catálogo canônico de aliases/MVS/códigos de fabricante. O MVP pode usar candidatos e
confirmação manual; auto-confirmação por código depende desse catálogo versionado.

### B9 — Retenção e acesso ao documento — decisão operacional

Definir prazo de retenção, URL assinada, autorização para página/recorte e política de expurgo antes
do upload. Evidência textual e hash devem continuar auditáveis mesmo após expiração do objeto.

### B10 — Calibração de confidence — decisão pós-piloto

Os bands desta especificação são determinísticos, mas scores do extrator precisam ser calibrados
com conjunto avaliado por humanos. Até existir medição, score não pode controlar aprovação.

## 16. Critérios de aceite para a futura implementação

Uma implementação baseada nesta especificação só estará pronta quando:

- o JSON Schema for validado no boundary de ingestão e em toda edição;
- um batch com N MMVs produzir exatamente N rows;
- Product permanecer não confirmado até ação humana ou match exato aprovado;
- evidência de cada campo crítico abrir a página correta;
- `E/OU` produzir somente as composições explícitas;
- ausência em bloco completo não criar entidade;
- review usar CAS e snapshots append-only;
- promoção repetir todas as validações no servidor;
- nenhuma entidade final for escrita pelo extrator;
- fase A/B respeitar publicação individual do MSRP;
- Price, Policies e Offers forem criados como drafts e com proveniência da row;
- rollovers seguirem as regras mensal/especial da Sprint 9 e locks obrigatórios;
- Offer output e memberships forem auditáveis;
- retries não duplicarem outputs;
- promovidos/rejeitados saírem da fila pendente e continuarem no histórico;
- testes cobrirem schema, invariantes, transitions, concorrência, idempotência, rollback, RLS,
  privilégios, `search_path`, auditoria e acessibilidade da fila.

## 17. Resultado desta Sprint documental

Esta Sprint fixa o payload v1, a evidência por campo, confidence, issues, lifecycle desejado, gates de
revisão, promoção bifásica compatível com publicação individual e UX da fila por MMV. Ela também
explicita que a promoção ainda não pode ser implementada com segurança até resolver B1–B5.

Nenhum código, pacote, banco, migration, Staging ou Produção foi alterado por esta especificação.
