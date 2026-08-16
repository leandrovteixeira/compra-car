# Changelog

## 2026-08-16 — Segmented Extraction da Sprint 10C.3C

- Adicionados provider/source session genéricos para Structured Outputs, com upload único por
  documento, reuse entre units, `store:false`, usage por response e cleanup após convergência.
- Implementados contexto/prompt brand-agnostic por unit, projeção strict com round-trip,
  canonicalização determinística server-owned e validação canônica de cada artifact.
- Adicionado scheduler com concorrência limitada, deadline por unit/total, ordem lógica, stop
  scheduling, abort de siblings, erros sanitizados e resultado operacional retryable em memória.
- Cobertas fixtures sintéticas 4/13/100/20, partitions, contexto, relações, falhas, determinismo,
  source reuse e cleanup. Runtime one-shot, Supabase, migrations, remotos e Legacy não mudaram;
  nenhuma chamada de modelo foi executada.

## 2026-08-16 — Document Map da Sprint 10C.3B

- Implementados `CommercialDocumentMap/1` e `CommercialExtractionUnitPlan/1`, com types estruturais,
  JSON Schemas Draft 2020-12 strict e validators puros de limites, ownership, referências,
  continuações e coverage.
- Adicionado planner determinístico server-owned com prioridade por tabela/seção/família/canal,
  fallback limitado, partitions de tabela lógica, headers/notas como context-only e overlap
  rastreável.
- Adicionadas fixtures sintéticas Geely/GWM/Fiat/Volvo/VW-like e testes de tabela multipágina,
  13/13 rows estimadas, regra geral posterior, 12 famílias/100 combinações, canais, volume,
  determinismo e zero órfãos.
- Schema, validator e planner ficaram fora do barrel raiz/Edge; somente types puros foram exportados.
  Runtime, providers, Supabase, RPCs, migrations, remotos e Legacy não mudaram; nenhum batch ou
  chamada de modelo foi executado.

## 2026-08-16 — Contrato intermediário da Sprint 10C.3A

- Implementado no core o contrato provider-agnostic `CommercialDocumentExtraction/1`, com types e
  JSON Schema Draft 2020-12 strict para documents, blocks, tables, identities, facts, scopes,
  composição e coverage.
- Adicionado validator puro para limites de payload, páginas/anos/valores, IDs locais, referências,
  continuação de tabelas, scopes, grupos/relações e consistência de coverage.
- Adicionadas fixtures sintéticas Geely-like, GWM-like 13/13, Fiat-like de doze famílias/cem
  identities e Volvo-like por canal, além de testes positivos, negativos e de boundary.
- Documentadas invariantes, limites, autoridade server-owned de IDs e separação do payload canônico.
  Runtime, providers, adapter Supabase, jobs, RPCs, migrations, Staging, Production e Legacy não foram
  alterados; nenhuma OpenAI, batch ou chamada externa foi executada.
- Marcada 10C.3A como implementada; a próxima etapa permanece 10C.3B — Document Map.

## 2026-08-14 — Spike de extração intermediária da Sprint 10C.3

- Consolidado o A/B Geely v4: precision, MMVs/MSRP, período, E/OU e integridade preservados, mas a
  broad-rule propagation ainda não fechou e confidence continuou alta; tuning one-shot foi pausado.
- Documentada a decisão por pipeline segmentado em duas camadas: document map/extraction units,
  intermediate facts, merge/reconciliation e somente então domain mapping para o contrato canônico.
- Proposto `CommercialDocumentExtraction/1` conceitual, com blocos, tabelas, identities, fatos,
  relações, scope, coverage e evidence, sem autoridade de Product/Policy/Offer/promoção.
- Definidos provider genérico, orchestration/plugin boundaries, artifacts JSON privados, retry por
  stage/unit, human review e rollout 10C.3A–F. Runtime, schemas, migrations e remotos não mudaram.

## 2026-08-14 — Prompt v4 estático da Sprint 10C.2

- Consolidado o A/B real Geely v3: 4/4 MMVs e MSRP, período e E/OU corretos, zero false positive
  material, recuperação substancial de Policies, Offers e evidence, mas permanência de
  underpropagation de uma regra documental ampla para duas rows abrangidas.
- Preservados Prompts v1/v2/v3 e ativado o v4 com `RULE INVENTORY / SCOPE LEDGER`, reconciliação
  bidirecional row-centric/rule-centric, exceptions first, propagação independente de proximidade,
  cobertura cumulativa de alternativas e gate de confidence por completude de regras.
- Provider atualizado para `openai/4`; schemas `CommercialLetterExtraction/1` e
  `commercial-letter/mmv-payload/1`, matching e ownership server-side permanecem inalterados.
- Fixtures sintéticas cobrem escopos DOCUMENT/MODEL, exceção explícita, Policy compartilhada,
  alternativas, coverage issue e a fronteira do gate HIGH. Nenhuma OpenAI ou escrita remota ocorreu;
  v4 ainda aguarda A/B autorizado.

## 2026-08-14 — Prompt v3 estático da Sprint 10C.2

- Preservados Prompts v1/v2 e ativado o v3 com inventários documental/MMV, enumeração exaustiva de
  tabelas, PY/MY separados, Policy-first, integridade Offer→Policy, coverage quantitativa/familiar,
  canais, contexto multipágina, preços, E/OU e confidence orientada a completeness.
- Provider semântico atualizado de `openai/2` para `openai/3`; schemas transport/canônico continuam
  v1 e toda autoridade de matching/promoção permanece server-side.
- Testes estáticos cobrem as regras do prompt e fixtures provam 20/100 MMVs, Policies compartilhadas,
  canais, anos separados, referências válidas e REVIEW existente. Limite >100 e pressão de output
  foram registrados como arquitetura futura; nenhuma chamada OpenAI ou escrita remota foi feita.

## 2026-08-14 — Integridade referencial Policy/Offer da Sprint 10C.2

- Auditado localmente o `unknownPolicy` do Volvo batch 113/Job 35: transport, parsing,
  reconstrução e sanitização preservam literalmente os client IDs e não removem nem deduplicam
  Policies. A inconsistência, portanto, já estava no output do provider e foi corretamente recusada
  antes do matching.
- Mantida a rejeição canônica para Offers parcial ou totalmente órfãs, sem placeholder, associação
  fuzzy ou descarte silencioso. Diagnóstico seguro agora expõe somente contagens, paths afetados e
  remappings (zero enquanto não existir transformação determinística de Policies).
- Adicionados 15 cenários sintéticos de integridade referencial. Prompt v2, schemas e provider não
  mudaram; nenhum retry, chamada OpenAI/Supabase, migration ou efeito comercial foi realizado.

## 2026-08-14 — Hardening do matching em volume da Sprint 10C.2

- Corrigido o fan-out sem limite do matching pós-provider: até 100 rows agora têm chaves MMV
  normalizadas e deduplicadas, processadas em chunks dirigidos de 10, sem full catalogue scan nem
  expressão textual `.or()`.
- Chaves com ano ausente ou não canônico não enviam valores inválidos às colunas `smallint` e não
  são elegíveis a confirmação por business key; fallback por tokens continua somente `suggested`.
- Adicionado diagnóstico local/test sanitizado para operação, volume, chunk, filtro, status e code
  PostgREST, mantendo genérico o erro persistido. Fixtures cobrem 100 MMVs, dedupe, caracteres
  especiais, anos opcionais e falha atômica de chunk. Nenhum provider ou remoto foi executado.

## 2026-08-14 — Lifecycle de timeout da Sprint 10C.2

- Substituído o timeout de negócio implícito do Vitest por deadline server-side configurável no
  OpenAIExtractionProvider, com AbortSignal, erro seguro `PROVIDER_TIMEOUT`, cleanup em `finally` e
  fail RPC atômica; lease e harness agora têm margem superior ao timeout funcional.
- Registrado o benchmark congelado: GWM/Job 31 sucedeu com 1/13 MMVs nominais; Fiat/Job 32 excedeu
  180 s; Volvo/VW não foram executados. O Job 32 foi recuperado pelo reclaim oficial e finalizado
  pela fail RPC como `PROVIDER_TIMEOUT`, com batch/documento `failed`, zero rows e hashes comerciais
  inalterados. Prompt v2, schemas, matching e FakeProvider foram preservados.
- Consolidado o resultado Geely v2: o retry oficial Job 30 sucedeu com 46.290 tokens e quatro rows,
  apresentou melhora parcial de cobertura e confidence 92–94, mas permaneceu todo `unmatched` e não
  encerrou a validação semântica. Prompt v3 não foi criado.

## 2026-08-13 — Sprint 10C.2 OpenAI extraction provider

- Corrigido localmente o blocker do Job 29 sem nova chamada OpenAI: toda confidence fornecida pelo
  provider conserva somente o score; o servidor deriva `high` (90–100), `medium` (70–89) ou `low`
  (0–69) antes da validação canônica. Band do provider deixou de ser autoritativa tanto no overall
  quanto nos metadados de campo; score inválido continua recusado.
- Prompt/provider permanecem v2 e os schemas canônico/transport não mudaram. A preservação de
  provider run/usage em falha pós-provider foi documentada para migration/RPC separada, sem update
  direto não atômico.
- Corrigido o reenvio confirmado de PDF já usado em outro dossiê: após a Server Action, o input
  oculto agora é reidratado com o `File` mantido no estado e preserva o role pareado pelo ID estável.
  A detecção por SHA-256, a confirmação explícita e a idempotência por submissão permanecem ativas;
  nenhuma migration ou chamada OpenAI foi realizada.
