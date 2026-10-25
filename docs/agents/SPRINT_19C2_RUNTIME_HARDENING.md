# Sprint 19C.2 — ambiente, identidade e diagnósticos

Workspace: `C:\Dev\compra-car-brand-connector`.
Branch: `sprint-19c-brand-connector-agent`.
HEAD inicial: `0d195f7d319eba3e34776ade772a55e4a82797a6`.
As alterações não commitadas da 19C.1 foram preservadas.

## Problemas corrigidos

Os scripts tsx não carregavam o `.env.local` da aplicação, o mapper comparava o nome
devolvido pela pesquisa com a marca interna e o catch do Brand Connector ocultava o
código de erro. Essas três condições foram corrigidas e testadas isoladamente.
Sem repetir a chamada real, não é possível determinar qual delas interrompeu a run
histórica VW/BR; nenhuma nova pesquisa foi executada nesta implementação.

## Ambiente compartilhado

`scripts/agents/agent-environment.ts` lê `<repo-root>/apps/web/.env.local` por padrão.
Se esse arquivo for um hard link ao arquivo padronizado de Staging, a leitura funciona
normalmente; o loader não resolve, substitui ou escreve no destino.

`COMPRA_CAR_AGENT_ENV_FILE` pode indicar outro caminho absoluto ou relativo à raiz.
Override ausente/vazio usa o padrão; override para arquivo inexistente não faz fallback
silencioso para outro arquivo. Arquivo opcional ausente, ilegível ou com conteúdo binário
é ignorado. A sintaxe de texto é a nativa `node:util.parseEnv`: suporta comentários,
aspas e valores multiline; não expande referências entre variáveis. Chaves inválidas
são descartadas. Não há dependência dotenv nem mutação de `process.env`.

O ambiente existente sempre prevalece, inclusive valor vazio. Valores `undefined`
representam ausência e podem ser preenchidos pelo arquivo. Ambos os CLIs usam o mesmo
helper antes da configuração de clientes. Fixtures sem persistência continuam offline;
OpenAI e persistência reais continuam exigindo variáveis completas. Configuração
ausente falha antes da construção do cliente correspondente.

Nenhum teste lê o arquivo real de segredos: usam raízes temporárias e valores sintéticos.
Segredos efetivamente carregados para OpenAI/Supabase são passados à remoção de segredos
dos reports; os testes verificam logs, JSON, Markdown e bundle de persistência mockada.

## Identidade interna e rótulo observado

O contrato de pesquisa mudou de `brand` para `observedBrandLabel`. O provider Responses
usa schema estrito que não aceita `brand`, `target_id` ou propriedades extras no resultado.
O prompt manda pesquisar o target fornecido e estabelecer a relação com o nome oficial
por evidências; não contém mapa de aliases ou equivalências por marca.

`mapBrandConnectorRun` projeta explicitamente os campos da proposta. Brand e market
vêm da entrada normalizada, nunca do rótulo observado; a pesquisa não pode alterar target_id.
`payload.observedBrandLabel` guarda o nome observado como informação e o apresenta no
report Markdown e na revisão estruturada do Admin. Ele não participa do fingerprint da
configuração. Runs novas usam schemaVersion `19C.2`; registros anteriores não são alterados.

Os testes cobrem VW/Volkswagen, GM/Chevrolet e um par arbitrário para mostrar que o
comportamento não depende de aliases. Evidências dos testes são sintéticas. Um mercado
diferente, ausência de evidência/verification summary ou URL fora de allowedDomains
continua causando rejeição. Health-check preserva a mesma identidade autoritativa.

Continuam obrigatórios: domínios/URLs seguros, evidências oficiais, fingerprint,
review e ativação explícita admin. Accept continua apenas review. Não houve alteração
de RLS, grants, transação de ativação, catálogo ou matcher MMV.

## Diagnósticos seguros

`scripts/agents/agent-diagnostics.ts` mantém uma lista fechada de códigos. Somente uma
correspondência exata com um código conhecido pode ser apresentada, sempre a partir
da constante da aplicação. Stack, cause, corpo de resposta, valores do ambiente e códigos
arbitrários são descartados.

Exemplos: `BRAND_CONNECTOR_FAILED: OPENAI_AGENT_CONFIG_REQUIRED`,
`BRAND_CONNECTOR_FAILED: SUPABASE_AGENT_CONFIG_REQUIRED`,
`BRAND_CONNECTOR_FAILED: CONNECTOR_RESEARCH_FAILED` e
`BRAND_CONNECTOR_FAILED: INVALID_CONNECTOR_RESEARCH`.
Erros desconhecidos resultam somente em `BRAND_CONNECTOR_FAILED`.
O MMV usa a mesma política com prefixo `NEW_PRODUCT_CHECK_FAILED`.

