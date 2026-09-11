# Sprint 17R — Catalog Visibility & Inline Product Status

## Sprint 17R.1 — Product State Invariant + Compare Eligibility Row-Limit Fix

Data: 2026-09-11. Worktree: `C:/Dev/compra-car-17r`.
Branch: `sprint-17r-catalog-visibility`. Base limpa desta continuação: `d572cf7` —
`fix(catalog): align seller visibility with public status`, presente em origin/main conforme escopo.
A Sprint 17R.1 foi commitada e publicada na branch `sprint-17r-catalog-visibility`.
Commit atual: `f71b62a` — `fix(catalog): enforce public active invariant and paginate eligibility`.
A publicação da implementação original da 17R está registrada no histórico abaixo; as regras desta
seção substituem a permissão de quatro estados daquele registro.

### Estado administrativo

**Public requires Active:** `is_public=true => is_active=true`.

| Estado inicial / intenção | Resultado e persistência, além de `updated_at` |
| --- | --- |
| Active/Public → desativar | Inactive/Private; os dois flags false no mesmo UPDATE |
| Active/Private → desativar | Inactive/Private; os dois flags false no mesmo UPDATE |
| Inactive/Private → ativar | Active/Private; grava somente Active=true |
| Active/Private → publicar | Active/Public; grava somente Public=true, com Active=true no WHERE |
| Active/Public → despublicar | Active/Private; grava somente Public=false |
| Inactive/Private → publicar | rejeitado, sem mudança nem invalidação de cache |

A intenção recebida continua contendo exatamente um boolean. O core modela a transição de
desativação e o contrato do repositório exige aplicação atômica. O predicado Active no UPDATE de
publicação protege também contra desativação concorrente; o erro não expõe detalhes do banco.
Autorização admin antes do acesso ao adapter, pending, trava de clique duplicado, filtros, layout
e erro acessível foram preservados.

O badge de publicação fica disabled enquanto inativo, com título e aria-label explicativos.
Criação/edição/duplicação compartilham o formulário que desmarca Public ao desativar, bloqueia
publicação enquanto inativo e não publica ao reativar. Server/core rejeitam Inactive/Public.
Public e desativação expiram imediatamente o catálogo; edição completa mantém a invalidação em
todo sucesso. Next 15.5.20 e `revalidateTag(tag)` preservados.

### Causa e solução do truncamento

Confirmado no código de `d572cf7`: `listPublicEligibleVehicles()` consultava todas as associações
dos produtos públicos em uma resposta sem paginação. Com o teto de 1.000 linhas, produtos cuja
evidência ficava depois desse corte eram incorretamente descartados. A auditoria informada pelo
usuário encontrou 14 produtos públicos e 2.009 associações; esses números não foram reconsultados
no banco durante este hotfix.

**Divergência da base:** a migration baseline e os inventários versionados não possuem FK
`product_specs.product_id -> products.id`. Existe apenas a FK de `equipment_id -> specs.id`.
Por isso não foi usado o join direto de products com product_specs. Foi implementada a alternativa
de paginação explícita autorizada no escopo:

1. produtos Public em páginas de 500, ordenados por ID;
2. associações de cada lote de até 500 IDs em páginas de 500, ordenadas por product_id/equipment_id;
3. `specs!inner(id)` e `specs.is_active=true` aplicam o requisito de spec ativa no PostgREST;
4. somente IDs elegíveis são acumulados; cada página de associações é descartada após processamento;
5. a leitura do lote termina ao esgotar as associações ou encontrar evidência para todos os produtos.

