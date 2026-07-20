# ADR-004 — isActive e isPublic são estados distintos

- **Status:** aceito
- **Data:** 2026-07-18

## Contexto

Vigência comercial e revisão editorial respondem a perguntas diferentes. Um veículo ativo pode ainda não estar liberado para publicação, e um cadastro historicamente público pode deixar de estar vigente.

## Decisão

`isActive` representa vigência comercial. `isPublic` representa revisão e liberação editorial. O catálogo público exige ambos e pelo menos um item comparável com valor válido conforme a semântica confirmada de `product_specs`.

Permanece **PENDENTE** confirmar como `product_specs.is_present = false` afeta presença, validade e comparabilidade; a existência da associação não encerra essa decisão.

## Consequências

- nenhuma flag substitui a outra;
- o adaptador deverá mapear as duas sem inferência silenciosa;
- a validação online opt-in deve conferir a cobertura real de cada estado.
