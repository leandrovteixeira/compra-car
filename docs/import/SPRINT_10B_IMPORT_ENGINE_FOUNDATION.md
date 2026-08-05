# Sprint 10B — Fundação do Import Engine

## Resultado

O Import Engine recebeu sua fundação operacional para cartas comerciais: dossiês com múltiplos PDFs,
Storage privado, hash SHA-256 real, idempotência, compensação, lifecycle inicial, auditoria e UI
administrativa. Extração, rows por MMV, review e promoção continuam fora do escopo.

## Auditoria e gate estrutural

O único projeto remoto auditado foi **Compra Car Staging** (`shfsjyjxmgwnlexmdkcs`), inicialmente por
consultas somente leitura. Foram inspecionados schema, enums, funções, triggers, grants, RLS,
adapters, UI, testes e Storage.

- `pricing_import_batches` possuía 12 registros históricos, todos `promoted` e sem nome, path ou hash
  de arquivo.
- não existia tabela equivalente a `pricing_import_documents`;
- não existiam buckets nem objetos de Storage;
- tabelas de importação já tinham RLS e acesso direto restrito a `service_role`;
- as colunas históricas de arquivo do batch foram preservadas e nenhum backfill foi necessário.

A mudança foi classificada como incremental e compatível. O ADR solicitado como 012 foi registrado
como [ADR-013](../architecture/decisions/ADR-013-IMPORT-ENGINE-ARCHITECTURE.md), pois ADR-012 já era
ocupado pelo domínio de Pricing v2.

## Modelo implementado

`pricing_import_batches` ganhou `plugin_key`, `dossier_title`, `competence` e `notes`. A tabela
`pricing_import_documents` registra tipo, papel, nome original, bucket/path privado, MIME, tamanho,
SHA-256, páginas, status, ordem, metadados, payload de índice futuro, erros, locks, atores e timestamps.

O lifecycle físico de documento é `uploaded → validated → ready`; a Sprint 10B persiste `ready`
somente depois de validar o PDF, confirmar todos os objetos e inserir tudo atomicamente. Estados de
processamento existem para evolução, mas não são simulados. O batch usa os estados existentes e
termina em `ready`.

Limites centralizados:

- 20 documentos por dossiê;
- 32 MiB por PDF;
- `application/pdf`, extensão `.pdf` e assinatura `%PDF-`;
- `page_count = null` até existir leitor confiável já aprovado; nenhuma dependência foi instalada.

## Contratos e fluxo

O fluxo segue `UI → Server Action → serviço server-only → repositório → adapter Supabase → Storage/RPC`.
O core registra o descritor `commercial_letters` e contratos para criar/listar/carregar batches,
adicionar documentos, duplicidade, signed URL, ajuste de papel, rejeição e arquivamento.

Criação e adição calculam o SHA-256 dos bytes no servidor. Duplicata no mesmo dossiê é bloqueada;
duplicata em outro exige confirmação explícita e registra `duplicateAcknowledged`. Paths usam UUIDs e
nome sanitizado. Uploads concluídos são removidos se a persistência falhar. Em perda de resposta após
COMMIT, a chave de criação ou o `operationId` da adição recupera o resultado sem duplicar linhas.

As RPCs `create_import_engine_batch` e `add_import_engine_documents` validam ator, correlation ID,
Storage, limites, duplicidade e metadados. Mudanças posteriores exigem `expected_lock_version`.
Auditoria append-only registra snapshots de batch/documento, ator e correlação, sem PDF, URL assinada
ou segredo.

## UI administrativa

- `/admin/imports`: lista com busca, status e competência, ordenada por atualização.
- `/admin/imports/new`: título, plugin fixo, competência, notas, múltiplos PDFs e papel por arquivo.
- `/admin/imports/[batchId]`: cabeçalho, documentos, hash, tamanho, páginas, status, signed URL,
  alteração de papel, rejeição lógica e arquivamento.
- `/admin/imports/[batchId]/add`: inclusão idempotente de PDFs enquanto o batch está editável.

Não existe botão de processamento, progresso artificial ou menção a fornecedor. O estado pronto
informa que extração e identificação de modelos serão habilitadas na próxima etapa.

## Segurança

Todas as rotas e ações exigem admin. O browser nunca recebe `service_role` nem acessa Supabase
diretamente. O bucket é privado, não tem policies de browser e a visualização usa signed URL de cinco
minutos. RPCs `SECURITY DEFINER` usam `search_path = ''`, têm execução revogada de public/anon/
authenticated e são concedidas somente a `service_role`. RLS permanece deny-by-default.

Rejeição e arquivamento são lógicos; DELETE físico é bloqueado. Objetos são retidos para
rastreabilidade e uma política de retenção definitiva permanece pendente.

## Próxima etapa — Sprint 10C

Definir o contrato maduro de provider, job/fila, indexação e recuperação de falhas; produzir rows por
MMV no payload canônico; implementar observabilidade e política de retenção; manter review humano e
promoção oficial como gates separados. Um package dedicado ainda não se justifica: os namespaces em
`core`, `contracts`, `adapter-supabase` e `web` preservam as fronteiras sem reorganização prematura.

## Staging e validação pendente

A correção autorizada foi criada em migration separada. Ela restaura o ramo histórico de
`financial_parameter_sets` e preserva a exceção mínima de `commercial_offers`, mantendo cada acesso
a `valid_to`/`effective_from` dentro do guard da respectiva tabela. Migrations históricas não foram
editadas. A suíte pgTAP local completa passou: 23 arquivos e 611 testes.

As migrations da fundação, da adição de documentos e do guard foram aplicadas somente ao Compra Car
Staging (`shfsjyjxmgwnlexmdkcs`). A tentativa de pgTAP via CLI remoto não executou assertions porque o
login não possui acesso ao schema `extensions`. Antes da execução administrativa alternativa, o
conector atingiu seu limite de uso. Portanto, pgTAP administrativo, smokes de upload/signed URL/
duplicidade/compensação/autorização, advisors e reconciliação final permanecem pendentes. Nenhum
objeto ou registro de smoke chegou a ser criado. Produção não foi consultada ou alterada.
