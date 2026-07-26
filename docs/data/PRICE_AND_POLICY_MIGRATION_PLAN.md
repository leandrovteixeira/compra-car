# Plano de migração de preços e políticas comerciais

> **Atualização de 2026-07-26:** a etapa corrente introduz `commercial_offer` como agregado pai e
> mantém `commercial_policy_applications` somente para compatibilidade histórica. Novos registros
> usam os tipos e métodos de `PRICING_POLICY_MODEL.md`; `registration` e `present_value_subsidy` são
> deprecated. Backfill continua uma etapa separada e não foi executado.

## 1. Objetivo e princípios

Migrar do modelo misto legado para o schema do ADR-011 sem apagar origem, sem reclassificação
silenciosa e sem interromper consumidores existentes.

Princípios:

- migrations incrementais, forward-only e pequenas;
- schema antes de dados; backfill antes de troca de leitura;
- toda transformação é idempotente e rastreável;
- dados ambíguos terminam em `needs_review`, nunca em `published`;
- IA/API nunca publica;
- contagens, somas e amostras são reconciliadas antes e depois;
- `vw_product_value_current` permanece intacta até homologação explícita;
- nenhum objeto legado é removido na primeira fase;
- correções usam nova migration, nunca edição de baseline ou `migration repair`.

## 2. Fotografia de origem

Base da investigação de 2026-07-25:

- 292 produtos;
- 746 `product_price_offers` para 287 produtos;
- 745 `public_price` positivos, um zero, nenhum nulo/negativo;
- 11 `offer_month`, entre 2025-06 e 2026-04;
- duplicidades produto/mês para produtos 12 e 13 em 2025-06;
- 714 linhas com algum componente de política pela heurística do inventário;
- 10 `price_offer_imports`, todos pending;
- 173 `price_offer_import_rows`, todos pending e sem produto resolvido;
- 746 linhas textuais em `price_offers_staging`;
- todas as ofertas finais compartilham o mesmo `created_at`.

As contagens devem ser coletadas novamente imediatamente antes do backfill. Mudança entre a data
de corte e a execução exige nova reconciliação e aprovação.

### 2.1 Snapshot real autorizado

Em 2026-07-26, o snapshot real `legacy-pricing.dump` foi exportado manualmente e validado como
`postgres-custom`, data-only, com 262858 bytes, sete tabelas autorizadas e SHA-256
`ad982044e1c93dc98e47f180a128d6d7d088fa4ecb0a8c05d88ddd6c6cc0648c`. O hash foi confirmado e o
status é `VALIDATED`. Nenhum restore, pricing dry-run real ou alteração do banco local ocorreu.

A reprodução oficial passa a ser feita por
`scripts/pricing/export-pricing-legacy-snapshot.ps1`, com origem remota somente leitura, allowlist
opcional de host, dump temporário sem `SEQUENCE SET`, validação pelo script existente e manifesto
sanitizado antes da publicação final.

## 3. Mapa origem -> destino

| Origem atual | Destino alvo | Estratégia |
| --- | --- | --- |
| `products` | permanece `products` | Nenhuma cópia; novas FKs apontam para IDs existentes. |
| `product_price_offers.public_price` | `product_public_prices` | Um candidato por produto/data; positivos podem virar draft; zero sempre needs_review. |
| Componentes de `product_price_offers` | `commercial_policies` + `commercial_policy_applications` | Cada benefício classificável vira política independente; valor explícito vai para `input_monetary_value` e valor final para `monetary_value`. |
| Combinação de componentes na mesma linha | acumuladores | Nunca inferida automaticamente; candidato needs_review até confirmar E/OU. |
| `product_price_offers.total_customer_benefit` | reconciliação/snapshot | Não cria política; compara soma calculada com total legado. |
| `product_price_offers.total_dealer_rebate` | snapshot/needs_review | Não é benefício de cliente confirmado; não cria tipo automaticamente. |
| `product_price_offers.notes` | descrição/evidência de revisão | Texto preservado no import row; palavras como OR forçam needs_review. |
| `price_offer_imports` | `pricing_import_batches` | Um lote por registro, com `legacy_import_id` e origem legacy_backfill. |
| `price_offer_import_rows` | `pricing_import_rows` | Uma linha por ID legado; inicialmente unmatched/needs_review quando produto nulo. |
| `price_offers_staging` | `pricing_import_rows.raw_payload` | Carga de evidência sem ID próprio; usar número de linha determinístico + hash e deduplicar contra final. |
| `vw_product_value_current` | permanece; futura `vw_product_value_current_v2` | Execução paralela e homologação antes de qualquer redirecionamento. |
| `vw_product_value_by_category` | permanece | Não é migrada; pode compor a view v2. |
| `duplicate_product_model_year` | legado preservado, depois desativado | Não deve copiar dados novos; consumidor externo precisa ser confirmado. |

