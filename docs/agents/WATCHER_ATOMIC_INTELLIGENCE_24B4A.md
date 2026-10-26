# Watcher 24B.4A — Atomic Intelligence Persistence

Base: `8f31a447ed4ad0716a5af3bc0d5d10a4aeb53fc2`, branch
`sprint-24-watcher-local`. Os nove arquivos locais da 24B foram preservados.
Autorização recebida: arquitetura e implementação local, inclusive PostgreSQL
descartável. Não inclui aplicar SQL remotamente, analisar os vinte artigos reais,
ativar operação, deploy, commit ou push. Este relatório não amplia essa autorização.

## Proposta e inventário SQL

Proposta apresentada antes da implementação: manter os dois SQLs 24A e seu manifesto
byte a byte, e acrescentar uma migration, sem substituir a ingestão ou criar outro
cliente SQL operacional. Migration gerada por `supabase migration new` da CLI local
2.110.0: `20261026191808_sprint_24b4a_watcher_intelligence.sql`.

| Objeto novo | Justificativa |
| --- | --- |
| `watcher_intelligence_receipts` | Receipt imutável, chave natural única, versão monotônica de escopo, snapshot completo de contexto/entrada/candidatos e fencing sem tokens |
| `watcher_intelligence_units` | Journal imutável por artigo/revisão/motor/escopo/contexto; inclui sinais, evidências literais, qualificadores e decisões de interpretação; FK composta para a revisão 24A |
| `watcher_intelligence_candidates` | Cabeça por escopo/evento, versão gerada e contador separado de reviews; FK para a identidade de candidato 24A e para o receipt atual |
| `watcher_intelligence_reviews` | Histórico humano append-only com snapshot avaliado, ator, decisão, versões, fencing sem token e receipt próprio idempotente |

Sinais/evidências usam JSONB imutável, como os payloads e snapshots já existentes na
24A. Não criar tabelas separadas para cada atributo NLP: unidade é a prova atômica
da análise, e receipts preservam cada revisão gerada do candidato. Consultas por
evento e revisão seguem índices/FKs; não se promete busca analítica sobre todo JSONB.

Índices explícitos: contexto do receipt; receipt, revisão e feed item das unidades;
identidade 24A e receipt atual das cabeças. PKs/uniques garantem receipt natural,
sequência por escopo, identidade natural das unidades e sequência de review. A
unicidade `(id,scope)` do receipt suporta FKs compostas e impede referência entre
escopos. Não se adicionou índice GIN amplo nem índice/tabela em domínio comercial.

Três triggers reutilizam `watcher_immutable` da 24A para receipts, unidades e reviews.
Funções auxiliares: normalização compatível com Core, extração por offsets UTF-16,
validação de evidência e lock/validação das leases. Três RPCs novas: commit,
review e consulta de inteligência. Nenhuma RPC, trigger ou tabela 24A foi substituída.

## Contrato de commit

`watcher_commit_intelligence(p_commit_id uuid, p_fences jsonb, p_payload jsonb)`.

`p_fences`: array de `{sourceId,token,configVersion,stateVersion}`. Token existe
somente no parâmetro transitório; não é copiado para receipt, payload ou logs.
`fence_snapshot` armazena apenas identidade/configVersion/stateVersion para auditoria.

Payload versionado `watcher-intelligence-commit/1`:

- `scope`, `engineVersion`, `contextFingerprint` e snapshot canônico `context`.
- `currentRevisionIds` e `currentPointers` com feedItemId/revisionId/observedAt,
  obtidos dos ponteiros autoritativos da ingestão 24A.
- `units`: chave determinística, documento e análise recalculada pelo Core.
- `candidates`: snapshot gerado, identidade do candidato-âncora 24A e expectativas
  de versão gerada/review. Não aceita decisões humanas embutidas no snapshot automático.

O preparador Core reconstrói o resultado com o motor existente e o adapter rejeita
qualquer adulteração antes de RPC. SQL valida novamente forma, limites, referências,
dados da revisão armazenada, contexto da fonte, ponteiros atuais, evidência literal,
conjunto completo de eventos, evidências e sinais ativos de cada candidato.
SQL não reimplementa NLP nem comprova a veracidade jornalística; o servidor/motor
revisado continua sendo a autoridade da interpretação e do contexto canônico.

Resposta: `commitId`, `commitKey`, `scope`, `scopeVersion`, `unitKeys`,
`candidateVersions`, `sourceVersions`, `replayed`. Uma submissão duplicada com outro
ID recebe o ID canônico já persistido. O adapter valida a resposta e não faz retries.

## Atomicidade, escopo e checkpoints

1. Serializar ID e escopo com advisory transaction locks. Procurar receipt antes
   de exigir lease vigente: replay apenas lê e não reaplica a mutação.
