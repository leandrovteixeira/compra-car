# Regras de cálculo de preços e políticas comerciais

> **Nota de compatibilidade:** este documento descreve o primeiro modelo baseado em
> `commercial_policy_applications`. Para o fluxo atual de `commercial_offer`, inclusive policies
> não monetizadas, tipos atuais/deprecated e publicação, prevalece
> `docs/data/PRICING_POLICY_MODEL.md`. `present_value_subsidy` permanece somente como método legado;
> novos financiamentos usam `discounted_promotional_cash_flow_difference`.

## 1. Objetivo

Definir fórmulas, unidades, arredondamento, validação e snapshots do valor econômico congelado das
políticas comerciais do ADR-011. Este documento especifica comportamento futuro; não implementa
cálculos nem altera dados.

Toda política publicada deve ser comparável por `monetary_value` em BRL, mesmo quando o benefício
não reduz a nota fiscal. O valor é calculado por aplicação/produto e não muda automaticamente após
publicação.

`input_monetary_value` é diferente de `monetary_value`: o primeiro registra um valor informado como
entrada; o segundo registra o resultado econômico final obrigatório e congelado.

## 2. Convenções

### 2.1 Dinheiro

- armazenamento: `numeric(14,2)`;
- moeda inicial: BRL;
- unidade: reais, não centavos inteiros;
- cálculos intermediários: decimal de precisão mínima 10 casas;
- floating point binário não pode decidir valor persistido;
- resultado final: duas casas decimais.

### 2.2 Percentuais e taxas

- colunas percentuais armazenam pontos percentuais;
- `3.000000` representa 3%; na fórmula usa-se `3 / 100`;
- taxa `0.990000` representa 0,99% ao mês;
- precisão persistida: seis casas percentuais;
- intervalos iniciais: 0 a 100, inclusive, salvo regra mais restrita por tipo.

### 2.3 Datas

- preço: início inclusivo, fim derivado e exclusivo no próximo `starts_on`;
- política/acumulador: `starts_on` e `ends_on` inclusivos;
- parâmetros financeiros: versão escolhida explicitamente; não buscar “último” durante releitura;
- o snapshot usa `calculated_at` em UTC (`timestamptz`).

### 2.4 Arredondamento

Regra inicial: **half up** para centavos.

1. não arredondar inputs persistidos além da escala de seus contratos;
2. não arredondar parcelas, fatores ou valor presente intermediário;
3. calcular com decimal de alta precisão;
4. arredondar somente `monetary_value` final para duas casas;
5. snapshot guarda resultado não arredondado como string decimal e resultado final;
6. totais de acumulador somam valores já congelados em centavos, sem recalcular componentes.

### 2.5 Métodos de cálculo

- `fixed_amount`: valor monetário explícito da política, da carta ou de uma premissa comercial;
- `percentage_of_msrp`: resultado calculado sobre o MSRP usando `benefit_percentage`;
- `present_value_subsidy`: resultado calculado pela fórmula financeira de valor presente;
- `manual_amount`: estimativa monetária manual de um benefício sem fórmula própria.

`fixed_amount` é evidência comercial explícita ou premissa aprovada; `manual_amount` é estimativa
humana. Ambos podem produzir `monetary_value = input_monetary_value`, mas preservam semânticas
diferentes.

### 2.6 Campos do CRUD por tipo

| Tipo | Inputs obrigatórios | Input monetário | Resultado |
| --- | --- | --- | --- |
| `retail_bonus` | valor explícito | obrigatório | igual ao input; fixed amount |
| `trade_in_bonus` | valor explícito | obrigatório | igual ao input; fixed amount |
| `subsidized_financing` | entrada, prazo, taxa cliente; parameter set published na publicação | nulo | valor presente calculado |
| `free_ipva` | percentual e preço-base | nulo | percentual do MSRP |
| `free_insurance` | percentual, prazo e preço-base | nulo | percentual do MSRP pela cobertura |
| `free_wallbox` | premissa monetária editável antes de publicar | obrigatório | igual ao input; fixed amount |
| `registration` | percentual e preço-base | nulo | percentual do MSRP |
| `other` | título, descrição e estimativa monetária | obrigatório | igual ao input; manual amount |

