# Sprint 9H — operação mensal e rollover de Policies

## Auditoria do lifecycle

- `create_manual_policy_batch` cria lote, rows, outputs, Policies `draft` e auditoria numa transação.
- `update_commercial_policy_draft` aceita apenas `draft`, exige `expected_lock_version` e rejeita
  Policy usada por Offer não arquivada. Publicação aceita `draft`/`needs_review` pela RPC dedicada.
- Archive é administrativo, preserva o registro e só aceita `draft`/`published` sem Offer não
  arquivada. O trigger append-only protege `pricing_audit_events`.
- `set_pricing_updated_at` incrementa `lock_version` uma vez por UPDATE. A proteção terminal impede
  mudanças econômicas em `published`/`archived`.
- `commercial_policy_applications` é compatibilidade histórica. O vínculo autoritativo de Offers é
  `commercial_offer_policies`; seus memberships de Offers publicadas permanecem imutáveis.

## Regra temporal

`create_manual_policy_batch_with_rollover` é a fronteira transacional da operação mensal. Para o
mesmo Product e `policy_type`, `draft`, `needs_review` e `published` participam da timeline;
`rejected` e `archived` não participam. Uma Policy com `starts_on >= D` rejeita inserção em D.
Exatamente um predecessor que cobre D recebe `ends_on = D - 1`; múltiplos rejeitam o lote.

A chamada exige o ID e `lock_version` do predecessor visto pelo operador. Um lock consultivo por
Product serializa lotes concorrentes. A exceção à imutabilidade terminal aceita exclusivamente o
UPDATE de `ends_on` feito pela RPC, sob `current_user = postgres` e marcador local da transação.
Falha na criação ou no encerramento reverte tudo.

Antes do UPDATE, a RPC rejeita qualquer Offer não arquivada cujo `valid_to` seja aberto ou alcance D.
Ela não altera Offer nem membership. O evento append-only registra predecessor, Product, tipo,
snapshots, sucessora, ator, correlation ID e motivo.

## Workspace mensal

A competência `YYYY-MM` e o Product ficam na query string. O default usa `America/Sao_Paulo`; um
dropdown apresenta N−6 até N+6 com valores canônicos. A data-base inicia no primeiro dia e deve
pertencer à competência. Todas as novas Policies do lote herdam a data-base.

A leitura operacional limita-se a intervalos que intersectam o mês e até 50 itens históricos por
entidade. Archived fica oculto. A tela separa vigentes na data-base, demais itens do mês e Histórico
recolhido. A matriz recebe somente Policies vigentes na data-base, e o preço público aplicável é
exibido apenas como referência com link para Preços Públicos.

## Investigação 9H.1

No Staging `shfsjyjxmgwnlexmdkcs`, o Product 616 tinha a Taxa #66 aberta e vinculada às Offers draft
#26 e #28. O cenário de setembro/2026, prazo 24, taxa 0,49% a.m. e entrada 60% calculou benefício de
R$ 8.186,01, mas foi rejeitado antes do rollover com SQLSTATE `55000` e mensagem
`policy rollover would invalidate a non-archived commercial offer`. A reprodução usou correlation
ID controlado e foi integralmente revertida.

Essa proteção é intencional: a operação não arquiva nem substitui Offers. A aplicação converte o
erro em mensagem de domínio, inclui #26/#28 e correlation ID e mantém a linha para correção. O
cabeçalho usa uma grade 2×2, e Offers persistidas e novas são exibidas na mesma matriz; apenas drafts
aceitam substituição de memberships pela RPC existente.

## Período comercial e operação atômica 9H.2

O período comercial continua derivado, sem tabela ou coluna nova. No modo mensal, corresponde ao
primeiro e ao último dia do mês; no modo especial, o início e o fim precisam pertencer à mesma
competência. Policies e Offers criadas no fluxo recebem exatamente esse intervalo. O MSRP permanece
independente e precisa cobrir o período completo.

