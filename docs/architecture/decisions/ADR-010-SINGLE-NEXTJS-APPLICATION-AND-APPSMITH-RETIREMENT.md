# ADR-010 — Aplicação Next.js única e descontinuação do Appsmith

- **Status:** aceito
- **Data:** 2026-07-23
- **Substitui parcialmente:** ADR-007
- **Relacionada:** ADR-008

## Contexto

O MVP-u de comparação está implementado em Next.js com App Router e usa o Supabase atual pelas fronteiras server-side do projeto. Em uma etapa anterior, o ADR-007 adotou o Appsmith como backoffice administrativo da Fase 1 enquanto a arquitetura definitiva ainda estava em avaliação. Depois desta decisão, autenticação, área seller, shell administrativo e listagem read-only foram implementados no Next.js; o export e a implementação parcial do Appsmith permanecem apenas como histórico.

A manutenção de duas aplicações técnicas aumentaria a superfície de autenticação, autorização, deploy, observabilidade, experiência de usuário e integração com o mesmo Supabase. A área administrativa precisa compartilhar as fronteiras de domínio e infraestrutura do Compra Car sem acoplar componentes diretamente ao schema legado.

## Decisão

O Compra Car terá uma única aplicação técnica em `apps/web`, construída com Next.js. Essa aplicação conterá duas áreas lógicas separadas por autenticação e autorização:

- área `seller`: comparação e fluxos comerciais aprovados;
- área `admin`: funções administrativas aprovadas, com acesso adicional à área `seller`.

Os únicos valores iniciais de `role` serão `seller` e `admin`. A interface pode apresentar esses papéis como “Vendedor” e “Administrador”.

Supabase Auth e o mesmo projeto Supabase continuarão compartilhados pelas duas áreas. A separação de acesso ocorrerá por sessão, `profiles`, validação server-side, grants e RLS, conforme a arquitetura de autenticação. Não será criada uma segunda aplicação Next.js nem um segundo backend.

O Appsmith deixa de fazer parte da arquitetura-alvo e não receberá novas implementações. Seus exports, inventários, roteiros e integrações existentes serão preservados sem alteração destrutiva como referência histórica e evidência do trabalho realizado. A preservação desses artefatos não autoriza seu uso como backoffice oficial nem como fonte de regras de domínio.

No momento da decisão, este ADR não implementou autenticação nem alterou o Supabase. Posteriormente, a implementação foi concluída em rodadas próprias e a migration Auth foi aplicada e validada de forma controlada.

## Motivos

- manter uma única fronteira de autenticação e autorização;
- reutilizar a arquitetura, os contratos, os casos de uso e o design system do MVP-u;
- reduzir duplicação de deploy, navegação, observabilidade e tratamento de erros;
- aplicar autorização server-side e RLS de forma consistente;
- evitar que queries ou widgets de uma ferramenta externa se tornem regras de domínio;
- permitir que `admin` use também a experiência `seller` sem troca de aplicação.

## Consequências

- `/admin` será uma área da aplicação Next.js, não uma aplicação separada;
- as rotas do MVP-u foram preservadas no route group `seller`;
- `admin` será um superset de acesso de `seller`, sem remover validações específicas de cada operação;
- componentes não acessarão diretamente tabelas ou nomes legados;
- operações administrativas exigirão contratos, casos de uso, adapters e validações próprias;
- a documentação, a migration e os testes de autenticação foram reconciliados com `seller` antes de qualquer aplicação;
- o ADR-007 permanece como registro histórico da direção anterior, mas sua escolha do Appsmith foi substituída;
- os documentos históricos do Appsmith devem indicar claramente que não são planos vigentes.

## Riscos

- regressão no MVP-u ao introduzir layouts e proteção de rotas;
- uso acidental de credencial privilegiada sem revalidação de `admin`;
- falsa confiança em Middleware ou UI sem autorização próxima ao recurso;
- regressão futura entre os valores `seller` do código, migration e banco;
- grants e RLS atuais insuficientes para operações administrativas;
- reutilização indevida de SQL histórico do Appsmith sem passar pelas fronteiras da aplicação;
- crescimento da aplicação única sem separação interna adequada entre áreas.

## Plano de transição

1. Atualizar a documentação autoritativa e marcar o Appsmith como histórico.
2. Manter exports, inventários e integrações existentes sem novas implementações ou remoções.
3. Reconciliar `public.app_role`, defaults, trigger e testes SQL de `vendedor` para `seller`. **Concluído, aplicado e validado.**
4. Implementar autenticação e autorização no Next.js conforme ADR-008. **Concluído na fundação vigente.**
5. Proteger a área `seller` e validar que `admin` também a acessa. **Concluído.**
6. Criar `/admin` no mesmo aplicativo e proteger layout, páginas e operações no servidor. **Concluído para shell, visão geral e listagem read-only.**
7. Mapear cada fluxo administrativo histórico para contratos e casos de uso aprovados; não portar widgets ou SQL automaticamente.
8. Auditar grants, RLS e consumidores do Supabase antes de habilitar escrita administrativa.
9. Somente após validação funcional, operacional e de segurança, decidir separadamente sobre a remoção futura de integrações ou infraestrutura do Appsmith.

## Pendências

- implementar Sprint 5 (Create), Sprint 6 (edição), Sprint 7 (duplicação), Sprint 8 (`product_specs`) e Sprint 9 (preços);
- manter o histórico de aplicação da migration de `profiles` documentado por ambiente;
- auditar formalmente o privilégio de `SUPABASE_SERVER_KEY`; os clients Auth browser/SSR e o adapter legado já estão separados;
- mapear consumidores atuais dos grants, functions e integrações do Supabase;
- definir o runbook do primeiro usuário `admin`;
- definir critérios e autorização para eventual remoção futura da infraestrutura Appsmith.
