# Inventário de Preços e Políticas Comerciais

## 1. Objetivo e escopo

Este documento registra a investigação inicial, somente leitura, da Sprint 9 — Gestão de Preços e
Políticas Comerciais. O objetivo é identificar o modelo físico legado, os dados existentes, os
consumidores de código e as lacunas que precisam ser decididas antes de qualquer implementação.

Nenhuma migration, DDL, DML, RPC de negócio ou alteração de banco foi executada nesta investigação.
As únicas alterações no repositório são este relatório e os registros de início da investigação em
`CHANGELOG.md` e `AI_CONTEXT.md`. O diretório protegido `Legacy` foi apenas lido e permaneceu
inalterado.

### Fontes e data de corte

- baseline estrutural exportada em `supabase/migrations/20260724233325_legacy_baseline.sql`;
- reconciliação Auth em `supabase/migrations/20260724235959_restore_auth_profiles_after_baseline.sql`;
- scripts e resultados anteriores de inspeção em `supabase/admin-inspection` e `docs/data`;
- código vigente do monorepo e três snapshots históricos do Appsmith;
- consultas remotas somente leitura pelo cliente oficial Supabase em **2026-07-25**;
- ADR-009, que já aceitou a separação conceitual entre MSRP e políticas, com implementação adiada.

**Limitação:** a API de dados confirmou objetos consultáveis e perfil de linhas, mas não expõe os
catálogos `pg_catalog`. Funções, triggers, policies, constraints, índices e grants foram reconciliados
contra a baseline estrutural de 2026-07-24 e as migrations posteriores. Uma inspeção futura pelo SQL
Editor pode confirmar ausência de drift estrutural remoto, sempre com os scripts somente leitura já
versionados.

## 2. Resumo executivo

- O **MVP-u Next.js não obtém nem apresenta preço atualmente**. Seu comparador usa somente
  `products`, `product_specs` e `specs`.
- O único comparador que usa preço é a página histórica **Análise de Valor do Appsmith**. Ela lê
  `vw_product_value_current.public_price` diretamente, sem adapter, repository ou use case.
- `product_price_offers` contém **746 linhas para 287 dos 292 produtos**. Há 745 preços positivos,
  um preço zero, nenhum preço nulo e nenhum preço negativo.
- Existem **duas duplicidades por `product_id + offer_month`**, coerentes com o fato de a tabela
  misturar MSRP e políticas alternativas.
- `offer_month` cobre junho de 2025 a abril de 2026. Não há `valid_from`/`valid_to` na tabela final;
  todas as linhas estão `is_active = true`, inclusive meses históricos.
- `vw_product_value_current` escolhe por `created_at DESC`; as 746 linhas têm exatamente o mesmo
  `created_at`. A seleção é, portanto, não determinística quando o produto possui histórico.
- Os objetos de preço não têm RLS nem policies próprias e a baseline concede `ALL` a `anon`,
  `authenticated` e `service_role`. Isso bloqueia um CRUD seguro até revisão de autorização.
- A estrutura pode ser preservada como legado e fonte de backfill, mas **não deve virar o contrato
  definitivo do CRUD**. A recomendação é uma migration incremental, forward-only, que implemente o
  modelo alvo do ADR-009 sem apagar ou reescrever `product_price_offers`.

## 3. Inventário do banco

### 3.1 Tabelas diretamente relacionadas

| Objeto | Papel atual | Campos relevantes | Observações |
| --- | --- | --- | --- |
| `public.products` | Produto/MMV-MY-PY | `id`, marca, modelo, versão, anos, `is_active`, `is_public` | Agregado referenciado por preços e importação. |
| `public.product_price_offers` | Preço e política legados | `product_id`, `offer_month`, `public_price`, bônus, rebates, financiamento, entrada, parcelas, seguro, IPVA, totais, notas, `is_active` | Mistura MSRP e política na mesma linha. |
| `public.price_offer_imports` | Cabeçalho de importação/campanha | marca, arquivo, `campaign_month`, `valid_from`, `valid_to`, `status` | Possui vigência, mas não há vínculo da tabela final para a importação. |
| `public.price_offer_import_rows` | Linhas interpretadas de importação | produto opcional, preços público/promocional, descontos, bônus, financiamento, confiança, status | Todas as 173 linhas atuais ainda estão pendentes e sem `product_id`. |
| `public.price_offers_staging` | Staging textual de carga | MSRP, bônus, rebates, benefício, comentário, `offer_month_code`, entrada e parcelas | Sem PK, FK, timestamps, status ou identidade da importação. |
| `public.products_active_backup` | Backup operacional legado | `id`, `is_active` | Não é fonte de preço; aparece por conter `products` no escopo nominal. |