- Preparado localmente o Prompt/provider v2, sem chamada OpenAI: escopo documental explícito,
  coverage matrix por MMV, segunda passagem de reconciliação, herança de benefícios gerais em
  alternativas, contexto de tabelas, completeness em confidence/REVIEW e evidence de escopo.
- Preservado o Prompt v1 como baseline reproduzível e versionado o provider ativo como `2`, sem
  alterar `CommercialLetterExtraction/1`, transport schema, matching ou autoridade server-owned.
- Documentado o baseline real Geely v1: 43.804 tokens, ~US$ 0,285, quatro rows, 4/4 MMVs/MSRP,
  precision observada alta e nenhum false positive observado; recall incompleto em condições do
  EX2 MAX e EX5 PRO/MAX e confidence 96–98 sem penalização. A Sprint continua não validada.
- O segundo probe opt-in, ainda sem PDF, Files API ou Supabase, confirmou que a Responses API aceita
  o transport schema após a tipagem explícita de `enum`/`const`. O batch real não foi executado.
- Um probe opt-in sem PDF nem Supabase isolou a rejeição remanescente em
  `properties.timezone`: schemas `enum`/`const` sem `type` explícito. A derivação agora declara
  `type: string` para esses casos comprovadamente textuais e o auditor cobre os limites globais
  oficiais e cada branch de `anyOf`; nenhuma segunda chamada foi feita.
- Corrigida definitivamente a derivação Structured Outputs: `$defs` alcançáveis ficam na raiz,
  todos os `$ref` são validados, opcionais usam nullable no wire e keywords fora da allowlist são
  removidas apenas do transporte. Um auditor fail-fast e testes negativos impedem regressão antes
  de qualquer chamada externa.
- Diagnóstico opt-in de `invalid_json_schema` inclui somente `param` e mensagem curta sanitizada,
  sem body, headers, request, credenciais, URLs ou payloads.
- Diagnosticado o primeiro smoke real: o schema de transporte strict continha `oneOf` e
  propriedades opcionais incompatíveis com o subconjunto da Responses API. O schema canônico não
  mudou; a derivação para Structured Outputs agora usa `anyOf` e requer todas as propriedades.
- O provider passou a classificar 403 como auth e 400/422 como `PROVIDER_REQUEST_INVALID`, com
  diagnóstico local opt-in por etapa sem bodies, headers, credenciais ou payloads.

- Adicionado provider OpenAI server-only opt-in sobre Responses API, PDF nativo temporário,
  Structured Outputs strict, validação local, reconstrução server-owned, cleanup e erros seguros.
- Adicionados testes sem custo e smoke real separado com gates de Staging; nenhuma migration,
  promoção ou mudança em `Legacy` foi realizada.
- Adicionados `openai@6.49.0` (fixado e compatível com Node 20) e Ajv ao pacote web.

## 2026-08-12 — Sprint 10C: fundação do processamento

- Adicionado lifecycle auditável de jobs, claim concorrente, retry seguro e finalização atômica das rows.
- Adicionados contrato/registry de provider, provider fake determinístico, plugin de cartas comerciais e matching conservador de Product.
- Adicionada ação administrativa mínima de processamento e documentação operacional/de segurança.
- Hardening pré-Staging: JSON Schema executado com invariantes complementares, campos server-owned reconstruídos, lease/reclaim, locks de batch, auditoria ponta a ponta, limites de payload, matching direcionado, filename invariance e 34 assertions pgTAP.
- Staging validado funcionalmente em `shfsjyjxmgwnlexmdkcs` com o application flow, adapters, Storage, RPCs e FakeProvider reais: happy path, replay, retry, reclaim, concorrência, matching exact/suggested/unmatched, invariância de filename, campos server-owned, rejeição canônica e limites passaram sem efeito comercial. A ausência de pgTAP remoto foi compensada por 648/648 assertions locais e smokes remotos explícitos.
- Provider real permanece PENDENTE; a Sprint 10C não promove preços, Policies ou Offers automaticamente.

## 2026-08-11 — Sprint 10B: correção final do fluxo manual

- Removidos `encType` explícitos dos formulários ligados a Server Actions, deixando React/Next
  definirem método e codificação do `FormData`.
- A seleção de PDFs passou a ser cumulativa para seletor e drag-and-drop, preservando ordem e papel
  por documento, sincronizando `input.files` e informando duplicatas locais e excesso do limite.
- O operador não informa mais título: o servidor gera um identificador operacional neutro no fuso
  `America/Sao_Paulo`, sem inferir dados comerciais ou usar filename como fonte semântica.
- `competence` virou hint opcional do plugin `commercial_letters`. A coluna e o constraint existentes
  já aceitavam `NULL`; uma migration altera somente a validação da RPC, preservando batches
  históricos e evitando competência artificial.
- A migration foi aplicada exclusivamente ao Staging `shfsjyjxmgwnlexmdkcs` (versão remota
  `20260811232647`). O pgTAP relevante passou com 36/36 assertions e rollback sem batches/objetos
  residuais. Produção e `Legacy` permaneceram intocados.
- Corrigido o blocker de transporte dos uploads: Server Actions e middleware do Next.js usam teto
  centralizado de 64 MiB, enquanto UI e application layer limitam os arquivos de uma submissão a
  60 MiB para reservar overhead multipart. O limite de 32 MiB por PDF permanece inalterado.
- Corrigida a persistência do papel documental: arquivo e `documentRole` agora compartilham um
  identificador estável no `FormData`, eliminando o pareamento frágil entre dois arrays por índice.
  Pares ausentes ou duplicados falham explicitamente, sem fallback silencioso de papel.
- Sprint 10C não foi iniciada. A Sprint 10B continua pendente do teste manual final com dois PDFs.
## 2026-08-11 — validação de retomada da Sprint 10B

- Protegido o corpus local de pesquisa com `/data/research/` no `.gitignore`; 167 PDFs reais foram
  inventariados localmente sem alteração de nomes ou bytes e sem envio em massa.
- Executados no Compra Car Staging (`shfsjyjxmgwnlexmdkcs`) os smokes controlados de upload,
  duplicidade no mesmo dossiê e entre dossiês, signed URL, ausência de acesso público, expiração,
  compensação de Storage e reconciliação de órfãos.
- O estado final do Staging contém seis documentos de smoke reconciliados com seis objetos, sem
  órfãos, documentos ausentes ou resíduo da compensação.
- O pgTAP local do Import Engine passou com 34/34 assertions; a suíte SQL completa executou 611
  assertions e teve uma única falha textual preexistente sensível ao checkout CRLF, fora da 10B.
- Lint, typecheck, build e testes focados do Import Engine passaram. A falha web e o format check
  global foram classificados como baseline preexistente e não bloqueante.
- Corrigido mojibake localizado nas mensagens runtime do fluxo 10B de adicionar documentos, sem
  alterar contratos ou comportamento.

## 2026-08-02 — Sprint 10B: fundação do Import Engine

- Formalizado o Import Engine no ADR-013, com core independente, plugin `commercial_letters`, batch
  como dossiê, documentos físicos próprios e payload normalizado como boundary futura.
- Criada `pricing_import_documents` e campos explícitos de plugin/dossiê no batch, preservando
  colunas e registros históricos sem backfill artificial.
- Adicionado bucket privado `import-engine-documents`, upload administrativo de múltiplos PDFs,
  SHA-256 dos bytes, limites de 20 arquivos/32 MiB, detecção de duplicidade, idempotência e
  compensação de objetos em falha.
- Criadas RPCs server-only para criar dossiê, adicionar documentos, alterar papel, rejeitar e
  arquivar, com ator, correlation ID, CAS, lifecycle e auditoria append-only.
- Adicionadas listagem, criação, detalhe e inclusão posterior em `/admin/imports`, com signed URLs de
  curta duração e sem progresso/processamento artificial.
- Nenhum provider externo, extração, row por MMV, review ou promoção foi implementado. Produção e
  `Legacy` permaneceram intocados.
- Uma migration separada restaurou os ramos históricos financeiro e de Offer em
  `prevent_terminal_pricing_migration_rule_change`, isolando acessos a colunas por tabela. A suíte
  pgTAP local passou com 611 testes.
- As três migrations novas foram aplicadas somente ao Staging. A validação remota ficou pendente
  porque o conector administrativo atingiu o limite de uso antes do primeiro teste/smoke; nenhum
  artefato temporário chegou a ser criado.

## 2026-08-01 — Sprint 9H.5: encerramento do workspace comercial

- Preços persistidos como `published` passam a exibir o badge visual “Expirado” somente quando
  `ends_on` é anterior à data operacional de `America/Sao_Paulo`; lifecycle e status armazenado não
  mudaram.
- O falso erro após publicação foi corrigido no adapter: a RPC retorna a linha física sem o join de
  Product, portanto a relação agora é carregada e validada antes da mutação e reutilizada no
  mapeamento do retorno. Sucesso de publicação também fica separado de falha posterior de refresh.
- O modal de MSRP reutiliza `formatPtBrMoneyInput` e `ptBrMoneyCaretPosition`, preservando máscara
  pt-BR na digitação e decimal canônico no servidor. Formulários administrativos em escopo
  desativam autofill nos campos monetários, numéricos e de descrição.
- O cabeçalho mantém os três cards com altura/padding comuns; Competência, modo especial e descrição
  do período ocupam linhas independentes, sem deslocar o seletor.
- Auditoria somente leitura no Staging confirmou que o VW Taos (Product 617) possui apenas o preço
  #29, publicado desde 01/08/2026, aberto, `lock_version=2`, sem duplicidade ou sobreposição e com
  evento de publicação preservado. Haval #19/#24 confirmou a fronteira Expirado/Publicado.
