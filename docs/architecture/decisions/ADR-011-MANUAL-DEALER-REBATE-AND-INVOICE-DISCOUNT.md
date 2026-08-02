# ADR-011 — Rebate manual e Desconto NF no domínio comercial

## Status

Aceita em 2026-08-01.

## Decisão

O Rebate informado na operação manual reutiliza `commercial_policies.dealer_rebate_amount`, pois o
campo já representa a parcela do benefício financiada pela concessionária. A origem `manual` foi
adicionada ao enum de método de alocação para não atribuir proveniência legada a dados operacionais.
Valor zero é representado por ausência de alocação; valor positivo deve ser menor ou igual ao
benefício ao cliente.

Desconto NF é identificado por `invoice_discount` em `commercial_policy_type`. Ele usa cálculo
`fixed_amount`, participa normalmente das Offers e do benefício ao cliente.

## Consequências

- não existe uma segunda coluna de Rebate com semântica concorrente;
- Rebate permanece fora do total da Offer, do preço transacional e do PDF;
- importação futura por IA pode preencher o mesmo contrato e indicar sua proveniência;
- a validação de publicação reconhece Rebate manual e Desconto NF sem relaxar as regras legadas.
