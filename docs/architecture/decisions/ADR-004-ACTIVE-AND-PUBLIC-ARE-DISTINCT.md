# ADR-004 — isActive e isPublic são estados distintos

- **Status:** aceito
- **Data:** 2026-07-18; revisado em 2026-09-11 (Sprint 17R.1)

## Contexto

Monitoramento interno e exposição editorial respondem a perguntas diferentes. Um produto futuro ou
concorrente pode estar sendo trabalhado internamente e ainda ser confidencial. A decisão anterior
que exigia Active + Public simultaneamente para o seller está superada.

## Decisão

`isActive` representa estado interno de trabalho, manutenção ou monitoramento. Não controla
visibilidade seller. `isPublic` é o gate explícito editorial/confidencial de exposição: somente
produtos com `isPublic=true` podem aparecer em telas seller, independentemente de Active.

**Public requires Active:** `is_public=true => is_active=true`. São válidos Active/Public,
Active/Private e Inactive/Private. Inactive/Public é inválido. A Sprint 17R.1 substitui a permissão
dos quatro estados introduzida na 17R, sem reintroduzir filtro Active nas consultas seller.
`active=true / public=false` é o estado normal de um produto confidencial em monitoramento.
Publicação é conciliada manualmente pelo Admin; preço, specs, ano, marca e geração não a inferem.

Comparar mantém a associação com specs ativas e as validações existentes; acesso por IDs também
exige Public. Ver Modelo mantém preço público vigente de `vw_current_product_public_prices`.
Esses requisitos funcionais são independentes da decisão editorial de publicação.

A base não possui FK `product_specs.product_id -> products.id`, conforme migration baseline e
inventário em `docs/data/SUPABASE_INSPECTION_RESULTS.md`; portanto não permite `products!inner`
com associações. Foi adotada a alternativa de paginação explícita: produtos públicos em páginas
de 500 ordenadas por ID e associações desses IDs em páginas de 500 ordenadas por product_id e
equipment_id. A FK existente `equipment_id -> specs.id` permite `specs!inner(id)` e filtro
`specs.is_active=true` no servidor. Somente IDs elegíveis são acumulados, sem guardar todas as
associações. A leitura para quando termina a página ou todos os produtos do lote já são elegíveis.
Isso elimina o truncamento em 1.000 associações sem N+1, nova FK ou aumento de Max Rows.
Preço não é requisito do Comparar.

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
- o toggle recebe exatamente uma intenção administrativa. Desativar grava `is_active=false` e
  `is_public=false` atomicamente no mesmo UPDATE, mais `updated_at`. Ativar grava somente Active;
  publicar/despublicar grava somente Public. Publicar exige Active=true no próprio UPDATE, sem
  janela de leitura seguida de escrita. Ausência de linha/inatividade retorna erro seguro;
- ID e payload são validados e a ação exige role admin; pending e erro acessível são preservados;
- criação, edição e duplicação desmarcam Public ao desativar, bloqueiam Public enquanto inativo e
  nunca publicam automaticamente ao reativar. A validação core também rejeita Inactive/Public;
- a CHECK `products_public_requires_active` usa `is_public IS NOT TRUE OR is_active IS TRUE` e
  protege escritas fora do fluxo administrativo. A migration valida registros existentes e falha
  se houver inconsistência, sem executar reparação ou UPDATE de dados;
- publicação inline, desativação e edição completa invalidam imediatamente `CATALOG_CACHE_TAGS.all` após sucesso,
  além de revalidar a listagem. O Next efetivamente instalado nesta branch é 15.5.20 e usa
  `revalidateTag(tag)`; uma atualização futura para Next 16 deve manter expiração imediata com
  `updateTag` em Server Actions, sem introduzir stale-while-revalidate;
- a migration da constraint é a única mudança de schema desta revisão. Não há publicação em massa,
  alteração manual de dados, preços/specs, scores ou RLS.