- Nenhuma migration, RPC, enum, trigger, RLS ou regra temporal foi alterada. Produção e `Legacy`
  permaneceram intocados.

## 2026-08-01 — Sprint 9H.4: polish final do workspace comercial

- O período especial mantém Policies inalteradas atravessando o intervalo e cria linhas somente para
  substituições/adições. A sucessora referencia a predecessora e as Offers trocam o membership pelo
  `policyClientRowId`; a RPC 9H.2 encerra a predecessora em D−1 antes de criar a sucessora em D.
- A matriz de Offers publica suas seleções locais para o workspace. Checkboxes de Offers existentes
  ou novas recalculam imediatamente total, uso e disponibilidade das Policies, sem save ou refresh.
- O modal oficial de MSRP ganhou “Publicar agora”: cria o draft, reutiliza o ID/lock retornado e chama
  a publicação individual existente. Após sucesso, o refresh local atualiza cabeçalho e workspace.
- O cabeçalho passou à proporção aproximada 55/25/20; a coluna redundante de veículo saiu do grid
  fixado pelo workspace; ações foram alinhadas e a matriz de Offers foi compactada para desktop.
- Nenhuma migration, RPC, trigger, regra de lifecycle, RLS, auditoria ou contrato público foi
  alterado. Produção e `Legacy` permaneceram intocados.

## 2026-08-01 — Sprint 9H.3: operação mensal definitiva de Policies e Offers

- Corrigida a cópia Agosto→Setembro: cada linha local preserva o ID da Policy de origem e as Offers
  resolvem memberships por `policyClientRowId`. Um vínculo expirado sem sucessora bloqueia o save;
  não existe mais fallback silencioso para `policyId` do mês anterior.
- O loader completa Policies referenciadas por Offers mesmo quando o limite de histórico não as
  trouxe, eliminando joins parciais entre consultas paginadas independentes.
- O grid ganhou Rebate monetário opcional, persistido em `dealer_rebate_amount` com proveniência
  `manual`, limitado ao benefício do cliente e excluído do total/preço transacional.
- Adicionado `invoice_discount`/Desconto NF como Policy de valor fixo, combinável e publicável.
- Valores copiados entram no estado em pt-BR; descrição virou modal compacto; remoção usa botão
  circular acessível; o cabeçalho desktop usa proporção 50/30/20.
- Quando falta MSRP aplicável, “Adicionar preço” abre o formulário oficial de preço público em
  modal e cria somente draft pelo fluxo existente, sem INSERT direto.
- Migration canônica `20260801202216` aplicada somente ao Staging. O cenário real do Product 616 foi
  validado de forma reversível: três Policies e duas Offers de setembro foram criadas com
  memberships exclusivamente de setembro; Rebate não alterou os totais.
- Produção e `Legacy` não foram tocados. Nenhum commit ou push foi realizado.

## 2026-08-01 — Sprint 9H.2: período comercial e rollover atômico de Policies/Offers

- O workspace agora deriva um período mensal completo ou um intervalo especial interno à
  competência, com cabeçalho compacto em três colunas e sem vigência editável por linha.
- Na ausência de dados do período, Policies e Offers vigentes em D−1 são copiadas somente para o
  estado local. O salvamento cria exclusivamente novos drafts com o intervalo exato.
- Criada a RPC `create_commercial_period_draft`, exclusiva de `service_role`, que fecha
  predecessoras esperadas e cria sucessoras de Policy/Offer numa transação com advisory lock,
  optimistic locking, ator, correlation ID e auditoria append-only.
- A exceção terminal de Offer `published` permite somente `valid_to = period_start - 1` dentro da
  nova RPC. Status, memberships e identidade econômica permanecem imutáveis; Offer `archived` e
  fechamento mensal retroativo de publicada são rejeitados.
- Publicação continua individual. Não foi criado comando de publicar período nem entidade/tabela de
  competência.
- A migration `20260801190935` foi aplicada apenas ao Staging. A validação SQL reversível confirmou
  D−1, intervalo exato, status/memberships, snapshots, concorrência e rollback sem deixar resíduo.
- A limpeza aprovada foi executada por script transacional Staging-only, sem migration e sem
  `TRUNCATE CASCADE`: 25 Policies, 14 Offers, 25 memberships, 6 batches/16 rows/16 outputs de Policy
  e 37 auditorias correspondentes foram removidos. Permaneceram 10 Products, 17 preços, 1 parameter
  set, 4 batches/8 rows/8 outputs de preço e suas 23 auditorias protegidas; triggers retornaram a
  `origin`.
- Produção e `Legacy` não foram tocados. Nenhum commit ou push foi realizado.

## 2026-08-01 — Sprint 9H.1: diagnóstico do rollover e refinamento da operação mensal

- Reproduzido no Staging, em transação revertida, o rollover da Taxa do Product 616 em setembro:
  o SQLSTATE `55000` protege as Offers não arquivadas #26 e #28 que usam a Policy #66.
- A falha de dependência agora preserva o lote editado, destaca a linha e informa Offers relacionadas
  e correlation ID, sem arquivar, encerrar ou substituir Offers automaticamente.
- A prévia instantânea voltou a usar o Product fixado pelo workspace e o mesmo domínio da
  submissão para Taxa, IPVA, Seguro, Emplacamento e valores fixos, sem persistência.
- O cabeçalho passou a uma grade 2×2 com Product, competência N−6/N+6, data-base e MSRP; Offers
  existentes e novas compartilham uma única matriz, com memberships persistidos, edição de drafts,
  detalhes acessíveis, archive explícito e estados published/archived somente leitura.
- Nenhuma migration ou RPC nova foi criada nesta etapa; Produção e `Legacy` não foram tocados.

## 2026-08-01 — Sprint 9H: operação mensal e rollover temporal de Policies

- Adicionada competência mensal persistida na URL, data-base única do lote e leitura por interseção
  temporal com histórico anterior recolhido e limitado.
- A matriz de Offers passa a receber somente Policies vigentes na data-base; preço público aplicável
  aparece como referência somente leitura.
- Criada RPC transacional de lote com rollover por Product + tipo, controle otimista, rejeição de
  futuro/ambiguidade, proteção de Offers não arquivadas e auditoria correlacionada.
- A imutabilidade de Policy publicada ganhou exceção mínima e autenticada apenas para `ends_on`
  durante o rollover. Archive, memberships e Offers históricas permanecem inalterados.
- Adicionados testes de contexto mensal e pgTAP 019 para timeline, rollback, auditoria, Offers e
  imutabilidade. A migration foi aplicada exclusivamente ao Staging; Produção permaneceu intacta.

## 2026-07-31 — Sprint 9G.1: estabilização da UX e dataset de Staging

- Corrigido o update do dirty state durante render: `onDirty` agora ocorre no evento antes do
  updater funcional local, sem atualizar o workspace durante a renderização do grid.
- Linhas auxiliares completamente vazias são removidas do payload; linhas parciais continuam
  validadas. Após sucesso, Policies e Offers são relidos via `router.refresh()` e os formulários
  transitórios são reconstruídos para o Product selecionado.
- Labels administrativos usam Taxa e Voucher sem alterar identifiers nem títulos persistidos.
- Topbar, header contextual e headers de tabela usam tokens compartilhados e offsets sticky
  acumulados, com wrappers desktop sem ancestral de overflow vertical concorrente.
- O script idempotente `scripts/staging/07-expand-admin-dataset.sql` ampliou exclusivamente o
  Staging `shfsjyjxmgwnlexmdkcs` de 2 para 10 Products, reutilizando oito veículos reais de
  `Legacy/products.csv`; 608/609 e todos os dados existentes foram preservados.

## 2026-07-31 — Sprint 9G: workflow administrativo por veículo

- Consolidado o workspace “Criar políticas” com seletor único de veículo, Policies e combinações.
- Removido o CTA individual “Novo preço”; “Criar preços” passa a ser o fluxo oficial em lote.
- A tabela de preços publica drafts/needs-review pela RPC existente, com confirmação e refresh.
- Adicionada migration com quatro RPCs administrativas auditadas, controle otimista, archive sem
  DELETE e substituição atômica de memberships de Offer draft.
- Policies em uso por Offers ativas são protegidas; registros terminais permanecem imutáveis.
- Headers do Admin e das grades longas permanecem sticky com fundo opaco e z-index explícito.
- Adicionado pgTAP 016 para lifecycle, dependências, atomicidade, concorrência e auditoria.
- A migration foi aplicada exclusivamente ao Staging `shfsjyjxmgwnlexmdkcs` como versão remota
  `20260731172651`; as 16 asserções pgTAP passaram em transação revertida e a conferência posterior
  confirmou zero fixture e zero evento de auditoria residual. Produção e `Legacy` não foram tocados.
- Próxima etapa registrada: importação assistida por IA com staging e aprovação humana.

## 2026-07-30 — Sprint 9E: estabilização da homologação de Pricing

- Corrigida a fronteira Server Action/Client Component do lote de preços, removendo objetos com
  protótipo nulo e adicionando regressão explícita de serialização plain-object.
- Numeric do PostgREST passou a ser canonicalizado imediatamente como decimal string nos adapters
  de Pricing, inclusive referências financeiras e amounts, sem cálculo financeiro em floating point.
- Auth agora distingue sessão ausente de erro técnico, registra timings sanitizados apenas em DEV e
  evita consultas duplicadas na mesma renderização; loaders independentes permanecem paralelos.
