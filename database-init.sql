-- Supabase/PostgreSQL Initialization Schema for FreightX
-- Save this file as database-init.sql

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address text UNIQUE NOT NULL,
    wallet_type text NOT NULL, -- 'sandbox', 'web3', 'circle'
    created_at timestamptz DEFAULT now()
);

-- 2. Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
    id int PRIMARY KEY,
    buyer text NOT NULL,
    supplier text NOT NULL,
    carrier text NOT NULL,
    cargo_value numeric NOT NULL,
    shipping_fee numeric NOT NULL,
    released_supplier_amount numeric DEFAULT 0,
    released_carrier_amount numeric DEFAULT 0,
    departure_port text NOT NULL,
    destination_port text NOT NULL,
    status text NOT NULL DEFAULT 'Created',
    arrived_timestamp bigint DEFAULT 0,
    custom_clearance_timestamp bigint DEFAULT 0,
    pickup_timestamp bigint DEFAULT 0,
    free_time_hours bigint DEFAULT 0,
    demurrage_rate_per_hour numeric DEFAULT 0,
    demurrage_penalty_paid numeric DEFAULT 0,
    passport_token_id int DEFAULT 0,
    temperature numeric DEFAULT 0,
    location text DEFAULT 'Warehouse',
    history jsonb DEFAULT '[]'::jsonb,
    on_chain boolean DEFAULT false,
    tx_hash text,
    created_timestamp bigint DEFAULT 0,
    yield_earned numeric DEFAULT 0,
    temperature_violations int DEFAULT 0,
    temperature_penalty numeric DEFAULT 0,
    beneficiary text,
    factoring_price numeric DEFAULT 0,
    factoring_active boolean DEFAULT false,
    token text,
    po_id int,
    has_po_loan boolean DEFAULT false,
    iot_gateway text,
    humidity numeric DEFAULT 0,
    usyc_wrapped boolean DEFAULT false,
    usyc_shares numeric DEFAULT 0,
    cctp_source_domain int,
    cctp_source_tx_hash text,
    created_at timestamptz DEFAULT now()
);

-- 3. Purchase Order (PO) Loans Table
CREATE TABLE IF NOT EXISTS po_loans (
    id int PRIMARY KEY,
    supplier text NOT NULL,
    buyer text NOT NULL,
    cargo_value numeric NOT NULL,
    loan_requested numeric NOT NULL,
    repayment_amount numeric NOT NULL,
    investor text,
    funded boolean DEFAULT false,
    repaid boolean DEFAULT false,
    token text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 4. IoT Cold-Chain Readings Table
CREATE TABLE IF NOT EXISTS iot_readings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id int NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    temperature numeric NOT NULL,
    humidity numeric NOT NULL,
    timestamp timestamptz DEFAULT now(),
    tx_hash text
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_address text NOT NULL,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 6. IoT Devices Table
CREATE TABLE IF NOT EXISTS iot_devices (
    device_id text PRIMARY KEY,
    public_key text NOT NULL,
    shipment_id int NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    registered_at timestamptz DEFAULT now()
);

-- 7. Gateway Balances Table
CREATE TABLE IF NOT EXISTS gateway_balances (
    wallet_address text PRIMARY KEY,
    balance numeric NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- 8. Gateway Payments Table
CREATE TABLE IF NOT EXISTS gateway_payments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_address text NOT NULL,
    seller_address text NOT NULL,
    amount numeric NOT NULL,
    endpoint text NOT NULL,
    shipment_id int,
    tx_hash text,
    created_at timestamptz DEFAULT now()
);

-- =========================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_shipments_buyer ON shipments(buyer);
CREATE INDEX IF NOT EXISTS idx_shipments_supplier ON shipments(supplier);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier ON shipments(carrier);
CREATE INDEX IF NOT EXISTS idx_po_loans_supplier ON po_loans(supplier);
CREATE INDEX IF NOT EXISTS idx_po_loans_buyer ON po_loans(buyer);
CREATE INDEX IF NOT EXISTS idx_iot_readings_shipment_id ON iot_readings(shipment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_address ON audit_logs(user_address);
CREATE INDEX IF NOT EXISTS idx_iot_devices_shipment_id ON iot_devices(shipment_id);
CREATE INDEX IF NOT EXISTS idx_gateway_payments_buyer ON gateway_payments(buyer_address);
CREATE INDEX IF NOT EXISTS idx_gateway_payments_shipment ON gateway_payments(shipment_id);

-- =========================================================================
-- TRIGGERS & FUNCTIONS FOR AUTOMATIC TIMESTAMP UPDATES
-- =========================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_gateway_balances_updated_at ON gateway_balances;
CREATE TRIGGER update_gateway_balances_updated_at
    BEFORE UPDATE ON gateway_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
-- =========================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_payments ENABLE ROW LEVEL SECURITY;

-- Enable Permissive Access Policies for Sandbox Development
CREATE POLICY "Allow public select on users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert on users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on users" ON users FOR UPDATE USING (true);

CREATE POLICY "Allow public select on shipments" ON shipments FOR SELECT USING (true);
CREATE POLICY "Allow public insert on shipments" ON shipments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on shipments" ON shipments FOR UPDATE USING (true);

CREATE POLICY "Allow public select on po_loans" ON po_loans FOR SELECT USING (true);
CREATE POLICY "Allow public insert on po_loans" ON po_loans FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on po_loans" ON po_loans FOR UPDATE USING (true);

CREATE POLICY "Allow public select on iot_readings" ON iot_readings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on iot_readings" ON iot_readings FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select on audit_logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on audit_logs" ON audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select on iot_devices" ON iot_devices FOR SELECT USING (true);
CREATE POLICY "Allow public insert on iot_devices" ON iot_devices FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select on gateway_balances" ON gateway_balances FOR SELECT USING (true);
CREATE POLICY "Allow public insert on gateway_balances" ON gateway_balances FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on gateway_balances" ON gateway_balances FOR UPDATE USING (true);

CREATE POLICY "Allow public select on gateway_payments" ON gateway_payments FOR SELECT USING (true);
CREATE POLICY "Allow public insert on gateway_payments" ON gateway_payments FOR INSERT WITH CHECK (true);
