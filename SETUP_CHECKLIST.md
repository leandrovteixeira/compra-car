# Compra Car — Checklist de Preparação

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
- [ ] Export do Appsmith
- [ ] Regras atuais de comparação
- [ ] Três veículos-piloto
- [ ] Texto legal provisório
- [ ] Identidade visual provisória

A nova carga do Excel não é requisito para iniciar a implementação do domínio ou concluir o MVP.

## Segurança

- [ ] Nunca salvar `service_role` no frontend
- [ ] Nunca commitar arquivos `.env`
- [ ] Revisar RLS antes de expor dados ao MVP
- [ ] Armazenar segredos no Railway e localmente em `.env.local`
- [ ] Preservar `Legacy` sem alterações não autorizadas
