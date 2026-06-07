import { createClient } from '@supabase/supabase-js';

// Environment variables check
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const isRealSupabaseConfigured =
  supabaseUrl &&
  supabaseUrl !== 'https://your-supabase-url.supabase.co' &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'your-supabase-anon-key';

// In-memory store for fallback/mock database when Supabase is not configured
interface MockStore {
  users: Record<string, unknown>[];
  shipments: Record<string, unknown>[];
  po_loans: Record<string, unknown>[];
  iot_readings: Record<string, unknown>[];
  audit_logs: Record<string, unknown>[];
  iot_devices: Record<string, unknown>[];
}

const mockStore: MockStore = {
  users: [],
  shipments: [
    {
      id: 101,
      buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
      supplier: '0x8d92F677cD6303Cec089B5F319D72aA797da53',
      carrier: '0x1c902E11a58c4bb489b3ab1c51cef8bc8757845e',
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
        { timestamp: Date.now() - 3 * 24 * 3600 * 1000, status: 'Created', location: 'Shenzhen Port (CN)', temperature: 22.0 },
        { timestamp: Date.now() - 2 * 24 * 3600 * 1000, status: 'Departure Milestone', location: 'South China Sea', temperature: -15.4 },
        { timestamp: Date.now() - 1 * 24 * 3600 * 1000, status: 'Singapore Checkpoint Passed (30% Payout)', location: 'Singapore Port', temperature: -18.2 }
      ]),
      token: '0x3600000000000000000000000000000000000000'
    },
    {
      id: 102,
      buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
      supplier: '0x8d92F677cD6303Cec089B5F319D72aA797da53',
      carrier: '0x1c902E11a58c4bb489b3ab1c51cef8bc8757845e',
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
      token: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'
    }
  ],
  po_loans: [
    {
      id: 1,
      supplier: '0x8d92F677cD6303Cec089B5F319D72aA797da53',
      buyer: '0x9b1C51cEF8bc8757ad757845ef80A390a3b9d194',
      cargo_value: 1000,
      loan_requested: 800,
      repayment_amount: 840,
      investor: '0x1c902E11a58c4bb489b3ab1c51cef8bc8757845e',
      funded: true,
      repaid: false,
      token: '0x3600000000000000000000000000000000000000'
    }
  ],
  iot_readings: [],
  audit_logs: [],
  iot_devices: []
};

// Custom query builder mock
class MockSupabaseQueryBuilder {
  private table: keyof MockStore;
  private filters: Array<(item: Record<string, unknown>) => boolean> = [];
  private limitCount: number | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;

  constructor(table: keyof MockStore) {
    this.table = table;
  }

  select(_columns?: string) {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((item) => {
      if (item[column] === undefined) return false;
      return String(item[column]).toLowerCase() === String(value).toLowerCase();
    });
    return this;
  }

  order(column: string, { ascending = true } = {}) {
    this.orderCol = column;
    this.orderAsc = ascending;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async single() {
    const list = this.evaluate();
    if (list.length === 0) {
      return { data: null, error: { message: 'Not found' } };
    }
    return { data: list[0], error: null };
  }

  async insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    const arr = Array.isArray(values) ? values : [values];
    const inserted: Record<string, unknown>[] = [];
    for (const val of arr) {
      const copy = { ...val };
      if (copy.id === undefined && this.table !== 'shipments' && this.table !== 'po_loans') {
        copy.id = crypto.randomUUID();
      }
      mockStore[this.table].push(copy);
      inserted.push(copy);
    }
    return { data: Array.isArray(values) ? inserted : inserted[0], error: null };
  }

  async update(values: Record<string, unknown>) {
    const list = this.evaluate();
    for (const item of list) {
      Object.assign(item, values);
    }
    return { data: list, error: null };
  }

