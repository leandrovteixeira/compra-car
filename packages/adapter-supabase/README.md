# `@compra-car/adapter-supabase`

Adaptador somente leitura que implementa `VehicleRepository` e `ComparisonRepository` sobre o Supabase atual. A tradução passa por DTOs e mapeadores internos; nenhum nome físico alcança o core ou o frontend.

## Configuração do servidor

Copie `.env.example` e configure `SUPABASE_URL` e `SUPABASE_SERVER_KEY` no runtime do servidor. Não use `NEXT_PUBLIC_`, não importe este pacote em Client Components e nunca registre a chave.

```ts
import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';

const repository = new LegacySupabaseAdapter();
```

## Consultas autorizadas

- `products`: projeção de identidade comercial e flags, com filtros exatos;
- `product_specs`: associações dos IDs em lote;
- `specs`: metadados ativos dos equipamentos em lote.

O pacote não contém escrita, migrations, RPC, autenticação, UI ou acesso ao Excel. O vínculo `product_specs.product_id → products.id` é lógico e sua ausência de FK está documentada.

## Testes

`pnpm --filter @compra-car/adapter-supabase test` executa mappers unitários. Integrações são opt-in por `SUPABASE_INTEGRATION_URL` e `SUPABASE_INTEGRATION_SERVER_KEY`; sem ambas, ficam ignoradas. `SUPABASE_INTEGRATION_VEHICLE_IDS` aceita IDs separados por vírgula.
