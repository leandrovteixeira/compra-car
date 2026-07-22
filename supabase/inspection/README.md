# Inspeção somente leitura do Supabase atual

Esta pasta contém consultas preparadas para uma inspeção manual e controlada. Nenhuma delas foi executada durante sua criação.

## Arquivos

### `01_schema_inventory.sql`

Lista schemas não internos, tabelas, views, materialized views, colunas, tipos, nulabilidade, defaults, enums, constraints, índices, comentários, estimativas de linhas e metadados de funções. Não consulta conteúdo das tabelas de negócio.

### `02_relationship_inventory.sql`

Lista foreign keys, colunas de origem e destino, ações referenciais, chaves primárias, constraints únicas e candidatas técnicas a tabelas de associação. As cardinalidades apresentadas são inferências estruturais, não regras de negócio.

### `03_rls_inventory.sql`

Lista tabelas com RLS, políticas, expressões declaradas, grants de leitura e views com possível exposição a roles comuns. Não altera políticas ou permissões.

### `04_candidate_data_profile.sql`

Fornece modelos comentados para perfilar objetos candidatos depois da revisão dos inventários. Por padrão, não contém consulta executável e usa placeholders deliberadamente inválidos.

### `05_baseline_readiness.sql`

Complementa o inventário para preparação de baseline com extensões, schemas e ACLs, enums/domains, definições de views, privilégios completos, default privileges, publications e FKs de `public` para outros schemas. Consulta somente metadados e não altera nenhum objeto.

## Ordem de execução

1. Confirmar visualmente o projeto e o ambiente corretos no painel do Supabase.
2. Abrir o SQL Editor já autenticado, sem copiar credenciais.
3. Executar, uma consulta por vez, os blocos de `01_schema_inventory.sql`.
4. Executar, uma consulta por vez, os blocos de `02_relationship_inventory.sql`.
5. Executar, uma consulta por vez, os blocos de `03_rls_inventory.sql`.
6. Exportar, sanitizar e revisar os resultados.
7. Identificar objetos candidatos e preencher inicialmente `docs/data/LEGACY_SUPABASE_MAP.md`.
8. Somente depois disso, copiar os modelos necessários de `04_candidate_data_profile.sql`, substituir placeholders confirmados e submetê-los a revisão.
9. Executar apenas os blocos do arquivo `04` que tiverem sido revisados.
10. Consolidar descobertas em `docs/data/SUPABASE_INSPECTION_RESULTS.md`.

Para a Sprint 2.2, execute `05_baseline_readiness.sql` somente depois de autorização explícita para consultar o ambiente remoto e trate sua saída com a mesma sanitização dos demais inventários.

## Como executar no SQL Editor

- Abra um novo rascunho no SQL Editor do ambiente confirmado.
- Copie apenas a consulta que será executada naquele momento.
- Leia novamente a consulta e confirme que ela é somente leitura.
- Execute a consulta e registre seu nome junto ao resultado.
- Não execute funções de negócio encontradas pelo inventário.
- Não use uma role mais privilegiada do que a necessária para a inspeção aprovada.

Os scripts `01`, `02` e `03` são somente leitura e consultam metadados. Eles não corrigem nem configuram o banco.

## Como salvar ou exportar resultados

- Exporte cada conjunto como CSV ou JSON somente quando necessário.
- Use nomes que identifiquem o script e o bloco, sem incluir URL, project ref secreto ou credencial.
- Revise o arquivo exportado antes de compartilhar ou versionar.
- Prefira registrar conclusões e contagens nos documentos em vez de versionar dumps brutos.
- O local definitivo para exportações sanitizadas está **PENDENTE**.

## Resultados necessários para revisão

- lista de schemas e objetos candidatos;
- colunas, tipos, defaults, enums e comentários relevantes;
- chaves, foreign keys e candidatas a associações;
- metadados de funções potencialmente relacionadas, sem executá-las;
- estado de RLS e políticas da superfície candidata;
- grants de leitura para as roles que poderão atender o MVP;
- possíveis views já adequadas para leitura;
- depois da revisão do arquivo `04`, contagens, cobertura, nulos, duplicidades, datas e amostras sanitizadas.

## Segurança

- Nunca registrar chave de `service role`, chave secreta, senha, token, JWT ou string completa de conexão.
- Não colar credenciais em SQL, documentação, capturas ou resultados.
- Não exportar dados pessoais, segredos ou políticas comerciais confidenciais.
- Não usar `SELECT *` em amostras.
- Limitar toda amostra a no máximo 20 registros.
- Tratar nomes encontrados em `Legacy` apenas como hipótese histórica.
- Interromper se houver dúvida sobre efeito colateral, permissão ou sensibilidade.

## Regra obrigatória para o arquivo 04

Não execute `04_candidate_data_profile.sql` antes de substituir e revisar os placeholders. Cada bloco deve permanecer comentado até que os nomes físicos sejam confirmados pelos inventários e a seleção de colunas seja considerada segura.
