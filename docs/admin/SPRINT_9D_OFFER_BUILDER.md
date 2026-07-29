# Sprint 9D — Offer Builder

## Escopo

`/admin/prices/offers` permite ao admin escolher Product, MSRP publicado, vigência e uma ou mais
Policies compatíveis. A tela mostra somente a composição explícita, o benefício total e o preço
transacional, preserva o formulário em erros e bloqueia duplo envio. O resultado sempre nasce em
`draft`; não publica Policy nem Offer.

## Fronteiras e invariantes

O fluxo é UI → Server Action → core/use case → repository → adapter Supabase → RPC. O browser não
define ator, correlation ou totais autoritativos. O servidor recarrega MSRP e Policies, rejeita IDs
ausentes/duplicados, Product divergente, cobertura insuficiente, status terminal e benefício acima do
MSRP. A RPC repete as regras sob locks e grava Offer, memberships e auditoria atomicamente.

Uma Policy pode ser reutilizada por várias Offers do mesmo Product. Policy draft pode integrar Offer
draft para viabilizar preparação; a publicação posterior da Offer continua exigindo todas as Policies
publicadas pelo lifecycle oficial.

## Segurança e limites

A RPC usa `SECURITY DEFINER`, `search_path = ''`, exige profile admin ativo e só concede execução a
`service_role`. RLS e grants das tabelas não foram relaxados. Não há edição, publicação, upload,
criação de Policy, alteração de preço ou escrita direta pelo browser nesta Sprint.
