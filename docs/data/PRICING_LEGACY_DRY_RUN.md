# Pricing legacy dry-run

## Objetivo

`@compra-car/pricing-dry-run` produz uma simulação determinística do legado de preços antes de
qualquer backfill. A ferramenta lê as origens em uma transação PostgreSQL `REPEATABLE READ READ
ONLY`, classifica candidatos em memória e grava apenas relatórios no filesystem local.

Ela não cria import batches, não grava nas tabelas da Sprint 9, não chama RPCs, não publica dados e
não executa migrations.

## Modelo final da versão 3.0.0

Cada linha de `product_price_offers` gera exatamente uma `commercial_offer` candidata em `draft`.
A offer é o agregado pai: referencia o `product`, o MSRP versionado de `product_public_prices` e
zero ou mais `commercial_policies`. `legacy_source_id` é somente rastreabilidade; nenhuma relação
nova depende estruturalmente dele. Duas ou mais policies da mesma offer formam um accumulator
provisório `OR`, com origem `legacy_default`; zero ou uma policy não gera accumulator.

A vigência é o primeiro e o último dia de `offer_month`. Ano ou mês ausente/inválido não é
inventado e bloqueia publicação. O MSRP usado por IPVA, seguro e financiamento é o candidato
versionado ligado à offer, nunca o preço corrente consultado posteriormente.

Regras econômicas confirmadas:

- seguro: `insurance_years × 0,03 × MSRP`, sem proporcionalidade mensal;
- IPVA: `MSRP × 0,04 × (13 - offer_month) / 12`;
- financiamento: `NULL/NULL/NULL` e `0/0/0` significam ausência de policy; os demais conjuntos
  completos exigem parcelas positivas, taxa promocional não negativa e entrada entre 0 e 100%;
- taxa de referência mensal: `(1 + 0,1478)^(1/12) - 1 + 0,003 = 0,014553487442`;
- benefício financeiro oficial: `PV(referência) - PV(promocional)`, ambos descontados pela taxa de
  referência. Diferença nominal de totais pagos é apenas diagnóstica;
- rebate fica em `dealer_rebate_amount`, reduz custo estimado da montadora e nunca aumenta o
  benefício bruto do cliente.

`LEGACY_CALCULATION_METHOD_DIFFERENCE` substitui o mismatch bloqueador para a comparação do total
histórico: é informativo, explica `methodology_changed` e preserva taxas, valores e diferenças para
auditoria. Rebate agregado divergente continua em diagnóstico separado e não cria policy genérica.

### Alocação do dealer rebate agregado

O legado frequentemente possui os componentes individuais zerados e somente
`total_dealer_rebate > 0`. Isso não é erro: o dry-run distribui o total proporcionalmente pelo
benefício positivo de retail, trade-in e financiamento válidos. Componentes individuais positivos
permanecem autoritativos. IPVA, seguro, wallbox, emplacamento, manutenção, voucher e `other` nunca
participam.

O relatório `dealer-rebate-allocation-analysis.csv` registra base, percentual, valor final, método,
resíduo, classificação e reconciliação por policy. Sem base elegível, a offer recebe
`UNALLOCATED_LEGACY_DEALER_REBATE`; o total permanece auditável, sem policy genérica.
O rateio final usa centavos inteiros e maiores restos, com desempate estável. Rebate ausente gera
`dealer_rebate_amount=NULL` e `dealer_rebate_allocation_method=NULL`; zero não representa ausência.

Os tipos `free_wallbox`, `free_registration`, `free_maintenance` e
`fuel_or_recharge_voucher` são reconhecidos para futuros cadastros, mas jamais inferidos do legado.
Wallbox usa BRL 4.000,00 por default, emplacamento usa 1% do MSRP, manutenção é `non_monetized` e
voucher usa valor nominal. O contrato completo está em `PRICING_POLICY_MODEL.md`.

## Execução

Da raiz do monorepo:

```powershell
$env:DATABASE_URL = '<URL PostgreSQL explícita da stack Supabase local>'
pnpm pricing:dry-run -- `
  --output-dir .local-reports/pricing `
  --algorithm-version 3.0.0 `
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
- `--insurance-percentage <decimal>`: opção de compatibilidade; somente `3` é aceito, pois a regra
  aprovada é fixa em 3% por ano;
- `--exclude-executed-at-from-hash`: exclui o instante do hash comparável;
- `--expected-local-port`: porta esperada da stack, com default 54322;
- `--fixture`: executa o mesmo algoritmo sobre uma fotografia JSON local, sem conexão de banco.

