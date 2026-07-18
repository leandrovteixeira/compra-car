# Compra Car

Nome provisório do produto: **Compra Car**.

## Objetivo do produto

O Compra Car ajudará vendedores de concessionárias a comparar veículos de forma clara durante o atendimento. O produto deverá facilitar a identificação de diferenças e vantagens e permitir que o resultado seja compartilhado com o cliente.

## Público-alvo

Vendedores de concessionárias.

## MVP

O MVP será mobile-first e permitirá:

- comparar 2 ou 3 veículos;
- exibir apenas as diferenças;
- filtrar somente as vantagens;
- gerar e compartilhar um PDF com a comparação;
- apresentar um aviso legal;
- adaptar a identidade visual por marca sem sugerir vínculo oficial com montadoras sem autorização.

O texto do aviso legal e as regras exatas de comparação estão **PENDENTE**.

## Arquitetura transitória

- Appsmith → operação interna;
- Supabase atual → dados;
- Next.js → experiência do vendedor;
- Railway → publicação;
- Adaptador Legacy → isolamento entre o frontend e o banco atual.

O Next.js ainda não foi criado e não há conexão com o Supabase neste marco.

## Arquitetura futura

- Novo backoffice → operação interna;
- Supabase V2 → dados;
- Next.js → experiência do vendedor;
- Railway → publicação;
- Adaptador V2 → acesso ao novo modelo canônico.

## Estrutura do repositório

```text
apps/                 Aplicações do produto
packages/             Pacotes compartilhados
  database/           Contratos e acesso a dados
  scoring/            Regras de pontuação
  reports/            Geração de relatórios
  ui/                 Componentes de interface
supabase/              Artefatos do Supabase
  legacy/             Adaptação controlada do banco atual
  migrations/         Migrações versionadas
  tests/               Testes do banco
Legacy/                Materiais históricos preservados
docs/                  Documentação técnica
data/                  Dados versionáveis e não sensíveis
scripts/               Scripts de automação
tests/                 Testes gerais
```

As responsabilidades internas serão detalhadas conforme a arquitetura for validada.

## Como abrir o projeto

1. Abra a pasta raiz `compra-car` no editor de sua preferência.
2. Leia [START.md](START.md) para iniciar ou retomar o trabalho.
3. Consulte [ROADMAP_MASTER.md](ROADMAP_MASTER.md) para identificar a etapa atual.
4. Consulte [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) antes de preparar ferramentas locais.

Ainda não há aplicação para executar nem dependências para instalar.

## Atenção à pasta Legacy

A pasta `Legacy` contém materiais históricos. Ela não deve ser apagada, renomeada, movida ou alterada sem autorização e auditoria prévias.
