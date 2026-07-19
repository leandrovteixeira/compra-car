# ADR-002 — Itens scale sem cardinalidade no MVP

- **Status:** aceito
- **Data:** 2026-07-18

## Contexto

Não existe regra validada que classifique conjuntos de opções como `single` ou `multiple`, nem que prove exclusividade entre itens do mesmo `specSet`.

## Decisão

No MVP, cada item `scale` é uma linha de presença independente, com `present: boolean`. Não haverá cardinalidade nem agrupamento obrigatório por option set.

## Consequências

- `is_present` é preservado e a associação ausente resulta em `present: null`;
- combinações não são consideradas incompatíveis sem regra documentada;
- cardinalidade explícita e agrupamento visual ficam no backlog pós-MVP.
