# Sprint 19C — Brand Connector Agent

## Fechamento técnico — COMPLETE / REAL CROSS-BRAND ONBOARDING VALIDATED

Workspace: `C:\Dev\compra-car-brand-connector`.
Branch: `sprint-19c-brand-connector-agent`.

Validação real end-to-end da VW confirmada pelo operador e registrada neste fechamento.
Os resultados abaixo foram fornecidos pelo operador; não houve nova execução OpenAI
nem consulta/escrita Supabase para conferi-los durante o fechamento documental.

### Brand Connector real

| Campo | Resultado |
| --- | --- |
| Run | `0495db0d-13dd-45d8-9097-2e3b9fb40758` |
| Resultado | `NEW_BRAND_CONNECTOR` |
| Canonical target | `VW / BR` |
| Observed label | `Volkswagen do Brasil` |
| Connector | `VW / BR ACTIVE v1` |
| Allowed domains | `vw.com.br`, `vwnews.com.br` |
| Finding de origem | `2e6c609a-99a1-40d5-97c2-6c232f6b54a3` |

### MMV real

Run `36c6d79b-45ca-49a6-abaa-66bd86d81d95`: **COMPLETED**, duração aproximada **4m12s**.

| Métrica | Total |
| --- | ---: |
| Models discovered | 14 |
| Variants resolved | 33 |
| Researched candidates | 36 |
| Canonical product rows | 32 |
| Known MMV identities | 17 |
| Matched candidates | 8 |
| Exact | 0 |
| Legacy naming | 8 |
| NEW_MODEL | 10 |
| NEW_VERSION | 0 |
| POSSIBLE_YEAR_CHANGE | 0 |
| AMBIGUOUS_MMV | 7 |
| Rejected candidates | 0 |
| Rejected external sources | 0 |

Agent Platform: **25 findings persistidos**, dos quais **17 exigem review** e
**8 são informativos MMV_MATCHED**. Evidence: **64 evidências**, **64/64 dentro dos
domínios permitidos pelo connector**. Total de connectors ativos após a validação: **3**.

Catálogo canônico preservado:

| Tabela | Linhas |
| --- | ---: |
| products | 277 |
| specs | 321 |
| product_specs | 37,949 |
| product_public_prices | 818 |

### Runtime, gates e follow-ups

A execução real foi realizada no ambiente local **Node 24.15.0**. O warning de engine
é conhecido e não bloqueou a validação funcional. **Node 22 runtime smoke permanece
PENDENTE**. Persistência de runs FAILED antes do mapeamento continua follow-up para
**Agent Platform/Orchestration**. A UX atual de agentes é provisória e será redesenhada
posteriormente.

Os gates reportados na [19C.4](SPRINT_19C4_BACKGROUND_RESEARCH.md) permanecem como
evidência técnica: 289 testes direcionados passaram; lint, build (cache), typechecks
direcionados e formatação dos arquivos alterados passaram. Gates globais mantêm
pendências preexistentes de tipos, timeout comercial e formatação. Neste fechamento,
somente documentação foi atualizada e `git diff --check` foi repetido.

Escopo consolidado: [19C.2](SPRINT_19C2_RUNTIME_HARDENING.md),
[19C.3](SPRINT_19C3_TRANSPORT_DIAGNOSTICS.md) e [19C.4](SPRINT_19C4_BACKGROUND_RESEARCH.md).
Migration alinhada a `20260914172157_sprint_19c_brand_connectors.sql`, sem mudança
de SQL; SHA-256 antes/depois:

```text
740f0f0cab9e13ae42d6e714b1df8f91d873b28f30b9c977719d3519b6fb0411
```

Fechamento autorizado para commit `feat(agent): harden connector runtime and MMV research`
e push apenas da branch de sprint, sem merge para main. Sem novos calls OpenAI,
acesso Supabase, migration, alteração funcional, matcher ou connectors ativos.
Arquivos de ambiente, secrets, reports locais e artefatos temporários/cache ficam fora do commit.

