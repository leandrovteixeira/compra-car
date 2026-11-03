# Reconciliação QA web — 03/11/2026

**Alvo único:** Railway project `Compra Car QA`, serviço `@compra-car/web`, domínio `compra-carqa.up.railway.app`.

## Diagnóstico

O deploy ativo no início da auditoria usava `sprint-23c-qa-integration` / `8a51a89de3829678ef4c712eee68c4ee210d7fe6`. Esta linha manteve alterações posteriores de News, segurança e gestão de usuários, mas ficou para trás em relação à UX da Sprint 26:
- `Políticas Vigentes` estava com `status: planned` no menu apesar de a rota existir.
- `Revisões` apontava para a antiga página `Agentes`, sem a fila consolidada da Sprint 26.
- `Flight Control` não tinha a rota `/admin/agents/flight-control` na branch publicada.

## Merge conciliado

Construir merge do conteúdo `sprint-26-agent-ux-control-center` mais recente com as alterações exclusivas da branch QA 23C:
- Preservar `.github/workflows/sprint-23c-qa-integration.yml`.
- Preservar News: `apps/web/src/app/admin/news/page.tsx` e `apps/web/src/server/news-cover.ts`.
- Preservar usuários e segurança: `apps/web/src/app/admin/users/actions.ts`, `apps/web/src/app/admin/users/page.tsx`, `apps/web/src/app/admin/users/remove-pending-action.ts`, `apps/web/src/components/admin/admin-user-actions.tsx`.
- Adotar navegação de Sprint 26, com Revisões e Flight Control separados, e reativar Políticas Vigentes.
- Manter as proteções de acesso: ambos os links de Agentes somente para contas Master; Políticas Vigentes apenas em Preços para Admin/Master.

**Backup:** `backup/qa-web-2026-11-03-before-s26-reconcile`.

## Critérios de aceite

1. Build Railway web em QA `SUCCESS`, commit de merge publicado pela branch atual `sprint-23c-qa-integration`.
2. Navegação Master: links ativos para as três rotas.
3. `/admin/prices/policies/current` funciona como consulta somente leitura, sem alterar políticas.
4. `/admin/agents` apresenta Revisões consolidadas; `/admin/agents/flight-control` apresenta painel operacional.
5. News, cobertura de imagens e gestão de usuários permanecem nas últimas revisões QA.
6. Nenhum serviço de Produção, banco de Produção ou branch `main` alterado.