Objetos FIPE (`product_fipe_map`, `product_fipe_values`, `fipe_reference_values` e views associadas)
guardam referências de mercado, mas não alimentam o preço usado pelo comparador histórico. Eles não
devem ser confundidos com MSRP ou política comercial.

### 3.2 Views

| View | Função | Dependências e filtros | Problema relevante |
| --- | --- | --- | --- |
| `vw_product_value_current` | Combina preço público e valor percebido dos specs | `products` + `product_specs` + `specs` + CTE em `product_price_offers`; filtra produto/spec ativos e preço não nulo | Ordena preço por `created_at DESC`, sem `offer_month`, `id`, `is_active` da oferta ou `products.is_public`. |
| `vw_product_value_by_category` | Soma valor percebido por categoria | `products` + `product_specs` + `specs`; filtra produto/spec ativos | Não lê preço nem política, mas é consumida junto da view anterior no Appsmith. |
| `vw_product_fipe_candidates` | Candidatos de associação FIPE | objetos de produto/FIPE | Referência de mercado, fora do fluxo de MSRP atual. |
| `vw_product_fipe_review` | Revisão de associação FIPE | objetos de produto/FIPE | Referência de mercado, fora do fluxo de MSRP atual. |

Definição efetiva da escolha de preço na view:

```sql
SELECT DISTINCT ON (product_id)
  product_id,
  public_price
FROM public.product_price_offers
WHERE public_price IS NOT NULL
ORDER BY product_id, created_at DESC;
```

### 3.3 Funções e procedures

Não há função dedicada a criar, validar, versionar, ativar ou encerrar preços/políticas.

| Rotina | Relação com o escopo | Situação |
| --- | --- | --- |
| `duplicate_product_model_year(bigint, integer, integer, boolean)` | Duplica produto, specs e a linha de `product_price_offers` mais recente por `created_at` | Perigosa para o modelo atual; copia uma política arbitrária. Nenhum consumidor no código vigente foi encontrado. |
| `duplicate_product_simple(integer, smallint, smallint, boolean)` | Duplica produto e specs, sem preço/política | É a assinatura recomendada no legado/Appsmith; o Next.js não usa RPC para duplicar. |
| `duplicate_product_simple(bigint, integer, integer, boolean)` | Sobrecarga histórica, também sem preço/política | Dívida de sobrecarga; nenhum consumidor tipado confirmado. |
| `contains_all_tokens(text, text)` / `normalize_text(text)` | Auxilia busca/normalização de produtos/FIPE | Sem lógica de preço. |

### 3.4 Triggers

Não existe trigger em `products`, `product_price_offers`, `price_offer_imports`,
`price_offer_import_rows` ou `price_offers_staging`. Os triggers da baseline/reconciliação atuam
somente em `profiles` e `auth.users`.

Consequências:

- `updated_at` de preços não é mantido automaticamente;
- não há auditoria de alteração;
- não há prevenção de sobreposição, validação de totais ou promoção controlada do staging;
- não há sincronização automática entre importações e a tabela final.

### 3.5 Constraints

