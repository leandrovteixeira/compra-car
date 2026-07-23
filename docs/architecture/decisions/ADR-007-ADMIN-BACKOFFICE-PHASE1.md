# ADR-007 — Backoffice administrativo da Fase 1 e governança do ambiente

- **Status:** substituído parcialmente pelo ADR-010 em 2026-07-23
- **Data:** 2026-07-20
- **Atualização:** 2026-07-22 — export e estrutura do Appsmith confirmados

> Registro histórico: a adoção do Appsmith descrita abaixo refletia a direção aprovada nesta data. O [ADR-010](ADR-010-SINGLE-NEXTJS-APPLICATION-AND-APPSMITH-RETIREMENT.md) posteriormente definiu uma única aplicação Next.js e descontinuou o Appsmith como arquitetura-alvo. Exports e documentos existentes permanecem preservados apenas como referência; não haverá novas implementações no Appsmith.

## Contexto

Na data desta decisão, o Compra Car precisava manter veículos, preços e políticas e oferecer comparação administrativa antes de uma eventual arquitetura definitiva, enquanto Supabase e Appsmith ainda aguardavam inventário integral. O export Appsmith foi posteriormente auditado em 2026-07-22; permissões, role e transações permanecem pendentes. O trabalho ocorre em dois notebooks com clones locais independentes.

## Decisão

Appsmith será usado como tecnologia do backoffice administrativo da Fase 1. O domínio administrativo permanece documentado de forma independente em `docs/admin`, permitindo substituir a ferramenta sem redefinir as regras.

A Fase 1 será executada sem mudança de schema. Isso significa não criar, remover ou alterar tabelas, colunas, constraints, índices, views, materialized views, functions, RPCs, procedures, triggers, policies, RLS, grants ou qualquer outro objeto estrutural.

Inserts e updates nos objetos existentes poderão ocorrer depois da validação das permissões, constraints, regras de negócio, concorrência e impacto sobre consumidores atuais. Esta ADR não presume que todos os fluxos sejam viáveis no schema existente.

O GitHub é a fonte oficial versionada. Cada notebook mantém seu próprio clone em `C:\Dev\compra-car`, recebe atualizações do GitHub antes do trabalho e envia apenas mudanças aprovadas. O OneDrive é somente espelho periódico para consulta e contingência; não é ambiente de desenvolvimento nem fonte autoritativa.

## Consequências

- tarefas administrativas ficam separadas do MVP público;
- queries e componentes do Appsmith não se tornam regras de domínio;
- lacunas do schema são registradas para decisão futura, sem correção estrutural na Fase 1;
- export e documentação do Appsmith devem ser versionados sem segredos;
- divergências entre notebooks são reconciliadas pelo GitHub;
- uma futura arquitetura Supabase V2 depende do piloto, da validação dos fluxos administrativos e de nova decisão arquitetural explícita.

## Pendências

- confirmar permissões, role efetiva, prepared statements, comportamento transacional e estado publicado da instância Appsmith;
- confirmar objetos, constraints, RLS, grants e permissões de escrita no Supabase;
- confirmar a viabilidade de veículos, preços, políticas e comparação sem mudança de schema;
- definir auditoria, concorrência e invalidação de cache;
- definir o desenho de staging da Fase 2 em decisão posterior.