O preço-base do financiamento é resolvido e persistido pelo serviço porque a fórmula também depende
do MSRP, embora não seja um input livre do formulário.

Exemplos de input versus resultado:

| Tipo | `input_monetary_value` | Exemplo de `monetary_value` |
| --- | ---: | ---: |
| bônus varejo | R$ 10.000,00 | R$ 10.000,00 |
| trade-in | R$ 15.000,00 | R$ 15.000,00 |
| wallbox | R$ 4.000,00 | R$ 4.000,00 |
| seguro, MSRP R$ 100 mil, 3%, 1 ano | null | R$ 3.000,00 |
| IPVA, MSRP R$ 100 mil, 4% | null | R$ 4.000,00 |
| emplacamento, MSRP R$ 100 mil, 1% | null | R$ 1.000,00 |
| financiamento sintético da seção 12 | null | R$ 6.265,40 |
| `other` estimado | R$ 2.500,00 | R$ 2.500,00 |

Implementações PostgreSQL e TypeScript devem compartilhar vetores de teste. O uso de
`Math.round`/`number` isolado não atende a regra financeira.

## 3. Preço público

Preço público não é derivado por este domínio. `amount` é entrada comercial aprovada.

Validações:

- draft/needs_review: `amount >= 0` para preservar zero legado;
- published: `amount > 0`;
- nenhum fallback de nulo/zero para outro preço;
- ausência de preço published é ausência de registro, não linha com zero;
- zero legado permanece draft/needs_review e não é convertido nem descartado;
- preço-base de cálculo deve ser o registro publicado aplicável ao `starts_on` da política, salvo
  decisão retroativa explícita registrada no snapshot;
- preço futuro pode ser base de política futura;
- correção de preço não recalcula política já congelada.

### 3.1 Contrato do snapshot de escopo v1

Na publicação, `commercial_policies.scope_snapshot` é um objeto JSON com `schemaVersion = "1"` e
`productIds`, array não vazio de números inteiros positivos e distintos. O conjunto deve ser
exatamente igual aos `product_id` das aplicações, sem item ausente ou excedente. Para escopo
`model`, cada produto também deve possuir `brand = model_brand` e `model = model_name`; para
`product_set`, o array representa a seleção humana explícita.

IDs como strings, duplicados, conjunto vazio e divergência entre snapshot/aplicações bloqueiam a
publicação. Esse contrato não infere produtos por texto e não é alterado silenciosamente.

## 4. Estrutura mínima do snapshot

Todo `commercial_policy_applications.calculation_snapshot` publicado contém:

```json
{
  "schemaVersion": "1",
  "ruleCode": "free_insurance",
  "ruleVersion": "1.0.0",
  "calculationMethod": "percentage_of_msrp",
  "calculatedAt": "2026-07-25T00:00:00Z",
  "calculatedBy": "profile-uuid",
  "currency": "BRL",
  "inputMonetaryValue": null,
  "inputs": {},
  "publicPrice": {
    "id": 123,
    "amount": "100000.00",
    "startsOn": "2026-07-01"
  },
  "financialParameterSet": null,
  "formula": "MSRP * percentage / 100",
  "unroundedValue": "3000.0000000000",
  "rounding": {
    "mode": "HALF_UP",
    "scale": 2
  },
  "monetaryValue": "3000.00",
  "assumptions": []
}
```

Regras:

- decimais no JSON são strings para não perder precisão;
- snapshot não contém segredo, chave, URL assinada ou arquivo bruto;
- `schemaVersion` permite evolução do formato;
- `ruleVersion` identifica a fórmula, não a versão da aplicação;
- `calculationMethod` preserva a semântica de fixed, percentage, present value ou manual;
- IDs e valores usados são copiados; referências sozinhas não bastam;
- `inputMonetaryValue` aparece sempre, inclusive como nulo;
- premissas manuais são explícitas e revisáveis.
- valores finais, inputs persistidos, IDs e centavos exigem igualdade decimal exata;
- para intermediários não arredondados, diferenças de escala são aceitas somente até `1e-10`,
  preservando a precisão mínima de dez casas sem usar floating point.

## 5. Bônus de varejo

