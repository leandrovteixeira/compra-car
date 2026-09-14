# Sprint 19C.3 — MMV OpenAI transport diagnostics

## Implementação

O catch de `OpenAIProductResearchProvider` antes convertia toda exceção de transporte
em `OPENAI_RESEARCH_FAILED`. Agora usa `OpenAI.APIError`,
`OpenAI.APIConnectionTimeoutError` e `OpenAI.APIConnectionError` do SDK instalado.
Timeout é verificado antes de conexão, pois é uma subclasse desta.

| Origem | Código |
| --- | --- |
| HTTP 400 / 422 | `OPENAI_RESEARCH_BAD_REQUEST` |
| HTTP 401 / 403 | `OPENAI_RESEARCH_AUTH` |
| HTTP 429 | `OPENAI_RESEARCH_RATE_LIMIT` |
| HTTP 408 / SDK timeout | `OPENAI_RESEARCH_TIMEOUT` |
| SDK connection error | `OPENAI_RESEARCH_CONNECTION` |
| HTTP 500–599 | `OPENAI_RESEARCH_SERVER_ERROR` |
| Outros / erro desconhecido | `OPENAI_RESEARCH_FAILED` |

Erros de resposta incomplete, invalid output e no web search continuam independentes.
Objetos arbitrários com `.status` não são tratados como erros oficiais do SDK.

## Campos seguros

O novo erro mantém apenas código da aplicação, `status` inteiro entre 100 e 599
quando disponível e `elapsedMs` total ao redor do transporte, medido com
`performance.now()` e arredondado para milissegundos. Não guarda o erro original
como cause. Não lê nem copia mensagem, corpo, headers, prompt ou payload.

`apiCode`, `param` e `requestId` são deliberadamente omitidos: são campos textuais
externos e uma validação apenas sintática não garante ausência de conteúdo sensível.
O formatter do CLI verifica novamente os limites numéricos e ignora outras propriedades.
Exemplo de saída (valores ilustrativos):

```text
NEW_PRODUCT_CHECK_FAILED: OPENAI_RESEARCH_BAD_REQUEST
status=400
elapsed_ms=123
```

Campos ausentes não aparecem. Erros desconhecidos do CLI continuam genéricos;
exceções desconhecidas do transporte são convertidas no código FAILED com duração.
Não há log de stack ou mensagem original.

## Limites e follow-up

Não foram alterados web_search, allowed_domains, tool_choice, schema, modelo, timeout
de 120 segundos, hints, domínios, resolver, matcher ou validação de connector.
Migration 19C permanece alinhada a `20260914172157`, com SQL preservado.

Conforme relato do operador, VW/BR está ACTIVE v1 e a run
`6534e466-44a6-4ece-bd9a-efecd639b857` falhou antes do mapeamento. Não foi repetida;
seu motivo específico continua PENDENTE de diagnóstico numa execução futura autorizada.
Atualmente, uma run MMV que falha antes do mapeamento não é persistida em `agent_runs`.
Follow-up: persistir runs FAILED pela Agent Platform, preservando a semântica 19B.
Essa mudança não foi implementada neste sprint.

Zero chamadas OpenAI e zero acessos/writes remotos Supabase durante a implementação.
Sem stage, commit ou push. Alterações anteriores 19C.1/19C.2 foram preservadas.

## Arquivos deste sprint

- `packages/adapter-openai/src/product-research-provider.ts`
- `packages/adapter-openai/test/product-research-provider.test.ts`
- `scripts/agents/agent-diagnostics.ts`
- `scripts/agents/test/agent-environment.test.ts`
- `AI_CONTEXT.md`
- `CHANGELOG.md`
- `docs/agents/SPRINT_19C3_TRANSPORT_DIAGNOSTICS.md`

## Validação

85 testes direcionados passaram: provider OpenAI (37) e CLIs (48), incluindo 14 novos.
Testes de transporte usam erros reais do SDK construídos localmente e transporte
injetado; fetch é bloqueado. Cobrem 400, 422, 401, 403, 408, 429, 500, 503, 404,
timeout, conexão e erro desconhecido. Regressão de CLI verifica ausência de chave,
mensagem, corpo, headers e metadados textuais sintéticos nos logs.

| Gate | Resultado |
| --- | --- |
| `pnpm lint` | Passou, 9 tarefas |
| `pnpm build` | Passou, resultado do cache Turbo |
| `pnpm typecheck` | Bloqueado pelos cinco TS2554 preexistentes no teste web de preços públicos, linhas 101–105 |
| `pnpm --filter @compra-car/agents typecheck` | Passou |
| `pnpm test` | 991 testes core passaram; timeout comercial já registrado no baseline interrompeu o gate |
| `pnpm format:check` | 536 avisos preexistentes, contra 537 na 19C.2 |
| Prettier dos quatro arquivos TypeScript deste sprint | Passou |
| `git diff --check` | Passou |

Os gates globais não estão limpos; falhas fora do escopo não foram corrigidas.
Node local 24.15.0, pnpm 10.34.5; execução em Node 22 permanece PENDENTE.
Estado final do Git revisado, com índice vazio e alterações anteriores preservadas.
SHA-256 da migration mantido:

```text
740f0f0cab9e13ae42d6e714b1df8f91d873b28f30b9c977719d3519b6fb0411
```
