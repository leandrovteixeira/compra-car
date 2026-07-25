# Pricing legacy dry-run

## Objetivo

`@compra-car/pricing-dry-run` produz uma simulação determinística do legado de preços antes de
qualquer backfill. A ferramenta lê as origens em uma transação PostgreSQL `REPEATABLE READ READ
ONLY`, classifica candidatos em memória e grava apenas relatórios no filesystem local.

Ela não cria import batches, não grava nas tabelas da Sprint 9, não chama RPCs, não publica dados e
não executa migrations.

## Execução

Da raiz do monorepo:

```powershell
$env:DATABASE_URL = '<URL PostgreSQL explícita da stack Supabase local>'
pnpm pricing:dry-run -- `
  --output-dir .local-reports/pricing `
  --algorithm-version 1.0.0 `
  --cutoff-date 2026-07-25 `
  --exclude-executed-at-from-hash `
  --verbose
```

A URL também pode ser fornecida por `--database-url`. Ela nunca é impressa; o relatório recebe
somente host, porta e nome do banco sanitizados. O diretório informado recebe um subdiretório
`<timestamp>-v<algorithm-version>`.

Opções:

- `--fail-on-source-change`: gera os relatórios e encerra com código 2 se a fotografia divergir da
  baseline de referência;
- `--insurance-percentage <decimal>`: adota explicitamente uma premissa percentual somente na
  simulação; sem a opção, seguro permanece sem valor calculado e em revisão;
- `--exclude-executed-at-from-hash`: exclui o instante do hash comparável;
- `--expected-local-port`: porta esperada da stack, com default 54322;
- `--fixture`: executa o mesmo algoritmo sobre uma fotografia JSON local, sem conexão de banco.

## Proteção contra ambiente remoto

- somente `localhost`, `127.0.0.1` e `::1` são aceitos;
- a porta deve coincidir com a porta local esperada;
- não existe flag de liberação remota nesta versão;
- a conexão usa `ssl: false`, adequado apenas à stack local;
- a transação consulta `transaction_read_only` e falha se o servidor não confirmar o modo;
- os objetos legados e da Sprint 9 são verificados antes da leitura;
- todas as consultas de dados são `SELECT`, ordenadas e sem chamada de função de publicação.

## Algoritmo

Os módulos ficam em `packages/pricing-dry-run/src`:

- `database.ts`: valida o alvo local e lê uma fotografia consistente;
- `money.ts`: decimal exato e arredondamento HALF_UP;
- `canonical.ts`: JSON canônico, hashes SHA-256 e fingerprints;
- `classification.ts`: preços, políticas e sugestões de combinação;
- `reconciliation.ts`: comparação exata com totais legados;
- `runner.ts`: inventário, baseline, needs review e cobertura de views;
- `reports.ts`: JSON/CSV estáveis e documentação do resultado;
- `cli.ts`: argumentos, execução e saída sanitizada.

Preço duplicado de mesmo valor gera um candidato lógico com múltiplas origens. Valores conflitantes
nunca recebem vencedor. Totais legados servem somente à reconciliação. Rebates não viram bônus, e
qualquer combinação permanece sugestão não publicável.

## Relatórios

Cada execução gera:

1. `summary.json`;
2. `source-inventory.csv`;
3. `public-price-candidates.csv`;
4. `public-price-conflicts.csv`;
5. `policy-candidates.csv`;
6. `accumulator-candidates.csv`;
7. `needs-review.csv`;
8. `reconciliation.csv`;
9. `view-coverage.csv`;
10. `README.md`.

JSON usa chaves canônicas para hash. CSV possui colunas fixas, escaping RFC 4180 básico e ordem
estável. Sobre a mesma fotografia e opções, o conteúdo de dados é repetível; apenas `executedAt` e o
nome do diretório variam. O hash pode ignorar `executedAt`.

## Baseline e limitações

As contagens de 292 produtos, 746 ofertas e demais números do inventário são baseline de comparação,
não verdade embutida no classificador. Toda diferença é relatada. `--fail-on-source-change` transforma
essa diferença em falha operacional depois da geração dos artefatos.

O banco local recriado com `--no-seed` está vazio. Ele valida conexão, transação read-only, schema e
relatórios vazios, mas não substitui uma fotografia autorizada do legado real. A fixture cobre zero,
negativo, duplicidade igual e conflitante, múltiplos benefícios, AND/OR, rebate e total divergente.

## Bloqueios para backfill

Backfill persistente continua bloqueado enquanto houver:

- mudança de fotografia sem aprovação;
- preço zero, negativo, conflitante ou produto sem correspondência;
- vigência ausente/inválida;
- financiamento sem parameter set publicado;
- percentual de seguro/IPVA não aprovado;
- descrição obrigatória ausente;
- rebates ou totais sem semântica confirmada;
- relação AND/OR não decidida;
- divergências de reconciliação sem explicação;
- qualquer candidato `needs_review` sem decisão humana.
