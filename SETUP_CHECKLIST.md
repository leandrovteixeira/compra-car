# Compra Car — Checklist de Preparação

Este é um checklist reutilizável para preparar ambientes e sessões de trabalho. As caixas não representam necessariamente o estado do notebook atual; cada operador deve verificá-las no ambiente em uso.

## Contas

- [ ] GitHub
- [ ] Supabase
- [ ] Railway
- [ ] Conta Microsoft com OneDrive
- [ ] Acesso ao Appsmith atual

## Ferramentas locais

- [ ] Git
- [ ] Node.js `>=20 <25`
- [ ] Corepack habilitado
- [ ] pnpm 10 ativado pelo Corepack
- [ ] Docker Desktop e Supabase CLI, apenas quando a fase de dados exigir
- [ ] GitHub CLI e DBeaver, opcionais

## Preparação do monorepo

```bash
corepack enable
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Não é necessário instalar Turborepo globalmente. O workspace usa a versão fixada no `package.json` e no `pnpm-lock.yaml`.

## Fluxo entre notebooks

- [ ] Trabalhar em clone próprio em `C:\Dev\compra-car`
- [ ] Executar `git pull` antes de iniciar mudanças aprovadas
- [ ] Comparar branch, commit e working tree com o outro notebook quando aplicável
- [ ] Usar o GitHub como fonte oficial versionada
- [ ] Usar OneDrive apenas como espelho periódico, nunca como diretório de desenvolvimento

## Estrutura vigente

```text
CompraCar/
├── apps/web/
├── packages/adapter-supabase/
├── packages/contracts/
├── packages/core/
├── packages/shared/
├── packages/ui/
├── docs/
├── supabase/
├── Legacy/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── railway.json
```

## Configuração do adaptador

- [ ] Copiar `.env.example` para um arquivo local ignorado pelo Git
- [ ] Configurar `SUPABASE_URL` e `SUPABASE_SERVER_KEY` somente no servidor
- [ ] Usar variáveis `SUPABASE_INTEGRATION_*` apenas para testes opt-in
- [ ] Nunca criar variável `NEXT_PUBLIC_` para a chave do servidor

## Materiais para as próximas fases

- [ ] Resultados sanitizados da validação somente leitura do Supabase atual
- [x] Export do Appsmith localizado e auditado em `appsmith/exports/Compra Car App MVP.json`
- [ ] Regras atuais de comparação
- [ ] Três veículos-piloto
- [ ] Texto legal provisório
- [ ] Identidade visual provisória
- [ ] Inventário sanitizado de tabelas, views, functions/RPCs, constraints, RLS e grants
- [ ] Modelo real de preços, políticas, vigência e moeda
- [ ] Coluna e semântica do valor monetário master de specs
- [ ] Constraint da chave `marca + modelo + versão + MY + PY`

## Backoffice administrativo

- [x] Confirmar a estrutura de edição representada pelo export do Appsmith
- [ ] Confirmar na instância quais páginas estão efetivamente publicadas
- [ ] Definir datasource e papéis sem expor chave privilegiada no cliente
- [ ] Confirmar operações de escrita permitidas na Fase 1
- [ ] Versionar páginas, queries e JS Objects pelo mecanismo aprovado
- [ ] Preservar o schema atual durante toda a Fase 1
- [ ] Validar estratégia de concorrência, auditoria e invalidação do cache do Next.js

A nova carga do Excel não é requisito para iniciar a implementação do domínio ou concluir o MVP.

## Segurança

- [ ] Nunca salvar `service_role` no frontend
- [ ] Nunca commitar arquivos `.env`
- [ ] Revisar RLS antes de expor dados ao MVP
- [ ] Armazenar segredos no Railway e localmente em `.env.local`
- [ ] Preservar `Legacy` sem alterações não autorizadas
