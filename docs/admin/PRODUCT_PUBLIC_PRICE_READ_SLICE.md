# ProductPublicPrice — administração de rascunhos

## Escrita administrativa

`/admin/prices` permite criar `ProductPublicPrice` em `draft` e editar registros em `draft`,
`needs_review` ou `rejected`. A cadeia preserva as fronteiras existentes:

```text
Client Component -> Server Action -> serviço server-only -> caso de uso do core
  -> ProductPublicPriceRepository <- ProductPublicPriceSupabaseAdapter
```

O cliente envia somente produto, valor decimal, vigência e, na edição, ID e `lockVersion`.
`created_by` e `updated_by` sempre usam o profile da sessão administrativa validada no servidor.
Create força `BRL`, `draft`, origem `manual` e tipo `msrp`. Update não altera produto nem status e
filtra atomicamente por ID, versão esperada e status editável; o trigger existente incrementa
`lock_version` e atualiza `updated_at`. Uma atualização sem linha é classificada como inexistente,
não editável ou conflito, sem overwrite.

O formulário aceita valores pt-BR como `159.990,50`, converte-os para a string decimal canônica
`159990.50` e nunca usa `parseFloat` na persistência. A tabela mantém a string original no domínio e
apenas a apresenta em BRL sem casas decimais.

## Escopo implementado

A rota `/admin/prices` integra a primeira leitura de Pricing ao Admin Next.js existente. A fatia
preserva o fluxo `schema -> core/contracts -> repository -> adapter-supabase -> use case -> server
service -> UI` e reutiliza layout, autenticação, autorização, navegação, `PageHeader` e `EmptyState`.

O repository `ProductPublicPriceRepository` expõe leitura, criação e update concorrente. O adapter
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

Esta etapa não possui delete, publicação, revisão, rejeição, arquivamento, Offers, Policies ou
acesso a `commercial_policy_applications`. Nenhuma migration faz parte da fatia.

## Próximos passos

Permanecem pendentes: publicação, revisão, rejeição, arquivamento, filtros, Offers, Policies,
indicador visual do ambiente na Sprint 9.5 e validação da paginação com volume maior.
