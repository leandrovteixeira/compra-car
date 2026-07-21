# ADR-007 — Supabase Auth e autorização baseada em papéis

- **Status:** aceito
- **Data:** 2026-07-19
- **Substitui:** ADR-005

## Contexto

O Compra Car precisa proteger toda a aplicação, impedir cadastro público e distinguir acesso comercial de administração. Os requisitos agora definem convite fechado, desativação sem exclusão e exatamente dois papéis.

## Decisão

Usar Supabase Auth com e-mail e senha, convite administrativo e recuperação de senha. A sessão SSR usará `@supabase/ssr` e cookies oficiais, sem tokens gerenciados manualmente em `localStorage`.

Uma futura `public.profiles`, vinculada por `id` a `auth.users`, manterá `full_name`, role `admin` ou `vendedor`, estado ativo, autor do convite e timestamps. Não haverá cadastro público. Toda rota não relacionada a Auth exigirá login.

Autorização combinará validação server-side do usuário, profile atual, `is_active` e role com grants e RLS no banco. Middleware/Proxy e visibilidade da UI serão apenas barreiras otimistas. Operações administrativas usarão cliente privilegiado exclusivamente server-only após revalidar admin ativo.

Os detalhes operacionais e o plano incremental estão em [AUTHENTICATION_ARCHITECTURE.md](../AUTHENTICATION_ARCHITECTURE.md).

## Consequências

- ADR-005 permanece histórico, mas sua postergação e ausência de RBAC foram superadas por requisitos aprovados;
- `profiles`, trigger, grants e policies dependerão de migration futura e auditoria prévia do Supabase;
- Next.js 15 usará `middleware.ts`, com migração futura para `proxy.ts` em Next.js 16+;
- qualquer falta de profile, role inválida ou inatividade negará acesso;
- chaves secret/service-role nunca poderão chegar ao browser;
- multi-tenant e segmentação de catálogo permanecem fora do MVP.
