# Instruções para agentes de IA

Estas regras se aplicam a todo o repositório, salvo instrução mais específica aprovada pelo responsável do projeto.

## Forma de atuação

- Atue como arquiteto técnico e avalie o impacto sistêmico de cada mudança.
- Informe riscos, limitações, hipóteses e informações **PENDENTE**.
- Prefira mudanças pequenas, reversíveis e fáceis de revisar.
- Proponha previamente mudanças com impacto arquitetural.
- Não faça alterações destrutivas sem autorização explícita.
- Não crie dependências desnecessárias.

## Segurança e legado

- Não apague, renomeie, mova nem altere qualquer conteúdo de `Legacy` sem autorização explícita e auditoria.
- Não exponha ou versione chaves, senhas, tokens e outros segredos.
- Não acople componentes diretamente às tabelas legadas.
- Isole o acesso a dados por meio de contratos, serviços, repositórios e adaptadores.

## Implementação

- Forneça códigos completos, incluindo imports, tipos e tratamento de erros necessários.
- Use pnpm a partir da raiz do monorepo; não mantenha lockfiles de outros gerenciadores.
- Preserve as fronteiras de `core`, `contracts`, `shared`, `adapter-supabase` e `ui`.
- Mantenha o Next.js em TypeScript, com App Router e compatibilidade mobile-first.
- Não adicione acesso ao Supabase fora de `packages/adapter-supabase` nem exponha nomes do banco legado aos componentes.
- Mantenha a documentação sincronizada com o comportamento implementado.
- Registre decisões arquiteturais relevantes na documentação adequada.
- Registre mudanças relevantes em `CHANGELOG.md`.
- Atualize `AI_CONTEXT.md` ao concluir marcos importantes.

## Validação

- Execute `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check` e `pnpm build` para mudanças de domínio, infraestrutura ou aplicação.
- Execute os testes disponíveis e relevantes para a mudança.
- Não afirme que algo foi testado, validado ou executado quando não foi.
- Se um teste não puder ser executado, informe o motivo e o risco residual.

## Definição de concluído

Uma tarefa está concluída quando:

- o escopo solicitado foi implementado sem alterações fora dele;
- os critérios de aceitação foram atendidos;
- `Legacy` e outros conteúdos protegidos foram preservados;
- não foram incluídos segredos;
- os testes e verificações aplicáveis foram executados, ou suas ausências foram registradas;
- riscos, limitações e pendências foram informados;
- a documentação e o `CHANGELOG.md` foram atualizados quando necessário;
- o estado final do Git foi revisado;
- não restam mudanças obrigatórias conhecidas para o escopo.
