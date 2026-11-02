# Auditoria de reconciliação — Sprint 23C + Sprint 26 (QA)
Data: 2026-11-02

## Diagnóstico
- Serviço Railway QA usa branch `sprint-23c-qa-integration`, último commit observado `8a51a89de3829678ef4c712eee68c4ee210d7fe6`.
- Branch `sprint-26-agent-ux-control-center` divergiu: 497 commits presentes só nela, enquanto 23C contém 16 commits ausentes da 26 (base comum).
- QA tem 48 páginas Next.js; Sprint 26 tem 49. A página exclusivamente na 26 é `/admin/agents/flight-control`.
- A rota `/admin/agents` existe em ambas mas renderiza UX diferentes: QA ainda utiliza a fila antiga; Sprint 26 usa `AgentReviewInbox`, `AgentControlCenterOverview` e `AgentHandoffPanel`.
- `Políticas Vigentes` existe em ambas e sua implementação está disponível; o menu estava com `status: planned`. Este candidato define `active`.
- O submenu `Agentes` na 26 identifica `Revisões` e `Flight Control`; o 23C publicado identifica apenas `Agentes`.
- A Staging DB contém migrações S26 até `20261101211502`; verificar parity com migrations do branch antes do deploy.

## Solução segura
- Branch candidata `integration-23c-26-reconcile-qa`, criada a partir da Sprint 26; preserva todo o trabalho dos agentes.
- Portados ajustes recentes da 23C: Gestão de Usuários, bloqueio de convites e papéis legados, exclusão de pendentes somente QA e controle de clique fora.
- Reativado link `/admin/prices/policies/current`.
- Corrigidos apenas erros de tipagem em testes Price Agent, sem modificar agente.
- PR de reconciliação isolado; não promover para QA nem Produção sem passar TypeScript, lint scoped, testes, build, inspeção das telas e verificações de autorizações.

## Critérios de aprovação
1. Master vê menu Agentes > Revisões e Flight Control, sem acesso para demais perfis.
2. `/admin/agents` mostra inbox de revisão e ações canônicas.
3. `/admin/agents/flight-control` mostra Health, Runs, Jobs e controles operacionais.
4. Políticas Vigentes navega e renderiza a tabela atual (sem 404 nem aviso desabilitado).
5. Gestão de Usuários mantém fechamento por clique fora, exclusão segura de pendentes, sem criação de Vendedor.
6. Guest/Public/Corporate/Admin/Master mantêm acesso e limites aprovados na 23C.
7. Nenhuma alteração na Produção e nenhum agente duplicado pelo QA.
