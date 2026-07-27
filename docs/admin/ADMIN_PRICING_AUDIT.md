# Auditoria do Admin e plano de evolução para Pricing

**Data da auditoria:** 2026-07-27  
**Escopo:** leitura estática do monorepo; nenhuma migration, escrita no banco, publicação ou alteração
funcional foi executada.

## 1. Resumo executivo

A área administrativa existente deve ser evoluída, não substituída. Ela é um vertical slice Next.js
App Router funcional para `Product` e ficha técnica, protegido no servidor e desacoplado do Supabase
na UI. A fundação visual, autenticação, autorização, formulários e padrões de server actions são
reutilizáveis.

O domínio Pricing ainda não chegou à aplicação. Não existem telas, casos de uso, repositories,
adapters ou DTOs de `ProductPublicPrice`, `CommercialOffer` e `CommercialPolicy`; em `contracts`
existem somente enums e tipos auxiliares. O schema versionado já contém as entidades, funções de
publicação e auditoria, mas o Admin atual não as consome.

Conclusão: preservar `/admin` e o slice de Products; adicionar Pricing em slices verticais pequenos,
começando por contratos e leitura, depois draft/edit, e deixando publicação por último. O modelo
vigente é:

```text
Product
├── ProductPublicPrice
└── CommercialOffer ──references──> ProductPublicPrice publicado
    └── CommercialPolicy
```

`commercial_policy_applications` é compatibilidade histórica e não pode orientar contratos, telas
ou fluxos novos.

## 2. Inventário completo

### 2.1 Rotas e telas

| Rota | Tipo | Responsabilidade | Dados/operações |
| --- | --- | --- | --- |
| `/admin` | Server Component | visão geral e cards de módulos | sem query própria |
| `/admin/products` | Server Component | listagem e filtros | `products`: select e filtros |
| `/admin/products/new` | Server + Client Form | criação de Product | `products`: duplicate check e insert |
| `/admin/products/[id]/edit` | Server + Client Form | edição de Product | `products`: select, duplicate check e update |
| `/admin/products/[id]/duplicate` | Server + Client Form | cópia de Product e specs | `products`, `product_specs`: select/insert/upsert; compensação em erro |
| `/admin/products/[id]/specs` | Server + Client Editor | ficha técnica | `products`, `specs`, `product_specs`, `unit_conversions` |

Não existem rotas administrativas de Prices, Offers ou Policies.

### 2.2 Layout, navegação e componentes

- `app/admin/layout.tsx`: fronteira persistente de autorização e montagem do `AdminShell`.
- `AdminShell`, `AdminNav`, `AdminAccount`: layout responsivo, navegação e sessão.
- `PageHeader`, `ModuleCard`, `EmptyState`: primitives administrativas genéricas.
- `AdminProductList`, `AdminProductFilters`, `AdminProductError`: listagem de Products.
- `AdminProductForm`: formulário compartilhado por create/edit/duplicate.
- `AdminProductSpecsEditor`: editor client-side com busca, dirty state, descarte e batch save.
- `admin-navigation.ts`: fonte única dos itens; apenas visão geral e veículos estão ativos.

Não há Provider ou Context específico do Admin. Os hooks React ficam encapsulados nos dois Client
Components de formulário/editor (`useActionState`, `useEffect`, `useMemo`, `useRef`, `useState` e
`useTransition`).

### 2.3 Camadas de aplicação e servidor

```text
Route/Page
  -> component administrativo
  -> server action / server service
  -> requireRole('admin')
  -> application orchestration / core use case
  -> repository port
  -> LegacySupabaseAdapter (server-only)
  -> Supabase
```

Application Admin:

- parsing/normalização do formulário e filtros;
- criação, atualização e duplicação;
- estado e serialização do editor de specs;
- opções e coerência de anos.

Core Admin:

- `AdministrativeVehicle` e validação `Public => Active`;
- create/update/duplicate use cases;
- modelo, agrupamento, conversão e persistência de specs;
- portas `AdministrativeVehicleRepository`, `AdministrativeProductDuplicationRepository` e
  `AdministrativeProductSpecsRepository`.

Server:

- carregamento seguro da lista e do Product individual;
- composição dos casos de uso;
- revalidação de rotas;
- tradução de falhas para mensagens sem detalhes do banco.

### 2.4 Autenticação e autorização