### Inputs

- `input_monetary_value` obrigatório em BRL.

### Fórmula

```text
monetary_value = input_monetary_value
```

Regras:

- `input_monetary_value > 0` para publicação;
- método obrigatório `fixed_amount`;
- não inferir bônus a partir de `total_customer_benefit`;
- não converter rebate interno em bônus sem decisão humana;
- MSRP pode ser registrado no snapshot para contexto, mas não participa da fórmula.

## 6. Bônus de trade-in

### Inputs

- `input_monetary_value` obrigatório em BRL;
- descrição das condições de veículo usado, quando existir.

### Fórmula

```text
monetary_value = input_monetary_value
```

As condições de elegibilidade não reduzem o valor comparável, mas devem constar da descrição e do
snapshot. Não assumir que trade-in combina com bônus varejo sem acumulador publicado.

Método obrigatório `fixed_amount`; input e valor final devem ser iguais.

## 7. Seguro gratuito

### Inputs

- `MSRP` aplicável;
- `benefit_percentage`, premissa inicial 3% ao ano;
- `term_months`, duração da cobertura.

`input_monetary_value` deve ser nulo; `basis_public_price_id` é obrigatório.

### Fórmula

```text
coverage_years = term_months / 12
monetary_value = MSRP * (benefit_percentage / 100) * coverage_years
```

Exemplo aprovado conceitualmente:

```text
MSRP = R$ 100.000,00
benefit_percentage = 3%
term_months = 12
monetary_value = 100.000 * 0,03 * 1 = R$ 3.000,00
```

Regras:

- o percentual não é hardcoded silenciosamente: 3% deve ser persistido e aparecer no snapshot;
- meses fracionários não existem; `term_months` é inteiro positivo;
- duração não múltipla de 12 é proporcional e exige premissa explícita;
- apólice, franquia e cobertura não alteram a fórmula inicial, mas devem aparecer na descrição;
- seguro e IPVA na forma “OU” geram políticas isoladas, sem acumulador.

## 8. IPVA gratuito

### Inputs

- `MSRP` aplicável;
- `benefit_percentage`, premissa inicial 4%.

`input_monetary_value` deve ser nulo; `basis_public_price_id` é obrigatório.

### Fórmula

```text
monetary_value = MSRP * (benefit_percentage / 100)
```

Exemplo:

```text
R$ 100.000,00 * 4% = R$ 4.000,00
```

Regras:

- o MVP usa 4% apenas quando explicitamente selecionado/confirmado;
- estado, proporcionalidade por mês e teto não estão modelados inicialmente;
- os 714 `ipva_included = true` legados não podem ser publicados automaticamente;
- divergência da premissa de 4% exige percentual e justificativa no snapshot.

## 9. Wallbox gratuito

### Inputs

- `input_monetary_value` aprovado e editável antes da publicação;
- premissa inicial sugerida: R$ 4.000,00.

### Fórmula

```text
monetary_value = input_monetary_value
```

Regras:

- método obrigatório `fixed_amount`;
- R$ 4.000 é sugestão de premissa, não constante invisível ou valor imposto;
- input e valor final devem ser iguais;
- instalação, frete e adequação elétrica só entram se explicitamente incluídos;
- o snapshot registra a premissa e a descrição do item.

## 10. Emplacamento

### Inputs

- MSRP aplicável;
- `benefit_percentage`; premissa inicial aproximada de 1%.

`input_monetary_value` deve ser nulo; `basis_public_price_id` é obrigatório no MVP.

### Fórmula inicial

```text
monetary_value = MSRP * (benefit_percentage / 100)
```

Exemplo com premissa explícita de 1%:

```text
R$ 100.000,00 * 1% = R$ 1.000,00
```

“Aproximadamente 1%” não é valor publicável sem input explícito. Região, taxas efetivas e itens
incluídos permanecem pendentes. Futuramente a regra pode ser fixed amount ou tabela regional, com
novo `ruleVersion`.

## 11. Outros benefícios

### Inputs

- título e descrição obrigatórios;
- `input_monetary_value` obrigatório em BRL;
- justificativa/fonte.

### Fórmula

```text
monetary_value = input_monetary_value
```

