# Modelo de offers e policies comerciais

## Agregado

`commercial_offer` é o agregado pai de uma condição comercial. Ela referencia produto, MSRP
versionado, vigência, origem e suas policies. Identificadores legados são somente auditoria.

Policies monetizadas: `retail_bonus`, `trade_in_bonus`, `subsidized_financing`, `free_ipva`,
`free_insurance`, `free_wallbox`, `free_registration`, `fuel_or_recharge_voucher` e `other` com
`fixed_amount`. `free_maintenance` é qualitativa e não monetizada: seu valor permanece `NULL`, nunca
zero, e não participa de totais financeiros.

## Dealer rebate legado

O Excel pode informar somente `total_dealer_rebate`. A alocação proporcional é regra exclusiva de
migração. Apenas retail, trade-in e financiamento são elegíveis. Componentes individuais positivos
são autoritativos (`explicit_legacy_component`) e nunca redistribuídos.

Quando só existe o total agregado, policies elegíveis, calculáveis e com benefício positivo recebem:

```text
total_dealer_rebate × customer_benefit_amount / soma_dos_benefícios_elegíveis
```

O cálculo usa precisão decimal e HALF_UP. O total é convertido em centavos inteiros: cada policy
recebe primeiro o piso de sua quota e os centavos restantes seguem as maiores frações, com desempate
por retail, trade-in, financiamento, source id e candidate id. Nenhum valor pode ser negativo e a
soma final é exatamente o total legado. Ausência de rebate é sempre representada por amount e método
`NULL`, nunca por zero sem método. Sem base elegível, o total fica `unallocated_legacy_total`, recebe
`UNALLOCATED_LEGACY_DEALER_REBATE` e bloqueia publicação; nenhuma policy genérica é criada.

IPVA, seguro, wallbox, emplacamento, manutenção, voucher, `other` e futuros tipos não declarados não
recebem rebate. `dealer_rebate_amount` nunca compõe o benefício do cliente.

## Tipos para novos cadastros

- `free_wallbox`: `fixed_amount`, default atual BRL 4.000,00, alterável por policy.
- `free_registration`: `percentage_of_msrp`, taxa auditável de 1% do MSRP versionado.
- `free_maintenance`: `non_monetized`, com descrição ou cobertura em `policy_parameters`.
- `fuel_or_recharge_voucher`: `fixed_amount` nominal e modalidade `fuel`,
  `electric_recharge` ou `unspecified`; a modalidade é obrigatória na publicação.

Nenhum desses tipos é inferido de `others_bonus`. O legado continua gerando `other`, pois não há
evidência confiável para reclassificação histórica.

## Tipos compartilhados e compatibilidade

`@compra-car/contracts` é a fonte TypeScript dos tipos. Os tipos atuais são os dez listados acima.
`registration` permanece somente no enum SQL como compatibilidade histórica e é deprecated para
novos registros; seu equivalente atual é `free_registration`. `present_value_subsidy` é um método
de cálculo legado, não um policy type, e foi substituído no fluxo atual por
`discounted_promotional_cash_flow_difference`. Ambos são recusados pela publicação de offers novas.
Os demais métodos reconhecidos são `fixed_amount`, `percentage_of_msrp`, `manual_amount`,
`proportional_ipva` e `non_monetized`.

## Publicação

Uma offer publicável exige produto e MSRP `published`, positivo, BRL, do mesmo produto e com vigência
compatível, além de referências íntegras, policies válidas e ausência de issues bloqueadores. Rebate não alocado e benefício
financeiro negativo bloqueiam publicação. `free_maintenance` válida não bloqueia apenas por ter valor
`NULL`; policies monetizadas exigem benefício positivo.

`publish_commercial_offer` é o único fluxo de transição de draft para published. A função valida e
bloqueia o agregado, publica suas policies na mesma transação e grava os campos de ciclo de vida e o
evento de auditoria. UPDATE direto é recusado; published e archived não voltam a draft nem podem ser
apagadas. `commercial_policy_applications` continua no schema apenas para compatibilidade do modelo
anterior e não é lida nem reconstruída por esse fluxo.

As colunas `price_type` e `policy_parameters` foram adicionadas como nullable. Seus defaults valem
somente para registros novos; valores históricos exigem validação e backfill separado antes de um
futuro `NOT NULL`. A migration permanece transacional e substitui apenas triggers nomeados,
recriando seu comportamento no mesmo arquivo.

As alterações de schema permanecem somente na migration não aplicada
`20260726150000_add_pricing_legacy_migration_rules.sql`.
