# Plano do baseline versionado do Supabase legado

## Objetivo e limite

Criar, após extração e revisão autorizadas, um baseline fiel do schema legado que permita reconstruir um banco Supabase vazio antes das migrations já versionadas. O trabalho não redesenha o banco, não corrige segurança, não renomeia objetos e não altera Appsmith ou ambiente remoto.

Nenhuma migration baseline definitiva foi criada nesta etapa.

O dump schema-only e os inventários remotos autorizados foram concluídos em 2026-07-21. Os resultados sanitizados estão em `LEGACY_BASELINE_EXTRACTION_RESULTS.md` e `LEGACY_BASELINE_RECONCILIATION.md`. A criação da migration continua bloqueada pela classificação dos dados estruturais de `specs` e pela revisão dos objetos duvidosos.

## Ordem alvo

O baseline deve ter timestamp anterior a `20260719150000`:

1. `20260719140000_legacy_schema_baseline.sql` — DDL próprio do legado;
2. `20260719141000_legacy_structural_data_baseline.sql` — somente se a auditoria confirmar dados estruturais indispensáveis;
3. `20260719150000_set_power_windows_positive_direction.sql` — migration existente, inalterada;
4. `20260721222256_create_auth_profiles.sql` — migration existente, inalterada;
5. migrations futuras.

Os dois primeiros arquivos formam um único baseline lógico. A separação entre DDL e dados estruturais mantém a revisão clara e evita misturar dados de negócio ao schema.

### Pré-requisito crítico da migration de power windows

A migration de `20260719150000` exige não apenas `public.specs`, mas uma linha com `code = 'CO_0043'` e `type = 'numeric'`. Um baseline exclusivamente DDL continuaria falhando em banco vazio.

Por isso, antes de finalizar a estratégia, é obrigatório classificar `specs` como catálogo estrutural ou definir outro snapshot estrutural fiel executado antes da correção. Não será criada uma linha fictícia, não se tornará a migration silenciosa e não se alterará a migration existente.

## Classificação inicial dos objetos

### A. Necessários no baseline

- schemas customizados confirmados;
- extensões diretamente exigidas por objetos próprios, declaradas sem recriar seus objetos internos;
- tipos, domains e enums próprios;
- tabelas `public` próprias vigentes;
- sequences próprias e ownership;
- constraints e índices vigentes;
- views e materialized views próprias;
- functions e triggers próprios;
- comentários necessários à fidelidade;
- estado vigente de RLS, policies e grants próprios;
- dependências próprias em objetos gerenciados, declaradas apenas quando suportadas pelo ambiente Supabase vazio.

Objetos staging/backup continuam incluídos nesta categoria de reconstrução até que haja evidência autorizando sua exclusão. A classificação como duvidoso não permite apagá-los do snapshot.

### B. Gerenciados pelo Supabase

- objetos internos de `auth` e `storage`;
- roles internas, incluindo `anon`, `authenticated` e `service_role`;
- objetos internos de Realtime, Vault e demais serviços da plataforma;
- objetos pertencentes a extensões dentro de `extensions` ou outro schema gerenciado;
- migrations internas da plataforma.

Esses objetos não serão recriados manualmente. O baseline poderá referenciá-los quando uma dependência própria exigir, com preflight compatível com uma stack Supabase real.

Também ficam fora do baseline legado, por já pertencerem à migration posterior da Sprint 2.1, `public.app_role`, `public.user_status`, `public.profiles` e suas functions, triggers, policies e grants. Se algum deles aparecer em um snapshot futuro por drift do remoto, deverá ser excluído do baseline e reconciliado com `20260721222256_create_auth_profiles.sql`, não duplicado.

### C. Dados estruturais candidatos a snapshot separado

- catálogo de `specs`, especialmente o registro `CO_0043` exigido pela migration seguinte;
- conversões em `unit_conversions`, se functions ou aplicação dependerem delas como referência fixa;
- meses ou códigos FIPE apenas se forem configuração estrutural, não histórico externo;
- outros catálogos pequenos cuja ausência impeça migrations ou inicialização.

Produtos, associações, preços, políticas, registros, históricos FIPE, staging e importações são dados de negócio por padrão e não entram no baseline sem decisão explícita. Qualquer export de dados será sanitizado e revisado separadamente.

### D. Objetos duvidosos que exigem revisão

- `products_active_backup`;
- tabelas `*_staging`;
- sobrecargas históricas de `duplicate_product_simple`;
- functions de duplicação sem consumidor confirmado;
- views de preço com semântica conhecida como problemática;
- objetos encontrados apenas em `Legacy/supabase/migrations/0001_initial_schema.sql`.

Objetos D observados no remoto devem ser preservados no snapshot bruto e só podem ser excluídos do baseline após decisão documentada. O arquivo histórico em `Legacy` não comprova existência atual.

## Extração proposta

### 1. Preparação local

- criar uma pasta de trabalho fora do repositório;
- registrar versão do Supabase CLI e PostgreSQL sem registrar credenciais;
- calcular hashes SHA-256 de todo artefato bruto;
- manter exports fora do Git até sanitização e revisão.

### 2. Snapshot schema-only

Com autorização explícita, executar a partir de `C:\Dev\compra-car`, usando somente o vínculo já existente:

```powershell
pnpm dlx supabase db dump --linked --schema public --keep-comments --file C:\Dev\compra-car-baseline-work\01_public_schema.sql
```

