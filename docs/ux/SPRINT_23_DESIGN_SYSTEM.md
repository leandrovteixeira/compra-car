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

## Sprint 23.14.5 — Ações padronizadas e retorno aos badges CSS
- Ações **Voltar**, **Salvar/Baixar PDF** e **Compartilhar** compartilham `cc-outline-icon-action` nas telas de Ficha Técnica e Comparar Especificações: fundo branco `#FFFFFF`, borda 1px `#D6DEE3`, ícone SVG oficial grafite `#1A1D21` em 16px, texto Inter 12px/600, altura fixa 40px e largura 170px no desktop (mobile flexível). Download e Share têm dimensões rigorosamente iguais.
- Status de veículo (Ativo, Inativo, Público, Privado) e preço (Vigente, Rascunho, Expirado etc.) usam novamente **pílulas CSS discretas**, com borda e fundo suave. Não renderizar os badges SVG rejeitados. SVGs são mantidos como assets de referência para eventual redesenho.
- Qualquer mudança visual deve manter a lógica de download e compartilhamento já existente; no detalhe da ficha técnica, Salvar PDF continua usando o diálogo de impressão do navegador.

## Sprint 23.14.6 — Alinhamento de preços e modelo dos badges CSS (2026-10-18)
- Preços: alinhar horizontalmente o hífen da coluna **Vigência Até** e a data de **Atualizado em** aos respectivos títulos; outros valores permanecem centralizados, MMVY alinhado à esquerda.
- Comparar Especificações: remover a segunda linha menor `equipmentGroup` de cada item; manter só o nome principal (`row.label`), sem alterar valores.
- Lista de Preços usa exatamente o token `cc-type-data !font-semibold` de Cadastro de Modelos (Inter via `--font-sans`, tamanho `--font-size-data`, line-height 1.4, peso 600).
- Badges atuais são CSS de largura dinâmica, não imagens. **Veículos:** texto Inter 12px, peso 500, padding horizontal 8px e vertical 2px, borda 1px, `border-radius:9999px`. **Preços:** texto Inter 12px/peso 500, padding horizontal 10px e vertical 4px, borda 1px. Altura nominal aproximada 22px nos veículos, 26px em preços (varia com métricas de fonte/line-height); largura resulta do texto + padding, não há largura fixa.
- Positivos: borda `#AFE3C3`, fundo `#F1FAF5`, texto `#16854A`. Negativos/inativos: borda `#D6DEE3`, fundo `#F3F5F6`, texto `#839198` (veículos). Preços expirados/demais: borda `#D6DEE3`, fundo `#F1F3F5`, texto `#697786`. Requer revisão: borda `#EDD19A`, fundo `#FFF8E8`, texto `#9B6A19`.
- Esses são **valores atuais de implementação** para referência de reconstrução, não medidas verificadas por ferramenta de inspeção no navegador. Preferir criar um componente tokenizado de badge para harmonizar a altura (sugestão futura: 24px fixos).

## Sprint 23.14.7 — Native CSS badges, shared loading, inline price correction
- All native CSS status pills are 24px tall; avoid SVG badges in tables.
- All branded loading overlays and route fallbacks say only **Carregando**, regardless of source (comparison, pricing or catalog).
- List of Prices opens price, startsOn, endsOn inputs **in their own table cells**, without modal/drawer. Save/Cancel replace Editar/Corrigir in the action column; other rows retain positions.
- For editable draft states, Save uses existing validated update action. For published records, Corrigir uses existing validated creation action and creates **a new draft** from changed price/date values; original published record remains unchanged. Supersession and overlapping periods must be addressed before enabling one-step publication of corrections.
- QA must verify numerical formats, date validation, cancel/refresh and persistent history. The old dialog component is retained in code for other usages but is no longer opened by pricing list action buttons.

