# Testes SQL

Os arquivos desta pasta usam pgTAP e são executados pelo Supabase CLI:

```powershell
supabase test db supabase/tests/spec_integrity.sql
```

O banco alvo precisa conter o schema legado e a extensão pgTAP no schema `extensions`. O comando
normal usa a stack local já iniciada; conexões alternativas devem ser explicitamente autorizadas.

## Integridade de Specs

`spec_integrity.sql` não contém DML ou DDL explícito sobre tabelas permanentes. Ele consulta
`products`, `specs` e `product_specs`, finaliza o relatório pgTAP e executa `ROLLBACK`. A diretiva
`SET TRANSACTION READ ONLY` não é usada porque `plan()` pode precisar criar objetos temporários
internos. O isolamento principal é fornecido pela transação automática de `supabase test db`, que é
revertida ao final; o `ROLLBACK` explícito também segue o padrão pgTAP do projeto.

O teste não cria fixtures, migrations ou correções. Objetos temporários internos eventualmente
criados pelo pgTAP pertencem apenas à execução do runner.

Cada inconsistência produz uma linha de diagnóstico antes da respectiva asserção. O resumo final é
`✔ Todos os testes passaram` ou `✖ N inconsistências encontradas`.

Para numeric, `input_unit` é obrigatória e deve coincidir sem diferença de caixa ou espaços quando
`specs.unit` declara uma unidade. Também é inválido combinar `is_present = true` com `value` nulo.
