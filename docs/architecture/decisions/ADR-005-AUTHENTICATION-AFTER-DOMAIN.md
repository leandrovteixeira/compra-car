# ADR-005 — Autenticação simples em fase posterior

- **Status:** substituído pelo ADR-007 em 2026-07-19
- **Data:** 2026-07-18

## Contexto

Esta fase define domínio e contratos puros. Não há requisito validado para papéis, permissões granulares ou administração de usuários no MVP inicial.

## Decisão

Nenhuma autenticação será implementada nesta fase. Uma autenticação simples, sem RBAC, será introduzida posteriormente antes da exposição que exigir controle de acesso.

## Consequências

- não existem middleware, sessão ou contratos de autenticação agora;
- RBAC permanece fora do escopo até haver requisitos concretos;
- a revisão de RLS e segurança continua obrigatória antes da publicação com dados reais.

## Superação

Os requisitos de autenticação e papéis foram aprovados posteriormente. O [ADR-007](ADR-007-SUPABASE-AUTH-AND-ROLE-BASED-AUTHORIZATION.md) e a [arquitetura de autenticação](../AUTHENTICATION_ARCHITECTURE.md) passam a ser autoritativos; este ADR permanece apenas como registro da decisão daquela fase.