## Sprint 23.15 — Fix inline price correction and next pricing screens (2026-10-18)
- **Root cause:** `product_public_prices` has `UNIQUE(product_id, starts_on)`. Copying an existing published price into a new draft with the **same** `starts_on` violates the constraint. The default correction start is now the current São Paulo operational date when later than the existing start, otherwise the next day. The user may change dates, but duplicate effective starts are not supported.
- Saving a published price correction creates a **separate draft** through the server-validated creation action, retains the published row and navigates to `/admin/prices?status=draft` so the saved item is visible. Draft edits use the update action and refresh in place.
- Inline editor validates positive monetary amount, required start date and end >= start; server field errors are shown visibly instead of generic success claims.
- Publication still uses existing audited `publish_product_public_price` and `rollover_product_public_price` routines: publishing an eligible successor with a later start can end its predecessor. Same-day retroactive corrections are **not** implemented, because economic identity and original start are immutable by trigger.
- **Cadastrar Preços** and **Cadastrar Políticas** adopt the shared page heading and divider, with the standard white graphite Voltar button below. Batch entry uses `#DCE8ED` for header and the shared branded **Carregando** overlay while its server action runs.
- Regression criteria: create corrected draft from a published price with an older start; verify on Rascunhos filter; edit a draft; reject invalid amount/end date; confirm no production mutations. Do not mark end-to-end success until executed against QA.

## Sprint 23.16 — Retificação administrativa e publicação manual imediata (2026-10-18)
- **Correção de erro no registro publicado:** ação `correctPublishedProductPublicPriceAction` chama a RPC protegida `correct_published_product_public_price`, que pode corrigir valor e as datas originais (inclusive históricas) **no próprio registro**, exige administrador ativo, versão otimista, justificativa administrativa e correlação. Escreve evento de auditoria `update` com snapshots completos antes/depois; triggers preservam imutabilidade para alterações normais. A função rejeita sobreposição temporal com outro preço publicado e não altera outros veículos. A data original não é deslocada artificialmente.
- Migração QA `20261018194000_audited_published_price_correction.sql`: função SECURlTY DEFINER protegida para `service_role` com RLS/autorização no servidor e `assert_active_pricing_admin`; exceção de trigger temporária e restrita à mesma transação e ao ID a corrigir.
- **Lote manual:** botão **Salvar preços** no topo, ao lado de Voltar, grafite. Remoção de linha usa `close.svg` oficial, sem X vermelho. Lote manual agora **cria e publica atomicamente** por `create_and_publish_manual_price_batch` (migração `20261018195000_atomic_manual_price_publish.sql`) utilizando os controles de auditoria e publicação já existentes. Se algum preço ou vigência não puder ser publicado, rollback do lote inteiro. Dados por agentes continuam sujeitos à própria revisão/fluxo de rascunhos, sem alteração.
- Preços publicados com início futuro aparecem como **Previsto**; preços publicados dentro da vigência aparecem como **Vigente**. `Fim` inexistente continua como `—`.
- Testes obrigatórios para aceite: editar valor publicado mantendo início antigo; corrigir datas sem sobreposição; rejeitar conflito entre períodos; verificar evento de auditoria; cadastrar lote manual de teste com preço futuro e constatar status Previsto; lote inválido deve gravar zero linhas.
- Toda alteração nesta rodada somente em QA; **não aplicar migration ou código em produção**.

## Sprint 23.16.1 — Posicionamento de salvar e mensagens no lote (2026-10-18)
- No cadastro de preços em lote, manter somente **Voltar aos preços** na barra superior; mensagens de sucesso e erro ficam inline à direita do botão, sem faixa/card separado que aumente a altura da página.
- **Salvar preços** volta para a barra inferior, abaixo das linhas, alinhado à direita do contador. Permanece grafite, com altura de 40px e desabilitado enquanto o lote estiver vazio ou salvando.
- Respostas de erro usam `role=alert`, sucesso `role=status`, sem alterar os campos nem o fluxo financeiro.