O nome físico confirmado é `price_offer_import_rows` (singular `offer`), apesar de referências
textuais históricas a `price_offers_import_rows`.

## 4. Classificação de registros

### 4.1 Estados de classificação

- `auto_classifiable`: regra inequívoca e campos mínimos completos;
- `classifiable_with_reconciliation`: pode gerar draft, mas exige comparação com total/origem;
- `needs_review`: ambiguidade, dado inválido, campos insuficientes ou condição E/OU;
- `rejected`: revisão humana concluiu que não deve ser migrado;
- `source_only`: preservado como evidência, sem entidade de domínio.

Mesmo `auto_classifiable` entra como `draft`; publicação continua humana.

### 4.2 Preço público

| Condição | Classificação | Ação |
| --- | --- | --- |
| `public_price > 0`, único por produto/data | auto_classifiable | Criar draft com `starts_on = offer_month`. |
| Duplicado produto/data com mesmo valor | classifiable_with_reconciliation | Criar um preço e ligar todas as origens ao mesmo destino. |
| Duplicado produto/data com valores diferentes | needs_review | Não escolher maior, menor ou mais recente automaticamente. |
| `public_price = 0` | needs_review | Preservar zero em draft/needs_review; publicação bloqueada. |
| `public_price IS NULL` | source_only/needs_review | Não converter para zero. |
| `public_price < 0` | needs_review | Publicação bloqueada. |

O backfill não deriva `ends_on`; a view de períodos calcula o fim pelo próximo `starts_on` publicado.
Ausência de preço vigente é ausência de registro published. Zero não é convertido em ausência nem
descartado; permanece rastreável em draft/needs_review.

### 4.3 Componentes de política

| Evidência legada | Tipo alvo | Regra inicial |
| --- | --- | --- |
| `retail_bonus > 0` | `retail_bonus` | método fixed; input e valor final recebem o bônus explícito. |
| `trade_in_bonus > 0` | `trade_in_bonus` | método fixed; input e valor final recebem o bônus explícito. |
| taxa + entrada + parcelas completas | `subsidized_financing` | input monetário nulo; calcular valor final somente com parameter set publicado. |
| `insurance_years > 0` | `free_insurance` | input monetário nulo; calcular 3% do MSRP por ano; divergência vai para revisão. |
| `ipva_included = true` | `free_ipva` | input monetário nulo; sempre needs_review no primeiro backfill devido aos 714 true observados. |
| `others_bonus > 0` | `other` | input e valor final recebem estimativa manual; descrição obrigatória. |
| evidência de wallbox | `free_wallbox` | input e valor final usam premissa confirmada; R$ 4.000 é somente sugestão inicial. |
| evidência de emplacamento | `registration` | input monetário nulo; percentual explícito/revisado calcula o valor final. |
| rebates de varejo/troca/taxa | sem tipo direto aprovado | needs_review; não converter para bônus. |
| `total_dealer_rebate` | sem tipo de benefício ao cliente | source_only/needs_review. |
| total armazenado | nenhum | usado apenas na reconciliação. |

