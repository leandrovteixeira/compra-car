# ADR-008 — Supabase Auth e autorização baseada em papéis

- **Status:** aceito
- **Data:** 2026-07-19
- **Atualização:** 2026-07-23 — implementação e aplicação controlada concluídas
- **Substitui:** ADR-005
- **Complementada por:** ADR-010

## Contexto

O Compra Car precisa proteger toda a aplicação, impedir cadastro público e distinguir acesso comercial de administração. Os requisitos agora definem convite fechado, ciclo de status explícito, desativação sem exclusão e exatamente dois papéis.

## Decisão

Usar Supabase Auth com e-mail e senha, convite administrativo e recuperação de senha. A sessão SSR usará `@supabase/ssr` e cookies oficiais, sem tokens gerenciados manualmente em `localStorage`.

`public.profiles`, vinculada por `id` a `auth.users`, manterá `id`, `full_name`, `role`, `status`, `invited_by`, `disabled_by`, `invited_at`, `accepted_at`, `disabled_at`, `created_at` e `updated_at`. `role` e `status` usam enums PostgreSQL com os valores aprovados; `full_name` é opcional enquanto o convite não fornecer um nome de apresentação válido. `last_login_at` não integra esta fase. Não haverá cadastro público. Toda rota não relacionada a Auth exigirá login.

Todo novo usuário receberá obrigatoriamente `role = seller` e `status = pending`. O aceite do convite e a definição de senha mudarão o status para `active`; desativação administrativa mudará para `disabled`; reativação retornará a `active`. Nenhum usuário poderá tornar-se `admin` automaticamente. O primeiro admin será promovido por uma operação manual, explícita, controlada e documentada.

As áreas `seller` e `admin` estão na mesma aplicação Next.js, conforme o ADR-010. `admin` também acessa a área `seller`. O Appsmith não integra mais a arquitetura-alvo e permanece apenas como referência histórica.

`profiles` será a fonte confiável de autorização; `user_metadata` não concederá privilégios. A autorização combinará validação server-side do usuário, profile atual, `status = active` e role com grants e RLS no banco. O Middleware apenas lerá ou atualizará a sessão e redirecionará, sem consultar o banco. Operações administrativas usarão cliente privilegiado exclusivamente server-only, com validação explícita antes da execução; RLS não será sua única barreira.

MFA e uma tabela `audit_log` ficam como evoluções futuras, sem implementação nesta sprint. MFA será obrigatório para `admin` em fase posterior e não obrigatório para `seller` no MVP. A auditoria futura cobrirá convite, reenvio, ativação, desativação, reativação, mudança de role, solicitação de redefinição de senha e habilitação de MFA de `admin`.

Os detalhes operacionais e o plano incremental estão em [AUTHENTICATION_ARCHITECTURE.md](../AUTHENTICATION_ARCHITECTURE.md).

## Consequências

- ADR-005 permanece histórico, mas sua postergação e ausência de RBAC foram superadas por requisitos aprovados;
- `profiles`, enums, trigger, grants e policies possuem migration versionada e aplicada uma única vez no projeto remoto auditado;
- a migration e os testes usam `seller`; a validação estrutural e o teste pgTAP foram aprovados sem persistência de fixtures;
- uma única aplicação Next.js hospedará as áreas `seller` e `admin`, e o Appsmith permanecerá somente como referência histórica;
- Next.js 15 usará `middleware.ts`, com migração futura para `proxy.ts` em Next.js 16+;
- qualquer falta de profile, role inválida ou status diferente de `active` negará acesso;
- chaves secret/service-role nunca poderão chegar ao browser;
- operações com Service Role exigirão validação explícita antes de executar, independentemente de RLS;
- MFA e `audit_log` exigirão decisões de implementação posteriores;
- multi-tenant e segmentação de catálogo permanecem fora do MVP.
