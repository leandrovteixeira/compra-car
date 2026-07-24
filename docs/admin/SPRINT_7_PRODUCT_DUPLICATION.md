# Sprint 7 — Duplicação administrativa de veículos

## Resultado

A rota `/admin/products/[id]/duplicate` permite usar um veículo existente como base para um novo
cadastro. A página exige role `admin`, carrega o registro principal server-side e usa `notFound()`
quando a origem não existe.

Duplicar significa iniciar um novo Create com os sete valores editáveis preenchidos. Não há clone
direto no banco, método de duplicação no repository ou adapter, SQL de cópia nem caso de uso
exclusivo.

## Fluxo

1. a listagem encaminha o administrador para `/admin/products/{id}/duplicate`;
2. a página autorizada consulta o veículo pelo ID;
3. `brand`, `model`, `version`, `model_year`, `production_year`, `is_active` e `is_public` preenchem
   o formulário compartilhado;
4. o ID original não é renderizado nem submetido;
5. o botão “Criar veículo” aciona a mesma Server Action e o mesmo `CreateAdministrativeVehicle` do
   cadastro comum;
6. o Create normaliza, valida, consulta duplicidade e insere somente o registro principal;
7. o modal de sucesso usa o ID recém-criado no link “Editar veículo”.

O título e o texto da página deixam explícito que a confirmação cria um novo cadastro. O usuário
decide quais valores alterar; não existe mudança automática de ano, status ou identidade.

## Integridade e duplicidade

A chave continua sendo `brand + model + version + model_year + production_year`. Submeter os
valores originais sem alterar essa chave retorna o mesmo conflito normalizado do Create. Não foi
adicionada validação paralela.

As regras compartilhadas permanecem vigentes: normalização de textos, relação entre os anos e
`Public implica Active`. A interface acopla os dois estados e o servidor revalida a regra.

## Dados deliberadamente não copiados

Somente um novo registro principal de veículo pode ser criado. O fluxo não lê nem copia:

- `product_specs` ou equipamentos;
- preços ou políticas;
- imagens;
- documentos;
- histórico.

“Cadastrar equipamentos” continua desabilitado no modal, conforme o estado do Create. Não houve
migration, alteração de schema ou escrita remota de teste.

## Cobertura

Os testes verificam carregamento e ausência da origem, os sete valores iniciais, reutilização do
formulário e do Create, ausência do ID original na submissão, conflito da chave inalterada, criação
após mudança com normalização, regra Public/Active, ação Duplicar na listagem, modal apontando para
o novo ID e inexistência de operações para copiar dados relacionados.

## Risco residual

Permanece o risco já documentado no Create: o índice físico é exato, enquanto a verificação da
aplicação normaliza caixa e espaços. Requisições concorrentes que diferem somente nessas variações
podem ultrapassar a consulta prévia. A Sprint 7 não altera schema para resolver esse risco.
