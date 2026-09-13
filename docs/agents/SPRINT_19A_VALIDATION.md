# Sprint 19A / 19A.1 — validação e entrega

## Entrega atual: 19A.1

Worktree: `C:\Dev\compra-car-agent1`
Branch: `sprint-19-new-product-agent`
Base: `4d4840c33276845ddd62748847588e7e3b47073f` (origin/main confirmado na 19A).
19A e 19A.1 permanecem **sem commit e sem staging**.
O worktree original e Legacy não foram alterados.

Arquitetura: Discovery → Resolution → candidatos oficiais estruturados →
parser/compatibilidade histórica → classificação determinística → reports.
Um único agente, com duas tarefas de pesquisa na mesma resposta estruturada.

A regra NEW_MODEL não exige versão quando o modelo base é explícito e a evidência
é suficiente. officialVersionLabel é preservado; os modos EXACT_OFFICIAL e
LEGACY_NAMING exigem unicidade e ausência de conflitos. Nomes canônicos não
são reescritos. Decisões, contrato completo e limites:
[manual do agente](NEW_PRODUCT_CHECK_AGENT.md).

## Histórico e comparação de baseline

A base foi executada antes da implementação 19A. A entrega 19A também executou
os gates e sua fixture (5 candidatos, 1 match, 4 findings). Esses logs e reports
foram preservados.

Depois da 19A, o operador informou um smoke OpenAI real: 16 candidatos aceitos,
8 produtos administrativos, zero matches e 16 AMBIGUOUS, sem rejeições.
Esse resultado motivou a 19A.1; **não é execução feita nesta validação**.

| Gate | Main / 19A anterior | 19A.1 |
| --- | --- | --- |
| pnpm lint | exit 0 / 0 | exit 0 |
| pnpm typecheck | exit 2 / 2 | exit 1, mesmos cinco TS2554 |
| pnpm test | exit 1 / 1 | exit 1, mesma falha de preços públicos |
| pnpm format:check | exit 1 / 1 | exit 1, mesmos 15 arquivos |
| pnpm build | exit 0 / 0 | exit 0 |
| git diff --check | 19A: exit 0 | exit 0 |

Embora o exit code propagado do typecheck tenha variado, os cinco diagnósticos
foram idênticos. O Turbo encerra tarefas ao encontrar falha; as suítes e tipos
do escopo foram executados separadamente.

Comparação automatizada: `sameAsMain=true` e `sameAs19A=true` para os diagnósticos
de typecheck, testes e formatação. Artefato local:
`.local-reports/agents/new-product-check/validation/19a1/diagnostic-comparison.json`.

Erros preexistentes, não corrigidos nesta Sprint:

- `apps/web/test/admin-product-public-prices.test.ts`, linhas 101–105, coluna 12:
  `TS2554: Expected 4 arguments, but got 3.`
- `packages/adapter-supabase/test/product-public-price-supabase-adapter.test.ts`,
  caso `ProductPublicPrice Supabase adapter > lists a page with exact count and deterministic range`.
  Causa: `TypeError: this.client.from(...).select(...).in is not a function`,
  em `src/product-public-price-supabase-adapter.ts:132:10`.
  Pacote: 1 failed, 108 passed, 3 skipped, igual aos baselines.
- Formatação: os mesmos 15 caminhos listados ao final.

Logs locais:
`validation/baseline-*.log`, `validation/final-*.log` (19A) e
`validation/19a1/final-*.log`, dentro do diretório de reports do agente.

## Testes e checks direcionados

| Suíte | Resultado |
| --- | --- |
| Core: new-product-check-agent + legacy-product-version-parser | 99 passed |
| Adapter OpenAI: product-research-provider | 16 passed |
| CLI/report: new-product-check-cli | 11 passed |
| Total do escopo | **126 passed** |
| SELECT administrativo existente: commercial-product-catalog | **11 passed** |

O gate global também completou a suíte inteira do core: **755 passed**.
Typecheck dos três pacotes afetados: **exit 0**.
Prettier de todos os arquivos de código/configuração do escopo: **exit 0**.
Lint global: **exit 0**, incluindo o pacote scripts/agents.
Build: **exit 0**.

Cobertura dos 25 critérios obrigatórios: NEW_MODEL sem versão, modelo conhecido
sem variante, os oito matches Toyota, ICE/HEV sem confusão, GR-Sport novo,
unicidade, conflitos/ausências, media Toyota/hosts falsos/externos, taxonomia,
anos explícitos, deduplicação de candidatos/evidências, Jeep com nomenclatura
oficial, ausência de fuzzy como decisão, leitura sem mutação, fixture, JSON e
Markdown. Também há regressões de schema inválido/preço indevido, sufixos
desconhecidos, propagação de erros e proteção contra vazamento de secrets.

Comandos executados:

```powershell
pnpm --filter @compra-car/core --filter @compra-car/adapter-openai --filter @compra-car/agents typecheck
pnpm --filter @compra-car/core --filter @compra-car/adapter-openai --filter @compra-car/agents test -- new-product-check-agent.test.ts legacy-product-version-parser.test.ts product-research-provider.test.ts new-product-check-cli.test.ts
pnpm --filter @compra-car/adapter-openai test
pnpm --filter @compra-car/adapter-supabase test -- commercial-product-catalog.test.ts
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
git diff --check
```

Testes da Sprint usam fixture/transporte simulado. Flags de smoke OpenAI,
benchmark Jeep e integração Supabase foram explicitamente desabilitadas no
processo dos gates globais, sem alterar configuração persistida.

