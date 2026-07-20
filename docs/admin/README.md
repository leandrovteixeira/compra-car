# Domínio Administrativo

Este diretório documenta o domínio do backoffice administrativo do Compra Car. As regras permanecem independentes da ferramenta de interface; Appsmith é a tecnologia escolhida para a Fase 1, não parte do modelo de domínio.

## Documentos

- [`ADMIN_SCOPE.md`](ADMIN_SCOPE.md): limites, fases, princípios e dependências;
- [`VEHICLE_MANAGEMENT.md`](VEHICLE_MANAGEMENT.md): criação, edição e clonagem de veículos;
- [`PRICE_MANAGEMENT.md`](PRICE_MANAGEMENT.md): preços e políticas comerciais em grade;
- [`ADMIN_COMPARISON.md`](ADMIN_COMPARISON.md): comparação técnica e financeira administrativa;
- [`AI_IMPORTS.md`](AI_IMPORTS.md): importações assistidas por IA previstas para a Fase 2.

## Estado

A documentação registra decisões aprovadas, mas não confirma objetos físicos além da superfície mapeada em `docs/data`. O export do Appsmith atual, as permissões de escrita, os objetos de preços e políticas e a monetização de specs permanecem pendentes de validação.

## Princípios

- preservar o schema atual durante a Fase 1;
- separar regras administrativas da tecnologia de interface;
- preservar histórico e registros originais;
- validar duplicidade, permissões e integridade antes de escrever;
- não promover hipótese histórica de `Legacy` a fato do Supabase atual;
- impedir escrita direta de IA em objetos definitivos.