Sem parameter set aprovado, o backfill pode criar o cabeçalho de financiamento em draft ou
needs_review e preservar seus campos normalizados, mas não cria a aplicação enquanto não puder
calcular seu `monetary_value` obrigatório. A FK do preço-base será resolvida pelo serviço quando
houver cálculo, pois MSRP é entrada da fórmula embora não seja campo livre do formulário.

### 4.4 Combinações e acumuladores

Uma linha legada com mais de um componente não prova que os benefícios acumulam. Procedimento:

1. criar, quando possível, políticas draft independentes;
2. marcar a linha como needs_review para relação E/OU;
3. se a carta confirmar soma cumulativa, criar acumulador draft com as políticas;
4. se a carta indicar alternativa, não criar acumulador;
5. texto com `OR`, `OU`, barra ou condição mutuamente exclusiva nunca gera acumulador automático;
6. acumulador só é publicado após validar interseção de escopo e vigência.

As duplicidades 12/37 e 13/38 devem compartilhar o mesmo preço público e permanecer separadas como
evidências de política até revisão.

## 5. Preparação do backfill

### 5.1 Dry-run legado implementado

O pacote local `@compra-car/pricing-dry-run` implementa o gate não persistente anterior às migrations
de backfill. Ele exige uma URL PostgreSQL da stack local, abre transação `REPEATABLE READ READ ONLY`,
classifica em memória e grava dez relatórios determinísticos. Hosts remotos são recusados e não há
flag de liberação nesta versão.

A baseline desta seção é somente comparativa: diferenças são registradas em `summary.json`, e
`--fail-on-source-change` encerra com código 2 depois de preservar os relatórios. Decimal monetário
usa precisão arbitrária; fingerprints e hashes partem de JSON canônico. O algoritmo nunca escolhe
vencedor para preço conflitante, converte rebate em benefício ou marca acumulador como publicável.

A fixture determinística e o banco local vazio foram executados em 2026-07-25. A fixture exercitou
as anomalias mínimas e gerou revisão humana; a stack recriada sem seed confirmou todas as contagens
locais em zero e, portanto, divergência integral da baseline. A fotografia real ainda deve ser
executada somente quando houver fonte local autorizada. Detalhes em
`docs/data/PRICING_LEGACY_DRY_RUN.md`.

### 5.2 Preparação da fotografia local autorizada

`scripts/pricing` implementa o gate operacional anterior ao dry-run real, sem criar uma etapa de
backfill. O pipeline recebe um dump data-only e SHA-256 previamente autorizados, valida formato e
allowlist, recusa conteúdo destrutivo e restaura somente as sete origens necessárias em uma stack
local vazia. O alvo é fail-closed para qualquer host fora de `localhost`, `127.0.0.1` e `::1` ou porta
diferente da local configurada.

Após restauração local bem-sucedida, o orquestrador executa obrigatoriamente o dry-run com versão do
algoritmo, cutoff, hash sem `executedAt` e saída verbosa, gerando um manifesto sanitizado. Dump,
relatórios e manifesto são artefatos locais não versionáveis. A infraestrutura não coleta a
fotografia, não acessa banco remoto, não altera schema, não executa migration e não promove qualquer
candidato. Uma falha exige descartar/recriar a stack antes de repetir; não existe limpeza automática
das tabelas.

Antes de qualquer DML futuro:

1. congelar uma fotografia de contagens e hashes lógicos, sem bloquear o legado ainda;
2. inventariar novamente consumidores de tabelas, view e função de duplicação;
3. confirmar o projeto/ambiente Supabase e backup recuperável;
4. validar migrations estruturais em banco descartável/local;
5. confirmar que a estrutura aceita parameter sets manuais versionados, sem definir CDI/spread real;
6. fechar a regra operacional de correção de preço publicado; zero já permanece needs_review;
7. validar SHA/allowlist e restaurar uma fotografia autorizada exclusivamente na stack local vazia;
8. gerar relatório dry-run sem persistência e manifesto sanitizado;
9. revisar amostras de cada classe e todos os casos needs_review esperados;
10. obter aprovação para a migration de dados separada.