- Middleware renova/verifica sessão e redireciona rotas protegidas para `/login`.
- `route-policy.ts` protege todo o Admin, mas o Middleware verifica autenticação, não role.
- `admin/layout.tsx` exige profile ativo com role `admin` para toda a subárvore.
- páginas e operações sensíveis repetem `requireRole('admin')` (defesa em profundidade).
- a role vem de `profiles`, nunca de `user_metadata`.
- o adaptador de dados usa `SUPABASE_SERVER_KEY`, é server-only e ignora RLS; logo a autorização da
  aplicação antes de instanciar o client privilegiado é uma barreira obrigatória.

Limitação: os métodos de leitura de Product instanciam o adaptador por parâmetro default após a
autorização da página, enquanto as escritas garantem explicitamente autorização antes da factory.
O padrão de escrita é o modelo seguro para Pricing.

### 2.5 Contracts e DTOs

Alinhados e reutilizáveis:

- DTOs de formulário/action de `AdministrativeVehicle`;
- `AuthProfile`, roles e statuses;
- exports do core para Products e Specs;
- enums de tipos/métodos de Pricing em `contracts/src/pricing.ts`.

Ausentes:

- entidades e IDs de ProductPublicPrice, CommercialOffer e CommercialPolicy;
- DTOs de list/detail/form/action;
- filtros, paginação e versionamento otimista;
- estados de workflow e comandos explícitos de publicação/arquivamento;
- repositories e erros de domínio de Pricing;
- contratos para audit trail e blocking issues.

### 2.6 Testes existentes

Há cobertura dedicada para fundação do Admin, service de Products, criação, edição, duplicação,
refinamentos/filtros e Specs; no core, validação de Product, duplicação e Specs; além de autenticação,
controle de acesso, política de rota, cookies e client server-side. Os testes de adapter cobrem o
adapter legado genericamente, mas não existe suíte de aplicação para Pricing.

Os testes SQL versionados cobrem estrutura, segurança, lifecycle, publicação, views e regras de
migração de Pricing. Eles não equivalem a testes dos futuros contratos/casos de uso do Admin.

## 3. Mapa de dependências por tela

| Tela | Tabelas/queries | Contratos e validações | Reuso | Legado residual |
| --- | --- | --- | --- | --- |
| Overview | nenhuma | autorização do layout | Shell, Header, ModuleCard | cards ainda refletem roadmap anterior |
| Products list | `products.select`; `ilike` brand/model/version; `eq` active/public | `AdministrativeVehicleFilters`, `Vehicle`; parser trim/boolean | Shell, filters, list, empty/error | nomes físicos isolados no adapter; retorno sem paginação/ordenação |
| New | `products.select` por anos + comparação normalizada; `insert` | campos obrigatórios, anos inteiros, `Public => Active`, chave MMV/MY/PY | ProductForm, action state | adapter e DTO chamados `Legacy*` |
| Edit | `products.select` por id; duplicate check; `update` | mesmas regras de New; 404; conflito 23505 | mesmo ProductForm | `updated_at` definido no adapter |
| Duplicate | reads de Product/specs; insert/upsert; deletes compensatórios | valida origem/destino e preserva regras de Product | mesmo ProductForm e ports de specs | compensação manual não é transação atômica |
| Specs | `products`, `specs(active)`, `product_specs`, `unit_conversions`; upsert/delete | semântica binary/numeric/scale, unidades, agrupamento, dirty state | Editor e modelos do core | `product_specs.equipment_id`; taxonomia física legada isolada |
| Prices | inexistente | apenas enums/schema | Shell/Header/Form patterns | consumidores históricos usam modelo/view legado fora do Admin atual |
| Offers | inexistente | schema apenas | Shell/Header/List/Form patterns | migration mantém colunas de origem legada |
| Policies | inexistente | enums/schema apenas | editor dinâmico pode reutilizar padrões de Specs, não seu domínio | `commercial_policy_applications` ainda aparece em migrations, testes, views e texto antigo |

## 4. Arquitetura atual

```text
Next.js /admin
├── layout: requireRole(admin) + AdminShell
├── overview
└── products
    ├── list/filter
    ├── shared form ──> server actions ──> application orchestration
    │                                  └──> core Product use cases
    └── specs editor ──> server service ──> core Specs use cases
                                             │
                                             v
                                  repository interfaces (core)
                                             │
                                             v
                                  LegacySupabaseAdapter
                                    ├── products
                                    ├── specs
                                    ├── product_specs
                                    └── unit_conversions

Auth cookies -> Middleware (authentication) -> layout/action (profile + role)
```

