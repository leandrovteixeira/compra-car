# Design system — foundation

## Direction

The Compra Car interface is light-first, compact and data-oriented. Inter is the temporary global
typeface; the centralized `--font-sans` token allows a future move to Söhne without component-level
changes.

## Palette

- white `#FFFFFF`: primary surface;
- graphite `#1A1D21`: primary text;
- light blue `#9ABCC8`: supporting interactive/focus language;
- orange `#EF7732`: exceptional attention.

Semantic tokens live in `apps/web/src/app/globals.css`: background, surface, muted surface, primary,
secondary and muted text, borders, interaction, focus, attention, success, warning and error. Legacy
Slate/Sky/Cyan utilities are mapped centrally to the light palette during the incremental migration.

## Orange rule

**Orange = Attention, not Action.** Primary buttons use the neutral blue/graphite interaction token.
Orange identifies exceptional visual priority, currently the advantage check in vehicle comparison.
Success remains green and is not interchangeable with comparison advantage.

The complementary semantic rule is **Blue = Interaction / Identity** and **Graphite = Structure**.
Official blue `#9ABCC8` may identify interactive buttons, active controls, selection and informational
badges, always with graphite text when used as a background. Graphite continues to structure primary
text, navigation and neutral actions. Predominantly neutral surfaces keep blue as rhythm and
affordance rather than decoration.

## Density

- desktop controls: 36px;
- coarse-pointer controls: at least 44px;
- table rows: 48px;
- common surface padding: 16px;
- discrete control radius: 6px;
- surface radius: 10px;
- page title: 24px; section title: approximately 16px; body: 14px; labels/meta: 12–13px.

## Primitives

`@compra-car/ui` exports stable class-name primitives for primary, secondary, ghost, destructive and
compact buttons, plus fields, labels, helpers, surfaces, badges and dense tables. Business components
remain in the web application and compose these primitives.

Sprint 14E adds only recurring geometry primitives: `ui-form-grid` for predictable two-column
administrative forms, `ui-form-section` for divider-led grouping, `ui-table-frame` for the single
border around dense tables and `ui-badge--info` for blue informational state. These are deliberately
generic; domain-specific grids keep their local column definitions.

## Remaining-screen consolidation

Pricing, Policies, Imports, Users and Auth now follow the same compact light-first vocabulary.
Toolbars are divider-led instead of card-led, desktop fields target 36px, table actions may target
30px, and coarse pointers still receive 44px through the shared media rule. Import lists use dense
semantic tables on desktop with local horizontal scrolling rather than one large card per record.

Blue `#9ABCC8` is intentionally visible on creation/submission actions, selected/informational badges,
upload targets and the Auth identity rule. Graphite remains the structural/strong action color.
Orange remains attention-only and is not a default CTA or common metadata badge. Success, warning,
error and destructive states retain their independent semantic colors.

Legacy Slate/Sky/Cyan aliases remain transitional for screens not migrated in 14E and for semantic
status styling that still needs a dedicated component pass. Do not remove those aliases globally;
replace page-local uses only while touching and visually validating that surface.

### Pricing ledger and intensive-entry grids

The public-price ledger follows the catalog workspace architecture: the desktop page is a bounded
viewport grid and the results table owns both horizontal and vertical scrolling. Sticky behavior is
applied to each semantic `th` at `top: 0` inside that scrollport; the ledger must not use the global
stacked `admin-table-header` offset. The table frame keeps pagination outside the scroll track.

Headers for intensive-entry grids remain in normal layout flow unless the grid explicitly owns a
bounded vertical scrollport. Reusing a document-level sticky class on a local grid header causes the
first input row to overlap and is prohibited. Pricing and policy inputs keep 36px shared fields,
approximately 32px column headers and the coarse-pointer 44px override.

The Policies selection area is one divider-led form section with vehicle, competence and valid-price
columns. It must not regress to an outer card containing one card per column; responsive stacking is
handled by the same grid without changing selection behavior.

Specialized pricing, import, product-spec and comparison grids retain local layout classes because
their column geometry and responsive behavior are domain-specific. They inherit the centralized light
palette now and can migrate incrementally to the shared density primitives without changing behavior.

## Application shell

The global shell uses a compact 52px topbar with a reusable brand slot, one authorization-aware
context switcher and one user menu. The switcher exposes Administration only from the trusted admin
profile; Seller is available to both current roles. Account identity, role and logout live exclusively
in the user menu. On desktop, the admin sidebar contains only local navigation and fits below the
topbar without its own vertical scroll. On mobile, local admin navigation moves to a keyboard-operable
disclosure menu.

Canvas, elevated topbar, primary surface, muted surface and selection each have semantic tokens.
Light blue is limited to focus and subtle active-selection hierarchy; orange remains excluded from
shell navigation and controls. Low-priority icon buttons and row actions may use a 30–32px visual box,
while coarse-pointer rules preserve the larger touch target where applicable.

At 320–400px the topbar uses four explicit columns for compact brand, context switcher, mobile
secondary navigation and user menu. The brand remains `CC`, context labels stay non-shrinking and the
“Mais” trigger becomes an accessible ellipsis below 28rem; its menu remains available. This reflow is
in normal grid flow and must not be replaced by absolute positioning of the trigger over the context
switcher.