## 6. Estratégia de backfill

### 6.1 Lote técnico

Criar um `pricing_import_batch` com `source_type = legacy_backfill` e chave idempotente contendo a
versão do algoritmo e a data de corte. Cada linha de origem ganha um `pricing_import_row` com:

- tabela e ID legados;
- payload bruto sanitizado;
- payload normalizado;
- produto resolvido;
- issue codes;
- classificação e versão da regra.

`UNIQUE(legacy_source_table, legacy_source_id)` impede duplicação em reexecução.

### 6.2 Ordem

1. importar metadados dos lotes/linhas atuais;
2. registrar `price_offers_staging` como evidência, sem promover;
3. registrar as 746 linhas finais legadas como import rows de backfill;
4. deduplicar candidatos de preço por produto/starts_on;
5. criar preços draft/needs_review;
6. criar políticas e aplicações draft;
7. preencher `input_monetary_value`, calcular `monetary_value` e gerar snapshots conforme o tipo;
8. registrar candidatos de acumulador apenas após revisão E/OU;
9. vincular outputs às linhas de origem;
10. reconciliar antes de qualquer publicação.

### 6.3 Idempotência

- nenhuma inserção depende de sequence/id conhecido previamente;
- chaves de origem e chaves lógicas localizam registros já migrados;
- reexecução não altera registro published;
- mudança de algoritmo usa novo batch/version e não sobrescreve o anterior;
- falha parcial mantém batch em failed/needs_review e pode ser retomada por linha;
- promoção de um lote é transacional por unidade revisável, não um update global sem checkpoints.

## 7. Tratamento de duplicidades

### Preço

- mesmo produto/data/valor: uma entidade, múltiplos links de origem;
- mesmo produto/data/valores distintos: needs_review;
- unique final impede corrida entre workers;
- nunca usar `created_at`, pois todas as ofertas atuais empatam.

### Política

Uma política é duplicada somente se tipo, condições, período, aplicações e snapshots equivalentes
forem iguais. Igualdade de título ou valor isolado não basta. O dry-run calcula fingerprint de
conteúdo para sugerir duplicidade, mas a constraint definitiva permanece na identidade aprovada,
não em texto comercial instável.

### Acumulador

O conjunto ordenado de `policy_id` produz `combination_fingerprint`. A ordem visual não altera a
identidade. Unique constraint impede duas combinações do mesmo conjunto, independentemente do
título.

## 8. `needs_review`

Issue codes mínimos:

- `ZERO_PUBLIC_PRICE`;
- `CONFLICTING_PUBLIC_PRICE`;
- `MISSING_PRODUCT_MATCH`;
- `AMBIGUOUS_POLICY_TYPE`;
- `MISSING_POLICY_DESCRIPTION`;
- `MISSING_INPUT_MONETARY_VALUE`;
- `UNEXPECTED_INPUT_MONETARY_VALUE`;
- `INPUT_ECONOMIC_VALUE_MISMATCH`;
- `INCOMPLETE_FINANCING_TERMS`;
- `UNPUBLISHED_FINANCIAL_PARAMETER_SET`;
- `AMBIGUOUS_AND_OR_RELATION`;
- `LEGACY_TOTAL_MISMATCH`;
- `NEGATIVE_ECONOMIC_VALUE`;
- `SUSPICIOUS_IPVA_FLAG`;
- `UNSUPPORTED_REBATE_FIELD`;
- `INVALID_OR_MISSING_VALIDITY`.

Revisão deve registrar ator, decisão, notas e snapshot. Resolver um issue não apaga a evidência
original. Linhas sem produto não podem produzir preço/política. Rejeição não remove a linha.

## 9. Reconciliação

