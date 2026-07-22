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
- domínio administrativo documentado em `docs/admin`;
- Appsmith como tecnologia do backoffice administrativo da Fase 1.

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
- ADR-008: Supabase Auth, cookies SSR, convite fechado, roles `admin`/`vendedor` e status `pending`/`active`/`disabled`; a fundação SQL de profiles está versionada, mas ainda não foi aplicada.
- ADR-007: Appsmith é adotado no backoffice da Fase 1, sem mudança de schema; GitHub, `C:\Dev` e OneDrive possuem papéis distintos.
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
- não tratar a arquitetura de autenticação aprovada como funcionalidade já implementada;
- não usar `user_metadata` como fonte de privilégios nem permitir promoção automática para `admin`;
- não fazer o Middleware consultar o banco ou assumir que RLS é a única barreira administrativa;
- não implementar PDF ou offline nesta fase concluída.

## Estado atual — 2026-07-21

A infraestrutura do monorepo, o núcleo de domínio, o adaptador legado e os vertical slices de seleção e comparação estão implementados. `packages/core` contém entidades, value objects, erros, portas e os cinco casos de uso centrais. `packages/contracts` contém aliases, reexportações e DTOs públicos sem duplicação estrutural. `packages/adapter-supabase` implementa as duas portas sobre `products`, `specs` e `product_specs`, sem escrita. `apps/web` conecta seleção e comparação aos casos de uso por camada server-only, `unstable_cache` e composition root.

A URL de comparação é `/comparar?vehicles=id1,id2[,id3,...]`. A página valida IDs, preserva sua ordem, executa `CompareVehicles`, apresenta categorias e usa `hasReferenceAdvantage` no filtro “Ver destaques”. A UI usa uma única superfície tabular com cabeçalho e primeira coluna fixos, rolagem bidirecional, células com slot estável para checks e estados dedicados de loading, vazio e erro. O domínio e o adapter não conhecem componentes ou parâmetros de URL.

Os testes do core usam repositórios in-memory. Os mappers do adaptador são testados sem rede e a integração real é opt-in por variáveis exclusivas. A UI de negócio e `Legacy` permanecem sem alteração nesta fase.

A superfície mínima e o mapeamento físico fornecidos para a fase estão registrados em `SUPABASE_INSPECTION_RESULTS.md` e `LEGACY_SUPABASE_MAP.md`. A validação online permanece pendente quando não houver credenciais opt-in e não bloqueia o código ou o MVP.

A arquitetura de autenticação e autorização está em `docs/architecture/AUTHENTICATION_ARCHITECTURE.md`. Ela define Supabase Auth, sessão SSR em cookies, convite fechado, roles `admin`/`vendedor` e ciclo de profile `pending` → `active` → `disabled`, com reativação para `active`. A Sprint 2.1 versionou enums, `public.profiles`, triggers, grants, RLS, policies e testes SQL; nenhum banco recebeu a migration nesta entrega. Todo usuário novo nasce `vendedor`/`pending`; nenhuma promoção a admin é automática, e o primeiro admin exige operação manual, explícita e documentada. `profiles` é a fonte de autorização; Middleware não consulta o banco; servidor e RLS negam acesso funcional a status não ativo. MFA obrigatório para admin e a tabela `audit_log` continuam evoluções futuras. Clientes, rotas e fluxos da aplicação ainda não foram implementados.

O backoffice administrativo possui um export Appsmith auditado e uma implementação parcial: `Admin Modelos` lista produtos, altera atividade e duplica; `Análise de Valor` contém consultas de análise. Criação, edição geral, `product_specs`, preços e demais fluxos da Fase 1 ainda não estão implementados. Não haverá alteração de schema, e as regras permanecem descritas como domínio em `docs/admin`.

O export atual do Appsmith está versionável em `appsmith/exports/Compra Car App MVP.json` e foi auditado sem alteração do original. Ele contém três páginas, 27 widgets, 11 actions PostgreSQL, um datasource e nenhum JS Object. Permissões, role efetiva, comportamento transacional, preços, políticas, monetização de specs e vigência ainda dependem de validação no Supabase e na instância Appsmith.

## Próximos passos

1. Executar o teste de integração opt-in no ambiente autorizado.
2. Validar cobertura e desempenho com 2 ou 3 veículos reais.
3. Comparar este clone com o `C:\Dev\compra-car` do outro notebook.
4. Validar permissões, role efetiva, prepared statements e comportamento transacional do datasource Appsmith, sem alterar o schema.
5. Validar no Supabase os objetos necessários ao backoffice, sem alterar o schema.
6. Conectar o Next.js ao adaptador apenas no runtime do servidor.
7. Implementar a UI de negócio sobre os casos de uso.
8. Concluir MVP e piloto.
9. Após o piloto, evoluir dados, importador e arquitetura gradualmente.

## MVP-a — Sprint 1 de Gestão de Produtos (planejamento em 2026-07-22)

O inventário e o plano executável da Sprint 1 estão em `docs/admin/SPRINT_1_PRODUCT_MANAGEMENT.md`. O export JSON nativo `appsmith/exports/Compra Car App MVP.json`, recebido em 2026-07-22, contém três páginas, 27 widgets, 11 actions PostgreSQL, um datasource e nenhum JS Object. A auditoria não encontrou credencial preenchida; o hostname Supabase foi tratado como metadado de infraestrutura. `Admin Modelos` lista produtos, altera `is_active` e duplica por `duplicate_product_simple`, mas não implementa criação, edição geral nem `product_specs`. As páginas funcionais aparecem apenas como rascunho no pacote.

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
- **CONFIRMADO:** export e estrutura do Appsmith atual, inventariados em `docs/admin/SPRINT_1_PRODUCT_MANAGEMENT.md`.
- **PENDENTE:** permissões, role efetiva, prepared statements e comportamento transacional do datasource Appsmith.
- **PENDENTE:** constraint física da chave de negócio de veículos no Supabase atual.
- **PENDENTE:** confirmar como `product_specs.is_present = false` afeta presença, validade e comparabilidade.
- **PENDENTE:** validar e aplicar a migration de profiles em ambiente autorizado, auditar grants/RLS do catálogo legado e implementar clientes/fluxos de autenticação, incluindo validação explícita anterior a qualquer operação com Service Role.
