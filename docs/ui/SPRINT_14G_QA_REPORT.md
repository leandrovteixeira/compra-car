# Sprint 14G — relatório de QA responsive e instalável

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