| Objeto | Constraints encontradas | Lacunas |
| --- | --- | --- |
| `products` | PK `products_pkey`; índice único exato em marca/modelo/versão/MY/PY | Unicidade não normaliza caixa ou espaços. A amostra atual não possui duplicidade sob normalização simples. |
| `product_price_offers` | PK; FK `product_id -> products.id` sem cascade | Sem unique temporal, checks monetários/percentuais, moeda, vigência final, revisão ou identidade de política. |
| `price_offer_imports` | PK | Sem checks de datas/status e sem chave idempotente do arquivo/campanha. |
| `price_offer_import_rows` | PK; FK para import com `ON DELETE CASCADE`; FK opcional para produto | Sem unique/idempotência por linha e sem checks de valores/status/confiança. |
| `price_offers_staging` | Nenhuma | Não oferece integridade nem rastreabilidade suficiente para promoção. |

Não se recomenda adicionar `UNIQUE(product_id, offer_month)` ao legado: os dois casos duplicados
demonstram que o mesmo produto/mês pode conter combinações comerciais alternativas.

### 3.6 Índices e sequences

- `products`: PK e `unique_product(brand, model, version, model_year, production_year)`;
- `product_price_offers`: apenas o índice implícito da PK; **não há índice em `product_id`,
  `offer_month` ou combinação temporal**;
- `price_offer_imports` e `price_offer_import_rows`: apenas índices implícitos das PKs;
- `price_offers_staging`: nenhum índice;
- sequences: `products_id_seq`, `product_price_offers_id_seq`, `price_offer_imports_id_seq` e
  `price_offer_import_rows_id_seq`.

O índice citado em `Legacy/supabase/migrations/0001_initial_schema.sql`,
`idx_price_offers_product_month`, pertence a uma versão histórica com coluna `reference_month` e
**não existe na baseline atual**.

### 3.7 RLS, policies e grants

- RLS está desativado nas cinco tabelas diretamente relacionadas.
- Não existe policy RLS específica para preço, importação, campanha, oferta ou produto.
- A única tabela staging com RLS na baseline é `product_specs_matrix_staging`, fora deste fluxo e
  sem policy.
- A baseline concede `ALL` em `products`, `product_price_offers`, `price_offer_imports`,
  `price_offer_import_rows`, `price_offers_staging` e nas duas views de valor para `anon`,
  `authenticated` e `service_role`.

Mesmo que o Next.js use um client server-only, esses grants ampliam a superfície de escrita direta.
Autorização de rota por si só não corrige esse risco.

## 4. Perfil dos dados existentes

### 4.1 Produtos e preços finais

Contagens remotas em 2026-07-25:

| Métrica | Resultado |
| --- | ---: |
| Produtos | 292 |
| Produtos ativos e públicos | 43 |
| Produtos com ao menos uma oferta | 287 |
| Produtos sem qualquer oferta | 5 |
| Produtos com `public_price` não nulo | 287 |
| Produtos sem `public_price` não nulo | 5 |
| Produtos ativos/públicos sem preço | 2 (`750` e `752`) |
| Linhas em `product_price_offers` | 746 |
| Preços positivos | 745 |
| Preços nulos | 0 |
| Preços zero | 1 |
| Preços negativos | 0 |
| Referências órfãs de produto | 0 |
| Grupos duplicados por produto/mês | 2 |
| Duplicidades normalizadas de produto | 0 |

O preço zero é a oferta `516`, produto `516` (Geely Starship 7, MY/PY 2026), mês 2026-01. O
produto está inativo e não público, portanto não aparece na view atual, mas o modelo não impede que
um zero passe a consumidores futuros.

As duplicidades são:

- produto `12`, 2025-06: ofertas `12` e `37`;
- produto `13`, 2025-06: ofertas `13` e `38`.

Em ambos os casos o MSRP se repete e uma das linhas contém combinação comercial adicional. Isso
confirma que a duplicidade não pode ser resolvida apagando linhas ou impondo unicidade simples.

### 4.2 Referência temporal

- 11 meses distintos, de **2025-06-01** a **2026-04-01**;
- distribuição mensal: 41, 83, 86, 46, 59, 69, 81, 57, 81, 78 e 65 linhas;
- todas as 746 linhas têm `is_active = true`;
- todas compartilham o mesmo `created_at` e o mesmo `updated_at`, em 2026-05-09;
- 192 grupos produto/timestamp têm empate em `created_at`;
- não existem `valid_from`, `valid_to`, timezone, região, canal ou moeda na tabela final.