- Criado combobox acessível e reutilizável de Product nas telas de preços em lote, policies e offers;
  o display segue `Marca Modelo Versão MY/PY`.
- Batch Policies passou a resolver exatamente um MSRP publicado e uma referência financeira pela
  data de início, sem depender de `endsOn`; prévia e envio agora compartilham a mesma regra temporal.
- A grade de Policies foi condensada em oito colunas, com títulos, taxas fixas e vigências derivados
  no servidor; a busca de Product usa tokens em AND e popup em portal para evitar clipping.
- Preços e valores fixos de policies agora mantêm máscara monetária pt-BR durante a edição, sem
  alterar o decimal canônico persistido; Taxa aceita vírgula decimal e continua usando cálculo exato.
- A máscara monetária normaliza estados transitórios de edição antes de reagrupar milhares, evitando
  corrupções como `1.0000,00`; parsing de persistência permanece estrito e separado do display. O
  payload de policies também canonicaliza `amount` antes da RPC.
- Labels administrativos foram reduzidos a `Taxa` e `Voucher`, preservando identifiers e títulos
  persistidos existentes. A grade de policies foi compactada para caber no desktop sem scroll.
- A migration `20260730223142_fix_manual_policy_batch_open_ended_msrp.sql` substitui somente a RPC
  atômica para aceitar, em policy aberta, MSRP finito válido em `startsOn`; incompatibilidades reais
  continuam rejeitando e revertendo o lote completo.
- A migration foi aplicada somente ao Staging. Testes SQL reversíveis validaram Bônus + IPVA,
  rejeição de MSRP expirado e Taxa 24/0,49/60, todos com zero resíduo após rollback.
- A segunda validação no Staging persistiu atomicamente Trade-in + Taxa + IPVA no batch 16, criando
  três policies `draft`; a Taxa 24/0,49/60 foi confirmada em R$ 6.893,41.
- Falhas da RPC agora são registradas no servidor com correlation ID e erro técnico, mantendo a
  mensagem segura no frontend. Produção e `Legacy` não foram acessados ou alterados.

## 2026-07-29 — Sprint 9D: Offer Builder

- Criada `/admin/prices/offers` com seleção explícita de Product, MSRP, vigência e Policies
  compatíveis, preview monetário exato e listagem de drafts recentes.
- Adicionados validação e caso de uso no core, contratos, adapter server-only e RPC atômica para
  Offer, memberships e auditoria; browser roles não recebem execução.
- A migration `20260729202538` foi aplicada somente em Staging. O teste remoto reversível validou
  duas Policies, reuso entre Offers e rejeição cross-product, preservando os counts após rollback.
- pgTAP 011/012/013 permanece pendente por indisponibilidade da stack local, não por falha da suíte.

## 2026-07-29 — Sprint 9C: Batch Policies

- Criada `/admin/prices/policies/input` para até 100 CommercialPolicies manuais em draft.
- O fluxo preserva as fronteiras UI → Server Action → core → repository → adapter → RPC e resolve
  MSRP e Financial Parameter Set no servidor; cálculos monetários usam `decimal.js`.
- As migrations `20260729190304` e `20260729192018` foram aplicadas somente no Staging. A segunda
  corrige a resolução de variáveis PL/pgSQL identificada pelo primeiro teste transacional.
- Teste remoto fixed/calculated/financing passou com rollback integral. Nenhuma Offer ou membership
  foi criada. pgTAP 011/012 permanece pendente por indisponibilidade da stack local.

## 2026-07-29 — Sprint 9C-0: Financial Reference Foundation

- Preparada migration forward-only para derivar taxas decimais de CDI/spread, impedir vigências
  publicadas sobrepostas e executar rollover transacional com optimistic locking e auditoria.
- Definido spread mensal do MVP em `0,3000%` e aprovado CDI mensal inicial de `1,1458%`, resultando
  em taxa mensal de referência de `1,4458%`; o dado não faz parte da migration.
- Preservadas `manual` e `api_import`, preparando futura ingestão por `source_snapshot` sem crawler,
  API ou fornecedor.
- A migration foi aplicada somente ao Staging `shfsjyjxmgwnlexmdkcs`; V1 foi criada como draft e
  publicada pela função oficial, e o teste de rollover foi revertido sem deixar fixture.
- Adicionado pgTAP para lifecycle, segurança, derivação, imutabilidade, rollover e não regressão.
  A execução local permanece pendente porque `supabase start` não criou a stack neste ambiente.

## 2026-07-28 — Sprint 9B: Batch Prices

- Criada a rota administrativa `/admin/prices/input`, com grade responsiva e pesquisável, linha
  vazia operacional, limite de 100 preços e seleção de todos os Products administrativos, inclusive
  inativos e não públicos.
- Adicionados contratos, validação pt-BR sem floating point, caso de uso, repository e adapter
  dedicado; erros preservam a linha por `clientRowId` e conflitos não sobrescrevem preços existentes.
- A RPC transacional `create_manual_price_batch` persiste batch, rows, outputs, auditoria e preços
  `draft` de forma atômica, com ator/correlation server-side, admin ativo e execução exclusiva por
  `service_role`.
- A proteção de `pricing_import_batches.source_type` permanece no enum físico
  `pricing_source_type`; não foi criada constraint redundante. Batch Policies, Offer Builder,
  publicação e importação por arquivo continuam fora do escopo.
- Adicionados testes de core, adapter, serviço/UI e pgTAP; a suíte SQL local completa passou com 428
  testes após reset integral do Supabase.
- A migration foi aplicada exclusivamente ao Staging `shfsjyjxmgwnlexmdkcs`. O teste funcional
  transacional foi revertido deliberadamente e as contagens antes/depois permaneceram idênticas,
  sem fixture artificial e sem migration pendente.

## 2026-07-28 — Sprint 9A: Pricing Domain V2

- Evoluído o modelo de `CommercialOffer 1:N CommercialPolicy` para Product 1:N Policy e
  Offer↔Policy N:N, com backfill transacional e remoção da FK direta antiga.
- Adicionados lifecycle independente, publicação e auditoria de Policy, composição imutável de Offer
  publicada, validações de Product/vigência e RPCs auditadas de link/unlink com optimistic locking.
- Todas as Policies publicáveis passaram a exigir benefício positivo; manutenção usa valor fixo,
  wallbox/other permanecem monetizados e registro gratuito usa exatamente 1% do MSRP-base.
- Adicionados contratos discriminados, cálculo monetário puro de benefício/preço transacional e
  adaptador Supabase para Policies, Offers e memberships.
- Batch persistente passou a aceitar origem manual e a imutabilidade terminal de
  ProductPublicPrice passou a abranger `ends_on`, `price_type`, `source_reference` e
  `legacy_source_id`.
- Criado ADR-012 e sincronizados domínio, contratos, roadmap e documentação de Pricing. As próximas
  etapas são 9B Batch Prices, 9C Batch Policies e 9D Offer Builder.
- A migration foi aplicada exclusivamente ao Staging `shfsjyjxmgwnlexmdkcs`: 1 Offer e 1 Policy
  legadas foram reconciliadas em 1 membership, sem alteração das contagens de Offers, Policies,
  applications, batches ou preços e sem acesso à Produção.

## 2026-07-27 — Criação e edição administrativa de ProductPublicPrice

- adicionados contratos e casos de uso de criação em `draft` e edição de status não terminais;
- implementada escrita server-side no adapter dedicado, com ator autenticado e concorrência
  otimista por `lock_version`, sem migration ou RPC nova;
- `/admin/prices` recebeu formulário acessível, feedback, refresh da lista e BRL sem centavos;
- publicação, revisão, rejeição, arquivamento, Offers, Policies e filtros permanecem pendentes.

## 2026-07-27 — ProductPublicPrice administrativo em leitura

- criada a rota `/admin/prices` dentro do Admin existente, com loading, sucesso, vazio, erro e
  paginação server-side;
- adicionados entidade, tipos monetários/status, DTOs, repository e caso de uso mínimos de leitura;
- adicionado `ProductPublicPriceSupabaseAdapter`, dedicado a Pricing e sem alteração do adapter
  legado;
- adicionados mapeamento defensivo, formatação pt-BR e testes de core, adapter, service e UI;
- documentada a divergência de `ends_on` resolvida pela migration versionada mais recente;
- mantidos fora do escopo escrita, publicação, CommercialOffer, CommercialPolicy e
  `commercial_policy_applications`.

## 2026-07-27 — Auditoria do Admin para evolução de Pricing

- documentado o inventário completo das rotas, camadas, componentes, autenticação, autorização,
  contratos, acessos a dados e testes da área administrativa Next.js existente;
- registrado o mapa de dependências por tela e a aderência ao domínio vigente em que
  `CommercialPolicy` pertence diretamente a `CommercialOffer`;
- classificados gaps, dependências legadas, riscos e componentes reutilizáveis, sem alteração de
  código funcional ou banco;
- definido roadmap incremental do MVP-A preservando o Admin atual e tratando
  `commercial_policy_applications` somente como compatibilidade histórica.

## 2026-07-26 — Fechamento da revisão técnica de pricing

- Adicionado o fluxo transacional `publish_commercial_offer`, independente do modelo legado de
  applications, com MSRP publicado obrigatório, validação completa das policies, auditoria,
  bloqueio de UPDATE direto e proteção de DELETE para offers terminais.
- Ausência de rebate passou a ser `NULL/NULL`; o rateio agregado usa maiores restos em centavos sem
  valores negativos. Voucher, maintenance e `other` legado receberam validações consistentes entre
  SQL e TypeScript.