Esse comando consulta metadados/DDL do banco remoto e grava um dump schema-only local. Não executa DDL ou DML no remoto. O arquivo pode conter definições internas sensíveis e deverá permanecer fora do repositório até revisão.

Se a CLI solicitar senha do banco, ela deverá ser fornecida somente de forma interativa e não poderá aparecer no comando, terminal capturado, documentação ou arquivo. Não usar o flag `--password` com valor literal.

Não usar `db pull`, `db push`, `migration repair`, `link`, `--db-url` ou dump de dados amplo.

### 3. Inventários de metadados

Executar individualmente, em sessão confirmada e somente leitura, os scripts:

- `supabase/admin-inspection/01_objects.sql` a `10_row_estimates.sql`;
- `supabase/inspection/05_baseline_readiness.sql`.

Eles consultam `pg_catalog` e `information_schema`. O script de functions inclui corpos e exige sanitização antes de qualquer versionamento. Os scripts de validação de dados `11` a `15` não precisam ser repetidos para gerar DDL; serão usados apenas quando uma reconciliação quantitativa for aprovada.

### 4. Dependências entre schemas

Avaliar `auth`, `storage`, `extensions` e qualquer schema customizado somente para:

- FKs ou tipos referenciados por objetos próprios;
- extensões das quais objetos próprios dependem;
- funções próprias instaladas fora de `public`;
- buckets, policies ou objetos storage próprios, caso existam;
- publications que incluam tabelas próprias.

Objetos internos desses schemas serão classificados como gerenciados e excluídos do DDL manual.

### 5. Dados estruturais

Depois de revisar o DDL e as colunas atuais, preparar uma consulta `SELECT` explícita e limitada às colunas de cada catálogo estrutural aprovado. A consulta exata de `specs` permanece **PENDENTE** porque as colunas completas ainda não estão versionadas.

Nenhum dump data-only amplo será feito. O export deverá preservar a linha pré-correção esperada por `20260719150000`, com origem e hash registrados, sem fabricar dados.

## Normalização do dump

O dump bruto não deve ser promovido diretamente a migration. A revisão local deverá:

1. remover apenas ruído comprovadamente gerado pela ferramenta;
2. preservar nomes, tipos, defaults, owners compatíveis, constraints, índices e assinaturas;
3. substituir dependências gerenciadas somente quando a forma original não for portátil para uma stack Supabase vazia;
4. ordenar seções por dependência: extensões/tipos, tabelas/sequences, constraints/índices, functions, views, triggers, RLS/policies/grants;
5. manter objetos duvidosos até decisão explícita;
6. não incorporar a migration de autenticação no baseline;
7. não corrigir grants, RLS ou modelagem no mesmo arquivo.

Cada ajuste em relação ao dump bruto deverá constar de um registro de reconciliação.

## Validação de fidelidade

### Comparação estrutural

Gerar a mesma matriz de inventários no remoto e em uma sandbox Supabase local reconstruída. Comparar de forma determinística:

- schemas e objetos;
- colunas, tipos, nulabilidade e defaults;
- enums/domains;
- PKs, FKs, uniques e checks;
- índices;
- sequences e ownership;
- hashes normalizados de views e functions;
- triggers;
- RLS, policies e grants;
- extensões e dependências próprias;
- publications de objetos próprios.

Diferenças devem ser explicadas; nenhuma discrepância pode ser escondida para fazer o teste passar.

### Rebuild local

Em sandbox temporária, copiar somente:

1. baseline DDL;
2. baseline de dados estruturais aprovado;
3. migration de power windows;
4. migration de autenticação;
5. testes aplicáveis.

Executar futuramente `supabase db reset`, pgTAP e db lint apenas na sandbox autorizada. O rebuild deve demonstrar que a migration de power windows encontra `CO_0043`, e que a migration de autenticação continua independente do legado.

### Compatibilidade

- executar as projeções e testes do `LegacySupabaseAdapter` sem alterar contratos;
- validar que Appsmith encontra os mesmos nomes, colunas, views, signatures e grants;
- comparar contagens somente quando aprovadas, sem transportar dados pessoais ou comerciais ao Git;
- manter o banco remoto sem alterações durante toda a validação.

## Riscos

- snapshot remoto pode ter drift após a inspeção anterior;
- pg_dump pode incluir owners/ACLs dependentes de roles gerenciadas;
- functions podem conter conteúdo sensível e dependências não óbvias;
- excluir staging ou backup pode quebrar Appsmith/ETL ainda não inventariado;
- reproduzir grants inseguros é necessário para fidelidade, mas exige hardening posterior;
- incluir dados de negócio no baseline pode expor informações e inflar o Git;
- omitir dados estruturais fará a migration de power windows falhar;
- o protótipo em `Legacy` pode induzir reconstrução incorreta;
- views/functions podem depender de extensões ou ordem de criação;
- diferenças de versão do PostgreSQL podem alterar o DDL gerado.

## Critério para autorizar a migration definitiva

A migration só deve ser criada depois de:

- dump schema-only autorizado, hashado e revisado;
- inventário remoto/local reconciliado;
- classificação explícita dos dados estruturais;
- decisão sobre objetos duvidosos;
- validação de dependências gerenciadas;
- aprovação do recorte final e da divisão das migrations.
