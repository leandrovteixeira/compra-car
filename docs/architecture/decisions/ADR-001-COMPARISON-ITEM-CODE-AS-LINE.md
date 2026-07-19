# ADR-001 — ComparisonItem.code identifica uma linha

- **Status:** aceito
- **Data:** 2026-07-18

## Contexto

Os dados podem conter vários itens relacionados ao mesmo grupo ou `specSet`. Consolidá-los implicitamente eliminaria diferenças reais e faria a arquitetura depender de convenções ainda não auditadas.

## Decisão

Cada `ComparisonItem.code` representa exatamente uma linha independente no MVP. O serviço rejeita codes duplicados no mesmo resultado.

## Consequências

- dois codes relacionados continuam visíveis separadamente;
- o adaptador legado deve produzir codes estáveis;
- agrupamento visual não altera a identidade das linhas;
- revisão dos prefixes legados permanece no backlog.
