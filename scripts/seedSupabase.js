const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRole) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

const buyer = '0x9b1C51CEF8BC8757Ad757845eF80a390A3b9D194';
const supplier = '0x8D92F677cd6303cEc089B5F319D72Aa797Da5300';
const carrier = '0x1C902e11A58c4BB489B3ab1c51CEf8BC8757845E';
const usdcToken = '0x3600000000000000000000000000000000000000';
const eurcToken = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a';

const SEEDED_SHIPMENTS = [
  {
    id: 101,
    buyer,
    supplier,
    carrier,
    cargo_value: 12000,
    shipping_fee: 1500,
    released_supplier_amount: 3600,
    released_carrier_amount: 0,
    departure_port: 'Shenzhen Port (CN)',
    destination_port: 'Los Angeles Port (US)',
    status: 'In Transit',
    arrived_timestamp: 0,
    custom_clearance_timestamp: 0,
    pickup_timestamp: 0,
    free_time_hours: 48,
    demurrage_rate_per_hour: 25,
    demurrage_penalty_paid: 0,
    passport_token_id: 88,
    temperature: -18.2,
    location: 'Singapore Transshipment Hub',
    history: JSON.stringify([
      { timestamp: Date.now() - 3 * 24 * 3600 * 1000, status: 'Created', location: 'Shenzhen Port (CN)', temperature: 22 },
      { timestamp: Date.now() - 2 * 24 * 3600 * 1000, status: 'Departure Milestone', location: 'South China Sea', temperature: -15.4 },
      { timestamp: Date.now() - 1 * 24 * 3600 * 1000, status: 'Singapore Checkpoint Passed (30% Payout)', location: 'Singapore Port', temperature: -18.2 }
    ]),
    on_chain: false,
    token: usdcToken
  },
  {
    id: 102,
    buyer,
    supplier,
    carrier,
    cargo_value: 8500,
    shipping_fee: 950,
    released_supplier_amount: 0,
    released_carrier_amount: 0,
    departure_port: 'Singapore Keppel Terminal',
    destination_port: 'Rotterdam Port (NL)',
    status: 'Created',
    arrived_timestamp: 0,
    custom_clearance_timestamp: 0,
    pickup_timestamp: 0,
    free_time_hours: 72,
    demurrage_rate_per_hour: 15,
    demurrage_penalty_paid: 0,
    passport_token_id: 89,
    temperature: 4.5,
    location: 'Singapore Keppel Terminal',
    history: JSON.stringify([
      { timestamp: Date.now() - 12 * 3600 * 1000, status: 'Created', location: 'Singapore Keppel Terminal', temperature: 4.5 }
    ]),
    on_chain: false,
    token: eurcToken
  },
  {
    id: 103,
    buyer,
    supplier,
    carrier,
    cargo_value: 18500,
    shipping_fee: 2200,
    released_supplier_amount: 0,
    released_carrier_amount: 0,
    departure_port: 'Rotterdam Port (NL)',
    destination_port: 'Singapore Keppel Terminal',
    status: 'Created',
    arrived_timestamp: 0,
    custom_clearance_timestamp: 0,
    pickup_timestamp: 0,
    free_time_hours: 48,
    demurrage_rate_per_hour: 20,
    demurrage_penalty_paid: 0,
    passport_token_id: 90,
    temperature: 12.4,
    location: 'Rotterdam Port (NL)',
    history: JSON.stringify([
      { timestamp: Date.now() - 6 * 3600 * 1000, status: 'Created', location: 'Rotterdam Port (NL)', temperature: 12.4 }
    ]),
    on_chain: false,
    token: usdcToken
  },
  {
    id: 104,
    buyer,
    supplier,
    carrier,
    cargo_value: 32000,
    shipping_fee: 4500,
    released_supplier_amount: 32000,
    released_carrier_amount: 4500,
    departure_port: 'Port of Tokyo (JP)',
    destination_port: 'Shenzhen Port (CN)',
    status: 'Delivered',
    arrived_timestamp: Date.now() - 3600 * 1000,
    custom_clearance_timestamp: Date.now() - 2 * 3600 * 1000,
    pickup_timestamp: Date.now() - 30 * 60 * 1000,
    free_time_hours: 48,
    demurrage_rate_per_hour: 30,
    demurrage_penalty_paid: 0,
    passport_token_id: 91,
    temperature: -20.5,
    location: 'Shenzhen Port (CN)',
    history: JSON.stringify([
      { timestamp: Date.now() - 4 * 24 * 3600 * 1000, status: 'Created', location: 'Port of Tokyo (JP)', temperature: 15 },
      { timestamp: Date.now() - 3 * 24 * 3600 * 1000, status: 'In Transit', location: 'East China Sea', temperature: -18.5 },
      { timestamp: Date.now() - 2 * 24 * 3600 * 1000, status: 'Arrived at Destination', location: 'Shenzhen Port (CN)', temperature: -20.0 },
      { timestamp: Date.now() - 1 * 24 * 3600 * 1000, status: 'Customs Cleared', location: 'Shenzhen Port (CN)', temperature: -20.5 },
      { timestamp: Date.now() - 12 * 3600 * 1000, status: 'Cargo Disbursed & Delivered', location: 'Shenzhen Port (CN)', temperature: -20.5 }
    ]),
    on_chain: false,
    token: usdcToken
  },
  {
    id: 105,
    buyer,
    supplier,
    carrier,
    cargo_value: 15400,
    shipping_fee: 1800,
    released_supplier_amount: 4620, // 30% payout
    released_carrier_amount: 0,
    departure_port: 'Port of Hamburg (DE)',
    destination_port: 'Singapore Keppel Terminal',
    status: 'Customs Check',
    arrived_timestamp: Date.now() - 4 * 3600 * 1000,
    custom_clearance_timestamp: 0,
    pickup_timestamp: 0,
    free_time_hours: 48,
    demurrage_rate_per_hour: 22,
    demurrage_penalty_paid: 0,
    passport_token_id: 92,
    temperature: 2.2,
    location: 'Singapore Keppel Terminal',
    history: JSON.stringify([
      { timestamp: Date.now() - 5 * 24 * 3600 * 1000, status: 'Created', location: 'Port of Hamburg (DE)', temperature: 14.2 },
      { timestamp: Date.now() - 3 * 24 * 3600 * 1000, status: 'In Transit', location: 'English Channel', temperature: 3.5 },
      { timestamp: Date.now() - 1 * 24 * 3600 * 1000, status: 'Arrived at Destination', location: 'Singapore Keppel Terminal', temperature: 2.2 }
    ]),
    on_chain: false,
    token: eurcToken
  },
  {
    id: 106,
    buyer,
    supplier,
    carrier,
    cargo_value: 24000,
    shipping_fee: 2800,
    released_supplier_amount: 0,
    released_carrier_amount: 0,
    departure_port: 'Port of Shanghai (CN)',
    destination_port: 'Los Angeles Port (US)',
    status: 'In Transit',
    arrived_timestamp: 0,
    custom_clearance_timestamp: 0,
    pickup_timestamp: 0,
    free_time_hours: 72,
    demurrage_rate_per_hour: 25,
    demurrage_penalty_paid: 0,
    passport_token_id: 93,
    temperature: -12.1,
    location: 'Pacific Ocean Transit',
    history: JSON.stringify([
      { timestamp: Date.now() - 2 * 24 * 3600 * 1000, status: 'Created', location: 'Port of Shanghai (CN)', temperature: 18.0 },
      { timestamp: Date.now() - 1 * 24 * 3600 * 1000, status: 'In Transit', location: 'East of Japan', temperature: -12.1 }
    ]),
    on_chain: false,
    token: usdcToken
  },
  {
    id: 107,
    buyer,
    supplier,
    carrier,
    cargo_value: 1.0,
    shipping_fee: 0.1,
    released_supplier_amount: 0,
    released_carrier_amount: 0,
    departure_port: 'Shenzhen Port (CN)',
    destination_port: 'Los Angeles Port (US)',
    status: 'Created',
    arrived_timestamp: 0,
    custom_clearance_timestamp: 0,
    pickup_timestamp: 0,
    free_time_hours: 48,
    demurrage_rate_per_hour: 1,
    demurrage_penalty_paid: 0,
    passport_token_id: 94,
    temperature: 15.0,
    location: 'Shenzhen Port Warehouse',
    history: JSON.stringify([
      { timestamp: Date.now() - 1000 * 60 * 10, status: 'Created', location: 'Shenzhen Port (CN)', temperature: 15 }
    ]),
    on_chain: false,
    token: usdcToken
  },
  {
    id: 108,
    buyer,
    supplier,
    carrier,
    cargo_value: 2.0,
    shipping_fee: 0.2,
    released_supplier_amount: 0,
    released_carrier_amount: 0,
    departure_port: 'Singapore Keppel Terminal',
    destination_port: 'Rotterdam Port (NL)',
    status: 'Created',
    arrived_timestamp: 0,
    custom_clearance_timestamp: 0,
    pickup_timestamp: 0,
    free_time_hours: 72,
    demurrage_rate_per_hour: 1,
    demurrage_penalty_paid: 0,
    passport_token_id: 95,
    temperature: 4.5,
    location: 'Singapore Keppel Terminal',
    history: JSON.stringify([
      { timestamp: Date.now() - 1000 * 60 * 5, status: 'Created', location: 'Singapore Keppel Terminal', temperature: 4.5 }
    ]),
    on_chain: false,
    token: eurcToken
  },
  {
    id: 109,
    buyer,
    supplier,
    carrier,
    cargo_value: 5.0,
    shipping_fee: 0.5,
    released_supplier_amount: 0,
    released_carrier_amount: 0,
    departure_port: 'Port of Tokyo (JP)',
    destination_port: 'Shenzhen Port (CN)',
    status: 'Created',
    arrived_timestamp: 0,
    custom_clearance_timestamp: 0,
    pickup_timestamp: 0,
    free_time_hours: 48,
    demurrage_rate_per_hour: 2,
    demurrage_penalty_paid: 0,
    passport_token_id: 96,
    temperature: -18.0,
    location: 'Port of Tokyo (JP)',
    history: JSON.stringify([
      { timestamp: Date.now() - 1000 * 60 * 2, status: 'Created', location: 'Port of Tokyo (JP)', temperature: -18.0 }
    ]),
    on_chain: false,
    token: usdcToken
  }
];

