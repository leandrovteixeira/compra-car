# Comparador Administrativo

## Objetivo

O comparador administrativo apoia análise técnica e financeira interna. Ele não aplica vencedor, perdedor, vantagem ou recomendação visual.

## Seleção

- um veículo é escolhido como **referência**;
- um ou mais veículos distintos são escolhidos como **comparados**;
- a hierarquia é `marca → modelo → versão → MY → PY`;
- o limite de veículos comparados permanece pendente de validação de uso e desempenho;
- todos os spec codes do master devem ser apresentados, inclusive specs com valor monetário zero.

## Monetização por spec

Cada spec possui um valor monetário obtido exclusivamente da tabela master de specs confirmada no Supabase. O backoffice não cria uma classificação paralela de monetização.

- spec monetizável: usa o valor master confirmado;
- spec não monetizável: valor monetário `R$ 0` e permanece visível;
- spec ausente, presença falsa, valor numérico zero e dado desconhecido devem continuar distinguíveis;
- a soma deve considerar somente a semântica de presença e quantidade confirmada para o tipo do spec.

**PENDENTE:** confirmar o nome da coluna, a moeda, se o valor é unitário ou total e se depende apenas do spec. A evidência histórica de `unit_perceived_value` não confirma o objeto atual.

## Indicadores e fórmulas

Considere `R` como o veículo de referência e `C` como um veículo comparado.

### MSRP ou preço público

Valor vigente aplicável a cada veículo no mesmo contexto temporal.

### Diferença MSRP percentual

```text
(MSRP(C) - MSRP(R)) / MSRP(R)
```

Para a referência: `0%`.

### Valor total dos equipamentos

```text
Σ valores monetários dos specs presentes no veículo
```

### Delta Spec

```text
Valor total dos equipamentos(C) - Valor total dos equipamentos(R)
```

Para a referência: `R$ 0`.

### CEP

```text
(MSRP(C) - Delta Spec(C)) / MSRP(R)
```

Para a referência: `100%`.

### Valor total da política comercial

Soma líquida dos componentes aplicáveis da política, segundo a regra e a vigência confirmadas.

### Preço transacional

```text
MSRP - valor total da política comercial
```

### TPVA

```text
(Preço transacional(C) - Delta Spec(C)) / Preço transacional(R)
```

Para a referência: `100%`.

## Regras de cálculo pendentes

Antes da implementação devem ser definidos:

- arredondamento e precisão;
- tratamento de denominador zero;
- comportamento para preço, política ou spec desconhecido;
- período comum entre os veículos;
- componentes que entram no valor total da política;
- semântica de quantidade para specs numéricos;
- efeito de `product_specs.is_present = false`.

Resultados inválidos ou incompletos não devem ser convertidos silenciosamente em zero.

## Diferença para o comparador público

| Comparador público | Comparador administrativo |
|---|---|
| implementado no Next.js | planejado para o backoffice |
| exatamente 2 ou 3 veículos | uma referência e múltiplos comparados |
| veículos ativos, públicos e comparáveis | catálogo administrativo conforme permissões |
| união dos specs associados | todos os specs do master |
| calcula `isDifferent` | calcula indicadores técnicos e financeiros |
| sem preços e políticas implementados | inclui preços, políticas e monetização |
| pode evoluir para vantagens auditáveis | não aplica vencedor ou perdedor |

## Exportação

A exportação conterá uma única comparação:

1. identificação da referência e dos comparados;
2. bloco financeiro no topo;
3. comparação completa de specs abaixo.

Não serão exportados logs, alertas operacionais, metadados técnicos ou histórico completo. Múltiplas abas devem ser evitadas sem necessidade comprovada.