2. Para trabalho novo, travar fontes e estados em ordem ASCII estável, validando
   fonte habilitada, token, expiração, configVersion e stateVersion antes das escritas.
3. Exigir journal completo das revisões das fontes do escopo e ponteiros atuais
   exatos. A associação do escopo ao conjunto ordenado de fontes é fixada no primeiro
   receipt; expansão/redução exige outro escopo explícito, não alteração silenciosa.
4. Conferir expectativas geradas/review de cada cabeça e preparar a resposta.
5. Em uma transação da RPC, inserir receipt, unidades novas, identidades-âncora
   ausentes e snapshots/cabeças de evento. Âncoras existentes não são regravadas.
6. Revalidar expiração ao final, incrementar fencing das fontes e liberar leases.
   Exceção SQL, cancelamento/terminação efetiva do backend ou lease vencida reverte
   tudo. Timeout HTTP não comprova rollback: consultar o receipt antes de qualquer
   decisão de recuperação; não reenviar automaticamente.

Ponteiros 24A, artigos/revisões originais, ETag, Last-Modified, lastAttemptAt,
lastSuccessfulObservedAt e contadores de erro RSS não são alterados. O checkpoint
de inteligência é o journal de unidades + receipt completo, não uma data de coleta
falsa. Somente `state_version` de fencing e campos da lease compartilhada avançam.

Uma reversão A→B→A pode reutilizar a revisão antiga A na 24A. Por isso o Core aceita
ponteiros atuais explícitos (mantendo comportamento anterior quando não fornecidos)
e o protocolo inclui a geração `current_observed_at` do feed item. SQL confere a
linhagem atual, sem escolher a revisão por UUID ou apenas pela primeira observação.

Limites: 100 revisões e 100 fontes por commit, 1000 eventos, payload até 2 MiB no
Core e SQL, além dos limites do motor. O tamanho textual JSONB pode impor rejeição
conservadora antes de 2 MiB do JSON compacto. Não truncar journal/evidência para caber.
Se uma fonte acumular mais de 100 revisões, este contrato limitado bloqueia: paginação
ou particionamento incremental mais amplo exige evolução revisada antes de operação
prolongada. Não habilitar scheduler com esse limite como se fosse cursor ilimitado.

## Idempotência e review humano

A unidade usa SHA-256 versionado de artigo, revisão, motor, escopo e contexto.
Revisão/contexto/motor novos têm nova identidade; reprocessamento idêntico reutiliza
a unidade existente somente se documento e análise coincidirem integralmente.

Commit natural inclui escopo, motor/contexto, fontes, unidades e geração dos ponteiros
atuais. Isso distingue A→B→A de replay sem inventar nova revisão. O hash de conteúdo
usa JSONB canônico no servidor; expectativas CAS são controles, não nova interpretação.
Mudança de conteúdo para a mesma chave natural é conflito, não atualização in-place.

Replay não exige que a lease antiga ainda exista e não muda fencing, checkpoint,
candidato ou review. O receipt retornado é histórico, não uma nova leitura do review
atual. Se o chamador adquiriu leases novas para uma análise que já tinha receipt,
deve liberá-las explicitamente; o caminho de replay não escreve para liberá-las.

`watcher_review_intelligence(p_fences jsonb,p_review jsonb)` exige reviewId, escopo,
scopeVersion, evento, versão gerada, reviewVersion, fingerprint do snapshot,
ACCEPT/REJECT/DEFER, actorId UUID e nota. Valida leases de todas as fontes e versões,
acrescenta histórico/receipt e incrementa somente o contador de review humano.
Review repetido com mesmo ID/conteúdo retorna seu receipt; conteúdo diferente conflita.
Duas revisões concorrentes não usam last-writer-wins.

O commit automático nunca grava decisão, ator, nota, contador humano ou histórico.
Expectativa de review obsoleta em trabalho novo resulta em REVIEW_CONFLICT e rollback.
Não há transição APPLY ou chamada a Brand Connector, MMV, Specs ou Prices.

`watcher_intelligence_query` oferece RECEIPTS/UNITS/CANDIDATES/REVIEWS por escopo,
filtro opcional e paginação até 100. A projeção de leitura considera a última versão
do escopo e o review correspondente ao snapshot. Descarte da identidade-âncora 24A
continua soberano. Cabeça ausente do último snapshot completo fica insuficiente.
Histórico de reviews antigos permanece consultável, mesmo após nova evidência.
O campo `review_current` informa se o review corresponde ao snapshot atual. Nova
evidência após decisão humana exige `REVIEW_REQUIRED` (ou permanece insuficiente),
sem transformar automaticamente a decisão anterior em aprovação da nova evidência.
Mudança concorrente da identidade-âncora também aborta integralmente o commit.