## Exportação do snapshot legado

`scripts/pricing/export-pricing-legacy-snapshot.ps1` é o procedimento oficial e reproduzível para
exportar somente as sete tabelas legadas autorizadas. Esta é a única automação de snapshot que pode
receber uma origem remota. Ela não restaura dados, não executa o pricing dry-run e não altera schema
ou conteúdo do banco.

Pré-requisitos:

- PowerShell 5.1 ou posterior;
- `psql`, `pg_dump` e `pg_restore` locais, ou Docker disponível; o fallback de exportação executa
  `psql`/`pg_dump` com a imagem configurável `postgres:17`;
- usuário PostgreSQL remoto temporário e somente leitura;
- host remoto conhecido, preferencialmente restringido com `-AllowRemoteHost`;
- diretório de saída local não simbólico. O default `.local-snapshots/pricing` é ignorado pelo Git.

Exemplo oficial, sem connection string real:

```powershell
$env:LEGACY_DATABASE_URL = "<connection-string>"

.\scripts\pricing\export-pricing-legacy-snapshot.ps1 `
  -DatabaseUrl $env:LEGACY_DATABASE_URL `
  -OutputDirectory ".local-snapshots\pricing" `
  -AllowRemoteHost "aws-1-us-west-2.pooler.supabase.com" `
  -ConfirmRemoteExport

Remove-Item Env:LEGACY_DATABASE_URL
```

O script mostra somente host, porta, database, user, destino e as tabelas previstas. A URL nunca é
repassada aos processos filhos: host, porta, database e user seguem como argumentos separados; a
senha permanece temporariamente em `PGPASSWORD`. O preflight abre uma transação `READ ONLY` e exige
`transaction_read_only = on`. O `pg_dump` também recebe
`PGOPTIONS=-c default_transaction_read_only=on`; ainda assim, a garantia administrativa principal
continua sendo usar uma role remota sem privilégios de escrita.

O dump usa formato custom, `data-only`, sem owner, ACL ou blobs, uma opção `--table` para cada item
da allowlist e `--exclude-table-data=public.*_seq`. Ele é criado com nome temporário, inspecionado
por `pg_restore --list`, recusado se houver `SEQUENCE SET`, hasheado em SHA-256 e submetido ao
`validate-pricing-legacy-snapshot.ps1`. Somente depois dessas etapas o snapshot e seu manifesto são
publicados. Um arquivo existente bloqueia a operação; `-Force` autoriza substituição apenas após a
nova versão ser validada.

O manifesto derivado, por exemplo `legacy-pricing.manifest.json`, preserva o contrato de validação
(`fileName`, `sizeBytes`, `sha256`, `format`, `tables` e `status`) e acrescenta `exportedAtUtc`, origem
sanitizada e modo de `pg_dump`. Senha, connection string, `PGPASSWORD`, tokens e query parameters
nunca são incluídos.

### Usuário remoto somente leitura

Criação genérica, a ser executada explicitamente por um administrador autorizado:

```sql
CREATE ROLE pricing_snapshot_reader
WITH
  LOGIN
  PASSWORD '<TEMPORARY_STRONG_PASSWORD>'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION;

GRANT CONNECT ON DATABASE postgres TO pricing_snapshot_reader;
GRANT USAGE ON SCHEMA public TO pricing_snapshot_reader;
GRANT SELECT ON TABLE
  public.products,
  public.product_price_offers,
  public.price_offer_imports,
  public.price_offer_import_rows,
  public.price_offers_staging,
  public.product_specs,
  public.specs
TO pricing_snapshot_reader;
```

Se uma ferramenta externa ainda exigir leitura de sequences, o administrador pode conceder
temporariamente `GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO pricing_snapshot_reader;`. O
fluxo oficial não depende de `SEQUENCE SET` e o recusa no artefato final.

Após confirmar exportação e validação, a remoção da role permanece deliberadamente manual:

```sql
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM pricing_snapshot_reader;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM pricing_snapshot_reader;
REVOKE USAGE ON SCHEMA public FROM pricing_snapshot_reader;
REVOKE CONNECT ON DATABASE postgres FROM pricing_snapshot_reader;
DROP ROLE pricing_snapshot_reader;
```

O exportador não cria, concede privilégios, revoga nem remove essa role.

### Troubleshooting da exportação

- `Network is unreachable` na conexão direta: usar o Session Pooler, normalmente na porta 5432. O
  usuário do Pooler pode diferir de `current_user`; o preflight confirma database e modo read-only.
