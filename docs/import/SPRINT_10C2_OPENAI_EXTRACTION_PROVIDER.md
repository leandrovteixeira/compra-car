# Sprint 10C.2 — OpenAI Real Extraction Provider

Status: provider tecnicamente validado em smoke real; Prompt v1 com recall incompleto e Prompt v2
com resultado Geely misto e benchmark cross-brand ainda incompleto.

## Arquitetura

O provider `openai` é server-only em `apps/web` e implementa o contrato `ExtractionProvider` da 10C.
O fluxo preservado é Storage privado → bytes no servidor → Files/Responses API →
`CommercialLetterExtraction/1` → validação Ajv local → reconstrução server-owned → schema canônico
`commercial-letter/mmv-payload/1` → matching → rows `needs_review|unmatched`. O provider não acessa
Supabase, não escolhe Product e não cria ou promove Price, Policy ou Offer.

`IMPORT_EXTRACTION_PROVIDER` aceita somente `fake` (default) ou `openai` na composição do servidor;
nenhum valor do browser seleciona provider. `OPENAI_API_KEY` e `OPENAI_IMPORT_MODEL` são obrigatórios
quando `openai` é selecionado e nunca usam prefixo `NEXT_PUBLIC_`.

## Transporte e lifecycle

Todos os PDFs elegíveis do dossiê são baixados pelo adapter existente e enviados com purpose
`user_data`. O contexto identifica `documentId`, role e ordinal; filename é marcado explicitamente
como provenance auxiliar. A OpenAI recebe nomes técnicos (`document-N.pdf`), não signed URLs.
Cada file tem expiração defensiva de uma hora e é apagado em `finally`, tanto após sucesso quanto
falha. Falha de cleanup é observada por código e contagem, sem mascarar o resultado principal e sem
persistir file IDs. A Responses API usa `store: false` e nenhuma tool.

## Structured extraction e prompts v1/v2

O schema strict `CommercialLetterExtraction/1` contém somente `rows`. Cada row reutiliza as formas
de source, MMV, período, preço, Policies, Offers, issues e confidence do contrato v1, removendo:
`productMatch`, `promotionPlan`, `validation`, IDs persistidos, predecessor, locks e ações de
promoção. A saída é validada localmente antes de o servidor reinserir valores nulos/bloqueados; a
pipeline 10C valida novamente o payload canônico, aplica invariantes e faz matching.

O texto original permanece exportado como Prompt v1 e o provider v1 identifica o baseline Geely.
O Prompt v2 é a instrução ativa e o provider passa a registrar versão `2`, sem migration e sem mudar
`CommercialLetterExtraction/1`. Ele adiciona classificação explícita de escopo, propagação apenas
documental, matriz interna de cobertura por MMV e uma segunda passagem de reconciliação. Também
explicita herança de benefícios gerais entre Offers alternativas, contexto de tabelas, completude na
confidence, REVIEW por `SOURCE_AMBIGUITY` e evidence que sustente valor, escopo e associação. As
verificações são internas; somente o Structured Output é retornado. Não há prompt por fabricante.

O schema atual já representa Policies, Offers, alternativas, evidence e restrições. Por isso, a
iteração semântica não altera o schema canônico nem o transport schema aceito pela OpenAI. Matching,
IDs, fingerprints, validação, locks e promoção continuam exclusivamente server-owned.

## Baseline real Geely — Prompt v1

O primeiro output semântico válido usou batch 109, `Geely 202602-01.pdf`, modelo
`gpt-5.6-terra` e Prompt/provider v1. A execução consumiu 43.804 tokens e teve custo estimado de
aproximadamente US$ 0,285. Produziu quatro rows, com 4/4 MMVs, 4/4 MSRP e período comercial corretos,
matching/reconstrução server-owned preservados, zero efeito comercial, precision observada alta e
nenhum false positive observado.

O recall foi incompleto: EX2 MAX perdeu condições financeiras explícitas, taxa zero e carência de
três meses, terminando sem Offer; EX5 PRO/MAX perdeu Wallbox ou um ano de recarga e a condição geral
de carência de três meses. Rows materialmente incompletas ainda receberam confidence 96–98, sem
redução ou REVIEW. Classificação: **REAL PROVIDER SMOKE TECHNICALLY PASS / QUALITY FAIL**. Esse
resultado motiva o Prompt v2; não valida a Sprint nem autoriza benchmark adicional automaticamente.

## Resultado real Geely — Prompt v2

