# Domínio Administrativo

Este diretório documenta o domínio da área `admin` do Compra Car. A arquitetura-alvo usa a mesma aplicação Next.js do MVP-u para as áreas `seller` e `admin`; `admin` também acessa a área `seller`. As regras permanecem independentes da ferramenta de interface.

- [`ADMIN_PRICING_AUDIT.md`](ADMIN_PRICING_AUDIT.md): inventário da implementação Next.js atual,
  aderência ao domínio `ProductPublicPrice -> CommercialOffer -> CommercialPolicy`, gaps, riscos e
  roadmap incremental do MVP-A;
- [`PRODUCT_PUBLIC_PRICE_READ_SLICE.md`](PRODUCT_PUBLIC_PRICE_READ_SLICE.md): arquitetura e limites
  da primeira listagem administrativa somente leitura de preços públicos;
- [`SPRINT_9B_BATCH_PRICES.md`](SPRINT_9B_BATCH_PRICES.md): grade manual, validações, atomicidade,
  segurança e limites do batch de preços;
- [`SPRINT_9D_OFFER_BUILDER.md`](SPRINT_9D_OFFER_BUILDER.md): composição explícita de Offers,
  validações, persistência atômica e limites do builder;
- [`SPRINT_9G_POLICY_COMBINATION_MANAGEMENT.md`](SPRINT_9G_POLICY_COMBINATION_MANAGEMENT.md): próxima
  etapa de consulta e gestão de Policies e combinações, ainda não implementada;

Os documentos e exports do Appsmith registram uma direção anterior e permanecem preservados apenas como referência histórica. Eles não são planos vigentes e não receberão novas implementações.

## Documentos

- [`ADMIN_SCOPE.md`](ADMIN_SCOPE.md): limites, fases, princípios e dependências;
- [`VEHICLE_MANAGEMENT.md`](VEHICLE_MANAGEMENT.md): criação, edição e clonagem de veículos;
- [`PRICE_MANAGEMENT.md`](PRICE_MANAGEMENT.md): preços e políticas comerciais em grade;
- [`ADMIN_COMPARISON.md`](ADMIN_COMPARISON.md): comparação técnica e financeira administrativa;
- [`AI_IMPORTS.md`](AI_IMPORTS.md): importações assistidas por IA previstas para a Fase 2.
- [`SPRINT_1_PRODUCT_MANAGEMENT.md`](SPRINT_1_PRODUCT_MANAGEMENT.md): registro histórico do inventário, contrato, SQL, testes e configuração que foram propostos para a Sprint 1 no Appsmith.
- [`SPRINT_1_BATCH_1_APPSMITH.md`](SPRINT_1_BATCH_1_APPSMITH.md): roteiro histórico do primeiro lote que havia sido planejado para `Admin Modelos`; não executar.
- [`SPRINT_5_PRODUCT_CREATION.md`](SPRINT_5_PRODUCT_CREATION.md): implementação, regras,
  fronteiras e riscos do cadastro de veículos no Next.js.
- [`SPRINT_6_PRODUCT_EDITING.md`](SPRINT_6_PRODUCT_EDITING.md): implementação, persistência,
  feedback e riscos da edição de veículos no Next.js.
- [`SPRINT_7_PRODUCT_DUPLICATION.md`](SPRINT_7_PRODUCT_DUPLICATION.md): duplicação como um novo
  Create preenchido, sem clone de dados relacionados.
- [`SPRINT_8_PRODUCT_SPECS.md`](SPRINT_8_PRODUCT_SPECS.md): ficha administrativa, semântica dos
  tipos, persistência em lote e conversão canônica de torque.

## Estado

A documentação registra o domínio aprovado e o inventário histórico do export Appsmith.
Autenticação, autorização, shell, listagem, criação, edição, duplicação e ficha de specs dos
veículos estão implementados no Next.js. A listagem, draft/edit individual e Batch Prices também
estão implementados. Batch Policies e Offer Builder também estão concluídos; revisão integrada/manual
e publicação administrativa permanecem pendentes.

## Princípios

- preservar o schema atual durante a Fase 1;
- separar regras administrativas da tecnologia de interface;
- preservar histórico e registros originais;
- validar duplicidade, permissões e integridade antes de escrever;
- não promover hipótese histórica de `Legacy` a fato do Supabase atual;
- impedir escrita direta de IA em objetos definitivos.