### 9.1 Contagens

Relatório obrigatório por batch:

```text
origens = source_only + rejected + needs_review + promoted/linked
```

Contar:

- linhas por tabela de origem;
- produtos e meses distintos;
- candidatos/destinos de preço;
- políticas por tipo;
- aplicações por produto;
- candidatos/acumuladores aprovados;
- linhas por issue code/status;
- origens sem output e outputs sem origem.

### 9.2 Valores

Para cada produto/data:

- comparar `public_price` legado com `product_public_prices.amount`;
- comparar cada valor explícito legado com `input_monetary_value`;
- comparar input, fórmula e `monetary_value` congelado de cada aplicação;
- comparar soma de componentes permitidos com `total_customer_benefit` legado;
- registrar diferença absoluta e percentual;
- não forçar igualdade quando o legado inclui benefício não monetário, rebate interno ou relação OU.

Totais de reconciliação usam `numeric`, nunca floating point.

### 9.3 Vigência e views

- verificar no máximo um preço publicado por produto/data;
- confirmar períodos derivados sem sobreposição;
- comparar `vw_product_value_current` e `vw_product_value_current_v2` para os 41 consumidores atuais;
- explicar toda divergência por produto;
- verificar preços futuros e ausência de preço vigente na data da homologação.

### 9.4 Integridade

- zero órfãos em FKs;
- zero registros published sem ator/snapshot;
- zero policies published sem aplicação;
- zero aplicações published com combinação inválida de input/método/tipo;
- zero financiamentos published sem parameter set published;
- zero accumulators published com menos de dois membros ou sem valores;
- zero combinação duplicada;
- zero saída de import sem linha de origem.

## 10. Compatibilidade e rollout

### Fase paralela

- legado continua sendo fonte do Appsmith;
- MVP-a novo lê inicialmente o modelo alvo em modo read-only;
- view v2 é consultada apenas em testes/homologação;
- dual-write é evitado: enquanto a escrita nova não for autorizada, o legado permanece somente como
  origem histórica; quando a escrita nova iniciar, não se grava automaticamente no legado.

### Troca controlada

1. bloquear novas escritas legadas por processo/aplicação, não por remoção imediata de grant;
2. executar backfill delta desde a fotografia inicial;
3. reconciliar novamente;
4. habilitar leitura do MVP-a no modelo novo;
5. homologar comparador administrativo;
6. decidir se MVP-u receberá preços/políticas;
7. apenas se necessário, redirecionar a view de compatibilidade preservando assinatura.

Não se recomenda trigger de dual-write entre modelos semanticamente diferentes.

## 11. Desativação e remoção futura

### Desativação

Depois da homologação:

- revogar escrita legada dos clients identificados;
- marcar importadores legados como desativados;
- impedir uso de `duplicate_product_model_year` para copiar ofertas;
- manter leitura para auditoria por janela aprovada;
- monitorar acessos/erros antes de remover grants ou views.

### Remoção

Exige sprint e autorização explícitas, backup testado e evidência de zero consumidores. Ordem futura:

1. remover/redirecionar consumers;
2. revogar grants legados;
3. remover funções que escrevem/copiam ofertas;
4. arquivar/remover views legadas;
5. somente depois avaliar remoção de staging/import/final legado.

Nenhuma tabela de `Legacy` ou do banco atual é removida nas migrations iniciais.

## 12. Plano em migrations separadas

Nomes são propostos; timestamps serão definidos apenas na implementação.

1. **`create_pricing_types_and_core_tables`**
   - status: criada em `20260725172755_create_pricing_types_and_core_tables.sql` e validada apenas
     na stack local em 2026-07-25;
   - atenção operacional: os default privileges da baseline concedem ACLs amplas aos objetos novos;
     esta migration não pode ser aplicada isoladamente em ambiente compartilhado antes da etapa
     `secure_pricing_core_schema` com RLS e revokes explícitos;
   - enums fixos do MVP, preços, parâmetros, políticas, aplicações com input/valor final,
     acumuladores e itens/valores;
   - constraints e índices locais;
   - colunas `source_import_row_id` nascem sem FK porque a tabela de import ainda não existe;
   - sem dados.
