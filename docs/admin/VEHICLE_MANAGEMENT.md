# Gestão Administrativa de Veículos

## Unidade administrativa

Um veículo representa uma combinação comercial específica de:

```text
marca + modelo + versão + MY + PY
```

Essa combinação é a chave de negócio aprovada. O identificador técnico permanece separado e é
atribuído pelo objeto físico existente. O índice único `unique_product` foi confirmado no Supabase
atual sobre `(brand, model, version, model_year, production_year)`. Por ser exato, ele não substitui
a comparação normalizada para diferenças de caixa e espaços.

## Criação

A criação deve:

1. exigir todos os componentes da chave de negócio;
2. normalizar espaços apenas segundo regra aprovada, sem reescrever nomenclaturas silenciosamente;
3. consultar duplicidade antes da gravação;
4. validar permissões e constraints;
5. registrar claramente sucesso, conflito ou falha;
6. permitir configurar os estados existentes de atividade e publicação sem confundi-los.

A consulta prévia normalizada reduz erros. O índice físico cobre concorrência para valores exatos;
variações simultâneas apenas de caixa ou espaços ainda representam risco residual até existir uma
proteção normalizada no banco.

## Edição

A edição altera apenas o registro selecionado e os campos autorizados. A interface deve apresentar a chave completa e distinguir `isActive` de `isPublic`. Mudanças que afetem a identidade comercial exigem nova validação de duplicidade.

A rota implementada é `/admin/products/[id]/edit`. Ela carrega o registro no servidor, reutiliza o
mesmo formulário e as mesmas regras do Create e retorna `notFound()` quando o ID não corresponde a
um produto. A busca de duplicidade exclui o próprio ID, permitindo salvar a chave sem alterações,
mas continua bloqueando conflito com qualquer outro produto.

Somente `brand`, `model`, `version`, `model_year`, `production_year`, `is_active` e `is_public` são
alterados. Como as inspeções registradas em `docs/data/SUPABASE_INSPECTION_RESULTS.md` e
`docs/data/LEGACY_BASELINE_EXTRACTION_RESULTS.md` não encontraram trigger de aplicação, o adapter
define `updated_at` explicitamente em toda atualização. Nenhuma migration foi necessária.

## Duplicação

Duplicar significa iniciar um novo Create em `/admin/products/[id]/duplicate`, usando somente os
sete campos editáveis do veículo de origem como valores iniciais. O ID original não integra o
formulário nem a criação, e o registro de origem permanece inalterado.

Não existe clone direto no banco, SQL de cópia ou persistência exclusiva. O fluxo reutiliza a
Server Action, o caso de uso, a normalização, a validação, o repository e o adapter do Create. A
validação normal de duplicidade impede salvar uma cópia idêntica; o administrador deve alterar ao
menos um componente da chave de negócio.

`product_specs`, preços, imagens, documentos e histórico não são carregados nem copiados. A
duplicação cria exclusivamente um novo registro principal de veículo após confirmação no
formulário.

## Specs e comparabilidade

Todos os spec codes do master devem estar disponíveis para consulta e associação. Para elegibilidade pública, não basta existir uma linha: deve haver ao menos um item comparável com valor válido segundo a semântica confirmada de `product_specs`.

**PENDENTE:** confirmar como `product_specs.is_present = false` afeta presença, validade e comparabilidade. A existência da associação não deve ser tratada como resposta definitiva antes dessa validação.

## Histórico

Preservar histórico significa não sobrescrever um veículo anterior para representar novo MY ou PY e nunca modificar a origem durante uma clonagem. O mecanismo físico de auditoria e histórico de alterações ainda depende de validação no Supabase atual.
