# Reconciliação do baseline legado

## Resultado

O dump schema-only remoto confirmou a estrutura geral documentada, mas acrescentou detalhes físicos indispensáveis para um baseline fiel. Nenhuma migration definitiva foi criada.

## Confirmações da documentação anterior

- as 19 tabelas documentadas existem;
- as quatro views documentadas existem;
- as cinco assinaturas de functions correspondem aos quatro nomes registrados;
- não existem triggers próprios;
- RLS está habilitado apenas em `product_specs_matrix_staging`, sem policy;
- não existem policies;
- `product_specs.product_id` continua sem FK para `products.id`;
- `product_specs.equipment_id` referencia `specs.id`;
- `unique_product` é índice único, não unique constraint;
- grants para roles públicas e autenticadas são amplos;
- IDs misturam `integer` e `bigint`;
- o nome legado `equipments` permanece em sequence e constraints de `specs`.

## Novos detalhes autoritativos

1. Existe o schema customizado vazio `cc_v2`.
2. Há nove extensões instaladas, inclusive `unaccent`, da qual `normalize_text` depende.
3. O schema `public` não possui enums ou domains próprios.
4. Existem exatamente 13 sequences.
5. Existem 36 constraints e 24 índices, todos os índices retornados válidos e prontos.
6. Todas as 23 relações próprias concedem todos os privilégios de tabela a `anon`, `authenticated` e `service_role`.
7. As cinco functions próprias mantêm execução por `PUBLIC` e pelas três roles do Supabase.
8. Default privileges de `postgres` e `supabase_admin` perpetuam grants amplos em `public`.
9. Não existem FKs de `public` para schemas externos.
10. Não há tabela `public` em publication retornada pela consulta.
11. As views não usam `security_invoker=true`.
12. Functions próprias não fixam `search_path`; as funções de duplicação fazem DML como invoker.
13. Os objetos da Sprint 2.1 ainda não existem no remoto.

## Diferenças quantitativas não conclusivas

As estimativas atuais do planejador mostram 287 `products` e 37.116 `product_specs`, enquanto a documentação anterior contém contagens exatas de 288 e 37.251. Estimativas de `pg_class` podem estar defasadas e não substituem `count(*)`; isso não é evidência suficiente de exclusão ou drift de dados.

Nenhuma contagem exata ou linha de negócio foi consultada nesta etapa.

## Classificação A–E

### A. Baseline necessário

- schema `public` e seus 13 objetos principais não staging;
- quatro views vigentes, preservadas mesmo quando a semântica exige revisão futura;
- 13 sequences e respectivos vínculos;
- 36 constraints e 24 índices;
- functions `normalize_text` e `contains_all_tokens`;
- extensão `unaccent`, necessária a `normalize_text`;
- owners, RLS, ausência de policies, grants e default privileges vigentes;
- comentários sanitizados e dependências próprias confirmadas.

O baseline deve preservar o estado, não corrigir grants ou views.

### B. Gerenciado pelo Supabase

- schemas `auth`, `cron`, `extensions`, `graphql`, `graphql_public`, `net`, `pgbouncer`, `realtime`, `storage`, `supabase_migrations` e `vault`;
- extensões `pg_cron`, `pg_net`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault` e `uuid-ossp`;
- roles, objetos internos e migrations da plataforma.

Esses objetos não serão recriados manualmente.

### C. Dados estruturais candidatos

- catálogo de 320 linhas de `specs`;
- conteúdo de `unit_conversions`, se houver e se for referência fixa;
- referências de `fipe_reference_months`, somente se funcionarem como configuração e não histórico externo;
- outros catálogos pequenos que sejam pré-requisito real de migrations.

`specs` é o candidato crítico porque a migration `20260719150000` exige `CO_0043` antes de executar.

### D. Objetos duvidosos

- schema vazio `cc_v2`;
- `products_active_backup`;
- `price_offers_staging`;
- `registrations_staging`;
- `product_specs_matrix_staging`;
- `specs_category_staging`;
- `specs_import_staging`;
- `duplicate_product_model_year`;
- as duas sobrecargas de `duplicate_product_simple`;
- extensão `pg_trgm`, instalada em `public` sem dependência própria identificada no DDL.

Objetos D devem permanecer no snapshot bruto. Excluí-los do baseline exige decisão documentada e confirmação de consumidores, especialmente Appsmith e processos de importação.

### E. Posterior ao baseline

- `public.app_role`;
- `public.user_status`;
- `public.profiles`;
- functions, triggers, policies e grants da migration `20260721222256_create_auth_profiles.sql`.

Nenhum objeto E estava presente no remoto. Eles devem continuar pertencendo exclusivamente à migration da Sprint 2.1.

## Reconciliações pendentes

1. Confirmar o propósito e consumidor de `cc_v2`.
2. Identificar qual sobrecarga de `duplicate_product_simple` o Appsmith usa.
3. Confirmar consumidores das tabelas staging e backup.
4. Decidir se `pg_trgm` integra o baseline por uso externo ao DDL.
5. Autorizar a consulta estrutural de `specs` e revisar o resultado antes de versioná-lo.
6. Definir como representar o valor pré-correção de `CO_0043` sem fabricar dados.
7. Separar reprodução fiel de grants do hardening posterior.
8. Testar futuramente o baseline em sandbox local e comparar fingerprints com estes inventários.

## Conclusão

O DDL remoto é suficiente para preparar uma proposta de migration, mas não para finalizá-la: a dependência de dados em `specs` e os objetos D ainda exigem decisões e nova autorização. Até lá, o dump bruto e os resultados permanecem fora do Git e nenhuma alteração de banco está autorizada.