2. **`secure_pricing_core_schema`**
   - status: criada em `20260725175159_secure_pricing_core_schema.sql` e validada apenas na stack
     local em 2026-07-25;
   - habilita RLS nas sete tabelas core, remove as ACLs herdadas de `public`, `anon` e
     `authenticated` e concede ao `service_role` somente SELECT/INSERT/UPDATE nas tabelas e
     USAGE/SELECT nas seis sequences identity;
   - não cria policies e não altera default privileges globais, owners ou objetos legados.
3. **`create_pricing_import_and_audit_tables`**
   - status: criada em `20260725180750_create_pricing_import_and_audit_tables.sql` e validada
     apenas na stack local em 2026-07-25;
   - batches, rows, outputs, reviews, audit;
   - constraints/índices;
   - adiciona as FKs diferidas dos objetos core para `pricing_import_rows`;
   - RLS e ACLs mínimas aplicadas no mesmo arquivo, neutralizando os default privileges herdados sem
     alterar defaults globais;
   - sem backfill, policies, funções, triggers, views ou dados.
4. **`create_pricing_lifecycle_and_audit_triggers`**
   - status: criada em `20260725182545_create_pricing_lifecycle_and_audit_triggers.sql` e validada
     apenas na stack local em 2026-07-25;
   - mantém `updated_at` e incrementa `lock_version` exatamente uma vez nas sete tabelas que possuem
     ambas as colunas;
   - torna `pricing_audit_events` append-only inclusive para o owner via DML;
   - impede regressão de estado terminal ou delete de registros publicados, arquivados ou promovidos
     e congela a identidade
     econômica/material de preços, parâmetros, políticas, aplicações, acumuladores e imports em
     estado terminal;
   - usa somente funções `SECURITY INVOKER`, `search_path = ''` e `EXECUTE` revogado de browser e
     `service_role`; a execução indireta pelos triggers permanece funcional;
   - não cria writer genérico de auditoria, funções de publicação, cálculos, views, policies ou DML.
5. **`create_pricing_validation_and_publication_functions`**
   - status: criada em `20260725184656_create_pricing_validation_and_publication_functions.sql` e
     validada apenas na stack local em 2026-07-25;
   - quatro funções transacionais publicam preço, parâmetros financeiros, política e acumulador com
     ator admin/active confirmado em `profiles`, lock otimista e auditoria atômica;
   - valida os oito tipos, snapshots v1 e cálculos `numeric`, incluindo HALF_UP e intermediários do
     financiamento; materializa somente a interseção de produtos dos acumuladores;
   - publicação direta pelo `service_role` é bloqueada por trigger, sem variável de sessão; somente
     as quatro funções `SECURITY DEFINER` possuem `EXECUTE` para essa role;
   - rows de batches promovidos/arquivados, outputs promovidos e reviews históricas passam a ser
     imutáveis; nova review após promoção também é bloqueada;
   - sem views, backfill, seed financeiro real, policies de browser ou promoção automática.
6. **`create_pricing_read_views`**
   - status: criada em `20260725191747_create_pricing_read_views.sql` e validada apenas na stack
     local em 2026-07-25;
   - cria períodos históricos determinísticos, preço vigente, aplicações de políticas publicadas,
     valores materializados de acumuladores e a candidata de compatibilidade v2;
   - todas as views são `security_invoker`, owner `postgres`, sem ACL de browser e com somente SELECT
     para `service_role`;
   - a v2 preserva as oito colunas/tipos da view legada, troca somente a origem do preço e mantém o
     cálculo legado de valor percebido porque não existe equivalente seguro no modelo novo;
   - não troca consumidores, não altera a view legada e não executa backfill.