## Registro histórico — implementação e validação local inicial

As seções abaixo preservam o relatório da implementação inicial, anterior à aplicação
em Staging e à validação real acima. Referências a pendências de primeira execução,
índice vazio e ausência de commit/push descrevem exclusivamente aquela etapa histórica.

Workspace: `C:\Dev\compra-car-brand-connector`.
Branch: `sprint-19c-brand-connector-agent`.
HEAD inicial e final: `3c7a82c256985f70d3fee641230f2d6c0764c026`.
O workspace estava limpo antes da implementação. O workspace separado `C:\Dev\compra-car`
e suas alterações preexistentes foram preservados. Sem staging, commit ou push.

## Escopo entregue

| Item solicitado | Entrega |
| --- | --- |
| 1. HEAD inicial | `3c7a82c256985f70d3fee641230f2d6c0764c026` |
| 2. Migration | `20260914172157_sprint_19c_brand_connectors.sql`, criada via CLI, aplicada apenas em PostgreSQL local descartável |
| 3. Brand target | Identidade `(market, brand_key)`, origens CATALOG/MANUAL, enabled e autoria |
| 4. Catalog sync | Leitura paginada por id, avanço pelo tamanho recebido, upserts idempotentes, targets manuais/pausados preservados |
| 5. Connector schema | Domínios, source entries tipadas, search hints e terminology hints |
| 6. Versioning | ACTIVE/SUPERSEDED, v1/v2, histórico e índice parcial de ACTIVE único |
| 7. Validation | Limites, tipos, URLs HTTP(S), hostname seguro, recusa de IPs/localhost/credenciais/esquemas/sufixos maliciosos |
| 8. Fingerprint | SHA-256 da definição normalizada, arrays ordenados/deduplicados, sem dados de execução |
| 9. Agent | BrandConnectorAgent com provider próprio e prompt genérico |
| 10. Discovery | NEW_BRAND_CONNECTOR com revisão obrigatória e evidências separadas |
| 11. Health | HEALTHY informativo ou DRIFT revisável; drift pode ficar sem proposal ativável quando não há substituição segura |
| 12. Platform | BRAND_CONNECTOR, UUID preservado, findings/evidências, replay idempotente |
| 13. Activation | ACCEPT separado de ação admin explícita; revalidação transacional, idempotência e bloqueio de proposta antiga |
| 14. MMV resolver | ACTIVE operacional primeiro, fallback controlado, parser independente do registry |
| 15. Toyota/Jeep | Regressões passaram; bootstrap comparado com built-ins, inclusive política de hostname na resolução |
| 16. Admin Brands | `/admin/agents/brands`, navegação e última run por marca/mercado |
| 17. Add Brand | Ação admin, sem criação de Product |
| 18. Sync Catalog | Botão explícito, contagens de novas/existentes, nenhum write no page load |
| 19. Pause/enable | Altera somente monitoramento; mantém histórico e configuração ativa |
| 20. Connector detail | Status, versão, domínio, fontes, hints, autoria e histórico |
| 21. Proposal UI | Domínios/fontes/hints/avisos/evidências legíveis, ação de ativação separada |
| 22. Tests | 71 testes novos; 296 testes no conjunto direcionado e de regressão, todos passaram |
| 23. Gates | Build e lint passaram; tipos, testes e formatação globais têm baseline preexistente, detalhado abaixo |
| 24. Migration validation | PostgreSQL 15 local, service_role, review gates, RLS/grants, v1/v2, idempotência, concorrência e rollback |
| 25–28. Arquivos e Git | Inventário, diff stat e status abaixo; índice vazio |
| 29. Limitações | Sem pesquisa real, aplicação remota ou validação visual em browser; Node 24 disponível versus Node 22 declarado |
| 30. Confirmações | Zero OpenAI, writes Supabase remotos/canônicos/specs/preços, scheduler e branching de marca no matcher |

