# Validação Staging — Sprint 9D

Projeto: `shfsjyjxmgwnlexmdkcs`.

A migration `20260729202538_create_commercial_offer_builder.sql` foi aplicada exclusivamente em
Staging após dry-run sem operações destrutivas. O teste remoto, inteiramente dentro de
`BEGIN/ROLLBACK`, criou duas Policies temporárias, compôs uma Offer com ambas e outra reutilizando uma
delas, conferiu status draft, memberships e cálculos, e confirmou rejeição cross-product. Os counts
antes e depois permaneceram idênticos: Products 2, ProductPublicPrices 3, CommercialPolicies 1,
CommercialOffers 1, memberships 1, FinancialParameterSets 1, batches 0 e audits 4.

A função está com `SECURITY DEFINER`, `search_path` vazio e execução somente por `service_role`;
`anon` e `authenticated` não executam.

Limitação conhecida:
`supabase start` local expirou antes da criação da stack. Por isso, `supabase db reset --local` e
pgTAP das Sprints 9C-0/9C/9D não foram executados. Os arquivos
`011_financial_reference_foundation.test.sql`, `012_manual_policy_batch.test.sql` e
`013_commercial_offer_builder.test.sql` permanecem pendentes. Essa pendência decorre de
infraestrutura local, não de falha da suíte. A migration e a RPC 9D foram validadas exclusivamente no
Staging por testes reversíveis.
