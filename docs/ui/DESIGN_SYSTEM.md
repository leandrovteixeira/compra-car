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