## 5. Arquitetura desejada

```text
AdminShell existente
├── Products existente
│   ├── ficha e specs
│   ├── histórico de ProductPublicPrice
│   └── CommercialOffers do produto
└── Pricing (novos slices, mesma aplicação)
    ├── ProductPublicPrice
    │   └── list/detail/draft/edit/publish
    └── CommercialOffer
        ├── referencia Product + ProductPublicPrice publicado
        ├── list/detail/draft/edit/publish/archive
        └── CommercialPolicy[] (filhas diretas)

Page -> reusable Admin UI -> server action
  -> requireRole(admin) before privileged client
  -> Pricing use case (core)
  -> Pricing repository contract
  -> dedicated Supabase Pricing adapter
  -> approved validation/publication RPCs + read models
  -> pricing_audit_events

commercial_policy_applications -> legacy compatibility only (no new UI/contract/write path)
```

Recomenda-se um adapter de Pricing dedicado dentro de `adapter-supabase`, sem ampliar ainda mais o
`LegacySupabaseAdapter`. Isso preserva fronteiras e permite substituir internamente queries por RPCs
sem afetar a UI. Não requer mover os arquivos atuais.

## 6. Compatibilidade e reutilização

### Continuam válidos

- todas as seis rotas atuais;
- Shell, navegação, conta, cabeçalhos, empty/error states;
- fluxo de autorização e server actions;
- Product e Specs como contexto raiz de Pricing;
- normalização, mensagens seguras e revalidação pós-escrita;
- separação UI -> use case -> port -> adapter.

### Pequenos ajustes

- incluir navegação/cards de Prices e Offers;
- mostrar resumo de preço vigente e ofertas no detalhe/lista do Product somente após read contracts;
- introduzir paginação/ordenação na listagem antes de crescimento significativo;
- tornar factories/composition roots explícitos também nas leituras administrativas;
- padronizar DTOs hoje declarados no server (`AdminProductListItem`) em `contracts` quando houver
  consumo transversal.

### Precisam ser remodelados ou criados

- Prices, Offers, Policies, workflow de publicação e auditoria são desenvolvimento novo;
- Policies devem ser editoras filhas de Offer, não uma tela que aplica policies a Products;
- publicação não pode ser um update de status genérico: deve chamar o caso de uso/RPC oficial,
  validar lock version, preço-base publicado, vigência, blocking issues e ator;
- o fluxo antigo Policy -> Application precisa ficar fora da arquitetura nova.

### Componentes reutilizáveis

`AdminShell`, `AdminNav`, `AdminAccount`, `PageHeader`, `ModuleCard`, `EmptyState`, o padrão de
`AdminProductError`, os padrões de filtros/listas e o padrão de action state do `AdminProductForm`.
O dirty state e batch interaction de `AdminProductSpecsEditor` são referência útil para um editor de
policies, mas seus campos e modelos não devem ser generalizados artificialmente.

### Obsoletos para o domínio alvo

Nenhum componente Next.js existente precisa ser removido. São obsoletos apenas como fonte de verdade:

- planos históricos Appsmith em `docs/admin/SPRINT_1_*`;
- exports Appsmith preservados;
- conceitos/telas baseados em `commercial_policy_applications`;
- o corpo pré-adendo do ADR-011 quando contradiz `PRICING_POLICY_MODEL.md`.

## 7. Dependências legadas

- classe e DTOs `LegacySupabaseAdapter`/`Legacy*`, mesmo para a escrita atual de Product;
- tabelas `products`, `specs`, `product_specs` e `unit_conversions` (aceitas atrás do adapter);
- `product_specs.equipment_id` representa o ID de spec;
- `commercial_policy_applications` permanece no schema, funções/views, auditoria e testes de
  compatibilidade;
- `product_price_offers`, imports/staging e `vw_product_value_current` permanecem históricos;
- migrations iniciais de Pricing implementaram o modelo anterior antes da migration incremental de
  CommercialOffer;
- ADR-011 contém descrição histórica contraditória após o adendo; a fonte vigente é
  `docs/data/PRICING_POLICY_MODEL.md`.

