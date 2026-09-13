# Sprint 19A — histórico de validação (19A.1–19A.4)

## Entrega atual: 19A.4 — MMV Identity Reconciliation + Agent Platform Blueprint

Worktree `C:\Dev\compra-car-agent1`, branch `sprint-19-new-product-agent`.
Antes de qualquer alteração, `git status --short` estava vazio; HEAD inicial:
**8140a10** (19A.3 já commitada pelo operador). Trabalho anterior preservado.
**Sem commit e sem staging.**

### Decisão implementada

O nome histórico New Product Check Agent passa a representar a missão
**MMV Discovery**. MMV = marca/modelo/identidade de versão; product row =
ocorrência MMV + PY/MY. A separação é virtual, sem nova tabela.

`CatalogMmvIdentity` agrupa rows por brand/model/canonical version label
normalizados. Preserva nomes originais, componentes históricos e todas as
productRows com ids, anos e estados. Não consolida rótulos canônicos diferentes
por semelhança e não usa anos ou visibilidade na identidade.

A aplicação projeta uma vez por run. Matching intersecta MMVs por trim,
propulsão, cilindrada, família de transmissão e tração. Zero MMVs compatíveis
→ NEW_VERSION; uma segura → MATCHED; múltiplas distintas → AMBIGUOUS.
Quatro ocorrências anuais de uma versão não são quatro opções de identidade.

Cilindrada usa precisão decimal comum e half-up com decimal.js já existente:
1.332/1.3, 1.995/2.0 e 2.184/2.2 são compatíveis. 1.8/2.0 e 1.3/1.5 não são.
Precisão canônica explícita é preservada; 1.332 versus 1.30 conflita na precisão
de duas casas. Sem fuzzy ou epsilon arbitrário.

Engine labels e nomes comerciais de powertrain são metadados. Não existe mapa
T270/Hurricane para motor. Delimitação de um sufixo histórico só usa o rótulo
de powertrain literalmente fornecido no candidato. AT aceita Automático/
Automática; TD é descritor histórico genérico. Tração ausente não conflita;
4x4/4x2 explícitos continuam incompatíveis.

PY/MY fica no candidato/report e em yearObservations de observações repetidas.
Não rejeita/desempata MMV, não cria conflito por anos diferentes e não gera
POSSIBLE_YEAR_CHANGE. O enum permanece definido para compatibilidade histórica.
O futuro Product Year Agent será responsável por NEW_PRODUCT_YEAR.

JSON schemaVersion 19A.4 contém canonicalProductRows, knownMmvIdentities e
matchedMmvIdentities, com productRows associadas. Os campos planos antigos de
rows permanecem para compatibilidade. Benchmark usa MMVs no denominador.

### Fixtures e regressão capturada executadas

| Métrica | Toyota | Jeep pequena | Jeep capturada/reconstruída |
| --- | ---: | ---: | ---: |
| canonicalProductRows | 8 | 4 | 16 |
| knownMmvIdentities | 8 | 4 | 13 |
| officialCandidates | 21 | 8 | 18 |
| matchedMmvCandidates | 8 | 4 | 13 |
| reconciledKnownMmvIdentities | 8 | 4 | 13 |
| knownReconciliationRate | 100% | 100% | 100% |
| falseNewMmv / falseNewRate | 0 / 0% | 0 / 0% | 0 / 0% |
| NEW_MODEL | 3 | 1 | 3 |
| NEW_VERSION | 2 | 1 | 0 |
| AMBIGUOUS | 1 | 1 | 0 |
| Rejeitados / fontes externas rejeitadas | 0 / 0 | 0 / 0 | 0 / 0 |

Todos os matches são LEGACY_NAMING. As fixtures Toyota/Jeep pequenas mantêm
seus dados e resultados anteriores. Comandos, ambos exit 0:

```powershell
pnpm agent:new-products:dry-run -- --brand Toyota --provider fixture
pnpm agent:new-products:dry-run -- --brand Jeep --provider fixture
```

Runs geradas:

- Toyota: `e2d77654-1e76-4f9b-a298-e99fadbbfaae`.
- Jeep pequena: `ead21b24-a542-4cf6-acc3-f9930ca86da3`.
- Replay capturado offline: `55872347-3ff3-4b31-b883-8acdd4bafed1`.