O **pricing legacy dry-run** ocorre entre os itens 6 e 7, mas não é migration. Ele não cria batch,
não grava outputs e não altera o versionamento do banco. Seus relatórios são gate de revisão para as
migrations 7 e 8.

7. **`backfill_pricing_import_metadata`**
   - metadados atuais de imports/rows/staging;
   - idempotente e sem publicação.
8. **`backfill_legacy_product_price_offers`**
   - import rows, preços/políticas draft ou needs_review;
   - separada do schema e com relatório pré/pós.
9. **`publish_reviewed_pricing_backfill`**
   - somente IDs aprovados, com snapshots e atores definidos;
   - pode ser dividida por lote/marca para reduzir blast radius.
10. **`harden_legacy_pricing_writes`**
   - somente após migração de consumidores; revokes/controlos compatíveis.
11. **`switch_legacy_price_view`** — opcional
    - somente após homologação e decisão de compatibilidade.
12. **`retire_legacy_pricing_objects`** — sprint futura
    - exige autorização destrutiva específica; não faz parte da primeira implementação.

Cada migration deve possuir validação forward e plano de correção incremental. Não editar a
baseline, não usar `db push` sem revisão e não usar `migration repair` como atalho.

Enquanto os default privileges da baseline permanecerem globais, toda migration que criar tabela,
sequence ou função no schema `public` deve neutralizar explicitamente as ACLs herdadas para seus
próprios objetos. Não alterar os defaults globais evita impacto não auditado sobre outros domínios.

## 13. Rollback operacional

Como o plano é forward-only:

- antes da troca de leitura, rollback é deixar o novo modelo sem consumidor;
- falha de backfill é corrigida por novo batch/migration, preservando origem;
- falha da view v2 não afeta a view antiga;
- após troca, feature flag/read path volta ao legado enquanto os dados novos permanecem auditáveis;
- revogação legada só ocorre depois que o caminho de retorno foi testado;
- drop de objetos não integra a janela inicial.

## 14. Subtarefas propostas para a Sprint 9

1. **S9-A — Gate financeiro:** definir CDI/spread e governança antes de publicar financiamento; não
   bloquear as migrations estruturais.
2. **S9-B — Contratos de domínio:** money, price period, policy, application, accumulator e statuses.
3. **S9-C — Migrations estruturais:** core tables, imports, auditoria, índices e checks.
4. **S9-D — Segurança:** RLS, grants, functions transacionais e testes de negação.
5. **S9-E — Cálculos:** regras puras versionadas e snapshots, incluindo valor presente.
6. **S9-F — Dry-run/backfill:** classificador, fingerprints, relatório e needs_review.
7. **S9-G — Leitura MVP-a:** repository/adapter, grade e filtros sem escrita inicial.
8. **S9-H — CRUD/publicação MVP-a:** transação, concorrência, auditoria e releitura.
9. **S9-I — Acumuladores:** compatibilidade, materialização e prevenção de duplicados.
10. **S9-J — Importação/revisão:** pipeline manual/IA/API comum, sem publicação automática.
11. **S9-K — Comparador administrativo:** MSRP, política isolada/acumulador e indicadores.
12. **S9-L — Homologação/compatibilidade:** reconciliação, view v2, cache e rollout.
13. **S9-M — Decisão MVP-u:** contrato sanitizado e autorização de exposição, se aprovado.

## 15. Gates de conclusão da migração

- migrations estruturais independentes de valores reais de CDI/spread;
- publicação de `subsidized_financing` bloqueada até parameter set manual revisado e published;
- migrations revisadas e testadas fora da produção;
- dry-run reproduzível;
- 100% das origens classificadas ou justificadas;
- zero publicação automática de IA/ambíguos;
- reconciliação de contagens e valores aprovada;
- segurança/negação testada;
- compatibilidade homologada;
- backup e retorno operacional testados;
- aprovação explícita antes de qualquer desativação destrutiva.
