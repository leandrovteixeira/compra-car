# Financial Reference Foundation — Sprint 9C-0

## Escopo

O primeiro `financial_parameter_set` do Staging será criado como draft com CDI mensal informado
explicitamente, spread mensal `0,30%`, origem `manual` e snapshot contendo ambiente e método de
entrada. A publicação deve usar exclusivamente `publish_financial_parameter_set`.

Valores iniciais aprovados para o MVP em Staging:

- CDI mensal: `1,1458%` (`0.011458` decimal);
- spread mensal: `0,3000%` (`0.003000` decimal);
- taxa de referência mensal: `1,4458%` (`0.014458` decimal).

Nenhum registro inicial faz parte da migration. O CDI provisório do dry-run legado não é uma decisão
operacional atual e não deve ser reutilizado automaticamente.

## Modelo temporal

Somente uma referência publicada pode cobrir uma data. Para substituir uma referência corrente,
deve-se preparar a próxima versão em draft e chamar `rollover_financial_parameter_set` com os dois
lock versions, actor admin ativo e correlation ID. A operação encerra a versão anterior no dia
imediatamente anterior à nova data efetiva, publica a sucessora pela função oficial e audita as duas
mudanças na mesma transação.

## Origem futura

`source_type=api_import` já suporta o backlog **Automated CDI Reference Ingestion**. Um futuro
processo deverá consultar fonte confiável, normalizar e validar o CDI, evitar versões sem mudança,
criar a sucessora, executar rollover/publicação de modo idempotente, persistir metadados no
`source_snapshot` e emitir alerta quando a fonte falhar. Nenhuma chamada externa é implementada aqui.

## Segurança

As RPCs de publicação e rollover pertencem a `postgres`, usam `SECURITY DEFINER` com
`search_path=''` e concedem execução somente a `service_role`. RLS permanece habilitada e browser
roles não recebem escrita direta.

## Execução em Staging

A migration `20260729174815_add_financial_reference_foundation.sql` foi aplicada exclusivamente ao
Staging `shfsjyjxmgwnlexmdkcs`. A versão 1, efetiva em `2026-07-29`, foi inserida em draft e publicada
por `publish_financial_parameter_set`. Um rollover V1→V2 foi validado dentro de transação e revertido;
nenhuma V2 ou auditoria de teste permaneceu.

O reset e o pgTAP local continuam **PENDENTES**: a stack não foi criada após tentativa controlada de
`supabase start`. As validações remotas não devem ser descritas como substitutas do pgTAP local.

Limitação conhecida: `supabase start` local expirou antes da criação da stack. Por isso,
`supabase db reset --local` e pgTAP da Sprint 9C-0 não foram executados. O arquivo
`011_financial_reference_foundation.test.sql` permanece pendente de execução. Essa pendência decorre
de infraestrutura local, não de falha da suíte. A migration e o lifecycle foram validados
exclusivamente no Staging por testes reversíveis.