Não há consulta individual por produto, aumento de Max Rows, nova FK ou carregamento acumulado de
todas as associações. A paginação também protege catálogos com mais de 1.000 produtos públicos.
O cliente instalado é `@supabase/supabase-js 2.110.7`; sua implementação real constrói os requests
nos testes. Referência: [joins Supabase](https://supabase.com/docs/guides/database/joins-and-nesting).
A sintaxe de `range()` também foi conferida no `PostgrestTransformBuilder` instalado.

Seller continua usando Public como único gate de status. Comparar mantém spec ativa, sem exigir
preço. Latest vem depois da elegibilidade. Ver Modelo continua Public → preço vigente → latest;
`keepLatestSellerProducts`, preços, MSRP, specs, scores, políticas comerciais e RLS não foram alterados.

### Migration e pendências de ambiente

Criada pela CLI, sem aplicação no banco:
`supabase/migrations/20260911204125_products_public_requires_active.sql`.
Adiciona CHECK validada `products_public_requires_active` com a expressão
`is_public IS NOT TRUE OR is_active IS TRUE`. Não contém UPDATE ou reparação: se houver registro
inválido, a adição falha. O escopo informa zero inconsistências na auditoria anterior.

O teste Vitest da migration passou. O pgTAP
`supabase/tests/017_product_state_invariant.test.sql` verifica a constraint instalada e exercita
estados em tabela temporária, terminando com rollback. **PENDENTE:** execução desse teste e aplicação
da migration, pois o daemon Docker local está indisponível; nenhuma migration foi aplicada remotamente.
**PENDENTE após deploy:** buscar Corolla no Comparar e confirmar IDs 895, 896, 615 e 897 com as quatro
versões descritas pelo usuário. Nenhum dos quatro produtos foi alterado por este trabalho.

### Validação da Sprint 17R.1

Testes direcionados: 108 core, 22 adapter e 147 web, **277 aprovados**. Incluem transições,
autorização, rejeição no formulário/core, tentativa de publicação concorrente, cache aquecido,
latest após elegibilidade, Ver Modelo, comparação e limite de linhas.

Regressão HTTP simula teto de 1.000 linhas e ausência de FK products → product_specs. Cobre produto
posterior a 2.009 associações ativas, evidência ativa após specs inativas e 1.001 produtos públicos.
Foi executado um teste de mutação: os três testes falharam com a consulta original de HEAD;
o adapter corrigido foi restaurado integralmente e os testes passaram.

| Gate final | Resultado | Comparação com `d572cf7` |
| --- | --- | --- |
| `pnpm lint` | passou, 7 tarefas | sem erros novos |
| `pnpm build` | passou, Next 15.5.20, 29 páginas | sem upgrade |
| `pnpm typecheck` | falhou com 5 TS2554 em `admin-product-public-prices.test.ts:101–105` | mesmos cinco erros do baseline |
| `pnpm test` | core 656 passaram; pricing 71 passaram; adapter 108 passaram, 1 falhou, 3 skipped | mesmo teste preexistente de preços no adapter; core tinha 651 e adapter 104 aprovados |
| `pnpm --filter @compra-car/web test` | 631 passaram, 8 falharam, 16 skipped | mesmos oito erros do baseline, que tinha 620 aprovados |
| `pnpm format:check` | 15 arquivos preexistentes fora deste diff | nenhum arquivo alterado nesta sprint na lista |
| `git diff --check` | passou | sem erros de whitespace |

O Turbo interrompe o teste global no adapter; por isso a suíte web foi executada separadamente.
A falha do adapter é `lists a page with exact count and deterministic range` em
`product-public-price-supabase-adapter.test.ts`, cujo fake não implementa `.in()` usado na leitura
de períodos. As oito falhas web permanecem: cinco de navegação autenticada, uma de status visual de
preço, uma de mobile/PWA e uma de largura do menu de instalação. Nenhuma foi corrigida fora do escopo.

Comandos direcionados executados:

```text
pnpm --filter @compra-car/core test administrative-vehicle administrative-vehicle-status domain
pnpm --filter @compra-car/adapter-supabase test legacy-supabase-adapter catalog-eligibility-row-limit product-state-migration
pnpm --filter @compra-car/web test admin-product-status-toggle admin-product-form-status admin-product-creation admin-product-editing admin-product-duplication admin-product-refinements catalog-visibility seller-product-eligibility comparison
```

### Arquivos da Sprint 17R.1

24 arquivos modificados e cinco novos, incluídos no commit `f71b62a`, publicado na branch
`sprint-17r-catalog-visibility`. A listagem abaixo registra o estado anterior ao commit, para referência histórica.

```text
 M AI_CONTEXT.md
 M CHANGELOG.md
 M apps/web/src/application/admin/update-admin-product-status.ts
 M apps/web/src/components/admin/admin-product-form.tsx
 M apps/web/src/components/admin/admin-product-list.tsx
 M apps/web/src/components/admin/admin-product-status-toggle.tsx
 M apps/web/test/admin-product-creation.test.ts
 M apps/web/test/admin-product-duplication.test.ts
 M apps/web/test/admin-product-editing.test.ts
 M apps/web/test/admin-product-refinements.test.ts
 M apps/web/test/admin-product-status-toggle.test.ts
 M apps/web/test/catalog-visibility.test.ts
 M docs/admin/SPRINT_17R_CATALOG_VISIBILITY.md
 M docs/admin/VEHICLE_MANAGEMENT.md
 M docs/architecture/decisions/ADR-004-ACTIVE-AND-PUBLIC-ARE-DISTINCT.md
 M docs/data/MVP_DATA_REQUIREMENTS.md
 M packages/adapter-supabase/src/legacy-supabase-adapter.ts
 M packages/adapter-supabase/test/legacy-supabase-adapter.test.ts
 M packages/contracts/src/index.ts
 M packages/core/src/admin/administrative-vehicle.ts
 M packages/core/src/repositories/administrative-vehicle-repository.ts
 M packages/core/src/use-cases/update-administrative-vehicle-status.ts
 M packages/core/test/administrative-vehicle-status.test.ts
 M packages/core/test/administrative-vehicle.test.ts
?? apps/web/test/admin-product-form-status.test.ts
?? packages/adapter-supabase/test/catalog-eligibility-row-limit.test.ts
?? packages/adapter-supabase/test/product-state-migration.test.ts
?? supabase/migrations/20260911204125_products_public_requires_active.sql
?? supabase/tests/017_product_state_invariant.test.sql
```

Logs locais ignorados pelo Git: `.local-reports/17r1-*.log`. A execução usa Node 24.18.0 e
pnpm 10.34.5; o projeto declara Node 22.x, divergência de ambiente mantida sem upgrade.

## Registro histórico — Sprint 17R original

As seções abaixo documentam a entrega original, seus testes e seu diff, não o estado da 17R.1.
As regras Active/Public da seção 17R.1 acima e do ADR-004 atual prevalecem.

Data: 2026-09-11.
Worktree: C:/Dev/compra-car-17r.
Branch: sprint-17r-catalog-visibility.
Base inicial limpa: origin/main no commit 35fe6be.
Commit atual: 8f6ad89 — fix(catalog): align seller visibility with public status.

Implementação concluída, commitada e publicada na branch sprint-17r-catalog-visibility no commit
8f6ad89. Os gates globais têm falhas preexistentes
documentadas abaixo; não há declaração de suíte global verde. Nenhum arquivo do checkout anterior
foi consultado ou copiado. As dependências foram instaladas com pnpm install --frozen-lockfile
neste worktree, sem alterar manifesto ou lockfile.

## Comportamento implementado

- Active representa trabalho/monitoramento interno. Public é o gate editorial/confidencial seller.
  Os quatro estados são válidos e nenhuma publicação é inferida de atributos.
- Comparar e acesso por IDs exigem Public, independentemente de Active. As associações com specs
  ativas e as validações existentes foram preservadas.
- Ver Modelo consulta públicos, exige preço público vigente e então aplica keepLatestSellerProducts.
  Essa função permanece intacta: brand/model/version, maior MY e desempate por PY. A geração privada
  futura não suprime a pública anterior. Os cálculos de scores permanecem iguais.
- Badges administrativos viraram botões verdes/cinzas com aria-label contextual, aria-pressed,
  pending/disabled, trava síncrona de clique duplicado, hover/foco e erro com role=alert.
  Mantêm texto/tamanho durante pending. Refresh conserva URL, busca e filtros.
- Server Action → autorização admin → aplicação → caso de uso/contrato core → adapter. A operação
  aceita exatamente um boolean isActive ou isPublic e ID decimal positivo seguro. O UPDATE grava
  somente a coluna solicitada e updated_at, filtrado pelo ID. Identidade e outro status permanecem
  intactos. Falha e ausência de linha não são tratadas como sucesso.
- O formulário compartilhado de criação/edição/duplicação também deixou de aplicar cascata
  Active/Public e o core permite público inativo.
- Toggle Public e edição completa expiram CATALOG_CACHE_TAGS.all depois do sucesso e revalidam a
  listagem administrativa. A edição completa invalida em todo sucesso, cobrindo mudanças de Public
  e identidade sem precisar de uma leitura adicional do estado anterior.
- O Next efetivamente instalado é 15.5.20. Sua API de expiração imediata é revalidateTag(tag);
  updateTag não é exportado. Ver Modelo faz leitura por request e preserva a view de preço vigente.
  A invalidação torna a próxima leitura atual; não implementa push para sessões já abertas.
  Referência: [Next 15 revalidateTag](https://nextjs.org/docs/15/app/api-reference/functions/revalidateTag).

## Arquivos alterados

33 arquivos: 24 modificados e 9 novos, incluindo este relatório.

- `AI_CONTEXT.md`
- `CHANGELOG.md`
- `apps/web/src/app/admin/products/actions.ts`
- `apps/web/src/application/admin/update-admin-product-status.ts`
- `apps/web/src/application/admin/update-admin-product.ts`
- `apps/web/src/components/admin/admin-product-form.tsx`
- `apps/web/src/components/admin/admin-product-list.tsx`
- `apps/web/src/components/admin/admin-product-status-toggle.tsx`
- `apps/web/src/server/catalog-cache.ts`
- `apps/web/src/server/seller-model-score-service.ts`
- `apps/web/src/server/update-admin-product-status.ts`
- `apps/web/src/server/update-admin-product.ts`
- `apps/web/test/admin-product-duplication.test.ts`
- `apps/web/test/admin-product-editing.test.ts`
- `apps/web/test/admin-product-refinements.test.ts`
- `apps/web/test/admin-product-status-toggle.test.ts`
- `apps/web/test/catalog-visibility.test.ts`
- `docs/admin/SPRINT_17R_CATALOG_VISIBILITY.md`
- `docs/admin/VEHICLE_MANAGEMENT.md`
- `docs/architecture/decisions/ADR-004-ACTIVE-AND-PUBLIC-ARE-DISTINCT.md`
- `docs/data/MVP_DATA_REQUIREMENTS.md`
- `packages/adapter-supabase/src/legacy-supabase-adapter.ts`
- `packages/adapter-supabase/test/legacy-supabase-adapter.test.ts`
- `packages/contracts/src/index.ts`
- `packages/core/src/admin/administrative-vehicle.ts`
- `packages/core/src/entities/vehicle.ts`
- `packages/core/src/index.ts`
- `packages/core/src/repositories/administrative-vehicle-repository.ts`
- `packages/core/src/use-cases/compare-vehicles.ts`
- `packages/core/src/use-cases/update-administrative-vehicle-status.ts`
- `packages/core/test/administrative-vehicle-status.test.ts`
- `packages/core/test/administrative-vehicle.test.ts`
- `packages/core/test/domain.test.ts`

A maior parte do diff de seller-model-score-service.ts é formatação do arquivo anteriormente
compactado. Uma comparação estrutural de AST contra a base inicial 35fe6be confirmou que, além da
formatação/comentário, somente o filtro is_active → is_public mudou. A função latest não foi alterada.

## Testes e validação

| Verificação | Resultado |
| --- | --- |
| pnpm lint | PASS — 7 tarefas |
| pnpm typecheck | FAIL — somente 5 TS2554 preexistentes em testes de preços Web |
| pnpm test | FAIL — mock de preços no adapter interrompe a execução antes de Web |
| pnpm --filter @compra-car/web test | FAIL — 619 passaram, 8 falharam, 16 skipped |
| pnpm build | PASS — Next 15.5.20, incluindo /ver-modelo e /admin/products |
| pnpm format:check | FAIL — 15 arquivos preexistentes, nenhum alterado pela Sprint |
| Prettier nos arquivos TypeScript alterados | PASS |
| git diff --check | PASS |
| Regressões direcionadas finais | PASS — 156 testes em 10 arquivos |

Na execução global: Core 651/651; Pricing 71/71; Adapter 104 passaram, 1 falhou, 3 skipped.
A suíte Web foi executada separadamente porque a falha no Adapter interrompeu o Turbo.
Após essa suíte foi acrescentada mais uma regressão de publicação/despublicação da geração futura;
ela passou na validação direcionada final, sem reivindicar uma nova execução global.

Validação direcionada final:
- Core: domain.test.ts, administrative-vehicle.test.ts e administrative-vehicle-status.test.ts:
  85 testes passaram.
- Adapter: legacy-supabase-adapter.test.ts: 18 testes passaram.
- Web: catalog-visibility.test.ts, admin-product-status-toggle.test.ts, admin-product-editing.test.ts,
  admin-product-duplication.test.ts, admin-product-refinements.test.ts e seller-product-eligibility.test.ts:
  53 testes passaram.

Cobertura nova/atualizada: quatro estados, URL direta, specs ativas, Ver Modelo/peers/seleção privada,
Dolphin GS público 2026/2027 versus privado 2027/2028, preço antes de latest, gravação exata de uma
coluna e timestamp, autorização anterior a qualquer query, ID/payload inválidos, falha/linha ausente,
cache previamente preenchido e retorno à geração anterior ao despublicar a futura. UI cobre rótulos
contextuais, pending, clique duplicado antes do rerender, erro acessível, retry e refresh sem navegação.

Os testes percorrem o adapter e as Server Actions reais com fronteiras Supabase/Next cache em memória.
Os testes de componente controlam hooks React. Não houve smoke com banco real ou navegador autenticado.

## Divergências da base atual

1. **Next:** manifesto, pacote instalado e build confirmam 15.5.20, não 16.3.x. Foi usada a API
   correspondente, sem upgrade de dependência.
2. **Typecheck:** apps/web/test/admin-product-public-prices.test.ts, linhas 101–105, chama
   adminPriceVisualStatusLabel com 3 argumentos; a implementação atual exige 4.
3. **Adapter/test:** product-public-price-supabase-adapter.test.ts não implementa .in() no mock
   utilizado na consulta de vw_product_public_price_periods, causando TypeError. Arquivos de preços
   não foram alterados.
4. **Web/test:** uma falha de preços (espera Publicado, recebe Vigente), cinco de
   authenticated-navigation.test.ts (links seller/menu/layout antigos), uma de
   sprint-14g-mobile-pwa.test.ts e uma de sprint-14g3-in-app-install.test.ts (menu/classes antigas).
   Os testes e componentes envolvidos nessas falhas permanecem iguais ao HEAD.
5. **Formatação:** restam 15 arquivos, listados abaixo, todos sem diff nesta Sprint.
6. **Ambiente:** Node local 24.18.0; engines do projeto declara 22.x. Não houve mudança de runtime.
7. Ver Modelo já acessava Supabase diretamente no serviço server nesta base. A Sprint troca o
   filtro nessa consulta existente; não adiciona novas consultas fora do adapter nem expande esse
   acoplamento. A nova mutação é isolada integralmente pelo contrato/core/adapter.

Arquivos com formatação preexistente:
- apps/web/src/app/(seller)/ver-modelo/page.tsx
- apps/web/src/application/admin/admin-price-query.ts
- apps/web/src/application/catalog/seller-product-eligibility.ts
- apps/web/src/components/admin/admin-price-filters.tsx
- apps/web/src/components/admin/admin-price-list.tsx
- apps/web/src/components/application-topbar.tsx
- apps/web/src/components/authenticated-navigation.tsx
- apps/web/src/components/seller-model-picker.tsx
- apps/web/src/components/seller-model-radar.tsx
- apps/web/src/components/seller-nav.tsx
- apps/web/src/components/user-menu.tsx
- apps/web/test/seller-product-eligibility.test.ts
- packages/adapter-supabase/src/product-public-price-supabase-adapter.ts
- packages/core/src/repositories/product-public-price-repository.ts
- scripts/data-refresh/run-msrp-history-import.ts

**PENDENTE fora do escopo:** conciliar testes de preços/navegação/menu com a base atual, corrigir a
formatação acima e executar validação autenticada com dados reais. Nenhuma correção de preços,
specs, RLS, navegação ou layout externo foi incluída para mascarar essas falhas.

Legacy, supabase/, dados, MSRP, specs, políticas comerciais e lockfile foram preservados. Nenhuma
alteração em massa, publicação automática de produtos, migration ou batch edit foi executado.

## Registro Git da implementação

As saídas abaixo são registros históricos capturados antes do commit 8f6ad89, que publicou a
implementação na branch sprint-17r-catalog-visibility. Naquela captura, git diff --stat considerava
somente os 24 arquivos já rastreados; os 9 novos apareciam em status --short.

### git diff --stat

```text
 AI_CONTEXT.md                                      |  18 +
 CHANGELOG.md                                       |  12 +
 .../src/application/admin/update-admin-product.ts  |   2 +
 .../src/components/admin/admin-product-form.tsx    |   2 -
 .../src/components/admin/admin-product-list.tsx    |  39 +--
 apps/web/src/server/catalog-cache.ts               |   7 +-
 apps/web/src/server/seller-model-score-service.ts  | 373 +++++++++++++++++----
 apps/web/src/server/update-admin-product.ts        |   2 +
 apps/web/test/admin-product-duplication.test.ts    |   9 +-
 apps/web/test/admin-product-editing.test.ts        |   4 +
 apps/web/test/admin-product-refinements.test.ts    |   6 +-
 docs/admin/VEHICLE_MANAGEMENT.md                   |  13 +
 .../ADR-004-ACTIVE-AND-PUBLIC-ARE-DISTINCT.md      |  34 +-
 docs/data/MVP_DATA_REQUIREMENTS.md                 |   5 +-
 .../src/legacy-supabase-adapter.ts                 |  38 ++-
 .../test/legacy-supabase-adapter.test.ts           |  19 +-
 packages/contracts/src/index.ts                    |   6 +
 packages/core/src/admin/administrative-vehicle.ts  |  31 +-
 packages/core/src/entities/vehicle.ts              |   2 +-
 packages/core/src/index.ts                         |   1 +
 .../administrative-vehicle-repository.ts           |   8 +
 packages/core/src/use-cases/compare-vehicles.ts    |   2 +-
 packages/core/test/administrative-vehicle.test.ts  |  10 +-
 packages/core/test/domain.test.ts                  |  30 +-
 24 files changed, 533 insertions(+), 140 deletions(-)
```

### git status --short

```text
 M AI_CONTEXT.md
 M CHANGELOG.md
 M apps/web/src/application/admin/update-admin-product.ts
 M apps/web/src/components/admin/admin-product-form.tsx
 M apps/web/src/components/admin/admin-product-list.tsx
 M apps/web/src/server/catalog-cache.ts
 M apps/web/src/server/seller-model-score-service.ts
 M apps/web/src/server/update-admin-product.ts
 M apps/web/test/admin-product-duplication.test.ts
 M apps/web/test/admin-product-editing.test.ts
 M apps/web/test/admin-product-refinements.test.ts
 M docs/admin/VEHICLE_MANAGEMENT.md
 M docs/architecture/decisions/ADR-004-ACTIVE-AND-PUBLIC-ARE-DISTINCT.md
 M docs/data/MVP_DATA_REQUIREMENTS.md
 M packages/adapter-supabase/src/legacy-supabase-adapter.ts
 M packages/adapter-supabase/test/legacy-supabase-adapter.test.ts
 M packages/contracts/src/index.ts
 M packages/core/src/admin/administrative-vehicle.ts
 M packages/core/src/entities/vehicle.ts
 M packages/core/src/index.ts
 M packages/core/src/repositories/administrative-vehicle-repository.ts
 M packages/core/src/use-cases/compare-vehicles.ts
 M packages/core/test/administrative-vehicle.test.ts
 M packages/core/test/domain.test.ts
?? apps/web/src/app/admin/products/actions.ts
?? apps/web/src/application/admin/update-admin-product-status.ts
?? apps/web/src/components/admin/admin-product-status-toggle.tsx
?? apps/web/src/server/update-admin-product-status.ts
?? apps/web/test/admin-product-status-toggle.test.ts
?? apps/web/test/catalog-visibility.test.ts
?? docs/admin/SPRINT_17R_CATALOG_VISIBILITY.md
?? packages/core/src/use-cases/update-administrative-vehicle-status.ts
?? packages/core/test/administrative-vehicle-status.test.ts
```