`offer_month` é referência de negócio, não uma vigência completa. Na data desta auditoria, o último
mês armazenado já é histórico. Portanto, não há como afirmar qual preço ou política está vigente em
2026-07-25.

### 4.3 Políticas comerciais

Por heurística operacional — qualquer componente não zero/verdadeiro ou nota preenchida — 714
linhas contêm algum dado de política e 32 funcionam como linhas sem componente comercial
significativo. A heurística não define juridicamente uma política e precisa de validação do negócio.

Preenchimentos significativos observados:

| Campo | Linhas |
| --- | ---: |
| `retail_bonus` | 248 |
| `trade_in_bonus` | 358 |
| `subsidized_rate_monthly` | 49 |
| `down_payment_percent` / `installments` | 459 / 459 |
| `insurance_years` | 70 |
| `ipva_included = true` | 714 |
| `others_bonus` | 43 |
| `total_customer_benefit` | 470 |
| `total_dealer_rebate` | 196 |
| `notes` não vazias | 5 |

`retail_rebate`, `trade_in_rebate` e `rate_rebate` estão zerados nas 746 linhas. Há um
`total_customer_benefit = -100`, sem constraint que esclareça se é erro, ajuste ou valor válido.
Não foram observados outros componentes monetários negativos.

### 4.4 Importação e staging

| Objeto/métrica | Resultado |
| --- | ---: |
| `price_offer_imports` | 10 |
| Imports pendentes | 10 |
| Imports sem uma das datas de vigência | 1 |
| `price_offer_import_rows` | 173 |
| Linhas pendentes | 173 |
| Linhas sem produto resolvido | 173 |
| Linhas com `public_price` nulo | 69 |
| Linhas com `promo_price` nulo | 132 |
| Linhas órfãs de import | 0 |
| `price_offers_staging` | 746 |

As vigências preenchidas dos imports começam entre 2026-05-01 e 2026-05-07 e terminam entre
2026-05-31 e 2026-06-03. Não há evidência de promoção implementada entre esses objetos e
`product_price_offers`.

### 4.5 Views

- `vw_product_value_current`: 41 linhas, todas pertencentes hoje a produtos públicos por
  coincidência dos dados; a definição não exige `is_public`;
- `vw_product_value_by_category`: 471 linhas;
- nenhum preço zero aparece hoje na view;
- os 41 preços retornados coincidem numericamente com o maior `offer_month` de seus produtos na
  fotografia atual, mas isso é acidental: a ordenação por timestamp empatado não garante o mês.

## 5. Inventário do código

### 5.1 MVP-u vigente — Next.js

Não existe leitura ou escrita de preço/política em `apps/web`, `packages/core`,
`packages/contracts` ou no código fonte de `packages/adapter-supabase`.

O fluxo real do comparador é:

```text
apps/web/src/app/(seller)/comparar/page.tsx
  -> apps/web/src/server/comparison-service.ts
  -> packages/core/src/use-cases/compare-vehicles.ts
  -> packages/core/src/repositories/{vehicle,comparison}-repository.ts
  -> packages/adapter-supabase/src/legacy-supabase-adapter.ts
       -> products
       -> product_specs
       -> specs
  -> apps/web/src/application/comparison/comparison-mapper.ts
  -> apps/web/src/components/comparison-table.tsx
```

`apps/web/src/server/composition-root.ts` instancia `LegacySupabaseAdapter` para as duas portas. O
adapter consulta produtos ativos/públicos, associações e specs ativas. Nenhum DTO, entidade,
repository ou use case transporta `public_price`, vigência ou política.

Fallbacks atuais:

- preço ausente: não se aplica, pois preço não integra o contrato;
- `R$ 0`: não há formatação nem tratamento de preço;
- vigência: não existe no fluxo;
- valores de specs ausentes permanecem `null`; isso não é fallback de preço.

### 5.2 MVP-a vigente — Next.js