O retry oficial do batch 114 concluiu no Job 30 com provider v2, 46.290 tokens e quatro rows para os
mesmos 4/4 MMVs. A extração passou a representar financiamento do EX2 MAX, manteve as alternativas
dos demais MMVs e reduziu a confidence geral para 92–94. O resultado foi misto: trouxe sinais de
melhora sobre as lacunas do v1, mas continuou todo `unmatched`, não estabeleceu sozinho recall
semântico suficiente e não autorizou promoção. O benchmark cross-brand posterior confirmou a
instabilidade com GWM em apenas 1/13 MMVs nominais. Prompt v2 permanece congelado, Prompt v3 não foi
criado e a Sprint 10C.2 não está semanticamente validada.

## Erros, timeout e retry

Erros externos são reduzidos a `PROVIDER_AUTH_ERROR`, `PROVIDER_RATE_LIMITED`, `PROVIDER_TIMEOUT`,
`PROVIDER_INVALID_OUTPUT`, `PROVIDER_REFUSAL`, `PROVIDER_FILE_UPLOAD_FAILED`,
`PROVIDER_FILE_CLEANUP_FAILED`, `PROVIDER_REQUEST_INVALID` ou `PROVIDER_UNKNOWN_ERROR`. 401/403 são
auth, 429 é rate limit, timeout/408 é timeout e 400/422 da Responses API são request inválida. Body,
headers, request e credenciais não são persistidos. O SDK recebe o timeout server-side configurado e
usa no máximo dois retries dentro da mesma tentativa; o deadline total do provider limita upload e
Responses conjuntamente;
auth, refusal e output inválido não são repetidos pela aplicação. Rate limit, timeout e falha
temporária podem usar somente essa política limitada do SDK. Não há fallback automático.

## Blocker técnico do primeiro A/B v2

O batch 114/documento 45 chegou com sucesso até o output estruturado do provider v2, mas o Job 29
falhou antes de persistir rows porque `overallConfidence.score` e a `band` fornecida pelo modelo eram
incompatíveis. Esse resultado não constitui baseline semântico v2. Os thresholds canônicos existentes
são: `high` para score 90–100, `medium` para 70–89 e `low` para 0–69.

O servidor agora considera somente o score autoritativo do provider e deriva deterministicamente a
band durante a normalização oficial. A regra alcança `overallConfidence` e cada
`fieldMeta.confidence`; score continua obrigado a ser inteiro entre 0 e 100. A band permanece no
transport schema apenas por compatibilidade, mas é ignorada. O schema canônico e sua invariável de
coerência não mudaram, de modo que payload que bypassa a normalização continua sendo recusado.
Prompt v2, provider v2, matching, Policies, Offers e evidence não mudaram.

`provider_run_id` e `usage_metadata` do Job 29 não foram preservados porque a RPC de falha aceita
somente diagnóstico de erro e a metadata só é escrita pela RPC de sucesso. Corrigir isso com
atomicidade exige migration separada: estender/substituir `fail_import_processing_job` com
`p_provider_run_id` e `p_usage` opcionais, aplicar os mesmos limites de `finalize`, gravá-los junto ao
estado `failed` e incluí-los no audit snapshot. A application layer deve manter o resultado sanitizado
do provider fora do bloco de sucesso e enviá-lo somente quando a falha for posterior ao provider.
Updates diretos pelo adapter e persistência de raw output, prompt, PDF ou file IDs não são aceitáveis.

`OPENAI_IMPORT_DIAGNOSTICS=1` habilita somente fora de Production um evento local por etapa
(`client_create`, `file_upload`, `response_create`, `response_parse`, `extraction_validate`,
`canonical_normalization` ou `cleanup`). O evento admite apenas classe, status, code/type, request ID
e mensagem genérica. Para `invalid_json_schema`, admite também `param` e mensagem sanitizada limitada
a 500 caracteres; nunca inclui body, headers, request, PDF, signed URL, stack ou credencial. A
persistência continua recebendo somente o código e a mensagem sanitizados da pipeline.

## Diagnóstico dos smokes técnicos anteriores

O batch 109 falhou com `PROVIDER_UNKNOWN_ERROR` antes de gerar `providerRunId`, usage ou rows. A
inspeção do request encontrou uma incompatibilidade determinística na criação da Response: o schema
strict derivado preservava `oneOf` e três propriedades declaradas não estavam em `required`. A API
aceita `anyOf` no subconjunto de Structured Outputs e exige todas as propriedades declaradas. A
segunda tentativa revelou ainda `invalid_json_schema`: os `$ref` absolutos apontavam para `#/$defs`,
mas a derivação mantinha `$defs` aninhado em `rows.items`.