Quando não existe registro exato no período, o workspace busca a base vigente em D−1 e a copia para
o estado local, sem persistência automática. O cabeçalho desktop apresenta Product, competência/modo
especial e preço válido em três colunas. Datas por linha foram removidas; a publicação permanece
individual.

`create_commercial_period_draft` é a fronteira transacional para rollover conjunto. A RPC:

- exige admin ativo, ator, correlation ID, intervalos válidos e `lock_version` de cada predecessor;
- serializa por Product com advisory lock;
- fecha Policies alteradas e Offers afetadas em `period_start - 1`;
- cria somente Policies e Offers `draft`, com memberships novos e intervalo exato;
- exige que toda Policy e um único MSRP publicado cubram o período completo;
- registra snapshots correlacionados de predecessor/sucessor e memberships;
- reverte todo o conjunto diante de conflito, ambiguidade ou erro de domínio.

A exceção de imutabilidade para Offer `published` existe somente nessa RPC e aceita apenas a mudança
de `valid_to`, além dos campos técnicos atualizados por trigger. Status, memberships e identidade
econômica não mudam. Offer `archived` nunca participa. No fluxo mensal comum, uma publicada não pode
ser encerrada com `period_start` anterior ao dia operacional em `America/Sao_Paulo`.

## Staging e limpeza controlada

A migration `20260801190935_sprint_9h2_commercial_period_draft.sql` foi aplicada somente ao projeto
Staging `shfsjyjxmgwnlexmdkcs`. Uma validação administrativa transacional e revertida confirmou o
fechamento em D−1, drafts no intervalo exato, status/memberships preservados, cinco auditorias
correlacionadas, rejeição mensal retroativa, rejeição de archived e rollback por lock obsoleto. As
fixtures e auditorias da validação ficaram em zero após o rollback.

A limpeza autorizada está em `scripts/staging/08-clean-policy-offer-data.sql`; não é migration. Ela
usa guardas fail-closed do Staging, `session_replication_role` local à transação, DELETEs explícitos,
checksums e comparação de contagens antes do commit. Foram removidos Policies, Offers, memberships,
proveniência e auditoria correspondentes. O pós-check independente confirmou:

- 10 Products, 17 `product_public_prices` e 1 `financial_parameter_set`;
- 4 batches, 8 rows e 8 outputs de preço;
- 18 auditorias de preço, 4 de batch de preço e 1 financeira;
- zero Policies, Offers, memberships ou proveniência de Policy;
- `session_replication_role = origin`.

## Limitações

- Não foi adicionada coluna `competence`, constraint ou índice.
- O histórico carregado é deliberadamente limitado a 50 Policies e 50 Offers anteriores.
- As migrations 9H e 9H.2 foram aplicadas somente ao Staging. Produção não faz parte desta sprint.
- A 9H.1 não adicionou migration, RPC ou regra de lifecycle.
- O runner remoto do CLI não possui `USAGE` no schema `extensions`; por isso o pgTAP 020 não
  iniciou nesse runner. A mesma matriz foi validada pela conexão administrativa em transação
  revertida. O arquivo 020 permanece versionado para a stack local/CI com pgTAP acessível.

## Refinamento final 9H.3

A falha de setembro ocorria quando a Offer copiada mantinha um `policyId` de agosto. A RPC criava as
novas Policies corretamente, mas a validação final encontrava memberships cujas vigências terminavam
em 31/08 e rejeitava com SQLSTATE `23514`. O fallback era possível porque Offers e Policies eram
carregadas em consultas históricas independentes e limitadas, e a UI tentava resolver o vínculo por
tipo sem preservar a identidade da linha copiada.

Cada linha copiada agora mantém `sourcePolicyId` somente no estado do browser. Ao montar a operação,
um membership cuja origem foi copiada vira referência à sucessora por `policyClientRowId`. A UI só
mantém um `policyId` persistido quando essa Policy já cobre integralmente o novo período; qualquer
vínculo não resolvido bloqueia o save. O serviço também recarrega por ID as Policies referenciadas por
Offers que não vieram na janela histórica.

