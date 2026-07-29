# Validação Staging — Sprint 9C

Projeto: `shfsjyjxmgwnlexmdkcs`.

Migrations aplicadas: `20260729190304_create_manual_policy_batch.sql` e
`20260729192018_fix_manual_policy_batch_variable_resolution.sql`. O primeiro teste reversível revelou
ambiguidade PL/pgSQL antes de qualquer persistência; a correção forward-only fixa a resolução dentro
da função, sem alterar schema ou permissões.

O teste final criou em transação uma policy fixa, uma de 1% do MSRP e um financiamento referenciado
ao Parameter Set V1. Validou três drafts e ausência de mudanças em Offers/memberships; `ROLLBACK`
restaurou todas as contagens.

Limitação conhecida:
`supabase start` local expirou antes da criação da stack. Por isso, `supabase db reset --local` e
pgTAP da Sprint 9C-0/9C não foram executados. Os arquivos
`011_financial_reference_foundation.test.sql` e `012_manual_policy_batch.test.sql` permanecem
pendentes. Essa pendência decorre de infraestrutura local, não de falha da suíte. As migrations e a
RPC foram validadas exclusivamente no Staging por testes reversíveis.
