# ADR-011 — Modelo de preços públicos, políticas comerciais, acumuladores e importações

- **Status:** aceito historicamente; relações Offer/Policy substituídas pelo ADR-012
- **Data:** 2026-07-25
- **Substitui parcialmente:** ADR-009, detalhando seu modelo alvo
- **Substituído parcialmente por:** ADR-012, que torna Policy filha de Product e Offer↔Policy N:N
- **Implementação:** primeira migration estrutural criada e validada localmente; etapas operacionais
  permanecem pendentes

> **Adendo de 2026-07-26:** o agregado atual é `commercial_offer` com policies ligadas diretamente.
> `free_registration` substitui `registration` e
> `discounted_promotional_cash_flow_difference` substitui `present_value_subsidy` para novos
> registros. Os nomes antigos permanecem deprecated apenas para compatibilidade do modelo histórico
> de `commercial_policy_applications`. O contrato vigente está em
> `docs/data/PRICING_POLICY_MODEL.md`.

## Contexto

O ADR-009 separou conceitualmente MSRP e políticas comerciais, mas adiou o desenho físico. A
inspeção da Sprint 9 confirmou que `product_price_offers` mistura os dois conceitos, não representa
vigência completa e não seleciona preço atual de forma determinística. O comparador MVP-u Next.js
ainda não consome preço; a única leitura encontrada está no Appsmith histórico por
`vw_product_value_current`.

O novo modelo precisa atender entrada manual pelo MVP-a e importação futura por IA/API sem criar
dois domínios. Também precisa preservar o legado, classificar ambiguidades, congelar o valor
econômico calculado e impedir que combinações comerciais não aprovadas sejam inferidas.

## Decisão

### 1. Namespace e fronteira arquitetural

As novas tabelas serão criadas no schema PostgreSQL `public`, com nomes próprios e sem alterar as
tabelas legadas na primeira etapa. Um schema PostgreSQL separado exigiria configuração adicional do
PostgREST e não cria, por si, uma fronteira de domínio. A fronteira continua sendo:

```text
MVP-a/MVP-u -> casos de uso e contratos -> repositories -> adapter-supabase -> Supabase
```

Nenhuma UI conhecerá nomes físicos. Escritas permanecerão server-only e exigirão autorização
administrativa antes do uso do client privilegiado.

### 2. Preço público

`product_public_prices` será a fonte definitiva de MSRP:

- um registro pertence a exatamente um `products.id`;
- `amount` é monetário em BRL;
- `starts_on` é obrigatório;
- não existe `ends_on` armazenado;
- o fim é derivado do próximo preço publicado do mesmo produto;
- `UNIQUE(product_id, starts_on)` impede dois preços na mesma data;
- datas futuras e retroativas são permitidas;
- somente registros `published` participam de consultas vigentes;
- zero pode existir apenas em `draft` ou `needs_review`; publicação exige `amount > 0`;
- ausência de preço publicado é representada pela ausência de registro `published`, nunca por zero;
- zero legado não é convertido, descartado ou promovido silenciosamente;
- uma correção retroativa não pode reclassificar zero silenciosamente e deve gerar auditoria.

O intervalo de validade é semiaberto: `starts_on <= data < próximo starts_on`. Para apresentação em
datas inclusivas, `ends_on` derivado é o dia anterior ao próximo início.

### 3. Política comercial e aplicação por produto

`commercial_policies` representa uma política comercial independente. Cada política possui um dos
tipos iniciais:

- `retail_bonus`;
- `trade_in_bonus`;
- `subsidized_financing`;
- `free_ipva`;
- `free_insurance`;
- `free_wallbox`;
- `registration`;
- `other`.

Esses tipos permanecem enum na Sprint 9. O MVP não permite que administradores criem tipos
dinamicamente. Benefícios ainda não modelados usam `other` com `manual_amount`, título, descrição e
valor estimado explícitos. Uma evolução futura poderá substituir ou complementar o enum por um
catálogo administrável, mediante novo ADR/migration e preservação de compatibilidade.

