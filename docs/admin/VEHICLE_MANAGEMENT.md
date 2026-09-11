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
define `updated_at` explicitamente em toda atualização. A implementação original da edição não
exigiu migration; a Sprint 17R.1 acrescenta a constraint de estado descrita abaixo.

## Status inline — Sprint 17R.1

Ativo/Inativo e Público/Privado na listagem são botões com a mesma aparência dos badges, sem modal.
Cada clique passa pela autorização admin e envia uma intenção de alteração de status, sem
normalizar/regravar identidade. A operação dedicada rejeita IDs inválidos, múltiplos
campos, campos desconhecidos e valores não booleanos. Durante pending mantém texto/tamanho e bloqueia
cliques duplicados. Erros são anunciados com `role="alert"` e não simulam sucesso.

Active representa monitoramento interno e Public a decisão editorial/confidencial.
**Public requires Active:** Active/Public, Active/Private e Inactive/Private são válidos;
Inactive/Public é rejeitado. Esta regra substitui a independência irrestrita da Sprint 17R.

| Intenção | Persistência, além de `updated_at` |
| --- | --- |
| Desativar | `is_active=false` e `is_public=false`, no mesmo UPDATE |
| Ativar | somente `is_active=true`; permanece Private |
| Publicar | somente `is_public=true`, condicionado a `is_active=true` no UPDATE |
| Despublicar | somente `is_public=false`; preserva Active |

O badge de publicação fica desabilitado enquanto inativo, com explicação acessível “Ative o veículo
antes de publicá-lo.” O formulário compartilhado de criação/edição/duplicação desmarca Public ao
desativar e bloqueia a seleção de Public enquanto inativo. Reativar não publica automaticamente.
Server/core rejeitam submissões Inactive/Public. A constraint `products_public_requires_active`
protege também imports e SQL; sua migration não modifica registros existentes.

Os filtros administrativos permanecem combináveis e o refresh mantém a URL atual com busca/filtros.
Toggle Public, desativação (que também despublica) e edição completa expiram a tag global do catálogo
após sucesso; na versão instalada Next 15.5.20 isso usa `revalidateTag(tag)` imediato.

## Duplicação

Duplicar em `/admin/products/[id]/duplicate` usa os sete campos editáveis da origem como valores
iniciais e cria uma nova identidade comercial. O ID original não integra os campos editáveis e o
registro de origem permanece inalterado.

Uma Server Action específica chama `DuplicateAdministrativeVehicle`. O caso de uso reutiliza
`CreateAdministrativeVehicle` e, após obter o novo ID, copia todas as associações técnicas pelo
contrato `AdministrativeProductDuplicationRepository`. O adapter lê e grava `product_specs`; a UI
permanece desacoplada da persistência.

A cópia troca apenas `product_id` e deixa o banco gerar identidade e timestamps próprios.
`equipment_id`, `value`, `is_present` e `input_unit` são preservados, inclusive binary `false`.
Preços, imagens, documentos, histórico e auditoria não fazem parte do contrato e não são copiados.

Se copiar a ficha falhar, o fluxo não retorna sucesso e tenta remover os specs e o produto
recém-criados. Como criação, cópia e compensação são operações PostgREST separadas, permanece uma
janela sem atomicidade estrita; falha da compensação devolve o ID incompleto para revisão.

## Specs e comparabilidade

O catálogo Comparar exige Public e existência de associação com spec ativa, sem exigir preço.
Na Sprint 17R.1, produtos e associações são paginados em lotes de 500, com ordenação estável e
`specs!inner(id)` filtrando spec ativa no servidor. Apenas IDs elegíveis são acumulados. A consulta
anterior perdia produtos quando `product_specs` excedia 1.000 linhas. A base não possui FK entre
product_specs e products, impedindo o join direto preferido; nenhuma FK nova foi criada.
Latest continua após a elegibilidade.
Ver Modelo continua Public → preço público vigente → latest, com scores e função latest preservados.

Todos os spec codes do master devem estar disponíveis para consulta e associação. Para elegibilidade pública, não basta existir uma linha: deve haver ao menos um item comparável com valor válido segundo a semântica confirmada de `product_specs`.

**PENDENTE:** confirmar como `product_specs.is_present = false` afeta presença, validade e comparabilidade. A existência da associação não deve ser tratada como resposta definitiva antes dessa validação.

## Histórico

Preservar histórico significa não sobrescrever um veículo anterior para representar novo MY ou PY e nunca modificar a origem durante uma clonagem. O mecanismo físico de auditoria e histórico de alterações ainda depende de validação no Supabase atual.
