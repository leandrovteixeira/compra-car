# Resultados da extração do baseline legado

## Status da extração

- **Data:** 2026-07-21
- **Fonte:** projeto Supabase remoto já linked
- **Modo:** dump schema-only e consultas somente leitura de metadados
- **PostgreSQL remoto:** `17.6` (`server_version_num = 170006`)
- **Supabase CLI:** `2.109.1`
- **Docker local:** `29.6.1`
- **Branch:** `main`

Nenhum DDL, DML, migration ou comando de alteração foi executado. Nenhuma linha de `public.specs` ou de outra tabela de negócio foi consultada nesta etapa.

## Dump bruto

Comando executado:

```powershell
pnpm dlx supabase db dump --linked --schema public --keep-comments --file C:\Dev\compra-car-baseline-work\01_public_schema.sql
```

Resultado:

- arquivo: `C:\Dev\compra-car-baseline-work\01_public_schema.sql`;
- tamanho: 66.091 bytes;
- linhas: 2.171;
- SHA-256: `B8B3402F0C2535F8F4E6B9192BAE210F18A7429910094EEB1E38D30A299A6D06`;
- localização: fora do repositório e do Git;
- estado: bruto, sem edição.

## Varredura de segurança

Não foram detectados no dump:

- URLs;
- project refs;
- e-mails;
- JWTs;
- access tokens;
- chaves service-role;
- passwords;
- connection strings.

Foram encontrados:

- 48 marcadores textuais de `service_role`, todos associados a ACLs/grants;
- um comentário, pertencente ao schema padrão `public`;
- cinco corpos de function, correspondentes a quatro nomes e duas sobrecargas;
- nove literals SQL nos corpos das functions, sem padrão de segredo, URL, e-mail ou conexão.

Os corpos não são reproduzidos nesta documentação. Eles contêm lógica mutável de duplicação de produto e lógica de normalização textual, devendo ser tratados como conteúdo interno durante a revisão do baseline.

## Método das consultas de metadados

Foi usada a Management API da CLI, sem `--db-url`:

```powershell
pnpm dlx supabase db query --linked --file <script.sql> --output csv
```

Resultados brutos foram gravados separadamente em `C:\Dev\compra-car-baseline-work\inspection-results`.

O script `05_baseline_readiness.sql` possui dez `SELECT`s. A CLI retornou apenas um result set quando o arquivo completo foi executado. Para preservar todos os resultados sem desativar a proteção do modo agente, os dez statements já auditados foram copiados exatamente para arquivos de trabalho fora do Git e executados individualmente com `--file`. Nenhuma consulta nova foi introduzida.

## Scripts executados

Executados com sucesso:

- `supabase/admin-inspection/01_objects.sql`;
- `supabase/admin-inspection/02_columns.sql`;
- `supabase/admin-inspection/03_constraints.sql`;
- `supabase/admin-inspection/04_indexes.sql`;
- `supabase/admin-inspection/10_row_estimates.sql`;
- `supabase/inspection/05_baseline_readiness.sql`;
- os dez `SELECT`s exatos de `05_baseline_readiness.sql`, individualmente, para preservar cada result set.

Não executados porque os caminhos autorizados não existem no repositório:

- `supabase/admin-inspection/05_functions.sql`;
- `supabase/admin-inspection/06_triggers.sql`;
- `supabase/admin-inspection/07_rls_policies.sql`;
- `supabase/admin-inspection/08_grants.sql`;
- `supabase/admin-inspection/09_dependencies.sql`.

Os arquivos atuais com numeração diferente não foram usados como substitutos silenciosos. Functions, triggers, RLS e grants foram analisados a partir do dump schema-only e das consultas autorizadas de prontidão.

## Schemas encontrados

| Schema | Classificação inicial | Observação |
| --- | --- | --- |
| `public` | A | Schema dos objetos próprios do legado. |
| `cc_v2` | D | Schema customizado vazio no inventário de relações; finalidade pendente. |
| `auth` | B | Gerenciado pelo Supabase. |
| `cron` | B | Gerenciado pela extensão/plataforma. |
| `extensions` | B | Extensões gerenciadas. |
| `graphql` | B | Gerenciado pelo Supabase. |
| `graphql_public` | B | Gerenciado pelo Supabase. |
| `net` | B | Gerenciado pela extensão/plataforma. |
| `pgbouncer` | B | Infraestrutura gerenciada. |
| `realtime` | B | Gerenciado pelo Supabase. |
| `storage` | B | Gerenciado pelo Supabase. |
| `supabase_migrations` | B | Histórico interno da plataforma. |
| `vault` | B | Gerenciado pelo Supabase. |

Não foi encontrado objeto relacional no schema `cc_v2`, mas a existência do schema deve ser reconciliada antes de decidir se integra o baseline.

## Extensões instaladas

