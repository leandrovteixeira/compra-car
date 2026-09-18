# Sprint 21.1 — Fechamento do primeiro smoke real

## Resultado

Implementação local concluída e gates scoped aprovados. O único smoke real terminou de forma controlada, mas **não demonstrou cobertura técnica útil**: 0 observações. A descoberta atual alcançou o índice oficial VW e não encontrou fonte técnica vinculada ao alvo. Sem novas chamadas após esse resultado.

## A. Workspace

- Workspace: `C:\Dev\compra-car-spec-intelligence`.
- Branch: `sprint-21-spec-intelligence`.
- HEAD inicial/final: `dcd67340b69415068ba1ada749865497697ad120`.
- Node portátil: `v22.23.2`; pnpm: `10.34.5`, selecionados explicitamente em cada shell com comandos Node/pnpm.
- Working tree inicial: clean. Índice final vazio.
- Node global preservado; nenhum setup adicional do runtime.

## B. Implementação

Contratos puros, alvo MMV + MY deduplicado, snapshots em memória, decisão de cache, aplicabilidade independente, tabelas HTML, DOM label/value, JSON-LD, GET HTTPS seguro, extração determinística e provider semântico estrito limitado. PDF possui boundary, mas permanece unsupported.

Reutilizados: CatalogMmvIdentity, `buildModelYearTargets`, Brand Connector ACTIVE/`connectorOfficialSource`/`officialEvidenceUrl`, leitores existentes de plataforma e catálogo, `loadAgentEnvironment`, `modelYearHtmlParser`, `BackgroundResearch` e redator de segredos.

O contexto Supabase usa subpath `@compra-car/adapter-supabase/spec-source-context`, exclusivo da composição do CLI. Não foi mantido no índice geral consumido pelo browser. Seu transporte bloqueia mutations, RPCs, tabelas de especificações e redirects.

Nenhuma dependência nova ou lockfile modificado.

### Arquivos novos

- `packages/core/src/agents/spec-source-types.ts`
- `packages/core/src/agents/spec-source.ts`
- `packages/core/test/spec-source.test.ts`
- `packages/adapter-openai/src/spec-source-provider.ts`
- `packages/adapter-openai/test/spec-source-provider.test.ts`
- `packages/adapter-supabase/src/spec-source-context.ts`
- `packages/adapter-supabase/test/spec-source-context.test.ts`
- `scripts/agents/spec-source-fetch.ts`
- `scripts/agents/spec-source-documents.ts`
- `scripts/agents/spec-source-runtime.ts`
- `scripts/agents/run-spec-source.ts`
- `scripts/agents/spec-source-cli.ts`
- `scripts/agents/spec-source.test.ts`
- `scripts/agents/fixtures/spec-source-jeep-matrix.html`
- `docs/agents/SPEC_SOURCE_AGENT_21.md`
- Este relatório.

### Arquivos com diff textual

- `package.json`: comando raiz.
- `packages/adapter-supabase/package.json`: subpath do contexto de leitura.
- `packages/core/src/agents/index.ts` e `packages/adapter-openai/src/index.ts`: exports.
- `docs/agents/AGENT_PLATFORM_ARCHITECTURE.md`: separação Source/Reconciliation e roadmap 19A–26.
- `AI_CONTEXT.md` e `CHANGELOG.md`: marco, resultado e limites.

## C. Validação offline

| Gate | Resultado final |
| --- | --- |
| Core Spec Source | 38 testes aprovados |
| Agents/parser/fetch/runtime/CLI | 37 testes aprovados |
| Provider OpenAI com transport mock | 8 testes aprovados |
| Fronteira Supabase com transport mock | 10 testes aprovados |
| Total dirigido | **93 aprovados** |
| CLI fixture | Exit 0, sem rede |
| Typecheck scoped dos quatro pacotes | Aprovado |
| Lint scoped dos quatro pacotes | Aprovado |
| Prettier dos arquivos alterados | Aprovado |
| Build local | Aprovado, sem cache, 4m6s |
| git diff --check | Aprovado |

Comandos dirigidos executados com `pnpm --filter <pacote> exec vitest run <arquivo>`. Arquivos: `test/spec-source.test.ts` no core; `spec-source.test.ts` nos agents; `test/spec-source-provider.test.ts` no adapter OpenAI; `test/spec-source-context.test.ts` no adapter Supabase.

Também executados todos os gates globais exigidos:

- `pnpm lint`: passou, 10 tarefas.
- `pnpm typecheck`: 9 tarefas passaram; cinco TS2554 preexistentes em `apps/web/test/admin-product-public-prices.test.ts:101–105`, já documentados no checkpoint 20.2.1.
- `pnpm test`: core reportou 1153 aprovados e 1 timeout de 5s em `commercial-document-domain-mapping.test.ts:106`, antes dos pacotes dependentes. O arquivo isolado no timeout padrão apresentou 3 timeouts (linhas 106, 180, 350). Diagnóstico final com `--testTimeout 20000`: 18/18 aprovados. Nenhum arquivo legado ou configuração de timeout foi alterado. O gate padrão não é declarado aprovado.
- `pnpm format:check`: inicialmente 612 avisos; um era do provider novo e foi corrigido. Verificação final de todos os arquivos alterados passou. Avisos de arquivos fora do escopo não foram corrigidos.
- `pnpm build`: primeira execução encontrou dependências Node entrando no browser pelo export geral do contexto novo; corrigido por subpath server-only. Build final completo passou.

