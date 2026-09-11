# Sprint 17R — Catalog Visibility & Inline Product Status

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