## Validações direcionadas

| Suite | Testes que passaram |
| --- | ---: |
| Core: brand connector, new product check, cross-brand e Agent Platform | 197 |
| adapter-openai: providers MMV e Brand Connector | 23 |
| adapter-supabase: Brand Connector, Agent Platform e migration 19B | 20 |
| CLI: Brand Connector e MMV | 23 |
| Admin: Brand Connector e Agent Platform | 33 |
| Total | 296 |

Todos os providers de pesquisa foram fixtures ou transports injetados. Os testes do adapter
usam o SDK Supabase com fetch mockado. A migration foi executada separadamente em
PostgreSQL 15 num container `--network none`, sem portas expostas. Nenhum teste dependeu
de Supabase remoto. Os 19 testes iniciais de adapter foram complementados por um teste
de ativação através do SDK; a suite Brand Connector final tem seis testes.

Os testes SQL executam como `service_role`, verificam OPEN/REJECT/DEFER, run não concluída,
ACCEPT sem ativação, v1, repetição idempotente, drift criando v2, v1 SUPERSEDED, histórico,
ACTIVE único, rejeição de proposta antiga, RLS e ausência de grants/RPC para browser.
Os cenários transacionais usam rollback. Um teste adicional com duas sessões concorrentes
ativou o mesmo finding: ambas retornaram v1; a contagem final foi uma versão e um ACTIVE.

## CLI executado sem persistência

| Cenário fixture | Run UUID | Resultado |
| --- | --- | --- |
| Volkswagen discovery | `c0130945-9f19-4509-90a5-336c76cb49ac` | NEW_BRAND_CONNECTOR |
| Jeep health-check | `71a0ce8f-86ca-4b41-84a0-ad133b8ce9b0` | CONNECTOR_HEALTHY |
| Volkswagen drift | `13edef48-6d5d-4b0b-a0cd-9be4657757c4` | CONNECTOR_DRIFT |

Reports JSON e Markdown em `.local-reports/agents/brand-connector/`. São sintéticos e
não indicam descoberta atual real. O opt-in `--persist-findings` foi validado apenas com mocks.

## Gates globais e baseline

Uma cópia exata do HEAD 19B foi extraída com `git archive` para `.local-reports/baseline-19b`.
As dependências foram instaladas do lockfile/cache e os gates abaixo foram comparados.
Não houve correção dos módulos preexistentes fora do escopo.

- `pnpm lint`: passou.
- `pnpm build`: passou, incluindo as novas rotas. O adapter foi isolado em
  `@compra-car/adapter-supabase/brand-connectors`, evitando import de Node crypto no middleware Edge.
- `pnpm typecheck`: permanece com os mesmos cinco TS2554 da base em
  `apps/web/test/admin-product-public-prices.test.ts`, linhas 101–105. Nenhum erro 19C restante.
- `pnpm test`: o timeout de 5s em `commercial-document-domain-mapping.test.ts`
  (Fiat-like recipients) interrompe o Turbo; reproduzido na base. Executado também
  `turbo run test --continue` para verificar os pacotes dependentes.
- Nas suites globais completas, a mesma falha de mock `.in is not a function` em
  `product-public-price-supabase-adapter.test.ts` e os mesmos nove testes de Admin/UI
  falham na base: um de preços públicos, cinco de navegação, dois de mobile PWA e um de instalação.
- `pnpm format:check`: baseline tem 560 arquivos com pendências; a rodada final tem
  537, sem warnings novos. O check dos 34 arquivos de código/configuração alterados passou.
- `git diff --check`: passou; nenhum diff em Legacy ou no matcher.

Logs locais são ignorados pelo Git. Node disponível: 24.15.0; pnpm 10.34.5;
o projeto declara Node 22.x. Não foi afirmada validação em Node 22.

## Limitações e pendências

- **PENDENTE**: revisão humana e autorização antes de migration remota, target real,
  ativação real ou primeiro discovery OpenAI (sugestão futura: Volkswagen).
