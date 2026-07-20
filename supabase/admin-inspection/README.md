# Inventario somente leitura do Supabase

Esta pasta contem consultas independentes para inventariar metadados do banco atual do Compra Car. Os scripts nao alteram o banco, nao consultam linhas de negocio e nao executam contagens exatas. O datasource do Appsmith atualmente possui acesso `READ_WRITE`, mas este inventario deve permanecer estritamente somente leitura.

`01_objects.sql` examina todos os schemas nao internos para permitir a descoberta dos schemas e objetos existentes. Os scripts `02_columns.sql` a `10_row_estimates.sql` examinam somente o schema `public`. Schemas proprios adicionais poderao ser incluidos nesses scripts depois da descoberta e da revisao dos resultados de `01_objects.sql`.

Objetos conhecidos que devem aparecer quando existirem no banco inspecionado:

- tabela `products`;
- views `vw_product_value_current` e `vw_product_value_by_category`;
- function `duplicate_product_simple`.

## Scripts

| Arquivo | Finalidade |
| --- | --- |
| `01_objects.sql` | Lista tabelas, tabelas particionadas, foreign tables, views, materialized views e sequences. |
| `02_columns.sql` | Lista colunas, tipos, nulabilidade, defaults, identity e colunas geradas. |
| `03_constraints.sql` | Lista primary keys, uniques, foreign keys e checks, incluindo definicao e tabela referenciada. |
| `04_indexes.sql` | Lista indices, metodo de acesso, estado e definicao. |
| `05_rls_policies.sql` | Lista o estado de RLS e as policies, com papeis e expressoes. |
| `06_grants.sql` | Lista privilegios sobre tabelas/views, functions e sequences e destaca roles usuais do Supabase. |
| `07_functions.sql` | Lista functions e procedures com assinatura, retorno, linguagem, seguranca, volatilidade e definicao, sem executa-las. |
| `08_triggers.sql` | Lista triggers, tabela, estado, eventos, function associada e definicao. |
| `09_sequences.sql` | Lista configuracoes de sequences e vinculos com colunas, sem consultar ou avancar valores atuais. |
| `10_row_estimates.sql` | Lista estimativas do planejador e tamanho aproximado das relacoes, sem ler dados nem executar `count(*)`. |

## Execucao individual no SQL Editor

1. Acesse o projeto correto no dashboard do Supabase e abra **SQL Editor**.
2. Abra localmente apenas o arquivo desejado e copie todo o seu conteudo.
3. Cole o conteudo em uma nova consulta no SQL Editor.
4. Confirme novamente que a consulta pertence a esta pasta e execute-a.
5. Repita o procedimento separadamente para cada inventario necessario.

Cada arquivo e independente. Nao e necessario executar os scripts em sequencia, e eles nao devem ser combinados com comandos de alteracao ou escrita.

## Exportacao em CSV

Depois que uma consulta terminar, use a opcao de download/exportacao em CSV do painel de resultados do SQL Editor. Salve cada resultado com um nome que permita relaciona-lo ao script e ao ambiente inspecionado. A interface do Supabase pode mudar; se o botao nao estiver visivel, procure a acao de download no painel de resultados.

Revise e sanitize todos os CSVs antes de adiciona-los ao Git. Em especial, expressoes de policies, constraints e indices e definicoes de functions e triggers podem revelar detalhes internos da autorizacao, do modelo ou da implementacao. Resultados nao devem ser commitados antes dessa revisao.

## Limites e seguranca

Este inventario nao autoriza qualquer alteracao de schema nem escrita no banco. Ele deve ser usado exclusivamente para inspecao de metadados e estimativas. Nao acrescente comandos de criacao, alteracao, remocao, permissao ou manipulacao de dados a estes arquivos.

Corpos de functions podem conter logica sensivel, senhas, tokens, chaves, connection strings, referencias internas ou valores que nao devem ser publicados. Como `07_functions.sql` inclui a definicao para fins de inspecao, seu resultado exige revisao e sanitizacao manual antes de ser salvo, compartilhado ou versionado. O inventario nao deve ser usado para divulgar segredos.

## Validações de dados

- `11_product_specs_integrity.sql`: valida referências órfãs, duplicidades e produtos sem specs;
- `12_products_business_key.sql`: valida a chave lógica, nulos, vazios, normalização e estados de publicação;
- `13_product_specs_semantics.sql`: valida tipos, `is_present`, values, codes e unidades;
- `14_price_model_validation.sql`: valida cobertura, histórico e relação com as views de preço;
- `15_public_catalog_validation.sql`: valida o funil real de elegibilidade pública e o impacto de `is_present = false`.

Execute cada script individualmente no SQL Editor. Salve ou copie integralmente os resultados de cada consulta para preservar as evidências da validação. Nenhum desses scripts altera o banco. Resultados de exemplo são limitados a 100 linhas e ordenados de forma determinística, mas as contagens são completas e não usam limite para esconder problemas.

### Resultados confirmados

- 288 produtos: 42 ativos e públicos; os 16 sem specs não são públicos;
- 320 specs, sem tipos fora do contrato e sem codes nulos, vazios ou duplicados;
- 37.251 associações com semântica compatível com o adaptador e nenhuma linha com `is_present = false`;
- todos os produtos públicos possuem itens comparáveis, entre 105 e 182 por produto;
- 746 políticas comerciais mensais para 287 produtos, cobrindo junho de 2025 a abril de 2026, com `offer_month` como referência de negócio;
- duas duplicidades de produto e mês: produto `12`, ofertas `12` e `37`, e produto `13`, ofertas `13` e `38`, ambas em junho de 2025;
- o produto público ID `750` é o único sem oferta;
- `vw_product_value_current` retorna 41 produtos pelos joins e filtros atuais, mas seleciona por `created_at`, sem garantir o maior `offer_month` ou desempate determinístico, e não filtra `is_public`.

Continuam pendentes o significado comercial das duplicidades de `product_id + offer_month`, a correção testada de `vw_product_value_current`, a action e assinatura de `duplicate_product_simple` no Appsmith, a validação da chave lógica de `products`, o uso de staging e o mapeamento de consumidores antes do hardening de RLS e grants.

### Regra de negócio de preços

`products.id` representa o MMV/MY/PY: marca, modelo, versão, ano-modelo e ano de produção. A tabela legada `product_price_offers` mistura MSRP e política comercial; por isso, não se recomenda `UNIQUE(product_id, offer_month)` nem corrigir a view apenas trocando `created_at` por `offer_month`.

O modelo futuro proposto separa `product_msrp_history` de `commercial_offers`. Um produto pode ter somente um MSRP vigente em um instante e múltiplas ofertas comerciais no mesmo período. Ofertas distintas são alternativas **OU**; benefícios dentro de uma oferta são cumulativos **E**. Campos estruturados podem permanecer diretamente em `commercial_offers` inicialmente, com `commercial_offer_components` introduzida apenas quando necessário. Uploads interpretados por IA devem usar staging, auditoria e revisão humana.

Esse redesenho não é obrigatório para o comparador MVP enquanto preços e políticas comerciais permanecerem fora do contrato público legado.
