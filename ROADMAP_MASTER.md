# Compra Car — Cronograma Mestre do Projeto

## Objetivo

Criar rapidamente um MVP mobile-first para vendedores de concessionárias, permitindo comparar 2 ou 3 veículos, destacar diferenças e vantagens e gerar um PDF completo com aviso legal.

## Estado atual da Fase 1

- **CONCLUÍDO:** fundação arquitetural e documentação-base do produto.
- **CONCLUÍDO:** infraestrutura do monorepo com pnpm, Turborepo e aplicação Next.js 15 compilável.
- **CONCLUÍDO:** preparação técnica para Railway e PWA instalável, sem suporte offline.
- **CONCLUÍDO:** domínio puro, contratos públicos, portas de repositório e casos de uso centrais, cobertos por testes in-memory.
- **CONCLUÍDO:** mapeamento da superfície mínima de `products`, `specs` e `product_specs`, com dívidas conhecidas registradas.
- **CONCLUÍDO:** Legacy Supabase Adapter server-only e somente leitura, com DTOs, mappers, consultas em lote e testes unitários/integração opt-in.
- **CONCLUÍDO:** vertical slices de seleção e comparação, conectando UI, camada web, casos de uso e adaptador legado.

## Semana 1 — MVP

- [x] Criar Engineering Hub e documentos de fundação.
- [x] Criar infraestrutura Next.js mobile-first em monorepo pnpm + Turborepo.
- [x] Preparar PWA instalável e deploy no Railway.
- [x] Implementar `Vehicle`, `ComparisonItem`, valores discriminados e elegibilidade do catálogo público.
- [x] Implementar portas normalizadas e casos de uso de catálogo e comparação.
- [x] Registrar decisões arquiteturais do domínio e cobri-las com testes unitários.
- [x] Usar o Supabase atual como está, sem exigir nova carga do Excel ou reestruturação ampla do banco.
- [x] Inspecionar e documentar minimamente a superfície usada pelo MVP.
- [x] Mapear o Legacy Supabase Adapter.
- [x] Implementar o adaptador nas portas existentes com validação unitária dos contratos.
- [ ] Validar os contratos com dados do ambiente real pelo teste opt-in.
- [x] Conectar a aplicação Next.js ao adaptador no runtime do servidor.
- [x] Implementar seleção e comparação sobre contratos estáveis, sem acesso direto ao legado.
- [ ] Garantir que o MVP disponibilize todos os veículos ativos, públicos e comparáveis encontrados no Supabase atual.
- [ ] Manter Appsmith como backoffice provisório.
- [x] Implementar seleção e comparação de 2 ou 3 veículos, incluindo filtro de diferenças.
- [ ] Implementar vantagens e identidade visual flexível por marca.
- [ ] Gerar e compartilhar PDF completo com aviso legal.
- [ ] Publicar a aplicação no Railway.
- [ ] Validar com os primeiros vendedores.

## Semana 2 — Exportação e auditoria

- Exportar Supabase e Appsmith.
- Reunir scripts, planilhas, relatórios e documentos.
- Criar inventário técnico e mapear dependências.
- Documentar arquitetura atual e arquitetura-alvo.
- Classificar objetos: KEEP, REFACTOR, MIGRATE, MERGE, ARCHIVE, DELETE, UNKNOWN.
- Normalizar a base de equipamentos.
- Aplicar correções de dados e normalizações gradualmente, com base no aprendizado do piloto.
- Ajustar o importador Excel para respeitar a estrutura vigente do Supabase atual.
- Planejar cargas futuras controladas sem bloquear o MVP ou o piloto.
- Preparar plano de migração.

## Backlog pós-MVP

- Adicionar cardinalidade explícita `single`/`multiple` para conjuntos de opções.
- Avaliar agrupamento visual de itens `scale`, preservando uma linha por `code` no domínio.
- Validar combinações incompatíveis somente após formalização das regras.
- Evoluir a taxonomia de categorias sem depender dos prefixes atuais.
- Substituir ou evoluir o importador Excel para a estrutura vigente.
- Revisar os prefixes legados sem usá-los como fundamento arquitetural.

## Semana 3 — Nova arquitetura

- Criar Supabase Staging V2 e schema canônico.
- Criar ou evoluir importadores para a estrutura V2.
- Migrar dados de forma controlada.
- Criar autenticação simples, inicialmente sem RBAC.
- Iniciar novo backoffice e criar adaptador V2.
- Preservar o frontend Next.js por meio de contratos estáveis.
- Preparar ambiente de produção.

## Princípios do projeto

- GitHub é a fonte autoritativa do código e da documentação técnica.
- Alterações estruturais devem ser versionadas.
- O frontend não deve depender diretamente dos nomes das tabelas legadas.
- Cada `ComparisonItem.code` representa uma linha independente no MVP.
- `isActive` e `isPublic` possuem significados distintos.
- Nenhuma nova carga do Excel ou alteração estrutural ampla do banco é pré-requisito para o MVP.
- O Excel será adaptado posteriormente à estrutura vigente do Supabase atual.
- Appsmith permanece temporariamente como backoffice.
- O MVP deve validar uso real antes da reconstrução completa.
- O aviso legal deve aparecer na aplicação e no PDF.
- O sistema não deve sugerir vínculo oficial com montadoras sem autorização.

## Arquitetura transitória

Supabase atual → Adaptador Legacy → contratos normalizados → casos de uso → Next.js MVP

Supabase atual → Appsmith para operação interna

## Arquitetura futura

Supabase V2 → Adaptador V2 → contratos normalizados → casos de uso → Next.js

Supabase V2 → Novo backoffice
