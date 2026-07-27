# ProductPublicPrice — primeira fatia administrativa de leitura

## Escopo implementado

A rota `/admin/prices` integra a primeira leitura de Pricing ao Admin Next.js existente. A fatia
preserva o fluxo `schema -> core/contracts -> repository -> adapter-supabase -> use case -> server
service -> UI` e reutiliza layout, autenticação, autorização, navegação, `PageHeader` e `EmptyState`.

O repository `ProductPublicPriceRepository` expõe somente `listProductPublicPrices`. O adapter
dedicado `ProductPublicPriceSupabaseAdapter` consulta `product_public_prices`, associa `products`,
ordena por vigência e ID e pagina 25 registros por vez. A UI não conhece nomes físicos.

## Fonte do schema

A implementação segue a sequência de migrations versionadas:

- `20260725172755_create_pricing_types_and_core_tables.sql`: tabela, status, moeda, vigência,
  publicação, auditoria, lock version, constraints, índices e FK para Product;
- `20260726150000_add_pricing_legacy_migration_rules.sql`: coluna física opcional `ends_on`.

Isso corrige pontualmente a expectativa anterior do ADR-011 de que `ends_on` seria sempre derivado:
a migration mais recente é a fonte executável e adiciona o campo. A listagem administrativa mostra
o valor armazenado quando presente e “Sem término” quando nulo.

## Estados e limites

A tela implementa sucesso, vazio, erro, loading, paginação, valores nulos permitidos e falha segura
para Product relacionado ausente/inconsistente. Amount permanece string no domínio para não
introduzir arredondamento na fronteira de dados e é formatado em BRL apenas na apresentação.

Esta etapa deliberadamente não possui formulário, server action, create, update, delete,
publicação, Offers, Policies ou acesso a `commercial_policy_applications`. Nenhuma migration ou
operação de banco faz parte da fatia.

## Próximos passos

Depois de validar esta leitura, a evolução prevista é detalhar Price e somente então implementar
draft/edit e publicação como casos de uso separados, com concorrência otimista e auditoria. Esses
fluxos não devem ser antecipados neste slice.