JSON/Markdown em `.local-reports/agents/new-product-check/<run-id>.{json,md}`.
Replay e métricas reproduzíveis locais:
`validation/19a4/replay-captured.ts` e `captured-benchmark.json`.
O replay usa somente um provider fixture e catálogo em memória, sem rede.

**Limite de proveniência:** a run original
2506bcb5-7ff7-4529-bbd2-29b51efd5778 tinha 18 candidatos e 51 rows, segundo o
report salvo. Os 18 candidatos foram copiados da captura, preservando fatos e
evidências. Apenas seis rows estavam guardadas nas correspondências do report.
A fixture acrescenta dez rows sintéticas baseadas nos casos fornecidos pelo
operador: total **16 rows / 13 MMVs**, sem afirmar reconstrução das 51 rows.

Commander Longitude reconcilia uma MMV com ids 960, 996, 1064 e 1128 e seus
quatro PY/MY. Os outros doze candidatos conhecidos também reconciliam.
As cinco variantes Avenger/Gladiator/Wrangler permanecem em três NEW_MODEL.

### Blueprint criado

[AGENT_PLATFORM_ARCHITECTURE.md](AGENT_PLATFORM_ARCHITECTURE.md) é a referência
canônica para Brand Connector, MMV Discovery, Product Year, Spec Intelligence
e Price Intelligence. Documenta orchestrator/scheduler como infraestrutura,
não sexto especialista; plataforma 19B (agent_runs/findings/evidence/reviews);
taxonomia futura; connector declarativo; review humano e limites até Sprint 23.

Somente o agente atual foi alterado. Nenhum agente futuro, plataforma persistida,
tabela, migration, review operacional ou scheduler foi implementado.

### Testes e gates executados

| Verificação | Resultado |
| --- | --- |
| Core direcionado: new-product-check-agent, legacy-product-version-parser, product-reconciliation, cross-brand-product-check e mmv-product-reconciliation | **242 passed** |
| CLI/report: new-product-check-cli | **13 passed** |
| Provider: product-research-provider, transporte simulado | **17 passed** |
| Total direcionado | **272 passed** |
| Core completo no gate global | **898 passed** |
| Typecheck core e scripts/agents direcionados | exit 0 |
| pnpm lint | exit 0, após corrigir variável descartada na projeção |
| pnpm typecheck | exit 1; mesmos cinco TS2554 da 19A.3 |
| pnpm test | exit 1; mesma falha de preços públicos |
| pnpm format:check | exit 1; mesmos 15 arquivos |
| pnpm build | exit 0 |
| Prettier de todos os arquivos de código alterados | exit 0 |
| git diff --check | exit 0 |

Os 35 critérios obrigatórios estão cobertos: agrupamento e anos, match com
múltiplas rows e exposição de todas elas, precisão da cilindrada, labels
informativos, restrições ICE/MHEV e tração, AT, os treze casos capturados,
regressão Toyota, agregação NEW_MODEL, ambiguidade MMV real, ausência de mutação
e JSON/Markdown de uma MMV com quatro rows.

Também há regressões para zeros finais de precisão, fronteira half-up,
preservação de pares de anos sem composição artificial e benchmark sem
denominador de rows. Testes anteriores que esperavam ambiguidade por anos ou
POSSIBLE_YEAR_CHANGE foram substituídos pelo comportamento MMV.

Comandos direcionados:

```powershell
pnpm --filter @compra-car/core exec vitest run test/new-product-check-agent.test.ts test/legacy-product-version-parser.test.ts test/product-reconciliation.test.ts test/cross-brand-product-check.test.ts test/mmv-product-reconciliation.test.ts
pnpm --filter @compra-car/agents test
pnpm --filter @compra-car/adapter-openai exec vitest run test/product-research-provider.test.ts
pnpm --filter @compra-car/core --filter @compra-car/agents typecheck
```

Logs: `validation/19a4/final-*.log`. Comparação automatizada com 19A.3 em
`validation/19a4/diagnostic-comparison.json`: **sameAs19A3=true** para
typecheck, testes e formatação. Os erros preexistentes continuam:

- Cinco TS2554 em `apps/web/test/admin-product-public-prices.test.ts:101–105`.
- `product-public-price-supabase-adapter.test.ts`: lists a page with exact count
  and deterministic range; `.in is not a function`. Pacote: 1 failed,
  108 passed, 3 skipped.