O Rebate manual usa `dealer_rebate_amount`, já existente para representar a parcela financiada pela
concessionária. O novo método `manual` distingue operação corrente de alocações legadas. Na UI, zero
é o default; na persistência, zero permanece `NULL`. Valor positivo exige `rebate <=
customer_benefit_amount`, não reduz o benefício da Policy e não participa de total, preço
transacional ou PDF.

`invoice_discount` representa Desconto NF. É uma Policy fixa, segue as mesmas regras de Bônus
Varejo, participa da matriz e da soma de benefícios e continua com publicação individual.

A migration `20260801202216_sprint_9h3_policy_rebate_invoice_discount.sql` altera os dois enums, a
constraint de Rebate, `create_manual_policy_batch` e
`validate_commercial_policy_for_publication`. `create_commercial_period_draft` não mudou: ela delega
a criação de Policies à RPC de lote e mantém o contrato transacional 9H.2.

## Polish final 9H.4

O período especial continua usando o contrato transacional 9H.2. Policies inalteradas permanecem
válidas através do intervalo e não são copiadas como novos registros. Ao incluir uma linha do mesmo
tipo, a UI resolve a predecessora, envia ID/lock esperados e troca nas Offers a referência antiga
pelo `policyClientRowId` da sucessora. A própria RPC permanece responsável por encerrar em D−1 e
criar a sucessora em D; nenhum endpoint ou regra de lifecycle foi alterado.

A matriz de Offers expõe ao workspace um snapshot de suas seleções locais. Esse snapshot inclui
Offers persistidas editáveis e linhas ainda não salvas, permitindo atualizar imediatamente total,
indicadores “Em uso”/“Livre” e bloqueios de edição ou arquivamento das Policies.

No fluxo sem MSRP, o mesmo modal oficial cria o preço draft. O estado de sucesso devolve o ID e a
versão de lock já presentes no domínio; “Publicar agora” usa esses valores na ação individual de
publicação e, em caso de sucesso, atualiza os Server Components sem sair da página.

O cabeçalho foi ajustado para aproximadamente 55/25/20. O grid de Policies omite a coluna Veículo
quando o produto já está fixado pelo workspace, centraliza os botões circulares e redistribui espaço
para Valor/Rebate. A matriz de Offers e os espaçamentos verticais também foram compactados.

Não há migration 9H.4. RPCs, triggers, RLS, auditoria, `search_path`, rollback, publicação individual,
contratos públicos, Produção e `Legacy` permanecem inalterados.

## Encerramento 9H.5

A lista de preços deriva “Expirado” exclusivamente na apresentação: o registro precisa continuar
`published`, ter `ends_on` e essa data precisa ser anterior ao dia operacional em
`America/Sao_Paulo`. Um preço cujo término é hoje ainda aparece como “Publicado”. Vigência,
publicação, lock e auditoria não são alterados.

O falso erro do modal ocorria após o COMMIT. A RPC de publicação devolve um
`product_public_prices`, sem o relacionamento `product` incluído pela consulta da listagem; o mapper
completo rejeitava esse retorno e a Server Action respondia falha apesar da auditoria de publicação.
O adapter agora carrega e valida a linha com Product antes da RPC e usa essa relação no retorno. No
cliente, sucesso da publicação é terminal para a tentativa atual; falha de refresh é registrada, mas
mantém a mensagem de sucesso, fecha o modal e não dispara nova publicação.

O campo de MSRP reutiliza a máscara monetária do lote manual, inclusive preservação de caret, e o
parser canônico existente continua convertendo `199.990,00` em `199990.00`. Os campos
administrativos em escopo desativam autofill e mantêm `inputMode` decimal ou numérico conforme o
domínio.

Na auditoria somente leitura do Staging, VW Taos/Product 617 apresentou um único preço (#29),
`published`, vigente desde 01/08/2026, sem término, lock 2 e sem pares sobrepostos. O evento
append-only registra a transição draft→published. Para o Haval, #19 termina em 31/07 e deve aparecer
“Expirado” em agosto; #24 começa em 01/08 e permanece “Publicado”. Nenhuma migration 9H.5 foi criada.