Não derivar valor de texto por IA sem revisão humana. Valor zero não é política econômica
publicável; ausência de valor termina em needs_review.

O método é obrigatoriamente `manual_amount`; input e valor final devem ser iguais. Benefícios ainda
não modelados usam o tipo enum `other`; tipos dinâmicos de administrador ficam fora do MVP.

## 12. Financiamento subsidiado

### 12.1 Objetivo econômico

Medir, em valor presente, a diferença entre o principal financiado e o valor presente das parcelas
pagas pelo cliente, descontadas pela taxa de referência mensal (CDI equivalente + spread).

O resultado compara o benefício financeiro com bônus monetários, embora não reduza a nota fiscal.

### 12.2 Inputs obrigatórios

| Símbolo | Campo | Unidade |
| --- | --- | --- |
| `M` | MSRP | BRL |
| `d` | `down_payment_percentage / 100` | fração 0..1 |
| `n` | `term_months` | meses inteiros |
| `i_c` | `customer_interest_rate_monthly / 100` | taxa mensal decimal |
| `i_CDI` | `cdi_monthly_percentage / 100` | taxa mensal decimal |
| `i_spread` | `spread_monthly_percentage / 100` | taxa mensal decimal |

Parâmetros CDI/spread vêm de um `financial_parameter_set` publicado e são copiados para o snapshot.
`input_monetary_value` é nulo e `basis_public_price_id` é persistido pelo serviço.

Fonte, calendário e governança de CDI/spread não bloqueiam tabelas, drafts ou needs_review, mas
bloqueiam a publicação real de financiamento. Esta revisão não define nenhum valor real. O cadastro
manual versionado é permitido; publicação exige parameter set revisado e published.

### 12.3 Taxa de desconto v1

Conforme a decisão inicial “CDI mensal equivalente + spread mensal”:

```text
i_ref = i_CDI + i_spread
```

A convenção aditiva é versionada como `present_value_subsidy/1.0.0`. Se o negócio aprovar composição
multiplicativa, ela será uma nova versão, sem recalcular políticas publicadas.

### 12.4 Principal financiado

```text
F = M * (1 - d)
```

Entrada é paga no instante zero e não compõe o principal financiado.

### 12.5 Parcela do cliente

Sistema Price, parcelas mensais postecipadas, sem carência ou residual:

```text
se i_c = 0:
  PMT = F / n

se i_c > 0:
  PMT = F * [i_c * (1 + i_c)^n] / [(1 + i_c)^n - 1]
```

### 12.6 Valor presente das parcelas

```text
se i_ref = 0:
  PV_customer = PMT * n

se i_ref > 0:
  PV_customer = PMT * [1 - (1 + i_ref)^(-n)] / i_ref
```

### 12.7 Valor econômico do subsídio

```text
unrounded_value = F - PV_customer
monetary_value = round_half_up(unrounded_value, 2)
```

Regras:

- `n > 0`, `0 <= d < 100`, taxas não negativas;
- `F > 0`;
- resultado deve ser positivo para publicação como benefício;
- resultado zero/negativo não é truncado para zero: vai para needs_review;
- tarifas, impostos, seguros prestamistas, balão e residual não entram na versão 1;
- parcela anunciada divergente da calculada gera issue, não substituição silenciosa;
- o snapshot inclui em `inputs` os campos decimais string `financedPrincipal`, `customerPayment`,
  `referenceRateMonthly` e `customerPresentValue`, além de entrada, prazo e taxa do cliente;
- `financialParameterSet` copia ID, versão, CDI mensal e spread mensal usados;
- PMT, PV, taxa de referência e principal são comparados com tolerância máxima de `1e-10`; o
  `monetaryValue` arredondado continua exigindo igualdade exata em duas casas.

### 12.8 Exemplo ilustrativo

Premissas sintéticas apenas para demonstrar a fórmula, não valores reais ou parâmetros aprovados:

```text
M = R$ 100.000,00
entrada = 50%
F = R$ 50.000,00
n = 24
taxa cliente = 0% a.m.
CDI mensal equivalente = 0,9% a.m.
spread = 0,2% a.m.
i_ref = 1,1% a.m.
PMT não arredondada = 2.083,333333...
PV_customer = 43.734,597549...
monetary_value = 50.000 - 43.734,597549 = R$ 6.265,40
```

