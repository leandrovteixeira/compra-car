# Sprint 19C.4 — MMV background e polling

## Comportamento

O timeout de cerca de 120s informado pelo operador ocorreu no transporte síncrono.
O provider MMV agora cria uma única resposta com `background:true`, `store:false` e
consulta `responses.retrieve` enquanto o status for `queued` ou `in_progress`.
Se create já retornar completed, segue diretamente para validação do output.

`ProductResearchBackgroundTransport` expõe create/retrieve com timeout e AbortSignal.
O SDK real implementa esse contrato com `maxRetries:0`, logging desligado e timeout
HTTP de 60000ms. Mocks antigos em formato função continuam aceitos para create;
testes de polling injetam o contrato completo. Não há fallback real em mocks incompletos.
Relógio monotônico e sleeper também podem ser injetados. Testes não fazem esperas reais.

O CLI passa `OPENAI_AGENT_MAX_WAIT_MS`, lido pelo loader compartilhado. Aceita inteiros
decimais entre 60000 e 1800000; ausente, inválido ou fora da faixa usa 600000 (10min).
O provider também valida seu argumento. O deadline inclui create, retrieves, intervalos
e retries. Cada operação usa o menor valor entre 60s e o saldo do prazo, com timer
local e AbortController; resultado recebido após o deadline é rejeitado. Timers são limpos.

## Polling, erros e estados

Cada retrieve é precedido de espera de 2000ms, limitada ao saldo disponível. Falhas de
conexão, timeout, 429 e 5xx no retrieve repetem a consulta ao ID original após esse
intervalo, sempre dentro do prazo. Auth, outros 4xx (incluindo 404), erro desconhecido
ou estado terminal não são repetidos. Create nunca é repetido: não há duplicação
automática de pesquisa. ID ausente ou diferente na resposta de polling causa falha segura.

| Estado/condição | Resultado |
| --- | --- |
| completed | Validação existente de web search e schema |
| failed | `OPENAI_RESEARCH_FAILED` |
| cancelled | `OPENAI_RESEARCH_CANCELLED` |
| incomplete | `OPENAI_RESEARCH_INCOMPLETE` |
| Estado ausente/desconhecido | `OPENAI_RESEARCH_FAILED` |
| Deadline atingido | `OPENAI_RESEARCH_TIMEOUT` com elapsed_ms total |

Erros de transporte mantêm a classificação 19C.3. Logs não incluem response ID,
mensagens originais, headers, corpo, prompt, fontes ou credenciais. Erros terminais
não expõem `response.error`. Metadados de resultado concluído seguem o contrato existente.

## Retenção e escopo

A [documentação oficial de background](https://developers.openai.com/api/docs/guides/background)
confirma que `store:false` é aceito e que a API armazena dados temporariamente para
execução assíncrona e polling, descrevendo uma janela de aproximadamente dez minutos.
Configurar prazo local maior não amplia essa janela nem garante disponibilidade remota;
404 falha sem recriar a pesquisa. Não há alteração silenciosa para `store:true`.
Ao esgotar o prazo, o cliente interrompe a espera e a operação HTTP em andamento;
não envia cancelamento remoto, e a pesquisa remota pode continuar.

Modelo, prompt, web_search, filtros, tool_choice, schema, limites de candidatos, hints,
matching e evidências foram preservados. Retrieve solicita as mesmas fontes de web search.
Provider Brand Connector, resolver e definições de connectors não foram alterados neste sprint.
Persistir runs FAILED antes do mapeamento continua follow-up da Agent Platform.

Nenhuma chamada OpenAI real, acesso remoto Supabase, migration nova ou mudança de SQL.
Rename 19C.1 e mudanças anteriores foram preservados. Sem stage, commit ou push.

## Testes e gates

289 testes direcionados passaram: adapter OpenAI (75), agents/CLIs (49), core MMV e
Brand Connector (165). Há 39 testes novos. Incluem sequências de polling, estados,
retries transitórios, não retry em create/4xx, orçamento total, HTTP travado e aborto,
preservação do request, Toyota/Jeep e integração do resolver ACTIVE VW com background.
Fixtures e transportes são simulados; fetch é bloqueado nos testes de provider.

| Gate | Resultado |
| --- | --- |
| Lint | Passou |
| Build | Passou via cache Turbo |
| Typecheck dos agents e adapter OpenAI | Passou |
| Typecheck global | Cinco TS2554 preexistentes no teste web de preços públicos |
| Test global | Timeout comercial Fiat-like já registrado no baseline |
| Format global | 536 arquivos preexistentes com avisos, igual à 19C.3 |
| Prettier dos arquivos TypeScript deste sprint | Passou |
| git diff --check | Passou |

Gates globais continuam vermelhos por pendências fora deste escopo. Ambiente local:
Node 24.15.0, pnpm 10.34.5; validação em Node 22 permanece PENDENTE. Validação de uma
pesquisa real fica para execução futura autorizada, não foi realizada neste sprint.

## Arquivos deste sprint

- `packages/adapter-openai/src/product-research-provider.ts`
- `packages/adapter-openai/test/product-research-background.test.ts` (novo)
- `scripts/agents/run-new-product-check.ts`
- `scripts/agents/agent-diagnostics.ts`
- `scripts/agents/test/agent-environment.test.ts`
- `AI_CONTEXT.md`
- `CHANGELOG.md`
- `docs/agents/SPRINT_19C4_BACKGROUND_RESEARCH.md` (novo)
