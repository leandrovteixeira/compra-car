# Sprint 14G — relatório de QA responsive e instalável

## Complemento 14G.4 — reinstalação após remoção

Regra final do User Menu: standalone detectado por `display-mode` ou `navigator.standalone` oculta a
ação. Browser normal apresenta “Instalar aplicativo” quando há prompt nativo ou estratégia manual
útil; Android/Chromium usa o menu do navegador, iOS/iPadOS usa Compartilhar e Chromium desktop pode
usar o menu de instalação. As instruções continuam centralizadas em `PwaInstallInstructions`.

`appinstalled` atualiza apenas a sessão em memória. `pageshow` e retorno de visibilidade recalculam o
modo atual sem storage/cookie, de modo que abrir novamente o site no navegador após remover a PWA
restaura a ação. Testes automatizados cobrem standalone, prompt nativo, fallback, retorno ao browser,
ausência de persistência e instrução iOS. A instalação inicial foi validada com sucesso em dispositivo
real. **PENDENTE:** repetir manualmente a sequência instalar → standalone → remover → browser →
reinstalar em Android/Chromium real.

## Complemento 14G.3 — instalação pelo User Menu

O menu do usuário oferece “Instalar aplicativo” antes de “Sair” quando `usePwaInstall` classifica o
ambiente como prompt nativo, iOS/iPadOS manual ou fallback mobile. A opção fica oculta em standalone,
durante detecção e em desktop sem suporte. Chromium abre o prompt nativo; aceite/dispensa fecha e
atualiza o menu. iOS e fallback reutilizam `PwaInstallInstructions` em disclosure compacto, com
`aria-expanded`, foco visível e operação por teclado.

Os dois entry points são pós-convite e User Menu. Ambos compartilham helper e instruções, sem
persistência de recusa. A largura existente `w-60`, os alvos `touch-target` e a ancoragem à direita
mantêm acesso estrutural em 430, 390, 360 e 320px. **PENDENTE:** QA visual e instalação real nos
browsers/dispositivos da matriz.

## Complemento 14G.2 — instalação após convite

Após a criação e ativação bem-sucedidas da senha, o onboarding pode oferecer instalação antes do
destino autenticado. A etapa reutiliza o `AuthShell` (`max-w-sm`, padding lateral fluido), botão
full-width e `touch-target`, cobrindo estruturalmente 430, 390, 360 e 320px sem largura fixa ou
overflow. Standalone e desktop sem prompt seguem direto; Android/Chromium usa `beforeinstallprompt`;
iOS/iPadOS recebe instruções de Compartilhar; mobile sem prompt recebe fallback pelo menu do
navegador. “Agora não” e a conclusão/dispensa do prompt nunca bloqueiam a entrada na aplicação.

O teste automatizado cobre classificação de plataforma, standalone, disponibilidade do prompt,
continuidade, identidade central e isolamento do invite scanner-safe. **PENDENTE:** validação visual
e funcional em Android/Chrome e iPhone/iPad/Safari reais.

## Escopo e evidência

A auditoria percorreu estruturalmente as rotas Auth, Seller e Admin solicitadas, seus shells,
formulários, dialogs, tabelas e scrollports. A suíte automatizada cobre manifest/metadata/assets e as
regras transversais de responsive/coarse pointer. Não houve browser visual autenticado nem teste em
dispositivo real nesta execução.

Legenda:

- `S`: inspeção estrutural de JSX/CSS e composição da rota;
- `A`: cobertura automatizada;
- `V`: QA visual manual em browser/dispositivo real;
- `PASS (S)`: estrutura preexistente atende ao critério; não significa PASS visual;
- `FIXED (S/A)`: correção estrutural desta Sprint coberta por teste;
- `KNOWN LIMITATION`: depende de evidência visual/instalação real ainda não executada.

## Matriz por rota

| Rota | Desktop | 768 | 390 | 360 | 320 | Observações |
| --- | --- | --- | --- | --- | --- | --- |
| Login | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | AuthShell limitado; campos mobile em 16px. V pendente. |
| Forgot password | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Mesmo AuthShell e regra de inputs. V pendente. |
| Recovery + confirmação | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Form/commit refluem em uma coluna. V pendente. |
| Invite acceptance + confirmação | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Fluxo/auth preservados; copy usa identidade central. V pendente. |
| Seller — seleção de veículos | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Busca/remoção já tinham 44px; topbar custom agora respeita coarse. V pendente. |
| Seller — comparação | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Modos e PDF preservados; scroll X/Y fica no region da tabela. V pendente. |
| Admin — Veículos | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Tabela mantém scroll local; menu/nav coarse corrigidos. V pendente. |
| Admin — Novo/Editar veículo | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Grid empilha; inputs e dialogs bounded. V pendente. |
| Admin — Specs | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Label/value empilham abaixo de 64rem; toolbar deixa de ser sticky. V pendente. |
| Admin — Preços públicos | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Ledger conserva scrollport local e sticky interno só desktop. V pendente. |
| Admin — Entrada de preços | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Grid responsivo e native controls em largura disponível. V pendente. |
| Admin — Criar políticas | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Modelo/competência/preço refluem verticalmente; dialogs bounded. V pendente. |
| Admin — Importações | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Lista/tabela usa scroll local; upload empilha. Sprint 10 preservada. V pendente. |
| Admin — Detalhe de importação | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Metadados e documentos usam grids fluidos. V pendente. |
| Admin — Usuários + convite | PASS (S) | PASS (S) | FIXED (S/A) | FIXED (S/A) | FIXED (S/A) | Cards mobile existentes; menus coarse e dialogs bounded. V pendente. |

## Fundação instalável

| Item | Resultado | Evidência/pendência |
| --- | --- | --- |
| Manifest parseável e full-scope | PASS (A) | App Router, `/`, `standalone`, cores oficiais. |
| Nome e short name centralizados | PASS (A) | `src/config/app-identity.ts`. |
| Ícones 192/512/maskable/Apple | PASS (A) | Carro aprovado; PNG, dimensões e `#9ABCC8` validados; safe zone inspecionada. |
| Metadata Next/Apple | PASS (A) | Manifest, icons, `appleWebApp` e theme color cobertos. |
| Instalação Android/Chrome | KNOWN LIMITATION | PENDENTE em URL HTTPS e dispositivo real. |
| Add to Home Screen iOS/Safari | KNOWN LIMITATION | PENDENTE em iPhone/iPad real. |
| Sessão, role, logout e reabertura standalone | KNOWN LIMITATION | Código não foi alterado; smoke instalado autenticado pendente. |
| Offline | KNOWN LIMITATION | Deliberadamente não suportado; não há service worker. |

## Dívida residual

- QA visual `V` em 1440, 1280, 1024, 768, 430, 390, 360 e 320px permanece obrigatório antes do
  piloto; executar com contas Seller/Admin e dados representativos.
- Instalação, splash/background, rotação, persistência de sessão e links internos exigem Android e
  iOS reais.
- Aliases Slate/Sky/Cyan ainda sustentam consumidores legados do tema; remover somente por tela com
  correspondência semântica e validação visual.
- O favicon reutiliza o carro aprovado; em 16/32px, detalhes finos perdem legibilidade e não foi
  inventado monograma alternativo.
- A pequena imperfeição visual de boundary do React-PDF aprovada na 14F permanece documentada e não
  foi reaberta.