- Tipos de pricing foram centralizados em contracts, valores deprecated documentados e relatórios
  passaram a separar ocorrências, offers, policies, prices, sources e entidades bloqueadas.
- Migration e pgTAP foram preparados, sem aplicação, backfill, escrita ou publicação.

## 2026-07-26 — Finalização da migration de pricing legado

- Oficializada a alocação auditável de `total_dealer_rebate`: componentes explícitos prevalecem e o
  total sem detalhamento é rateado por benefício positivo entre retail, trade-in e financiamento,
  com ordem determinística, resíduo controlado e bloqueio quando não alocável.
- Adicionados `free_registration`, `free_maintenance`, `fuel_or_recharge_voucher` e suporte final a
  `free_wallbox`, além de `non_monetized`, parâmetros específicos e validação de publicação por tipo.
- O dry-run passou a gerar `dealer-rebate-allocation-analysis.csv`; os falsos mismatches agregados
  foram removidos sem reclassificar `others_bonus` ou criar policy genérica.
- Migration e testes SQL foram ampliados sem aplicação, escrita, backfill ou publicação.

## 2026-07-26 — Pricing legacy dry-run 3.0.0

- Introduzidos candidatos de `commercial_offers` como agregado pai por linha legacy, com vínculo ao
  MSRP versionado, policies da mesma offer, accumulators OR somente para duas ou mais policies e
  relatórios específicos de offers, prices, policies e issues informativos.
- Corrigidos os 254 falsos financiamentos incompletos: `0/0/0` e `NULL/NULL/NULL` agora significam
  ausência de financiamento; os 459 casos reais usam CDI mensal composto + spread de 0,30 p.p. e
  diferença de valores presentes.
- Confirmados seguro em 3% do MSRP por ano e IPVA proporcional, com base de cálculo versionada;
  divergência do total histórico passou a `LEGACY_CALCULATION_METHOD_DIFFERENCE` informativa.
- Ampliada a migration futura, não aplicada, com `commercial_offers`, FKs, índices, constraints,
  imutabilidade terminal e validação de publicação independente por tipo de policy.

## 2026-07-26 — Pricing legacy dry-run 2.0.0

- Mapeados rebates de varejo, trade-in e taxa para `dealer_rebate_amount`, com reconciliação separada
  de `total_dealer_rebate`, preservando zero e excluindo rebate do benefício do cliente.
- Implementados IPVA proporcional pelo mês da oferta, grupos OR provisórios, CDI efetivo anual de
  14,78% convertido por capitalização composta e financiamento pelo método oficial de valor presente,
  com comparativo de total pago e rastreabilidade do parameter set.
- Ampliados reconciliação, análise de termos financeiros e samples determinísticos; criada migration
  estrutural idempotente, sem execução, backfill ou publicação.

## 2026-07-26 — Pós-validação do restore local de pricing

- Corrigido o falso sucesso do restore: o fallback agora executa `pg_restore` em `postgres:17` com o
  snapshot montado como somente leitura, `--dbname` obrigatório e sem `--file`; `RESTORED_LOCALLY`
  só é emitido após validar as sete contagens explícitas esperadas no banco local.

## 2026-07-26 — Correção de bindings Docker do restore de pricing

- A detecção da porta PostgreSQL agora normaliza publicações IPv4 e IPv6 equivalentes para o mesmo
  mapeamento lógico `54322 -> 5432/tcp`, preservando a rejeição de portas, protocolos, endereços e
  mapeamentos conflitantes.
- O preflight local também aceita o IP privado interno exato do container PostgreSQL inspecionado,
  com normalização IPv4/IPv6 e CIDR, sem aceitar correspondência apenas por sub-rede ou endereço
  remoto.

## 2026-07-26 — Exportação oficial do snapshot legado de pricing

- Criado `export-pricing-legacy-snapshot.ps1` para validar origem remota autorizada e somente leitura,
  gerar dump custom data-only das sete tabelas permitidas e publicar somente após TOC, SHA-256 e
  validação pelo script existente.
- Adicionados `psql`/`pg_dump` locais com fallback `docker run postgres:17`, credenciais via ambiente
  temporário, exclusão e rejeição de `SEQUENCE SET`, arquivos temporários e manifesto sanitizado.
- Registrado o snapshot manual validado em 2026-07-26 (262858 bytes, SHA-256
  `ad982044e1c93dc98e47f180a128d6d7d088fa4ecb0a8c05d88ddd6c6cc0648c`), sem afirmar restore ou
  dry-run real.
- Ampliada a suíte PowerShell com exportação integral simulada, allowlist remota, confirmação,
  prioridade local/Docker, segurança de argumentos, hash/manifesto e preservação em falha, sem rede.

## 2026-07-26 — Fallback Docker para snapshots de pricing

- Centralizada em `PricingSnapshot.Common.psm1` a resolução e execução de `psql` e `pg_restore`,
  preservando prioridade para executáveis locais e adicionando fallback automático via `docker exec`.
- O container PostgreSQL possui default configurável, é inspecionado quanto a existência, estado
  `running`, health `healthy` e mapeamento da porta local para a porta interna; dumps seguem por
  `stdin`, sem cópia, instalação ou mudança de imagem.
- Mantidos argumentos seguros, validações, allowlist, fluxo, relatórios e contrato do manifesto; a
  senha continua somente em `PGPASSWORD` temporário e não aparece em argumentos ou mensagens.
- Ampliada a suíte PowerShell com cenários de prioridade local, fallback, Docker ausente, container
  inexistente/unhealthy e estabilidade do manifesto, sem conexão ou alteração de banco.

## 2026-07-25 — Preparação de fotografia local do legado de pricing

- Criados três scripts PowerShell e um módulo comum para validar dump autorizado, restringir o alvo
  à stack local, restaurar somente as sete tabelas legadas necessárias e encadear automaticamente o
  pricing dry-run.
- Implementadas validações fail-closed de caminho, tamanho, extensão, SHA-256, formato/TOC,
  allowlist, owner, comandos destrutivos e argumentos perigosos, sem flag de bypass remoto.
- A restauração exige confirmação explícita, destino local vazio, transação única e opções data-only;
  credenciais ficam fora de argumentos, saídas e manifesto.
- Adicionado manifesto sanitizado com identidade local, contagens, resultado, hash comparável e
  status, além de regras de `.gitignore` para dumps, snapshots, SQL restaurado e relatórios locais.
- Criada suíte PowerShell com 11 cenários, incluindo execução do dry-run sobre fixture e validação do
  manifesto, sem conexão de banco. Nenhuma migration, acesso remoto, backfill ou gravação no domínio
  de pricing foi realizada nesta etapa.

## 2026-07-25 — Dry-run local do legado de pricing

- Criado `@compra-car/pricing-dry-run`, com leitura PostgreSQL em transação `REPEATABLE READ READ
  ONLY`, bloqueio de host remoto e identidade sanitizada, sem DML, DDL, RPC ou migration.
- Separados módulos de leitura, decimal exato, canonicalização, classificação, fingerprints,
  reconciliação, cobertura de views e geração de relatórios determinísticos.
- Implementadas as classificações de preço, oito componentes/evidências comerciais, conflitos,
  rebates não convertidos, totais somente conciliados e sugestões de combinação nunca publicáveis,
  com os 16 issue codes mínimos.
- Adicionados dez relatórios JSON/CSV/README, baseline comparativa, cutoff, versão do algoritmo,
  hash sem `executedAt` e opção de falha quando a fotografia muda.
- A fixture gerou 5 candidatos de preço, 1 conflito, 9 candidatos de política, 1 sugestão de
  acumulador e 11 itens de revisão. A stack local sem seed gerou relatórios vazios e divergência
  integral da baseline, sem qualquer gravação de banco ou acesso remoto.
- Adicionados 9 testes unitários cobrindo dinheiro decimal, preços, componentes, AND/OR,
  fingerprints, CSV, hash, reconciliação e bloqueio de banco remoto.

## 2026-07-25 — Views de leitura da Sprint 9

- Criada `20260725191747_create_pricing_read_views.sql` com cinco views `security_invoker` para
  períodos de preço publicados, preço vigente, aplicações de políticas, acumuladores materializados
  e compatibilidade paralela v2.
- A leitura corrente exclui preços futuros e estados não publicados, deriva o fim pelo próximo
  `starts_on` e representa ausência sem fallback zero.
- As views comerciais expõem somente contratos sanitizados; acumuladores retornam valores já
  materializados e IDs de membros em ordem determinística, sem somar políticas isoladas.
- `vw_product_value_current_v2` preserva as oito colunas, ordem e tipos da view legada, troca apenas
  a origem do preço e mantém explicitamente o cálculo legado de valor percebido, que não possui
  equivalente seguro no novo modelo. `vw_product_value_current` não foi alterada.
- Default ACLs foram neutralizadas; `public`, `anon` e `authenticated` não têm acesso e
  `service_role` possui somente SELECT. Foram adicionados 33 testes pgTAP; reset limpo e os 326
  testes SQL passaram exclusivamente na stack local, sem backfill ou acesso remoto.

## 2026-07-25 — Validação e publicação transacional da Sprint 9

- Criada `20260725184656_create_pricing_validation_and_publication_functions.sql` com quatro funções
  públicas para publicar preço, parâmetros financeiros, política e acumulador, seis helpers internos
  e sete triggers de proteção.
- As RPCs validam admin ativo pelo `profiles`, estado, lock otimista, correlation ID, domínio e
  auditoria atômica; somente `service_role` possui `EXECUTE`, sem acesso de browser ou helper público.
