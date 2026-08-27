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

## Sticky stack and specs density

Desktop administrative pages use one deterministic stack: application topbar, optional sticky page
header, optional toolbar, then sticky table header. Shared height tokens and the
`admin-catalog-sticky`, `admin-catalog-table-header`, `admin-page-header` and `admin-specs-toolbar`
classes own the offsets; page components do not repeat calculated pixel positions. Sticky surfaces are
opaque and separated with light borders. Primary actions use graphite `#1A1D21`; blue remains
informational/selection and orange remains attention-only.

The specs editor targets approximately 44–48px for ordinary desktop rows. Category summaries are 40px,
labels and codes use compact line heights, controls align in an 18rem right column, and tri-state
buttons use a 30px visual treatment on fine pointers while the shared coarse-pointer rule restores a
44px hit height. Its search/progress/save toolbar remains sticky below the page header.