O MVP-a possui CRUD de `products` e edição de `product_specs`, mas nenhum módulo de preço/política.
Os pontos mais próximos do escopo são:

- `packages/adapter-supabase/src/legacy-supabase-adapter.ts`: cria/edita/duplica produto e specs;
- `packages/core/src/use-cases/duplicate-administrative-vehicle.ts`: duplica produto e ficha;
- `apps/web/src/server/{create,update,duplicate}-admin-product.ts`: orquestra Server Actions;
- `apps/web/src/app/admin/products/**`: páginas/actions de produto e ficha;
- `packages/core/test/administrative-product-duplication.test.ts`: verifica explicitamente que a
  porta não expõe cópia de preços.

Esses arquivos leem ou escrevem `products`, mas **não leem nem escrevem preços/políticas**. A
duplicação vigente deliberadamente não copia histórico comercial.

### 5.3 Appsmith histórico

Os três snapshots abaixo contêm as mesmas leituras de preço na página `Análise de Valor`:

- `appsmith/exports/Compra Car App MVP.json`;
- `appsmith/exports/Compra Car App MVP 20260722 (Start session) .json`;
- `appsmith/exports/Compra Car App MVP 20260722 (End session) .json`.

Actions relevantes:

| Action | Leitura | Uso |
| --- | --- | --- |
| `get_product_value` | `SELECT * FROM vw_product_value_current WHERE product_id = ...` | Exibe preço e valor percebido. |
| `get_model_score` | `vw_product_value_current.public_price` | Cria faixa de preço de ±5% e calcula score. |
| `get_category_scores` | Duas views de valor | Compara categorias dentro da faixa de preço. |

Não foi encontrada action Appsmith que insira, atualize ou exclua preço/política. `Admin Modelos`
escreve somente `products` e chama `duplicate_product_simple`, que não copia preço.

### 5.4 Artefatos de banco e inspeção

- `supabase/migrations/20260724233325_legacy_baseline.sql`: definição estrutural e funções legadas;
- `supabase/admin-inspection/{01..10,14_price_model_validation.sql}`: inventário e validação
  somente leitura;
- `Legacy/supabase/migrations/0001_initial_schema.sql`: modelo histórico divergente, somente
  referência; não é a fonte do runtime atual.

## 6. Fluxo do preço até o comparador

### 6.1 Comparador MVP-u atual

**Não existe fluxo de preço.** O comparador público chega aos specs, não ao preço. Assim, não há
tabela de origem, coluna, adapter, repository, use case, query, fallback, regra para zero ou vigência
de preço implementados no MVP-u.

### 6.2 Análise de Valor histórica do Appsmith

```text
product_price_offers.public_price
  -> CTE latest_price de vw_product_value_current
       (DISTINCT ON product_id, ORDER BY created_at DESC)
  -> query PostgreSQL direta do Appsmith
  -> get_product_value / get_model_score / get_category_scores
  -> widgets da página Análise de Valor
```

- adapter: nenhum;
- repository: nenhum;
- use case: nenhum;
- fallback: nenhum;
- preço nulo: excluído dentro da view;
- preço zero: aceito pela view; gera faixa `0..0`; somente a divisão pelo benchmark usa `NULLIF`;
- vigência: inexistente; `offer_month` não participa da escolha;
- publicação: a view não filtra `is_public`, e os seletores Appsmith filtram apenas `is_active`.

## 7. Problemas encontrados

1. MSRP e política comercial compartilham a mesma identidade de linha.
2. A view “current” usa timestamp técnico empatado em vez da referência de negócio.
3. Não há vigência completa, moeda, timezone, canal, região ou concessionária.
4. `is_active` não diferencia histórico de vigência: todas as linhas estão ativas.
5. Preço zero e benefício total negativo não são barrados nem classificados.
6. Não há identidade de política alternativa nem semântica estruturada para condições `E`/`OU`.
7. Totais armazenados não têm fórmula, origem ou reconciliação garantida.
8. Não há auditoria, revisão, versionamento otimista ou ator da mudança.
9. Importação, staging e tabela final não formam um workflow rastreável.
10. RLS ausente e grants `ALL` são incompatíveis com um CRUD administrativo seguro.
11. FKs e consultas temporais carecem de índices de suporte.
12. Views e função de duplicação são consumidores legados que podem quebrar com substituição direta.
13. O contrato do MVP-u ainda não possui conceitos de preço/política, logo não basta adicionar UI.