- Implementadas validações dos oito tipos, `scope_snapshot.productIds` exato, MSRP/parameter set
  publicados, snapshots v1, fórmulas `numeric`, HALF_UP e intermediários do financiamento com
  tolerância decimal máxima de `1e-10`.
- Acumuladores calculam fingerprint canônico por IDs ordenados, materializam somente produtos na
  interseção dos membros e somam `monetary_value` já congelado antes da publicação.
- Publicação direta pelo `service_role` foi bloqueada sem variável de sessão; rows de batches
  promovidos/arquivados, outputs promovidos e reviews históricas ficaram imutáveis, inclusive contra
  nova review depois da promoção.
- Adicionadas 74 asserções pgTAP e ajustadas fixtures/contagem estrutural afetadas; reset limpo e os
  293 testes SQL passaram exclusivamente na stack local. Nenhum banco remoto foi acessado ou
  alterado.

## 2026-07-25 — Lifecycle e proteção de auditoria da Sprint 9

- Criada `20260725182545_create_pricing_lifecycle_and_audit_triggers.sql` com quatro funções
  `SECURITY INVOKER` e 23 triggers, sem funções completas de publicação ou writer genérico de
  auditoria.
- Automatizados `updated_at` e `lock_version` nas sete tabelas aplicáveis; o incremento ignora valor
  informado pelo caller e é sempre exatamente `OLD.lock_version + 1`.
- Tornada `pricing_audit_events` append-only também contra UPDATE/DELETE do owner e bloqueados
  regressão de estado terminal, delete e alterações materiais em preços, parâmetros, políticas,
  aplicações, acumuladores e imports em estado terminal.
- Funções com `search_path = ''` e `EXECUTE` revogado de `public`, `anon`, `authenticated` e
  `service_role`; RLS, grants mínimos e default privileges globais permaneceram inalterados.
- Adicionadas 43 asserções pgTAP e ajustado o teste estrutural para o estado pós-lifecycle; reset
  limpo e os 219 testes SQL passaram exclusivamente na stack local. Nenhum banco remoto foi
  acessado ou alterado.

## 2026-07-25 — Importação, revisão e auditoria da Sprint 9

- Criada `20260725180750_create_pricing_import_and_audit_tables.sql` com quatro enums e cinco
  tabelas para batches, linhas, outputs, revisões humanas e eventos de auditoria.
- Adicionadas as três FKs RESTRICT de `source_import_row_id` das tabelas core para
  `pricing_import_rows`, após confirmar localmente que não havia referências preenchidas.
- Implementados 16 checks, 16 FKs nas tabelas novas, sete mecanismos de unicidade e 19 índices
  explícitos, incluindo exactly-one-output, allowlists, SHA-256, datas, notas e snapshots.
- RLS e ACLs mínimas foram aplicados no mesmo arquivo: sem acesso de browser; quatro tabelas
  operacionais com SELECT/INSERT/UPDATE para `service_role`; auditoria com somente SELECT/INSERT;
  sequences com USAGE/SELECT.
- Adicionadas 47 asserções pgTAP; os 176 testes SQL passaram exclusivamente na stack local. Nenhum
  banco remoto, objeto legado, default privilege global ou consumer foi alterado.

## 2026-07-25 — Segurança do schema core de preços da Sprint 9

- Criada `20260725175159_secure_pricing_core_schema.sql` para habilitar RLS nas sete tabelas core e
  neutralizar, somente nesses objetos, as ACLs amplas herdadas dos default privileges da baseline.
- `public`, `anon` e `authenticated` ficaram sem privilégios nas tabelas e nas seis sequences
  identity; nenhuma policy ou acesso direto de browser foi criado.
- `service_role` recebeu explicitamente SELECT/INSERT/UPDATE nas tabelas e USAGE/SELECT nas
  sequences, sem DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ou UPDATE de sequence.
- Adicionadas 17 asserções pgTAP de segurança e atualizado o teste estrutural para exigir RLS; os
  129 testes SQL passaram exclusivamente na stack local descartável.
- Default privileges globais, owners, objetos legados, migrations anteriores e `Legacy`
  permaneceram inalterados; nenhum banco remoto foi acessado ou alterado.

## 2026-07-25 — Primeira migration estrutural da Sprint 9

- Criada a migration forward-only `20260725172755_create_pricing_types_and_core_tables.sql` com os
  cinco enums e as sete tabelas centrais de preços públicos, parâmetros financeiros, políticas,
  aplicações e acumuladores, sem dados, backfill, views, RLS, comandos de grant/revoke ou funções.
- Implementadas apenas constraints locais e índices documentados; regras transacionais de
  publicação, cálculo, auditoria, segurança e importação permanecem nas migrations seguintes.
- Adicionada suíte pgTAP estrutural com 39 asserções; o reset e os 112 testes SQL do repositório
  passaram exclusivamente na stack Supabase local descartável.
- Nenhum banco remoto foi acessado ou alterado, e nenhuma migration anterior ou conteúdo de
  `Legacy` foi modificado.
- Confirmado localmente que default privileges da baseline concedem ACLs amplas aos novos objetos;
  por isso, a migration estrutural não deve ser aplicada isoladamente em ambiente compartilhado
  antes da migration de segurança com RLS e revokes explícitos.

## 2026-07-25 — Revisão final da arquitetura da Sprint 9 antes das migrations

- Separados `input_monetary_value`, input opcional por aplicação/produto, e `monetary_value`, valor
  econômico final obrigatório e congelado.
- Formalizadas as semânticas de fixed amount, percentual de MSRP, valor presente e estimativa
  manual, com campos/constraints de publicação específicos para os oito tipos enum do MVP.
- Consolidado que zero só existe em draft/needs_review, tipos dinâmicos ficam fora do MVP e
  benefícios novos usam `other + manual_amount`.
- CDI/spread continuam sem valor real definido: não bloqueiam tabelas ou drafts, mas bloqueiam
  publicação de financiamento sem parameter set manual versionado e publicado.
- Nenhuma migration, implementação funcional ou alteração de banco foi executada nesta revisão.

## 2026-07-25 — Arquitetura da Sprint 9: preços e políticas comerciais

- Aceito o ADR-011 como detalhamento definitivo do modelo alvo iniciado no ADR-009, separando preço
  público, política, aplicação monetária por produto, acumuladores e importações revisáveis.
- Documentados o schema alvo completo, o plano forward-only de migração/backfill e as regras
  versionadas de cálculo, incluindo valor presente do financiamento subsidiado e snapshots.
- A arquitetura preserva o legado, mantém `vw_product_value_current` temporariamente e envia zero,
  duplicidades e relações E/OU ambíguas para `needs_review`.
- Esta etapa não criou código funcional, migration ou objeto de banco e não alterou Appsmith,
  Next.js, schema ou dados.

## 2026-07-25 — Início da Sprint 9: investigação de preços e políticas comerciais

- Iniciada a inspeção somente leitura do modelo legado, dos dados remotos e dos consumidores de
  preço/política no MVP-a, MVP-u e Appsmith histórico.
- Criado `docs/data/PRICE_AND_COMMERCIAL_POLICY_INVENTORY.md` com inventário estrutural e de código,
  perfil atualizado, fluxo atual, lacunas de CRUD, opções de modelagem, riscos, perguntas de negócio
  e proposta de subtarefas.
- A investigação recomenda avaliar uma migration incremental alinhada ao ADR-009, mas nenhuma
  implementação, migration ou alteração de banco foi executada ou declarada concluída.

## 2026-07-24 — Restauração de Auth Profiles após a baseline

- Identificada a ausência, na baseline legada, do trigger de `auth.users` que cria exatamente um
  `public.profiles`; a omissão fazia os 18 testes seguintes falharem em cascata sobre perfis
  inexistentes.
- Adicionada migration incremental e idempotente para reconciliar funções, triggers, constraints,
  foreign keys, RLS, policies e privilégios da fundação Auth sem modificar a baseline ou dados
  válidos.
- A migration usa `CREATE OR REPLACE FUNCTION`, recria triggers e policies nominalmente e só
  adiciona ou substitui constraints e foreign keys quando ausentes ou divergentes.

## 2026-07-24 — Integridade do domínio de Specs

- Adicionada suíte pgTAP read-only em `supabase/tests/spec_integrity.sql` para validar seleção única
  de scale, modelagem binary, codes, referências, duplicidades, tipos, numeric, catálogo e coerência
  de `spec_set`.
- Cada violação inclui diagnóstico contextual e o relatório final agrega o total de inconsistências.
- Removido `SET TRANSACTION READ ONLY` porque `plan()` pode depender de objetos temporários internos
  do pgTAP. O arquivo permanece sem DML/DDL explícito sobre tabelas permanentes e depende da
  transação revertida por `supabase test db`, além do `ROLLBACK` final.

## 2026-07-24 — Sprint 8: administração de equipamentos e especificações

- Criada `/admin/products/[id]/specs` com ficha contínua, hierarquia real, busca client-side,
  grupos recolhíveis, contadores e edição inline de numeric, binary e scale.
- Adicionados modelo, porta e casos de uso no core para merge do catálogo, validação numeric,
  exclusividade scale, conversões e lote de persistência.
- Numeric aceita vírgula/ponto e duas casas; vazio remove a associação. Binary marcado/desmarcado é
  válido e scale usa dropdown único com `-`.
- Corrigido o merge de binary para preservar ausência de associação como `null`, sem confundi-la
  com `is_present = false`; contadores agora ignoram somente o estado não informado, e a UI usa um
  controle compacto de três estados que mantém `false` explícito no salvamento e no reload.
