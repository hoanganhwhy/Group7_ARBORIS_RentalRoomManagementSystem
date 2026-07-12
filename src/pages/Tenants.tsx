import { useEffect, useState } from 'react';
import { Plus, Users, Edit2, Trash2, Phone, Mail, Home, Crown, LogOut, UserPlus, Eye, EyeOff } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Spinner, EmptyState } from '../components/ui/Input';
import {
  getTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  getRooms,
  assignTenantToRoom,
  endRoomAssignment,
  getExpiringContracts,
} from '../lib/api';

import type { Tenant, Room, RoomAssignment } from '../types';
import { Pagination } from '../components/common/Pagination';
import { PageSizeSelector } from '../components/common/PageSizeSelector';
import { SearchInput } from '../components/common/SearchInput';

const countryCodes = [
  { code: '+84', label: 'VN (+84)' },
  { code: '+1', label: 'Mỹ/Canada (+1)' },
  { code: '+81', label: 'Nhật Bản (+81)' },
  { code: '+82', label: 'Hàn Quốc (+82)' },
  { code: '+86', label: 'Trung Quốc (+86)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+886', label: 'Đài Loan (+886)' },
];

function parsePhone(phone: string) {
  if (!phone) return { countryCode: '+84', body: '' };
  
  // Find matching country code prefix
  const matched = countryCodes.find(c => phone.startsWith(c.code));
  if (matched) {
    return { countryCode: matched.code, body: phone.slice(matched.code.length) };
  }
  
  // If it starts with '0' and has no '+', it's a legacy VN number
  if (phone.startsWith('0')) {
    return { countryCode: '+84', body: phone.slice(1) };
  }
  
  return { countryCode: '+84', body: phone };
}

