# Modelo de Offers e Policies comerciais — V2

## Relações e composição

`commercial_policy` pertence diretamente a um Product e tem lifecycle próprio. Uma
`commercial_offer` também pertence a um Product e referencia o MSRP versionado, a vigência e a
origem. A relação N:N é persistida em `commercial_offer_policies`.

A mesma Policy pode participar de várias Offers do mesmo Product. A Offer é a única autorização de
acúmulo: nunca se somam todas as Policies de um Product. Memberships de Offer published ou archived
são históricas e imutáveis.

## Monetização

Toda Policy publicável exige `customer_benefit_amount > 0` em BRL:

- `retail_bonus`, `trade_in_bonus`, `free_wallbox`, `free_maintenance`,
  `fuel_or_recharge_voucher` e `other`: valor fixo positivo;
- `free_registration`: 1% do ProductPublicPrice-base, sem valor manual como fonte de verdade;
- `free_ipva` e `free_insurance`: valor calculado a partir do preço-base e parâmetros;
- `subsidized_financing`: diferença de fluxo de caixa conforme parâmetros financeiros publicados.

`registration` e `present_value_subsidy` permanecem apenas por compatibilidade histórica e não são
aceitos para nova publicação. `other` exige descrição. A cobertura de manutenção pode continuar em
`policy_parameters`, mas não substitui seu valor econômico obrigatório.

Valores derivados usam decimal exato e arredondamento HALF_UP. O benefício da Offer e seu preço
transacional não são materializados:

```text
OfferBenefitAmount = sum(member_policy.customer_benefit_amount)
TransactionalPrice = ProductPublicPrice.amount - OfferBenefitAmount
```

Benefício superior ao MSRP invalida a Offer.

## Lifecycle e vigência

Policy percorre `draft → needs_review → published → archived` independentemente da Offer. Publicar
uma Offer exige suas Policies previamente published e não altera as Policies.

Uma membership válida exige o mesmo Product e cobertura integral do período:

```text
policy.starts_on <= offer.valid_from
policy.ends_on IS NULL OR policy.ends_on >= offer.valid_to
```

Draft Offer pode receber Policy draft ou needs_review para composição antecipada. Policy rejected ou
archived não pode receber nova associação. Arquivamento posterior não invalida a história de uma
Offer já publicada.

## Dealer rebate legado

O Excel pode informar somente `total_dealer_rebate`. Sua alocação proporcional continua sendo regra
exclusiva de migração. Apenas retail, trade-in e financiamento são elegíveis; componentes explícitos
positivos são autoritativos e nunca redistribuídos. `dealer_rebate_amount` não compõe o benefício do
cliente.

`commercial_policy_applications` e acumuladores permanecem no schema apenas para compatibilidade e
reconciliação histórica. Eles não implementam Offer↔Policy e não são fonte da composição V2.

## Batch persistente

Origem `manual` usa `pricing_import_batches`, assim como Excel, PDF e IA. Não existe infraestrutura
paralela para os futuros Batch Prices, Batch Policies e Offer Builder.

## Segurança e auditoria

A junction possui RLS, leitura restrita e nenhuma escrita privilegiada pelo browser. Link/unlink
ocorrem por RPC server-only, validam optimistic locking da Offer e registram ator e correlation ID em
`pricing_audit_events`. Publicações de Policy e Offer também usam funções auditadas independentes.