## 8. Lacunas para CRUD

- contratos de entrada/saída e value objects de dinheiro, moeda e período;
- repository administrativo dedicado, sem expor nomes legados ao core/UI;
- casos de uso de listar grade, criar revisão, editar rascunho, publicar/encerrar e reler;
- chave de negócio e política de concorrência/idempotência;
- validações de valores, percentuais, parcelas, datas e totais;
- regra explícita para zero, nulo, negativo e desconhecido;
- seleção determinística de MSRP por instante e contexto;
- seleção de uma ou várias políticas alternativas;
- autorização admin server-side e hardening de RLS/grants;
- auditoria de ator, timestamps e origem;
- invalidação de cache do catálogo/comparador;
- transação para operações em grade e tratamento de falha parcial;
- estratégia de backfill, reconciliação e rollback;
- testes unitários, integração opt-in e SQL de integridade somente leitura;
- apresentação e formatação BRL sem confundir armazenamento e locale.

## 9. Opções de modelagem

### Opção A — reutilizar `product_price_offers` sem migration

Adicionar portas e CRUD sobre a tabela atual. É a opção de menor esforço inicial, mas preserva a
ambiguidade entre MSRP/política, não resolve concorrência, vigência, alternativas ou segurança. Uma
constraint produto/mês destruiria um caso de negócio já observado.

**Avaliação:** aceitável apenas para uma ferramenta temporária de correção do legado, não como
contrato definitivo da Sprint 9.

### Opção B — separar MSRP e ofertas comerciais incrementalmente

Implementar o modelo alvo do ADR-009:

- `product_msrp_history`: produto, valor, moeda, início/fim de vigência, estado, origem e auditoria;
- `commercial_offers`: produto, identidade/título, período, estado, prioridade/contexto, componentes
  inicialmente estruturados, totais derivados/auditáveis, origem e auditoria;
- `commercial_offer_components` somente quando a variabilidade real justificar normalização E/OU;
- views/queries v2 determinísticas e adapters separados;
- legado preservado para leitura, backfill e compatibilidade durante a transição.

**Avaliação:** melhor equilíbrio entre correção semântica, evolução e reversibilidade.

### Opção C — modelo totalmente componentizado desde o início

Criar campanhas, ofertas, grupos lógicos e componentes tipados com regras E/OU, elegibilidade e
escopos regionais/canais completos.

**Avaliação:** expressivo, porém arriscado antes das respostas de negócio; amplia migração, UI e
validação sem evidência suficiente.

## 10. Recomendação

Adotar a **Opção B por migration incremental, forward-only**, preservando integralmente o legado.

Sequência recomendada:

1. fechar decisões de negócio bloqueantes listadas abaixo;
2. definir contratos do core e um ADR complementar apenas se o desenho detalhado mudar o ADR-009;
3. criar novas tabelas/constraints/índices/RLS e uma view determinística sem alterar a view legada;
4. implementar leitura administrativa e reconciliação antes de autorizar escrita;
5. preparar backfill idempotente com relatório de divergências, sem apagar a origem;
6. implementar CRUD em grade e auditoria;
7. migrar consumidores de forma explícita: primeiro MVP-a, depois eventual preço no MVP-u;
8. aposentar objetos legados somente em sprint futura e após inventário de consumidores.

Não corrigir `vw_product_value_current` isoladamente. Apesar de defeituosa, ela alimenta o Appsmith
histórico, e trocar apenas `created_at` por `offer_month` ainda descartaria políticas alternativas.

## 11. Riscos de compatibilidade

