# Compra Car

O Compra Car é uma aplicação mobile-first para apoiar vendedores de concessionárias na comparação clara de veículos durante o atendimento.

Este repositório contém a infraestrutura técnica, o núcleo de domínio, o adaptador somente leitura do Supabase atual e os vertical slices de seleção e comparação de veículos. PDF e autenticação ainda não foram implementados.

## Arquitetura atual

O projeto é um monorepo gerenciado com pnpm e Turborepo:

```text
apps/
  web/                 Aplicação Next.js 15 com App Router
packages/
  adapter-supabase/    Adaptador server-only e somente leitura do Supabase legado
  contracts/           DTOs e contratos normalizados públicos
  core/                Domínio, portas e casos de uso puros
  shared/              Utilitários compartilhados e agnósticos de negócio
  ui/                  Primitivos visuais compartilhados futuros
docs/                  Documentação técnica e de produto
supabase/              Artefatos de inspeção e evolução controlada
Legacy/                Materiais históricos protegidos
```

O domínio implementa `Vehicle`, `ComparisonItem`, valores discriminados, elegibilidade pública e os casos de uso centrais. O adaptador implementa as portas normalizadas com DTOs e mappers próprios. A aplicação web acessa seleção e comparação por camada server-only, Server Actions, cache do Next.js e casos de uso; o frontend não acessa tabelas, queries ou estruturas legadas diretamente.

## Tecnologias

- pnpm 10 e Turborepo 2;
- Next.js 15 com App Router, React 19 e TypeScript 5;
- Tailwind CSS 4;
- ESLint 9 e Prettier 3;
- Supabase JS 2 no adaptador privado do servidor;
- Vitest 4 para testes unitários do domínio e do adaptador;
- Railway com Railpack e configuração versionada em `railway.json`;
- PWA instalável com manifesto, ícones e modo `standalone`, sem service worker ou funcionalidades offline.

É necessário Node.js 20 ou superior e anterior à versão 25.

## Desenvolvimento local

```bash
corepack enable
pnpm install
pnpm dev
```

A aplicação fica disponível em `http://localhost:3000`.

Comandos de validação:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
```

O comando `pnpm start` executa o build já gerado em modo de produção.

## Deploy no Railway

O arquivo `railway.json` define o build e o start da aplicação web. No Railway, o serviço deve usar a raiz do repositório; o Railpack instalará as dependências a partir do lockfile e executará apenas o escopo necessário da aplicação.

Configure `SUPABASE_URL` e `SUPABASE_SERVER_KEY` apenas nas variáveis privadas do serviço Railway. Nunca use prefixo `NEXT_PUBLIC_` para a chave do servidor. Consulte `.env.example` para desenvolvimento e testes opt-in; arquivos `.env` reais nunca são versionados.

## Estado do MVP

O MVP consumirá diretamente os dados existentes no Supabase atual, sem depender de nova carga do Excel ou de reestruturação prévia do banco. A ordem autoritativa continua sendo: inspeção mínima do Supabase atual, mapeamento do adaptador legado, validação dos contratos com dados reais existentes, implementação da UI, MVP e piloto.

Consulte [START.md](START.md), [AI_CONTEXT.md](AI_CONTEXT.md) e [ROADMAP_MASTER.md](ROADMAP_MASTER.md) antes de iniciar a próxima fase.

## Atenção à pasta Legacy

A pasta `Legacy` contém materiais históricos. Ela não deve ser apagada, renomeada, movida ou alterada sem autorização e auditoria prévias.
