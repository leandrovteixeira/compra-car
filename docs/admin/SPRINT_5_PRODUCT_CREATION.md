# Sprint 5 — Criação administrativa de veículos

## Escopo entregue

`/admin/products/new` cria somente o registro principal de `products`. O formulário contém marca,
modelo, versão, ano modelo, ano de produção, atividade e publicação. Equipamentos, `product_specs`,
preços, imagens, edição, duplicação e exclusão permanecem fora do fluxo.

## Fluxo e fronteiras

1. a página e a operação chamam `requireRole('admin')`;
2. a operação autoriza antes de construir o adapter privilegiado;
3. marca, modelo e versão são normalizados no caso de uso;
4. o caso de uso valida obrigatoriedade, anos e publicação;
5. o adapter pesquisa candidatos dos mesmos anos e compara a identidade normalizada;
6. o insert usa sete colunas explícitas e retorna somente `id`;
7. `/admin/products` é revalidada;
8. a interface abre um diálogo de sucesso com retorno funcional à lista.

O componente visual depende apenas do DTO tipado da Server Action. Supabase e nomes físicos ficam
restritos ao adapter.

## Regras

- espaços externos são removidos e espaços internos repetidos viram um;
- somente o primeiro caractere alfabético é convertido para maiúscula;
- ano modelo e ano de produção são inteiros de quatro dígitos maiores que 2000;
- produção deve ser igual ao modelo ou exatamente um ano menor;
- público exige ativo;
- marcar Público ativa o veículo; desmarcar Ativo também desmarca Público;
- os defaults de Ativo e Público são `false`.

## Refinamento final

Os anos são selects dependentes. Ano modelo é gerado no servidor do ano corrente + 2 até 2001,
em ordem decrescente. Ano produção permanece desabilitado até a seleção do modelo e então oferece
somente o mesmo ano e o anterior; uma troca incompatível limpa a produção escolhida. As mesmas
regras continuam validadas no servidor.

`/admin/products` aceita filtros GET por modelo (`vehicle`), marca, versão, atividade e publicação.
Os textos são aparados no servidor e aplicados com `ilike`; booleanos usam igualdade. Todos os
predicados são encadeados com AND pelo adapter, sem carregar a tabela em Client Component.
“Limpar filtros” aponta para `/admin/products` sem parâmetros.

No desktop, o header administrativo ocupa 4,25rem; título e filtros formam um bloco sticky opaco
de 15rem; o cabeçalho da tabela usa o offset acumulado de 19,25rem. O overflow horizontal deixa de
ser um ancestral de scroll no breakpoint desktop, preservando o sticky sem criar scroll vertical
concorrente. Em telas menores, título, filtros e tabela seguem o fluxo normal para preservar espaço.

## Duplicidade e concorrência

Inativos também bloqueiam duplicidade. A comparação ignora caixa, espaços externos e espaços
internos repetidos. O índice `unique_product` protege a combinação exata e conflitos `23505` são
convertidos em resultado de duplicidade seguro. Como o índice não usa a mesma normalização da
aplicação, duas requisições simultâneas com diferenças apenas de caixa ou espaços ainda podem criar
duas linhas. Nenhuma migration foi criada nesta sprint.

## Auditoria estrutural de specs

`supabase/admin-inspection/16_specs_structure_audit.sql` documenta uma inspeção somente leitura para:

- contar registros `numeric`, `binary` e grupos `scale`;
- conferir `detail = spec_set` para `numeric` e `binary` após normalização simples de espaços;
- identificar `detail` repetido no mesmo trio `group_name + equipment_group + spec_set`;
- conferir que opções `scale` possuem `id` e `code`.

O script versionável `packages/adapter-supabase/scripts/audit-spec-structure.mjs` executou essa
auditoria no Supabase remoto configurado, estritamente por `select`:

- 59 registros `numeric`;
- 171 registros `binary`;
- 90 registros `scale`, distribuídos em 26 grupos;
- nenhum `detail` repetido dentro do mesmo trio `scale`;
- nenhuma opção `scale` sem `id` ou `code`;
- três divergências em `detail = spec_set`:
  - `CO_0044` (`numeric`): `One-Touch` / `Down`;
  - `CO_0045` (`numeric`): `One-Touch` / `Up & Down`;
  - `PW_0042` (`binary`): `FR Suspension` / `FR McPherson`.

Nenhum dado foi corrigido. A auditoria avalia o snapshot consultado nesta rodada e não cria garantia
contínua contra mudanças posteriores no catálogo.
