# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Added

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

- Consolidação de `Vehicle` como combinação comercial de marca, modelo, versão, ano-modelo e ano de produção.
- Catálogo público condicionado a `isActive`, `isPublic` e existência de ao menos um item comparável.
- Cada `ComparisonItem.code` passa a identificar uma linha independente; itens `scale` não possuem cardinalidade no MVP.
- Registro do backlog pós-MVP para cardinalidade, agrupamento visual, combinações, taxonomia, importador e prefixes legados.
- Atualização da documentação para refletir o monorepo, o domínio implementado e a separação entre core e infraestrutura.
- Refinamento da identidade comparável e separação entre diferença e vantagem.
- Correção da ordem de execução: Supabase atual, inspeção mínima, adaptador legado, validação dos contratos, UI, MVP e piloto.
- Remoção da nova carga do Excel e de alterações estruturais amplas do banco como pré-requisitos do MVP.
