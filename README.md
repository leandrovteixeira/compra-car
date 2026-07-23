# Compra Car

O Compra Car é uma aplicação mobile-first para apoiar vendedores de concessionárias na comparação clara de veículos durante o atendimento.

Este repositório contém a infraestrutura técnica, o núcleo de domínio, o adaptador somente leitura do Supabase atual e os vertical slices de seleção e comparação de veículos. A arquitetura-alvo possui uma única aplicação Next.js, com áreas `seller` e `admin` planejadas e separadas por autenticação e autorização. PDF, autenticação e os fluxos administrativos completos ainda não foram implementados.

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
  admin/               Domínio administrativo e referências históricas
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

O MVP público já possui seleção e comparação técnica implementadas sobre o Supabase atual. A validação opt-in com dados reais, preços, políticas comerciais, PDF, publicação e piloto continuam pendentes.

A área administrativa será desenvolvida incrementalmente no mesmo aplicativo Next.js do MVP-u. A área `seller` abrangerá a comparação; a área `admin` reunirá os fluxos administrativos aprovados, e usuários com `role = admin` também poderão acessar a área `seller`. Ambas usarão o mesmo Supabase, com autenticação e autorização ainda em planejamento.

O Appsmith deixou de ser o backoffice oficial e não receberá novas implementações. Seus exports e documentos permanecem preservados como referência histórica, sem autorizar remoção de arquivos ou integrações existentes. Consulte [`docs/admin`](docs/admin/README.md), a [ADR-007 histórica](docs/architecture/decisions/ADR-007-ADMIN-BACKOFFICE-PHASE1.md) e a [ADR-010](docs/architecture/decisions/ADR-010-SINGLE-NEXTJS-APPLICATION-AND-APPSMITH-RETIREMENT.md).

O GitHub é a fonte oficial versionada. Cada notebook trabalha em seu próprio clone em `C:\Dev\compra-car`; o OneDrive serve somente como espelho periódico para consulta e contingência.

Consulte [START.md](START.md), [AI_CONTEXT.md](AI_CONTEXT.md) e [ROADMAP_MASTER.md](ROADMAP_MASTER.md) antes de iniciar a próxima fase.

## Atenção à pasta Legacy

A pasta `Legacy` contém materiais históricos. Ela não deve ser apagada, renomeada, movida ou alterada sem autorização e auditoria prévias.
