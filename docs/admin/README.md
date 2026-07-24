# Domínio Administrativo

Este diretório documenta o domínio da área `admin` do Compra Car. A arquitetura-alvo usa a mesma aplicação Next.js do MVP-u para as áreas `seller` e `admin`; `admin` também acessa a área `seller`. As regras permanecem independentes da ferramenta de interface.

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

## Estado

A documentação registra o domínio aprovado e o inventário histórico do export Appsmith.
Autenticação, autorização, shell, listagem, criação e edição de veículos estão implementados no
Next.js. Permanecem pendentes duplicação, specs, preços, a auditoria de grants/RLS e a monetização
de specs.

## Princípios

- preservar o schema atual durante a Fase 1;
- separar regras administrativas da tecnologia de interface;
- preservar histórico e registros originais;
- validar duplicidade, permissões e integridade antes de escrever;
- não promover hipótese histórica de `Legacy` a fato do Supabase atual;
- impedir escrita direta de IA em objetos definitivos.