- Os 15 arquivos de formatação listados no histórico deste documento.

Smokes OpenAI, benchmark remoto Jeep e integrações Supabase/staging foram
desabilitados no processo dos gates. O Turbo pode interromper tarefas após
falhas; suítes do escopo foram executadas separadamente. Ambiente Node 24.18.0 /
pnpm 10.34.5; warning conhecido do Node 22.x declarado.

### Arquivos e Git

Criados (4):

- `docs/agents/AGENT_PLATFORM_ARCHITECTURE.md`
- `packages/core/src/agents/catalog-mmv-identity.ts`
- `packages/core/src/agents/jeep-captured-mmv-fixture.ts`
- `packages/core/test/mmv-product-reconciliation.test.ts`

Alterados (19):

- `AI_CONTEXT.md`
- `CHANGELOG.md`
- `docs/agents/NEW_PRODUCT_CHECK_AGENT.md`
- `docs/agents/CROSS_BRAND_BENCHMARK.md`
- `docs/agents/SPRINT_19A_VALIDATION.md`
- `packages/core/src/agents/index.ts`
- `packages/core/src/agents/legacy-product-version-parser.ts`
- `packages/core/src/agents/new-product-check-agent.ts`
- `packages/core/src/agents/new-product-check-fixture.ts`
- `packages/core/src/agents/new-product-check-types.ts`
- `packages/core/src/agents/official-product-candidate-deduplication.ts`
- `packages/core/src/agents/product-candidate-matcher.ts`
- `packages/core/src/agents/product-check-fixture-benchmark.ts`
- `packages/core/src/agents/product-component-normalization.ts`
- `packages/core/test/cross-brand-product-check.test.ts`
- `packages/core/test/new-product-check-agent.test.ts`
- `scripts/agents/report-writer.ts`
- `scripts/agents/run-new-product-check.ts`
- `scripts/agents/test/new-product-check-cli.test.ts`

Status final: 19 modificados + 4 novos; índice vazio. Auditoria local:
`validation/19a4/git-audit.json`. Sem alterações de registry, prompt, provider,
domains, modelo, catalog reader, dependências/lockfile, banco ou Legacy.

### Limitações e confirmação

**PENDENTE:** snapshot completo das 51 rows para conferir todas as identidades
concorrentes; run real manual somente após revisão. O resultado 13/13 prova a
regressão dos casos capturados no catálogo reconstruído, não um replay integral
da base real. Os problemas globais preexistentes seguem fora do escopo.

A projeção não une versões históricas distintas por semântica; nomes não
interpretáveis e fatos insuficientes continuam sujeitos a revisão. JSON numérico
perde zeros finais oficiais; a regra de precisão mínima foi documentada. Nenhuma
disponibilidade atual ou fidelidade da pesquisa foi revalidada remotamente.

**Zero OpenAI calls durante a Sprint 19A.4; zero canonical writes; zero migrations;
zero renames; zero Jeep-specific matcher. Sem commit e sem staging.**

## Histórico da entrega 19A.3 — Cross-brand validation / Jeep BR

Worktree `C:\Dev\compra-car-agent1`, branch `sprint-19-new-product-agent`.
Base limpa observada: **cf041ee**, com a 19A.2 já commitada pelo operador.
Esta Sprint permanece **sem commit e sem staging**.

### Resultado e reutilização

Jeep/BR adicionada ao registry com jeep.com.br e subdomínios DNS por opt-in
declarativo, sem autorizar domínios externos Stellantis. Search hints incluem
versões, ficha técnica, configurador, T270, T270 MHEV, Hurricane e Hurricane Flex.
A política Toyota de hosts exatos permaneceu intacta.

O matcher existente reconciliou os casos Jeep sem alterações. Não há
JeepMatcher, branching Jeep na identidade nem tradução hardcoded de powertrain
para motor. T270/Hurricane permanecem rótulos comerciais; cilindrada só participa
quando explícita. A ausência desse rótulo no legado não cria conflito.

Exceções necessárias à extensão: o registry anterior só selecionava Toyota,
aceitava apenas hosts exatos e o prompt fixava consultas site:toyota.com.br.
Foram adicionados seleção por marca/mercado e allowedSubdomainRoots; o provider
recebe essa política no input e o prompt usa hints/domínios configurados.
Modelo, Responses API, estratégia, schema de pesquisa e permissões de escrita
não foram alterados.