## Migration e limites

A versão local continua `20260914172157_sprint_19c_brand_connectors.sql`, alinhada ao
Staging informado pelo operador. SQL não alterado nesta correção; SHA-256:

```text
740f0f0cab9e13ae42d6e714b1df8f91d873b28f30b9c977719d3519b6fb0411
```

Zero chamadas OpenAI, zero acessos Supabase remotos e zero writes remotos/canônicos.
Sem nova migration, staging, commit ou push. O matcher MMV permanece fora do escopo.

Referência de sintaxe: [Node util.parseEnv](https://nodejs.org/api/util.html#utilparseenvcontent).

## Validação

328 testes direcionados passaram: core Brand Connector/MMV/plataforma (204), provider
OpenAI com transporte injetado (25), adapter Supabase/migration/plataforma (20), CLIs
(46) e Admin (33). Foram adicionados 32 testes, incluindo identidade interna,
rejeições de escopo e ambiente/diagnósticos sem exposição de segredos.

| Verificação | Resultado |
| --- | --- |
| `pnpm lint` | Passou, 9 tarefas |
| `pnpm build` | Passou |
| `pnpm typecheck` | Cinco TS2554 preexistentes em `apps/web/test/admin-product-public-prices.test.ts:101–105`; typecheck isolado de agents passou |
| `pnpm test` | Interrompido pelo timeout comercial Fiat-like já registrado no baseline |
| `pnpm exec turbo run test --continue` | 1.923 passaram, 19 ignorados, 12 falharam; detalhes abaixo |
| `pnpm format:check` | 537 arquivos com avisos; nenhum arquivo adicional em relação aos 560 do baseline |
| Prettier dos 15 arquivos TypeScript/TSX alterados ou novos | Passou |
| `git diff --check` | Passou |

Comparação com logs locais do baseline `3c7a82c`: repetiram-se o timeout Fiat-like,
o mock de preço Supabase sem `.in()` e nove falhas web de preço/navegação/PWA.
A execução completa também teve um segundo timeout em composição nested do mesmo
`commercial-document-domain-mapping.test.ts`; essa falha específica não consta na
execução anterior do baseline. O arquivo não mudou entre o baseline e o HEAD atual,
nem neste trabalho. Portanto, o gate global continua vermelho e não se declara uma
validação global limpa. Não foram alterados testes alheios para fazê-lo passar.

Ambiente executado: Node 24.15.0 e pnpm 10.34.5. O projeto solicita Node 22;
execução nessa versão permanece PENDENTE. O helper usa API nativa disponível no Node 22.
Não foi repetida a run real VW/BR e sua etapa histórica de falha permanece não confirmada.

## Inventário de arquivos

Arquivos novos:

- `scripts/agents/agent-environment.ts`
- `scripts/agents/agent-diagnostics.ts`
- `scripts/agents/test/agent-environment.test.ts`
- `docs/agents/SPRINT_19C2_RUNTIME_HARDENING.md`

Arquivos alterados pela 19C.2:

- `scripts/agents/run-brand-connector.ts`
- `scripts/agents/run-new-product-check.ts`
- `scripts/agents/test/new-product-check-cli.test.ts`
- `packages/core/src/agents/brand-connector-types.ts`
- `packages/core/src/agents/brand-connector-agent.ts`
- `packages/core/src/agents/brand-connector-fixture.ts`
- `packages/core/test/brand-connector.test.ts`
- `packages/adapter-openai/src/brand-connector-research-provider.ts`
- `packages/adapter-openai/test/brand-connector-research-provider.test.ts`
- `apps/web/src/components/admin/agent-platform-views.tsx`
- `apps/web/test/brand-connectors.test.tsx`
- `docs/agents/prompts/brand-connector-agent-v1.md`
- `docs/agents/BRAND_CONNECTOR_AGENT_19C.md`
- `AI_CONTEXT.md`
- `CHANGELOG.md`

Alterações anteriores da 19C.1 preservadas: rename da migration, referências em
`docs/agents/SPRINT_19C_VALIDATION.md`,
`packages/adapter-supabase/test/brand-connector.test.ts`, guia e contexto.
Nenhum arquivo de Legacy, matcher MMV ou SQL foi editado. Índice Git vazio;
alterações permanecem somente no working tree.
