# Sprint 15C.1b — Políticas estruturadas (Excel)

## Superfície e fronteiras

O submenu Importações do Admin (desktop e mobile) contém Cartas comerciais, em
`/admin/imports`, e Políticas estruturadas (Excel), em `/admin/imports/structured-policies`.
As rotas PDF existentes, incluindo `/admin/imports/new` e os dossiês, mantêm o comportamento.

Página e server action usam `requireRole('admin')`. A action recebe um arquivo, valida extensão,
MIME e tamanho, e chama `previewStructuredPolicies`. O serviço Node reutiliza diretamente
`parseCommercialImportContractV1` e `validateCommercialImportContractV1` do Core 15C.1.
O browser não importa o parser nem reinterpreta o workbook.

Somente `.xlsx`, até 25 MiB, alinhado ao limite comprimido do parser. MIME XLSX, ausente ou
`application/octet-stream` são aceitos; MIME explicitamente incompatível é rejeitado. O parser
confere o conteúdo OpenXML mesmo para arquivos com extensão/MIME aparentemente corretos.
O transporte existente de server actions suporta 64 MiB; nenhuma configuração de upload PDF mudou.
Arquivo e contrato permanecem em memória do request/preview, sem persistência comercial ou Storage.
O guard continua fazendo as leituras de autenticação existentes.

## Estados e diagnóstico

- Inicial: upload compacto, formato e limite, sem tabela vazia.
- Selecionado: nome do arquivo, substituir pelo input ou remover, CTA Validar estrutura.
- Validando: controles desabilitados e mensagem anunciada por região live.
- `STRUCTURALLY_VALID`: metadata, contagens reais, produtos documentais e Issues da extração.
- `STRUCTURALLY_INVALID`: diagnósticos do validator, com reason code e localização disponível.
- `PARSER_FAILURE`: falha no parsing com os diagnósticos tipados do Core.
- `UNSUPPORTED_FILE`, `FILE_TOO_LARGE`: rejeição local e repetida no servidor.
- `TECHNICAL_ERROR`: mensagem genérica; falhas inesperadas do serviço geram evento seguro no log.

Structural Diagnostics são erros do parser/validator; não se confundem com linhas da sheet Issues.
Issues comerciais, inclusive `blocker` com `blocks_apply=true`, não invalidam a estrutura sozinhos.
Os diagnósticos atuais do Core não contêm severity nem entity key; são mostrados como Erro com
sheet, row e column quando presentes, sem inventar campos. Mensagens do Core são preservadas.
Products exibem Aguardando resolução e PY/MY pendente quando um dos anos está ausente.
Policies, Offers e Evidence aparecem apenas como contagens. Não há Apply, edição ou resolução.

### Diferenças observadas no baseline 15C.1

O Core aceita `other` no vocabulário atual de políticas; tipos desconhecidos retornam `INVALID_VALUE`,
não `POLICY_TYPE_UNSUPPORTED`. Severidades de Issues aceitas são `info`, `warning`, `error`, `blocker`;
`yellow`/`red` literais geram diagnóstico de vocabulário. A UI não altera essas regras nem corrige
arquivos automaticamente. Essas divergências dos exemplos conceituais devem ser consideradas na
auditoria do XLSX real. Alterar o vocabulário do Core requer escopo próprio.

O limite descomprimido de 100 MiB é verificado pelo parser existente após descompressão; o limite
de upload não elimina o risco de pressão de memória de arquivos comprimidos adversariais.

## Cobertura e teste manual

`apps/web/test/structured-policies.test.tsx` cobre submenu, destino PDF, página, acesso Admin,
rejeição de formato/MIME/tamanho, conteúdo falso, parsing e validação reais, metadata/contagens,
reason codes determinísticos, Issues bloqueantes não fatais, anos ausentes e falhas inesperadas.
Também verifica que o fluxo não invoca o adapter de persistência e que não exibe ação de publicação.
O fixture sintético existente da 15C.1 foi extraído para helper compartilhado em Core/test, com
gerador OpenXML exclusivo dos testes. A configuração do Vitest habilita JSX automático para
renderizar os componentes reais com React SSR. Não houve adição de dependências.