| Extensão | Versão | Schema | Classificação inicial |
| --- | --- | --- | --- |
| `pg_cron` | `1.6.4` | `pg_catalog` | B |
| `pg_net` | `0.20.0` | `public` | B |
| `pg_stat_statements` | `1.11` | `extensions` | B |
| `pg_trgm` | `1.6` | `public` | D — instalada, sem dependência própria identificada no DDL |
| `pgcrypto` | `1.3` | `extensions` | B |
| `plpgsql` | `1.0` | `pg_catalog` | B |
| `supabase_vault` | `0.3.1` | `vault` | B |
| `unaccent` | `1.1` | `public` | A — chamada por `normalize_text` |
| `uuid-ossp` | `1.1` | `extensions` | B |

O dump restrito a `public` não emitiu `CREATE EXTENSION`. A migration baseline deverá declarar ou validar somente dependências próprias necessárias, sem recriar objetos internos das extensões.

## Inventário autoritativo do schema `public`

Foram encontrados 36 objetos relacionais, todos com owner `postgres`:

- 19 tabelas;
- 13 sequences;
- 4 views;
- nenhuma materialized view.

### Tabelas

| Tabela | Colunas | Estimativa do planejador | Classificação |
| --- | ---: | ---: | --- |
| `fipe_reference_months` | 5 | 0 | A/C |
| `fipe_reference_values` | 17 | 878 | A |
| `fipe_vehicle_models` | 14 | 55.271 | A |
| `price_offer_import_rows` | 23 | 173 | A |
| `price_offer_imports` | 8 | 0 | A |
| `price_offers_staging` | 20 | 746 | D |
| `product_fipe_map` | 15 | 0 | A |
| `product_fipe_values` | 18 | 0 | A |
| `product_price_offers` | 21 | 746 | A |
| `product_specs` | 7 | 37.116 | A |
| `product_specs_matrix_staging` | 299 | 276 | D |
| `products` | 12 | 287 | A |
| `products_active_backup` | 2 | 287 | D |
| `registrations` | 14 | 25.453 | A |
| `registrations_staging` | 16 | 25.424 | D |
| `specs` | 17 | 320 | A/C |
| `specs_category_staging` | 2 | 320 | D |
| `specs_import_staging` | 15 | 320 | D |
| `unit_conversions` | 5 | 0 | A/C |

As quantidades acima são estimativas, não contagens atuais. Diferenças em relação às contagens exatas históricas não comprovam mudança de dados.

### Views

- `vw_product_fipe_candidates`;
- `vw_product_fipe_review`;
- `vw_product_value_by_category`;
- `vw_product_value_current`.

Todas pertencem a `postgres`, são views comuns e não possuem `security_invoker=true`. As definições completas permaneceram apenas nos artefatos brutos.

### Functions próprias e assinaturas

- `contains_all_tokens(haystack text, needle text) returns boolean` — SQL, immutable, invoker;
- `normalize_text(input text) returns text` — SQL, immutable, invoker;
- `duplicate_product_model_year(source_product_id bigint, new_model_year integer, new_production_year integer, make_active boolean default true) returns bigint` — PL/pgSQL, volatile, invoker;
- `duplicate_product_simple(source_product_id integer, new_model_year smallint, new_production_year smallint, make_active boolean default true) returns integer` — PL/pgSQL, volatile, invoker;
- `duplicate_product_simple(source_product_id bigint, new_model_year integer, new_production_year integer, make_active boolean default true) returns bigint` — PL/pgSQL, volatile, invoker.

Todas pertencem a `postgres`. Nenhuma declara `SECURITY DEFINER` ou `SET search_path`. As três rotinas de duplicação fazem DML e foram classificadas como D até que os consumidores e a sobrecarga usada pelo Appsmith sejam confirmados.

### Triggers

Nenhum trigger próprio foi encontrado no dump.

### Tipos, domains e enums

Não há type, domain ou enum próprio no schema `public`. Os enums encontrados pertencem a schemas gerenciados, principalmente `auth`, `realtime` e `storage`.

Os objetos `public.app_role`, `public.user_status` e `public.profiles` da Sprint 2.1 não existem no remoto inspecionado e pertencem à categoria E.

### Sequences

- `equipments_id_seq` → `specs.id`;
- `fipe_reference_months_id_seq` → identity de `fipe_reference_months.id`;
- `fipe_reference_values_id_seq` → `fipe_reference_values.id`;
- `fipe_vehicle_models_id_seq` → identity de `fipe_vehicle_models.id`;
- `price_offer_import_rows_id_seq` → `price_offer_import_rows.id`;
- `price_offer_imports_id_seq` → `price_offer_imports.id`;
- `product_fipe_map_id_seq` → identity de `product_fipe_map.id`;
- `product_fipe_values_id_seq` → identity de `product_fipe_values.id`;
- `product_price_offers_id_seq` → `product_price_offers.id`;
- `product_specs_id_seq` → `product_specs.id`;
- `products_id_seq` → `products.id`;
- `registrations_id_seq` → `registrations.id`;
- `unit_conversions_id_seq` → `unit_conversions.id`.

O nome legado `equipments_id_seq` continua associado a `specs.id` e deve ser preservado no baseline.

### Constraints e índices

Foram encontradas 36 constraints:

