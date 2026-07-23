# Contexto para agentes de IA

## Propósito

O Compra Car apoia vendedores de concessionárias em comparações claras entre veículos durante o atendimento e na geração futura de material compartilhável.

## Escopo do MVP

- experiência mobile-first e online;
- catálogo baseado nos dados existentes no Supabase atual;
- seleção de 2 ou mais veículos;
- comparação por linhas normalizadas, diferenças e vantagens auditáveis;
- geração e compartilhamento futuro de PDF com aviso legal;
- identidade visual flexível por marca;
- nenhuma nova carga do Excel ou reestruturação ampla do banco como pré-requisito.

## Tecnologias vigentes

- monorepo com pnpm 10 e Turborepo 2;
- Next.js 15, App Router, React 19 e TypeScript 5;
- Tailwind CSS 4, ESLint 9 e Prettier 3;
- Vitest 4 para testes unitários do domínio;
- Railway com configuração em `railway.json`;
- PWA instalável em modo `standalone`, sem service worker ou offline;
- Supabase atual como fonte inicial de dados via adaptador somente leitura;
- Supabase Auth integrado por `@supabase/ssr`, com cookies e clients Auth separados do adapter legado;
- domínio administrativo documentado em `docs/admin`;
- uma única aplicação Next.js como arquitetura-alvo para as áreas `seller` e `admin`;
- Appsmith preservado somente como referência histórica, sem novas implementações.

## Estrutura arquitetural

```text
apps/web                     aplicação Next.js com seleção e comparação implementadas
packages/contracts           DTOs e contratos públicos
packages/core                domínio, portas e casos de uso puros
packages/adapter-supabase    adaptador server-only e somente leitura do legado
packages/shared              utilitários genéricos
packages/ui                  primitivos visuais futuros
```

Direção de execução vigente:

```text
Next.js → contratos/casos de uso → portas do core ← Legacy Supabase Adapter ← Supabase atual
```

O frontend não pode conhecer tabelas, colunas, queries ou particularidades do Supabase legado. `LegacySupabaseAdapter` é a única fronteira autorizada e implementa as portas do core por DTOs e mappers explícitos.

## Domínio consolidado

### Vehicle

`Vehicle` é uma combinação comercial específica de `brand`, `model`, `version`, `modelYear` e `productionYear`. Também contém `id`, `displayName`, `isActive` e `isPublic`.

Um veículo integra o catálogo público somente quando:

1. `isActive = true` — vigência comercial;
2. `isPublic = true` — revisão e liberação editorial;
3. possui ao menos um item comparável com valor válido conforme a semântica confirmada de `product_specs`.

Esses estados não podem ser confundidos.

### ComparisonItem

- `code` obrigatório e estável identifica uma linha independente;
- `binary`, `numeric` e `scale` são os tipos suportados;
- `scale` usa presença independente no MVP;
- dois codes do mesmo `specSet` continuam em duas linhas;
- não existe cardinalidade `single`/`multiple` nesta fase;
- categories e prefixes de origem não determinam a arquitetura.

### Valores

- `binary`/`scale`: `present: boolean | null`;
- `numeric`: `value: number | null` e `unit: string | null`;
- numeric ausente nunca vira zero;
- associação binary/scale ausente resulta em `null`; somente a comparação `binary` a equipara temporariamente a `false`;
- o domínio não formata `Sim`, `Não` ou travessão.

## Casos de uso implementados

- `ListAvailableBrands`;
- `ListAvailableModels`;
- `ListAvailableVehicles`;
- `GetVehiclesByIds`;
- `CompareVehicles`.

`CompareVehicles` aceita 2 ou mais IDs distintos, preserva a ordem, usa o primeiro como referência, completa células tipadas e calcula o resultado contra todos os concorrentes. `binary` usa presença explícita e temporariamente equipara `null` a `false` apenas ao comparar; `numeric` usa direção positiva/negativa e `scale` não é classificado.

## Decisões registradas

- ADR-001: cada `ComparisonItem.code` representa uma linha.
- ADR-002: itens `scale` não têm cardinalidade no MVP.
- ADR-003: o frontend não acessa o banco legado diretamente.
- ADR-004: `isActive` e `isPublic` têm significados distintos.
- ADR-005: decisão histórica de postergar autenticação, substituída pelo ADR-008.
- ADR-006: o legado é traduzido por DTOs/mappers em um adaptador server-only e somente leitura.
- ADR-008: Supabase Auth, cookies SSR, roles `admin`/`seller` e status `pending`/`active`/`disabled`; a fundação SQL de profiles usa `seller`, foi aplicada pela primeira vez no projeto remoto auditado e passou pela validação estrutural e pelo teste pgTAP.
- ADR-007: registro histórico da adoção do Appsmith na Fase 1, posteriormente substituída parcialmente pelo ADR-010.
- ADR-010: uma única aplicação Next.js contém as áreas `seller` e `admin`; `admin` também acessa `seller`; o Supabase é compartilhado e o Appsmith deixa a arquitetura-alvo.
- O resultado distingue vantagem, desvantagem, empate, informação desconhecida e item não aplicável.
- Apenas vantagens da referência são destacadas nesta versão.
- O MVP usa o Supabase atual sem depender de nova carga do Excel.
- O importador Excel será ajustado posteriormente à estrutura vigente.