A derivação de transporte agora eleva para a raiz somente definições alcançáveis, resolve todos os
`$ref`, troca `oneOf` por `anyOf` e representa os três campos canonicamente opcionais como nullable
e required no wire. `null` de `source.notes` e `mmv.variantRestrictions` volta a ausência antes da
reconstrução canônica. Keywords fora do subconjunto documentado (`$id`, `$schema`, `title`,
`minLength`, `maxLength` e `uniqueItems`) são removidas somente do transporte. Um auditor local
fail-fast verifica allowlist, formatos, root, objetos strict, referências, ciclos e limites antes da
criação do client. Schema canônico, prompt, matching e ownership server-side não mudaram.

Um probe isolado, sem PDF, Storage ou Supabase, confirmou que a API também exige `type` explícito
nos schemas baseados apenas em `enum` ou `const`: o schema anterior foi rejeitado em
`properties.timezone`. A derivação agora adiciona `type: string` somente quando todos os valores do
`enum` ou o `const` são strings e falha localmente para qualquer inferência diferente. O auditor
também verifica os limites oficiais de propriedades, profundidade, strings e enums, além de cada
branch de `anyOf`. O segundo probe isolado foi aceito pela Responses API com o schema corrigido; o
batch real permanece dependente de autorização separada.

## Usage, retenção e privacidade

Somente `input_tokens`, `output_tokens` e `total_tokens` inteiros não negativos são mapeados para
campos numéricos da metadata já permitida pela 10C. Não há billing. PDFs vêm do Storage privado, bytes transitam apenas
server-side, OpenAI não é source of truth, files são temporários e Responses não é armazenada. O
Compra Car retém apenas payload normalizado/evidence já previstos; a resposta integral não é
persistida.

## Testes e benchmark opt-in

Testes default usam uma boundary mockada e nunca chamam a OpenAI. O smoke real exige:

```text
RUN_OPENAI_IMPORT_SMOKE=1
SUPABASE_URL=https://shfsjyjxmgwnlexmdkcs.supabase.co
SUPABASE_SERVER_KEY=...
OPENAI_API_KEY=...
OPENAI_IMPORT_MODEL=...
OPENAI_IMPORT_DIAGNOSTICS=1
OPENAI_IMPORT_SMOKE_BATCH_ID=<batch ready com exatamente um PDF simples>
```

Execute `pnpm --filter @compra-car/web test -- openai-import-smoke.test.ts`. Prefira Geely, GAC ou
OMODA/JAECOO e não use inicialmente a carta Volkswagen longa. O relatório seguro
`OPENAI_IMPORT_BENCHMARK` contém model, provider run, latency, row count, usage, sucesso e issue codes.
O teste termina em review/unmatched e não executa promoção.

## Limitações e pendências

- O benchmark A/B do Prompt v2 com a mesma carta é obrigatório antes de declarar a Sprint validada.
- Preservar `provider_run_id`/usage em falha pós-provider depende da migration/RPC descrita acima.
- Falha parcial de cleanup requer observabilidade operacional; a expiração de uma hora é defesa
  adicional.
- Não há OCR próprio, fallback, Batch API, prompt por fabricante ou processamento de corpus.

## Timeout funcional e benchmark cross-brand

O benchmark congelado executou GWM (batch 110, Job 31) com sucesso técnico e apenas 1/13 MMVs
nominais, sem false positive material observado. Fiat (batch 111, Job 32) excedeu o timeout externo
de 180 s do Vitest; o processo foi encerrado antes do `catch` do application flow e deixou job,
batch e documento em `processing`/`extracting`. Volvo 113 e VW 112 não foram executados.

O runner não é mais controle de negócio. `OPENAI_IMPORT_TIMEOUT_MS` define, somente no servidor, o
deadline total de upload + Responses: default 480.000 ms, mínimo 30.000 e máximo 600.000. Cada
operação recebe `AbortSignal`; timeout vira `PROVIDER_TIMEOUT`, passa pelo fail path e converge
atomicamente job/batch/documentos para `failed`, sem rows. O lease é 900 s e o harness opt-in usa
900.000 ms, deixando margem para cleanup e persistência da falha. FakeProvider não mudou.

O `finally` tenta remover todo file ID criado e uma falha de cleanup nunca mascara o erro primário.
`expires_after = 3600` permanece como defesa para morte abrupta do processo, cujo cleanup imediato
não pode ser garantido. Lease/reclaim e rejeição do token antigo continuam complementares ao
timeout funcional.

Depois da validação local, o Job 32 foi recuperado exclusivamente pelo reclaim oficial da lease
expirada e finalizado pela fail RPC com `PROVIDER_TIMEOUT`. A verificação pós-recovery confirmou job,
batch 111 e documento 42 em `failed`, zero rows, nenhum job ativo, auditoria de reclaim/fail e os
hashes comerciais idênticos ao baseline. Não houve nova chamada OpenAI nem reprocessamento. O
benchmark permanece congelado; depois do checkpoint, a ordem pendente é Fiat, Volvo e VW, sem tuning
intermediário.
