import type { Room, Tenant, RoomAssignment, MeterReading, Invoice, RepairRequest, RoommateRequest } from '../types';

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  unreadCount?: number;
}

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export function getImageUrl(path: string): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return 'http://localhost:5000' + path;
}

function buildQueryString(params: any): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value as string);
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders = getHeaders();
  const headers: Record<string, string> = {
    ...defaultHeaders,
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }
  
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Rooms API
export async function getRooms(params?: PaginationParams): Promise<PaginatedResponse<Room>> {
  const query = buildQueryString(params);
  return request<PaginatedResponse<Room>>(`/rooms${query}`);
}

export async function getRoom(id: string): Promise<Room | null> {
  return request<Room>(`/rooms/${id}`);
}

export async function createRoom(room: Partial<Room> | FormData): Promise<Room> {
  return request<Room>('/rooms', {
    method: 'POST',
    body: room instanceof FormData ? room : JSON.stringify(room),
  });
}

export async function updateRoom(id: string, room: Partial<Room> | FormData): Promise<Room> {
  return request<Room>(`/rooms/${id}`, {
    method: 'PUT',
    body: room instanceof FormData ? room : JSON.stringify(room),
  });
}

export async function deleteRoom(id: string): Promise<void> {
  return request<void>(`/rooms/${id}`, {
    method: 'DELETE',
  });
}

// Users API
export async function getAdminUsers(params?: PaginationParams): Promise<PaginatedResponse<any>> {
  const query = buildQueryString(params);
  return request<PaginatedResponse<any>>(`/admin/users${query}`);
}

export async function createTenantUser(username: string, password: string, full_name: string, phone: string): Promise<any> {
  return request<any>('/admin/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, full_name, phone })
  });
}

// AI API
export async function sendAiMessage(message: string, role: string, tenantId?: string, history: any[] = []): Promise<{ reply: string }> {
  return request<{ reply: string }>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, role, tenant_id: tenantId, history })
  });
}

// Tenants API
export async function getTenants(params?: PaginationParams): Promise<PaginatedResponse<Tenant>> {
  const query = buildQueryString(params);
  return request<PaginatedResponse<Tenant>>(`/tenants${query}`);
}

export async function getTenant(id: string): Promise<Tenant | null> {
  return request<Tenant>(`/tenants/${id}`);
}

export async function createTenant(tenant: Partial<Tenant>): Promise<Tenant> {
  return request<Tenant>('/tenants', {
    method: 'POST',
    body: JSON.stringify(tenant),
  });
}

export async function updateTenant(id: string, tenant: Partial<Tenant>): Promise<Tenant> {
  return request<Tenant>(`/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(tenant),
  });
}

export async function deleteTenant(id: string): Promise<void> {
  return request<void>(`/tenants/${id}`, {
    method: 'DELETE',
  });
}

// Room Assignments API
export async function assignTenantToRoom(
  roomId: string,
  tenantId: string,
  startDate: string,
  deposit: number,
  isPrimary: boolean,
  notes?: string,
  contractEndDate?: string
): Promise<RoomAssignment> {
  return request<RoomAssignment>('/room_assignments', {
    method: 'POST',
    body: JSON.stringify({
      room_id: roomId,
      tenant_id: tenantId,
      start_date: startDate,
      deposit_amount: deposit,
      is_primary: isPrimary,
      notes,
      contract_end_date: contractEndDate,
    }),
  });
}

export async function setPrimaryTenant(assignmentId: string, roomId: string): Promise<void> {
  return request<void>(`/room_assignments/${assignmentId}/primary`, {
    method: 'PUT',
    body: JSON.stringify({ room_id: roomId }),
  });
}

export async function endRoomAssignment(assignmentId: string): Promise<void> {
  return request<void>(`/room_assignments/${assignmentId}/end`, {
    method: 'POST',
  });
}

export async function extendContract(assignmentId: string, newContractEndDate: string): Promise<RoomAssignment> {
  return request<RoomAssignment>(`/room_assignments/${assignmentId}/extend`, {
    method: 'PUT',
    body: JSON.stringify({ contract_end_date: newContractEndDate }),
  });
}

export async function getExpiringContracts(withinDays: number = 30): Promise<RoomAssignment[]> {
  return request<RoomAssignment[]>(`/room_assignments/expiring?withinDays=${withinDays}`);
}

// Meter Readings API
export async function getMeterReadings(params?: PaginationParams): Promise<PaginatedResponse<MeterReading>> {
  const query = buildQueryString(params);
  return request<PaginatedResponse<MeterReading>>(`/meter_readings${query}`);
}

export async function getMeterReadingsByRoom(roomId: string): Promise<MeterReading[]> {
  return request<MeterReading[]>(`/meter_readings/room/${roomId}`);
}

export async function getLatestMeterReading(roomId: string): Promise<MeterReading | null> {
  return request<MeterReading | null>(`/meter_readings/latest/${roomId}`);
}

export async function createMeterReading(reading: Partial<MeterReading>): Promise<MeterReading> {
  return request<MeterReading>('/meter_readings', {
    method: 'POST',
    body: JSON.stringify(reading),
  });
}

export async function updateMeterReading(id: string, reading: Partial<MeterReading>): Promise<MeterReading> {
  return request<MeterReading>(`/meter_readings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(reading),
  });
}