- **PENDENTE fora de escopo**: corrigir os gates preexistentes descritos acima e confirmar Node 22.
- UI validada por renderização server-side e testes de aplicação/autorização; não houve
  navegação visual manual ou E2E com browser conectado a Staging.
- Health é web research, sem scraper próprio. Validação de URL não consulta DNS;
  qualquer futuro fetch direto precisa validar resolução DNS e redirects.
- Sync do catálogo é paginado, não snapshot transacional. Novas linhas concorrentes
  podem aparecer apenas na próxima sincronização. Leituras administrativas atuais
  materializam targets/runs e podem precisar de otimização com maior volume.
- Heurística de health é conservadora: warnings/incerteza geram review. Um drift sem
  replacement seguro mantém o ACTIVE anterior e exige nova pesquisa antes da ativação.
- Capability de execução periódica existe; scheduling/orquestração apenas na Sprint 23.
  Não foram implementados Product Year, specs, preços ou redesign completo da Sprint 24.

## Fechamento Git e arquivos

O `git diff --stat` inclui somente arquivos já rastreados. Arquivos novos não foram
adicionados ao índice e aparecem no inventário separado. Nenhum segredo foi incluído.

<!-- FINAL_INVENTORY -->

16 arquivos rastreados modificados e 26 arquivos novos. Índice vazio. O container local
de validação foi encerrado/removido após os testes.

### Arquivos criados

- `apps/web/src/app/admin/agents/brands/[id]/page.tsx`
- `apps/web/src/app/admin/agents/brands/actions.ts`
- `apps/web/src/app/admin/agents/brands/page.tsx`
- `apps/web/src/application/admin/brand-connectors.ts`
- `apps/web/src/components/admin/brand-connector-form.tsx`
- `apps/web/src/components/admin/brand-connector-view.tsx`
- `apps/web/test/brand-connectors.test.tsx`
- `docs/agents/BRAND_CONNECTOR_AGENT_19C.md`
- `docs/agents/SPRINT_19C_VALIDATION.md`
- `docs/agents/prompts/brand-connector-agent-v1.md`
- `packages/adapter-openai/src/brand-connector-research-provider.ts`
- `packages/adapter-openai/test/brand-connector-research-provider.test.ts`
- `packages/adapter-supabase/src/brand-connector-supabase-adapter.ts`
- `packages/adapter-supabase/test/brand-connector.test.ts`
- `packages/core/src/agents/brand-connector-agent.ts`
- `packages/core/src/agents/brand-connector-fixture.ts`
- `packages/core/src/agents/brand-connector-resolver.ts`
- `packages/core/src/agents/brand-connector-types.ts`
- `packages/core/src/agents/brand-connector-validation.ts`
- `packages/core/test/brand-connector.test.ts`
- `scripts/agents/brand-connector-cli.ts`
- `scripts/agents/export-brand-connector-bootstrap.ts`
- `scripts/agents/run-brand-connector.ts`
- `scripts/agents/test/brand-connector-cli.test.ts`
- `supabase/migrations/20260914172157_sprint_19c_brand_connectors.sql`
- `supabase/tests/brand_connector_19c_local.sql`

### Arquivos modificados

- `AI_CONTEXT.md`
- `CHANGELOG.md`
- `apps/web/src/app/admin/agents/findings/[id]/page.tsx`
- `apps/web/src/app/admin/agents/page.tsx`
- `apps/web/src/components/admin/agent-platform-views.tsx`
- `docs/agents/AGENT_PLATFORM_ARCHITECTURE.md`
- `package.json`
- `packages/adapter-openai/src/index.ts`
- `packages/adapter-openai/src/product-research-provider.ts`
- `packages/adapter-supabase/package.json`
- `packages/core/src/agent-platform/types.ts`
- `packages/core/src/agents/index.ts`
- `packages/core/src/agents/new-product-check-agent.ts`
- `packages/core/src/agents/new-product-check-types.ts`
- `scripts/agents/run-new-product-check.ts`
- `scripts/agents/test/new-product-check-cli.test.ts`

