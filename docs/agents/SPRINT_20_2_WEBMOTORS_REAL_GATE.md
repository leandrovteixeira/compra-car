# Sprint 20.2 — Real Webmotors parser gate

## Checkpoint consolidado — Sprint 20 / 20.1 / 20.2

**SPRINT 20.2 IMPLEMENTED · REAL WEBMOTORS PARSER GATE VALIDATED · END-TO-END STRUCTURED CLI SMOKE PENDING.**

[Estado final, validações históricas, exclusões e próximo gate](SPRINT_20_CHECKPOINT.md). O smoke completo structured/monitor/persist-findings ainda não foi executado. Seções com estado local/sem commit abaixo registram o histórico anterior a este checkpoint.

Gate executado em 2026-09-15T20:12:37.116Z. Resultado: **PASSED após correção mínima do parser de anos**.

## HTTP real

Foi usado webmotorsDocumentTransport existente, com parâmetros padrão, GET nativo e observador de metadados por clone limitado da resposta. Headers, URLs, pacing, timeout e regras de redirect do adapter foram preservados. Sem browser, proxies, cookies artificiais, login ou bypass. Apenas dois GETs públicos Webmotors.

| Página | HTTP | Host final | Content-type | Bytes do corpo recebido | Redirects |
| --- | ---: | --- | --- | ---: | ---: |
| /tabela-fipe/carros/volkswagen/nivus | 200 | www.webmotors.com.br | text/html; charset=utf-8 | 332637 | 0 |
| /tabela-fipe/carros/volkswagen/nivus/2027 | 200 | www.webmotors.com.br | text/html; charset=utf-8 | 212308 | 0 |

Bytes medidos no corpo decodificado entregue por fetch, não tamanho comprimido no fio. Ambas as respostas foram lidas integralmente; Content-Length ausente. HTML completo não foi despejado no terminal. Capturas e reports antes/depois permanecem ignorados pelo Git em .local-reports/agents/model-year/webmotors-real-gate/.

## Diferença real e correção

Antes da correção: anos vazios; tabela 2027 já fornecia quatro linhas e quatro matches únicos. O HTML real da raiz contém cards com h3[data-testid="card-title"] para o ano e outro h3 para preços. A concatenação de texto do link contém ano + preço; a fixture sintética anterior tinha somente o ano.

Mudança limitada: aceitar o título do card quando ele corresponde exatamente ao ano no link da mesma página/modelo. Mantida compatibilidade com links cujo texto integral é somente o ano. Um título divergente ou um subtítulo contendo o ano não são aceitos. Não houve alteração de transport, arquitetura, matching ou uso de JSON embutido.

Foram adicionados dois fragments HTML mínimos derivados das capturas reais: preservam estrutura necessária, labels e códigos, removendo preços, estilos, tracking, scripts e demais conteúdo. Não representam reprodução integral das páginas.

## Resultado após correção sobre os mesmos corpos HTTP capturados

Anos: **2027, 2026, 2025, 2024, 2023, 2022, 2021**.

| Label publicado | Código FIPE | Target resolvido | Matches |
| --- | --- | --- | ---: |
| Volkswagen Nivus 1.0 200 Tsi Total Flex Comfortline Automático 2027 | 005525-5 | Nivus Comfortline 200 TSI | 1 |
| Volkswagen Nivus 1.0 200 Tsi Total Flex Highline Automático 2027 | 005526-3 | Nivus Highline 200 TSI | 1 |
| Volkswagen Nivus 1.0 200 Tsi Total Flex Sense Automático 2027 | 005548-4 | Nivus Sense 200 TSI | 1 |
| Volkswagen Nivus 1.4 250 Tsi Total Flex Gts Automático 2027 | 005553-0 | Nivus GTS 250 TSI | 1 |

Quatro observações MY 2027, sem rejeições. Os targets são os quatro MMVs fornecidos no pedido; nenhuma leitura de catálogo/banco foi feita. Labels reais incluem fabricante, modelo e ano, diferentemente dos labels abreviados da fixture sintética. O matcher existente aceitou os quatro sem alteração.

## Arquivos deste gate

- packages/adapter-webmotors/src/index.ts: leitura do título de card no parser de anos.
- packages/adapter-webmotors/test/webmotors-real.test.ts: cinco regressões baseadas nos fragmentos reais, incluindo dois negativos.
- packages/adapter-webmotors/test/fixtures/nivus-root-real-minimal.html e nivus-2027-real-minimal.html.
- Este relatório e atualização de status em MODEL_YEAR_AGENT_20, SPRINT_20_2_STRUCTURED_MY_FIPE_BRIDGE, AI_CONTEXT e CHANGELOG.
- Artefatos ignorados: capturas HTML, runner local e reports antes/depois.

## Limite da conclusão

O gate valida estas duas respostas reais e os quatro MMVs explicitados, não a disponibilidade futura ou toda a cobertura Webmotors de outras marcas/modelos. Novos bloqueios continuarão produzindo STRUCTURED_SOURCE_UNAVAILABLE. Não houve execução completa do agente com catálogo real.

Zero OpenAI, Supabase, Railway/Vercel. Nenhuma escrita no banco, alteração de migration, stage, commit ou push.

## Verificações executadas

- Replay do parser corrigido nas duas respostas HTTP completas capturadas: PASSED, sete anos e quatro matches únicos. Sem refetch.
- pnpm --filter @compra-car/adapter-webmotors test: 29 testes passaram em dois arquivos (inclui cinco novos testes derivados da captura).
- Typecheck do adapter: passou.
- pnpm lint: passou.
- pnpm build: passou por cache Turbo válido.
- Prettier dos quatro arquivos de código/fixtures deste gate: passou.
- git diff --check: passou.
- pnpm typecheck global: mesmos cinco TS2554 prévios em admin-product-public-prices.test.ts:101–105.
- pnpm test global: 1.094 testes do core passaram; timeout conhecido de 5s em Fiat-like recipients, commercial-document-domain-mapping.test.ts; execução global interrompida. Nenhuma correção fora do escopo.
- pnpm format:check global: mesmos 575 arquivos com avisos do worktree acumulado.
- Git revisado: índice vazio; alterações anteriores da Sprint 20/20.1/20.2 preservadas, sem stage/commit/push. Migration conserva SHA-256 4B81C6A5E1DB814271DFF29A50D7E445DC391C5651BFE77B2175236DE892AFAA.
