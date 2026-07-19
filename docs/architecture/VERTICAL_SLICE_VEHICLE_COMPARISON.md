# Vertical Slice — Comparação de Veículos

## Estado

Concluído em 2026-07-18 como a Fase 4 do Compra Car.

## URL pública

A comparação recebe dois ou três IDs numéricos, positivos e distintos, preservando sua ordem:

```text
/comparar?vehicles=id1,id2
/comparar?vehicles=id1,id2,id3
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
- o domínio continua responsável por ordem, agrupamento, valores ausentes e `isDifferent`;
- o toolbar client altera somente o parâmetro visual `differences=true`;
- a tabela server renderiza as categorias já produzidas pelo domínio.

Nenhum componente acessa Supabase ou recalcula regras de comparação.

## Apresentação e filtro

Itens `binary` e `scale` são apresentados como `Sim` ou `Não`, mantendo uma linha por `code`. Valores `numeric` usam formatação `pt-BR`, preservam unidade e apresentam `—` quando `null`. O filtro “Mostrar apenas diferenças” mantém exclusivamente linhas com `isDifferent = true`; categorias vazias são omitidas.

## Cache

A comparação usa `unstable_cache` com 300 segundos. A chave contém a combinação ordenada dos IDs. As tags são:

- `catalog`;
- `comparison`;
- `vehicle:{id}` para cada veículo.

Credenciais não integram a chave, as tags ou DTOs.

## Fora do escopo

Autenticação, autorização, vantagens, PDF, impressão especializada, compartilhamento persistente, favoritos, histórico, analytics, edição, escrita, migrations, nova taxonomia e estado global permanecem fora da Fase 4.
