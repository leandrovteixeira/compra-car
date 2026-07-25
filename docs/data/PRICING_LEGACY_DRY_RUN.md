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

## Fotografia autorizada na stack local

Os scripts em `scripts/pricing` preparam o caminho operacional entre um dump previamente autorizado
e o dry-run. Eles não obtêm dumps, não acessam origem remota, não executam migration e não fazem
backfill. O operador deve começar com uma stack local descartável, criada pelas migrations atuais e
com as sete tabelas legadas abaixo vazias.

Pré-requisitos:

- PowerShell 5.1 ou posterior;
- clientes PostgreSQL `psql` e `pg_restore` compatíveis com o dump;
- `pnpm` e dependências do monorepo instaladas;
- Supabase local na porta explícita esperada, por padrão `54322`;
- dump data-only autorizado e seu SHA-256 recebido por canal separado.

São aceitos `*.sql` no formato data-only padrão do `pg_dump`, exclusivamente com blocos `COPY`, ou
arquivos custom PostgreSQL `*.dump`/`*.backup` com assinatura `PGDMP`. SQL com `INSERT`, DDL ou
metacomandos não reconhecidos falha fechado. O dump deve conter exatamente dados de:

- `public.products`;
- `public.product_price_offers`;
- `public.price_offer_imports`;
- `public.price_offer_import_rows`;
- `public.price_offers_staging`;
- `public.product_specs`;
- `public.specs`.

Essas tabelas cobrem as dependências FK de origem necessárias ao dry-run na baseline atual. Objetos
de `auth`, `storage`, `profiles`, administração, logs, tokens e demais domínios são recusados.

Primeiro, valide sem conexão de banco:

```powershell
$snapshot = '.local-snapshots/pricing/legacy-authorized.sql'
$sha256 = '<SHA-256 autorizado com 64 caracteres hexadecimais>'

./scripts/pricing/validate-pricing-legacy-snapshot.ps1 `
  -SnapshotPath $snapshot `
  -AllowedSnapshotDirectory '.local-snapshots/pricing' `
  -ExpectedSha256 $sha256
```

Depois de preparar conscientemente a stack local vazia, execute o fluxo único. A senha fica somente
na memória e nas variáveis temporárias dos subprocessos; não é passada como argumento nem gravada
no manifesto:

```powershell
$localDatabaseUrl = '<URL PostgreSQL explícita para 127.0.0.1:54322>'

./scripts/pricing/run-pricing-snapshot-validation.ps1 `
  -SnapshotPath $snapshot `
  -AllowedSnapshotDirectory '.local-snapshots/pricing' `
  -ExpectedSha256 $sha256 `
  -DatabaseUrl $localDatabaseUrl `
  -CutoffDate '2026-07-25' `
  -AlgorithmVersion '1.0.0' `
  -OutputDirectory '.local-reports/pricing-snapshots/authorized-run' `
  -ConfirmLocalRestore
```

O fluxo valida novamente o dump e o destino, exige que todas as tabelas de destino estejam vazias,
restaura somente dados em uma transação, roda `pnpm pricing:dry-run` com cutoff, versão,
`--exclude-executed-at-from-hash` e `--verbose`, e só então grava `snapshot-manifest.json`. Não há
flag de bypass remoto. `-WhatIf` permite revisar o plano sem conectar, restaurar ou executar o
dry-run.

O script de restore isolado existe para teste e diagnóstico operacional, mas o caminho recomendado é
o orquestrador acima, que não permite terminar após uma restauração bem-sucedida sem tentar o
dry-run. Se qualquer etapa falhar, não é produzido manifesto final de sucesso; a stack local deve ser
descartada e recriada antes de uma nova tentativa.

### Barreiras de segurança

- somente `localhost`, `127.0.0.1` e `::1`, com porta explícita igual à esperada;
- o preflight confirma novamente que o endereço IP respondente é loopback;
- parâmetros de URL, fragmentos e opções SSL são recusados;
- diretório permitido, extensão, tamanho, assinatura e SHA-256 são validados antes da conexão;
- `DROP`, roles, grants, revokes, extensions, databases, `ALTER SYSTEM`, `COPY PROGRAM`, owners e
  opções perigosas de `pg_restore` são recusados;
- plain SQL aceita apenas o subconjunto data-only reconhecido; custom dump é inspecionado por TOC;
- `psql` usa `--no-psqlrc`, `ON_ERROR_STOP` e transação única;
- `pg_restore` recebe opções construídas internamente: data-only, transação única, sem owner e ACL;
- nunca são usados `--clean`, `--create`, `--if-exists`, `db push` ou `migration repair`;
- o preflight somente leitura aborta se qualquer tabela alvo já contiver linhas.

### Manifesto

`snapshot-manifest.json` contém timestamp UTC, SHA-256, tamanho e formato do dump, versão do
algoritmo, cutoff, identidade local sanitizada, contagens de origem, resumo do dry-run, hash
comparável e status final. Não contém nome do arquivo completo, usuário, senha ou connection string.
O manifesto, dumps, snapshots, SQL restaurado, temporários e relatórios locais são ignorados pelo
Git.

A suíte `pnpm pricing:snapshot:test` cobre arquivo ausente, SHA, allowlist, `DROP`, host remoto, porta
incorreta, confirmação obrigatória, plano permitido em `-WhatIf`, argumentos seguros de restore,
execução real do algoritmo sobre fixture e manifesto sanitizado. Ela não conecta a banco.

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
