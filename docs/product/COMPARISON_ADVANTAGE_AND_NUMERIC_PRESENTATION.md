# Comparison Advantage and Numeric Presentation

Date: 2026-09-27

## Advantage semantics

Checks represent the globally best known value across the compared vehicles.

- numeric: `value_direction=Positive` chooses the maximum; `Negative` chooses the minimum;
- binary: true ranks above false;
- scale: the selected alternative is ranked by its catalog `relative_value`, never by text or any
  number visible in `detail_pt`;
- multiple vehicles receive a check only when they tie at the best value;
- if all values are equal, no vehicle has an advantage;
- if any vehicle is unknown/missing, the row does not claim an objective winner.

The `Vantagens` mode remains scoped to rows where the reference vehicle is a global winner.

## Numeric display metadata

Canonical measurement values stay in their source unit. Presentation can override with:

- `display_unit_pt`
- `display_multiplier`
- `display_decimals`

This supports localized units and display-only conversions without corrupting canonical values.
Torque stays in Nm and displays in kgfm.

PW_0005 is the exception: the database audit found all 290 persisted displacement values between
1.0 and 2.4, while the spec metadata said cc. The values are liters, so the canonical unit and
`product_specs.input_unit` were corrected to L without changing the numeric values.

Current presentation corrections include:

- OW_0001 energy efficiency: 2 decimals;
- inch → pol;
- years → anos;
- PW_0012/PW_0023/PW_0026/PW_0033: Nm canonical → kgfm display, 1 decimal;
- PW_0005 displacement: liters, 1 decimal.
