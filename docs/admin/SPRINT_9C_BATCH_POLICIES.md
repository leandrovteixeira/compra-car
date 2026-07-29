# Sprint 9C — Batch Policies

A rota `/admin/prices/policies/input` oferece cards responsivos com linha vazia automática, limite de
100 linhas e campos discriminados para os dez tipos atuais. `registration` permanece histórico e não
é aceito. Trocar o tipo limpa os parâmetros específicos anteriores.

O salvamento é atômico. Cada linha cria batch provenance, row, output, audit e uma Policy `draft`.
Valores fixos aceitam entrada monetária pt-BR. Emplacamento, IPVA, seguro e financiamento recarregam
o MSRP publicado; financiamento seleciona o Parameter Set publicado aplicável à vigência.

Não faz parte da Sprint: publicação, Offers, memberships, importação externa ou alteração do lifecycle.
