# Ambientes locais do Compra Car

As credenciais reais do Compra Car ficam fora do repositório e são compartilhadas por todos os worktrees.

Fonte canônica local:

```text
C:\Dev\.secrets\compra-car\staging.env
C:\Dev\.secrets\compra-car\production.env
```

É possível sobrescrever essa pasta na sessão atual com:

```powershell
$env:COMPRA_CAR_SECRETS_DIR="D:\caminho\privado\compra-car"
```

Os arquivos reais nunca devem ser versionados.

## Arquivo ativo do worktree

O arquivo efetivamente lido pelo Next.js é:

```text
apps/web/.env.local
```

Ele é apenas uma cópia do ambiente atualmente selecionado. Não é a fonte canônica de secrets e também fica fora do Git.

Os scripts de seleção também configuram `COMPRA_CAR_AGENT_ENV_FILE` para esse mesmo `.env.local`, mantendo aplicação e agentes no mesmo ambiente.

## Comandos

Ativar Staging:

```powershell
.\scripts\environment\use-staging.ps1
```

O script:
- lê `C:\Dev\.secrets\compra-car\staging.env`;
- valida que as URLs pública e server-side apontam para o projeto Staging esperado;
- copia o arquivo para `apps/web/.env.local`;
- configura `COMPRA_CAR_AGENT_ENV_FILE`;
- mostra apenas destino e presença de variáveis importantes, nunca seus valores.

Consultar o ambiente ativo:

```powershell
.\scripts\environment\show-environment.ps1
```

Ativar Produção exige confirmação explícita:

```powershell
.\scripts\environment\use-production.ps1 -ConfirmProduction
```

O script de Produção valida o project ref antes de copiar qualquer arquivo.

Depois de trocar o ambiente, reinicie o servidor Next.js:

```powershell
pnpm dev
```

## Variáveis mínimas da aplicação

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVER_KEY`

## Variáveis dos agentes OpenAI

Para Brand Connector / MMV Discovery:

- `OPENAI_API_KEY`
- `OPENAI_AGENT_MODEL`
- `OPENAI_AGENT_MAX_WAIT_MS` (opcional; default do agente)

Para Import Engine:

- `OPENAI_IMPORT_MODEL`
- demais variáveis `OPENAI_IMPORT_*` usadas pelo fluxo de importação

O mesmo arquivo de Staging/Produção deve concentrar as credenciais necessárias daquele ambiente.

## Arquivos versionados

Somente templates/documentação podem entrar no Git, por exemplo:

```text
apps/web/env/staging.env.example
apps/web/env/production.env.example
apps/web/env/README.md
```

Nunca versionar:

```text
apps/web/.env.local
apps/web/env/staging.env
apps/web/env/production.env
C:\Dev\.secrets\...
```

## Ambientes online

Vercel/CI/produção online devem continuar usando variáveis configuradas diretamente na plataforma de deploy. Os arquivos de `C:\Dev\.secrets` existem apenas para desenvolvimento/operação local.