## Restrições vigentes

- não alterar `Legacy` sem autorização e auditoria;
- manter a inspeção inicial do Supabase somente leitura;
- não implementar ou presumir schema físico sem evidência real;
- não expor chaves, tokens ou segredos;
- não acessar Supabase fora do adaptador legado;
- não colocar regras de negócio em `shared` ou na UI;
- não implementar novas regras de vantagem sem documentação;
- não confundir a fundação Auth implementada com os fluxos ainda ausentes de convite, recuperação de senha e gestão de usuários;
- não usar `user_metadata` como fonte de privilégios nem permitir promoção automática para `admin`;
- não fazer o Middleware consultar o banco ou assumir que RLS é a única barreira administrativa;
- não iniciar novas implementações no Appsmith nem remover seus artefatos ou integrações sem decisão específica;
- não implementar PDF ou offline nesta fase concluída.

## Estado atual — 2026-07-23

A infraestrutura do monorepo, o núcleo de domínio, o adaptador legado e os vertical slices de seleção e comparação estão implementados. `packages/core` contém entidades, value objects, erros, portas e os cinco casos de uso centrais. `packages/contracts` contém aliases, reexportações e DTOs públicos sem duplicação estrutural. `packages/adapter-supabase` implementa as duas portas sobre `products`, `specs` e `product_specs`, sem escrita. `apps/web` conecta seleção e comparação aos casos de uso por camada server-only, `unstable_cache` e composition root.

A fundação Auth está implementada. `@supabase/ssr` mantém a sessão em cookies; o Middleware renova a sessão e redireciona usuários não autenticados; páginas e Server Actions repetem a validação no servidor. `/login` usa e-mail/senha e redirect interno seguro, e o logout é server-side. `public.profiles` é a fonte de role/status; `admin` também acessa a área `seller`; profile ausente, não ativo ou inválido falha fechado.

O MVP-a possui shell administrativo persistente em `/admin/*`, sidebar desktop, menu mobile, navegação, visão geral e `/admin/products`. A listagem de veículos é server-rendered, somente leitura, usa `LegacySupabaseAdapter.listAdministrativeVehicles()` após `requireRole('admin')` e distingue dados, lista vazia e falha. Exibe somente `id`, marca, modelo, versão, anos e flags de atividade/publicação confirmados no adapter. Não existem Create, edição, duplicação, exclusão, cadastro de equipamentos ou preços.

A URL de comparação é `/comparar?vehicles=id1,id2[,id3,...]`. A página valida IDs, preserva sua ordem, executa `CompareVehicles`, apresenta categorias e usa `hasReferenceAdvantage` no filtro “Ver destaques”. A UI usa uma única superfície tabular com cabeçalho e primeira coluna fixos, rolagem bidirecional, células com slot estável para checks e estados dedicados de loading, vazio e erro. O domínio e o adapter não conhecem componentes ou parâmetros de URL.

Os testes do core usam repositórios in-memory. Os mappers do adaptador são testados sem rede e a integração real é opt-in por variáveis exclusivas. A UI de negócio e `Legacy` permanecem sem alteração nesta fase.

A superfície mínima e o mapeamento físico fornecidos para a fase estão registrados em `SUPABASE_INSPECTION_RESULTS.md` e `LEGACY_SUPABASE_MAP.md`. A validação online permanece pendente quando não houver credenciais opt-in e não bloqueia o código ou o MVP.

A arquitetura de autenticação e autorização está em `docs/architecture/AUTHENTICATION_ARCHITECTURE.md`. A migration `20260721222256_create_auth_profiles.sql` foi aplicada uma única vez no projeto remoto Compra Car App, onde `auth.users` e `public.profiles` estavam vazios. Enums, tabela, functions, triggers, policies, RLS e grants foram validados; o teste `supabase/tests/001_auth_profiles.test.sql` passou após a habilitação exclusiva de pgTAP, com rollback das fixtures. Todo usuário novo nasce `seller`/`pending`; nenhuma promoção a `admin` é automática. MFA, `audit_log`, convites, recuperação de senha e gestão de usuários continuam futuros.