const SEEDED_LOANS = [
  {
    id: 1,
    supplier,
    buyer,
    cargo_value: 12000,
    loan_requested: 8000,
    repayment_amount: 8400,
    investor: carrier,
    funded: true,
    repaid: false,
    token: usdcToken
  },
  {
    id: 2,
    supplier,
    buyer,
    cargo_value: 18500,
    loan_requested: 12000,
    repayment_amount: 12600,
    investor: carrier,
    funded: true,
    repaid: true,
    token: usdcToken
  },
  {
    id: 3,
    supplier,
    buyer,
    cargo_value: 15400,
    loan_requested: 10000,
    repayment_amount: 10450,
    investor: '0x0000000000000000000000000000000000000000',
    funded: false,
    repaid: false,
    token: eurcToken
  }
];

async function seed() {
  console.log("Starting Supabase DB seeding for FreightX...");
  
  // Upsert shipments
  for (const shipment of SEEDED_SHIPMENTS) {
    const { error } = await supabase.from('shipments').upsert(shipment);
    if (error) {
      console.error(`Error seeding shipment ${shipment.id}:`, error.message);
    } else {
      console.log(`Seeded shipment ${shipment.id} successfully.`);
    }
  }

  // Upsert po_loans
  for (const loan of SEEDED_LOANS) {
    const { error } = await supabase.from('po_loans').upsert(loan);
    if (error) {
      console.error(`Error seeding loan ${loan.id}:`, error.message);
    } else {
      console.log(`Seeded PO loan ${loan.id} successfully.`);
    }
  }

  console.log("Supabase DB seeding complete!");
}

seed();