Matcher, parser, component normalization, aplicação/classificação, agregação,
catalog reader e report writer: **sem diff**. Contrato de findings e relatórios
permanece schemaVersion 19A.2. A extensão de tipo afeta apenas configuração de fontes.

### Fixtures e benchmark

| Métrica | Toyota | Jeep |
| --- | ---: | ---: |
| Candidatos / variantes resolvidas / modelos | 21 / 20 / 5 | 8 / 7 / 3 |
| knownProducts | 8 | 4 |
| reconciledKnownProducts | 8 | 4 |
| knownReconciliationRate | 100% | 100% |
| falseNewProducts / falseNewRate | 0 / 0% | 0 / 0% |
| EXACT_OFFICIAL / LEGACY_NAMING | 0 / 8 | 0 / 4 |
| NEW_MODEL | 3 | 1 |
| NEW_VERSION | 2 | 1 |
| AMBIGUOUS | 1 | 1 |
| Rejeitados / fontes externas rejeitadas | 0 / 0 | 0 / 0 |

Comandos executados, ambos **exit 0**:

```powershell
pnpm agent:new-products:dry-run -- --brand Toyota --provider fixture
pnpm agent:new-products:dry-run -- --brand Jeep --provider fixture
```

Runs finais:

- Toyota: `256a4faf-8569-4f44-a072-9543e23a4da5`.
- Jeep: `3d53b88b-d410-450c-bcf9-3ade7f361c5d`.

Relatórios JSON/Markdown existentes em
`.local-reports/agents/new-product-check/<run-id>.{json,md}`, ignorados pelo Git.
Jeep: Commander agregado com Limited/Overland Hurricane; Blackhawk Hurricane Flex
como NEW_VERSION; Compass sem variante como AMBIGUOUS. Toyota preserva os dados
e resultados sintéticos da 19A.2.

Benchmark é um helper puro com gabarito declarado na fixture. Não deriva a verdade
esperada da saída do matcher. CLI imprime métricas somente em provider fixture;
runs reais não recebem exigência artificial de 100% ou zero ambiguidades.
Definições, denominadores, regressões do próprio benchmark e limites:
[CROSS_BRAND_BENCHMARK.md](CROSS_BRAND_BENCHMARK.md).

### Testes e gates executados

| Verificação | Resultado |
| --- | --- |
| Core: new-product-check-agent, legacy-product-version-parser, product-reconciliation, cross-brand-product-check | **204 passed** |
| CLI/report: new-product-check-cli | **12 passed** |
| Provider OpenAI: product-research-provider, transporte simulado | **17 passed** |
| Total direcionado | **233 passed** |
| Suíte completa core no gate global | **860 passed** |
| Typecheck core, adapter-openai e scripts/agents direcionados | exit 0 |
| pnpm lint | exit 0 |
| pnpm typecheck | exit 1; mesmos cinco TS2554 |
| pnpm test | exit 1; mesma falha de preços públicos |
| pnpm format:check | exit 1; mesmos 15 arquivos |
| pnpm build | exit 0 |
| Prettier dos arquivos de código alterados | exit 0 |
| git diff --check | exit 0 |

Os 20 critérios obrigatórios estão cobertos: registry e hosts Jeep verdadeiros/
falsos; nomes T270/Hurricane preservados; nenhuma cilindrada inventada; T270 com
componentes explícitos; MHEV versus ICE; Blackhawk nova; Commander agregado;
Compass ambíguo; regressão Toyota; benchmark 100%/zero falso novo; mesmas regras
sob marca sintética no matcher; capacidades somente de leitura e reports Jeep.

O benchmark também detecta regressões injetadas: falso NEW_VERSION sem matched
ids, falso NEW_MODEL com projeção model-level e id canônico incorreto; preserva
reconciliação de year change e usa taxas null se não houver produtos conhecidos.

Comandos direcionados:

```powershell
pnpm --filter @compra-car/core exec vitest run test/new-product-check-agent.test.ts test/legacy-product-version-parser.test.ts test/product-reconciliation.test.ts test/cross-brand-product-check.test.ts
pnpm --filter @compra-car/agents test
pnpm --filter @compra-car/adapter-openai exec vitest run test/product-research-provider.test.ts
pnpm --filter @compra-car/core --filter @compra-car/adapter-openai --filter @compra-car/agents typecheck
```

