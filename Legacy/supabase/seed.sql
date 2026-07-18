-- Seed minimo para testar o prototipo
INSERT INTO products (brand, model, version, renavam_reference, model_year, production_year)
VALUES ('Toyota', 'Corolla', 'XEi 2.0 CVT', 'RENAVAM_COROLLA_XEI_2026', 2026, 2025)
ON CONFLICT DO NOTHING;

INSERT INTO equipments (group_name, name, selection_rule)
VALUES
    ('Powertrain', 'Combustion Engine', 'multi'),
    ('Powertrain', 'Transmission', 'single'),
    ('Safety', 'Airbags', 'multi')
ON CONFLICT DO NOTHING;

INSERT INTO specs (equipment_id, detail, type, unit, unit_perceived_value)
SELECT e.id, 'Displacement', 'numeric', 'L', 4000 FROM equipments e WHERE e.name = 'Combustion Engine'
ON CONFLICT DO NOTHING;
INSERT INTO specs (equipment_id, detail, type, unit, unit_perceived_value)
SELECT e.id, 'Turbocharger', 'binary', NULL, 8000 FROM equipments e WHERE e.name = 'Combustion Engine'
ON CONFLICT DO NOTHING;
INSERT INTO specs (equipment_id, detail, type, unit, unit_perceived_value)
SELECT e.id, 'Max power', 'numeric', 'cv', 50 FROM equipments e WHERE e.name = 'Combustion Engine'
ON CONFLICT DO NOTHING;
INSERT INTO specs (equipment_id, detail, type, unit, unit_perceived_value)
SELECT e.id, 'CVT', 'binary', NULL, 5000 FROM equipments e WHERE e.name = 'Transmission'
ON CONFLICT DO NOTHING;
INSERT INTO specs (equipment_id, detail, type, unit, unit_perceived_value)
SELECT e.id, 'AT', 'binary', NULL, 3000 FROM equipments e WHERE e.name = 'Transmission'
ON CONFLICT DO NOTHING;
INSERT INTO specs (equipment_id, detail, type, unit, unit_perceived_value)
SELECT e.id, '6 airbags', 'binary', NULL, 6000 FROM equipments e WHERE e.name = 'Airbags'
ON CONFLICT DO NOTHING;

INSERT INTO product_specs (product_id, spec_id, value)
SELECT p.id, s.id,
    CASE s.detail
        WHEN 'Displacement' THEN 2.0
        WHEN 'Turbocharger' THEN 0
        WHEN 'Max power' THEN 177
        WHEN 'CVT' THEN 1
        WHEN 'AT' THEN 0
        WHEN '6 airbags' THEN 1
    END
FROM products p
CROSS JOIN specs s
WHERE p.brand = 'Toyota' AND p.model = 'Corolla'
  AND s.detail IN ('Displacement', 'Turbocharger', 'Max power', 'CVT', 'AT', '6 airbags')
ON CONFLICT DO NOTHING;

INSERT INTO product_price_offers (
    product_id, reference_month, public_price,
    trade_in_bonus, subsidized_rate, down_payment_percent, installments,
    insurance_bonus, finance_rate_cost, total_offer_value, offer_name
)
SELECT id, '2026-04-01', 249000,
       20000, 0, 60, 24,
       0, 0, 20000, 'Trade-in + Taxa 0%'
FROM products WHERE brand='Toyota' AND model='Corolla'
ON CONFLICT DO NOTHING;

INSERT INTO product_price_offers (
    product_id, reference_month, public_price,
    trade_in_bonus, insurance_bonus, total_offer_value, offer_name
)
SELECT id, '2026-04-01', 249000,
       20000, 12000, 32000, 'Trade-in + Seguro grátis'
FROM products WHERE brand='Toyota' AND model='Corolla'
ON CONFLICT DO NOTHING;

INSERT INTO registrations (
    source_model_id, renavam_reference, product_id, renavam_code,
    registration_date, city, state, volume, sale_type
)
SELECT 'SRC001', renavam_reference, id, 'REN123456', '2026-04-01', 'São Paulo', 'SP', 12, 'retail'
FROM products WHERE brand='Toyota' AND model='Corolla'
ON CONFLICT DO NOTHING;

INSERT INTO accounts (account_type, name, legal_name, email)
VALUES ('internal', 'Admin App Compra Car', 'Admin App Compra Car', 'admin@app.local')
ON CONFLICT DO NOTHING;

INSERT INTO users (name, email, user_type)
VALUES ('Admin Local', 'admin@app.local', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO plans (name, account_type, billing_cycle, price, max_users, features_json)
VALUES
    ('Vendedor Individual', 'individual', 'monthly', 99.00, 1, '{"comparisons": true, "registrations": false}'::jsonb),
    ('Loja - 5 usuários', 'store', 'monthly', 399.00, 5, '{"comparisons": true, "registrations": true}'::jsonb)
ON CONFLICT DO NOTHING;
