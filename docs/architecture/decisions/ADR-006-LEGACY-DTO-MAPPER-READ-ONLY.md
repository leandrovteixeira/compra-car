# ADR-006 — DTO e mapper isolam o Supabase legado em modo somente leitura

- **Status:** aceito
- **Data:** 2026-07-18

## Contexto

O MVP precisa consumir o Supabase atual sem acoplar o domínio e o frontend aos nomes físicos, sem reestruturar o banco e sem depender de uma nova carga do Excel.

## Decisão

`packages/adapter-supabase` implementa as portas do core por meio de DTOs internos e mapeadores explícitos. Somente `products`, `specs` e `product_specs` são consultadas. O cliente usa credencial privada apenas no servidor e o pacote não oferece operações de escrita.

Falhas de query e dados inválidos são traduzidas em erros próprios do adaptador. Tipos desconhecidos e valores numéricos inválidos não são corrigidos silenciosamente.

## Consequências

- o frontend recebe somente entidades e contratos normalizados;
- mudanças físicas futuras ficam concentradas no adaptador;
- consultas são feitas em lote e evitam N+1;
- correções de dados, FKs e encoding permanecem graduais e pós-MVP;
- uma futura estrutura Supabase V2 pode substituir o adaptador sem alterar os contratos públicos.
