# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Added

- 2026-07-18: criação inicial do Engineering Hub, com estrutura de diretórios e documentação de contexto, operação e arquitetura.
- Criação de `PRODUCT_SPEC.md`, `DOMAIN_MODEL.md`, `CONTRACTS.md` e `UI_FLOW.md` como documentos de fundação anteriores à implementação do Next.js.
- Atualização do escopo do MVP para disponibilizar todas as versões ativas já existentes no Supabase atual.
- Preparação da inspeção mínima e somente leitura do Supabase atual.
- Criação dos scripts SQL de inventário de schema, relacionamentos, RLS e perfil controlado de candidatos.
- Criação dos documentos de plano de inspeção, requisitos de dados do MVP, mapa do Legacy Supabase Adapter e registro de resultados pendentes.

### Changed

- Primeira revisão arquitetural dos quatro documentos de fundação.
- Refinamento da identidade da unidade comparável para versões ativas de veículo, separando existência histórica de disponibilidade comercial.
- Separação conceitual entre `AdvantageRule`, a regra versionada e auditável, e `Advantage`, o resultado de sua aplicação.
- Refinamento dos contratos de qualidade dos dados, disponibilidade de equipamentos, rastreabilidade por snapshot e geração de PDF.
- Correção da ordem de execução: Supabase atual, inspeção mínima, adaptador legado, validação dos contratos, UI, MVP e piloto.
- Remoção da nova carga do Excel e de alterações estruturais amplas do banco como pré-requisitos do MVP; o importador será evoluído posteriormente para respeitar a estrutura vigente.
