# Seller Comparison — PT-BR Presentation Layer

Status: IMPLEMENTED ON BRANCH `seller-pt-comparison`

Date: 2026-09-27

## Contract

The canonical spec catalog remains language-neutral/English while Seller presentation consumes the
localized fields stored in `public.specs`.

- category: `group_name_pt`
- secondary grouping: `equipment_group_pt`
- semantic set: `spec_set_pt`
- Seller row label: `display_pt`
- scale cell option: `detail_pt`
- row/category order: `display_order`

English canonical fields remain deterministic fallbacks during rollout.

## Type presentation

- numeric: one row, label = `display_pt`, value = numeric value + unit;
- binary: one row, label = `display_pt`, value = presence dot / dash;
- scale: all alternatives sharing category + equipment group + spec set + display label collapse into
  one row; the selected alternative renders its `detail_pt`; missing data renders an em dash.

Scale remains non-ranked by the comparison advantage engine in this change. Relative-value scoring is
owned by the score domain and is not duplicated in presentation.

## Ordering

Rows sort by `display_order`; categories sort by the first visible row order. Null orders are
deliberately last. Scale alternatives must share the same display order.

## Boundaries

The mapping remains in `adapter-supabase`; React components and PDF rendering receive only the
normalized comparison presentation contract and do not know physical Supabase column names.
