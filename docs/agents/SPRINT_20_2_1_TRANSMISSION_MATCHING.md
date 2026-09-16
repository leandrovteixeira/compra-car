# Sprint 20.2.1 — Structured Transmission Matching Fix

## Fechamento real posterior

**SPRINT 20 — MODEL YEAR AGENT: COMPLETE / REAL STRUCTURED END-TO-END VALIDATED.**
Run `97ebfdad-4882-45fd-ae78-638cfa440ba7`, structured, COMPLETED, schema
`20.2-structured-v1`, informado pelo operador: 12/14 linhas matched, oito MMVs cobertos,
oito MODEL_YEAR_MATCHED, quatro NEW_MODEL_YEAR e 12 candidatos FIPE, zero OpenAI.
[Smoke final, findings e auditoria canônica](SPRINT_20_CHECKPOINT.md).
As seções abaixo registram a implementação e validação locais anteriores ao fechamento.

## Problema e correção

Run informado pelo operador: `efabe25f-34c9-4c8f-b419-0ac6090242ed`.
Três grupos, 14 linhas, dois matches e 12 linhas rejeitadas; 40 rejeições por target
com `STRUCTURED_VERSION_NOT_MATCHED`. Esses números são o relato de Staging,
não uma execução realizada nesta correção.

O parser local de transmissão não reconhecia o feminino português. Foi removido;
`normalizeTransmissionFamily()` é usado para ambos os lados. Famílias conhecidas
divergentes continuam rejeitadas (AT/CVT/MT/DHT); target desconhecido continua exigindo
contenção literal de todos os tokens. Nenhuma regex nova, regra VW ou dependência.

## Fixtures e equivalência com runtime

Fixture tipada como `ModelYearResearchTarget` preserva os campos informados do MMV:

| Modelo | Versões | Powertrain | Transmissão literal | Matches únicos |
| --- | --- | --- | --- | ---: |
| Nivus | Comfortline, Highline, Sense | 200 TSI | Automática de 6 velocidades | 3 |
| Nivus | GTS | 250 TSI | Automática de 6 velocidades | 1 |
| Taos | Comfortline, Highline | 250 TSI | Automática de 8 velocidades | 2 |
| Tera | Comfort, High | 170 TSI | Automático | 2 |

Nivus usa os quatro labels do pedido e, no gate do adapter, os fragmentos HTML reais
já versionados. Taos/Tera usam labels no formato Webmotors. Envelope, IDs, ano conhecido,
campos não informados e powertrain Tera são dados locais de teste; não são exportação
integral do banco. A fixture contém oito linhas relevantes, não as 14 linhas do run.

O gate anterior usava transmissão nula. Agora importa os mesmos targets Nivus do teste
de runtime, incluindo o valor feminino completo. O teste de runtime atravessa
`StructuredFirstModelYearResearch` e verifica oito matches, três grupos, zero rejeições
e nenhuma inicialização do fallback (mock local).

Antes da correção, a nova suíte reproduziu Nivus 0/4, Taos 0/2 e Tera 2/2:
18 testes passaram e três falharam. Após a correção, os 21 testes passaram.

## Validação

- Dirigidos core: 150 testes em quatro arquivos passaram, incluindo 21 novos testes.
- Adapter Webmotors: 29 testes em dois arquivos passaram; cinco são do gate real offline.
- Total dirigido: 179 testes em seis arquivos, sem falhas.
- Typecheck de core e adapter-webmotors: passou.
- `pnpm lint`: passou, dez tarefas sem cache.
- `pnpm build`: passou, build real sem cache (31 páginas), 1m26s.
- Prettier dos arquivos alterados: passou conforme configuração do repositório (Markdown ignorado).
- `git diff --check`: passou. Índice vazio, oito arquivos do escopo, sem mudanças protegidas.
- `pnpm typecheck` global: cinco TS2554 preexistentes em
  `apps/web/test/admin-product-public-prices.test.ts`, linhas 101–105;
  nove tarefas passaram, web falhou. Os dois pacotes desta correção passaram também isoladamente.
- `pnpm format:check` global: avisos em 611 arquivos não alterados nesta correção.
- `pnpm test` global: 1.433 passaram, um falhou, três ignorados (1.437 testes reportados).
  A falha interrompeu o pipeline antes das suítes dependentes restantes.

| Suíte dirigida | Testes aprovados |
| --- | ---: |
| model-year-transmission.test.ts (novo) | 21 |
| model-year-structured.test.ts | 29 |
| product-reconciliation.test.ts | 60 |
| mmv-product-reconciliation.test.ts | 40 |
| webmotors.test.ts | 24 |
| webmotors-real.test.ts | 5 |
| Total dirigido | 179 |

| Pacote na execução global | Passaram | Falharam | Ignorados |
| --- | ---: | ---: | ---: |
| core | 1116 | 0 | 0 |
| adapter-webmotors | 29 | 0 | 0 |
| pricing-dry-run | 71 | 0 | 0 |
| adapter-openai (mocks locais) | 86 | 0 | 0 |
| adapter-supabase (mocks locais) | 131 | 1 | 3 |
| Total reportado | 1433 | 1 | 3 |

Os totais dirigido/global se sobrepõem; não devem ser somados. A falha global está em
`product-public-price-supabase-adapter.test.ts:200`: o mock de paginação não implementa
`.in()`, chamado pelo adapter existente. Teste e implementação não foram alterados.
`RUN_SUPABASE_INTEGRATION_TESTS=false` desabilitou explicitamente as três integrações.
A primeira tentativa de Vitest no sandbox não iniciou workers (spawn EPERM); os resultados
acima são das execuções locais subsequentes autorizadas fora dessa restrição.
Logs completos ignorados pelo Git: `.local-reports/sprint-20-2-1/`.

## Arquivos alterados

- `packages/core/src/agents/model-year-structured-match.ts`
- `packages/core/test/model-year-transmission.test.ts`
- `packages/core/test/fixtures/model-year-mmv-discovery.ts`
- `packages/adapter-webmotors/test/webmotors-real.test.ts`
- `docs/agents/SPRINT_20_2_1_TRANSMISSION_MATCHING.md`
- `docs/agents/SPRINT_20_2_WEBMOTORS_REAL_GATE.md`
- `AI_CONTEXT.md`
- `CHANGELOG.md`

## Limites e escopo

Zero chamadas OpenAI, Supabase ou Webmotors durante a implementação local. Naquela etapa
não houve stage, commit ou push; a publicação da correção foi autorizada no fechamento final.
Preservados parser Webmotors, seleção de anos, MONITOR, hierarquia de fontes, parsing FIPE,
findings, matcher MMV, Brand Connector, fallback OpenAI, schema, migrations e Legacy.
Production Year permanece fora do escopo.

Smoke estruturado em Staging concluído conforme relato do operador no fechamento acima.
Runtime local é Node 24.18.0; validação específica no Node 22.x declarado pelo projeto
permanece pendente como limitação de ambiente, fora do fechamento funcional da Sprint 20.