export async function deleteMeterReading(id: string): Promise<void> {
  return request<void>(`/meter_readings/${id}`, {
    method: 'DELETE',
  });
}

// Invoices API
export async function getInvoices(params?: PaginationParams): Promise<PaginatedResponse<Invoice>> {
  const query = buildQueryString(params);
  return request<PaginatedResponse<Invoice>>(`/invoices${query}`);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  return request<Invoice>(`/invoices/${id}`);
}

export async function createInvoice(invoice: Partial<Invoice>): Promise<Invoice> {
  return request<Invoice>('/invoices', {
    method: 'POST',
    body: JSON.stringify(invoice),
  });
}

export async function updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice> {
  return request<Invoice>(`/invoices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(invoice),
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  return request<void>(`/invoices/${id}`, {
    method: 'DELETE',
  });
}

export async function markOverdueInvoices(): Promise<void> {
  return request<void>('/invoices/mark-overdue', {
    method: 'POST',
  });
}

export async function markInvoicePaid(id: string): Promise<Invoice> {
  return request<Invoice>(`/invoices/${id}/paid`, {
    method: 'PUT',
  });
}

// Repair Requests API
export async function getRepairRequests(params?: PaginationParams): Promise<PaginatedResponse<RepairRequest>> {
  const query = buildQueryString(params);
  return request<PaginatedResponse<RepairRequest>>(`/repair_requests${query}`);
}

export async function getRepairRequest(id: string): Promise<RepairRequest | null> {
  return request<RepairRequest>(`/repair_requests/${id}`);
}

export async function createRepairRequest(requestData: Partial<RepairRequest>): Promise<RepairRequest> {
  return request<RepairRequest>('/repair_requests', {
    method: 'POST',
    body: JSON.stringify(requestData),
  });
}

export async function updateRepairRequest(id: string, requestData: Partial<RepairRequest>): Promise<RepairRequest> {
  return request<RepairRequest>(`/repair_requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(requestData),
  });
}

export async function deleteRepairRequest(id: string): Promise<void> {
  return request<void>(`/repair_requests/${id}`, {
    method: 'DELETE',
  });
}

// Roommate Requests API
export async function getRoommateRequests(): Promise<RoommateRequest[]> {
  return request<RoommateRequest[]>('/roommates');
}

export async function getMyRoommateRequests(): Promise<RoommateRequest[]> {
  return request<RoommateRequest[]>('/roommates/my-requests');
}

export async function createRoommateRequest(data: { tieu_de: string; mo_ta?: string; gia_chia_se: number }): Promise<RoommateRequest> {
  return request<RoommateRequest>('/roommates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function closeRoommateRequest(id: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/roommates/${id}/close`, {
    method: 'PUT',
  });
}

// Dashboard stats
export async function getDashboardStats() {
  const [roomsRes, tenantsRes, invoicesRes, repairsRes] = await Promise.all([
    getRooms({ limit: 10000 }),
    getTenants({ limit: 10000 }),
    getInvoices({ limit: 10000 }),
    getRepairRequests({ limit: 10000 }),
  ]);

  const rooms = roomsRes.data || [];
  const tenants = tenantsRes.data || [];
  const invoices = invoicesRes.data || [];
  const repairs = repairsRes.data || [];

  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.total_amount, 0);

  const pendingPayments = invoices
    .filter(i => i.status === 'pending')
    .reduce((sum, i) => sum + i.total_amount, 0);

  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const availableRooms = rooms.filter(r => r.status === 'available').length;

  const pendingRepairs = repairs.filter(r => r.status === 'new' || r.status === 'in_progress').length;

  return {
    totalRooms: rooms.length,
    occupiedRooms,
    availableRooms,
    maintenanceRooms: rooms.filter(r => r.status === 'maintenance').length,
    totalTenants: tenants.length,
    totalRevenue,
    pendingPayments,
    pendingInvoices: invoices.filter(i => i.status === 'pending').length,
    overdueInvoices: invoices.filter(i => i.status === 'overdue').length,
    pendingRepairs,
    recentRepairs: repairs.slice(0, 5),
    recentInvoices: invoices.slice(0, 5),
  };
}