- `permission denied for sequence equipments_id_seq`: conceder SELECT temporário nas sequences
  somente se necessário ou regenerar sem sequence data. O fluxo oficial exclui e recusa
  `SEQUENCE SET`.
- validador rejeita sequence inesperada: não ampliar automaticamente a allowlist; corrigir a origem
  e regenerar o snapshot.
- arquivo já existe: revisar o anterior e usar `-Force` conscientemente.
- hash divergente: não restaurar; regenerar ou investigar qualquer alteração do arquivo.

### Snapshot real validado em 2026-07-26

O procedimento manual que originou esta automação produziu `legacy-pricing.dump`, custom data-only,
com 262858 bytes e SHA-256
`ad982044e1c93dc98e47f180a128d6d7d088fa4ecb0a8c05d88ddd6c6cc0648c`. O TOC validado contém
`public.price_offer_import_rows`, `public.price_offer_imports`, `public.price_offers_staging`,
`public.product_price_offers`, `public.product_specs`, `public.products` e `public.specs`, com status
`VALIDATED`. Essa evidência não significa que houve restore, dry-run real ou alteração do banco
local.

## Fotografia autorizada na stack local

Os scripts em `scripts/pricing` preparam o caminho operacional entre um dump previamente autorizado
e o dry-run. Eles não obtêm dumps, não acessam origem remota, não executam migration e não fazem
backfill. O operador deve começar com uma stack local descartável, criada pelas migrations atuais e
com as sete tabelas legadas abaixo vazias.

Pré-requisitos:

- PowerShell 5.1 ou posterior;
- clientes PostgreSQL `psql` e `pg_restore` compatíveis com o dump **ou** Docker com o container
  PostgreSQL local em execução e `healthy`;
- `pnpm` e dependências do monorepo instaladas;
- Supabase local na porta explícita esperada, por padrão `54322`;
- dump data-only autorizado e seu SHA-256 recebido por canal separado.

Não é mais obrigatório instalar PostgreSQL Client Tools no Windows. Os scripts priorizam
automaticamente `psql` e `pg_restore` encontrados localmente. O fallback de `pg_restore` usa
`docker run postgres:17`, monta o diretório autorizado em `/snapshots:ro` e passa o dump custom como
arquivo posicional; `--dbname` é obrigatório e `--file` é recusado. O container PostgreSQL esperado
continua sendo `supabase_db_compra-car`, configurável por `-PostgresContainer`. O preflight recusa
container inexistente, parado ou sem health, valida o binding lógico da porta e compara exatamente o
IP respondente com os IPs atuais das redes Docker. Nenhum arquivo é copiado e nenhum pacote é
instalado.

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
$snapshot = '.local-snapshots/pricing/legacy-pricing.dump'
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
$expectedRowCounts = @{
  products = 292
  product_price_offers = 746
  price_offer_imports = 10
  price_offer_import_rows = 173
  price_offers_staging = 746
  product_specs = 37540
  specs = 320
}

./scripts/pricing/run-pricing-snapshot-validation.ps1 `
  -SnapshotPath $snapshot `
  -AllowedSnapshotDirectory '.local-snapshots/pricing' `
  -ExpectedSha256 $sha256 `
  -DatabaseUrl $localDatabaseUrl `
  -ExpectedRowCounts $expectedRowCounts `
  -CutoffDate '2026-07-25' `
  -AlgorithmVersion '3.0.0' `
  -OutputDirectory '.local-reports/pricing-snapshots/authorized-run' `
  -PostgresContainer 'supabase_db_compra-car' `
  -ConfirmLocalRestore