## Sprint 23.16.2 — Ordenação Lista de Preços
- A ordenação alfabética de Veículo considera a identidade MMVY completa, com `Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })` e desempate determinístico por ID.
- O resultado filtrado é recuperado integralmente das páginas internas antes de aplicar ordenação final; o usuário continua vendo apenas scroll, sem paginação.
- **Vigência Até** recebe link de ordenação ascendente/descendente. Datas abertas (`null`, apresentadas como `—`) são mantidas ao fim em ambas as direções; demais datas ordenadas cronologicamente.
- Não alterar valores, estados, vigências ou dados de produção durante teste de ordenação.

## Sprint 23.16.3 — Ícones de ordenação e loading único (2026-10-18)
- Cabeçalhos ordenáveis usam os SVGs oficiais de Elementos: `icon_order 1` (neutro) e `icon_back 1` (direcional, rotacionado para ascendente e descendente). Arquivos: `/carboot/order.svg` e `/carboot/sort_back.svg`. Nunca usar caracteres `↕`, `↑` ou `↓` nos cabeçalhos da Lista de Preços.
- `/admin/prices/loading.tsx` deixa de exibir skeleton cinza e reutiliza `/admin/loading.tsx`, com logo oficial e texto **Carregando**.
- `products`, `ver-ficha-tecnica`, `comparar-modelos`, `comparar-especificacoes` têm fallbacks de rota que reutilizam o loading global. Formulários e filtros que fazem server actions continuam usando o overlay compartilhado durante suas consultas.
- Loadings de rota são mostrados somente durante espera efetiva de navegação; cache ou resposta imediata podem não tornar a animação visível. Não usar atraso artificial.
- Próxima etapa: refinamento detalhado de **Cadastrar Políticas**, sem modificar a semântica financeira.

## Sprint 23.17 — Cadastrar Políticas / Primeira revisão UX (2026-10-18)
- Página mantém `CatalogPageHeading` e botão Voltar no padrão white/graphite.
- Workspace: seletor Modelo/Versão, Competência e Preço válido em barra compacta sem moldura escura; inputs com alvo 40px e divisor `#D6DEE3`.
- Tabela de políticas e grade de entrada: header `#DCE8ED`, bordas `#D6DEE3`, fundo branco e texto mais compacto. Status usam CSS pills de altura 24px e cores claras, sem SVGs rejeitados.
- Botões Editar/Arquivar/ações em grafite ou secundário neutro, evitando destaque vermelho indevido em ação administrativa habitual. Mensagens de confirmação e erro no estilo claro do Design System.
- Operações de edição/arquivamento do workspace usam `ComparisonLoadingOverlay` com logo oficial e texto `Carregando` enquanto pendentes.
- Fluxos de cálculo, período especial, duplicação de base, ofertas e persistência mantidos; **não** houve alteração de regras comerciais, SQL ou dados na rodada.
- Próximo checkpoint de QA: revisar captura de tela da página com veículo selecionado, período mensal/especial, políticas existentes, criação e combinação de ofertas. Modais legados ainda requerem uma segunda revisão visual.

## Sprint 23.17.1 — Correção de alinhamento em Cadastrar Políticas (2026-10-18)
- Cabeçalho de contexto comercial: Modelo/Versão, Competência e Preço válido alinhados pelo topo (`items-start`); o campo Competência tem 40px, e suas informações auxiliares aparecem abaixo sem arrastar a searchbar verticalmente.
- Barra de colunas da grade de novas políticas deve ficar sempre **acima** dos campos, como parte do fluxo normal (`position: static`, sem sticky/overlay), com altura mínima 36px, fundo `#DCE8ED` e border `#D6DEE3`.
- Ações principais **Adicionar preço** e **Salvar políticas** usam `cc-btn--primary`, grafite `#1A1D21`, altura 40px. Botões secundários permanecem neutros.
- Critério de QA: cabeçalho não se move ao selecionar veículo, títulos Tipo/Prazo/Taxa/Entrada/Valor/Rebate/Ações visíveis acima dos inputs, sem sobreposição, em 1920×1080.

