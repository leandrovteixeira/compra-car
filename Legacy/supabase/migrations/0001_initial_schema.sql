-- App Compra Car - prototipo local
-- Banco: PostgreSQL / Supabase

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(150) NOT NULL,
    version VARCHAR(150) NOT NULL,
    renavam_reference VARCHAR(100),
    model_year SMALLINT NOT NULL,
    production_year SMALLINT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_products_unique
        UNIQUE (brand, model, version, model_year, production_year),
    CONSTRAINT chk_products_years
        CHECK (model_year >= production_year)
);

CREATE TABLE IF NOT EXISTS equipments (
    id BIGSERIAL PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    selection_rule VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_equipments_unique
        UNIQUE (group_name, name),
    CONSTRAINT chk_equipments_selection_rule
        CHECK (selection_rule IN ('single', 'multi'))
);

CREATE TABLE IF NOT EXISTS specs (
    id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT NOT NULL REFERENCES equipments(id),
    detail VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL,
    unit VARCHAR(50),
    unit_perceived_value NUMERIC(14,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_specs_unique
        UNIQUE (equipment_id, detail),
    CONSTRAINT chk_specs_type
        CHECK (type IN ('binary', 'numeric'))
);

CREATE TABLE IF NOT EXISTS product_specs (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    spec_id BIGINT NOT NULL REFERENCES specs(id),
    value NUMERIC(14,4) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_product_specs_unique
        UNIQUE (product_id, spec_id)
);

CREATE TABLE IF NOT EXISTS product_price_offers (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    reference_month DATE NOT NULL,

    public_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    retail_bonus NUMERIC(14,2) NOT NULL DEFAULT 0,
    retail_rebate NUMERIC(14,2) NOT NULL DEFAULT 0,
    trade_in_bonus NUMERIC(14,2) NOT NULL DEFAULT 0,
    trade_in_rebate NUMERIC(14,2) NOT NULL DEFAULT 0,

    subsidized_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
    down_payment_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
    installments SMALLINT NOT NULL DEFAULT 0,
    finance_rate_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
    finance_rebate NUMERIC(14,2) NOT NULL DEFAULT 0,

    insurance_bonus NUMERIC(14,2) NOT NULL DEFAULT 0,
    insurance_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
    ipva_bonus NUMERIC(14,2) NOT NULL DEFAULT 0,
    wallbox_bonus NUMERIC(14,2) NOT NULL DEFAULT 0,
    other_bonus NUMERIC(14,2) NOT NULL DEFAULT 0,

    total_offer_value NUMERIC(14,2) NOT NULL DEFAULT 0,
    offer_name VARCHAR(200),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_product_price_offer
        UNIQUE (product_id, reference_month, offer_name)
);

CREATE TABLE IF NOT EXISTS registrations (
    id BIGSERIAL PRIMARY KEY,
    source_model_id VARCHAR(100),
    renavam_reference VARCHAR(100),
    product_id BIGINT REFERENCES products(id),
    renavam_code VARCHAR(100) NOT NULL,
    registration_date DATE NOT NULL,
    city VARCHAR(150),
    state VARCHAR(50),
    volume INTEGER NOT NULL DEFAULT 1,
    sale_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_registrations_volume CHECK (volume >= 0),
    CONSTRAINT chk_registrations_sale_type CHECK (sale_type IN ('retail', 'direct')),
    CONSTRAINT uq_registrations_grain UNIQUE (renavam_code, registration_date, city, state, sale_type)
);

-- Gestao/acesso - versao enxuta para prototipo
CREATE TABLE IF NOT EXISTS accounts (
    id BIGSERIAL PRIMARY KEY,
    account_type VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    legal_name VARCHAR(200),
    document_number VARCHAR(30),
    email VARCHAR(200),
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_accounts_type CHECK (account_type IN ('store', 'individual', 'internal'))
);

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    phone VARCHAR(50),
    user_type VARCHAR(30) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_type CHECK (user_type IN ('admin', 'store_user', 'seller'))
);

CREATE TABLE IF NOT EXISTS account_users (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    role_in_account VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_account_users UNIQUE (account_id, user_id)
);