export async function reportPayment(invoiceId: string) {
  const res = await fetch(`${BASE_URL}/invoices/${invoiceId}/report-payment`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to report payment');
  return res.json();
}

export async function confirmPayment(invoiceId: string) {
  const res = await fetch(`${BASE_URL}/admin/invoices/${invoiceId}/confirm-payment`, {
    method: 'PATCH',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to confirm payment');
  return res.json();
}

// --- REPAIR REQUESTS ---
export async function getSettings() {
  const res = await fetch(`${BASE_URL}/settings`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(data: any) {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

// --- NOTIFICATIONS API ---
export async function getNotifications(params?: PaginationParams & { archive?: boolean }): Promise<PaginatedResponse<any>> {
  const queryParams: any = { ...params };
  if (params?.archive) queryParams.archive = 'true';
  const query = `?${new URLSearchParams(queryParams).toString()}`;
  return request<PaginatedResponse<any>>(`/notifications/my${query}`);
}

export async function getNotificationDetail(id: number): Promise<any> {
  return request<any>(`/notifications/${id}`);
}

export async function sendNotification(data: { title: string, content: string, targetType: 'all'|'personal', targetTenantId?: string }): Promise<any> {
  return request<any>('/notifications', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function replyNotification(id: number, content: string): Promise<any> {
  return request<any>(`/notifications/${id}/replies`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });
}

export async function markNotificationAsRead(id: number): Promise<any> {
  return request<any>(`/notifications/${id}/read`, {
    method: 'PATCH'
  });
}

export async function deleteNotification(id: number): Promise<any> {
  return request<any>(`/notifications/${id}`, {
    method: 'DELETE'
  });
}

export async function restoreNotification(id: number): Promise<any> {
  return request<any>(`/notifications/${id}/restore`, {
    method: 'PATCH'
  });
}

// --- FRIENDS API ---
export async function getFriends(): Promise<any[]> {
  return request<any[]>('/friends');
}

export async function sendFriendRequest(phone_number: string): Promise<any> {
  return request<any>('/friends/request', {
    method: 'POST',
    body: JSON.stringify({ phone_number })
  });
}

export async function respondFriendRequest(request_id: string, action: 'accept' | 'reject'): Promise<any> {
  return request<any>('/friends/respond', {
    method: 'PUT',
    body: JSON.stringify({ request_id, action })
  });
}

// --- CHAT API ---
export async function getChatMessages(isGroup: boolean, archive: boolean = false, receiverId?: string, params?: PaginationParams): Promise<PaginatedResponse<any>> {
  const queryParams: any = { is_group: isGroup.toString(), archive: archive.toString(), ...params };
  if (receiverId) {
    queryParams.receiver_id = receiverId;
  }
  const query = new URLSearchParams(queryParams).toString();
  return request<PaginatedResponse<any>>(`/chat?${query}`);
}

export async function sendChatMessage(content: string, isGroup: boolean, receiverId?: string): Promise<any> {
  return request<any>('/chat', {
    method: 'POST',
    body: JSON.stringify({ content, is_group: isGroup, receiver_id: receiverId })
  });
}

export async function deleteChatMessage(id: number): Promise<any> {
  return request<any>(`/chat/${id}`, {
    method: 'DELETE'
  });
}



export async function restoreChatMessage(id: number): Promise<any> {
  return request<any>(`/chat/${id}/restore`, {
    method: 'PATCH'
  });
}
export async function loginUser(data: any): Promise<any> {
  return request<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<any> {
  return request<any>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword })
  });
}

export async function getBadges(): Promise<{ chat: number, notifications: number, invoices: number, repairs: number }> {
  return request<{ chat: number, notifications: number, invoices: number, repairs: number }>('/badges');
}

export async function loginGoogle(token: string): Promise<any> {
  return request<any>('/auth/google-login', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export async function generateContract(assignmentId: string): Promise<any> {
  return request<any>(`/contracts/${assignmentId}/generate`, {
    method: 'POST'
  });
}