A política contém título, descrição, período, método de cálculo e condições comuns. Sua
aplicabilidade e seu valor congelado ficam em `commercial_policy_applications`, uma linha por
produto.

Essa separação é necessária porque uma política de modelo pode abranger versões com MSRPs
diferentes. O cabeçalho continua sendo uma única política, enquanto cada aplicação registra:

- `product_id`;
- o preço público usado como base, quando aplicável;
- `input_monetary_value`, quando o valor explícito veio da carta, de input manual ou de uma premissa;
- `monetary_value` congelado em BRL;
- o snapshot completo do cálculo.

`input_monetary_value` e `monetary_value` têm significados diferentes:

- `input_monetary_value` é o valor monetário informado como entrada e pode ser nulo;
- `monetary_value` é o valor econômico final, obrigatório e congelado por aplicação/produto;
- em bônus, wallbox e `other`, os dois valores são iguais;
- em seguro, IPVA, emplacamento e financiamento, o input monetário é nulo e o valor final é
  calculado.

Uma política com `scope_type = model` é resolvida, no momento da publicação, para o conjunto
explícito de produtos existentes daquele modelo. `scope_type = product_set` usa versões escolhidas.
O conjunto materializado não se expande automaticamente quando novos produtos são cadastrados;
isso evita mudar retroativamente uma política publicada. Inclusões posteriores exigem revisão e
nova aplicação auditada.

Uma política publicada é sempre utilizável isoladamente. A mera coincidência de período ou escopo
não autoriza sua soma com outra política.

### 3.1 Métodos de cálculo

- `fixed_amount`: valor monetário explícito da política, carta ou premissa comercial;
- `percentage_of_msrp`: valor derivado do MSRP e de um percentual explícito;
- `present_value_subsidy`: valor derivado da fórmula financeira de valor presente;
- `manual_amount`: estimativa monetária atribuída manualmente a benefício sem fórmula própria.

`fixed_amount` não é sinônimo de `manual_amount`: o primeiro representa um valor comercial explícito
ou uma premissa aprovada; o segundo representa uma estimativa humana para `other`.

### 3.2 Campos obrigatórios por tipo

| Tipo | Campos/regras para publicação |
| --- | --- |
| `retail_bonus` | `input_monetary_value`; método `fixed_amount`; `monetary_value = input` |
| `trade_in_bonus` | `input_monetary_value`; método `fixed_amount`; `monetary_value = input` |
| `subsidized_financing` | entrada, prazo, taxa mensal do cliente e parameter set publicado; método `present_value_subsidy`; valor calculado |
| `free_ipva` | percentual e preço-base; método `percentage_of_msrp`; valor calculado |
| `free_insurance` | percentual, prazo e preço-base; método `percentage_of_msrp`; valor calculado |
| `free_wallbox` | `input_monetary_value` editável antes da publicação; método `fixed_amount`; premissa inicial sugerida de R$ 4.000 |
| `registration` | percentual e preço-base; método `percentage_of_msrp`; valor calculado |
| `other` | título, descrição e `input_monetary_value`; método obrigatório `manual_amount`; `monetary_value = input` |

### 4. Vigência e ciclo de vida

Políticas têm `starts_on` obrigatório e `ends_on` opcional, ambos inclusivos. `ends_on` nulo
significa vigência aberta, não vigência infinita garantida pelo negócio.

Preços, políticas, acumuladores e importações usam estados controlados:

- `draft` — editável, ainda não revisado;
- `needs_review` — requer decisão humana;
- `published` — autorizado para consumo;
- `rejected` — revisado e recusado;
- `archived` — retirado do fluxo operacional, preservado para auditoria.

Dados gerados por IA/API entram em `draft` ou `needs_review`. Nenhuma integração pode gravar
diretamente um registro `published`. Publicação é um caso de uso administrativo explícito.

