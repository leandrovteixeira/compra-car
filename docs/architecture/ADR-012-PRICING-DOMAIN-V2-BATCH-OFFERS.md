# ADR-012 — Pricing Domain V2 para Policies reutilizáveis e Offers em lote

- **Status:** aceito; modelo implementado na Sprint 9A e Batch Prices implementado na Sprint 9B
- **Data:** 2026-07-28
- **Substitui parcialmente:** ADR-011 nas relações entre Product, CommercialPolicy e CommercialOffer

## Contexto

O modelo anterior fazia `CommercialOffer 1:N CommercialPolicy` por
`commercial_policies.commercial_offer_id`. Isso impedia criar e publicar Policies antes das Offers,
obrigava duplicar a mesma condição em combinações diferentes e acoplava seus ciclos de vida.

O fluxo em lote exige cadastrar condições por veículo, revisá-las e somente depois montar as
combinações comerciais válidas.

## Decisão

O modelo vigente é:

```text
Product 1:N CommercialPolicy
Product 1:N CommercialOffer
CommercialOffer N:N CommercialPolicy (commercial_offer_policies)
```

Cada Policy pertence a exatamente um Product. Ela pode ser reutilizada por várias Offers, mas
somente do mesmo Product. A Offer — e não a simples coexistência de Policies no Product — define
quais benefícios podem ser acumulados.

Todas as Policies publicáveis são monetizadas em BRL e possuem
`customer_benefit_amount > 0`. `free_maintenance` usa valor fixo nesta etapa;
`free_registration` é exatamente 1% do MSRP-base; `registration` permanece apenas para leitura
histórica e não pode ser publicado. Wallbox, voucher e `other` também exigem valor positivo.

Policy e Offer possuem lifecycle independente. A Policy é publicada primeiro. Publicar uma Offer
exige todas as Policies associadas já publicadas e não altera nenhuma delas. Policy deve cobrir todo
o período da Offer. Arquivar uma Policy depois não reescreve a história de uma Offer publicada.

A associação é mutável apenas enquanto a Offer está em draft. Link e unlink usam RPCs server-only,
optimistic locking da Offer e `pricing_audit_events`. A associação de Offer published ou archived é
imutável.

O benefício e o preço transacional são derivados, não persistidos:

```text
OfferBenefitAmount = soma das Policies associadas à Offer
TransactionalPrice = MSRP - OfferBenefitAmount
```

Uma composição com benefício maior que o MSRP é inválida. Nunca se somam automaticamente todas as
Policies de um Product.

Imports manuais, Excel, PDF e IA convergem na infraestrutura persistente de
`pricing_import_batches`; não haverá um segundo sistema de batch.

## Migração e compatibilidade

A migration `20260728120000_evolve_pricing_domain_v2.sql`:

- infere `commercial_policies.product_id` pela Offer legada e, quando inequívoco, pela aplicação;
- aborta se alguma Policy não puder ser associada com segurança a um Product;
- cria e preenche `commercial_offer_policies`, validando contagens antes de remover a FK antiga;
- remove `commercial_policies.commercial_offer_id`, evitando duas fontes de verdade;
- preserva `commercial_policy_applications` e acumuladores apenas por compatibilidade histórica;
- habilita RLS na junction e mantém escrita apenas pelas funções privilegiadas auditadas;
- completa optimistic locking de Offer e imutabilidade terminal de ProductPublicPrice.

## Fundação da referência financeira (Sprint 9C-0)

`financial_parameter_sets` é a fonte versionada do CDI e do spread usados em financiamento
subsidiado. No MVP, o CDI mensal é entrada manual e o spread mensal oficial é `0,30%`
(`0.003` decimal). A taxa mensal de referência é derivada como CDI mensal decimal mais spread
mensal decimal; nenhum valor é hardcoded no cálculo de Policies.

Registros publicados preservam sua identidade econômica. A troca de referência usa rollover
transacional e auditado: encerra `valid_to` da versão corrente no dia anterior ao `effective_from`
da sucessora e publica a sucessora pela função oficial. Sobreposição entre referências publicadas é
rejeitada. `manual` atende o MVP e `api_import` já representa a futura ingestão automática sem nova
enumeração.

## Consequências

O futuro Batch Policies pode persistir Policies antes das Offers e o Offer Builder pode reutilizá-las
em combinações explícitas. Batch Prices foi entregue independentemente na Sprint 9B, pela mesma
infraestrutura persistente de imports, sem criar Policies ou Offers.

## Incremento da Sprint 9B — Batch Prices

A rota `/admin/prices/input` usa a RPC transacional `create_manual_price_batch`. O payload completo é
validado antes da primeira escrita; sucesso cria batch `manual`, uma import row e output por linha,
um `ProductPublicPrice draft` por output e eventos correlacionados. Qualquer erro ou conflito em
`(product_id, starts_on)` reverte tudo.

A RPC é `SECURITY DEFINER`, `search_path = ''`, exige admin ativo e correlation ID e só pode ser
executada por `service_role`. As tabelas mantêm RLS e browser roles não recebem escrita. O tipo físico
de `pricing_import_batches.source_type` é o enum `pricing_source_type`, que continua sendo a allowlist
do banco após a remoção da antiga check constraint na Sprint 9A.

Documentos anteriores que descrevem Policy como filha exclusiva da Offer são históricos e devem ser
lidos sob esta decisão.
# Complemento Sprint 9C — entrada manual de policies

A entrada em lote reutiliza a proveniência de pricing imports e mantém Policy diretamente sob
Product. A combinação de benefícios continua exclusiva de Offer e, portanto, esta operação não cria
Offer nem membership. Cálculos dependentes de MSRP e referência financeira são autoritativos no
servidor/RPC; previews de UI são apenas informativos.

# Complemento Sprint 9D — Offer Builder

O builder materializa exclusivamente a composição explícita escolhida pelo admin. A Server Action
autorizada chama o caso de uso, que recarrega MSRP e Policies por repository e entrega a composição
validada à RPC `create_commercial_offer_with_policies`. A RPC repete as invariantes sob locks e cria
Offer draft, memberships e auditoria na mesma transação.

Policies `draft`, `needs_review` e `published` podem compor uma Offer draft; Policies rejeitadas,
arquivadas, históricas de registration, de outro Product ou sem cobertura integral são bloqueadas.
Publicação permanece separada e continua exigindo Policies publicadas pelo lifecycle oficial.
# Complemento Sprint 9F — combinação em grade e vigência derivada

A Offer não recebe mais MSRP e datas digitados. Para cada conjunto explícito de Policies,
`valid_from` é o maior início, o MSRP é o único publicado válido nessa data e `valid_to` é o menor
fim não nulo entre Policies e MSRP. Ausência de fim concreto e interseção negativa são erros. O lote
é validado integralmente antes da persistência. `loyalty_bonus` é corrente, fixo e distinto de Varejo
e Trade-In. Nenhuma tabela, coluna, constraint ou nulabilidade é alterada.
