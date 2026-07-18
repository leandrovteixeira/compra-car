# App Compra Car — protótipo local

Este pacote cria um protótipo local para validar as tabelas antes de construir o app mobile.

## Ferramentas

- **Supabase local**: banco Postgres + Studio + Auth local.
- **Appsmith local**: telas CRUD rápidas para operar o banco.

A documentação oficial do Supabase informa que o desenvolvimento local usa **Supabase CLI + Docker**. A documentação oficial do Appsmith mostra instalação local/self-hosted via Docker.

## Pré-requisitos

1. Instale o Docker Desktop.
2. Instale a Supabase CLI.
3. Tenha um terminal PowerShell, CMD ou Git Bash.

## Como rodar o banco local

Na pasta raiz deste projeto:

```bash
supabase init
supabase start
```

Depois rode a migração:

```bash
supabase db reset
```

O comando `db reset` aplica o arquivo:

```text
supabase/migrations/0001_initial_schema.sql
```

E carrega automaticamente:

```text
supabase/seed.sql
```

## Como abrir o Supabase Studio

Depois de `supabase start`, o terminal mostra as URLs locais.
Normalmente o Studio abre em algo como:

```text
http://127.0.0.1:54323
```

No Studio, valide estas tabelas:

- products
- equipments
- specs
- product_specs
- product_price_offers
- registrations
- accounts
- users
- account_users
- plans
- subscriptions
- payments
- audit_logs

E estas views:

- v_product_spec_values
- v_product_total_perceived_value
- v_price_offer_values
- v_registration_summary

## Como rodar Appsmith local

Entre na pasta `appsmith`:

```bash
cd appsmith

docker compose up -d
```

Abra:

```text
http://localhost:8080
```

Crie a conta admin local do Appsmith.

## Como conectar Appsmith ao Postgres local do Supabase

No Appsmith:

1. Vá em **Datasources**.
2. Escolha **PostgreSQL**.
3. Use os dados de conexão exibidos pelo `supabase start`.
4. Se o Appsmith estiver em Docker, o host pode precisar ser:

```text
host.docker.internal
```

Configuração típica:

```text
Host: host.docker.internal
Port: 54322
Database: postgres
Username: postgres
Password: postgres
```

Confirme os dados no output do comando `supabase start`, porque portas/senhas podem variar por instalação.

## Telas que recomendo montar no Appsmith

1. Products — CRUD simples
2. Equipments — CRUD simples
3. Specs — CRUD filtrando por equipment
4. Product Specs — grade por produto
5. Price Offers — ofertas por produto e mês
6. Registrations — importação/consulta de emplacamentos
7. Dashboard — views de valor percebido, preço efetivo e emplacamentos

## Queries úteis para validar

Valor percebido por spec:

```sql
SELECT * FROM v_product_spec_values;
```

Valor percebido total por produto:

```sql
SELECT * FROM v_product_total_perceived_value;
```

Ofertas comerciais com total recalculado:

```sql
SELECT * FROM v_price_offer_values;
```

Emplacamentos agregados:

```sql
SELECT * FROM v_registration_summary;
```

## Observações importantes

- O campo `finance_rate_cost` já existe, mas o cálculo com CDI/spread será adicionado depois.
- Para `equipments.selection_rule = 'single'`, a regra de apenas uma spec ativa por produto ainda deve ser validada no backend/app ou por trigger futura.
- Este protótipo é local. Não use dados sensíveis reais antes de configurarmos autenticação, roles e políticas de segurança.