As contagens dirigidas e globais se sobrepõem; não devem ser somadas. Logs locais: `.local-reports/agents/spec-source/validation/`.

## D. Único smoke real

Comando executado:

```powershell
pnpm agent:spec-source:dry-run -- --brand VW --model Nivus --version "Comfortline 200 TSI" --my 2026 --discovery-run 36c6d79b-45ca-49a6-abaa-66bd86d81d95 --provider hybrid --mode baseline --max-targets 1 --max-sources 3 --max-semantic-calls 1
```

- Exit: 0 (conclusão controlada, não prova de cobertura).
- Alvo resolvido: VW / Nivus / Comfortline 200 TSI / MY 2026.
- Versão do catálogo confirmada: Comfortline 1.0 TGDI AT.
- Discovery: `36c6d79b-45ca-49a6-abaa-66bd86d81d95`.
- Connector ACTIVE: `ed158a52-caf4-4688-a17f-28edbabb5d75`.
- OpenAI: **não chamado**; semanticCalls = 0. Não havia seção com binding comprovado que justificasse fallback.
- Supabase: apenas leituras de contexto, protegidas pelo transporte de leitura.
- Único GET oficial: `https://www.vw.com.br/pt/carros.html`.
- Tipo: OFFICIAL_HTML; HTTP 200; hostname final `www.vw.com.br`; MIME `text/html`; **827568 bytes**; zero redirects.
- Capturado em: `2026-09-16T18:41:09.312Z`.
- SHA-256: `c77cc2603031043bb232a5237bb0ad87c477d9e0f9881daa883b12c6062448f8`.
- 1 alvo elegível/selecionado/pesquisado; 1 fonte descoberta/fetched; 0 falhas de fetch.
- 0 documentos estruturados processados; 0 extrações determinísticas; 0 observações.
- 1 rejeição de documento: **NO_BOUND_TECHNICAL_FACTS**.
- 1 snapshot criado; 0 reusados. O smoke não repetiu fetch para testar cache; reuso/hash alterado são cobertos offline.
- `stoppedUnavailable=false`: não ocorreu 403/429/challenge.

Report integral local:

`.local-reports/agents/spec-source/2026-09-16T18-41-09-477Z.json`

O limite de três fontes é um teto. Não foram inventadas URLs para consumir o orçamento. O parser de descoberta não encontrou um link de modelo permitido nas estruturas que suporta. Isso **não prova que a VW não publique os dados**: o HTML completo não foi persistido e esta execução não permite concluir qual estrutura adicional seria necessária.

## E. Todas as observações reais

`observations = []`.

Não há labels, valores, unidades, polaridades ou bindings reais a listar. Dados de identidade já conhecidos, como “Automática de 6 velocidades” no Discovery, **não foram reciclados como observação técnica da nova fonte**.

## F. Invariantes

Confirmados: sem Production Year como dimensão de pesquisa; sem códigos canônicos; sem Spec Master no input; sem comparação com product_specs; sem escrita no banco; sem persistência Agent Platform; sem migration/DDL; sem imprensa, dealer, Webmotors ou fontes externas; sem pesquisa real Jeep/Toyota; sem stage, commit, push ou merge.

O teste Jeep é exclusivamente sintético/offline. Nenhum fato de Highline/GTS/Sense foi atribuído a Comfortline. Nenhum binding foi promovido para EXACT_VERSION no smoke.

## G. Git

`git status --short --untracked-files=all`, `git diff --stat`, `git diff --check` e índice vazio foram conferidos no fechamento. A lista final está no log local `validation/git-final.log`.

`git diff --stat` considera apenas arquivos já rastreados; os arquivos novos acima permanecem untracked, sem stage. O índice geral de adapter-supabase pode aparecer como M no status por normalização/stat após a remoção do export experimental, mas não possui diff textual.

## H. Avaliação

1. **Produziu observações técnicas úteis? Não neste smoke.** O alvo e o fetch funcionaram, mas a cobertura permaneceu zero.
2. **O que funcionou?** Reuso de identidade/connector, leitura isolada, GET oficial e auditoria/hash. HTML/DOM/JSON e aplicação das regras funcionaram nos testes offline.
3. **Onde falhou?** Descoberta de uma fonte técnica específica e extração com modelo/versão/MY comprovados a partir do índice genérico. Não é correto atribuir falta de dados ao fabricante.
4. **Pronto para Jeep + Toyota?** O contrato e as regressões são base para expandir; a cobertura real ainda não está demonstrada. Não recomendo ampliar pesquisas reais antes de fechar o gate VW.
5. **Menor próximo passo:** um gate de descoberta VW para inspecionar, em captura autorizada e sanitizada, a estrutura do índice que aponta para o Nivus. Adicionar fixture mínima e resolver uma URL técnica/configurador pelo próprio conteúdo oficial, preservando os mesmos limites e sem reconciliação canônica.

Execução encerrada após este relatório. Sem nova chamada real ou alteração funcional após o smoke.
