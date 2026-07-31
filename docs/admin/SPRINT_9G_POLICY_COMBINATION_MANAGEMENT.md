# Sprint 9G — Gestão de políticas e combinações

## Objetivo futuro

Criar uma interface administrativa para consultar e administrar Policies e combinações já
inseridas. Esta Sprint está registrada como próxima etapa e não integra a implementação da 9F.1.

## Escopo inicial previsto

### Políticas

- listagem, busca e filtros;
- veículo, tipo, status, vigência e benefício;
- detalhe;
- edição compatível com o workflow.

### Combinações

- listagem e veículo;
- Policies participantes e MSRP resolvido;
- vigência, status e Total;
- detalhe;
- edição compatível com o workflow.

Um modal pode oferecer detalhe rápido, mas não deve ser assumido como a única interface de gestão.

## Decisões pendentes

Antes da implementação, revisar e definir as regras de edição para registros `draft`, `published` e
`archived`, além de supersession e auditoria. Registros terminais não devem se tornar editáveis por
conveniência de interface.