O cálculo real somente pode usar parameter set publicado.

## 13. Acumuladores

Um acumulador representa soma autorizada, não nova fórmula econômica.

Para produto `p` e políticas membros `P`:

```text
accumulator_value(p) = sum(policy_application.monetary_value para cada policy em P e produto p)
```

Regras:

- no mínimo duas políticas;
- todas as aplicações usam BRL;
- produto deve estar no escopo de todos os membros;
- período do acumulador deve caber na interseção das vigências;
- não somar duas políticas fora de acumulador;
- não contar a mesma política duas vezes;
- snapshot lista IDs, tipos, valores congelados e soma em centavos;
- total é materializado na publicação e não muda com alterações posteriores.

## 14. Preço transacional e comparadores

Para uma escolha comercial válida:

```text
transaction_price = MSRP - selected_economic_value
```

`selected_economic_value` é:

- zero quando nenhuma política é escolhida;
- o valor de uma política isolada; ou
- o valor de um acumulador publicado.

Não é permitido somar manualmente duas políticas isoladas. Preço transacional negativo é inválido e
vai para revisão; não aplicar piso zero silencioso.

O valor econômico é comparável mesmo quando seguro, IPVA, wallbox ou financiamento não alteram a
nota fiscal. A UI deve distinguir “valor econômico comparável” de “desconto na nota”.

## 15. Reconciliação de cálculo legado

Para cada linha migrada:

1. preservar inputs legados no import row;
2. calcular cada política pela regra alvo;
3. somar apenas componentes confirmados como cumulativos;
4. comparar com `total_customer_benefit`;
5. registrar diferença absoluta e percentual;
6. classificar divergência sem editar a origem.

Não exigir igualdade quando o total legado inclui dealer rebate, benefício não confirmado ou
alternativas OU. `total_customer_benefit = -100` é needs_review obrigatório.

## 16. Casos de teste mínimos

- cada fórmula com MSRP inteiro e com centavos;
- bônus/trade-in/wallbox/other com input obrigatório, igualdade input/resultado e input ausente;
- seguro/IPVA/emplacamento/financiamento com input monetário obrigatoriamente nulo;
- snapshot sempre distinguindo input nulo, input explícito e resultado congelado;
- método fixed rejeitado para `other` e método manual rejeitado para bônus/wallbox;
- half-up em fronteiras de meio centavo;
- percentual zero, 3%, 4%, 1% e limites;
- seguro 12, 24 e duração não múltipla de 12 meses;
- financiamento com taxa cliente zero e positiva;
- taxa de referência zero e positiva;
- entrada 0%, próxima de 100% e inválida 100%;
- prazo 1, 24, 60 e zero inválido;
- resultado de subsídio positivo, zero e negativo;
- política com preço futuro e retroativo;
- mudança de MSRP/parameter set sem alteração de snapshot publicado;
- financiamento draft permitido sem parâmetro real, mas publicação negada sem parameter set published;
- ausência de preço published representada sem registro e zero legado preservado em needs_review;
- apenas os oito tipos enum aceitos; benefício novo representado por `other + manual_amount`;
- acumulador com dois/múltiplos membros, membro repetido e escopo sem interseção;
- serialização JSON sem perda decimal;
- paridade PostgreSQL/core nos mesmos vetores.

## 17. Pontos financeiros ainda ambíguos

- fonte e calendário oficial do CDI mensal equivalente;
- CDI bruto/líquido, convenção de dias úteis e data de corte;
- valor/governança do spread;
- taxa aditiva versus composta após a versão inicial;
- financiamento com carência, parcela balão, residual, tarifas ou parcela anunciada;
- cobertura fracionária e condições do seguro;
- alíquota regional de IPVA;
- composição real do emplacamento;
- valor do wallbox por modelo/fornecedor e instalação;
- tratamento contábil de benefício econômico maior que o MSRP.

As ambiguidades de CDI/spread não bloqueiam a migration estrutural. Tipos afetados não devem ser
publicados até a premissa correspondente ser aprovada e versionada.
