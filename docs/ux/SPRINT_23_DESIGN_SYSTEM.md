# Compra Car — UX System / Sprint 23

Status: **padrão de implementação aprovado; validação visual e funcional em QA ainda em andamento**.
Escopo: branch `sprint-23-ux-react-qa`; **não alterar produção** sem aprovação separada.

## Fonte da verdade
- Este documento estabelece comportamento, hierarquia, medidas e critérios de aceitação.
- Os componentes React e tokens CSS são a implementação executável.
- O arquivo Figma `gFQSLkSSh3LZ0fHTWr06DT` é referência visual, não substitui regras e testes do Git.
- Em caso de divergência, reconciliar documentação, Figma e QA antes de declarar conclusão.

## Tipografia e marca
- Família: **Inter**, servida pelo Next.js, pesos 400/500/600/700; Söhne somente em avaliação isolada e conforme licença.
- Escala desktop: título 24px; seção 16px; corpo/sidebar 14px; dados 13px; labels 12px; legendas 11px. Botões: 12–14px/600 segundo P/M/G.
- **Não variar tamanhos tipográficos com a abertura da sidebar.** A largura de conteúdo deve se redistribuir.
- Marca: `#9ABCC8`, `#1A1D21`, `#EF7732`, `#FFFFFF`.
- SVGs oficiais em `apps/web/public/carboot/`, importados de Elementos; não substituir por Unicode improvisado.

## Shell de páginas
Todas as quatro telas — **Cadastro de Modelos**, **Fichas Técnicas**, **Comparar Modelos**, **Comparar Especificações** — devem usar:
1. Linha 1: título correspondente à sidebar;
2. Linha 2: descrição breve;
3. Divisor suave;
4. Toolbar de busca, filtros e ação principal, sem caixa exterior.
Duas variantes: **com rótulos** sobre filtros (Cadastro) e **sem rótulos** (Comparações, Fichas Técnicas).
Alinhar baseline e margens entre todas as telas. Busca, filtros e ação principal: **40px**. Ações compactas de tabela: 32px. Espaçamento constante, ícone de busca à esquerda com padding suficiente.
Todo conteúdo deve responder proporcionalmente à sidebar expandida/recolhida sem mudar tamanho das fontes.

## Cadastro de Modelos
- Toolbar: busca MMVY, Ativo, Público, limpar por `close.svg`, ação grafite **Novo veículo**; X centralizado com folga uniforme.
- Lista em linhas compactas, altura constante em edição.
- Sem edição: hover da linha e botões de ação em grafite.
- Durante edição/duplicação: apenas linha ativa destacada, nenhuma outra linha recebe hover; botões secundários continuam legíveis sem mudar de cor.
- Salvar e Cancelar sempre visíveis.

## Fichas Técnicas / Especificações
- Ficha Técnica: sete categorias, **Dimensões, Custo de Posse, Motorização, Exterior, Interior, Conveniência, Segurança**, expansíveis; cabeçalhos sticky sem fendas ou reflow. Navegação usa o `back.svg` oficial.
- Tela de edição: título **Especificações**, descrição **Gestão de especificações e equipamentos**; divisor; toolbar com busca, descarte por `close.svg`, Salvar no padrão principal.
- Cabeçalhos de coluna **Valor** e **Unidade** não devem mudar de posição ao expandir/recolher categorias.
- Estados de equipamento: `spec_available` (disponível), `spec_optional` (opcional), `spec_not_available` (indisponível). Valor não informado pode aparecer como indisponível na UI, sem transformar nulo em false na base. Opcional somente deve ser gravável quando contrato e persistência suportarem o estado.
- Unidades: distinguir unidade canônica de apresentação `display_unit_pt`; conversões físicas exigem transformação numérica correta. Internacionalização completa é futura.

## Comparações
- **Comparar Modelos**: radar de valor percebido (antigo Ver Modelo).
- **Comparar Especificações**: tabela detalhada (antigo Comparar Modelos), modos Completa/Diferenças/Vantagens e `check_bold.svg` oficial.
- Busca com autofiltro; seleção imediatamente vira card, entrada limpa para próxima busca; cards removíveis usando `close.svg`.
- Formato MMVY **Marca Modelo Versão Ano-Modelo**, sem hífen ou PY/MY na apresentação.
- Limite alvo: Visitante 3 / Corporate 8, condicionado a implementação de planos/permissões e validação também no servidor. Não conceder 8 a todo administrador sem comprovação do contrato.
- **Estado sem comparação e com resultados usam exatamente o mesmo cabeçalho, toolbar, espaçamentos e posição dos cards.** Somente o conteúdo inferior muda; nenhuma movimentação vertical/horizontal de componentes existentes.
- Comparação radar com vários modelos ainda é backlog; não confundir com radar atual de uma referência contra pares por faixa de preço.

## Critérios para encerrar esta rodada
- Conferir QA nas quatro páginas com sidebar aberta/fechada.
- Conferir estado inicial e após busca/seleção/resultado.
- Inspecionar pixel alignment, altura dos campos, espaçamentos, ícones e cabeçalhos sticky.
- Testar edição de linha e abertura/fechamento das categorias.
- Rodar build, typecheck e testes relevantes antes de promover; produção intocada.
