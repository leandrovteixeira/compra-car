# Vertical Slice — Comparação de Veículos

## Estado

Atualizado em 2026-07-19 com o MVP do motor de comparação.

## URL pública

A comparação recebe dois ou mais IDs numéricos, positivos e distintos, preservando sua ordem. O primeiro é sempre o veículo de referência:

```text
/comparar?vehicles=id1,id2
/comparar?vehicles=id1,id2,id3
/comparar?vehicles=id1,id2,id3,id4
```

Ausência, quantidade inválida, valores vazios, formato incompatível e duplicidades produzem estados públicos seguros com retorno à seleção.

## Responsabilidades

```text
Página /comparar (Server Component)
→ comparison-service server-only
→ parser e mapper da camada de aplicação web
→ unstable_cache
→ CompareVehicles
→ VehicleRepository + ComparisonRepository
→ LegacySupabaseAdapter
→ Supabase atual
```

- a página lê parâmetros e renderiza estados;
- o serviço valida, executa o caso de uso e converte erros;
- o composition root injeta o mesmo adaptador nas duas portas;
- o mapper converte o resultado do domínio em DTOs serializáveis;
- o domínio é responsável por ordem, agrupamento, valores ausentes e resultados contra a referência;
- o toolbar client altera somente o parâmetro visual `highlights=true`;
- a tabela server renderiza as categorias já produzidas pelo domínio.

Nenhum componente acessa Supabase ou recalcula regras de comparação.

## Apresentação e filtro

Itens `binary` e `scale` apresentam um indicador circular claro para `true` e `—` para `false` ou `null`. Valores `numeric` usam formatação `pt-BR`, preservam unidades reais, omitem o placeholder legado `unit` e apresentam `—` quando `null`. O filtro “Ver destaques” mantém exclusivamente linhas em que a referência vence ao menos um concorrente; categorias vazias são omitidas. Apenas a célula da referência é destacada.

A apresentação usa uma superfície tabular única e de densidade compacta, com cabeçalho e coluna de equipamentos fixos dentro de uma região de rolagem bidirecional. Cabeçalhos de veículos, divisores de categoria, estados de loading/vazio/erro e indicação não cromática de vantagem pertencem exclusivamente à camada de UI.

Em larguras de até 768 px, a coluna de equipamentos usa base compacta e cada veículo usa uma coluna mínima legível; em 390 px, dois veículos aparecem integralmente ao lado da coluna fixa antes do scroll. Presença `binary` é exibida por uma bolinha clara, separada do check verde de vantagem. Todas as células reservam um slot de 20 px à direita para o check, mesmo quando vazio, evitando deslocamentos entre linhas.

A formatação numérica de apresentação é centralizada na aplicação web: agrupamento e decimais seguem `pt-BR`; torque e relações peso/potência usam uma casa decimal; telas usam até duas; unidade vazia é omitida. O adapter preserva o número original e não multiplica nem divide cilindrada.

`binary` compara `is_present` e, temporariamente, trata ausência como `false` somente para a classificação; `numeric` compara `value` conforme `value_direction` (`Positive` favorece o maior e `Negative` o menor), sem tolerância, e continua retornando `unknown` quando falta informação. Itens `scale` são exibidos, mas sempre retornam `not-applicable` e nunca produzem vantagem ou desvantagem.

## Cache

A comparação usa `unstable_cache` com 300 segundos. A chave contém a combinação ordenada dos IDs. As tags são:

- `catalog`;
- `comparison`;
- `vehicle:{id}` para cada veículo.

Credenciais não integram a chave, as tags ou DTOs.

## Fora do escopo

Autenticação, autorização, ranking de `scale`, pesos, score geral, relevância, IA, tolerâncias, comparação editorial, PDF e escrita pela aplicação permanecem fora do escopo.
