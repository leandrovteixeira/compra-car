# Sprint 9F — Combinação de políticas

## Escopo

`/admin/prices/offers` é uma grade de até 100 combinações. Cada linha escolhe um veículo e, em colunas fixas, no máximo uma Policy de Varejo, Trade-In, Loyalty, Taxa, IPVA, Seguro, Wallbox, Emplacamento, Manutenção, Voucher e Outro. Zero Policies exibe indisponibilidade e duas ou mais do mesmo tipo exibem conflito; o sistema nunca escolhe uma delas arbitrariamente.

O navegador envia apenas `clientRowId`, `productId` e IDs explicitamente selecionados. MSRP, vigência e valores autoritativos são resolvidos novamente no servidor e na RPC.

## Vigência derivada

- `valid_from` é o maior `starts_on` das Policies selecionadas.
- Exatamente um MSRP publicado deve estar válido em `valid_from`.
- `valid_to` é a menor data não nula entre os `ends_on` das Policies e do MSRP.
- Sem data final concreta, a combinação é rejeitada; nenhum horizonte é inventado.
- Se `valid_to < valid_from`, a combinação é rejeitada.

`commercial_offers.valid_to` permanece `NOT NULL`. Todo o lote é validado antes do primeiro `INSERT`; qualquer falha desfaz Offers, memberships e auditorias.

## Segurança

O fluxo é UI → Server Action → core/use case → repository → adapter → RPC. `create_commercial_offer_batch(jsonb, uuid, uuid)` usa `SECURITY DEFINER`, `search_path = ''`, exige admin ativo, trava Products em ordem estável e só concede execução a `service_role`. Logs de falha incluem correlation ID sem payload.

Loyalty (`loyalty_bonus`) é monetária fixa e distinta de Varejo e Trade-In. A RPC manual apenas inclui o novo tipo nas listas fechadas existentes.
