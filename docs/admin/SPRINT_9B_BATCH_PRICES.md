# Sprint 9B — Batch Prices

## Escopo entregue

`/admin/prices/input` é uma rota protegida para admin no shell Next.js existente. A grade começa e
termina com uma linha vazia operacional, acrescenta outra quando a última começa a ser preenchida,
permite remover linhas antes do envio e adapta cada linha a bloco no mobile sem rolagem horizontal.
O limite é 100 linhas preenchidas.

O seletor pesquisa marca, modelo, versão e anos e exibe
`Marca — Modelo — Versão — Ano modelo/Ano produção`. Todos os Products administrativos são listados,
inclusive inativos e não públicos, sinalizados na opção. A operação pode preparar preço antes da
publicação do veículo; a existência do ID é revalidada na fronteira SQL.

## Regras

- linha totalmente vazia é ignorada; linha parcial é inválida;
- `amount` aceita notação pt-BR e é transportado como string decimal com duas casas;
- `startsOn` é obrigatório; `endsOn` é opcional e deve ser igual ou posterior;
- duplicidade por `productId + startsOn`, interna ou já persistida, rejeita o lote inteiro;
- nenhum registro existente é atualizado, arquivado ou sobrescrito;
- todo preço nasce em `draft`, BRL, `price_type = msrp`;
- Policies, Offers, revisão, publicação e uploads não fazem parte desta sprint.

## Arquitetura e persistência

```text
Client grid
  → Server Action
  → serviço server-only (requireRole admin, actor e correlation ID)
  → CreateManualPriceBatch
  → ManualPriceBatchRepository
  → ManualPriceBatchSupabaseAdapter
  → create_manual_price_batch
```

A RPC valida o payload completo antes da primeira escrita e então cria, na mesma transação, batch,
import rows, preços draft, row outputs e eventos de auditoria. Um erro faz rollback integral. A UI
não acessa Supabase, e o adapter dedicado não usa `LegacySupabaseAdapter`.

## Segurança

`create_manual_price_batch` é `SECURITY DEFINER`, pertence a `postgres`, usa `search_path = ''` e
tem EXECUTE apenas para `service_role`. Admin ativo é validado novamente no banco. RLS permanece
habilitada nas tabelas envolvidas e `anon`/`authenticated` não têm escrita direta.

`pricing_import_batches.source_type` é fisicamente `pricing_source_type`, enum PostgreSQL com
allowlist `manual`, `legacy_backfill`, `ai_extraction` e `api_import`. Portanto a remoção da check
constraint redundante na Sprint 9A não deixou texto aberto e a Sprint 9B não adiciona outra constraint.

## Validação

A migration `20260728220000_create_manual_price_batch.sql` é forward-only. O pgTAP
`010_manual_price_batch.test.sql` cobre objeto, owner, grants, RLS, enum, autorização, fluxo completo,
proveniência, auditoria, rollback, conflitos, limites e ausência de Policies/Offers. Após reset local,
a suíte completa totalizou 428 testes SQL aprovados.

Em 2026-07-28, a migration foi aplicada exclusivamente ao Staging `shfsjyjxmgwnlexmdkcs`. O teste
funcional reversível concluiu com o marcador esperado e deixou zero batch/row/output/fixture de
auditoria. O dry-run final confirmou o banco remoto atualizado, sem migration pendente.
