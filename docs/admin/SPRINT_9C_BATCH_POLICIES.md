# Sprint 9C — Batch Policies

A rota `/admin/prices/policies/input` oferece cards responsivos com linha vazia automática, limite de
100 linhas e campos discriminados para os dez tipos atuais. `registration` permanece histórico e não
é aceito. Trocar o tipo limpa os parâmetros específicos anteriores.

O salvamento é atômico. Cada linha cria batch provenance, row, output, audit e uma Policy `draft`.
Valores fixos mantêm máscara monetária pt-BR durante a edição. Os labels administrativos são `Taxa`
e `Voucher`, sem alterar os identifiers internos `subsidized_financing` e
`fuel_or_recharge_voucher`. Taxas aceitam vírgula decimal (`0,49`) e são normalizadas para decimal
canônico antes da validação e do cálculo.

O estado controlado dos campos monetários contém somente o display pt-BR. Durante o `onChange`, uma
normalização tolerante corrige agrupamentos transitórios antes do rerender; na fronteira do domínio,
um parser estrito converte o display para decimal canônico. Assim, `15.000,00` ⇄ `15000.00` permanece
estável e entradas progressivas não deixam estados como `1.0000,00`. A Taxa segue a mesma separação:
aceita ponto ou vírgula, exibe `0,49` e entrega `0.49` ao cálculo existente.
Para policies fixas, `amount` também é canonicalizado antes da RPC; a string pt-BR nunca atravessa a
fronteira de persistência.

Emplacamento, IPVA, seguro e Taxa recarregam o MSRP publicado; Taxa seleciona o Parameter Set
publicado aplicável à vigência. Para uma policy aberta, o MSRP precisa estar publicado e válido em
`startsOn`; ele pode ter uma data final futura. A RPC recalcula valores e mantém rollback integral se
qualquer linha for inválida ou ocorrer falha de persistência.

Não faz parte da Sprint: publicação, Offers, memberships, importação externa ou alteração do lifecycle.

## Correção pós-validação de UX

A migration `20260730223142_fix_manual_policy_batch_open_ended_msrp.sql` foi aplicada somente ao
Staging e substitui apenas `create_manual_policy_batch`. Testes transacionais reversíveis confirmaram
Bônus + IPVA sobre MSRP finito válido em `startsOn`, rejeição de MSRP já expirado com rollback total e
Taxa 24/0,49/60 com benefício positivo. Todos terminaram com zero batch e zero policy residual.

Na segunda validação, o fluxo canônico persistiu Trade-in + Taxa + IPVA no batch 16. As policies
17, 18 e 19 foram confirmadas em `draft`, incluindo Taxa 24/0,49/60 com benefício de R$ 6.893,41,
sem criação parcial ou mensagem de erro.
