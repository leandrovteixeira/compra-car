# Dataset mínimo do Supabase Staging

> **Nunca execute estes scripts em produção.** O destino autorizado é exclusivamente `shfsjyjxmgwnlexmdkcs` (Compra Car Staging).

Este procedimento carrega dois produtos reais por leitura controlada do operacional e cria dados fictícios de Pricing no Staging. Nenhum usuário, profile, preço, oferta, auditoria ou dado comercial é copiado do operacional.

## Amostra

- Products: `608` BYD Dolphin GS EV e `609` BYD Song Plus GS 1.5 TGDI PHEV DHT.
- Specs: união exata de 190 specs referenciadas.
- Product Specs: 306 associações; 124 do Product 608 e 182 do Product 609.
- Ator: único profile `admin/active` preexistente no Staging (UUID não documentado integralmente).
- Preços fictícios: R$ 159.990,00 e R$ 249.990,00, BRL, vigência de 30 dias.
- Offer: oferta fictícia do Product 609.
- Policy: `retail_bonus`, `fixed_amount`, R$ 10.000,00, pertencente ao Product e associada à Offer
  por `commercial_offer_policies`.

## Execução

A ordem completa é:

1. `node scripts/staging/01-extract-minimal-sample.mjs`
2. `node scripts/staging/02-validate-minimal-sample.mjs`
3. `node scripts/staging/03-load-relational-sample.mjs`
4. `node scripts/staging/04-create-pricing-sample.mjs`
5. `node scripts/staging/05-validate-staging-sample.mjs`
6. executar `scripts/staging/06-adjust-sequences.sql` pelo comando seguro abaixo
7. quando aplicável, executar novamente `node scripts/staging/05-validate-staging-sample.mjs`

Os scripts `01` a `05` em `scripts/staging` exigem refs, URLs e chaves por variáveis de ambiente. URLs são validadas estruturalmente: HTTPS, hostname exato, sem porta, caminho, query, fragmento ou credenciais embutidas. A extração usa um helper dedicado que aceita exclusivamente GET com `OPERATIONAL_PUBLISHABLE_KEY`; ele não recebe método nem body. A carga exige `STAGING_SERVICE_ROLE_KEY` e aborta se o ref/hostname não forem os do Staging ou se as tabelas não estiverem vazias.

Lifecycle utilizado: inserção em `draft`, publicação de preços por `publish_product_public_price`,
publicação independente da Policy por `publish_commercial_policy`, link auditado por
`link_commercial_offer_policy` e publicação posterior somente da Offer por
`publish_commercial_offer`. Eventos de auditoria são gerados exclusivamente pelas funções oficiais.

PostgREST garante atomicidade por requisição em lote. Como o schema não oferece RPC transacional para a carga relacional multi-tabela, os lotes `specs`, `products` e `product_specs` são requisições separadas, sempre precedidas de validação e estado vazio. Nenhuma constraint, trigger ou RLS é desabilitada.

IDs explícitos exigem verificação posterior das sequences reais resolvidas por `pg_get_serial_sequence`. Elas nunca devem ser reduzidas.

Antes do passo 06, reconfirme que o projeto vinculado é o Staging. Em PowerShell, o comando abaixo interrompe antes de enviar o SQL se o ref local não for exatamente o autorizado:

```powershell
$stagingRef = 'shfsjyjxmgwnlexmdkcs'; if ((Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim() -ne $stagingRef) { throw 'Supabase link is not Compra Car Staging' }; npx supabase db query --linked --file scripts/staging/06-adjust-sequences.sql
```

O SQL é transacional, bloqueia somente as três tabelas da fixture, descobre cada sequence com `pg_get_serial_sequence`, confere o objeto esperado e usa `MAX(id)` e o estado corrente para nunca reduzir valores. Ele não chama `nextval` nem insere registros, portanto não consome IDs de teste. Reexecuções consistentes mantêm os mesmos valores e são idempotentes. **Nunca execute o passo 06 no operacional ou em produção.**

## Limitações e remoção futura

A validação não conecta permanentemente o Next.js ao Staging e não altera `.env.local`. Para remoção futura, preparar uma operação separada, revisada e transacional, identificando primeiro Policy, Offer, preços, associações, Products e Specs exclusivas. Este documento não autoriza nem executa limpeza.

## Execução de 2026-07-27

A carga foi executada exclusivamente em `shfsjyjxmgwnlexmdkcs`:

- 2 Products, 190 Specs e 306 Product Specs carregados;
- Product 608 com 124 associações e Product 609 com 182;
- preços fictícios de R$ 159.990,00 e R$ 249.990,00 publicados por `publish_product_public_price`;
- uma Offer e uma Policy do mesmo Product, associadas pela junction e publicadas separadamente;
- três eventos de auditoria gerados pelas funções oficiais;
- as três views de leitura retornaram os dois produtos;
- tabelas legadas, imports, reviews e `commercial_policy_applications` permaneceram vazias.

### Sequences corrigidas em 2026-07-27

O canal administrativo `supabase db query --linked` foi usado exclusivamente no Staging. As sequences foram descobertas por `pg_get_serial_sequence`, bloqueadas junto às tabelas durante o ajuste e atualizadas pela regra monotônica `GREATEST(last_value, MAX(id))`, com `is_called=true` para que o próximo valor seja maior que o máximo atual.

| Tabela | Sequence real | MAX(id) | Antes (`last_value`, `is_called`, próximo) | Depois (`last_value`, `is_called`, próximo) |
| --- | --- | ---: | --- | --- |
| `public.products` | `public.products_id_seq` | 609 | 1, false, 1 | 609, true, 610 |
| `public.specs` | `public.equipments_id_seq` | 313 | 1, false, 1 | 313, true, 314 |
| `public.product_specs` | `public.product_specs_id_seq` | 30462 | 1, false, 1 | 30462, true, 30463 |

Nenhuma sequence foi reduzida e nenhum ID foi consumido para teste.

### Retomada e validação endurecidas

O script de Pricing trata cada preço separadamente por `source_reference`. Se somente uma fixture consistente existir, ela é validada integralmente e apenas a ausente é criada; se ambas existirem, somente são validadas. Duplicidade, referência inesperada, produto, valor ou qualquer outro campo conflitante interrompe o processo antes de escrita adicional. Offer e Policy também são identificadas por suas chaves exclusivas. Somente registros em `draft` são publicados; registros publicados são apenas relidos e nunca republicados. Ao final, os dois preços são relidos e validados novamente.

A validação pós-carga compara Products, IDs de Specs e todas as associações com a amostra extraída; valida chaves próprias da fixture, atores e valores de Pricing; verifica entidade/ação dos três eventos de auditoria; e inspeciona o conteúdo essencial das três views.