- Torque aceita entrada Nm/kgfm e persiste apenas Nm usando os fatores lidos de
  `unit_conversions`; `PW_0036` permanece `kg/Nm`.
- O adapter passou a ler specs/valores/conversões e executar upsert/delete coletivos sem acesso
  Supabase na UI, migration ou alteração remota.
- Adicionados acessos pela lista, edição e modal pós-criação, testes de domínio/adapter/UI e
  documentação da limitação transacional e do MVP-u.

## 2026-07-24 — Sprint 7: duplicação administrativa de veículos

- Corrigida a duplicação para copiar `product_specs` de forma independente, preservando
  `equipment_id`, numeric, binary `true`/`false`, scale e `input_unit`, sem copiar IDs ou timestamps.
- Adicionado `DuplicateAdministrativeVehicle`, Server Action específica e compensação segura do
  novo produto quando a cópia da ficha falha; falha de compensação sinaliza o ID incompleto.
- O diálogo pós-sucesso agora oferece revisão direta da ficha copiada no novo ID.
- Implementada `/admin/products/[id]/duplicate` como um novo Create preenchido, com leitura
  server-side da origem, `notFound()` e sem transportar o ID original.
- Reutilizados formulário, normalização, validação e criação; persistência de specs permanece
  isolada no adapter.
- Adicionada ação Duplicar na listagem e modo visual com título e botão “Criar veículo”.
- Mantidos o conflito normal de duplicidade, as regras Public/Active e o modal de criação apontando
  para o novo veículo.
- Confirmado por desenho e testes que preços, imagens, documentos e histórico não são copiados.
- Adicionada cobertura da rota, origem, valores iniciais, ausência do ID, conflito, criação,
  normalização, status, navegação e limites de dados relacionados.
- Nenhuma migration, alteração de schema, escrita remota, commit, push ou deploy foi realizada.

## 2026-07-23 — Sprint 6: edição administrativa de veículos

- Implementada `/admin/products/[id]/edit` com carregamento server-side, `notFound()` para produto
  inexistente, valores iniciais e permanência na página após salvar.
- Generalizado `admin-product-form.tsx` para Create/Edit sem duplicar campos ou regras; a edição
  exibe confirmação inline, valores normalizados e bloqueio durante submissão.
- Adicionados caso de uso de atualização no core, Server Action exclusiva e métodos mínimos de
  leitura/atualização na porta administrativa e no adapter Supabase.
- A duplicidade normalizada exclui o próprio ID e continua protegida pelo tratamento de conflito
  exato do índice único.
- Confirmada em inspeções versionadas a ausência de trigger de aplicação; `updated_at` passou a ser
  definido explicitamente pelo adapter, sem migration.
- Adicionados links Editar na listagem e no modal pós-criação.
- Ampliados testes de carregamento, inexistência, preenchimento, normalização, validação,
  duplicidade, atualização, `updated_at` e navegação.
- Duplicação, specs, preços, imagens, exclusão, auditoria histórica e mudanças de schema permanecem
  fora do escopo.

## 2026-07-23 — Sprint 5: criação administrativa de veículos

- Implementada `/admin/products/new` com os sete campos aprovados, layout responsivo e defaults
  privados/inativos.
- Adicionados normalização, validação, porta e caso de uso reutilizáveis para criação, edição e
  duplicação futuras.
- Ampliado o adapter server-only com busca normalizada de duplicidade e insert explícito somente em
  `products`, retornando o ID gerado e traduzindo conflito único sem expor erro bruto.
- Preservada autorização `admin` antes da construção do adapter privilegiado; a listagem é
  revalidada após sucesso.
- Adicionado diálogo acessível de sucesso; edição e equipamentos permanecem visíveis, desabilitados
  e sem links para rotas futuras.
- Adicionados testes de regras, segurança, persistência e estrutura da interface.
- Adicionados consulta SQL e script versionável para auditoria somente leitura de specs. A execução
  remota inspecionou 59 `numeric`, 171 `binary` e 26 grupos `scale`; encontrou três divergências de
  `detail = spec_set`, sem duplicidade de opção `scale` ou identidade ausente.
- Nenhuma migration, escrita remota de teste, edição/duplicação/exclusão, spec, preço ou imagem foi
  incluída.
- Refinamento final: anos convertidos em selects dependentes e dinâmicos, controles Ativo/Público
  simplificados, filtros administrativos por search params e consulta server-side com AND.
- Cabeçalhos administrativo, da página/filtros e da tabela mantidos visíveis no desktop por offsets
  sticky acumulados; no mobile, o conteúdo adicional permanece no fluxo normal.

## 2026-07-23 — Auth, áreas autenticadas e listagem administrativa

- Consolidada a autenticação SSR com Supabase Auth, cookies, Middleware, login e logout server-side.
- Protegidas as áreas `seller` e `admin` por profile, status e role, com `admin` herdando acesso seller.
- Adicionada navegação autenticada reutilizável para seller e shell administrativo persistente e responsivo.
- Implementadas a visão geral `/admin` e a listagem somente leitura `/admin/products`, sem Create, edição, duplicação ou exclusão.
- Adicionados DTO, serviço server-side, estados de dados/vazio/erro e consulta administrativa estreita pelo adapter legado.
- Aplicada e validada a migration `20260721222256_create_auth_profiles.sql`; o teste pgTAP passou sem persistir fixtures.
- Validações do marco: lint, typecheck, 135 testes e build de produção aprovados antes do commit `75edb4b`.

## 2026-07-23 — Correções bloqueantes de Auth

- Corrigida a preservação dos cookies emitidos pelo Supabase SSR em respostas normais e redirects do Middleware.
- Separados explicitamente os clients Auth server-side read-only e mutável; falhas de escrita deixam de ser ignoradas em Server Actions.
- Corrigido o logout para validar `signOut`, falhar sem falso redirect de sucesso e registrar apenas mensagem segura.
- Fortalecidos testes de cookies, Middleware, logout, redirects internos e filtros comportamentais de `getVehiclesByIds`.
- Registrado o congelamento operacional da migration de profiles, a necessidade de migration forward-only se `vendedor` já existir e a pendência de usuários Auth preexistentes; nenhum SQL foi alterado ou executado nesta rodada.
- Mantida como pendência funcional a decisão futura de exigir specs ativas em `getVehiclesByIds`.

## 2026-07-23 — Fundação mínima de Auth

- Adicionado `@supabase/ssr` com clients Auth browser e server separados do client legado.
- Implementados sessão SSR em cookies, renovação por `middleware.ts`, `/login`, logout server-side e redirect interno seguro por role.
- Implementada autorização server-only por `public.profiles`, com falha fechada para profile ausente, `pending`, `disabled` ou role inválida.
- Protegidos `/`, `/comparar`, `/admin` e as Server Actions do catálogo; `admin` também acessa a área `seller`.
- Criado somente o esqueleto de `/admin`, sem CRUD administrativo.
- Corrigida a consulta direta de veículos por IDs para exigir `is_active = true` e `is_public = true`.
- Corrigidos migration, trigger e testes SQL não aplicados de `vendedor` para `seller`.
- Adicionados contratos Auth mínimos e testes de capabilities, route policy, redirects, validação de usuário/profile e elegibilidade do catálogo.
- Nenhuma migration foi executada, nenhum banco remoto foi alterado e nenhum usuário real foi criado.

## 2026-07-23 — Aplicação Next.js única

- Registrado no ADR-010 que o Compra Car terá uma única aplicação Next.js, com áreas `seller` e `admin` sobre o mesmo Supabase.
- Definido que `admin` também acessa a área `seller` e que a interface pode apresentar as roles como “Administrador” e “Vendedor”.
- Appsmith descontinuado como arquitetura-alvo; exports, inventários, roteiros e integrações existentes permanecem preservados somente como referência histórica, sem novas implementações.
- ADR-007 mantido como registro da decisão anterior e marcado como parcialmente substituído.
- Corrigido o título interno do ADR de separação entre MSRP e políticas comerciais de ADR-008 para ADR-009, alinhando-o ao nome do arquivo e eliminando a colisão com o ADR de autenticação.
- Registrada a inconsistência entre a role `seller` agora aprovada e o valor `vendedor` ainda presente na migration e nos testes SQL não aplicados; a reconciliação é obrigatória antes de qualquer aplicação.
- Autenticação, `/admin`, clients SSR e autorização permanecem planejados e não foram declarados como implementados.
- Nenhum código funcional, banco, migration ou export histórico foi alterado.

## 2026-07-22 — Planejamento da Sprint 1 do MVP-a

- Inventariado o repositório em busca do export atual do Appsmith; confirmada apenas infraestrutura histórica, sem páginas, queries, widgets ou JS Objects exportados.
- Documentados escopo, contrato de dados, mapeamento físico, análise das funções de duplicação, SQL proposto, plano de testes e configuração dos widgets para Gestão de Produtos.
- Recomendada, de forma condicionada à confirmação do export, a sobrecarga explícita `duplicate_product_simple(integer, smallint, smallint, boolean)`, sem cópia de preços ou políticas.
- Nenhuma tela, migration, query remota ou alteração no Supabase foi executada.
- Auditado o export nativo `appsmith/exports/Compra Car App MVP.json` sem alterar o original: três páginas, 27 widgets, 11 actions PostgreSQL, um datasource e nenhum JS Object.
- Confirmado que `Admin Modelos` lista produtos, altera apenas `is_active` e chama `duplicate_product_simple` sem casts; criação, edição geral e gestão de `product_specs` ainda não existem.
- A varredura não encontrou credenciais preenchidas; foi registrada apenas uma referência de hostname Supabase, sem segredo de autenticação.
- Corrigidas referências documentais obsoletas sobre a ausência do export e separadas as confirmações de export/estrutura das pendências de permissão, role e transações.
- Preparado o roteiro do primeiro lote de `Admin Modelos`: listagem com `is_public`/`spec_count`, pesquisa, filtros e duplicação tipada com validação e tratamento de erro, sem alterar o export ou o Supabase.

