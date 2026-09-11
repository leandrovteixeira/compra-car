# ADR-004 — isActive e isPublic são estados distintos

- **Status:** aceito
- **Data:** 2026-07-18; revisado em 2026-09-11 (Sprint 17R)

## Contexto

Monitoramento interno e exposição editorial respondem a perguntas diferentes. Um produto futuro ou
concorrente pode estar sendo trabalhado internamente e ainda ser confidencial. A decisão anterior
que exigia Active + Public simultaneamente para o seller está superada.

## Decisão

`isActive` representa estado interno de trabalho, manutenção ou monitoramento. Não controla
visibilidade seller. `isPublic` é o gate explícito editorial/confidencial de exposição: somente
produtos com `isPublic=true` podem aparecer em telas seller, independentemente de Active.

Os quatro estados são válidos. `active=true / public=false` é o estado normal de um produto
confidencial em monitoramento, como um concorrente ou lançamento futuro. `active=false / public=true`
continua visível, desde que cumpra os requisitos funcionais da tela. Não existe cascata entre flags.
Publicação é conciliada manualmente pelo Admin; preço, specs, ano, marca e geração não a inferem.

Comparar mantém a associação com specs ativas e as validações existentes; acesso por IDs também
exige Public. Ver Modelo mantém preço público vigente de `vw_current_product_public_prices`.
Esses requisitos funcionais são independentes da decisão editorial de publicação.

A ordem em Ver Modelo é **PUBLIC → preço vigente → keepLatestSellerProducts**. Comparar também
aplica latest somente após a elegibilidade pública do adapter. A função de geração permanece pura,
sem conhecimento de `isPublic`: identidade brand + model + version, maior modelYear e, em empate,
maior productionYear. Dolphin GS público 2026/2027 não pode ser suprimido por uma geração privada
2027/2028 da mesma identidade.

Permanece **PENDENTE** confirmar como `product_specs.is_present = false` afeta presença, validade e comparabilidade; a existência da associação não encerra essa decisão.

## Consequências

- nenhuma flag substitui a outra;
- o adaptador deverá mapear as duas sem inferência silenciosa;
- a validação online opt-in deve conferir a cobertura real de cada estado.
- o Admin pode alterar cada badge por uma operação dedicada que grava somente o boolean solicitado
  e `updated_at`; ID e payload são validados e a ação exige role admin;
- criação, edição e duplicação preservam a independência dos flags;
- publicação inline e edição completa invalidam imediatamente `CATALOG_CACHE_TAGS.all` após sucesso,
  além de revalidar a listagem. O Next efetivamente instalado nesta branch é 15.5.20 e usa
  `revalidateTag(tag)`; uma atualização futura para Next 16 deve manter expiração imediata com
  `updateTag` em Server Actions, sem introduzir stale-while-revalidate;
- nenhuma alteração de dados, inferência automática, batch edit, migration ou mudança de RLS integra
  esta decisão.