- alteração direta da view muda a faixa ±5% e scores do Appsmith;
- mudança de `public_price` zero/nulo pode remover produtos silenciosamente da análise;
- unique produto/mês conflita com as ofertas 12/37 e 13/38;
- cópia por `duplicate_product_model_year` pode perpetuar ou perder política arbitrariamente;
- endurecer grants antes de migrar clients pode interromper Appsmith e adapter server-only;
- backfill pode interpretar linha base e linha de política incorretamente;
- totais históricos podem não ser reproduzíveis sem fórmula de negócio;
- introduzir vigência pode deixar todos os produtos sem preço “atual” na data presente;
- expor política no MVP-u pode divulgar informação comercial restrita;
- cache de 300 segundos do comparador exigirá invalidação se preço entrar no contrato;
- migration que edite a baseline viola a estratégia forward-only já adotada.

## 12. Perguntas de negócio pendentes

1. MSRP é sempre BRL? Pode haver outra moeda ou preço com impostos diferentes?
2. `offer_month` representa mês-calendário inteiro ou apenas uma etiqueta de carta?
3. Quais regras definem `valid_from`/`valid_to`, inclusividade e timezone?
4. Um produto pode ter mais de um MSRP no mesmo instante? Como resolver revisão retroativa?
5. Quais políticas são alternativas e quais benefícios são cumulativos?
6. `ipva_included = true` em 714 linhas é dado real ou artefato de importação/default?
7. O que significa `total_customer_benefit = -100`?
8. Zero significa preço válido, indisponível, não informado ou erro de carga?
9. Quais componentes entram no benefício total e no preço transacional?
10. Totais devem ser calculados, armazenados como snapshot auditável ou ambos?
11. Política se aplica por produto, marca, campanha, canal, região ou concessionária?
12. Pode haver política sem MSRP e MSRP sem política?
13. Quais estados existem: rascunho, em revisão, publicada, encerrada, cancelada?
14. Quem pode criar, revisar, publicar, retroagir e encerrar preços/políticas?
15. O vendedor pode ver políticas internas? Quais campos podem chegar ao MVP-u?
16. Como tratar cartas pendentes de maio/junho de 2026 e as 173 linhas sem produto?
17. A função histórica de duplicação que copia preço ainda tem consumidor externo?
18. Qual regra de arredondamento e precisão vale para moeda, taxa e percentuais?

## 13. Proposta de divisão da Sprint 9

1. **S9.1 — Decisões de negócio:** workshop e critérios de aceite para vigência, zero, moeda,
   alternativas E/OU, totais, estados e autorização.
2. **S9.2 — Contratos e desenho detalhado:** entidades/value objects, portas, DTOs, matriz de
   compatibilidade e plano de rollout/backfill.
3. **S9.3 — Migration incremental:** novas tabelas, constraints, índices, RLS/policies, grants e
   testes SQL, sem alterar baseline ou legado.
4. **S9.4 — Backfill e reconciliação:** transformação idempotente, classificação das duplicidades,
   relatório de preço zero/benefício negativo e validação de contagens.
5. **S9.5 — Leitura administrativa:** repository/adapter e grade read-only com filtros de período,
   estado e produto.
6. **S9.6 — Escrita administrativa:** criar/editar/publicar/encerrar em transação, autorização,
   concorrência, auditoria e releitura pós-gravação.
7. **S9.7 — Políticas comerciais:** alternativas, componentes confirmados, totais e validações.
8. **S9.8 — Integração com comparadores:** primeiro comparador administrativo; MVP-u apenas após
   decisão de exposição e contrato público.
9. **S9.9 — Importação assistida:** vincular import/rows/staging ao workflow revisado; manter revisão
   humana obrigatória.
10. **S9.10 — Compatibilidade e operação:** migração de consumidores, observabilidade, cache,
    rollback, documentação e eventual plano de aposentadoria do legado.

## 14. Confirmação de não alteração do banco

Durante esta investigação foram executadas apenas leituras de arquivos, buscas no repositório,
auditorias locais e requisições Supabase `SELECT`/contagem. **Nenhuma alteração de banco foi
executada**: não houve migration aplicada, DDL, insert, update, delete, upsert, RPC de negócio,
alteração de RLS/grants ou carga de dados.