CREATE TABLE IF NOT EXISTS plans (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL,
    price NUMERIC(14,2) NOT NULL DEFAULT 0,
    max_users INTEGER,
    features_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_plans_account_type CHECK (account_type IN ('store', 'individual')),
    CONSTRAINT chk_plans_billing_cycle CHECK (billing_cycle IN ('monthly', 'yearly'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id),
    plan_id BIGINT NOT NULL REFERENCES plans(id),
    status VARCHAR(30) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    renewal_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_subscriptions_status CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired'))
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT REFERENCES subscriptions(id),
    account_id BIGINT NOT NULL REFERENCES accounts(id),
    amount NUMERIC(14,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    payment_method VARCHAR(50),
    status VARCHAR(30) NOT NULL,
    paid_at TIMESTAMP,
    due_at TIMESTAMP,
    external_payment_id VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_payments_status CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'canceled'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    account_id BIGINT REFERENCES accounts(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices uteis
CREATE INDEX IF NOT EXISTS idx_product_specs_product_id ON product_specs(product_id);
CREATE INDEX IF NOT EXISTS idx_product_specs_spec_id ON product_specs(spec_id);
CREATE INDEX IF NOT EXISTS idx_price_offers_product_month ON product_price_offers(product_id, reference_month);
CREATE INDEX IF NOT EXISTS idx_registrations_product_id ON registrations(product_id);
CREATE INDEX IF NOT EXISTS idx_registrations_renavam_code ON registrations(renavam_code);
CREATE INDEX IF NOT EXISTS idx_registrations_date ON registrations(registration_date);
CREATE INDEX IF NOT EXISTS idx_registrations_state_city ON registrations(state, city);
CREATE INDEX IF NOT EXISTS idx_registrations_sale_type ON registrations(sale_type);

-- Views para validacao no prototipo
CREATE OR REPLACE VIEW v_product_spec_values AS
SELECT
    p.id AS product_id,
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year,
    e.group_name,
    e.name AS equipment,
    e.selection_rule,
    s.detail,
    s.type,
    s.unit,
    ps.value,
    s.unit_perceived_value,
    (ps.value * s.unit_perceived_value) AS perceived_value_total
FROM product_specs ps
JOIN products p ON p.id = ps.product_id
JOIN specs s ON s.id = ps.spec_id
JOIN equipments e ON e.id = s.equipment_id;

CREATE OR REPLACE VIEW v_product_total_perceived_value AS
SELECT
    product_id,
    brand,
    model,
    version,
    model_year,
    production_year,
    SUM(perceived_value_total) AS total_perceived_value
FROM v_product_spec_values
GROUP BY product_id, brand, model, version, model_year, production_year;

CREATE OR REPLACE VIEW v_price_offer_values AS
SELECT
    id,
    product_id,
    reference_month,
    offer_name,
    public_price,
    retail_bonus,
    retail_rebate,
    trade_in_bonus,
    trade_in_rebate,
    subsidized_rate,
    down_payment_percent,
    installments,
    finance_rate_cost,
    finance_rebate,
    insurance_bonus,
    insurance_cost,
    ipva_bonus,
    wallbox_bonus,
    other_bonus,
    (
        retail_bonus + retail_rebate + trade_in_bonus + trade_in_rebate
        + finance_rebate + insurance_bonus + ipva_bonus + wallbox_bonus + other_bonus
        - finance_rate_cost - insurance_cost
    ) AS calculated_total_offer_value,
    total_offer_value AS stored_total_offer_value,
    public_price - (
        retail_bonus + retail_rebate + trade_in_bonus + trade_in_rebate
        + finance_rebate + insurance_bonus + ipva_bonus + wallbox_bonus + other_bonus
        - finance_rate_cost - insurance_cost
    ) AS effective_price_after_benefits
FROM product_price_offers;

CREATE OR REPLACE VIEW v_registration_summary AS
SELECT
    p.brand,
    p.model,
    p.version,
    p.model_year,
    p.production_year,
    r.registration_date,
    r.state,
    r.city,
    r.sale_type,
    SUM(r.volume) AS total_registrations
FROM registrations r
LEFT JOIN products p ON p.id = r.product_id
GROUP BY p.brand, p.model, p.version, p.model_year, p.production_year, r.registration_date, r.state, r.city, r.sale_type;