## Sprint 23.17.2 — Políticas, campos percentuais, datas e sidebar (2026-10-19)
- Taxa: apresentar porcentagem com 2 casas decimais em pt-BR (0,00%), Entrada: porcentagem sem decimais (00%). Sufixo % é visual, não entra no payload canônico; formatar ao perder foco sem interferir na digitação.
- Período de competência: checkbox “Período especial” e intervalo na **mesma linha**. Datas exibidas como dd/mm/aaaa; valores de entrada continuam ISO para compatibilidade com o motor.
- Tabela de políticas existentes: cabeçalho deve permanecer acima das linhas após salvar. Remover sticky heredado do `admin-table-header` do cabeçalho de políticas.
- Grade de políticas: botões de adicionar descrição e remover usam SVG oficiais `plus.svg` e `close.svg`, sem símbolos improvisados.
- Sidebar: adotar família SVG de Elementos com sufixo `2` (sem dot laranja) para Home, Veículos, Preços, Inteligência, Educação, News, Chat, Agentes, Configurações, Conta.
- Ordem final dos cinco itens: **Educação → News → Chat → Agentes → Configurações**.
- Verificar no QA salvamento e re-renderização, incluindo diferenças entre dados anteriores e valores formatados. Nenhuma alteração de regra comercial ou banco nesta rodada.

## Sprint 23.17.3 — Sidebar account v2 and custom dark scrollbar (2026-10-19)
- Expanded user account menu `UserMenu(sidebar)` now uses `/carboot/account2.svg`, matching the collapsed sidebar and the Elementos `icon_account2 1` asset.
- Only the sidebar `<nav>` uses the `cc-sidebar-scroll` class. Do not apply it to pricing/specification/catalog table scrolling.
- Native CSS scroll, kept keyboard-/wheel-/touch-accessible: thin scrollbar, Chromium/WebKit width **6px**, track `#1A1D21`, thumb `#526670`, hover `#9ABCC8`, radius `999px`. Chromium/WebKit scrollbar arrow buttons hidden. Firefox uses `scrollbar-width: thin`, `scrollbar-color: #526670 #1A1D21`.
- `color-scheme: dark` prevents a light native gutter; scrollbar behavior and button support can differ by platform. Main content and footer remain outside the sidebar's independently scrollable nav.
- QA: check expanded account icon, scrolling with sidebar hover expanded at 1920x1080, collapsed sidebar, keyboard tab navigation and Firefox fallback.

## Sprint 23.17.4 — Autocomplete nativo e datas restantes (2026-10-19)
- Combobox de MMVY: `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, `spellCheck={false}` e nome de campo específico para reduzir sugestões do navegador que encobrem o dropdown da aplicação. Histórico já armazenado no navegador pode continuar aparecendo conforme as configurações individuais do Chrome; não é apagado pelo site.
- Todas as vigências renderizadas no workspace comercial, inclusive listas históricas, passam pelo formatador `formatDateBR` e exibem `dd/mm/aaaa`; internamente as datas ISO permanecem inalteradas para cálculo e persistência.
- Próximo trabalho antes de produção: matriz de perfis e autorização efetiva (Visitor, Corporate, administrativo, acesso por permissões), testes de isolamento e plano de promoção de migrations/código — nunca copiar dados de QA.

## Sprint 23.18 — Consultas read-only: Lista de Preços / Políticas Vigentes (2026-10-19)
- Renomear título e item `/admin/prices` para **Gerenciar Preços**, mantendo edição e histórico.
- Nova **Lista de Preços** em `/admin/prices/list`: título/subtítulo padrão, busca MMVY ampla, filtro Status Vigente/Previsto/Expirado/Todos; sem ações, marca, fonte, lote ou paginação. Tabela MMVY, Preço Público, Vigência De, Vigência Até, Status, Atualizado Em. Scroll interno e ordenação com SVGs oficiais.
- Nova **Políticas Vigentes** em `/admin/prices/policies/current`: read-only, busca MMVY, competência, filtro Tipo; colunas MMVY, Competência, Política, Valor, Status e indicador de ofertas. Mostrar apenas políticas publicadas aplicáveis à competência selecionada; usar ícone oficial `icon_layers 1` em `/carboot/layers.svg` em laranja `#EF7732`, quantidade e expansão inline para ofertas associadas. Sem edição e sem paginação.
- Os estados de política e relacionamento de ofertas são independentes; participar de uma oferta não torna política em rascunho vigente. A expansão mostra identificador, período, estado e benefício da oferta.
- Estas são primeiras versões para refinamento em QA; **não** alterar regras comerciais nem escrever dados em produção.

