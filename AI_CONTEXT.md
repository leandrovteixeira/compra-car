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
- Supabase atual como fonte inicial de dados via adaptador server-only; as escritas administrativas
  aprovadas ficam restritas a essa fronteira;
- Supabase Auth integrado por `@supabase/ssr`, com cookies e clients Auth separados do adapter legado;
- domínio administrativo documentado em `docs/admin`;
- uma única aplicação Next.js como arquitetura-alvo para as áreas `seller` e `admin`;
- Appsmith preservado somente como referência histórica, sem novas implementações.

## Estrutura arquitetural

```text
apps/web                     aplicação Next.js com seleção e comparação implementadas
packages/contracts           DTOs e contratos públicos
packages/core                domínio, portas e casos de uso puros
packages/adapter-supabase    adaptador server-only; leitura pública e escrita administrativa aprovada
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
- ADR-009: preços públicos e políticas comerciais são conceitos separados; o legado misto permanece
  temporariamente.
- ADR-011: detalha o modelo alvo com preço por produto/data, política com valor congelado por
  aplicação/produto, acumuladores explícitos, parâmetros financeiros versionados, imports
  revisáveis, auditoria, RLS e migração incremental forward-only. Cada aplicação separa
  `input_monetary_value` opcional do `monetary_value` final obrigatório e congelado.
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

## Estado atual — 2026-07-25

A infraestrutura do monorepo, o núcleo de domínio, o adaptador legado e os vertical slices de seleção e comparação estão implementados. `packages/core` contém entidades, value objects, erros, portas e casos de uso, inclusive Create/Update administrativos. `packages/contracts` contém aliases, reexportações e DTOs públicos sem duplicação estrutural. `packages/adapter-supabase` implementa as portas de leitura sobre `products`, `specs`, `product_specs` e `unit_conversions` e restringe as escritas administrativas aprovadas a `products` e `product_specs`. `apps/web` conecta seleção, comparação e administração aos casos de uso por camada server-only e composition root.

A fundação Auth está implementada. `@supabase/ssr` mantém a sessão em cookies; o Middleware renova a sessão e redireciona usuários não autenticados; páginas e Server Actions repetem a validação no servidor. `/login` usa e-mail/senha e redirect interno seguro, e o logout é server-side. `public.profiles` é a fonte de role/status; `admin` também acessa a área `seller`; profile ausente, não ativo ou inválido falha fechado.

A baseline legada de 2026-07-24 não capturou o trigger cruzado instalado em `auth.users`, embora
tenha preservado os objetos públicos de profiles. A migration incremental
`20260724235959_restore_auth_profiles_after_baseline.sql` deve executar depois da baseline: ela
restaura o trigger de criação segura do profile e reconcilia funções, triggers públicos,
constraints, foreign keys, RLS, policies e privilégios sem alterar dados válidos. Alterações futuras
na baseline gerada continuam proibidas; correções devem permanecer forward-only.

O MVP-a possui shell administrativo persistente em `/admin/*`, sidebar desktop, menu mobile,
navegação, visão geral e `/admin/products`. A listagem de veículos é server-rendered e usa
`LegacySupabaseAdapter.listAdministrativeVehicles()` após `requireRole('admin')`.
`/admin/products/new` implementa a criação exclusiva do registro principal em `products`, com
normalização e validação puras no core, selects dependentes de anos, checagem normalizada de
duplicidade, payload explícito no adapter, Server Action autorizada e diálogo de sucesso.
`/admin/products/[id]/edit` carrega o produto server-side, reutiliza o formulário e as regras do
Create, exclui o próprio ID da checagem de duplicidade e persiste apenas os sete campos editáveis.
Como a inspeção do banco não encontrou trigger de aplicação, a atualização define `updated_at`
explicitamente no adapter.
`/admin/products/[id]/duplicate` carrega o produto server-side e inicia um novo Create com os sete
campos preenchidos, sem expor o ID original como campo editável. `DuplicateAdministrativeVehicle`
reutiliza o Create e copia todas as associações `product_specs` para o novo ID, preservando numeric,
binary `true`/`false`, scale e `input_unit`. Preços, imagens, documentos e histórico não são
copiados. Falha da ficha impede sucesso e aciona compensação restrita ao novo produto; sem
RPC/migration, criação, cópia e compensação não formam uma transação única.
`/admin/products/[id]/specs` carrega todos os specs ativos e associações do produto, monta no core
uma ficha por hierarquia real e salva numeric, binary e scale em lotes. Torque aceita Nm/kgfm, usa
`unit_conversions` e persiste somente Nm; `PW_0036` permanece `kg/Nm`. Binary administrativo usa
`boolean | null`: associação ausente permanece não informada e não conta, enquanto `true` e `false`
explícitos contam e são preservados. Não houve migration. A atomicidade estrita entre upsert e
delete e a exibição kgfm no MVP-u permanecem evoluções futuras.
`/admin/products` transporta filtros por search params e os aplica server-side no adapter, com
sticky acumulado no desktop e oferece ações Editar e Duplicar por linha. Não existem exclusão,
cadastro de equipamentos ou preços.

A Sprint 9 começou com investigação somente leitura. O inventário em
`docs/data/PRICE_AND_COMMERCIAL_POLICY_INVENTORY.md` confirma que o comparador MVP-u Next.js ainda
não lê preço: seu fluxo termina em `products`, `product_specs` e `specs`. A página histórica
`Análise de Valor` do Appsmith é o único consumidor localizado de
`vw_product_value_current.public_price`; não há CRUD de preço/política no MVP-a.

Na fotografia remota somente leitura de 2026-07-25 existem 292 produtos e 746 linhas em
`product_price_offers`, com 287 produtos cobertos, duas duplicidades produto/mês, um preço zero,
nenhum preço nulo/negativo e meses de junho de 2025 a abril de 2026. Os 746 registros compartilham
o mesmo `created_at`, embora a view “current” ordene por esse timestamp. O modelo mistura MSRP e
política, não possui vigência completa, RLS/policies ou índices temporais, e mantém grants amplos.
A arquitetura da Sprint 9 foi aceita no ADR-011 e detalhada em
`docs/data/PRICE_AND_POLICY_TARGET_SCHEMA.md`, `docs/data/PRICE_AND_POLICY_MIGRATION_PLAN.md` e
`docs/data/PRICE_AND_POLICY_CALCULATION_RULES.md`. O alvo preserva o legado e separa
`product_public_prices`, políticas, aplicações com valor BRL congelado por produto, acumuladores,
parâmetros CDI/spread versionados, importação/revisão e auditoria. Preço não armazena fim: o próximo
`starts_on` encerra o período anterior. Política isolada é sempre válida; apenas acumulador publicado
autoriza soma. IA/API entram em draft/needs_review e nunca publicam.

A revisão final pré-migration diferencia input monetário e resultado econômico. Bônus de varejo,
trade-in, wallbox e `other` persistem input por aplicação e congelam o mesmo valor como resultado;
seguro, IPVA, emplacamento e financiamento mantêm input monetário nulo e calculam o resultado. Os
oito tipos iniciais permanecem enum; tipos administráveis não pertencem ao MVP e benefícios novos
usam `other + manual_amount`. Zero só pode permanecer em draft/needs_review; ausência de preço
publicado é ausência de registro. CDI/spread sem fonte/governança final não bloqueiam tabelas ou
drafts, mas impedem publicar `subsidized_financing` sem parameter set manual versionado e published.

A primeira etapa estrutural foi versionada em
`supabase/migrations/20260725172755_create_pricing_types_and_core_tables.sql`: cinco enums e sete
tabelas centrais, com constraints locais e índices, sem dados, backfill, views, RLS, policies,
grants específicos, funções ou triggers. `source_import_row_id` permanece sem FK até a migration de
importação.

`supabase/migrations/20260725175159_secure_pricing_core_schema.sql` protege exclusivamente esse
core: RLS está habilitado nas sete tabelas, `public`/`anon`/`authenticated` não possuem ACLs nas
tabelas ou nas seis sequences identity e nenhuma policy foi criada. `service_role` possui somente
SELECT/INSERT/UPDATE nas tabelas e USAGE/SELECT nas sequences, sem DELETE, TRUNCATE, REFERENCES,
TRIGGER, MAINTAIN ou UPDATE de sequence. As duas migrations foram aplicadas por
`db reset --local --no-seed`
e a suíte SQL completa passou localmente com 129 testes; nenhum banco remoto foi acessado ou
alterado. Importação/auditoria, validações transacionais, cálculos, views e backfill continuam
pendentes e separados.

Os default privileges globais da baseline permanecem inalterados e ainda concederão ACLs amplas a
objetos futuros criados por `postgres`. Cada migration futura no schema `public` deve revogar
explicitamente os privilégios herdados de seus próprios objetos, sem depender desta proteção do
core e sem alterar defaults de outros domínios.

`supabase/migrations/20260725180750_create_pricing_import_and_audit_tables.sql` adiciona os quatro
enums e as cinco tabelas de batches, rows, outputs, revisão humana e auditoria, além das três FKs
RESTRICT adiadas de `source_import_row_id` para `pricing_import_rows`. A mesma migration habilita
RLS, remove ACLs de browser e concede ao `service_role` SELECT/INSERT/UPDATE nas quatro tabelas
operacionais e somente SELECT/INSERT na auditoria append-only; sequences recebem USAGE/SELECT.
Nenhuma policy, função, trigger, view, backfill ou dado foi criado. `pricing_audit_action.update`
representa correção auditável e exige `reason`, assim como reject/archive. O reset local e os 176
testes SQL passaram; nenhum ambiente remoto foi acessado.

`supabase/migrations/20260725182545_create_pricing_lifecycle_and_audit_triggers.sql` adiciona quatro
funções `SECURITY INVOKER` e 23 triggers para lifecycle e proteção de estados terminais. Sete
tabelas passam a manter `updated_at` e incrementar `lock_version` exatamente uma vez por update;
auditoria é append-only inclusive contra DML do owner; registros published/archived/promoted não
podem regredir para estado mutável nem ser apagados e seus campos econômicos, materiais ou de origem
ficam congelados. Aplicações e
filhos de acumulador respeitam o estado do pai. As funções usam `search_path = ''` e tiveram
`EXECUTE` direto revogado de `public`, `anon`, `authenticated` e `service_role`, sem impedir a
execução indireta pelos triggers. Não foi criado writer genérico de auditoria, publicação,
cálculo, view, policy, backfill ou bypass de sessão. Reset limpo e 219 testes SQL passaram somente
na stack local; nenhum ambiente remoto foi acessado.

`supabase/migrations/20260725184656_create_pricing_validation_and_publication_functions.sql` cria
quatro funções transacionais `SECURITY DEFINER` para publicar preço público, parameter set, política
e acumulador. Somente `service_role` recebe `EXECUTE`; cada chamada trava a linha, valida
`lock_version`, correlation ID e `p_actor_id` consultando `profiles` com `role = admin` e
`status = active`, executa todas as mutações antes do status terminal e grava auditoria na mesma
transação. Seis helpers `SECURITY INVOKER` permanecem sem execução operacional direta. Um trigger
impede publicação direta pelo `service_role` sem variável de sessão, e outro protege rows de batches
promovidos/arquivados, outputs de rows promovidas e reviews append-only.

Políticas publicadas usam `scope_snapshot` v1 com `productIds` numéricos, distintos e exatamente
iguais às aplicações. Os oito tipos são validados por método, input, MSRP publicado, parameter set e
snapshot. Cálculos usam `numeric`, HALF_UP em centavos e tolerância máxima de `1e-10` apenas para
intermediários não arredondados; financiamento preserva principal, PMT, taxa de referência, PV e
versão dos parâmetros. Acumuladores calculam `policy_ids:<ids ordenados>`, materializam apenas a
interseção de produtos e somam valores já congelados. Reset limpo e 293 testes SQL passaram somente
na stack local; não foram criadas views, backfill, seed financeiro real, promoção automática ou
acesso de browser, e nenhum ambiente remoto foi acessado.

`supabase/migrations/20260725191747_create_pricing_read_views.sql` cria cinco views server-only com
`security_invoker = true`: períodos publicados, preço vigente, aplicações de políticas vigentes,
valores materializados de acumuladores e `vw_product_value_current_v2`. ACLs herdadas foram
revogadas de `public`, `anon`, `authenticated` e `service_role`; somente SELECT foi concedido ao
`service_role`. A v2 preserva nomes, ordem e tipos das oito colunas legadas, usa o novo preço atual e
mantém o cálculo legado de `perceived_value_total` sobre specs, pois não há equivalente seguro no
novo modelo. `vw_product_value_current` permaneceu inalterada. Reset limpo e 326 testes SQL passaram
somente localmente; não houve backfill, troca de consumidor ou acesso remoto.

O pacote `@compra-car/pricing-dry-run` implementa a inspeção pré-backfill sem migration e sem escrita
no banco. Aceita URL PostgreSQL local explícita, output, versão do algoritmo, cutoff e modo estrito de
mudança de fotografia; rejeita hosts/portas fora da stack local e confirma transação `REPEATABLE READ
READ ONLY`. Classifica preços, componentes e sugestões de combinação com `decimal.js`, hashes
canônicos e 16 issue codes, sem desempate por `created_at`, sem converter rebates ou publicar
acumuladores. Gera dez artefatos JSON/CSV/README. A fixture produziu 5 candidatos de preço, 1
conflito, 9 candidatos de política, 1 sugestão de acumulador e 11 itens de revisão. O banco local
recriado sem seed permaneceu com todas as fontes em zero e status `SOURCE_CHANGED`; isso valida a
ferramenta, não substitui o dry-run futuro sobre uma fotografia local autorizada do legado real.

A URL de comparação é `/comparar?vehicles=id1,id2[,id3,...]`. A página valida IDs, preserva sua ordem, executa `CompareVehicles`, apresenta categorias e usa `hasReferenceAdvantage` no filtro “Ver destaques”. A UI usa uma única superfície tabular com cabeçalho e primeira coluna fixos, rolagem bidirecional, células com slot estável para checks e estados dedicados de loading, vazio e erro. O domínio e o adapter não conhecem componentes ou parâmetros de URL.

Os testes do core usam repositórios in-memory. Os mappers do adaptador são testados sem rede e a integração real é opt-in por variáveis exclusivas. A UI de negócio e `Legacy` permanecem sem alteração nesta fase.

`supabase/tests/spec_integrity.sql` protege o domínio de Specs com pgTAP, sem DML ou DDL explícito
sobre tabelas permanentes. `SET TRANSACTION READ ONLY` não é usado porque `plan()` pode criar
objetos temporários internos; a execução depende da transação automática revertida por
`supabase test db` e mantém `ROLLBACK` explícito. A suíte lista violações de scale, binary, codes,
referências de `product_specs`, duplicidades, tipos, numeric, identidade estrutural do catálogo e
coerência de tipo por `spec_set`, além de emitir um resumo agregado sem modificar dados permanentes.

A superfície mínima e o mapeamento físico fornecidos para a fase estão registrados em `SUPABASE_INSPECTION_RESULTS.md` e `LEGACY_SUPABASE_MAP.md`. A validação online permanece pendente quando não houver credenciais opt-in e não bloqueia o código ou o MVP.

A arquitetura de autenticação e autorização está em `docs/architecture/AUTHENTICATION_ARCHITECTURE.md`. A migration `20260721222256_create_auth_profiles.sql` foi aplicada uma única vez no projeto remoto Compra Car App, onde `auth.users` e `public.profiles` estavam vazios. Enums, tabela, functions, triggers, policies, RLS e grants foram validados; o teste `supabase/tests/001_auth_profiles.test.sql` passou após a habilitação exclusiva de pgTAP, com rollback das fixtures. Todo usuário novo nasce `seller`/`pending`; nenhuma promoção a `admin` é automática. MFA, `audit_log`, convites, recuperação de senha e gestão de usuários continuam futuros.

O trabalho histórico do Appsmith possui export auditado e implementação parcial: `Admin Modelos` lista produtos, altera atividade e duplica; `Análise de Valor` contém consultas de análise. Essa implementação não é mais o backoffice oficial e não receberá novas mudanças. Criação e edição geral estão implementadas no Next.js; `product_specs`, preços e demais fluxos administrativos continuam pendentes. As regras permanecem descritas como domínio em `docs/admin`.

O export histórico do Appsmith permanece versionado em `appsmith/exports/Compra Car App MVP.json` e foi auditado sem alteração do original. Ele contém três páginas, 27 widgets, 11 actions PostgreSQL, um datasource e nenhum JS Object. Esses artefatos são evidência histórica, não plano executável. Integrações existentes não serão removidas até que seus consumidores e riscos sejam auditados.

## Próximos passos

1. Executar o teste de integração opt-in no ambiente autorizado.
2. Validar cobertura e desempenho com 2 ou 3 veículos reais.
3. Comparar este clone com o `C:\Dev\compra-car` do outro notebook.
4. Avaliar com o negócio as três divergências estruturais de specs encontradas na Sprint 5.
5. Continuar a Sprint 9 pelas migrations/subtarefas restantes do ADR-011, preservando as decisões
   financeiras pendentes como bloqueio de publicação, não da estrutura.
6. Concluir MVP e piloto; depois evoluir dados, importador e arquitetura gradualmente.

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
- **CONFIRMADO COM RESSALVAS:** o legado usa `product_price_offers.public_price` e `offer_month`,
  misturando MSRP e política; moeda, vigência completa e regra de preço atual permanecem pendentes.
- **CONFIRMADO:** ADR-011 define BRL, preço por `product_id + starts_on`, fim derivado, políticas
  isoladas, aplicações monetárias por produto, acumuladores explícitos e revisão humana obrigatória.
- **PENDENTE:** fonte/convenção do CDI mensal, spread inicial, regra regional de emplacamento,
  correção de preço publicado e escopo futuro por canal/região/concessionária.
- **CONFIRMADO:** pendências de CDI/spread não bloqueiam migrations estruturais; bloqueiam somente a
  publicação real de financiamento subsidiado até existir parameter set revisado e published.
- **PENDENTE:** coluna e semântica do valor monetário master de specs.
- **CONFIRMADO:** export e estrutura históricos do Appsmith, inventariados em `docs/admin/SPRINT_1_PRODUCT_MANAGEMENT.md`.
- **PENDENTE:** mapear consumidores e dependências das integrações históricas antes de eventual remoção.
- **CONFIRMADO:** índice único exato `unique_product` na chave de negócio de veículos; proteção
  normalizada contra concorrência com variações de caixa/espaços permanece pendente.
- **CONFIRMADO COM RESSALVAS:** auditoria remota somente leitura inspecionou 59 `numeric`, 171
  `binary` e 26 grupos `scale`; encontrou divergências `detail != spec_set` em `CO_0044`, `CO_0045`
  e `PW_0042`, sem duplicidade de `detail` nos grupos `scale` nem identidade ausente.
- **PENDENTE:** confirmar como `product_specs.is_present = false` afeta presença, validade e comparabilidade.
- **PENDENTE:** para `getVehiclesByIds`, a rodada Auth mantém elegibilidade restrita a `is_active = true` e `is_public = true`; decidir em `/admin/products` e no catálogo se a consulta por IDs também exigirá specs ativas.
- **CONCLUÍDO:** migration de profiles aplicada e validada no projeto remoto auditado, incluindo pgTAP e rollback das fixtures de teste.
- **PENDENTE:** auditar grants/RLS do catálogo legado e formalizar o runbook operacional de usuários administrativos.