## Segurança e isolamento

RLS habilitada nas quatro tabelas; nenhum policy/grant de browser. Funções com
SECURITY INVOKER e search_path vazio; EXECUTE revogado de PUBLIC/anon/authenticated.
service_role recebe SELECT/INSERT nas quatro tabelas e UPDATE somente nas colunas
necessárias das cabeças. Nenhum grant DELETE, UPDATE de audit ou privilégio novo
em produtos/catálogo foi criado. Como na 24A, service_role continua sendo fronteira
de servidor confiável, não uma credencial para browser.

Mesmo após aplicação futura, SECURITY INVOKER não substitui a validação do ambiente.
O executor operacional QA continua com allowlist 24A: as três RPCs novas permanecem
bloqueadas antes do transporte. O adapter baixo nível apenas adiciona métodos à
capacidade RPC já injetada, sem client/env loader/conector SQL adicional ou CLI de
processamento. Uma ativação futura exige autorização e executor QA explicitamente
revisado. Nenhuma chave ou senha de staging/produção foi carregada nesta etapa.

Riscos residuais: `actorId` identifica o ator informado pelo servidor confiável;
não autentica sozinho uma pessoa nem consulta `auth.users`. Contexto canônico deve
vir de repositórios revisados. A comparação temporal usa precisão de milissegundos
do DTO JavaScript; os timestamps originais PostgreSQL não são regravados.
Os testes locais exercitam SQL real e mocks do adapter, sem comprovar transporte
PostgREST/HTTPS ou permissões efetivamente instaladas no QA. Esses gates pertencem
à etapa autorizada seguinte. Não há writer operacional de inteligência habilitado.

## Validação local

Harness 24A reutilizado com extensão opcional `--intelligence`: Docker por pipe
local verificado, imagem já em cache `public.ecr.aws/supabase/postgres:17.6.1.147`,
`--network none`, sem portas publicadas, `--pull=never`, volume descartável e remoção
por ID/nome próprio conferidos. POSTGRES_USER é definido somente nesse cluster de
teste; não é redefinição de credencial real. `initdb --no-sync` acelera apenas a
criação do cluster efêmero; fsync normal de transações não foi desabilitado.

**PASS local da persistência; não é autorização de aplicação no QA.**

| Gate | Resultado |
| --- | --- |
| `pnpm watcher:test:intelligence` | PASS: PostgreSQL 17.6 real, 49 grupos de cenários, zero escrita remota |
| Watcher Core | PASS: 202 testes em 7 arquivos |
| Watcher Agents | PASS: 148 testes em 7 arquivos |
| Watcher adapter/segurança | PASS: 86 testes em 5 arquivos |
| Total Watcher | PASS: 436; preserva os 400 anteriores e acrescenta 36 |
| `pnpm typecheck` | PASS: 9 tarefas |
| `pnpm build` | PASS: build Next.js concluído |
| ESLint direcionado | PASS: Core, adapter, testes novos e ambos os harnesses |
| Prettier dos arquivos pendentes | PASS nos formatos suportados; SQL conferido por execução, LF e diff |
| `git diff --check` | PASS |
| `pnpm lint` | FAIL preexistente: Web, 51 warnings, zero errors; oito demais tarefas passam |
| `pnpm format:check` | FAIL: dívida global em 777 arquivos, contra 779 documentados na fundação; sem reformatação global |
| `pnpm test` | FAIL: seis falhas funcionais conhecidas e cinco timeouts comerciais de 5 s; 1295 testes Core passam |
| Core serial, timeout padrão | FAIL: mesmas seis falhas e três timeouts comerciais; 1297 passam |

Diagnóstico serial com `--maxWorkers=1 --testTimeout=30000`: 1300 PASS e somente
as seis falhas funcionais do baseline, sem timeout. Não foi identificada nova falha
funcional. Isso é diagnóstico de tempo, não mudança dos testes/configuração ou
PASS da suíte global com seu timeout padrão.
As seis falhas funcionais conhecidas pertencem a `administrative-product-specs`,
`engineering-brand-agent-replay`, `mmv-body-version-classification`,
`mmv-platform-mapper`, `mmv-product-reconciliation` e `new-product-check-agent`.
Esses arquivos e os testes comerciais não foram alterados por esta entrega.