  async upsert(values: Record<string, unknown> | Record<string, unknown>[]) {
    const arr = Array.isArray(values) ? values : [values];
    const upserted: Record<string, unknown>[] = [];
    for (const val of arr) {
      const idx = mockStore[this.table].findIndex((item) => item.id === val.id);
      if (idx !== -1) {
        mockStore[this.table][idx] = { ...mockStore[this.table][idx], ...val };
        upserted.push(mockStore[this.table][idx]);
      } else {
        mockStore[this.table].push(val);
        upserted.push(val);
      }
    }
    return { data: Array.isArray(values) ? upserted : upserted[0], error: null };
  }

  async delete() {
    const list = this.evaluate();
    mockStore[this.table] = mockStore[this.table].filter(
      (item) => !list.includes(item)
    );
    return { data: list, error: null };
  }

  // Promise implementation so users can await the query builder directly
  then(
    onfulfilled?: (value: { data: Record<string, unknown>[] | Record<string, unknown> | null; error: { message: string } | null }) => unknown,
    onrejected?: (reason: unknown) => unknown
  ) {
    const list = this.evaluate();
    const result = { data: list, error: null };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  private evaluate(): Record<string, unknown>[] {
    let list = [...mockStore[this.table]];
    for (const filter of this.filters) {
      list = list.filter(filter);
    }
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAsc;
      list.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return asc ? valA - valB : valB - valA;
        }
        const strA = String(valA);
        const strB = String(valB);
        if (strA < strB) return asc ? -1 : 1;
        if (strA > strB) return asc ? 1 : -1;
        return 0;
      });
    }
    if (this.limitCount !== null) {
      list = list.slice(0, this.limitCount);
    }
    return list;
  }
}

// Mock Supabase Client
const mockSupabase = {
  from(table: keyof MockStore) {
    return new MockSupabaseQueryBuilder(table);
  }
};

// Export active Supabase client instance (or fallback)
export const supabase = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (mockSupabase as unknown as ReturnType<typeof createClient>);

if (!isRealSupabaseConfigured) {
  console.warn(
    '⚠️ SUPABASE_URL & SUPABASE_ANON_KEY not set in env. Using in-memory fallback database.'
  );
}

// Convert DB snake_case to JS camelCase
export function toCamelCase(dbObj: unknown): unknown {
  if (!dbObj) return dbObj;
  if (Array.isArray(dbObj)) {
    return dbObj.map(toCamelCase);
  }
  if (typeof dbObj !== 'object') return dbObj;

  const typedObj = dbObj as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(typedObj)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    
    let val = typedObj[key];
    // Attempt parsing JSON fields
    if (key === 'history' && typeof val === 'string') {
      try {
        val = JSON.parse(val);
      } catch {
        // Fallback
      }
    }
    
    // Map database numeric fields to numbers
    if (
      [
        'cargo_value',
        'shipping_fee',
        'released_supplier_amount',
        'released_carrier_amount',
        'demurrage_rate_per_hour',
        'demurrage_penalty_paid',
        'temperature',
        'yield_earned',
        'temperature_penalty',
        'factoring_price',
        'humidity',
        'usyc_shares',
        'repayment_amount',
        'loan_requested'
      ].includes(key)
    ) {
      val = val !== null ? Number(val) : 0;
    }

    result[camelKey] = typeof val === 'object' && val !== null && key !== 'history'
      ? toCamelCase(val)
      : val;
  }
  return result;
}

// Convert JS camelCase to DB snake_case
export function toSnakeCase(jsObj: unknown): unknown {
  if (!jsObj) return jsObj;
  if (Array.isArray(jsObj)) {
    return jsObj.map(toSnakeCase);
  }
  if (typeof jsObj !== 'object') return jsObj;

  const typedObj = jsObj as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(typedObj)) {
    // Convert camelCase to snake_case
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    
    let val = typedObj[key];
    if (key === 'history' && Array.isArray(val)) {
      val = JSON.stringify(val);
    }
    
    result[snakeKey] = typeof val === 'object' && val !== null && key !== 'history'
      ? toSnakeCase(val)
      : val;
  }
  return result;
}