### git diff --stat

```text
 AI_CONTEXT.md                                      | 15 +++++++++
 CHANGELOG.md                                       | 11 ++++++
 .../src/app/admin/agents/findings/[id]/page.tsx    | 16 +++++++++
 apps/web/src/app/admin/agents/page.tsx             |  6 ++++
 .../src/components/admin/agent-platform-views.tsx  | 30 +++++++++++++++--
 docs/agents/AGENT_PLATFORM_ARCHITECTURE.md         | 16 +++++++++
 package.json                                       |  3 +-
 packages/adapter-openai/src/index.ts               |  1 +
 .../src/product-research-provider.ts               |  5 +--
 packages/adapter-supabase/package.json             |  3 +-
 packages/core/src/agent-platform/types.ts          |  2 ++
 packages/core/src/agents/index.ts                  |  5 +++
 .../core/src/agents/new-product-check-agent.ts     |  8 +++--
 .../core/src/agents/new-product-check-types.ts     |  5 ++-
 scripts/agents/run-new-product-check.ts            | 39 +++++++++++++++++++---
 scripts/agents/test/new-product-check-cli.test.ts  |  3 +-
 16 files changed, 151 insertions(+), 17 deletions(-)
```

### git status --short -uall

```text
 M AI_CONTEXT.md
 M CHANGELOG.md
 M apps/web/src/app/admin/agents/findings/[id]/page.tsx
 M apps/web/src/app/admin/agents/page.tsx
 M apps/web/src/components/admin/agent-platform-views.tsx
 M docs/agents/AGENT_PLATFORM_ARCHITECTURE.md
 M package.json
 M packages/adapter-openai/src/index.ts
 M packages/adapter-openai/src/product-research-provider.ts
 M packages/adapter-supabase/package.json
 M packages/core/src/agent-platform/types.ts
 M packages/core/src/agents/index.ts
 M packages/core/src/agents/new-product-check-agent.ts
 M packages/core/src/agents/new-product-check-types.ts
 M scripts/agents/run-new-product-check.ts
 M scripts/agents/test/new-product-check-cli.test.ts
?? apps/web/src/app/admin/agents/brands/[id]/page.tsx
?? apps/web/src/app/admin/agents/brands/actions.ts
?? apps/web/src/app/admin/agents/brands/page.tsx
?? apps/web/src/application/admin/brand-connectors.ts
?? apps/web/src/components/admin/brand-connector-form.tsx
?? apps/web/src/components/admin/brand-connector-view.tsx
?? apps/web/test/brand-connectors.test.tsx
?? docs/agents/BRAND_CONNECTOR_AGENT_19C.md
?? docs/agents/SPRINT_19C_VALIDATION.md
?? docs/agents/prompts/brand-connector-agent-v1.md
?? packages/adapter-openai/src/brand-connector-research-provider.ts
?? packages/adapter-openai/test/brand-connector-research-provider.test.ts
?? packages/adapter-supabase/src/brand-connector-supabase-adapter.ts
?? packages/adapter-supabase/test/brand-connector.test.ts
?? packages/core/src/agents/brand-connector-agent.ts
?? packages/core/src/agents/brand-connector-fixture.ts
?? packages/core/src/agents/brand-connector-resolver.ts
?? packages/core/src/agents/brand-connector-types.ts
?? packages/core/src/agents/brand-connector-validation.ts
?? packages/core/test/brand-connector.test.ts
?? scripts/agents/brand-connector-cli.ts
?? scripts/agents/export-brand-connector-bootstrap.ts
?? scripts/agents/run-brand-connector.ts
?? scripts/agents/test/brand-connector-cli.test.ts
?? supabase/migrations/20260914172157_sprint_19c_brand_connectors.sql
?? supabase/tests/brand_connector_19c_local.sql
```