Os 49 grupos SQL incluem os 23 da 24A, aplicação aditiva e 25 da inteligência:
sucesso, rollback no segundo evento, duplicidade/receipt perdido, dois workers,
config/state/token obsoletos, lease vencida antes/durante escrita, referências
cruzadas, evidência literal/UTF-16, sinais nulos, contexto/identidade incompatível,
alteração concorrente de âncora 24A, journal completo, ponteiros atuais, review
append-only/replay, CAS automático/humano e dois reviewers, encerramento real do
backend com leitura do receipt antes de recuperação local, rollback de review,
nova revisão/A→B→A, duas fontes/escopo fixo, versão compatível sintética de motor,
imutabilidade, descarte humano legado e sentinelas/privilégios comerciais.
A versão sintética de motor testa separação de armazenamento; não implementa motor 2.
Checkpoints RSS são comparados antes/depois; source versions avançam somente no
commit efetivo. A falha concorrente de identidade reverte também a âncora inserida.

Resultado bruto local ignorado pelo Git:
`.local-reports/watcher-24b4a/postgres-results.json` (`PASS`, `postgres=17.6`,
49 cenários, `remoteWrites=0`). Container próprio removido; nenhum container de
teste Watcher restante. Não foram usados Supabase remoto, artigos reais ou IA.

SHA-256 do draft novo:
`41b202c9287ea7eb3654fbe499c70645a53c0111a19523bf8aaeb5156a677011`.
Os dois SQLs 24A continuam com os hashes aprovados:

- Storage: `0d43e3f5473b08e7b0cb4b2eca30567069c108ecc7946433354997dd80d31e23`.
- Transactions: `41b2a300a53291b44bfd62dda293a6c31ec2e3b9475361c35e0cf2d3ee9a0f06`.

Worktree final: 18 arquivos pendentes, incluindo os nove preservados da fundação.
Novos/estendidos nesta etapa: migration, contrato Core de persistência e seus testes,
adapter existente e seus testes novos, ponteiros opcionais no projetor existente,
exports Core, harness existente e extensão de testes, script pnpm e este relatório.
Os dois documentos da fundação e AI_CONTEXT/CHANGELOG refletem o novo gate.
Nenhum arquivo foi staged. Manifesto, guard/loader QA, lockfile, apps e Legacy
permanecem intactos. Verificação de padrões de segredos nos 18 arquivos não apontou
achados; nenhum `.env`, artefato temporário ou credencial foi incluído.

## Plano de rollback

Antes de qualquer aplicação remota: descartar apenas o novo draft mediante revisão;
não restaurar/resetar o working tree nem remover as fundações pendentes da 24B.
Os SQLs e o manifesto 24A permanecem intocados.

Depois de aplicação autorizada futura: rollback operacional primeiro, bloqueando
o executor e revogando EXECUTE das três RPCs novas do servidor após revisão do
impacto. Preservar receipts/unidades/reviews e snapshots para auditoria; preferir
correção aditiva. Não apagar histórico nem reverter versões de fencing.

Desinstalação física só em janela separadamente autorizada, com export/backup e
prova de ausência de consumidores/dependências: remover RPCs/helpers novos e as
quatro tabelas em ordem de FKs, com RESTRICT, nunca CASCADE sobre 24A. Âncoras
24A não devem ser apagadas automaticamente. Se houver dados reais de análise/review,
não executar drop como rollback rápido. Checkpoints RSS não necessitam recomposição.

## Plano de preflight 24B.4B — somente após autorização QA

1. Confirmar branch/HEAD/diff e aprovar o SHA-256 exato desta migration. Não incluir
   a nova migration na allowlist de aplicação da 24A ou reconciliar seu histórico.
2. Pelo loader seguro e HTTPS, conferir exclusivamente o projeto QA
   `shfsjyjxmgwnlexmdkcs`; não usar PG URL do notebook, credenciais herdadas ou produção.
3. Consultas administrativas somente leitura: PostgreSQL 17.6, objetos/RPCs/grants
   24A, ausência dos quatro objetos e das assinaturas novas, locks/leases ativos,
   privilégios do executor autorizado e dependências inesperadas. Conflitos → NO-GO.
4. Conferir as vinte revisões/fontes do batch 24A e ponteiros atuais, sem analisá-los,
   coletar RSS ou criar registros. Validar que o contexto canônico pode ser obtido
   por repositórios existentes e que os limites do contrato comportam o snapshot.
5. Entregar preflight e autorização separada para aplicar exatamente este SQL por
   API administrativa QA, sem reaplicar 24A. Não ativar o writer nem analisar dados
   como consequência implícita da aplicação.
6. Após aplicação autorizada: postflight somente leitura de RLS, ACLs, search_path,
   assinaturas, índices/FKs, imutabilidade e ausência de alteração comercial.
   Leitura real não comprova mutações: um piloto de inteligência requer gate próprio,
   snapshots/guards completos, receipt estável e reconciliação por leitura em timeout.

Esta entrega termina antes do item 2. Não fazer operações remotas para provar o
que ainda depende de autorização. Sem deploy, commit, push, IA, scheduler, handoff
ou nova coleta. A Sprint 24B completa continua dependente de resultados reais QA.
