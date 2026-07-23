# Escopo Administrativo

## Objetivo

A área `admin` permitirá operar o catálogo e produzir comparações administrativas sem acoplar o domínio à tecnologia de interface. Ela será construída na mesma aplicação Next.js da área `seller`, sobre o Supabase compartilhado. Esta definição não declara os fluxos administrativos como implementados.

## Fase 1

- página inicial com acesso às funções administrativas;
- cadastro, edição e clonagem de veículos;
- associação e visualização de specs;
- gestão de preços e políticas comerciais exclusivamente em grade;
- comparador administrativo técnico e financeiro;
- exportação de uma comparação.

## Significado de sem mudança de schema

Durante a Fase 1 não serão criados, removidos ou alterados:

- tabelas ou colunas;
- constraints ou índices;
- views ou materialized views;
- functions, RPCs ou procedures;
- triggers;
- policies, RLS, grants ou outros objetos estruturais.

Inserts e updates nos objetos existentes poderão ocorrer somente depois da validação das permissões, constraints, regras de negócio e efeitos sobre consumidores atuais. A decisão não autoriza escrita antecipada nem presume que o schema atual suporta todos os fluxos.

## Limites

- Appsmith não define o domínio, foi descontinuado como arquitetura-alvo e permanece somente como referência histórica;
- nomes físicos confirmados ficam documentados na camada de dados ou nas queries da ferramenta, não nos conceitos de negócio;
- nenhuma alteração será feita em `Legacy`;
- autenticação, autorização, concorrência, auditoria e invalidação de cache precisam ser verificadas antes da operação real;
- lacunas estruturais encontradas devem ser registradas para decisão posterior, não corrigidas silenciosamente na Fase 1.

## Fase 2

A Fase 2 introduz importações assistidas por IA, staging obrigatório, revisão humana e promoção controlada. A existência e o desenho dos objetos de staging dependem de decisão arquitetural e poderão exigir uma fase futura de schema, fora da Fase 1.

## Dependências pendentes

- **CONFIRMADO:** export e estrutura de edição históricos do Appsmith, preservados como referência;
- consumidores e dependências das integrações históricas, antes de eventual remoção;
- permissões de leitura e escrita, RLS e grants;
- constraints reais da chave de negócio dos veículos;
- objetos de preço, política, vigência e moeda;
- semântica de `product_specs.is_present`, inclusive quando for `false`;
- fonte e semântica do valor monetário master de specs;
- estratégia de auditoria, concorrência e invalidação do cache do Next.js.