## Sprint 23.18.1 — Lista de Preços e Políticas Vigentes: revisão de filtros e empty state (2026-10-19)
- Ícone neutro de ordenação deve ser sempre o SVG oficial `icon_order2 1`, exportado como `/carboot/order2.svg` sem bolinha laranja. Aplicado à Lista de Preços e Gerenciar Preços; ordenar em uso mantém ícone direcional oficial `sort_back.svg`.
- Alinhar a barra de filtros pelo rodapé dos controles (`items-end`); botão `close` usa área 40×40px sem margem superior adicional.
- Títulos de tabelas de consulta usam **VEÍCULO**, não MMVY; identidade MMVY permanece o dado exibido.
- Políticas Vigentes exibe somente políticas publicadas para a competência. QA auditado em 19/10/2026: 27 políticas em `draft` e zero publicadas; a tabela vazia é correta, mas agora tem explicação contextual. Nunca mostrar draft como vigente.
- Busca textual de veículos atua sobre registros vigentes; com zero publicados não haverá resultados independentemente do termo. Validar interação com políticas publicadas antes de declarar comportamento funcional completo.

## Sprint 23.19 — Decisão aprovada: política comercial sem aprovação intermediária (2026-10-19)
- Políticas e ofertas comerciais cadastradas manualmente por admin autorizado ficam efetivas na competência, sem controles de aprovação, rejeição, arquivamento ou drafts visíveis na UX.
- Status **Vigente/Expirada são derivados em relação à competência consultada e ao período comercial**. Preservar histórico dos meses anteriores; uma política de setembro segue aplicável ao consultar setembro.
- A vigência de ofertas é exatamente a da carta/competência: mês civil completo ou período especial intra-mês com início/fim definidos.
- Correções de políticas publicadas preservam IDs, associações `commercial_offer_policies`, before/after na auditoria, versão otimista e consistência das ofertas relacionadas. Nunca desfazer memberships ao alterar valor.
- Conversão dos dados QA exige verificar validadores de publicação de política e oferta, inclusive MSRP publicado, vínculos e problemas bloqueantes, antes de qualquer migração em massa. Base auditada: 27 políticas e 22 ofertas, todas `draft` no início da revisão. Não aplicar update direto burlando triggers.
- UX Cadastrar Políticas deve exibir ações **Editar/Corrigir** de política vigente, e os detalhes das ofertas associadas; Políticas Vigentes deve apresentar resultados publicados pertinentes à competência.
- Produção fica intocada; migração para publicação requer implementação e testes completos em QA.

## Sprint 23.19.1 — Bulk entry by brand and policy date display (2026-10-19)
- Cadastrar Preços: **Preencher por marca** uses a standalone labeled brand dropdown and **Carregar versões** button above existing entry grid, rather than overloading the individual MMVY search.
- Source: canonical brand names, active+public vehicle options only; builds preselected MMVY lines for the brand and leaves price/date blank. Maximum 100 valid vehicles; explicit confirmation before replacing entered rows; existing per-line combobox remains available.
- Policy offer details: format commercial offer start/end as `dd/mm/aaaa` while keeping storage ISO.
- QA publishability audit (read-only): 27 draft policies, 7 pass existing validator, 20 fail owing to missing compatible published MSRP. Avoid blind mass update; validate a published candidate and the policies page without breaking financial references.