Teste manual **PENDENTE**, arquivo real não fornecido e não incluído no Git:

1. Entrar como Admin e abrir Importações → Políticas estruturadas (Excel).
2. Selecionar `Jeep_Julho_2026_CommercialImportContract_v1.1_AUDITED.xlsx` e validar.
3. Conferir classificação estrutural ou diagnósticos determinísticos, metadata e contagens do arquivo.
4. Conferir Issues separados, produtos aguardando resolução e eventual PY/MY pendente.
5. Substituir/remover o arquivo; conferir o menu em viewport mobile.
6. Abrir Cartas comerciais e conferir o fluxo PDF existente.

Nenhum arquivo real, escrita Supabase, migration, RPC, commit ou push faz parte desta sprint.
A próxima etapa é Product Resolution.

## Resultados da execução (2026-09-09)

- `pnpm lint`: passou (7 tarefas).
- `pnpm typecheck`: passou (7 tarefas).
- `pnpm build`: passou; nova rota dinâmica Node incluída no build.
- Testes Web específicos: 13 testes novos + 8 de admin foundation passaram (21/21).
- `pnpm test`: Core 560, adapter 94 e pricing-dry-run 71 passaram. Web: 580 passaram,
  16 ignorados e 1 falhou. O adapter também possui 3 testes de integração ignorados.
- Falha global preexistente: `sprint-14g-mobile-pwa.test.ts:130` compara uma string LF
  com `globals.css` em CRLF. Ambos estão sem diff e `git ls-files --eol` confirma
  `i/lf w/crlf`. O teste de navegação antigo foi atualizado para os dois filhos e passou.
- `pnpm format:check`: falhou em 234 arquivos do working tree, incluindo arquivos sem diff
  com `i/lf w/crlf`, diante da configuração Prettier `endOfLine: lf`. Não houve reformatação global.
- Prettier direcionado a todos os arquivos de código desta sprint: passou. `git diff --check`: passou.
- Runtime disponível: Node 24.15.0 / pnpm 10.34.5; projeto declara Node 22.x. Revalidação
  no runtime declarado continua recomendada. Vitest inicialmente bloqueado pelo sandbox (`spawn EPERM`)
  foi executado com escalonamento aprovado. Nenhum teste manual em browser ou com a Jeep foi executado.

Implementação da superfície 15C.1b concluída; os gates globais não estão integralmente verdes pelos
problemas preexistentes acima. Git revisado, baseline 15C.1 preservado e `Legacy` sem alterações.

## Inventário desta sprint

Criados:

- `apps/web/src/app/admin/imports/structured-policies/page.tsx`
- `apps/web/src/app/admin/imports/structured-policies/actions.ts`
- `apps/web/src/application/admin/structured-policies.ts`
- `apps/web/src/server/structured-policies-preview.ts`
- `apps/web/src/components/admin/structured-policies-form.tsx`
- `apps/web/src/components/admin/structured-policies-preview.tsx`
- `apps/web/test/structured-policies.test.tsx`
- `packages/core/test/fixtures/import/structured-commercial-fixture.ts`
- `packages/core/test/fixtures/import/structured-commercial-workbook.ts`
- Este documento.

Alterados:

- `apps/web/src/components/admin/admin-navigation.ts` e `admin-nav.tsx`: submenu compartilhado.
- `apps/web/src/app/admin/imports/page.tsx`: somente título e descrição do destino PDF.
- `apps/web/test/admin-foundation.test.ts`: expectativa de navegação.
- `apps/web/vitest.config.ts`: transformação JSX nos testes.
- `packages/core/test/commercial-import-xlsx-parser.test.ts`: reutiliza o fixture extraído,
  mantendo os seis testes existentes da 15C.1.
- `AI_CONTEXT.md` e `CHANGELOG.md`: registro do marco.

As alterações de package/exports/lockfile e os arquivos de produção Core 15C.1 já existiam antes
desta sprint; não foram implementados novamente nem alterados para ajustar exemplos da UI.
