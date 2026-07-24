# Sprint 8 — Administração de equipamentos e especificações

## Objetivo

`/admin/products/[id]/specs` apresenta a ficha técnica administrativa completa do veículo. Todos os
specs ativos são carregados, inclusive os ainda sem associação, e organizados pela hierarquia real
`group_name → equipment_group → spec_set → detail`.

## Arquitetura

```text
page / Server Action
  → LoadAdministrativeProductSpecs / SaveAdministrativeProductSpecs
  → AdministrativeProductSpecsRepository
  ← LegacySupabaseAdapter
  ← specs + product_specs + unit_conversions
```

Componentes não conhecem nomes físicos do Supabase. O core monta o modelo administrativo, valida
submissões, normaliza numeric, garante exclusividade scale e aplica conversões. O adapter traduz o
lote para `product_specs`.

## Hierarquia e edição

- `group_name`: seção principal recolhível, com contador discreto;
- `equipment_group`: subtítulo dentro da seção;
- numeric/binary: uma linha por spec;
- scale: uma linha e um dropdown por conjunto `group_name + equipment_group + spec_set`;
- `detail` não é repetido visualmente quando coincide com `spec_set`.

A busca client-side indexa grupo, subgrupo, conjunto, detalhe, código e unidade. Durante a busca,
grupos sem resultado somem e os restantes abrem, sem reconstruir o estado local.

## Semântica

- numeric preenchido possui `value`; vazio remove a associação e permanece `NULL`, nunca zero;
- binary sempre tem estado válido; marcado/desmarcado é persistido em `is_present`;
- scale conserva um spec por alternativa; o dropdown seleciona no máximo uma associação presente;
- `-` remove todas as associações do conjunto scale.

Numeric aceita inteiro, vírgula ou ponto e no máximo duas casas decimais. A apresentação
administrativa não completa zeros.

## Contadores e salvamento

Binary conta como preenchido nos dois estados. Numeric vazio e scale sem seleção não contam. A
barra sticky mostra total geral, quantidade de campos modificados, Descartar e Salvar alterações.
Falhas preservam o estado local; sucesso recarrega o modelo normalizado e permanece na rota.

O adapter usa no máximo um `upsert` coletivo, com conflito
`product_id,equipment_id`, e um `delete` coletivo. Isso é uma operação lógica única na aplicação,
mas PostgREST não oferece transação entre os dois requests sem RPC. O upsert ocorre primeiro para
reduzir risco de perda; uma falha posterior pode deixar atualização parcial. Resolver atomicidade
estrita exigiria RPC/migration e ficou fora desta Sprint.

## Torque e conversões

`PW_0012`, `PW_0023`, `PW_0026` e `PW_0033` aceitam entrada em `Nm` ou `kgfm`. Valores existentes
abrem em `Nm`. Ao receber `kgfm`, o core lê `unit_conversions`, aplica
`valor × multiplier + offset_value` uma vez e persiste somente o valor canônico em `Nm`, com
`input_unit = Nm`. Nenhum fator foi codificado na UI, core ou adapter.

`PW_0036` continua numeric comum em `kg/Nm`: não é convertido, recalculado nem apresentado como
`kgfm/t`.

## MVP-u

A leitura atual do comparador entrega valores já mapeados de forma síncrona à apresentação. Inserir
conversões obtidas do banco exigiria ampliar o contrato/caso de uso de comparação. Para não
duplicar fatores nem aumentar esta Sprint, a exibição exclusiva de torque em `kgfm` no MVP-u ficou
como próxima tarefa. Binary continua usando indicador visual e ausências não viram zero técnico.

## Ausência de migration

Não houve migration, alteração de schema, criação de spec em `kgfm` ou persistência duplicada de
torque. O modelo atual suporta a ficha, unidade de entrada e persistência canônica.

## Evoluções futuras

- RPC transacional para atomicidade estrita do lote;
- erros de validação por linha;
- confirmação de smoke test com os 320 registros reais;
- conversão de apresentação em kgfm no caso de uso do MVP-u;
- revisão do drift observado entre as contagens binary/scale;
- eventual política explícita de arredondamento e `decimal_places`.
