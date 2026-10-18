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


## Sprint 23.6 — Layout stabilization (2026-10-17)
- Figma source: https://www.figma.com/design/gFQSLkSSh3LZ0fHTWr06DT/compra-car?node-id=167-2 (page **UX - Design Systems**). Editable standards are visual references, not a substitute for QA.
- Shared page heading labels: Cadastro de Modelos, Fichas Técnicas, Comparar Modelos, Comparar Especificações. Specification editor: **Especificações**, subtitle **Gestão de especificações e equipamentos**.
- Page header: title, subtitle, 1px divider, flat toolbar, 40px controls. Initial/comparison results must preserve the exact position of header, toolbar and selected vehicle cards; render results below, without changing top container width/margins.
- Specification editor uses the shared header, divider, search, close/discard icon and Save primary action; maintain position of VALOR and UNIDADE headers when groups expand (stable scrollbar gutter and identical grid column template).
- Remaining validation: compare screenshots at identical browser zoom and sidebar state for all screens. Figma graphics are reference; only declare pixel accuracy after browser QA. No production changes.

## Sprint 23.6.1 — Especificações header and toolbar (2026-10-17)
- Align Especificações header to the common page Y-offset using `pt-2`, equivalent to other core UX screens.
- Remove `lg:max-w-md` from specifications search: flexible search uses remaining horizontal space, retaining 40px height and official search icon.
- Keep 40px close/discard beside the search, and Save at the far right with 40px primary control.
- Figma visual measurement/interaction contract: [UX — Design Systems](https://www.figma.com/design/gFQSLkSSh3LZ0fHTWr06DT/compra-car?node-id=167-2), `Sprint 23 • Spacing, sizing, interaction contracts` frame. All spacings are targets until browser QA confirms them.

## Sprint 23.7 — Global canonical radar (2026-10-17)
- Compare Models uses selected MMVY cards and a multi-series radar over the ten categories.
- Remove all MSRP ±3%, ±5%, ±10% band selectors from this page.
- Every eligible current/public/priced vehicle is scored against the **same catalog-wide category reference**, independently of MSRP. Monetary perceived-value categories: highest eligible `vw_product_value_by_category.perceived_value` is 10. Space/Cargo: average of available feature-to-global-maximum ratios. Ownership: average of global maxima of energy, range, warranty, consumption, plus inverse ratio to global minimum of `fe`. Missing metrics remain N/D and are excluded from that model's available-category mean.
- This definition reflects **current eligible catalog snapshot**; the maxima/minima change when catalog contents change. A frozen score requires an explicitly versioned benchmark snapshot in a future sprint.
- Selection UI currently enforces three models and server rejects more than three. Corporate eight is **not enabled** until authenticated tier entitlements exist. Do not infer Corporate from admin.
- Cost/benefit and equipment-per-currency ranking explicitly deferred; monetary price is not a divisor of the ten canonical dimension scores.
- Verify performance of catalog-wide data loads before approving eight models, and run a baseline-vs-result alignment check in QA.

## Sprint 23.8 — Radar compacto e controle de visibilidade (2026-10-18)
- Título do painel: **Radar de avaliação**; descrição: **Avaliação de modelos por categorias de especificações.**
- Radar: fundo `#F6F7F8`, malha e eixos `#EAF1F4`, 0.8px; série 1.5px, em foco 2px; preenchimento 7.5%. Labels menores e peso normal.
- Ícone de olho por veículo, com `aria-label`: oculta/mostra somente sua série no radar. Mantém valor e coluna na tabela; ao ocultar, o dado permanece disponível.
- Clique na legenda ou número da coluna: destaca série e coluna daquele veículo. Clique novamente remove o foco. Séries não selecionadas ficam esmaecidas.
- Radar e tabela no mesmo grid, ocupando a altura útil do viewport desktop; tabela com 10 dimensões + média, linhas distribuídas proporcionalmente.
- Cards em grid de até quatro colunas desktop, preparado para oito cards em duas linhas. O limite efetivo permanece três até autorização por plano no servidor.
- Objetivo de QA: desktop 1920x1080 sem scroll vertical; em telas menores é permitido scroll. Testar com sidebar aberta/fechada e com modelos cujos nomes são longos.
- Figma: [UX — Design Systems](https://www.figma.com/design/gFQSLkSSh3LZ0fHTWr06DT/compra-car?node-id=167-2), quadro **Sprint 23 • Radar interactions and compact viewport**.

## Sprint 23.8.1 — Radar refinement v2 (2026-10-18)
- Revert radar background to white `#FFFFFF`, matching the table.
- SVG category labels raised from 7 to 10 viewBox units for legibility; visually compare with table 12px at QA.
- Radar chart maximum display height raised to 62vh (cap 620px) and max width 760px; desktop page container allows more viewport height.
- Selected-card grid desktop dynamically fills width: exactly 2, 3, or 4 columns for 2–4 vehicles; 5–8 uses four columns and two rows. Narrower screens use 1–2 columns.
- Eye and focus interactions retained.
- Figma frame: `Sprint 23 • Radar refinement v2` on UX — Design Systems.
- Acceptance: no vertical scroll at target desktop viewport and no truncation of labels or legend. Browser QA pending.

## Sprint 23.8.2 — Legenda inferior do radar em cards dinâmicos (2026-10-18)
- Os MMVY abaixo do radar são controles em grade de largura total, não legenda flex alinhada apenas à esquerda.
- Desktop: 2 modelos = 2 colunas iguais; 3 = 3; 4 = 4; 5–8 = 4 colunas com segunda linha. Mobile = 1; tablet = 2.
- Cada card inclui cor, índice, nome MMVY truncável e olho fixo à direita; padding horizontal 8px, borda 1px #D6DEE3, tipografia Inter 12px medium.
- Clicar no nome ativa/desativa o foco; o olho controla a visibilidade do polígono sem remover os scores da tabela. Card em foco usa #EAF1F4.
- Documentado em Figma UX — Design Systems, quadro `Sprint 23 • Radar legend dynamic control grid` (frame 174:2). A autorização Corporate 8 segue pendente; limite atual 3.

## Sprint 23.9 — Loading, official icons, Chat & News (2026-10-18)
- `apps/web/src/app/admin/loading.tsx`: Next.js admin-segment loading fallback with official `icon_logo_official.svg`, 80px animated circular border, blue/orange, 56px centered logo and accessible loading text. This is a route-level Suspense fallback, not an artificial timer; confirm actual appearance with slower QA navigation.
- Comparison-specification PDF actions now use the unchanged Figma vector paths `icon_download 1` and `icon_share 1`, imported under `public/carboot/download.svg` and `share.svg`, recolored to official graphite `#1A1D21`. Size 16px, existing PDF/download/share behaviors preserved.
- Admin sidebar adds official `icon_chat 1` and `icon_news 1` icons at 22px. Links lead to `/admin/chat` and `/admin/news` pages explicitly labeled *Em breve*. These features are placeholders only, not active services.
- Figma visual contract: UX — Design Systems, frame **Sprint 23 • Loading and navigation**.
- Next roadmap phase: unify price list/input/policies page shell, toolbar, hierarchy, component sizes and responsive behavior; keep production untouched.

## Sprint 23.10 — Pending-query loading and specifications density (2026-10-18)
- Root admin route `loading.tsx` remains for initial server-route fallback. On explicit comparisons and mode-filter navigations, use `ComparisonLoadingOverlay` backed by React transition pending state to visibly dim the current page (`#1A1D21/35`), blur 2px, show branded logo ring and `Carregando comparação...`. Do not simulate a delay. Validate pending indication against QA response timing.
- Sidebar displays **News** before **Chat**, both placeholder destinations; use official Elementos icons.
- Comparing specifications on desktop uses viewport-sized flex layout; preserve page heading, selected MMVY cards and mode toolbar while only the `comparison-scroll` table region scrolls.
- Mode switch buttons align vertically with download/share buttons, and the mode description is inline alongside modes to reclaim height.
- Compare table uses 13px desktop label/numeric typography and compact line height; verify density against other pages without reducing readability.
- Figma: UX — Design Systems / `Sprint 23 • Comparison query loading and inner scroll` frame 181:2.
- QA pending: compare two/three models at 1920x1080, inspect scroll containment and overlay on slow query; browser-specific behavior is not yet approved.

## Sprint 23.11 — Full-row winners and updated white-background logo (2026-10-18)
- Comparar Especificações: orange `check_bold.svg` belongs **only to the best result(s) across every vehicle in the row**, never to each vehicle that happens to beat the reference independently.
- Non-numeric equipment: all present values win/tie; absence is not marked. Numeric fields use the engine's reference-relative comparison outcome to establish whether higher or lower is favorable, then compare all valid numeric values in the row. Equal best values all receive a check.
- Missing/ambiguous/inconsistent numerical results do **not** receive a guessed winner check. Preserve the displayed values and their types. Business semantics and ranking directions must be revisited if the comparison engine exposes dedicated winner metadata.
- The new `icon_logo_official_whiteBG 1` SVG from Figma Elementos is saved as `/carboot/icon_logo_official_whiteBG.svg`; both route loading fallback and dimmed comparison-query overlay use it instead of the older generic icon. Sidebar keeps its own dark-background logo unchanged.
- Verify two- and three-vehicle numeric winner/tie outcomes and check placement in QA before declaring completed.

## Sprint 23.12 — Correção crítica de direção de vantagem (2026-10-18)
- Corrigido erro da inferência baseada em `comparison === advantage/disadvantage` contra o primeiro veículo: não é uma regra válida para determinar a direção física entre todos os modelos.
- Vencedores de métricas com preferência **ascendente** (maior é melhor): capacidade, carga, tração, volume, porta-malas, tanque, autonomia, consumo em km/L.
- Preferência **descendente** (menor é melhor): eficiência energética em MJ/km, emissões/CO₂, tempo de aceleração, distância de frenagem, consumo em L/100 km.
- Empates no valor ótimo recebem check todos; nulos não recebem. Em métricas sem semântica verificada, check numérico fica oculto, não arbitrariamente invertido.
- Eficiência energética recebe duas casas decimais em pt-BR (`1,36 MJ/Km`); os demais formatos preservados.
- Pendência prioritária: formalizar direção por código de especificação (catálogo canônico com `higher_is_better/lower_is_better/neutral`), validar engine e todos os 196 itens com testes de regressão antes de liberar checks amplamente. Esta é mitigação segura, não auditoria completa.

## Sprint 23.13 — Cadastro inline e filtro binário de especificações (2026-10-18)
- `Novo veículo` no Cadastro de Modelos abre a linha editável no topo da lista (sem outra página). Campos: Marca, Modelo, Versão, Ano-modelo. Salvar/Cancelar reaproveitam as ações validadas de criação; nenhuma exigência de correspondência com MMV existente. Novo veículo nasce **Inativo e Privado**, inclusive antes de qualquer especificação. Ano de produção legado é sincronizado com ano-modelo até remoção do requisito na camada canônica.
- Após criar: fechar edição, limpar `?new=1`, atualizar lista e ordenação alfabética. A rota legada `/admin/products/new` redireciona para o fluxo inline.
- Na toolbar, filtro `Especificações`: **Todas**, **Não iniciada**, **Preenchida**. Sem coluna de status na listagem.
- Estado **Não iniciada** = não existe especificação com valor numérico nem `is_present` explícito salva no banco. **Preenchida** = existe ao menos uma especificação salva (`value is not null OR is_present is not null`), independentemente da quantidade; não significa que esteja completa.
- Status computado pela view `vw_admin_product_spec_started` do banco QA e migration `20261018153000_admin_product_spec_started_view.sql`. Não armazenar campo/flag duplicado no produto. Novos veículos podem abrir ficha de especificações vazia para preenchimento progressivo.
- Figma: UX — Design Systems, frame **Sprint 23 • Inline vehicle creation and specification filter** (188:2). Os SVGs `finished`/`not_started` são opcionais e não são necessários no dropdown textual nativo.
- Validação restante: confirmar build e criação manual em QA com entradas controladas, sem tocar Produção. Testar filtro com resultados vazios, edição de especificações e recálculo do status.

## Sprint 23.13.1 — Inline creation alignment and brands (2026-10-18)
- Opening `Novo veículo` must never shift the list column header horizontally. The new row uses an inset orange selection indicator rather than `border-left`; the table scroll area reserves a stable scrollbar gutter.
- New vehicle's **Marca** is a required SELECT populated from the existing full catalog, not the currently filtered vehicle rows. Do **not** permit typing or creating a new brand in Cadastro de Modelos. The server creation action independently validates membership in the existing-brand list.
- Future scope: a separate **Administrar Marcas** administrative workflow will govern new brand registration, updates and aliases. This screen must not invent brands.
- First 56% of the new row (Veículo column) holds four compact inline controls: Marca, Modelo, Versão and Ano-modelo. Two 11% spacer columns keep Atividade and Publicação clear. Salvar and Cancelar occupy the last two 11% columns aligned with Editar and Duplicar.
- Search and filters: Ativo, Público and Especificações use equal-width 8rem desktop columns and uniform 40px controls.
- Validate no layout shift when opening/closing, changing filters or triggering scroll; responsive narrow screens may need horizontal table scroll. Production remains untouched.

## Sprint 23.13.2 — Catalog saving indicator and scrollbar (2026-10-18)
- Catalog mutations (create, edit, duplicate) use the existing branded dimmed loading overlay with official white-background logo while the server action remains pending. No artificial timers.
- Inline Save/Cancel buttons use vertically centered flex cells, aligned with Editar/Duplicar column tracks.
- Catalog list scrollbar uses browser-native scrolling with themed scrollbar width 10px (WebKit/Chromium), track `#F6F7F8`, thumb `#9ABCC8`, hover `#61747B`, rounded thumb and 2px inset border. Firefox uses thin scrollbar and `scrollbar-color`.
- Native scrollbar arrow buttons vary by browser/OS; do not emulate fake arrow controls that risk breaking accessibility.
- QA: verify scrollbar stability and Save/Cancel alignment on desktop, and overlay appearance on slow catalog create/edit/duplicate.

## Sprint 23.13.3 — Correção estrutural do alinhamento (2026-10-18)
- A linha Novo Veículo deve conter as mesmas **cinco células HTML reais** das demais linhas: Veículo, Atividade, Publicação, Editar e Duplicar. Não simular estas colunas usando `colSpan=5` e um grid de percentuais interno; padding de célula, largura da tabela e scrollbar causavam desalinhamento.
- Formulário com `id=catalog-new-vehicle` permanece dentro da primeira célula, contendo os quatro campos. Botão Salvar na quarta célula usa `form=catalog-new-vehicle` para acionar o submit externo ao formulário. Cancelar ocupa a quinta célula. Ambos herdam exatamente o alinhamento das ações existentes.
- Critério QA: comparar centros horizontais de Salvar/Editar e Cancelar/Duplicar, com sidebar aberta/fechada e a linha criada no topo. Não considerar aprovado antes da verificação visual.

## Sprint 23.13.4 — Vertical alignment of inline create actions
- The real table cells preserve exact horizontal alignment with Editar/Duplicar. Add 24px of internal top spacing before Save and Cancel so their control baselines align with the four vehicle inputs below the row caption. Verify visually in QA.

## Sprint 23.14 — Pricing UX / stage A (2026-10-18)
- Start with Lista de Preços, preserving pricing logic and all existing publication operations. Header is the shared CatalogPageHeading: title `Lista de Preços`, subtitle and divider.
- Pricing toolbar now includes search with official magnifying-glass icon and 40px input, 40px Status dropdown, official close reset, Cadastrar políticas secondary action and Cadastrar preços primary graphite action.
- Pricing MMVY labels omit separator dash before model year. No financial formulas or price status semantics changed.
- Stage B backlog: Cadastrar Preços batch and Cadastrar Políticas workspace UI consolidation, with functional regression checks prior to QA approval. Do not touch Production.

## Sprint 23.14.1 — Recuperação do desenho original de Preços (2026-10-18)
- Fonte Figma recuperada: página `UX — Preços`, frame **01 • Preços Públicos — listagem limpa / Vigente**, node `85:64` no arquivo `gFQSLkSSh3LZ0fHTWr06DT`. Layout simplificado da tabela: **Veículo, Preço Público, Início Vigência, Status, Atualizado em, Editar**; sem colunas independentes de Publicação. Manter ação Publicar nos rascunhos, sem alterar as regras financeiras.
- Removidos metadados secundários redundantes da vista compacta: preço ID e criado em, preservados na base.
- Overlay de consulta durante alterações de filtros de preços usa `ComparisonLoadingOverlay` e o estado `pending` da navegação. O `loading.tsx` de rota não garante overlay sobre a tela anterior no carregamento inicial por URL direta; não inventar timers para simulá-lo.
- Validar no QA o comportamento visual, spinner durante filtros lentos e sort/paginação. Produção intocada.

## Sprint 23.14.2 — Refinamento Lista de Preços (2026-10-18)
- Mostrar MMVY em **uma linha**, sem separar Marca/Modelo e Versão/Ano-Modelo; permitir scroll horizontal da tabela em viewport reduzida.
- Coluna de vigência intitulada **Vigência**.
- Header da listagem utiliza `#DCE8ED` como outras tabelas administrativas; hover de linha utiliza `#EAF1F4`.
- Coluna Editar centraliza o botão na mesma posição de cabeçalho; para rascunho usar edição existente. Para preços publicados manter registro histórico imutável e oferecer fluxo de novo rascunho de correção. **Ainda não existe alteração retroativa segura de valores publicados**, isso exige contrato auditável de correção/supersessão. Não oferecer edição direta que contorne guardas existentes.
- Status Vigente é atualmente um badge CSS de texto, **não é SVG de Elementos**. Migração de status/iconografia depende de aprovar o componente visual; manter sem ícone se a referência visual pede apenas badge.
- Barra de ações: **Cadastrar preços** antes de **Cadastrar políticas**.

## Sprint 23.14.3 — Public-price correction draft and official status SVGs (2026-10-18)
- Pricing list: display dates separately as **Vigência De** and **Vigência Até**. Null end date shows `—` (no "até Sem término").
- Pricing status badges: use official Figma Elementos SVG `vigente`, `draft` (Rascunho), `expired` (Expirado) from `public/carboot/status_*.svg`; other statuses remain text until equivalent assets are defined. Avoid additional nested badge styling when vector contains its own appearance.
- Vehicle catalog uses `active`, `inactive`, `public`, `private` official status artwork. `paused` and `watching` assets are stored for future appropriate agent/monitor status screens, but not applied indiscriminately.
- Exact header consistency: shared color `#DCE8ED` across vehicle/pricing admin tables, but legacy list and table wrappers may still differ in padding, sticky position and line height; visual QA is required before claiming pixel identity.
- Existing published prices remain immutable through current update command. **Corrigir** opens a prefilled **new draft** via the existing creation action with product/amount/vigency inherited. The dialog states that the old published row remains unchanged. This is a safe preliminary correction workflow, *not yet automatic supersession*: ensure review and no overlapping published periods before release. Do not bypass workflow, don't claim direct historical edits.
- UX action order: **Cadastrar preços**, then **Cadastrar políticas**.

## Sprint 23.14.4 — Price-list CSS badges, full scroll & technical-sheet actions (2026-10-18)
- Status badges temporarily revert to compact **CSS** in Prices and Vehicles. Do not use the rejected oversized SVGs, though retain assets in Elements/Git.
- Prices: all headings and values centered except the MMVY column, whose text remains left-aligned. Header cells use `#DCE8ED`; hover cells `#EAF1F4`.
- No visible pagination in Lista de Preços: the server retrieves all internal repository pages in bounded groups for the current filter/sort and displays them in one scrollable table; no truncation of records or financial rule changes.
- Technical sheet detail page uses `CatalogPageHeading` with model title, subtitle and 1px divider. Below: consistent horizontal toolbar with Voltar aos modelos, Salvar PDF and Compartilhar using official Figma back/download/share SVG assets.
- Technical sheet sharing uses native share API when supported, otherwise copies the URL. `Salvar PDF` opens the browser print dialog, where user selects Save as PDF; **there is no dedicated server-side technical sheet PDF endpoint yet**. Print CSS expands technical table and avoids clipping its scroll container.
- Check page screenshot and browser print preview before calling visual/print release approved.
