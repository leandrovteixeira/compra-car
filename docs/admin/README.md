# Domínio Administrativo

Este diretório documenta o domínio do backoffice administrativo do Compra Car. As regras permanecem independentes da ferramenta de interface; Appsmith é a tecnologia escolhida para a Fase 1, não parte do modelo de domínio.

## Documentos

- [`ADMIN_SCOPE.md`](ADMIN_SCOPE.md): limites, fases, princípios e dependências;
- [`VEHICLE_MANAGEMENT.md`](VEHICLE_MANAGEMENT.md): criação, edição e clonagem de veículos;
- [`PRICE_MANAGEMENT.md`](PRICE_MANAGEMENT.md): preços e políticas comerciais em grade;
- [`ADMIN_COMPARISON.md`](ADMIN_COMPARISON.md): comparação técnica e financeira administrativa;
- [`AI_IMPORTS.md`](AI_IMPORTS.md): importações assistidas por IA previstas para a Fase 2.
- [`SPRINT_1_PRODUCT_MANAGEMENT.md`](SPRINT_1_PRODUCT_MANAGEMENT.md): inventário, contrato, SQL, testes e configuração proposta para a Sprint 1 do MVP-a.
- [`SPRINT_1_BATCH_1_APPSMITH.md`](SPRINT_1_BATCH_1_APPSMITH.md): instruções exatas do primeiro lote incremental sobre a página real `Admin Modelos`.

## Estado

A documentação registra decisões aprovadas e o inventário do export Appsmith atual. Permanecem pendentes as permissões e role efetiva do datasource, seu comportamento transacional, os objetos de preços e políticas e a monetização de specs.

## Princípios

- preservar o schema atual durante a Fase 1;
- separar regras administrativas da tecnologia de interface;
- preservar histórico e registros originais;
- validar duplicidade, permissões e integridade antes de escrever;
- não promover hipótese histórica de `Legacy` a fato do Supabase atual;
- impedir escrita direta de IA em objetos definitivos.
