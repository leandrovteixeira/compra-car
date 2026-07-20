# Gestão Administrativa de Veículos

## Unidade administrativa

Um veículo representa uma combinação comercial específica de:

```text
marca + modelo + versão + MY + PY
```

Essa combinação é a chave de negócio aprovada. O identificador técnico permanece separado e é atribuído pelo objeto físico existente. A constraint equivalente aparece apenas em evidência histórica de `Legacy`; sua existência no Supabase atual permanece pendente.

## Criação

A criação deve:

1. exigir todos os componentes da chave de negócio;
2. normalizar espaços apenas segundo regra aprovada, sem reescrever nomenclaturas silenciosamente;
3. consultar duplicidade antes da gravação;
4. validar permissões e constraints;
5. registrar claramente sucesso, conflito ou falha;
6. permitir configurar os estados existentes de atividade e publicação sem confundi-los.

A consulta prévia reduz erros, mas não substitui uma constraint física em cenários concorrentes.

## Edição

A edição altera apenas o registro selecionado e os campos autorizados. A interface deve apresentar a chave completa e distinguir `isActive` de `isPublic`. Mudanças que afetem a identidade comercial exigem nova validação de duplicidade.

## Clonagem

Clonar significa usar um veículo existente como origem para criar outro registro, normalmente para novo MY ou PY.

- o registro original permanece inalterado;
- a nova chave deve ser informada e validada;
- specs elegíveis podem ser copiadas após confirmação do usuário;
- a operação deve apresentar previamente o que será copiado;
- falhas parciais não podem ser apresentadas como sucesso completo;
- preços e políticas não são copiados implicitamente.

## Specs e comparabilidade

Todos os spec codes do master devem estar disponíveis para consulta e associação. Para elegibilidade pública, não basta existir uma linha: deve haver ao menos um item comparável com valor válido segundo a semântica confirmada de `product_specs`.

**PENDENTE:** confirmar como `product_specs.is_present = false` afeta presença, validade e comparabilidade. A existência da associação não deve ser tratada como resposta definitiva antes dessa validação.

## Histórico

Preservar histórico significa não sobrescrever um veículo anterior para representar novo MY ou PY e nunca modificar a origem durante uma clonagem. O mecanismo físico de auditoria e histórico de alterações ainda depende de validação no Supabase atual.
