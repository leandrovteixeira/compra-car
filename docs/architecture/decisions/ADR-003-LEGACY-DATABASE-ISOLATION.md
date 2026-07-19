# ADR-003 — Frontend isolado do banco legado

- **Status:** aceito
- **Data:** 2026-07-18

## Contexto

O MVP usará o Supabase atual, mas o schema ainda não foi inspecionado e deverá evoluir gradualmente. Acoplamento direto impediria trocar o adaptador e propagaria nomes físicos pela aplicação.

## Decisão

O frontend acessa casos de uso e contratos normalizados. Somente adaptadores de infraestrutura poderão conhecer tabelas, colunas ou particularidades da fonte. As portas públicas não usarão nomes como `products`, `specs` ou `product_specs`.

## Consequências

- o Legacy Supabase Adapter implementa as portas de `packages/core`;
- a troca por um adaptador V2 não deverá alterar componentes quando os contratos forem compatíveis;
- esta fase não implementa Supabase, queries ou mapeamento físico.