Logs: `validation/19a3/final-*.log` no diretório local de reports.
Comparação automatizada com logs 19A.2:
`validation/19a3/diagnostic-comparison.json`, **sameAs19A2=true** para typecheck,
testes e formatação. Erros preexistentes:

- Cinco TS2554 em `apps/web/test/admin-product-public-prices.test.ts:101–105`.
- `product-public-price-supabase-adapter.test.ts`: lists a page with exact count
  and deterministic range; `.in is not a function`. Pacote: 1 failed,
  108 passed, 3 skipped.
- Os 15 arquivos de formatação estão listados no histórico ao final deste documento.

O Turbo encerra tarefas após falha; as suítes do agente foram executadas
separadamente. Flags de smoke OpenAI, benchmark remoto Jeep e integrações
Supabase/staging foram desabilitadas no processo dos gates, sem mudar configuração
persistida. Node 24.18.0 / pnpm 10.34.5; warning conhecido de Node 22.x declarado.

### Arquivos e Git

Criados (4):

- `docs/agents/CROSS_BRAND_BENCHMARK.md`
- `packages/core/src/agents/jeep-product-check-fixture.ts`
- `packages/core/src/agents/product-check-fixture-benchmark.ts`
- `packages/core/test/cross-brand-product-check.test.ts`

Alterados (14):

- `AI_CONTEXT.md`
- `CHANGELOG.md`
- `docs/agents/NEW_PRODUCT_CHECK_AGENT.md`
- `docs/agents/SPRINT_19A_VALIDATION.md`
- `docs/agents/prompts/new-product-check-agent-v1.md`
- `packages/adapter-openai/src/product-research-provider.ts`
- `packages/adapter-openai/test/product-research-provider.test.ts`
- `packages/core/src/agents/index.ts`
- `packages/core/src/agents/new-product-check-fixture.ts`
- `packages/core/src/agents/new-product-check-types.ts`
- `packages/core/src/agents/official-product-sources.ts`
- `packages/core/test/new-product-check-agent.test.ts`
- `scripts/agents/run-new-product-check.ts`
- `scripts/agents/test/new-product-check-cli.test.ts`

`git status --short`: 14 modificados e 4 novos, índice vazio.
Auditoria local de status/stat e caminhos preservados:
`validation/19a3/git-audit.json`.
Sem novas dependências, lockfile, migrations, UI, scheduler, worker,
aliases table ou alteração de Legacy. Nenhuma terceira marca foi adicionada.

### Limitações e confirmação

Toyota: smoke real validado anteriormente **conforme informado pelo operador**,
com 10 modelos, 30 variantes resolvidas, 32 candidatos, 8 LEGACY_NAMING,
8 NEW_MODEL, 2 NEW_VERSION e zero ambiguidades/rejeições. Não foi reexecutado.

Jeep: **PENDENTE** run real após revisão e autorização. A fixture valida os
conceitos exercitados, sem provar cobertura atual ou fidelidade da extração.
Nenhuma pesquisa web ou leitura de catálogo real foi feita. Fontes essenciais
em outros domínios Stellantis, se encontradas futuramente, exigirão revisão.
As falhas globais preexistentes permanecem fora do escopo.

**Zero chamadas OpenAI nesta Sprint; zero escritas canônicas; zero renomeações
canônicas. Sem commit e sem staging.**

## Histórico da entrega 19A.2 — reconciliação determinística e agregação

Worktree: `C:\Dev\compra-car-agent1`. Branch:
`sprint-19-new-product-agent`. Base observada: **c1a27e6**, contendo 19A/19A.1
já commitadas pelo operador. A descrição anterior de worktree sem commit estava
desatualizada. Nesta entrega, **sem commit e sem staging**.

### Mudanças verificadas

Discovery → Resolution → candidatos estruturados → validação/deduplicação →
reconciliação por interseção de componentes → classificação → agregação.

NEW_MODEL passou a representar mercado/marca/modelo, com variantes deduplicadas,
evidências válidas unidas, maior confidence relevante e warnings preservados.
NEW_VERSION permanece por variante. O fingerprint NEW_MODEL v3 não inclui versão.
O relatório JSON agora usa schemaVersion 19A.2.

