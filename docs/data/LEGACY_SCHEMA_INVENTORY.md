# Inventário do schema legado para baseline

## Status

- **Data da revisão inicial local:** 2026-07-21
- **Atualização:** extração remota schema-only e de metadados concluída em 2026-07-21
- **Objetivo:** separar o inventário inicial dos resultados autoritativos necessários ao baseline

Este documento preserva o inventário inicial. Os resultados autoritativos da extração estão em `LEGACY_BASELINE_EXTRACTION_RESULTS.md`, e a comparação com as hipóteses anteriores está em `LEGACY_BASELINE_RECONCILIATION.md`.

## Histórico versionado de migrations

| Ordem atual | Migration | Papel |
| --- | --- | --- |
| 1 | `20260719150000_set_power_windows_positive_direction.sql` | Correção de dados em `public.specs`; exige a tabela e a spec numeric `CO_0043` preexistentes. |
| 2 | `20260721222256_create_auth_profiles.sql` | Fundação de autenticação da Sprint 2.1; depende dos objetos gerenciados `auth.users` e das roles do Supabase. |

Não existe migration versionada que crie o schema legado antes da primeira linha dessa sequência. Em um banco vazio, a migration de `20260719150000` falha porque `public.specs` — e também o registro `CO_0043` — ainda não existem.

## Fontes locais de evidência

- `docs/data/SUPABASE_INSPECTION_RESULTS.md`: inventário e achados consolidados da inspeção anterior;
- `docs/data/LEGACY_SUPABASE_MAP.md`: superfície física usada pelo adapter;
- `supabase/admin-inspection/01_objects.sql` a `10_row_estimates.sql`: inventários de metadados;
- `supabase/admin-inspection/11_product_specs_integrity.sql` a `15_public_catalog_validation.sql`: validações de dados já documentadas;
- `supabase/inspection/01_schema_inventory.sql` a `04_candidate_data_profile.sql`: consultas genéricas somente leitura;
- `packages/adapter-supabase`: projeções físicas confirmadas para o MVP;
- `Legacy/supabase/migrations/0001_initial_schema.sql`: hipótese histórica protegida, não fonte de verdade atual.

Não foi localizado dump, export, snapshot ou fixture com o DDL vigente. `data/fixtures/.gitkeep` é apenas um placeholder.

## Objetos legados documentados

### Tabelas principais do schema `public`

- `products`;
- `product_specs`;
- `specs`;
- `product_price_offers`;
- `product_fipe_map`;
- `product_fipe_values`;
- `fipe_reference_values`;
- `fipe_reference_months`;
- `fipe_vehicle_models`;
- `registrations`;
- `unit_conversions`;
- `price_offer_imports`;
- `price_offer_import_rows`.

### Tabelas auxiliares, staging ou backup

- `products_active_backup`;
- `price_offers_staging`;
- `registrations_staging`;
- `product_specs_matrix_staging`;
- `specs_category_staging`;
- `specs_import_staging`.

Esses objetos fazem parte do inventário observado, mas seu uso atual é **PENDENTE**. Não podem ser omitidos do baseline apenas pelo nome; primeiro é necessário identificar consumidores e dependências.

### Views

- `vw_product_value_current`;
- `vw_product_value_by_category`;
- `vw_product_fipe_candidates`;
- `vw_product_fipe_review`.

Não há materialized view própria documentada, mas a ausência precisa ser reconfirmada no snapshot.

### Functions próprias

- `contains_all_tokens`;
- `normalize_text`;
- `duplicate_product_model_year`;
- duas sobrecargas de `duplicate_product_simple`.

As assinaturas exatas, owners, `search_path`, grants e corpos precisam ser recapturados. A ocorrência de `duplicate_product_simple` no Appsmith é evidência de possível consumo, não confirmação da sobrecarga utilizada.

### Triggers, RLS e grants

- nenhum trigger de aplicação legado foi encontrado na inspeção anterior;
- RLS estava desativado em praticamente todas as tabelas;
- `product_specs_matrix_staging` tinha RLS habilitado sem policy;
- nenhuma policy foi encontrada;
- `anon` e `authenticated` possuíam grants amplos em objetos centrais;
- functions mutáveis estavam executáveis por `PUBLIC`, `anon` e `authenticated`.

Esse estado é inseguro, mas o baseline deve reproduzir com fidelidade o estado auditado. Hardening pertence a migration posterior e não pode ser embutido silenciosamente no baseline.

## Superfície física confirmada pelo adapter

### `public.products`

Colunas consumidas: `id`, `brand`, `model`, `version`, `model_year`, `production_year`, `is_active` e `is_public`.