## Vehicle catalog

The administrative catalog uses one URL-backed search field for brand, model and version. Text input
is debounced by 275ms; Active and Public select changes update immediately, and Clear restores the
unfiltered URL. Catalog rows target the shared 48px table density and use compact ghost/secondary row
actions.

Whenever production and model years appear as a pair, presentation is **production/model** (`26/27`
or `2026/2027`). Storage fields retain their original names and meaning. The identity blue remains
`#9ABCC8`; `interactive` (`#315E6D`) and `interactive-hover` (`#244B58`) are darker semantic derivatives
used only where white foreground contrast requires them. The former independent `#466F7D` value is no
longer part of the palette.

## Seller vehicle selection

The seller starts with one mobile-first search over the complete public-eligible catalog returned by
an authorized, cached Server Action. Brand, model and version share the normalized token matcher also
used by the administrative catalog; diacritics, case and repeated whitespace do not prevent matches.
An empty query renders a compact prompt rather than the catalog. Matching results stay directly below
the input and one click/tap adds the vehicle, removes it from subsequent results, clears the query and
returns focus to search.

Selected vehicles render as a numbered ordered list. The first row carries a subtle blue `Principal`
badge, every row has an accessible 44px removal target, and removing the first naturally promotes the
next item without separate state. The selection surface accepts up to four vehicles, requires two to
compare and preserves URL order. Search uses a 16px mobile font and 44px controls; results have a
bounded vertical scroll while the page never introduces horizontal overflow. `ui-button--interactive`
is the opt-in blue action variant; the graphite `primary` primitive remains unchanged for existing
flows.

## Sticky stack and specs density

Desktop administrative pages use the application topbar as their global sticky layer. The vehicle
catalog below it is a viewport-height grid with natural tracks for page header and filter toolbar,
followed by a `minmax(0, 1fr)` results track. Only the semantic table viewport scrolls on desktop, on
both axes, so page header and toolbar remain visible without accumulated height offsets. Each table
header cell is sticky at `top: 0` inside that same viewport, with an opaque surface, divider and higher
stacking level than rows. On mobile the document resumes vertical scrolling and the table retains its
local horizontal overflow. Primary actions use graphite `#1A1D21`; blue remains
informational/selection and orange remains attention-only.

The specs editor targets approximately 44–48px for ordinary desktop rows. Category summaries target
32–34px and render as flat section rows; labels and codes use compact line heights. Detailed fields
use a bounded 52rem internal grid: a flexible label track up to 28rem and a value track up to 22rem.
Every numeric, select, scale and tri-state control starts at the left edge of that value track rather
than aligning by its right edge. Numeric groups use a compact input plus a predictable 4rem unit slot.
Below the desktop breakpoint the grid reflows to label/meta followed by control without global
horizontal overflow. The search/progress/save toolbar keeps its current density and uses the same
horizontal padding as category headers and field content.

## Vehicle comparison

The comparison has three URL-backed modes in one native-radio segmented control: **Completa** keeps
every applicable row, **Diferenças** keeps only semantically different raw values without ranking
them, and **Vantagens** keeps only rows for which the existing domain engine produced an objective
advantage for the first, reference vehicle. With multiple competitors, one recognized reference win
is enough to keep the row because this is the historical `hasReferenceAdvantage` contract. A win that
belongs exclusively to a competitor is omitted. Empty filtered categories are omitted; a completely
empty result uses a small inline state.
The active segment uses selection blue `#9ABCC8` with graphite text. It never uses orange.

The table is a dense, flat light surface with discrete dividers. Its semantic header and first spec
column remain sticky inside the same locally scrollable region, including horizontal mobile scroll.
Vehicle identity follows **Brand Model · Version · production/model**. Complete preserves the existing
objective markers. In Advantages only the reference cell receives the small accessible check in
attention orange `#EF7732`; competitor cells, rows and surfaces remain neutral. Differences
intentionally displays no advantage marker.

Comparison controls use the shared compact density: approximately 30px on desktop and 44px under a
coarse pointer. The segmented control follows the same rule through `comparison-mode-option`; PDF,
share and back actions use the compact secondary primitive. The toolbar uses 8px horizontal padding,
increasing to 12px from `sm`, so controls retain breathing room without adding a card-like surface.

Numeric presentation is centralized in `comparison-number-formatter.ts` and selected by stable spec
code. `PW_0005` displacement (source unit `cc`) and `PW_0015` rotation max torque use grouped integers;
`CO_0017` cluster size and `CO_0019` display size always use two decimals; consumption `OW_0002` through
`OW_0005` always uses one decimal. Existing one-decimal rules are explicit for torque `PW_0012`,
`PW_0023`, `PW_0026`, `PW_0033` and weight ratios `PW_0035`, `PW_0036`. Formatting uses pt-BR and the
standard `Intl.NumberFormat` rounding; units remain separate inputs and no displacement conversion is
performed. The PDF visual is deliberately unchanged in this sprint. Its legacy highlights mode still
means reference-vehicle advantages, while the shared mapper/formatter keeps numeric output reusable.
