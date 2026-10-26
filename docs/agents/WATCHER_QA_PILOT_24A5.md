# Watcher QA Pilot 24A.5B — PASS

Registro do piloto já encerrado. A consolidação Git final está documentada no fim
deste relatório e não executa outra coleta ou operação de dados remota.

Data: 2026-10-26. Workspace: `C:/Dev/compra-car-s24`.
Branch: `sprint-24-watcher-local`. HEAD preservado:
`db9021c2e44438ad4c0857b93da144553eb13110`.
Projeto exclusivo: **shfsjyjxmgwnlexmdkcs**.

## Resultado da única execução autorizada

Uma coleta manual e um batch persistido e conferido no QA. Não houve segunda
tentativa, segunda leitura do RSS, replay de persistência ou consulta às notícias.

| Evidência                                            | Resultado                                         |
| ---------------------------------------------------- | ------------------------------------------------- |
| Fonte                                                | Motor1 Brasil, `motor1-br-pilot`, configVersion 1 |
| URL HTTP efetivamente utilizada                      | `https://motor1.uol.com.br/rss/news/all/`         |
| Início do processo                                   | 2026-10-26 18:25:33.083 UTC / 15:25:33.083 BRT    |
| Horário observado da coleta                          | 2026-10-26 18:25:36.975 UTC / 15:25:36.975 BRT    |
| Commit PostgreSQL do batch                           | 2026-10-26 18:25:37.891 UTC                       |
| Postflight independente                              | 2026-10-26 18:26:09.309 UTC                       |
| HTTP / Content-Type / formato                        | 200 / `application/rss+xml; charset=UTF-8` / RSS  |
| Requisições HTTP ao feed                             | 1                                                 |
| Itens recebidos / válidos / rejeitados               | 20 / 20 / 0                                       |
| Duplicados / revisões de conteúdo anterior           | 0 / 0                                             |
| Artigos / feed items / revisões iniciais persistidos | 20 / 20 / 20                                      |
| Batch ID                                             | `9579c635-4397-44f2-8050-a3ce12bcdbc0`            |
| Batch status / stateVersion / replayed               | COMMITTED / 1 / false                             |
| Tentativas de persistência                           | 1, pela RPC `watcher_persist_batch`               |
| Falhas e diagnósticos do batch                       | Nenhum; ambos os arrays vazios                    |
| IA: chamadas / custo                                 | 0 / 0                                             |

O primeiro snapshot de cada artigo gera uma revisão inicial: as vinte linhas de
revisões não representam vinte alterações de artigos anteriores. A identidade
canônica da fonte remove a barra final; `settings.requestUrl` preservou a URL HTTP
autorizada com a barra final. Nenhuma outra URL de feed foi utilizada.

## Revisão e correções bloqueantes

A etapa 24A.5 parou antes de qualquer coleta porque faltava um entrypoint completo.
Na 24A.5B foi revisada a ligação local ainda sem commit. Ela reutiliza transporte,
parser, validação/normalização/deduplicação Core, loader seguro, executor QA e
WatcherSupabaseAdapter. Não há pipeline paralelo, conexão SQL direta ou nova dependência.

Corrigido o procedimento que exigia um GET de validação seguido de outro GET de
ingestão. O CLI agora aceita apenas `--run-once` (ou ajuda sem efeitos), e valida o
RSS dentro da única chamada de ingestão existente. O helper de validação separado
é exercitado apenas com mocks nesta etapa. A igualdade da configuração usa comparação
estrutural, sem depender da ordem das propriedades. A conferência do checkpoint
compara todos os campos, e falhas de ingestão/HTTP têm evidências sanitizadas.

Comando executado exatamente uma vez: `pnpm watcher:qa:pilot --run-once`.
O CLI carrega exclusivamente `C:/Dev/.secrets/compra-car/staging.env` pelo loader
seguro e guarda QA existentes; URL/ref/ambiente conflitantes são rejeitados.
Credenciais não foram impressas, copiadas para arquivos ou modificadas.
RPCs supabase-js usam HTTPS; o transporte RSS verifica TLS, DNS público, tamanho,
timeout e host aprovado, sem redirects nem retries.