- 2026-07-21: Sprint 2.1 versiona a fundação de autenticação no Supabase com enums de role/status, `public.profiles`, criação transacional de profiles, manutenção de ciclo de vida, grants mínimos, RLS, policies de autosserviço e testes SQL; nenhum banco local ou remoto recebeu a migration nesta entrega. A numeração documental da decisão de autenticação foi corrigida para ADR-008.

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Added

- 2026-07-19: definição documental histórica da arquitetura de autenticação e autorização com Supabase Auth, cookies SSR, convite fechado, roles então nomeadas `admin`/`vendedor`, profiles autorizáveis, RLS e plano das Sprints 2 a 4; o ciclo explícito de status e o nome `seller` foram refinados posteriormente.
- 2026-07-19: implementação do MVP do motor de comparação com o primeiro veículo como referência, resultados completos para `binary` e `numeric`, estados de empate/desconhecido e exclusão explícita de ranking `scale`.
- Adição do filtro “Ver destaques”, destaque exclusivo das vantagens da referência e suporte à seleção de dois ou mais veículos.
- Adição da migration de dados que define `specs.value_direction = 'Positive'` para o item numeric `Power windows`.
- Redesign da tabela de comparação com cabeçalho e primeira coluna fixos, superfície única de rolagem, cabeçalhos compactos de veículos, estados visuais e tratamento responsivo para grandes matrizes.
- Refinamento da tabela com duas colunas de veículos visíveis em 390 px, presença binary por indicador circular, checks alinhados em slot fixo e formatter brasileiro para torque, relações peso/potência, telas e cilindrada.
- Correção final da apresentação de presença, remoção do placeholder legado `unit` e regra temporária que equipara ausência a `false` somente na comparação `binary`.
- 2026-07-18: implementação do domínio puro em `packages/core`, com `Vehicle`, `ComparisonItem`, valores discriminados, resultado agrupado e erros tipados.
- Implementação dos casos de uso `ListAvailableBrands`, `ListAvailableModels`, `ListAvailableVehicles`, `GetVehiclesByIds` e `CompareVehicles`.
- Definição de `VehicleRepository` e `ComparisonRepository` como portas normalizadas, sem dependência do Supabase.
- Criação de DTOs e reexportações públicas em `packages/contracts`, sem duplicar os tipos do core.
- Adição de 14 testes unitários com Vitest e repositórios in-memory.
- Criação dos ADRs 001 a 005 para identidade por `code`, itens `scale`, isolamento do legado, distinção entre atividade e publicação e autenticação posterior.
- Transformação do repositório em monorepo pnpm 10 + Turborepo 2.
- Criação da infraestrutura de `apps/web` com Next.js 15, App Router, React 19, TypeScript, Tailwind CSS, ESLint e Prettier.
- Preparação de deploy no Railway por meio de `railway.json`.
- Configuração de PWA instalável com manifesto, ícones e modo `standalone`, sem service worker ou funcionalidades offline.
- Criação inicial do Engineering Hub e dos documentos de fundação.
- Preparação da inspeção mínima e somente leitura do Supabase atual e de seus scripts SQL.
- Implementação do `LegacySupabaseAdapter` somente leitura sobre `products`, `specs` e `product_specs`.
- Adição do cliente Supabase server-only, DTOs legados, mappers explícitos, erros seguros e consultas em lote sem N+1.
- Adição de 17 testes do adaptador e 3 testes de integração opt-in, sem credenciais obrigatórias em CI.
- Registro da ausência de FK física em `product_specs.product_id`, da preservação de encoding legado e do ADR-006.
- Conclusão da Fase 3 com o primeiro vertical slice funcional de seleção de veículos, conectando UI, Server Actions, cache do Next.js, casos de uso e `LegacySupabaseAdapter`.
- Adição do composition root de catálogo, DTOs públicos de apresentação e tratamento seguro de erros.
- Adição dos seletores progressivos `Marca → Modelo → Veículo`, seleção de até três veículos e navegação para a futura comparação.
- Conclusão da Fase 4 com comparação server-rendered de dois ou três veículos, agrupada por categoria e preservando a ordem da seleção.
- Adição de parsing seguro da URL `vehicles`, cache ordenado com tags, DTOs públicos de comparação e estados públicos de erro.
- Adição do filtro “Mostrar apenas diferenças”, tabela responsiva e 12 testes unitários da camada web.

### Changed

- 2026-07-20: registro histórico do refinamento documental da autenticação antes da Sprint 2: profiles usariam status `pending`/`active`/`disabled`; novos usuários eram então nomeados `vendedor`/`pending`; promoção a `admin` era explícita; fluxos de convite, aceite, desativação e reativação registrariam seus atores e timestamps; MFA de `admin` e `audit_log` permaneciam evoluções futuras, sem implementação.
- Consolidação do estado real do repositório, separando o comparador público implementado do comparador administrativo planejado.
- Atualização das pendências de dados para distinguir o mapeamento confirmado no repositório da validação ainda necessária no Supabase e no Appsmith atuais.
- Atualização do roadmap e do checklist para incorporar as Fases 1 e 2 do backoffice administrativo.
- Consolidação de `Vehicle` como combinação comercial de marca, modelo, versão, ano-modelo e ano de produção.
- Catálogo público condicionado a `isActive`, `isPublic` e existência de ao menos um item comparável com valor válido conforme a semântica confirmada de `product_specs`.
- Cada `ComparisonItem.code` passa a identificar uma linha independente; itens `scale` não possuem cardinalidade no MVP.
- Registro do backlog pós-MVP para cardinalidade, agrupamento visual, combinações, taxonomia, importador e prefixes legados.
- Atualização da documentação para refletir o monorepo, o domínio implementado e a separação entre core e infraestrutura.
- Refinamento da identidade comparável e separação entre diferença e vantagem.
- Correção da ordem de execução: Supabase atual, inspeção mínima, adaptador legado, validação dos contratos, UI, MVP e piloto.
- Remoção da nova carga do Excel e de alterações estruturais amplas do banco como pré-requisitos do MVP.
# 2026-07-31 — Sprint 9F: combinação de políticas

- Refatorado o Offer Builder para lote de até 100 combinações e 11 categorias determinísticas.
- Adicionados `loyalty_bonus` e a RPC atômica `create_commercial_offer_batch`.
- MSRP e vigência são derivados no servidor; tudo aberto é rejeitado antes da persistência.
- Adicionados logging com correlation ID, testes e documentação.
# 2026-07-31 — Sprint 9F.1: refinamento e proteção de status

- Compactados os labels `Emplac.` e `Manut.` e centralizado verticalmente o conteúdo da matriz.
- Corrigido o guard específico de rollover no trigger terminal compartilhado sem alterar suas regras.
- Arquivados de forma controlada no staging os drafts de teste 17/18/19 do Dolphin; 20/21/22
  permaneceram drafts e únicos nos respectivos tipos elegíveis.
- Registrada a Sprint 9G de gestão de Policies e combinações como próxima etapa.
## Sprint 9G.2 — rollover temporal de preços públicos

- A publicação de um novo MSRP passa a encerrar, de forma atômica e auditada, o preço publicado
  sobreposto em `starts_on - 1`, com lock otimista e serialização por produto.
- Adicionada a RPC administrativa `rollover_product_public_price` para reparar timelines já
  publicadas sem desabilitar a imutabilidade; publicações retroativas diante de preço posterior são
  rejeitadas e timelines com múltiplos predecessores exigem saneamento explícito.
- Corrigido o fixture Haval da Sprint 9G.1 para terminar em 2026-07-31.
## Sprint 9G.3 — estabilização final de UX e workflow

- A listagem de preços públicos ganhou ordenação server-side determinística, inicialmente por
  `updated_at DESC`, e headers alternáveis em ASC/DESC.
- O header contextual foi compactado e alinhado ao topbar desde o primeiro pixel de scroll.
- O retorno do batch manual de preços foi normalizado para JSON simples na Server Action, com
  correlação nos logs técnicos, e o CTA passou a “Salvar preços”.
- O workspace de Policies ganhou feedback após persistência, badges traduzidos de status/uso,
  ações alinhadas e matriz com exatamente uma linha vazia útil ao final.
- Publicação múltipla e DELETE físico de Policy foram mantidos pendentes por exigirem novas RPCs
  administrativas atômicas e auditáveis.
## Sprint 9G.4 — Offers draft com vigência aberta

- `commercial_offers.valid_to` passa a aceitar `NULL` para drafts; batch e substituição derivam o
  menor fim disponível ou mantêm a Offer aberta quando Policies e MSRP são abertos.
- Duplicidade de draft usa comparação NULL-safe e a aplicação identifica a linha quando uma Offer
  idêntica já existe.
- A publicação de Offer aberta permanece explicitamente bloqueada até definição do seu lifecycle.
- A UX exibe vigência aberta, usa “Salvar ofertas” e comunica sucesso ou erro com correlação.
- Checkpoint das Sprints 9G–9G.4 fechado após validação manual em Staging; Produção permaneceu sem as
  migrations desta rodada. Refinamentos da UX para a operação mensal ficam para a próxima etapa.