- 15 primary keys;
- 10 foreign keys;
- 8 uniques;
- 3 checks.

Há 24 índices, todos válidos, prontos e únicos:

- 15 índices de PK;
- 8 índices de unique constraints;
- `unique_product`, índice único independente em `(brand, model, version, model_year, production_year)`.

`product_specs.product_id` continua sem FK para `products.id`. Todas as dez FKs encontradas têm origem e destino em `public`; não existe FK de `public` para schema externo.

### RLS e policies

- `product_specs_matrix_staging`: RLS habilitado, sem policy;
- demais tabelas: RLS desabilitado;
- nenhuma policy encontrada;
- FORCE RLS não foi encontrado.

### Grants e default privileges

As 23 relações `public` — 19 tabelas e 4 views — concedem a `anon`, `authenticated` e `service_role` todos os privilégios de tabela disponíveis: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` e `TRIGGER`.

As 13 sequences concedem privilégios às mesmas três roles. Todas as 17 colunas de `specs` possuem `SELECT`, `INSERT`, `UPDATE` e `REFERENCES` efetivos para `anon`, `authenticated` e `service_role`.

As cinco functions próprias possuem execução para `PUBLIC`, `anon`, `authenticated` e `service_role`. Default privileges de `postgres` e `supabase_admin` no schema `public` também mencionam `anon`, `authenticated` e `service_role` para relations, sequences e functions.

Esse estado confirma o risco crítico anterior. O baseline deve reproduzir fielmente o estado auditado; hardening deve ocorrer em migration posterior, depois do mapeamento dos consumidores.

### Publications

Nenhuma tabela `public` apareceu em publication e nenhuma publication `FOR ALL TABLES` foi retornada pela consulta autorizada.

## Definição física completa de `public.specs`

### Colunas

| # | Coluna | Tipo | Null | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `bigint` | não | `nextval('equipments_id_seq'::regclass)` |
| 2 | `group_name` | `varchar(100)` | não | — |
| 3 | `equipment_group` | `varchar(150)` | não | — |
| 4 | `spec_set` | `varchar(150)` | não | — |
| 5 | `detail` | `varchar(200)` | não | — |
| 6 | `code` | `varchar(50)` | não | — |
| 7 | `type` | `varchar(20)` | não | — |
| 8 | `unit` | `varchar(30)` | sim | `NULL` |
| 9 | `value_direction` | `varchar(20)` | sim | `NULL` |
| 10 | `unit_perceived_value` | `numeric(14,2)` | não | `0` |
| 11 | `relative_value` | `numeric(14,2)` | não | `0` |
| 12 | `is_baseline` | `boolean` | sim | `false` |
| 13 | `notes` | `text` | sim | `NULL` |
| 14 | `is_active` | `boolean` | não | `true` |
| 15 | `created_at` | `timestamp without time zone` | não | `CURRENT_TIMESTAMP` |
| 16 | `updated_at` | `timestamp without time zone` | não | `CURRENT_TIMESTAMP` |
| 17 | `commercial_category` | `text` | sim | `NULL` |

Nenhuma coluna é identity ou generated.

### Constraints e índices

- PK `equipments_pkey (id)`;
- unique `uq_equipments_code (code)`;
- unique `uq_equipments_structure (group_name, equipment_group, spec_set, detail)`;
- check `chk_type`: permite `numeric`, `binary` e `scale`;
- check `chk_value_direction`: permite `NULL`, `Positive` ou `Negative`;
- três índices btree únicos correspondentes à PK e às duas unique constraints;
- nenhuma FK de saída;
- `product_specs_spec_id_fkey` referencia `specs.id` por `product_specs.equipment_id`.

### Sequence, owner, RLS e grants

- sequence `equipments_id_seq`, tipo `bigint`, `START 1`, incremento 1, sem cycle, owned by `specs.id`;
- owner da tabela e sequence: `postgres`;
- estimativa: 320 linhas; tamanho aproximado: 296 kB;
- RLS desabilitado e nenhuma policy;
- `anon`, `authenticated` e `service_role`: `ALL` na tabela e sequence;
- todas as 17 colunas têm `SELECT`, `INSERT`, `UPDATE` e `REFERENCES` efetivos para essas roles.

## Consulta futura proposta para o catálogo `specs`

Consulta ainda **não executada**:

```sql
select
    id,
    group_name,
    equipment_group,
    spec_set,
    detail,
    code,
    type,
    unit,
    value_direction,
    unit_perceived_value,
    relative_value,
    is_baseline,
    is_active,
    commercial_category
from public.specs
order by id;
```

Ela exclui `notes`, `created_at` e `updated_at` para minimizar conteúdo não estrutural. Antes de executá-la, ainda será necessário aprovar:

- que as 320 linhas constituem catálogo estrutural versionável;
- como registrar o estado prévio de `CO_0043` exigido pela migration seguinte;
- como preservar `id` e realinhar `equipments_id_seq` localmente;
- se algum dos três campos excluídos é necessário à compatibilidade real.

Nenhuma linha foi consultada nesta etapa.