O trabalho histórico do Appsmith possui export auditado e implementação parcial: `Admin Modelos` lista produtos, altera atividade e duplica; `Análise de Valor` contém consultas de análise. Essa implementação não é mais o backoffice oficial e não receberá novas mudanças. Criação, edição geral, `product_specs`, preços e demais fluxos administrativos ainda não estão implementados no Next.js. As regras permanecem descritas como domínio em `docs/admin`.

O export histórico do Appsmith permanece versionado em `appsmith/exports/Compra Car App MVP.json` e foi auditado sem alteração do original. Ele contém três páginas, 27 widgets, 11 actions PostgreSQL, um datasource e nenhum JS Object. Esses artefatos são evidência histórica, não plano executável. Integrações existentes não serão removidas até que seus consumidores e riscos sejam auditados.

## Próximos passos

1. Executar o teste de integração opt-in no ambiente autorizado.
2. Validar cobertura e desempenho com 2 ou 3 veículos reais.
3. Comparar este clone com o `C:\Dev\compra-car` do outro notebook.
4. Implementar a Sprint 5: cadastro de veículos (Create).
5. Implementar a Sprint 6: edição de veículos.
6. Implementar a Sprint 7: duplicação de veículos.
7. Implementar a Sprint 8: cadastro de equipamentos em `product_specs`.
8. Implementar a Sprint 9: preços.
9. Concluir MVP e piloto; depois evoluir dados, importador e arquitetura gradualmente.

## Registro histórico — Sprint 1 de Gestão de Produtos no Appsmith (planejamento em 2026-07-22)

O inventário e o plano histórico da Sprint 1 estão em `docs/admin/SPRINT_1_PRODUCT_MANAGEMENT.md`. O export JSON nativo `appsmith/exports/Compra Car App MVP.json`, recebido em 2026-07-22, contém três páginas, 27 widgets, 11 actions PostgreSQL, um datasource e nenhum JS Object. A auditoria não encontrou credencial preenchida; o hostname Supabase foi tratado como metadado de infraestrutura. `Admin Modelos` lista produtos, altera `is_active` e duplica por `duplicate_product_simple`, mas não implementa criação, edição geral nem `product_specs`. As páginas funcionais aparecem apenas como rascunho no pacote.

Esse plano foi superado pelo ADR-010 e não deve ser executado no Appsmith. Seu conteúdo permanece preservado para apoiar o futuro mapeamento de requisitos, riscos e regras para a área `admin` do Next.js.

O escopo da Sprint 1 fica limitado a `products` e `product_specs`, usando `specs` somente como master de metadados e regras de Market Value. Não haverá manutenção de `specs`, `unit_perceived_value` ou `relative_value`, nem Preços, Comparador ou Exportação Excel. O export confirma o nome `duplicate_product_simple`, mas não a sobrecarga porque a action não usa casts; permanece recomendada a chamada explícita `duplicate_product_simple(integer, smallint, smallint, boolean)`, que copia produto e specs sem copiar preços/políticas.

## Backlog pós-MVP

- cardinalidade explícita `single`/`multiple`;
- agrupamento visual opcional de itens `scale`;
- validação de combinações incompatíveis;
- evolução da taxonomia de categorias;
- substituição futura do importador Excel;
- revisão dos prefixes legados;
- evolução e versionamento das regras de vantagem;
- estados detalhados de equipamentos, qualidade e rastreabilidade.

## Pendências

- **PENDENTE:** validação online opt-in e cobertura quantitativa do Supabase atual.
- **PENDENTE:** texto jurídico final.
- **PENDENTE:** marca e participantes do piloto.
- **PENDENTE:** identidade visual autorizada.
- **PENDENTE:** objetos reais de preço, políticas comerciais, moeda, vigência e referência temporal.
- **PENDENTE:** coluna e semântica do valor monetário master de specs.
- **CONFIRMADO:** export e estrutura históricos do Appsmith, inventariados em `docs/admin/SPRINT_1_PRODUCT_MANAGEMENT.md`.
- **PENDENTE:** mapear consumidores e dependências das integrações históricas antes de eventual remoção.
- **PENDENTE:** constraint física da chave de negócio de veículos no Supabase atual.
- **PENDENTE:** confirmar como `product_specs.is_present = false` afeta presença, validade e comparabilidade.
- **PENDENTE:** para `getVehiclesByIds`, a rodada Auth mantém elegibilidade restrita a `is_active = true` e `is_public = true`; decidir em `/admin/products` e no catálogo se a consulta por IDs também exigirá specs ativas.
- **CONCLUÍDO:** migration de profiles aplicada e validada no projeto remoto auditado, incluindo pgTAP e rollback das fixtures de teste.
- **PENDENTE:** auditar grants/RLS do catálogo legado e formalizar o runbook operacional de usuários administrativos.
