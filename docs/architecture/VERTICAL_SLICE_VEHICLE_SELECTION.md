# Vertical Slice — Seleção de Veículos

## Estado

Concluído em 2026-07-18 como a Fase 3 do Compra Car.

## Fluxo implementado

```text
VehicleSelection (Client Component)
→ Server Actions getBrands / getModels / getVehicles
→ cache do Next.js
→ casos de uso do core
→ portas VehicleRepository
→ LegacySupabaseAdapter
→ Supabase atual
```

A apresentação não importa o adaptador nem conhece tabelas, colunas ou queries. O composition root em `apps/web/src/server/composition-root.ts` é o único ponto que instancia o `LegacySupabaseAdapter` e injeta o repositório nos casos de uso de catálogo.

## Contratos de apresentação

`packages/contracts` publica DTOs serializáveis para opções, veículos e resultados das Server Actions. O mapper em `apps/web/src/server/catalog-dtos.ts` impede que entidades completas, flags editoriais ou detalhes físicos atravessem para o Client Component.

Erros de entrada retornam `INVALID_INPUT`. Falhas técnicas retornam `CATALOG_UNAVAILABLE` com mensagem segura e sem detalhes do Supabase, credenciais ou stack trace.

## Cache

As leituras usam `unstable_cache` com revalidação de 300 segundos. Os argumentos de marca e modelo integram a chave de cada chamada. As tags disponíveis são:

- `catalog`;
- `catalog:brands`;
- `catalog:models`;
- `catalog:vehicles`.

As tags permitem revalidação futura sem acoplar a UI à fonte dos dados. Esta fase não adiciona mutações nem dispara revalidação.

## Escopo da interface

A página inicial carrega marcas, modelos e veículos progressivamente, permite adicionar dois ou três veículos sem duplicação e navega para `/comparar` preservando a ordem dos IDs. A rota de destino é somente um placeholder; comparação, autenticação e escrita permanecem fora desta fase.
