# Changelog

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
