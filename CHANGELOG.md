# Changelog

- 2026-07-21: Sprint 2.1 versiona a fundação de autenticação no Supabase com enums de role/status, `public.profiles`, criação transacional de profiles, manutenção de ciclo de vida, grants mínimos, RLS, policies de autosserviço e testes SQL; nenhum banco local ou remoto recebeu a migration nesta entrega. A numeração documental da decisão de autenticação foi corrigida para ADR-008.

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Added

- 2026-07-19: definição documental da arquitetura de autenticação e autorização com Supabase Auth, cookies SSR, convite fechado, roles `admin`/`vendedor`, profiles autorizáveis, RLS e plano das Sprints 2 a 4; o ciclo explícito de status foi refinado posteriormente.
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

- 2026-07-20: refinamento documental da autenticação antes da Sprint 2: profiles passam a usar status `pending`/`active`/`disabled`; novos usuários são sempre `vendedor`/`pending`; promoção a admin é explícita; fluxos de convite, aceite, desativação e reativação registram seus atores e timestamps; MFA de admin e `audit_log` permanecem evoluções futuras, sem implementação.
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