## 8. Gap analysis

| Funcionalidade | Estado atual | Estado desejado | Classificação | Prioridade |
| --- | --- | --- | --- | --- |
| Fundação Admin | pronta e protegida | manter | Pronto | P0 preservar |
| Product list/create/edit | operacional | manter e contextualizar Pricing | Pequeno ajuste | P1 |
| Product duplicate | operacional com compensação | preservar; avaliar transação futura | Pequeno ajuste | P2 |
| Specs | operacional | manter independente de Pricing | Pronto | P2 |
| Pricing contracts | somente enums | entidades, DTOs, ports, errors e workflow | Novo desenvolvimento | P0 |
| ProductPublicPrice read | inexistente | histórico e preço vigente por Product | Novo desenvolvimento | P0 |
| ProductPublicPrice write | inexistente | draft/edit com concorrência | Novo desenvolvimento | P1 |
| Price publication | somente banco | caso de uso explícito e auditado | Médio | P1 |
| CommercialOffer read/write | inexistente | agregado ligado a Product e preço publicado | Novo desenvolvimento | P1 |
| CommercialPolicy editor | inexistente | coleção filha direta da Offer | Grande refatoração do conceito legado | P1 |
| Offer publication | função SQL sem aplicação | validação/publicação atômica da Offer + policies | Médio | P1 |
| Audit trail UI | inexistente | consulta por agregado/correlação | Novo desenvolvimento | P2 |
| Paginação/ordenação | inexistente | queries determinísticas e paginadas | Pequeno ajuste | P2 |
| Optimistic locking | schema apenas | lock version nos forms/actions | Médio | P1 |
| Importação | dry-run/schema, sem Admin | revisão humana futura | Novo desenvolvimento | P3, fora do MVP-A inicial |
| Modelo applications | ativo apenas para compatibilidade | excluído de fluxos novos | Médio (contenção) | P0 |

## 9. Riscos, limitações e pendências

1. **Modelo duplo:** migrations e documentos ainda contêm applications; uma query equivocada pode
   reintroduzir o agregado antigo.
2. **Client privilegiado:** `SUPABASE_SERVER_KEY` contorna RLS; qualquer action sem autorização
   antecipada vira risco crítico.
3. **Contrato incompleto:** ligar telas diretamente ao schema agora criaria o acoplamento proibido.
4. **Publicação:** updates diretos de status podem burlar validação, auditoria e invariantes.
5. **Concorrência:** o Admin atual não usa `lock_version`; Pricing exige conflito explícito.
6. **Transação:** duplicação de Product usa compensação multi-query e pode deixar resíduo se a
   compensação falhar; não bloquear Pricing, mas não copiar o padrão para publicação.
7. **Paginação:** Products carrega todos os registros e não aplica ordenação explícita.
8. **Documentação divergente:** ADR-011 mistura decisão histórica e atual; o adendo reduz, mas não
   elimina a ambiguidade.
9. **Schema remoto:** esta auditoria não inspecionou nem alterou o banco; a presença efetiva das
   migrations no ambiente alvo é **PENDENTE de verificação read-only** antes da implementação.
10. **Regras de negócio pendentes:** CDI/spread, correção retroativa de preço, exposição ao Seller e
    certos cálculos continuam pendentes conforme documentos do domínio.
11. **Testes E2E:** não há teste browser do Admin; a suíte é unitária/estrutural.
12. **Sem delete no Product:** deliberadamente ausente e deve permanecer assim até decisão própria.

## 10. Roadmap técnico MVP-A

### Sprint 1 — Consolidar a fronteira Pricing

- confirmar `PRICING_POLICY_MODEL.md` como contrato vigente e marcar trechos históricos;
- criar entidades/value objects, DTOs, errors e repository ports sem UI;
- definir read models, paginação, money/date e lock version;
- criar composition root e adapter de Pricing dedicado, inicialmente só leitura;
- testes unitários de invariantes e adapter; nenhuma escrita/publicação.

**Saída:** aplicação conhece o domínio novo sem conhecer tabelas.

### Sprint 2 — ProductPublicPrice em leitura

- adicionar preço vigente/histórico no contexto de Product;
- criar lista/detalhe e estados empty/error;
- validar ordenação e intervalo semiaberto;
- manter view/contrato público separado do Admin.