```

O fluxo valida novamente o dump e o destino, exige que todas as tabelas de destino estejam vazias,
restaura somente dados em uma transação e confere as sete contagens explícitas antes de declarar
sucesso. Depois, roda `pnpm pricing:dry-run` com cutoff, versão,
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
prioridade dos clientes locais, fallback Docker, container ausente/unhealthy, Docker ausente,
execução real do algoritmo sobre fixture e contrato do manifesto sanitizado. Ela não conecta a
banco.

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

### Regras da versão 3.0.0

- `retail_rebate`, `trade_in_rebate` e `rate_rebate` alimentam `dealer_rebate_amount` respectivamente
  em `retail_bonus`, `trade_in_bonus` e `subsidized_financing`. O total legado é somente reconciliado;
  rebate não aumenta nem reduz o benefício bruto do cliente.
- IPVA usa o mês de `offer_month`: `public_price × 0.04 × (13 - mês) / 12`, com HALF_UP em duas
  casas. Preço ausente/não positivo ou mês inválido recebe issue específica.
- duas ou mais políticas da mesma oferta formam um grupo provisório `OR`,
  `relation_origin=legacy_default`, em draft. A reconciliação usa o maior benefício alternativo; a
  soma fica apenas como diagnóstico.
- o CDI provisório auditável é 14,78% efetivos ao ano. A taxa mensal é
  `power(1 + 0.1478, 1/12) - 1`, nunca divisão simples por 12.
- a referência financeira soma ao CDI mensal o spread mensal de `0.003`. O método oficial é
  `discounted_promotional_cash_flow_difference`: valor presente do fluxo de referência menos valor
  presente das parcelas promocionais, ambos descontados pela taxa combinada. O relatório também
  apresenta, sem substituir a regra oficial, pagamentos constantes e
  `reference_total_paid - promotional_total_paid` para comparação metodológica.
- seguro usa `insurance_years × 0.03 × MSRP`. `0/0/0` e `NULL/NULL/NULL` significam ausência de
  financiamento; zero continua válido em taxa ou entrada quando parcelas forem positivas.

Os hashes da versão 3.0.0 incorporam offers, vínculos de preço, a nova detecção financeira e
relatórios adicionais; não são diretamente comparáveis aos hashes 1.0.0 ou 2.0.0.

### Contrato previsto para futura importação Excel

O importador ainda não foi implementado. O contrato futuro separa:

- **OFFERS:** `source_offer_key`, referência do produto, mês da campanha, `valid_from`, `valid_to`,
  `public_price` e observações;
- **POLICIES:** uma linha por `source_offer_key` e política, com `policy_type`,
  `customer_benefit_amount`, `dealer_rebate_amount`, `subsidized_rate_monthly`,
  `down_payment_percent`, `installments`, `insurance_years`, `ipva_rate`, `calculation_method`,
  `relation_group`, `relation_type` e observações.

No contrato, vazio significa `NULL` e zero significa valor informado. Rebate não é benefício do
cliente; totais agregados não viram políticas; relações podem ser OR/AND; IPVA proporcional e CDI
versionado permanecem regras externas rastreáveis.

## Relatórios

Cada execução gera:

1. `summary.json`;
2. `source-inventory.csv`;
3. `commercial-offers.csv` e `offer-policy-summary.csv`;
4. `product-public-prices.csv`, `public-price-candidates.csv` e `public-price-conflicts.csv`;
5. `commercial-policies.csv` e `policy-candidates.csv`;
6. `commercial-policy-accumulators.csv` e `accumulator-candidates.csv`;
7. `needs-review.csv`, `informational-issues.csv`, `issue-impact.csv` e
   `source-issue-groups.csv`;
8. `reconciliation.csv`;
9. `dealer-rebate-allocation-analysis.csv`, `rebate-reconciliation-analysis.csv` e o resumo JSON;
10. `financing-analysis.csv`, `financing-benefit-comparison.csv` e o resumo de completude;
11. `validation-samples.csv` e `validation-samples-summary.json`;
12. `view-coverage.csv`;
13. `README.md`.

JSON usa chaves canônicas para hash. CSV possui colunas fixas, escaping RFC 4180 básico e ordem
estável. Sobre a mesma fotografia e opções, o conteúdo de dados é repetível; apenas `executedAt` e o
nome do diretório variam. O hash pode ignorar `executedAt`.

`summary.json` preserva as contagens anteriores e acrescenta nomes sem ambiguidade:
`needs_review_issue_occurrences`, `needs_review_unique_entities` e
`needs_review_unique_offers`. `issue-impact.csv` separa, por issue code, ocorrências, offers,
policies, prices, sources e entidades bloqueadas. `source-issue-groups.csv` evidencia coocorrências
na mesma origem sem fundir causas como preço zero e IPVA não calculável.

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
- financiamento realmente incompleto ou sem parameter set publicado;
- percentual de seguro não aprovado e IPVA com preço/mês inválido;
- descrição obrigatória ausente;
- divergência entre rebates estruturados e `total_dealer_rebate`;
- grupos OR permanecem em draft até validação administrativa, mas a ausência de relação no legado
  não gera sozinha `AMBIGUOUS_AND_OR_RELATION`;
- divergências de reconciliação sem explicação;
- qualquer candidato `needs_review` sem decisão humana.