## Fixture 19A.1 executado

```powershell
pnpm agent:new-products:dry-run -- --brand Toyota --provider fixture
```

Exit **0**. Run: `bdae64db-f5f8-43ac-94a3-4091d966b410`.

| Estado | Resultado |
| --- | --- |
| Modelos descobertos | 3 |
| Variantes resolvidas | 9 |
| Candidatos pesquisados / aceitos | 11 / 11 |
| Produtos administrativos conhecidos | 8 |
| Matches exatos | 0 |
| Matches LEGACY_NAMING | 8 |
| NEW_MODEL | 1: SW4 sem versão |
| NEW_VERSION | 1: Corolla Cross GR-Sport |
| AMBIGUOUS | 1: Corolla Cross sem variante |
| POSSIBLE_YEAR_CHANGE | 0 no fixture; coberto nos testes |
| Rejeitados / fontes externas rejeitadas | 0 / 0 |

JSON e Markdown gerados e conferidos em:
`.local-reports/agents/new-product-check/bdae64db-f5f8-43ac-94a3-4091d966b410.{json,md}`.
O Markdown mostra rótulo oficial, atributos, match mode e nome histórico intacto.
Fixture sintética, sem afirmação de disponibilidade atual da montadora.

## Garantias e limitações

- **Zero canonical writes** nesta implementação e validação.
- **Zero chamadas reais OpenAI** durante testes e validação final da 19A.1.
- **Zero renomeações de products.version**.
- Sem queries reais, migrations, aliases persistidos, tabelas, preços, UI ou worker.
- **PENDENTE:** próximo smoke OpenAI 19A.1, autorizado manualmente após revisão.
- Convenção ICE do parser é transitória, documentada e testada. Campos desconhecidos,
  taxonomia e extração incompleta podem exigir revisão; ausência não prova equivalência.
- Node 24.18.0 disponível; projeto declara 22.x. pnpm 10.34.5.
- Limitações de snapshot, validação de conteúdo, deduplicação e catálogo estão no manual.
- Não foram adicionadas dependências ou alterações ao lockfile nesta revisão 19A.1.

## Estado Git acumulado, sem staging

`git diff --stat` inclui somente os arquivos rastreados; os arquivos novos de
19A/19A.1 continuam untracked:

```text
 AI_CONTEXT.md              | 27 +++++++++++++++++++++++++++
 CHANGELOG.md               | 27 +++++++++++++++++++++++++++
 package.json               |  3 ++-
 packages/core/package.json |  3 ++-
 pnpm-lock.yaml             | 41 +++++++++++++++++++++++++++++++++++++++++
 pnpm-workspace.yaml        |  1 +
 6 files changed, 100 insertions(+), 2 deletions(-)
```

`git status --short`:

```text
 M AI_CONTEXT.md
 M CHANGELOG.md
 M package.json
 M packages/core/package.json
 M pnpm-lock.yaml
 M pnpm-workspace.yaml
?? docs/agents/
?? packages/adapter-openai/
?? packages/core/src/agents/
?? packages/core/test/legacy-product-version-parser.test.ts
?? packages/core/test/new-product-check-agent.test.ts
?? scripts/agents/
```

## Arquivos da revisão 19A.1


Criados (4):

- `packages/core/src/agents/legacy-product-version-parser.ts`
- `packages/core/src/agents/official-product-candidate-deduplication.ts`
- `packages/core/src/agents/official-product-candidate-validation.ts`
- `packages/core/test/legacy-product-version-parser.test.ts`

Alterados em rela??o ? 19A (18):

- `AI_CONTEXT.md`
- `CHANGELOG.md`
- `docs/agents/NEW_PRODUCT_CHECK_AGENT.md`
- `docs/agents/SPRINT_19A_VALIDATION.md`
- `docs/agents/prompts/new-product-check-agent-v1.md`
- `packages/adapter-openai/src/product-research-provider.ts`
- `packages/adapter-openai/src/product-research-schema.ts`
- `packages/adapter-openai/test/product-research-provider.test.ts`
- `packages/core/src/agents/index.ts`
- `packages/core/src/agents/new-product-check-agent.ts`
- `packages/core/src/agents/new-product-check-fixture.ts`
- `packages/core/src/agents/new-product-check-types.ts`
- `packages/core/src/agents/official-product-sources.ts`
- `packages/core/src/agents/product-candidate-matcher.ts`
- `packages/core/test/new-product-check-agent.test.ts`
- `scripts/agents/report-writer.ts`
- `scripts/agents/run-new-product-check.ts`
- `scripts/agents/test/new-product-check-cli.test.ts`

## Formata??o preexistente

```text
apps/web/src/app/(seller)/ver-modelo/page.tsx
apps/web/src/application/admin/admin-price-query.ts
apps/web/src/application/catalog/seller-product-eligibility.ts
apps/web/src/components/admin/admin-price-filters.tsx
apps/web/src/components/admin/admin-price-list.tsx
apps/web/src/components/application-topbar.tsx
apps/web/src/components/authenticated-navigation.tsx
apps/web/src/components/seller-model-picker.tsx
apps/web/src/components/seller-model-radar.tsx
apps/web/src/components/seller-nav.tsx
apps/web/src/components/user-menu.tsx
apps/web/test/seller-product-eligibility.test.ts
packages/adapter-supabase/src/product-public-price-supabase-adapter.ts
packages/core/src/repositories/product-public-price-repository.ts
scripts/data-refresh/run-msrp-history-import.ts
```
