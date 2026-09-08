# Vehicle/specs matrix dry-run

O importador puro em `packages/core/src/import/vehicle-specs-matrix-dry-run.ts` transpõe a matriz horizontal sem escrever no Supabase. Esse caminho permanece disponível. A alternativa local em `vehicle-specs-csv-dry-run.ts` lê registros verticais separados por `;`: `SC_0001` é o display name, `SC_0002` marca, `SC_0003` modelo, `SC_0004` versão, `SC_0005` ano de produção e `SC_0006` ano-modelo. As demais colunas são resolvidas exclusivamente por `specs.code`.

Cada outra coluna é um veículo. O resultado contém candidatos, matching pela identidade normalizada
do domínio e contagens/exemplos de revisão em JSON serializável. O parser reutiliza
`parseCanonicalNumeric`, mantém vazio como ausência e preserva zero: numeric `0` é valor, binary `0`
é `false` e scale `0` é sinal de baseline. Scales são consolidadas por `spec_set`, nunca célula a
célula; texto inesperado permanece em review.

## Execução desta etapa

O runner `scripts/data-refresh/run-vehicle-specs-dry-run.ts` aceita `--source=legacy-csv` e `--source=staging`. O primeiro lê `Legacy/staging.csv`; o segundo preserva a leitura de `public.product_specs_matrix_staging`. Ambos consultam somente `specs` e `products` e nunca enviam requests de escrita.

Em 2026-09-01, o CSV local produziu 276 veículos, 299 colunas, 293 spec columns e 80.868 células observadas. Contra o catálogo read-only de 190 specs e 10 products, o resultado foi 9 `EXISTING_EXACT`, 267 `NEW_PRODUCT`, nenhum `AMBIGUOUS`/`INVALID`, 103 códigos desconhecidos e 3.741 ocorrências unknown. Todos os 276 pares `SC_0005`/`SC_0006` foram válidos e nenhum ano foi inferido de `SC_0001`.

O preview completo está em `temp/vehicle-specs-dry-run-preview.json`, diretório ignorado pelo Git. O arquivo `Legacy/staging.csv`, tabelas, migrations e o Import Engine 10R permanecem inalterados.