### Sprint 3 — ProductPublicPrice draft/edit

- formulário com amount, starts_on, origem e blocking issues;
- autorização antes do adapter, validação no core e lock version;
- criar/editar apenas estados permitidos; testes de conflito.

### Sprint 4 — Publicação de ProductPublicPrice

- confirmação explícita, RPC oficial, ator e correlation ID;
- bloquear zero/inválido e reler resultado;
- exibir audit event e conflito de concorrência;
- nunca publicar via update genérico.

### Sprint 5 — CommercialOffer

- lista por Product, create/detail/edit de draft;
- exigir Product e `public_price_id` publicado compatível;
- validar vigência, origem, status e lock version;
- reutilizar Shell, headers, filtros e action-state patterns.

### Sprint 6 — CommercialPolicy dentro da Offer

- editor de coleção filha na rota/detail da Offer;
- formulários discriminados por policy type/calculation method;
- cálculos e parâmetros validados no core e banco;
- nenhuma leitura/escrita em `commercial_policy_applications`.

### Sprint 7 — Workflow de Offer

- preflight de blocking issues;
- publicação atômica da Offer e policies vinculadas;
- archive conforme transições permitidas;
- testes de autorização, atomicidade, idempotência e auditoria.

### Sprint 8 — Auditoria e endurecimento

- timeline read-only por agregado/correlation ID;
- paginação, filtros, acessibilidade, responsividade e mensagens;
- testes E2E dos caminhos críticos e regressão de Products/Specs;
- documentação operacional e rollback lógico.

Importação/IA deve permanecer depois desse MVP-A: ela produz drafts/needs_review e reutiliza os
mesmos casos de uso, sem rota paralela de publicação.

## 11. Ordem recomendada de implementação

1. Resolver a fonte documental vigente e congelar invariantes.
2. Criar core/contracts/tests de Pricing.
3. Criar adapter dedicado e read paths.
4. Entregar Price read, depois draft/edit, depois publish.
5. Entregar Offer read/draft.
6. Entregar Policies como filhas diretas de Offer.
7. Entregar publicação atômica da Offer.
8. Expor auditoria e endurecer concorrência/E2E.
9. Só então integrar importação e revisar consumo Seller.

Cada sprint deve preservar as rotas atuais, evitar acesso Supabase fora do adapter, atualizar
documentação/CHANGELOG e executar a validação completa do monorepo.

## 12. Arquivos relevantes

### Admin e autenticação

- `apps/web/src/app/admin/**`
- `apps/web/src/components/admin/**`
- `apps/web/src/application/admin/**`
- `apps/web/src/server/admin-product-*.ts`
- `apps/web/src/server/{create,update,duplicate}-admin-product.ts`
- `apps/web/src/auth/**` e `apps/web/src/middleware.ts`

### Domínio, contratos e adapter

- `packages/core/src/admin/**`
- `packages/core/src/repositories/administrative-vehicle-repository.ts`
- `packages/core/src/use-cases/*administrative*`
- `packages/contracts/src/index.ts` e `pricing.ts`
- `packages/adapter-supabase/src/legacy-supabase-adapter.ts`, `legacy-dtos.ts`, `client.ts`, `auth.ts`

### Pricing e documentação

- `docs/data/PRICING_POLICY_MODEL.md`
- `docs/architecture/ADR-011-PRICE-AND-COMMERCIAL-POLICY-MODEL.md`
- `docs/data/PRICE_AND_POLICY_TARGET_SCHEMA.md`
- `supabase/migrations/20260725*.sql` e `20260726150000_add_pricing_legacy_migration_rules.sql`
- `supabase/tests/002_*` a `008_*`

### Testes de aplicação

- `apps/web/test/admin-*.test.ts`
- `apps/web/test/{auth-access,route-policy,server-client,update-session}.test.ts`
- `packages/core/test/administrative-*.test.ts`
- `packages/adapter-supabase/test/*.test.ts`

## 13. Critérios de saída antes da primeira implementação

- domínio vigente aprovado sem applications;
- contratos e ports revisados antes da UI;
- autorização e audit actor definidos para toda escrita;
- RPCs oficiais e lock-version contract confirmados read-only no ambiente alvo;
- comportamento de Price/Offer publication coberto por testes;
- nenhuma mudança em `Legacy`, migration aplicada, db push ou publicação durante a preparação.