O índice único `unique_product` cobre `(brand, model, version, model_year, production_year)`. A adequação dessa combinação como identidade definitiva ainda depende de validação de negócio.

### `public.specs`

Colunas consumidas: `id`, `code`, `type`, `group_name`, `equipment_group`, `spec_set`, `detail`, `unit`, `value_direction` e `is_active`.

Foram documentadas 320 linhas: 171 `binary`, 90 `scale` e 59 `numeric`, sem `code` nulo, vazio ou duplicado. Esse conteúdo pode ser dado estrutural necessário ao rebuild, mas ainda precisa de classificação explícita.

### `public.product_specs`

Colunas consumidas: `product_id`, `equipment_id`, `value`, `is_present` e `input_unit`.

Há unicidade em `(product_id, equipment_id)` e FK de `equipment_id` para `specs.id`. Não foi identificada FK física de `product_id` para `products.id`; o vínculo é lógico e não há evidência de órfãos no resultado documentado.

## Relações conhecidas

- `products` é o agregado central;
- `product_specs`, `product_price_offers`, `registrations`, `product_fipe_map` e `product_fipe_values` relacionam-se com `products` por FK ou vínculo conceitual;
- `product_specs.equipment_id` referencia `specs.id`;
- `price_offer_import_rows` relaciona-se com `price_offer_imports` e pode apontar para `products`;
- entidades FIPE possuem índices e relações próprias, ainda sem definições completas versionadas.

As ações `ON DELETE`/`ON UPDATE`, nulabilidade, deferrability e nomes de todas as FKs permanecem **PENDENTE** de recaptura.

## Volumes e semântica já documentados

| Relação | Evidência de volume |
| --- | ---: |
| `products` | 288 |
| `specs` | 320 |
| `product_specs` | 37.251 |
| `product_price_offers` | 746 |
| `registrations` | aproximadamente 25 mil |
| `fipe_vehicle_models` | aproximadamente 55 mil |

Esses volumes orientam validação, mas não autorizam incluir dados de negócio no baseline. Dados pessoais, comerciais ou históricos exigem classificação e export separado.

## Artefato histórico em `Legacy`

`Legacy/supabase/migrations/0001_initial_schema.sql` cria um protótipo com `equipments`, `accounts`, `users`, billing e views `v_*`. Ele diverge do estado atual documentado, entre outros pontos, porque:

- usa `equipments` como tabela, enquanto o schema atual concentra metadados adicionais em `specs`;
- não contém `products.is_public`;
- usa `product_specs.spec_id`, enquanto o adapter atual usa `equipment_id`;
- restringe specs a `binary`/`numeric`, enquanto o banco atual contém também `scale`;
- usa nomes e estrutura de preço diferentes;
- contém objetos de contas e cobrança que não aparecem no inventário atual;
- não contém os objetos FIPE e de importação atualmente documentados.

Portanto, o arquivo é somente **HIPÓTESE HISTÓRICA**. Ele não será copiado, alterado nem usado como migration baseline.

## Configuração e vínculo local

- `supabase/config.toml` contém apenas configuração da stack local;
- `supabase/.temp` existe e está ignorado pelo Git;
- há `project-ref` local e `linked-project.json`, com valores deliberadamente ocultados;
- o clone está localmente linked;
- existem nomes de variáveis de processo para URL e credencial do Supabase, mas seus valores não foram lidos nem exibidos;
- `.env.example` existe; nenhum arquivo `.env` real foi lido;
- não há credencial, project ref ou arquivo da sandbox staged ou versionado nesta inspeção.

## Lacunas bloqueantes para o baseline

1. DDL autoritativo e atual de todas as tabelas e colunas.
2. Tipos exatos, collations, defaults, identities e generated columns.
3. PKs, FKs, uniques, checks, exclusion constraints e ações referenciais completas.
4. Índices completos, inclusive parciais, expressões e opções.
5. Sequences, tipos, limites, ownership e vínculos com colunas.
6. Definições atuais de views e dependências entre views/tabelas/functions.
7. Assinaturas e corpos exatos de functions, owners, segurança, volatilidade, `search_path` e grants.
8. Confirmação atual de triggers, RLS, FORCE RLS, policies e ACLs efetivas.
9. Extensões realmente usadas por objetos próprios e schemas onde foram instaladas.
10. Schemas customizados e dependências próprias em `auth`, `storage` ou `extensions`.
11. Objetos incluídos em publications, inclusive Realtime.
12. Classificação dos dados estruturais necessários antes de `20260719150000`.
13. Consumidores atuais de staging, backup e sobrecargas de functions.
14. Versão efetiva do PostgreSQL remoto usada para gerar o DDL.

Sem fechar essas lacunas, criar a migration definitiva seria uma reconstrução por inferência, não um baseline auditado.
