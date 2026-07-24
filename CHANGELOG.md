# Changelog

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
