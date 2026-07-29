# ADR-012 — Pricing Domain V2 para Policies reutilizáveis e Offers em lote

- **Status:** aceito e implementado na Sprint 9A
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

## Consequências

O futuro Batch Policies pode persistir Policies antes das Offers; o Offer Builder pode reutilizá-las
em combinações explícitas; e o Batch Prices permanece independente. A interface dessas três etapas
não faz parte da Sprint 9A.

Documentos anteriores que descrevem Policy como filha exclusiva da Offer são históricos e devem ser
lidos sob esta decisão.
