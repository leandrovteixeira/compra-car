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
- **CONCLUÍDO:** auditoria documental do repositório e definição do domínio administrativo da Fase 1, sem mudança de schema.
- **CONCLUÍDO:** decisão arquitetural de concentrar as áreas `seller` e `admin` na mesma aplicação Next.js e preservar o Appsmith apenas como referência histórica.

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
- [x] Implementar seleção e comparação de 2 ou 3 veículos, incluindo filtro de diferenças.
- [ ] Implementar vantagens e identidade visual flexível por marca.
- [ ] Gerar e compartilhar PDF completo com aviso legal.
- [ ] Publicar a aplicação no Railway.
- [ ] Validar com os primeiros vendedores.

## Área administrativa no Next.js

- [ ] Comparar os clones dos dois notebooks e confirmar a base oficial.
- [x] Obter e auditar o export oficial do Appsmith.
- [x] Descontinuar o Appsmith como arquitetura-alvo, preservando exports e documentação histórica.
- [ ] Concluir o inventário sanitizado do Supabase e mapear os consumidores das integrações históricas antes de qualquer remoção.
- [ ] Implementar autenticação e autorização planejadas com roles `seller` e `admin`.
- [ ] Proteger as áreas `seller` e `admin` na mesma aplicação Next.js.
- [ ] Confirmar permissões, constraints, preços, políticas, vigência e monetização de specs.
- [ ] Implementar `/admin` no aplicativo Next.js.
- [ ] Implementar criação, edição, clonagem e validação de duplicidade de veículos.
- [ ] Implementar gestão de preços e políticas exclusivamente em grade.
- [ ] Implementar comparador administrativo com indicadores financeiros e todos os specs.
- [ ] Implementar exportação de uma comparação com bloco financeiro e specs.
- [x] Preparar o export auditado e a documentação operacional do Appsmith sem incluir segredos.
- [ ] Manter os artefatos Appsmith somente como referência, sem novas implementações.

## Fase 2 administrativa — importações assistidas por IA

- [ ] Importar cartas comerciais em staging com saída estruturada.
- [ ] Importar fichas técnicas em staging e associar nomenclaturas a spec codes.
- [ ] Exigir revisão humana antes da promoção para tabelas definitivas.
- [ ] Registrar termos originais, mapeamentos e correções aprovadas.
- [ ] Avaliar fine-tuning somente após medir a abordagem híbrida inicial.

## Backlog pós-MVP

- Adicionar cardinalidade explícita `single`/`multiple` para conjuntos de opções.
- Avaliar agrupamento visual de itens `scale`, preservando uma linha por `code` no domínio.
- Validar combinações incompatíveis somente após formalização das regras.
- Evoluir a taxonomia de categorias sem depender dos prefixes atuais.
- Substituir ou evoluir o importador Excel para a estrutura vigente.
- Revisar os prefixes legados sem usá-los como fundamento arquitetural.

## Fase futura — Supabase V2 e arquitetura definitiva

Esta fase não representa compromisso imediato de calendário. Ela depende dos resultados do piloto, da validação dos fluxos administrativos e de uma decisão arquitetural explícita que confirme escopo, riscos e estratégia de migração.

- Criar Supabase Staging V2 e schema canônico.
- Criar ou evoluir importadores para a estrutura V2.
- Migrar dados de forma controlada.
- Evoluir a autenticação e autorização existentes sem criar uma segunda aplicação.
- Evoluir a área `admin` do Next.js e criar adaptador V2 quando aprovado.
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
- Next.js é a única aplicação técnica e contém as áreas `seller` e `admin`.
- `admin` também possui acesso à área `seller`.
- Appsmith está descontinuado como arquitetura-alvo e é preservado apenas como referência histórica.
- A Fase 1 administrativa não altera schema.
- GitHub é a fonte oficial; `C:\Dev\compra-car` é o ambiente local; OneDrive é somente espelho.
- O MVP deve validar uso real antes da reconstrução completa.
- O aviso legal deve aparecer na aplicação e no PDF.
- O sistema não deve sugerir vínculo oficial com montadoras sem autorização.

## Arquitetura-alvo atual

Supabase atual → adapters → contratos normalizados → casos de uso → aplicação Next.js

Aplicação Next.js → área `seller` + área `admin` → autenticação e autorização compartilhadas

## Arquitetura futura

Supabase V2 → Adaptador V2 → contratos normalizados → casos de uso → mesma aplicação Next.js