export function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [assigningTenant, setAssigningTenant] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visiblePhones, setVisiblePhones] = useState<Set<string>>(new Set());
  const [visibleEmails, setVisibleEmails] = useState<Set<string>>(new Set());
  const [visibleIDs, setVisibleIDs] = useState<Set<string>>(new Set());
  
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterRent, setFilterRent] = useState<string>('all');
  const [filterOccupants, setFilterOccupants] = useState<string>('all');
  const [filterExpiring, setFilterExpiring] = useState<boolean>(false);
  const [expiringContracts, setExpiringContracts] = useState<RoomAssignment[]>([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, hasNextPage: false, hasPreviousPage: false });

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    id_card_number: '',
    date_of_birth: '',
    address: '',
    emergency_contact: '',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<{
    phone?: string;
    email?: string;
    id_card_number?: string;
  }>({});

  const [assignData, setAssignData] = useState({
    room_id: '',
    start_date: new Date().toISOString().split('T')[0],
    deposit_amount: '' as string | number,
    is_primary: false,
    contract_end_date: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const parsedPhone = parsePhone(formData.phone);

  // loadData uses the dependencies listed below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadData(); }, [page, limit, searchQuery]);

  async function loadData() {
    try {
      setLoading(true);
      const [tenantsData, roomsData, expiringData] = await Promise.all([
        getTenants({ page, limit, search: searchQuery }), 
        getRooms({ limit: 100 }), // Lấy đủ phòng để mapping
        getExpiringContracts(30).catch(() => [] as RoomAssignment[])
      ]);
      setTenants(tenantsData.data || []);
      setPagination(tenantsData.pagination);
      setRooms(roomsData.data || []);
      setExpiringContracts(expiringData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Reset trang khi thay đổi search
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterFloor, filterArea, filterRent, filterOccupants, filterExpiring]);

  function getTenantAssignment(tenantId: string): { room: Room; assignment: RoomAssignment } | null {
    for (const room of rooms) {
      const found = room.active_assignments?.find((a) => a.tenant_id === tenantId);
      if (found) return { room, assignment: found };
    }
    return null;
  }

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
  }

  function maskValue(value: string, visibleEnd = 3): string {
    if (!value || value.length <= visibleEnd) return value;
    return '•'.repeat(Math.min(value.length - visibleEnd, 8)) + value.slice(-visibleEnd);
  }

  function maskEmail(email: string): string {
    if (!email) return email;
    const [local, domain] = email.split('@');
    if (!domain) return maskValue(email, 3);
    const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
    return visible + '•'.repeat(Math.min(local.length - visible.length, 6)) + '@' + domain;
  }

  const filteredTenants = tenants.filter((t) => {
    if (!searchQuery) return true;
    const nameMatch = t.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = t.phone
      ? t.phone.replace(/\D/g, '').includes(searchQuery.replace(/\D/g, '')) ||
        t.phone.includes(searchQuery)
      : false;
    const matchesSearch = nameMatch || phoneMatch;

    const info = getTenantAssignment(t.id);
    const room = info?.room;
    
    let matchesFloor = true;
    if (filterFloor !== 'all') {
      matchesFloor = room ? room.floor.toString() === filterFloor : false;
    }
    
    let matchesArea = true;
    if (filterArea !== 'all') {
      matchesArea = room ? room.area === filterArea : false;
    }
    
    let matchesRent = true;
    if (filterRent !== 'all') {
      if (!room) matchesRent = false;
      else if (filterRent === '1m-2.5m') matchesRent = room.monthly_rent >= 1000000 && room.monthly_rent < 2500000;
      else if (filterRent === '2.5m-4m') matchesRent = room.monthly_rent >= 2500000 && room.monthly_rent <= 4000000;
      else if (filterRent === '>4m') matchesRent = room.monthly_rent > 4000000;
    }

    let matchesOccupants = true;
    if (filterOccupants !== 'all') {
      if (!room) matchesOccupants = false;
      else {
        const numOccupants = room.active_assignments?.length || 0;
        if (filterOccupants === '5+') {
          matchesOccupants = numOccupants >= 5;
        } else {
          matchesOccupants = numOccupants.toString() === filterOccupants;
        }
      }
    }

    const matchesExpiring = !filterExpiring || expiringContracts.some(ec => ec.tenant_id === t.id);

    return matchesSearch && matchesArea && matchesFloor && matchesRent && matchesOccupants && matchesExpiring;
  });

  function validateField(field: 'phone' | 'email' | 'id_card_number', value: string): string | undefined {
    if (!value) return undefined; // empty = not required, skip
    if (field === 'phone') {
      const parsed = parsePhone(value);
      const digitsOnly = parsed.body.replace(/\D/g, '');
      if (!digitsOnly) return 'Vui lòng nhập số điện thoại';
      if (parsed.countryCode === '+84') {
        if (!/^\d{9}$/.test(digitsOnly)) return 'SĐT Việt Nam phải có đúng 9 chữ số (sau mã +84, bỏ số 0 ở đầu)';
      } else {
        if (!/^\d{7,11}$/.test(digitsOnly)) return 'SĐT quốc tế phải từ 7 đến 11 chữ số';
      }
    }
    if (field === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return 'Email không đúng định dạng';
    }
    if (field === 'id_card_number') {
      if (!/^\d{9}$/.test(value) && !/^\d{12}$/.test(value))
        return 'CCCD phải là 12 số (CCCD mới) hoặc 9 số (CMND cũ)';
    }
    return undefined;
  }

  function validateForm(): boolean {
    const errors: typeof formErrors = {};
    const pErr = validateField('phone', formData.phone);
    if (pErr) errors.phone = pErr;
    const eErr = validateField('email', formData.email);
    if (eErr) errors.email = eErr;
    const iErr = validateField('id_card_number', formData.id_card_number);
    if (iErr) errors.id_card_number = iErr;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function updatePhone(v: string) {
    const err = validateField('phone', v);
    setFormErrors((e) => ({ ...e, phone: err }));
    setFormData((f) => ({ ...f, phone: v }));
  }

  function updateEmail(v: string) {
    const err = validateField('email', v);
    setFormErrors((e) => ({ ...e, email: err }));
    setFormData((f) => ({ ...f, email: v }));
  }

  function updateIDCard(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 12);
    const err = validateField('id_card_number', digits);
    setFormErrors((e) => ({ ...e, id_card_number: err }));
    setFormData((f) => ({ ...f, id_card_number: digits }));
  }

  function openCreateModal() {
    setEditingTenant(null);
    setFormErrors({});
    setFormData({ full_name: '', phone: '', email: '', id_card_number: '', date_of_birth: '', address: '', emergency_contact: '', notes: '' });
    setIsModalOpen(true);
  }

  function openEditModal(tenant: Tenant) {
    setEditingTenant(tenant);
    setFormErrors({});
    setFormData({
      full_name: tenant.full_name,
      phone: tenant.phone || '',
      email: tenant.email || '',
      id_card_number: tenant.id_card_number || '',
      date_of_birth: tenant.date_of_birth || '',
      address: tenant.address || '',
      emergency_contact: tenant.emergency_contact || '',
      notes: tenant.notes || '',
    });
    setIsModalOpen(true);
  }

  function openAssignModal(tenant: Tenant) {
    setAssigningTenant(tenant);
    // Default contract end date: 1 year from now
    const defaultEndDate = new Date();
    defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1);
    setAssignData({
      room_id: '',
      start_date: new Date().toISOString().split('T')[0],
      deposit_amount: '',
      is_primary: false,
      contract_end_date: defaultEndDate.toISOString().split('T')[0],
      notes: '',
    });
    setIsAssignModalOpen(true);
  }

  function openDeleteModal(tenant: Tenant) {
    setDeletingTenant(tenant);
    setIsDeleteModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editingTenant) {
        await updateTenant(editingTenant.id, formData);
      } else {
        await createTenant(formData);
      }
      await loadData();
      setIsModalOpen(false);
    } catch {
      alert('Không thể lưu thông tin. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningTenant) return;
    setSaving(true);
    try {
      await assignTenantToRoom(
        assignData.room_id,
        assigningTenant.id,
        assignData.start_date,
        parseFloat(assignData.deposit_amount as any) || 0,
        assignData.is_primary,
        assignData.notes,
        assignData.contract_end_date || undefined
      );
      await loadData();
      setIsAssignModalOpen(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không thể gán phòng.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckout(assignment: RoomAssignment) {
    if (!confirm('Xác nhận trả phòng?\nLƯU Ý: Khách đã thông báo trước 30 ngày chưa? (Nếu chưa, bạn có thể tự thỏa thuận trừ cọc theo quy định trước khi xác nhận).')) return;
    try {
      await endRoomAssignment(assignment.id);
      await loadData();
    } catch {
      alert('Không thể trả phòng. Vui lòng thử lại.');
    }
  }

  async function handleDelete() {
    if (!deletingTenant) return;
    try {
      await deleteTenant(deletingTenant.id);
      await loadData();
      setIsDeleteModalOpen(false);
    } catch {
      alert('Không thể xóa người thuê. Có thể vẫn còn dữ liệu liên quan.');
    }
  }

  const assignableRooms = rooms.filter((r) => r.status !== 'maintenance');

  if (loading) return <Spinner />;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-charcoal-900 tracking-tight">Người thuê</h1>
          <p className="text-charcoal-400 mt-2 text-base">Quản lý thông tin chi tiết của người thuê và duyệt tài khoản</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4" />
          Thêm người thuê
        </Button>
      </header>

      {tenants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-12">
          <EmptyState
            icon={<Users className="w-10 h-10" />}
            title="Chưa có người thuê nào"
            description="Bắt đầu bằng cách thêm thông tin người thuê mới vào hệ thống"
            action={<Button onClick={openCreateModal}><Plus className="w-4 h-4" />Thêm người thuê</Button>}
          />
        </div>
      ) : (
        <>
          {/* Filters & Search */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="w-80">
                <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Tìm theo tên hoặc số điện thoại..." />
              </div>
              <PageSizeSelector limit={limit} onLimitChange={setLimit} />
            </div>
            {/* Advanced Filters */}
            <div className="flex gap-4 items-center bg-white p-3 rounded-xl border border-charcoal-100 shadow-sm flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-charcoal-500 uppercase">Khu vực / Địa chỉ:</span>
                <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} className="text-sm border-none bg-charcoal-50 rounded-lg py-1.5 px-3 focus:ring-0 cursor-pointer">
                  <option value="all">Tất cả</option>
                  {Array.from(new Set(rooms.map(r => r.area).filter(Boolean))).sort().map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-charcoal-500 uppercase">Tầng (đang ở):</span>
                <select value={filterFloor} onChange={(e) => setFilterFloor(e.target.value)} className="text-sm border-none bg-charcoal-50 rounded-lg py-1.5 px-3 focus:ring-0 cursor-pointer">
                  <option value="all">Tất cả</option>
                  {Array.from(new Set(rooms.map(r => r.floor))).sort((a,b) => a - b).map(f => (
                    <option key={f} value={f.toString()}>Tầng {f}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-charcoal-500 uppercase">Giá phòng:</span>
                <select value={filterRent} onChange={(e) => setFilterRent(e.target.value)} className="text-sm border-none bg-charcoal-50 rounded-lg py-1.5 px-3 focus:ring-0 cursor-pointer">
                  <option value="all">Tất cả</option>
                  <option value="1m-2.5m">Từ 1 - 2.5 triệu</option>
                  <option value="2.5m-4m">Từ 2.5 - 4 triệu</option>
                  <option value=">4m">Trên 4 triệu</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-charcoal-500 uppercase">Số người chung:</span>
                <select value={filterOccupants} onChange={(e) => setFilterOccupants(e.target.value)} className="text-sm border-none bg-charcoal-50 rounded-lg py-1.5 px-3 focus:ring-0 cursor-pointer">
                  <option value="all">Tất cả</option>
                  <option value="1">1 người</option>
                  <option value="2">2 người</option>
                  <option value="3">3 người</option>
                  <option value="4">4 người</option>
                  <option value="5+">5+ người (Nhóm gia đình)</option>
                </select>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-charcoal-700">
                  <input type="checkbox" checked={filterExpiring} onChange={(e) => setFilterExpiring(e.target.checked)} className="rounded text-amber-500 focus:ring-amber-500" />
                  Hợp đồng sắp hết hạn
                </label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {filteredTenants.map((tenant) => {
              const info = getTenantAssignment(tenant.id);
              return (
                <ContactCard
                  key={tenant.id}
                  tenant={tenant}
                  room={info?.room || null}
                  assignment={info?.assignment || null}
                  phoneVisible={visiblePhones.has(tenant.id)}
                  emailVisible={visibleEmails.has(tenant.id)}
                  idVisible={visibleIDs.has(tenant.id)}
                  onTogglePhone={() => toggle(visiblePhones, setVisiblePhones, tenant.id)}
                  onToggleEmail={() => toggle(visibleEmails, setVisibleEmails, tenant.id)}
                  onToggleID={() => toggle(visibleIDs, setVisibleIDs, tenant.id)}
                  maskValue={maskValue}
                  maskEmail={maskEmail}
                  onEdit={() => openEditModal(tenant)}
                  onAssign={() => openAssignModal(tenant)}
                  onCheckout={() => info && handleCheckout(info.assignment)}
                  onDelete={() => openDeleteModal(tenant)}
                />
              );
            })}
          </div>
          
          {/* Pagination component */}
          {!loading && filteredTenants.length > 0 && (
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              hasNextPage={pagination.hasNextPage}
              hasPreviousPage={pagination.hasPreviousPage}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTenant ? 'Sửa thông tin' : 'Thêm người thuê mới'} size="lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <Input label="Họ và tên" name="full_name" value={formData.full_name} onChange={(v) => setFormData({ ...formData, full_name: v })} required placeholder="Nguyễn Văn A" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-charcoal-700">
                Số điện thoại <span className="text-rose-500 ml-1">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={parsedPhone.countryCode}
                  onChange={(e) => {
                    const newPhone = e.target.value + parsedPhone.body;
                    updatePhone(newPhone);
                  }}
                  className="min-w-[140px] w-auto shrink-0 px-3.5 py-2.5 rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors"
                >
                  {countryCodes.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  name="phone"
                  value={parsedPhone.body}
                  onChange={(e) => {
                    const cleanBody = e.target.value.replace(/\D/g, '').slice(0, 11);
                    const newPhone = parsedPhone.countryCode + cleanBody;
                    updatePhone(newPhone);
                  }}
                  placeholder="987654321"
                  required
                  className="w-2/3 px-3.5 py-2.5 rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors"
                />
              </div>
              {formErrors.phone && <p className="text-sm text-rose-600 font-medium">{formErrors.phone}</p>}
            </div>
            <Input
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={updateEmail}
              placeholder="email@example.com"
              error={formErrors.email}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Số CMND/CCCD"
              name="id_card_number"
              value={formData.id_card_number}
              onChange={updateIDCard}
              placeholder="CCCD: 12 số / CMND: 9 số"
              error={formErrors.id_card_number}
            />
            <Input label="Ngày sinh" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={(v) => setFormData({ ...formData, date_of_birth: v })} />
          </div>
          <Input label="Địa chỉ thường trú" name="address" value={formData.address} onChange={(v) => setFormData({ ...formData, address: v })} placeholder="123 Đường ABC, Quận XYZ, TP. HCM" />
          <Input label="Liên hệ khẩn cấp" name="emergency_contact" value={formData.emergency_contact} onChange={(v) => setFormData({ ...formData, emergency_contact: v })} placeholder="Nguyễn Văn B - 0909876543" />
          <Input label="Ghi chú" name="notes" type="textarea" value={formData.notes} onChange={(v) => setFormData({ ...formData, notes: v })} rows={2} />
          <div className="flex gap-3 pt-5 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editingTenant ? 'Cập nhật' : 'Thêm mới'}</Button>
          </div>
        </form>
      </Modal>

      {/* Assign Room Modal */}
      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title={`Gán phòng cho ${assigningTenant?.full_name}`} size="md">
        <form onSubmit={handleAssign} className="p-6 space-y-5">
          <Input label="Chọn phòng" name="room_id" type="select" value={assignData.room_id} onChange={(v) => setAssignData({ ...assignData, room_id: v })} required
            options={[
              { value: '', label: '-- Chọn phòng --' },
              ...assignableRooms.map((r) => ({
                value: r.id,
                label: `Phòng ${r.room_number} - ${r.monthly_rent.toLocaleString('vi-VN')}đ${r.active_assignments?.length ? ` (${r.active_assignments.length} người)` : ' (trống)'}`,
              })),
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ngày bắt đầu thuê" name="start_date" type="date" value={assignData.start_date} onChange={(v) => setAssignData({ ...assignData, start_date: v })} required />
            <Input label="Tiền cọc (VNĐ)" name="deposit_amount" type="number" value={assignData.deposit_amount} onChange={(v) => setAssignData({ ...assignData, deposit_amount: v })} min={0} />
          </div>
          <Input label="Ngày kết thúc hợp đồng" name="contract_end_date" type="date" value={assignData.contract_end_date} onChange={(v) => setAssignData({ ...assignData, contract_end_date: v })} />
          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <input
              type="checkbox"
              id="assign_is_primary"
              checked={assignData.is_primary}
              onChange={(e) => setAssignData({ ...assignData, is_primary: e.target.checked })}
              className="w-4 h-4 text-terra-500 rounded border-charcoal-300 focus:ring-terra-400"
            />
            <label htmlFor="assign_is_primary" className="flex items-center gap-2 text-sm font-medium text-charcoal-700 cursor-pointer">
              <Crown className="w-4 h-4 text-amber-500" />
              Là chủ hợp đồng
            </label>
          </div>
          <Input label="Ghi chú" name="notes" type="textarea" value={assignData.notes} onChange={(v) => setAssignData({ ...assignData, notes: v })} rows={2} />
          <div className="flex gap-3 pt-5 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsAssignModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving || !assignData.room_id}>{saving ? 'Đang xử lý...' : 'Xác nhận'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Xác nhận xóa" size="sm">
        <div className="p-6">
          <p className="text-charcoal-600">Bạn có chắc muốn xóa người thuê <strong className="text-charcoal-900">{deletingTenant?.full_name}</strong>?</p>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={handleDelete}>Xóa</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MaskedField({
  value,
  visible,
  masked,
  onToggle,
  icon,
  prefix,
}: {
  value: string;
  visible: boolean;
  masked: string;
  onToggle: () => void;
  icon: React.ReactNode;
  prefix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span
        className={`text-sm text-charcoal-600 flex-1 min-w-0 truncate ${!visible ? 'font-mono tracking-widest' : ''}`}
        style={{ letterSpacing: visible ? undefined : '0.05em' }}
      >
        {prefix}{visible ? value : masked}
      </span>
      <button
        onClick={onToggle}
        className="p-1 rounded hover:bg-charcoal-100 transition-colors shrink-0"
        title={visible ? 'Ẩn' : 'Hiện'}
      >
        {visible ? <EyeOff className="w-3.5 h-3.5 text-charcoal-400" /> : <Eye className="w-3.5 h-3.5 text-charcoal-400" />}
      </button>
    </div>
  );
}

function ContactCard({
  tenant,
  room,
  assignment,
  phoneVisible,
  emailVisible,
  idVisible,
  onTogglePhone,
  onToggleEmail,
  onToggleID,
  maskValue,
  maskEmail,
  onEdit,
  onAssign,
  onCheckout,
  onDelete,
}: {
  tenant: Tenant;
  room: Room | null;
  assignment: RoomAssignment | null;
  phoneVisible: boolean;
  emailVisible: boolean;
  idVisible: boolean;
  onTogglePhone: () => void;
  onToggleEmail: () => void;
  onToggleID: () => void;
  maskValue: (v: string, n?: number) => string;
  maskEmail: (v: string) => string;
  onEdit: () => void;
  onAssign: () => void;
  onCheckout: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-charcoal-100">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-terra-100 to-terra-200 flex items-center justify-center text-terra-600 font-semibold text-xl shrink-0">
            {tenant.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-charcoal-900 truncate">{tenant.full_name}</h3>
              {assignment?.is_primary && (
                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg font-medium">
                  <Crown className="w-3 h-3" />Chủ HĐ
                </span>
              )}
            </div>
            {room ? (
              <div className="flex items-center gap-2 mt-2 text-sm text-sage-600">
                <div className="w-6 h-6 rounded-lg bg-sage-100 flex items-center justify-center">
                  <Home className="w-3 h-3 text-sage-600" />
                </div>
                <span className="font-medium">{room.area} - P. {room.room_number}</span>
                {assignment && (
                  <span className="text-charcoal-400 font-normal">
                    từ {new Date(assignment.start_date).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-2 text-sm text-charcoal-400">
                <div className="w-6 h-6 rounded-lg bg-charcoal-50 flex items-center justify-center">
                  <Home className="w-3 h-3 text-charcoal-400" />
                </div>
                <span>Chưa có phòng</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="px-6 py-4 space-y-3 bg-charcoal-50/30">
        {tenant.phone && (
          <MaskedField
            value={tenant.phone}
            visible={phoneVisible}
            masked={maskValue(tenant.phone, 3)}
            onToggle={onTogglePhone}
            icon={<Phone className="w-4 h-4 text-charcoal-400" />}
          />
        )}
        {tenant.email && (
          <MaskedField
            value={tenant.email}
            visible={emailVisible}
            masked={maskEmail(tenant.email)}
            onToggle={onToggleEmail}
            icon={<Mail className="w-4 h-4 text-charcoal-400" />}
          />
        )}
        {tenant.id_card_number && (
          <MaskedField
            value={tenant.id_card_number}
            visible={idVisible}
            masked={maskValue(tenant.id_card_number, 3)}
            onToggle={onToggleID}
            icon={<Users className="w-4 h-4 text-charcoal-400" />}
            prefix="CCCD: "
          />
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-charcoal-100 flex items-center justify-between">
        {!room ? (
          <button onClick={onAssign} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-terra-600 bg-terra-50 hover:bg-terra-100 rounded-xl transition-colors">
            <UserPlus className="w-4 h-4" />Gán phòng
          </button>
        ) : (
          <button onClick={onCheckout} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors">
            <LogOut className="w-4 h-4" />Trả phòng
          </button>
        )}
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-2.5 rounded-xl text-charcoal-400 hover:text-charcoal-600 hover:bg-charcoal-50 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2.5 rounded-xl text-charcoal-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