Matching filtra trim, propulsão, cilindrada, família de transmissão e tração;
zero correspondências seguras sinaliza NEW_VERSION, uma permite match e múltiplas
exigem revisão. O relatório mostra somente os registros sobreviventes. Famílias
CVT/AT/MT/DHT, Hybrid Transaxle com HEV, aliases inequívocos de propulsão e
cilindrada numérica não reescrevem rótulos oficiais. EXACT_OFFICIAL continua
exigindo igualdade do rótulo inteiro; os oito casos da fixture são LEGACY_NAMING.

POSSIBLE_ALIAS/POSSIBLE_PACKAGE permitem NEW_VERSION quando não impedem a
identidade. Aliases com possível produto existente, pacote ainda não resolvido,
fatos contraditórios, múltiplos sobreviventes e evidência insuficiente continuam
em AMBIGUOUS. Em modelo ausente explicitamente identificado, a incerteza das
variantes fica anexada ao NEW_MODEL. O contrato atual não informa a quais campos
CONFLICTING_SOURCES/INSUFFICIENT_EVIDENCE se referem; em modelos conhecidos esses
avisos ainda exigem revisão conservadora. Regras completas no [manual](NEW_PRODUCT_CHECK_AGENT.md).

### Fixture executada

Comando exclusivamente offline:

```powershell
pnpm agent:new-products:dry-run -- --brand Toyota --provider fixture
```

Run final: **6aa3e364-01dd-4ac7-90ea-ff441d2f8a5e**.
JSON e Markdown:
`.local-reports/agents/new-product-check/6aa3e364-01dd-4ac7-90ea-ff441d2f8a5e.{json,md}`.
A primeira fixture da revisão, 2179b5e3-de53-4631-9222-ca8b3e31afae, também foi
preservada; a final inclui warnings agregados no cabeçalho de cada modelo.

| Estado | Resultado |
| --- | --- |
| Modelos descobertos / variantes resolvidas | 5 / 20 |
| Candidatos pesquisados / aceitos | 21 / 21 |
| Produtos administrativos conhecidos | 8 |
| EXACT_OFFICIAL / LEGACY_NAMING | 0 / 8 |
| NEW_MODEL | 3: Corolla (5 variantes), SW4 (3), RAV4 (2) |
| NEW_VERSION | 2: GRS com POSSIBLE_ALIAS; GRS Dualtone com POSSIBLE_PACKAGE |
| AMBIGUOUS | 1: Corolla Cross sem variante resolvida |
| POSSIBLE_YEAR_CHANGE | 0; PY/MY ausentes na fixture |
| Rejeitados / fontes externas rejeitadas | 0 / 0 |

Os oito ids reconciliados são 895, 896, 615, 897, 1015, 1016, 1018 e 1017.
Ids e registros são uma fixture sintética do cenário de aceitação, não uma
leitura do banco. Cada match contém apenas seu registro canônico.

### Testes e gates

| Verificação | Resultado |
| --- | --- |
| Core: new-product-check-agent + legacy-product-version-parser + product-reconciliation | **158 passed** |
| CLI/report: new-product-check-cli | **11 passed** |
| Adapter OpenAI: product-research-provider, transporte simulado | **16 passed** |
| Total direcionado, sem contar repetições | **185 passed** |
| Suíte completa core no gate global | **814 passed** |
| Typecheck core e scripts/agents direcionados | exit 0 |
| pnpm lint | exit 0 |
| pnpm typecheck | exit 1; mesmos cinco TS2554 da 19A.1 |
| pnpm test | exit 1; mesma falha de preços públicos da 19A.1 |
| pnpm format:check | exit 1; mesmos 15 arquivos da 19A.1 |
| pnpm build | exit 0 |
| git diff --check | exit 0 |

A pequena revisão final do Markdown foi novamente validada com os 11 testes,
lint de scripts/agents e a fixture final. Código alterado formatado com Prettier;
Markdown é ignorado pela configuração existente. Nenhuma dependência adicionada.

