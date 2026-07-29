# Sprint 9B — validação no Staging

Destino exclusivo: Compra Car Staging, project ref `shfsjyjxmgwnlexmdkcs`. Este procedimento não
autoriza acesso ao projeto de Produção.

Antes de qualquer comando vinculado, executar `scripts/environment/show-environment.ps1` e ler
`supabase/.temp/project-ref`; ambos devem identificar exatamente o ref acima.

## Migration

`20260728220000_create_manual_price_batch.sql` adiciona somente a RPC transacional do batch manual.
O dry-run deve listar exclusivamente essa migration. Após aplicação, validar registro em
`supabase_migrations.schema_migrations`, owner, `SECURITY DEFINER`, `search_path`, grants, RLS e
contagens das tabelas de Pricing.

## Teste funcional reversível

`scripts/staging/validate-manual-price-batch-rollback.sql` executa uma linha contra um Product real do
Staging e o admin ativo existente. Dentro da mesma instrução SQL, verifica batch, row, output, preço
draft, proveniência, lifecycle, auditoria, contagens e ausência de alteração em Policies/Offers.

O final esperado é o erro deliberado:

```text
EXPECTED_ROLLBACK: STAGING_MANUAL_PRICE_BATCH_VALIDATED
```

Esse erro é parte do protocolo: ele aborta a instrução e reverte todos os registros artificiais. Um
erro diferente representa falha. Depois, repetir as contagens somente leitura e confirmar que são
idênticas às anteriores.

## Execução de 2026-07-28

- gates: ambiente STAGING e ref vinculado `shfsjyjxmgwnlexmdkcs`;
- dry-run inicial: somente `20260728220000_create_manual_price_batch.sql` pendente;
- contagens antes/depois: 2 Products, 3 preços, 0 batches, 0 rows, 0 outputs, 3 eventos de auditoria,
  1 Policy, 1 Offer, 1 membership e 0 applications;
- estrutura: owner `postgres`, `SECURITY DEFINER`, `search_path = ''`, EXECUTE somente para
  `service_role`, RLS ativa e browser roles sem escrita direta;
- teste funcional: marcador `EXPECTED_ROLLBACK: STAGING_MANUAL_PRICE_BATCH_VALIDATED` recebido;
- confirmação pós-rollback: zero batch e zero audit event da correlação artificial;
- dry-run final: banco remoto atualizado e nenhuma migration pendente.

Produção não foi consultada nem alterada.
