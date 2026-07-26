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

O cálculo usa precisão decimal e HALF_UP. O resíduo é aplicado à última policy na ordem retail,
trade-in e financiamento, seguida por source id e candidate id. A soma final deve ser exatamente o
total legado. Sem base elegível, o total fica `unallocated_legacy_total`, recebe
`UNALLOCATED_LEGACY_DEALER_REBATE` e bloqueia publicação; nenhuma policy genérica é criada.

IPVA, seguro, wallbox, emplacamento, manutenção, voucher, `other` e futuros tipos não declarados não
recebem rebate. `dealer_rebate_amount` nunca compõe o benefício do cliente.

## Tipos para novos cadastros

- `free_wallbox`: `fixed_amount`, default atual BRL 4.000,00, alterável por policy.
- `free_registration`: `percentage_of_msrp`, taxa auditável de 1% do MSRP versionado.
- `free_maintenance`: `non_monetized`, com descrição ou cobertura em `policy_parameters`.
- `fuel_or_recharge_voucher`: `fixed_amount` nominal e modalidade `fuel`,
  `electric_recharge` ou `unspecified`.

Nenhum desses tipos é inferido de `others_bonus`. O legado continua gerando `other`, pois não há
evidência confiável para reclassificação histórica.

## Publicação

Uma offer publicável exige produto, preço positivo do mesmo produto, vigência válida, referências
íntegras, policies válidas e ausência de issues bloqueadores. Rebate não alocado e benefício
financeiro negativo bloqueiam publicação. `free_maintenance` válida não bloqueia apenas por ter valor
`NULL`; policies monetizadas exigem benefício positivo.

As alterações de schema permanecem somente na migration não aplicada
`20260726150000_add_pricing_legacy_migration_rules.sql`.