Antes da execução, leituras pelo adapter retornaram zero fontes, batches e itens,
e estado nulo. O runner repetiu a verificação antes de registrar exclusivamente
a fonte autorizada, adquirir lease, ingerir, persistir e conferir o retorno.

## Checkpoint, lease e idempotência — PASS

- Checkpoint remoto: sourceId `motor1-br-pilot`, `etag=null`, `lastModified=null`,
  `lastSuccessfulObservedAt=2026-10-26T18:25:36.975Z`. O feed não forneceu validators;
  os valores nulos são esperados. `checkpointAdvanced=true`, stateVersion 1.
- Lease remoto ausente após a transação; consecutiveFailures 0 e lastFailureCode null.
  lastAttemptAt coincide com o horário observado. Nenhum token de lease foi exposto.
- Postflight somente leitura: `listSources`, `listBatches`, `listSourceItems`,
  `listSourceRevisions`, `listArticles`, `getSourceState`, por RPC HTTPS.
  Conferidos IDs, URLs canônicas, vínculos artigo/item/revisão, fingerprints,
  contagens do recibo, checkpoint e unicidade do batch. Todas as dez verificações passaram.
- `.local-reports/watcher-24a5/attempt.json` foi criado com abertura exclusiva `wx`
  antes das mutações e permanece como bloqueio de reentrada, inclusive após crash.
  Não apagar esse marcador nem reutilizar o comando para outra coleta.
- O runner bloqueia dados/tentativas/lease/configuração conflitante antes do fetch.
  Em erro, consulta o batch e tenta liberar a lease uma vez; não repete GET nem RPC
  de persistência. Resposta perdida é resultado incerto, não autorização para replay.
- Evidências locais ignoradas pelo Git: `attempt.json`, `result.json`, `postflight.json`
  em `.local-reports/watcher-24a5/`. Não contêm credenciais ou connection strings.
- A proteção contra segunda execução e falhas foi comprovada por mocks; não foi
  executado um segundo ciclo real para demonstrá-la.

## Testes e verificações

| Comando / escopo                                                                                           | Resultado                                                   |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Agents: sete arquivos Watcher (pilot, ingestion, parser, transport, node-network, environment, deployment) | PASS: 148 testes                                            |
| Adapter: qa-safety, qa-management, supabase-adapter, runtime-contract                                      | PASS: 66 testes                                             |
| Core: cinco arquivos Watcher                                                                               | PASS: 135 testes                                            |
| Pilot após adição de evidência sanitizada                                                                  | PASS: 15 testes, já incluídos nos 148                       |
| `pnpm --filter @compra-car/agents lint` e typecheck                                                        | PASS                                                        |
| `pnpm typecheck`                                                                                           | PASS: nove tarefas                                          |
| `pnpm build`                                                                                               | PASS, com avisos Web preexistentes                          |
| Prettier dos arquivos de código alterados e `git diff --check`                                             | PASS                                                        |
| `pnpm lint` global                                                                                         | FAIL: 51 warnings Web preexistentes; zero erros ESLint      |
| `pnpm test` global                                                                                         | FAIL: Core, 8 falhas / 1231 passes; sete arquivos com falha |
| `pnpm format:check` global                                                                                 | FAIL: dívida preexistente em 780 arquivos                   |

Total direcionado sem contar repetições: **349 testes PASS**, sem chamadas reais
ao RSS ou Supabase durante os testes. Nenhum teste crítico Watcher falhou.
Cobertura do piloto: RSS válido/vazio/inválido, URL/tempo inválidos, timeout,
lease indisponível, falha de persistência, batch duplicado, segunda execução,
checkpoint incorreto, readback divergente e resposta perdida após commit com
recuperação por leitura sem reexecutar a coleta.

As falhas globais fora do Watcher atingiram commercial-document-domain-mapping
(timeouts), engineering-brand-agent-replay, mmv-body-version-classification,
mmv-platform-mapper, mmv-product-reconciliation e new-product-check-agent.
Esses componentes não foram alterados para contornar a validação. O histórico já
registrava falhas nessa suíte; o total observado nesta execução foi oito.

