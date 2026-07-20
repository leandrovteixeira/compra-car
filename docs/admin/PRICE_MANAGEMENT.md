# Gestão Administrativa de Preços e Políticas

## Modelo de operação

Preços e políticas serão mantidos exclusivamente em grade. Não haverá formulário individual na Fase 1, pois uma carta comercial normalmente contém múltiplas linhas e veículos na mesma operação.

A grade deve permitir:

- selecionar ou identificar a carta e sua referência temporal;
- incluir múltiplos veículos;
- editar os campos existentes de MSRP ou preço público, política comercial, vigência e demais valores confirmados;
- validar cada linha e o conjunto da carta;
- exibir totais calculados antes da gravação;
- reler os dados persistidos para conferência.

## Conceitos

- **MSRP ou preço público:** preço público aplicável ao veículo e período;
- **valor total da política comercial:** soma líquida dos componentes aplicáveis, segundo regra confirmada;
- **preço transacional:** valor conceitual após a política comercial.

```text
Preço transacional = MSRP - valor total da política comercial
```

A evidência histórica em `Legacy` contém um preço efetivo calculado e um total de oferta armazenado, mas isso não confirma o modelo do Supabase atual. Deve-se validar se total e preço transacional são armazenados, calculados ou ambos.

## Vigência e histórico

Cada linha deve possuir referência temporal suficiente para identificar sua aplicabilidade. Permanecem pendentes:

- campos reais de início, fim ou mês de referência;
- inclusividade das datas e timezone;
- regra para ofertas sobrepostas;
- critério de preço atual;
- moeda;
- escopo por região, canal ou concessionária;
- confidencialidade e autorização de uso.

Registros anteriores não devem ser sobrescritos para representar nova carta ou nova vigência quando o modelo existente permitir histórico.

## Validações

- veículo existente e chave identificável;
- duplicidade conforme a chave física confirmada da oferta;
- tipos, escalas, moeda, percentuais e valores válidos;
- consistência entre componentes, total da política e preço transacional;
- vigência coerente;
- permissões de escrita;
- tratamento explícito de falha parcial e concorrência.

## Evolução com IA

Na Fase 2, cartas comerciais poderão ser extraídas por IA. O resultado irá primeiro para staging, passará por revisão humana e só então poderá ser promovido. A gestão manual em grade permanece o ponto de revisão e correção, não uma escrita direta da IA.
