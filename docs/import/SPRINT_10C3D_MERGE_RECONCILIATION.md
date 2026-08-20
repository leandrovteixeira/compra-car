# Sprint 10C.3D — Reconciliation

Status: **Foundation e Semantic Reconciliation implementadas como primitives puras; runtime inalterado**
Data: 2026-08-20

## Foundation — CONCLUÍDA

`reconcileCommercialDocumentExtractions` combina `CommercialDocumentMap/1`,
`CommercialExtractionUnitPlan/1` e envelopes `{ unitId, ordinal, artifact }`. Produz
`CommercialDocumentReconciliationResult/1` com identities, facts, scopes, composition, provenance,
coverage, duplicates, conflitos, ambiguidades e issues.

A foundation valida mapa, plano e artifacts; faz somente dedupe documental exato; remapeia IDs e
referências; reconcilia units e partitions; preserva inherited headers; e nunca escolhe um valor por
last-write-wins. IDs, mensagens, provenance e output possuem ordem canônica.

## Semantic Reconciliation — IMPLEMENTADA

O subpath interno `@compra-car/core/commercial-document-semantic-reconciliation` consome a foundation
e directives documentais explícitas opcionais. Produz
`SemanticallyReconciledCommercialDocument/1`, ainda composto somente de fatos e aplicabilidade
documentais.

### Rules e recipients

Cada fact origina uma documentary rule com source fact/scope refs, valor tipado, validity, channel
constraints, exclusions, composition groups, estado documental e provenance. Recipients possuem os
tipos `DOCUMENT`, `BRAND_LINE`, `MODEL`, `VERSION_SET`, `VEHICLE`, `CHANNEL` e `GROUP`. Aplicabilidade
materializada termina em vehicle identities reconciliadas; não cria Product nem Policy.

### Scope propagation e exclusions

Indexes determinísticos por brand, model, version, identity, channel e group resolvem selectors:

- `DOCUMENT` alcança todos os vehicles documentais elegíveis;
- `BRAND_LINE`, `MODEL` e `VERSION_SET` usam igualdade normalizada controlada;
- `VEHICLE` usa o ID reconciliado;
- `CHANNEL` usa associações explícitas fact/scope→vehicle;
- `GROUP` percorre scopes dos groups e de seus member/shared facts.

Scopes simultâneos são interseccionados. Exclusions de identity, brand, model, version, channel e
group são removidas antes da materialização. Selector não resolvível vira issue; não existe fallback
por proximidade ou similaridade.

### Bidirectional reconciliation e coverage

`ruleApplicability` registra expected, resolved, excluded e unresolved recipients por rule.
`recipientApplicability` registra applicable, excluded e unresolved rules por recipient. O validator
recalcula as duas projeções e recusa divergência.

Coverage é derivada dessas relações, não de confidence: conta rules totalmente reconciliadas,
recipients totalmente cobertos e scopes não resolvidos. Status final é `complete`, `partial` ou
`conflicted`.

### Aliases, notes e context

Normalização trivial controla case, whitespace, diacríticos e pontuação. Aliases não triviais só são
aceitos por `ExplicitDocumentaryAlias`; dois targets para o mesmo alias geram `AMBIGUOUS_ALIAS`. Não
existe fuzzy matching.

Notes/footnotes/context são aplicáveis apenas quando uma `DocumentaryContextAssertion` declara scope
explícito. Contexto apenas posicional gera `UNRESOLVED_CONTEXT`; a engine não inventa scope.

### Errata, complements, validity e conflicts

`ExplicitDocumentaryPrecedence` representa `REPLACES`, `CORRECTS` ou `SUPPLEMENTS`. Replacement ou
correction resolve deterministicamente o conflito, preserva provenance e liga a rule anterior por
`supersededByRuleId`. Supplement adiciona rule, mas não implica replacement.

Valores incompatíveis só conflitam quando fact dimension, recipients e períodos se sobrepõem.
Períodos disjuntos coexistem. Sem precedência explícita, o conflito permanece `unresolved`; página ou
ordem de artifact nunca são usadas como last-write-wins.

### Semantic issues

O modelo inclui `UNRESOLVED_SCOPE`, `UNRESOLVED_RECIPIENT`, `OVERLAPPING_RULE_CONFLICT`,
`AMBIGUOUS_ALIAS`, `GENERAL_RULE_PARTIAL_COVERAGE`, `INVALID_EXCLUSION`,
`UNRESOLVED_PRECEDENCE`, `COMPOSITION_SCOPE_CONFLICT`, `CHANNEL_SCOPE_CONFLICT` e
`UNRESOLVED_CONTEXT`. Issues têm ID determinístico, severity, rule/recipient refs, provenance e
mensagem fixa segura.

### Determinismo, imutabilidade e performance

Não são usados clock, UUID, random, locale do host, embeddings ou modelo semântico. Ordenação é
ordinal explícita e o mesmo input produz JSON byte-equivalente. Foundation e directives podem estar
deep-frozen.

Indexes evitam matching global rule×recipient. Cada scope consulta o índice correspondente;
`DOCUMENT` naturalmente toca N recipients. A fixture Fiat-like cobre 100 identities.

## Limites semânticos preservados

Julgamento de linguagem natural, aliases implícitos, precedência não declarada, scope inferido por
posição e conflitos sem prova estrutural permanecem para assisted/human reconciliation futura. Não
existe heurística probabilística.

## Fronteiras

Não há Product matching, CommercialPolicy, CommercialOffer, `promotionPlan`, domain mapping,
persistência, migration, RPC, Supabase, Storage, provider, OpenAI ou UI. Nenhuma primitive foi
conectada a segmented extraction, `processAdminImportBatch`, registry ou Server Actions.

Próximo estágio: **10C.3E — Domain Mapping**.

**RUNTIME SEMANTIC RECONCILIATION ACTIVE? NO.**