Hashes SQL conferidos e preservados, sem alterações de migrations/manifesto:

- Storage: `0d43e3f5473b08e7b0cb4b2eca30567069c108ecc7946433354997dd80d31e23`.
- Transactions: `41b2a300a53291b44bfd62dda293a6c31ec2e3b9475361c35e0cf2d3ee9a0f06`.

## Dez notícias reais persistidas

Menções extraídas literalmente dos títulos persistidos, sem IA, enriquecimento,
consulta às páginas, associação canônica ou criação de MMV. Modelos sem menção
explícita permanecem não identificados; grafia editorial preservada.

| Título e URL                                                                                                                                                                     | Marcas mencionadas                         | Modelos/designações explícitas          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------- |
| [Num Brasil sem vendas diretas, BYD seria vice deixando Fiat e Cheverolet de lado; veja o ranking](https://motor1.uol.com.br/news/812644/ranking-vendas-varejo-brasil-byd)       | BYD; Fiat; “Cheverolet” (grafia do título) | Não identificados                       |
| [Mercedes-AMG está desenvolvendo um novo C63, mas V8 é mistério](https://motor1.uol.com.br/news/813145/segredo-mercedes-amg-c63-eletrico)                                        | Mercedes-AMG                               | C63                                     |
| [Audi investirá US$ 4 bilhões em fábrica nos EUA para produzir SUVs grandes](https://motor1.uol.com.br/news/813180/audi-fabrica-eua-investimento-suvs)                           | Audi                                       | Não identificados                       |
| [BYD contrata mais 1.100 empregados para soldagem e pintura em Camaçari (BA) rumo à produção nacional](https://motor1.uol.com.br/news/813076/byd-soldagem-pintura-fabrica-bahia) | BYD                                        | Não identificados                       |
| [Fiat, 50 anos: antes da Strada, Fiorino Trekking já queria ser picape de passeio](https://motor1.uol.com.br/news/812665/como-fiat-criou-picapes-compactas)                      | Fiat                                       | Strada; Fiorino Trekking                |
| [M1 Numbers: contra chineses, Jaguar e Porsche querem carros ainda mais caros](https://motor1.uol.com.br/news/812940/m1-numbers-jaguar-porsche-chineses)                         | Jaguar; Porsche                            | Não identificados                       |
| [Em 2026, Honda CG 160 já vendeu mais de 400 mil unidades; veja as 10 motos mais vendidas do ano](https://motor1.uol.com.br/news/812770/ranking-motos-vendas-acumulado-2026)     | Honda                                      | CG 160                                  |
| [BMW já testa F 450 GS no Brasil mirando CFMoto Ibex 450 e Royal Enfield Himalayan 450](https://motor1.uol.com.br/news/813274/bmw-f450gs-teste-fabrica-10anos)                   | BMW; CFMoto; Royal Enfield                 | F 450 GS; Ibex 450; Himalayan 450       |
| [“Farmou Aura”: Lepas mostra seu primeiro carro-conceito e marca vem ao Brasil em 2027](https://motor1.uol.com.br/news/813069/lepas-aura-conceito-brasil-2027)                   | Lepas                                      | Aura (designação literal do título/URL) |
| [VW Nivus Sense tem entrada de R$ 36 mil e parcelas com 0,99% de juros; veja se vale a pena](https://motor1.uol.com.br/news/813178/promocao-vw-nivus-sense-2027)                 | VW                                         | Nivus Sense                             |

## Limites e recomendação

**GO para planejar a Sprint 24B**, com o piloto manual QA aprovado. A execução única
está encerrada; o GO não autoriza novas coletas, scheduler, IA ou produção.
PENDENTE: tratar a dívida global de lint/testes/formatação e definir separadamente
o escopo/autorizações de 24B. Recorrência, atualizações entre ciclos e operação
prolongada foram testadas deterministicamente, não demonstradas por nova coleta real.

Não houve acesso a produção neste procedimento: o loader e a guarda restringiram
o cliente ao host QA exato, e o único outro destino operacional foi o RSS autorizado.
Não consultamos produção para comprovar ausência de efeitos; a evidência decorre
dos destinos permitidos e das operações executadas, sem auditoria externa de tráfego.
Não houve IA, scheduler, handoff, criação de MMV, conexão SQL, alteração de schema,
RLS/grants, Legacy, migrations, deploy, commit ou push.

Arquivos ajustados nesta revisão: `scripts/agents/watcher-pilot.ts`,
`scripts/agents/watcher-pilot-cli.ts`, `scripts/agents/test/watcher-pilot.test.ts`,
este relatório, `AI_CONTEXT.md` e `CHANGELOG.md`. O working tree também preserva os
arquivos já preparados nas etapas 24A.4/24A.5. Estado final completo:

- Modificados: `AI_CONTEXT.md`, `CHANGELOG.md`,
  `docs/agents/WATCHER_QA_API_DEPLOYMENT.md`, `package.json`,
  `scripts/agents/watcher-feed-ingestion.ts`, `scripts/agents/watcher-feed-parser.ts`.
- Novos, sem commit: `docs/agents/WATCHER_QA_PILOT_24A5.md`,
  `docs/agents/WATCHER_QA_POSTFLIGHT_24A4.md`,
  `packages/adapter-supabase/test/watcher-runtime-contract.test.ts`,
  `scripts/agents/test/watcher-pilot.test.ts`, `scripts/agents/watcher-pilot-cli.ts`,
  `scripts/agents/watcher-pilot.ts`.

## Validação final para commit e push da Sprint 24A

Revisados os doze arquivos acima, sem arquivos inesperados, `.env`, credenciais ou
artefatos temporários incluídos. A varredura de padrões de credenciais não encontrou
ocorrências; a revisão manual confirmou somente fixtures e identificadores públicos.
O entrypoint continua usando o pipeline existente e Supabase JS/RPC HTTPS, com guarda
QA exclusiva. Os hashes SQL foram reconferidos e coincidem com os aprovados.
Nenhuma alteração em `supabase`, manifesto, configuração de produção, Core/Web,
código do adapter ou `Legacy` em relação a `db9021c2e44438ad4c0857b93da144553eb13110`.

Resultados repetidos nesta consolidação:

- PASS: 148 testes Agents Watcher, 66 adapter e 135 Core Watcher (349 no total).
- PASS: `pnpm typecheck`, `pnpm build`, lint Agents e teste novo do adapter,
  Prettier dos doze arquivos e `git diff --check`.
- `pnpm lint`: mesmos 51 warnings Web do baseline, zero erros ESLint.
- `pnpm format:check`: mesmos 780 arquivos pendentes da etapa anterior; nenhum
  arquivo incluído neste commit falha na verificação direcionada.
- `pnpm test`: 10 falhas Core / 1229 passes na execução concorrente: as seis
  falhas funcionais conhecidas e quatro timeouts de 5 segundos em testes comerciais.
- Comparação sem concorrência: `pnpm --filter @compra-car/core exec vitest run
--maxWorkers=1` terminou com **as mesmas seis falhas do baseline / 1233 passes**,
  sem timeouts. Falhas: administrative-product-specs, engineering-brand-agent-replay,
  mmv-body-version-classification, mmv-platform-mapper, mmv-product-reconciliation,
  new-product-check-agent. Baseline documentado em WATCHER_FOUNDATION_24A_1.md e
  WATCHER_PERSISTENCE_24A_3A.md; Core/Web estão byte a byte iguais ao HEAD publicado.
  Não foi identificada nova regressão funcional; a sensibilidade à concorrência
  permanece uma limitação do gate global.

Publicação autorizada somente em `origin/sprint-24-watcher-local`, sem merge ou
início de 24B. Nenhuma nova coleta RSS, chamada Supabase/OpenAI, migration,
reconciliação de histórico, scheduler, handoff ou deploy nesta consolidação.