### 5. Acumuladores

`commercial_policy_accumulators` representa uma combinação adicional permitida. Seus membros ficam
em `commercial_policy_accumulator_items`.

Invariantes de publicação:

- ao menos duas políticas distintas;
- todas as políticas já publicadas;
- interseção não vazia dos produtos aplicáveis;
- interseção não vazia das vigências;
- nenhuma combinação duplicada de IDs de políticas;
- o período do acumulador deve estar contido na interseção das vigências;
- a combinação é válida somente para produtos presentes em todas as políticas membros.

A combinação canônica é a lista ordenada dos IDs das políticas. Seu fingerprint é persistido e
protegido por unique constraint. Uma validação transacional no banco recalcula o fingerprint e
impede publicação com menos de dois membros ou com escopo/vigência incompatível.

`commercial_policy_accumulator_values` congela, por produto, a soma dos valores das aplicações
membros e o snapshot da composição. O acumulador não altera a validade isolada de nenhuma política.

### 6. Cálculos e snapshots

Toda aplicação publicada possui um único `monetary_value` em BRL, mesmo quando o benefício não
reduz a nota fiscal. `calculation_method` identifica a regra e `calculation_snapshot` preserva:

- versão da regra;
- entradas originais;
- preço público e ID usados;
- parâmetros financeiros e respectivas versões;
- resultado antes do arredondamento;
- regra e resultado do arredondamento;
- momento e ator do cálculo.

O snapshot também registra `input_monetary_value`, inclusive como nulo, para distinguir ausência de
input monetário de valor econômico calculado.

O valor congelado não é recalculado automaticamente quando MSRP, CDI, spread ou premissas mudam.
Nova premissa exige nova aplicação/revisão publicada.

### 7. Parâmetros financeiros

`financial_parameter_sets` versiona CDI mensal equivalente e spread mensal. O MVP aceita cadastro
manual. Integração externa futura cria nova versão, nunca sobrescreve a anterior. Financiamento
subsidiado referencia a versão usada e copia os parâmetros para seu snapshot.

Fonte, calendário e governança de CDI/spread não bloqueiam a criação das tabelas, o backfill ou
políticas draft/needs_review. Eles bloqueiam a publicação real de `subsidized_financing`. Nenhum
valor real de CDI ou spread é definido por este ADR; publicação exige um parameter set manualmente
cadastrado, revisado e `published`.

### 8. Importações

O fluxo alvo será:

```text
arquivo/API -> pricing_import_batches -> pricing_import_rows
  -> resolução/validação -> revisão humana -> entidades draft
  -> publicação explícita -> preço/política/acumulador
```

`pricing_import_row_outputs` liga cada linha aos registros produzidos. Backfill legado usa o mesmo
pipeline com `source_type = legacy_backfill`, preservando tabela e ID de origem. Decisões humanas
ficam em `pricing_import_row_reviews`.

As tabelas atuais permanecem intactas inicialmente:

- `price_offer_imports`: lote legado;
- `price_offer_import_rows`: linhas interpretadas legadas — este é o nome físico confirmado;
- `price_offers_staging`: staging textual da carga inicial;
- `product_price_offers`: destino definitivo legado misto.

### 9. Auditoria, imutabilidade e concorrência

`pricing_audit_events` registra insert, update, transição de estado e associação relevante com
snapshot anterior/posterior e ator. Registros publicados não são apagados. Correções usam operação
administrativa auditada; políticas/acumuladores materialmente diferentes geram novos registros ou
novas aplicações, mantendo o anterior arquivado.

`lock_version` habilita concorrência otimista. A persistência em grade deve ser transacional e
reler os registros gravados antes de confirmar sucesso.

### 10. Segurança

Todas as novas tabelas terão RLS habilitado. A primeira entrega será server-only:

