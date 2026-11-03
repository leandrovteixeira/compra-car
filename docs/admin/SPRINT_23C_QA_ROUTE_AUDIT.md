# Sprint 23C — Inventário completo de URLs de páginas do QA

> Inventário estático das páginas Next.js da branch sprint-23c-qa-integration, não é resultado de teste HTTP individual. Dinâmicos são padrões com parâmetros; nem todas as páginas devem estar visíveis ao público.
> 48 páginas inventariadas. Base: https://compra-carqa.up.railway.app

## Rotas
- `/`
- `/admin`
- `/admin/agents`
- `/admin/agents/brands`
- `/admin/agents/brands/[id]`
- `/admin/agents/findings/[id]`
- `/admin/agents/runs/[id]`
- `/admin/chat`
- `/admin/comparar-especificacoes`
- `/admin/comparar-modelos`
- `/admin/imports`
- `/admin/imports/[batchId]`
- `/admin/imports/[batchId]/add`
- `/admin/imports/new`
- `/admin/imports/structured-policies`
- `/admin/news`
- `/admin/prices`
- `/admin/prices/input`
- `/admin/prices/list`
- `/admin/prices/offers`
- `/admin/prices/policies/current`
- `/admin/prices/policies/input`
- `/admin/products`
- `/admin/products/[id]/duplicate`
- `/admin/products/[id]/edit`
- `/admin/products/[id]/specs`
- `/admin/products/new`
- `/admin/users`
- `/admin/ver-ficha-tecnica`
- `/admin/ver-ficha-tecnica/modelo`
- `/auth/invite`
- `/auth/invite/confirm`
- `/auth/recovery`
- `/auth/recovery/confirm`
- `/comparar`
- `/comparar-especificacoes`
- `/comparar-modelos`
- `/conta/perfil`
- `/conta/plano`
- `/conta/trocar-senha`
- `/conta/upgrade`
- `/escolher-veiculos`
- `/fichas-tecnicas`
- `/fichas-tecnicas/modelo`
- `/forgot-password`
- `/invite-requests`
- `/login`
- `/ver-modelo`

## Pendências encontradas
- `/comparar-especificacoes`: rota criada para o acesso público; aguarda build e novo deploy.
- Corporate: `/admin/prices/list` ainda depende de legacy admin layout, portanto acesso Corporate à Lista de Preços não está completamente integrado.
- Admin: `admin/agents` recebeu proteção Master server-side; demais endpoints/actions ainda requerem auditoria detalhada.
- Cadastro: signup público continua indisponível enquanto confirmação de email/SMTP não estiver funcionando.
- Testes HTTP fora da plataforma e testes E2E com cinco perfis ainda não executados.
- Produção não foi alterada.