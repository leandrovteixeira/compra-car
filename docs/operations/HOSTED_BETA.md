# Ambiente online de testes

## Arquitetura

O beta controlado usa um único serviço Railway conectado à raiz deste monorepo e o projeto Supabase
remoto selecionado para testes. O ambiente é `staging`; ele não representa produção.

- fonte: branch `main` de `leandrovteixeira/compra-car`;
- runtime: Node 22 e pnpm 10.34.5;
- build: `pnpm turbo run build --filter=@compra-car/web...`;
- start: `pnpm --filter @compra-car/web start`;
- healthcheck: `GET /api/health`;
- deploy: integração direta Railway/GitHub, sem pipeline redundante.

O nome do serviço e o hostname gerado devem ser registrados no inventário privado da operação; não são
inferidos nem fixados no código.

## Variáveis do Railway

Configure valores reais somente no provedor. Os arquivos versionados contêm placeholders.

| Classe | Variáveis | Uso |
| --- | --- | --- |
| Pública | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | obrigatórias |
| Servidor | `SUPABASE_URL`, `SUPABASE_SERVER_KEY` | obrigatórias e privadas |
| Redirect/deploy | `AUTH_INVITE_REDIRECT_URL`, `AUTH_RECOVERY_REDIRECT_URL` | obrigatórias; HTTPS do host |
| Ambiente | `APP_ENV=staging`, `APP_NAME`, `NEXT_PUBLIC_APP_ENV=staging`, `NEXT_PUBLIC_APP_NAME` | recomendadas |
| Importação | `IMPORT_EXTRACTION_PROVIDER`, `IMPORT_EXTRACTION_MODE`, `OPENAI_API_KEY`, `OPENAI_IMPORT_MODEL`, `OPENAI_IMPORT_TIMEOUT_MS`, `OPENAI_IMPORT_DIAGNOSTICS` | opcionais; provider real |
| Testes opt-in | `SUPABASE_INTEGRATION_*`, `RUN_OPENAI_*`, `OPENAI_IMPORT_SMOKE_BATCH_ID` | não usar no runtime comum |

`SUPABASE_SERVER_KEY` e `OPENAI_API_KEY` nunca podem usar `NEXT_PUBLIC_`. Não registre valores, JWTs,
senhas ou tokens de callback em logs.

## Supabase Auth

No projeto remoto do beta:

1. defina Site URL como `https://<host-de-teste>`;
2. permita exatamente `https://<host-de-teste>/auth/callback/invite`;
3. permita exatamente `https://<host-de-teste>/auth/callback/recovery`;
4. preserve as URLs locais exatas usadas no desenvolvimento;
5. mantenha signup público e login anônimo desabilitados.

Repita as callbacks nas variáveis `AUTH_*_REDIRECT_URL` do Railway. Não use curingas globais. Convite
e recovery devem ser testados por e-mail real, inclusive abrindo o link em outro dispositivo. Uma
limitação PKCE/cross-device é bloqueadora e não deve ser contornada enfraquecendo cookies.

### Template obrigatório de Invite User

No painel Supabase, o template **Invite User** deve usar o callback SSR direto com `TokenHash`:

```html
<h2>You've been invited</h2>

<p>You've been invited to create an account. Follow the link below to accept.</p>

<p>
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">
    Accept invitation
  </a>
</p>
```

Não use `{{ .ConfirmationURL }}` nesse fluxo. O link padrão devolve a sessão no fragmento da URL,
que não é enviado ao callback server-side e não funciona de forma confiável quando o convite é aberto
em outro navegador/dispositivo. O callback valida o hash com `verifyOtp`, grava a sessão nos cookies SSR
e segue para `/auth/invite`.

## Banco remoto

Antes da liberação, compare o histórico remoto com `supabase/migrations/`. Nunca execute `db reset` no
remoto e não aplique migration sem listar o estado primeiro. Confirme por inspeção somente leitura:

- `public.profiles` e `handle_new_auth_user` ligado a `auth.users`;
- `public.user_invite_requests` da migration `20260824193232_create_user_invite_requests.sql`;
- índices, grants, RLS e policies dessas estruturas.

O pgTAP `supabase/tests/024_user_invite_requests.test.sql` deve rodar localmente. Falta de Docker não
autoriza testes destrutivos no projeto remoto.

## Deploy reproduzível

1. Confirme que todas as mudanças estão commitadas; Railway não recebe arquivos locais.
2. Vincule um único serviço à raiz do repositório e ao branch `main`.
3. Configure variáveis e gere um domínio HTTPS Railway.
4. Ajuste callbacks no Railway e Site URL/allowlist no Supabase.
5. Verifique e aplique, se necessário, apenas migrations versionadas pelo fluxo Supabase estabelecido.
6. Dispare o deploy e confira build, start e `/api/health`, sem imprimir segredos.
7. Execute o checklist com contas e e-mails exclusivos de teste.

## Checklist do beta hospedado

Registre aprovado, falhou ou não executado. Nunca transforme “não executado” em sucesso.

### Deployment e segurança

- [ ] URL externa responde por HTTPS sem alerta.
- [ ] `/api/health` responde `200` com `{ "status": "ok" }`.
- [ ] Restart/redeploy preserva os dados no Supabase.
- [ ] Nenhum callback hospedado aponta para localhost.
- [ ] JS/HTML não contêm chave server/service-role ou segredo real.
- [ ] Não há signup, criação anônima ou endpoint administrativo público.

### Auth e administração

- [ ] Usuário `active` autentica e acessa rota protegida.
- [ ] Usuários `pending` e `disabled` são negados.
- [ ] Seller é negado ao abrir `/admin/users` diretamente.
- [ ] Admin abre `/admin/users` e uma rota administrativa preexistente.
- [ ] Ações privilegiadas funcionam apenas no servidor.

### Convite, onboarding e recovery

- [ ] Admin envia convite para e-mail real de teste.
- [ ] E-mail chega e callback abre, inclusive em dispositivo diferente.
- [ ] Senha altera `pending` para `active` e mantém a sessão.
- [ ] Recovery troca a senha de usuário ativo.
- [ ] Recovery não altera `pending` ou `disabled`.
- [ ] Links ausentes, inválidos e expirados exibem erro controlado.

### Solicitação de convite

- [ ] Seller ativo cria solicitação com identidade exclusiva.
- [ ] Admin vê fila e testa aprovação/rejeição com solicitações distintas.
- [ ] Aprovação envia convite real e respeita duplicidade.
- [ ] Seller não vê solicitações de outros usuários.

### Aplicação

- [ ] Seleção, filtros e comparação funcionam com dados remotos.
- [ ] PDF é gerado/baixado sem depender da máquina do desenvolvedor.
- [ ] Assets carregam sem dependência de localhost, `file://` ou caminho local.
- [ ] Registre observações de primeira carga, login, comparação e `/admin/users`.

## Limitação operacional

Deploy, painel, inspeção remota e e-mail real exigem acesso autenticado aos provedores. Sem essas
credenciais, o repositório pode ser preparado e validado localmente, mas a Sprint 13 não pode ser
declarada operacionalmente concluída.