- nenhum grant para `anon`;
- nenhum DML direto para `authenticated`;
- `service_role` recebe somente os privilégios necessários às operações do adapter;
- policies administrativas são defesa adicional e exigem profile ativo com role `admin`;
- views iniciais permanecem server-only;
- eventual leitura pelo MVP-u exigirá contrato/view sanitizado e decisão explícita sobre exposição.

O uso de `service_role` não substitui `requireRole('admin')`, validação de entrada ou auditoria.

### 11. Compatibilidade

`vw_product_value_current` não será alterada na primeira migration. Uma view nova e determinística
será homologada em paralelo. A compatibilidade histórica só será redirecionada depois de:

1. backfill reconciliado;
2. preço zero decidido;
3. equivalência de resultados aprovada;
4. consumidores identificados;
5. rollback testado.

Tabelas e funções legadas não serão removidas na primeira fase.

## Consequências positivas

- separação definitiva entre preço, política e combinação autorizada;
- valor econômico comparável e congelado por produto;
- vigência determinística e suporte a preços futuros/retroativos;
- combinações E/OU explícitas sem inferência;
- mesmo domínio para entrada manual, IA, API e backfill;
- rastreabilidade, revisão humana, reconciliação e auditoria;
- segurança compatível com o adapter server-only.

## Consequências negativas e custos

- mais tabelas e casos de uso do que o legado;
- valor por aplicação é necessário para políticas de modelo;
- input monetário e valor econômico precisam ser persistidos e validados separadamente;
- invariantes de acumuladores exigem validação transacional além de checks simples;
- backfill não poderá classificar todas as linhas automaticamente;
- publicação e correção retroativa exigem auditoria e controle de concorrência;
- o MVP-u continuará sem preço até existir contrato público aprovado.

## Alternativas rejeitadas

### Manter `product_price_offers`

Rejeitada porque mistura entidades, não representa combinações autorizadas e não possui vigência
determinística.

### Um `monetary_value` único no cabeçalho da política

Rejeitada porque políticas percentuais aplicadas a versões com MSRPs diferentes geram valores
econômicos distintos.

### Tipos de política administráveis no MVP

Rejeitada para a Sprint 9. O enum aprovado reduz ambiguidade de cálculo e validação; benefícios novos
usam `other + manual_amount` até uma evolução arquitetural própria.

### Somar políticas coincidentes automaticamente

Rejeitada. Somente um acumulador publicado autoriza combinação.

### Armazenar `ends_on` no preço

Rejeitada. Duplicaria informação derivável e criaria risco de lacunas/sobreposição inconsistentes.

### Publicação direta por IA

Rejeitada por risco comercial, baixa explicabilidade e necessidade de revisão humana.

### Alterar a view legada na primeira migration

Rejeitada por risco de compatibilidade com o Appsmith histórico.

## Pontos deliberadamente pendentes

- fonte oficial, calendário e convenção do CDI mensal equivalente — bloqueiam financiamento
  publicado, não a migration estrutural;
- valor inicial do spread e governança para alterá-lo — bloqueiam financiamento publicado, não a
  migration estrutural;
- se emplacamento usa sempre 1% ou tabela regional;
- impostos, tarifas, valor residual ou carência no financiamento;
- escopo regional/canal/concessionária além de produto/modelo;
- quais políticas e campos poderão ser expostos ao MVP-u;
- regra operacional para corrigir um preço já publicado na mesma `starts_on`;
- retenção e armazenamento do arquivo original importado.

Esses pontos não impedem a arquitetura, mas alguns bloqueiam publicação real dos respectivos tipos.

## Status de implementação

A primeira migration incremental,
`20260725172755_create_pricing_types_and_core_tables.sql`, implementa os cinco enums e as sete
tabelas centrais, com constraints e índices locais. Ela foi validada somente na stack local e não
cria dados, backfill, views, RLS, policies, grants específicos, funções, triggers ou código
funcional. As demais etapas deste ADR permanecem pendentes em migrations separadas.
