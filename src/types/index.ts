export interface Room {
  id: string;
  room_number: string;
  floor: number;
  area_sqm: number;
  monthly_rent: number;
  status: 'available' | 'occupied' | 'maintenance';
  max_occupants: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  current_tenant?: Tenant | null;
  current_assignment?: RoomAssignment | null;
  tenants?: Tenant[];
  active_assignments?: RoomAssignment[];
}

export interface Tenant {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_card_number: string | null;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomAssignment {
  id: string;
  room_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  contract_end_date: string | null;
  is_active: boolean;
  is_primary: boolean;
  deposit_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tenant?: Tenant;
  room?: Room;
}

export interface MeterReading {
  id: string;
  room_id: string;
  reading_date: string;
  electricity_old: number;
  electricity_new: number;
  water_old: number;
  water_new: number;
  electricity_price_per_unit: number;
  water_price_per_unit: number;
  created_at: string;
  updated_at: string;
  room?: Room;
}

export interface Invoice {
  id: string;
  room_id: string;
  tenant_id: string | null;
  meter_reading_id: string | null;
  invoice_month: number;
  invoice_year: number;
  room_rent: number;
  electricity_cost: number;
  water_cost: number;
  other_fees: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'overdue';
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  room?: Room;
  tenant?: Tenant;
  meter_reading?: MeterReading;
}

export interface RepairRequest {
  id: string;
  room_id: string;
  tenant_id: string | null;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  reported_at: string;
  resolved_at: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  room?: Room;
  tenant?: Tenant;
}


export interface BankTransaction {
  id: string;
  provider: string;
  provider_transaction_id: string;
  reference_code: string | null;
  gateway: string | null;
  account_number: string | null;
  transfer_type: 'in' | 'out';
  amount: number;
  accumulated: number | null;
  content: string | null;
  payment_code: string | null;
  invoice_id: string | null;
  transaction_date: string | null;
  created_at: string;
}

export interface InvoicePaymentInfo {
  invoice_id: string;
  room_number: string;
  tenant_name: string | null;
  invoice_status: Invoice['status'];
  payment_status: 'pending' | 'partial' | 'paid';
  payment_code: string;
  required_amount: number;
  received_amount: number;
  remaining_amount: number;
  bank: {
    bank_id: string;
    account_number: string;
    account_name: string;
  };
  qr_locked: boolean;
  qr_url: string | null;
  transactions: BankTransaction[];
}

export type Page = 'dashboard' | 'rooms' | 'tenants' | 'meter-readings' | 'invoices' | 'repairs';
