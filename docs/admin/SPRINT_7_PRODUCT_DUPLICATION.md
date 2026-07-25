# Sprint 7 — Duplicação administrativa de veículos

## Resultado

A rota `/admin/products/[id]/duplicate` permite usar um veículo existente como base para um novo
cadastro. A página exige role `admin`, carrega o registro principal server-side e usa `notFound()`
quando a origem não existe.

Duplicar cria um novo `product` com os sete valores editáveis preenchidos e copia sua ficha técnica
atual. A cópia é orquestrada por `DuplicateAdministrativeVehicle` no Core, por meio de um contrato
específico implementado pelo adapter; React não lê nem grava Supabase.

## Fluxo

1. a listagem encaminha o administrador para `/admin/products/{id}/duplicate`;
2. a página autorizada consulta o veículo pelo ID;
3. `brand`, `model`, `version`, `model_year`, `production_year`, `is_active` e `is_public` preenchem
   o formulário compartilhado;
4. a rota vincula o ID original à Server Action de duplicação sem renderizá-lo como campo editável;
5. `DuplicateAdministrativeVehicle` reutiliza `CreateAdministrativeVehicle` para normalização,
   validação, duplicidade e criação do registro principal;
6. somente depois da criação, o adapter lê todas as associações da origem e grava um novo lote para
   o novo `product_id`;
7. o lote preserva `equipment_id`, `value`, `is_present` e `input_unit`; IDs próprios, timestamps e
   o `product_id` original não entram no payload;
8. o modal de sucesso oferece edição cadastral e acesso direto à ficha copiada em
   `/admin/products/{newId}/specs`.

O título e o texto da página deixam explícito que a confirmação cria um novo cadastro. O usuário
decide quais valores alterar; não existe mudança automática de ano, status ou identidade.

## Integridade e duplicidade

A chave continua sendo `brand + model + version + model_year + production_year`. Submeter os
valores originais sem alterar essa chave retorna o mesmo conflito normalizado do Create. Não foi
adicionada validação paralela.

As regras compartilhadas permanecem vigentes: normalização de textos, relação entre os anos e
`Public implica Active`. A interface acopla os dois estados e o servidor revalida a regra.

## Dados copiados e limites

Cada linha de `product_specs` é recriada para o novo produto. Numeric preserva `value` e
`input_unit`; binary preserva tanto `true` quanto `false` explícito; scale preserva as associações
selecionadas. As linhas são independentes da origem.

O fluxo não lê nem copia:

- preços ou políticas;
- imagens;
- documentos;
- histórico ou auditoria.

Não houve migration, alteração de schema ou escrita remota de teste.

## Falhas e compensação

Se a criação falhar, nenhuma leitura ou escrita de specs é iniciada. Se a leitura ou gravação da
ficha falhar depois da criação, o resultado não é sucesso e o adapter tenta compensar somente o ID
recém-criado: remove primeiro seus `product_specs` e depois o `product`.

Create, upsert de specs e compensação são requests PostgREST separados. Sem RPC/migration não há
transação única entre eles. Se a compensação também falhar, a mensagem devolve o ID incompleto para
revisão administrativa. Uma resposta de criação perdida antes de retornar o novo ID também não
pode ser compensada automaticamente.

## Cobertura

Os testes verificam novo ID, cópia integral, numeric, binary `true`/`false`, scale, `input_unit`,
origem vazia, independência, exclusão de outros dados, falhas de criação/cópia, compensação e link
da ficha do novo produto.

## Risco residual

Permanece o risco já documentado no Create: o índice físico é exato, enquanto a verificação da
aplicação normaliza caixa e espaços. Requisições concorrentes que diferem somente nessas variações
podem ultrapassar a consulta prévia. Soma-se a limitação de atomicidade entre criação, cópia e
compensação descrita acima. A Sprint 7 não altera schema para resolver esses riscos.
