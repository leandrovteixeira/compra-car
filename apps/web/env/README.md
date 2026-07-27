# Ambientes locais do Compra Car

Esta pasta contém arquivos privados locais usados para selecionar o ambiente da aplicação Next.js. Os arquivos esperados são `staging.env` para **Compra Car Staging** e `production.env` para **Compra Car App / Produção**. Eles nunca devem ser versionados.

O arquivo efetivamente lido pelo Next.js é `apps/web/.env.local`. O Next.js não lê `staging.env` nem `production.env` automaticamente; os scripts abaixo validam o destino e copiam o arquivo selecionado para o local ativo.

## Comandos

Ativar Staging:

```powershell
.\scripts\environment\use-staging.ps1
```

Consultar o ambiente ativo:

```powershell
.\scripts\environment\show-environment.ps1
```

Ativar Produção, com confirmação explícita obrigatória:

```powershell
.\scripts\environment\use-production.ps1 -ConfirmProduction
```

Depois de qualquer troca, interrompa e reinicie o servidor Next.js:

```powershell
pnpm dev
```

## Variáveis obrigatórias

- `NEXT_PUBLIC_SUPABASE_URL`: URL pública do projeto usada no navegador.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave publicável; pode ser exposta ao navegador.
- `SUPABASE_URL`: URL do mesmo projeto usada no servidor.
- `SUPABASE_SERVER_KEY`: chave privada usada somente no servidor. Ela nunca deve receber o prefixo `NEXT_PUBLIC_`.

As variáveis de integração e os nomes do aplicativo são opcionais para este mecanismo. Não inclua chaves ou valores privados em documentação ou arquivos versionados.

Ambientes online futuros deverão usar variáveis configuradas diretamente na plataforma de deploy, não estes arquivos locais.