Cobertura dos 28 critérios: famílias CVT/AT/MT/DHT e transaxle HEV; litros textuais
versus numéricos; 1.8 diferente de 2.0; ICE/HEV eliminando incompatíveis; oito ids
Toyota; um modelo para cinco variantes; preservação de variantes/evidências/
confidence/warnings; alias e pacote sem bloqueio automático; múltiplos candidatos;
correspondências sobreviventes; ausência de fuzzy; leitura sem mutação; JSON e
Markdown agregados. Também foram testados os modelos Hilux/Hiace separados,
deduplicação por família, propulsões MHEV/PHEV/BEV, taxonomia, fontes inválidas,
anos explícitos, falhas operacionais e redação de secrets nas variantes anexadas.

Comandos direcionados:

```powershell
pnpm --filter @compra-car/core exec vitest run test/new-product-check-agent.test.ts test/legacy-product-version-parser.test.ts test/product-reconciliation.test.ts
pnpm --filter @compra-car/agents test
pnpm --filter @compra-car/adapter-openai exec vitest run test/product-research-provider.test.ts
pnpm --filter @compra-car/core --filter @compra-car/agents typecheck
pnpm --filter @compra-car/agents lint
```

Logs dos cinco gates: `validation/19a2/final-*.log`, no diretório local de
reports. Comparação automatizada com logs 19A.1:
`validation/19a2/diagnostic-comparison.json`, **sameAs19A1=true** para typecheck,
teste e formatação. Os diagnósticos e os 15 caminhos preexistentes estão
preservados no histórico abaixo. O Turbo pode encerrar tarefas após uma falha;
as suítes do escopo foram executadas separadamente.

Os gates desabilitaram explicitamente as flags RUN_SUPABASE_INTEGRATION_TESTS,
RUN_OPENAI_IMPORT_SMOKE, RUN_OPENAI_SCHEMA_PROBE,
RUN_SEGMENTED_OPENAI_IMPORT_SMOKE, RUN_STAGING_IMPORT_SMOKE e
RUN_JEEP_GOLDEN_BENCHMARK no processo. Ambiente: Node 24.18.0 / pnpm 10.34.5,
com warning conhecido de Node 22.x declarado pelo projeto.

### Arquivos e auditoria de escopo

Criados:

- `packages/core/src/agents/product-component-normalization.ts`
- `packages/core/src/agents/product-finding-aggregation.ts`
- `packages/core/test/product-reconciliation.test.ts`

Alterados:

- `packages/core/src/agents/index.ts`
- `packages/core/src/agents/legacy-product-version-parser.ts`
- `packages/core/src/agents/new-product-check-agent.ts`
- `packages/core/src/agents/new-product-check-fixture.ts`
- `packages/core/src/agents/new-product-check-types.ts`
- `packages/core/src/agents/official-product-candidate-deduplication.ts`
- `packages/core/src/agents/product-candidate-matcher.ts`
- `packages/core/test/new-product-check-agent.test.ts`
- `scripts/agents/report-writer.ts`
- `scripts/agents/test/new-product-check-cli.test.ts`
- `docs/agents/NEW_PRODUCT_CHECK_AGENT.md`
- `docs/agents/SPRINT_19A_VALIDATION.md`
- `AI_CONTEXT.md`
- `CHANGELOG.md`

Git revisado: 14 modificados + 3 novos, índice vazio. Provider OpenAI, prompt,
modelo, registry/domains, adapters de banco, dependências, lockfile e Legacy
sem diff. Sem mudança de UI, migrations, scheduler ou taxonomia global.
**Zero chamadas OpenAI nesta Sprint, zero escritas canônicas e zero renomeações
de produtos.** Escrita somente em código/documentação e reports locais ignorados.

### Limitações e pendências

**PENDENTE:** correção das falhas globais preexistentes e revisão humana dos
findings, fora desta Sprint. Nenhuma consulta remota foi executada para conferir
disponibilidade ou cobertura. Parser e convenção histórica ICE seguem limitados
aos padrões documentados.

O relatório real anterior 64682aee-12c8-49f1-92d0-e6efd3ccf431 foi apenas lido
localmente para inspecionar os fatos; não foi reexecutado. Seus oito candidatos
conhecidos informam PY 2026 versus PY 2025 nos registros administrativos salvos.
A reconciliação de identidade deve preservar esse possível year change, sem
alterar anos para transformar artificialmente os oito casos em matches simples.

## Histórico da entrega 19A.1

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
