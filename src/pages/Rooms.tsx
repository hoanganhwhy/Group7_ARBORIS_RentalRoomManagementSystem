import { useEffect, useState } from 'react';
import {
  Plus,
  DoorOpen,
  Edit2,
  Trash2,
  User,
  UserPlus,
  Crown,
  LogOut,
  Calendar,
  Banknote,
  Info,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';
import {
  getRooms,
  getTenants,
  createRoom,
  updateRoom,
  deleteRoom,
  assignTenantToRoom,
  endRoomAssignment,
  setPrimaryTenant,
  getExpiringContracts,
  extendContract,
} from '../lib/api';
import type { Room, Tenant, RoomAssignment } from '../types';
import { Search, AlertTriangle, CalendarDays, RefreshCw, LayoutGrid, List as ListIcon } from 'lucide-react';

export function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [assigningRoom, setAssigningRoom] = useState<Room | null>(null);
  const [viewingRoom, setViewingRoom] = useState<Room | null>(null);
  const [extendingAssignment, setExtendingAssignment] = useState<RoomAssignment | null>(null);
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'maintenance'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [expiringContracts, setExpiringContracts] = useState<RoomAssignment[]>([]);
  const [extendData, setExtendData] = useState({
    contract_end_date: '',
  });
  const [formData, setFormData] = useState({
    room_number: '',
    floor: 1,
    area_sqm: '' as string | number,
    monthly_rent: '' as string | number,
    max_occupants: 2,
    status: 'available' as 'available' | 'occupied' | 'maintenance',
    description: '',
  });
  const [assignData, setAssignData] = useState({
    tenant_id: '',
    start_date: new Date().toISOString().split('T')[0],
    deposit_amount: '' as string | number,
    is_primary: true,
    contract_end_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [roomsData, tenantsData, expiringData] = await Promise.all([
        getRooms(),
        getTenants(),
        getExpiringContracts(30).catch(() => [] as RoomAssignment[]),
      ]);
      setRooms(roomsData);
      setTenants(tenantsData);
      setExpiringContracts(expiringData);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingRoom(null);
    setFormData({ room_number: '', floor: 1, area_sqm: '', monthly_rent: '', max_occupants: 2, status: 'available', description: '' });
    setIsModalOpen(true);
  }

  function openEditModal(room: Room) {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      floor: Math.min(room.floor, 50),
      area_sqm: room.area_sqm ?? '',
      monthly_rent: room.monthly_rent ?? '',
      max_occupants: room.max_occupants || 2,
      status: room.status,
      description: room.description || '',
    });
    setIsModalOpen(true);
  }

  function openDeleteModal(room: Room) {
    if ((room.active_assignments?.length ?? 0) > 0) {
      alert(`Không thể xóa phòng ${room.room_number} vì hiện có ${room.active_assignments?.length} người đang ở. Vui lòng cho tất cả người thuê trả phòng trước.`);
      return;
    }
    setDeletingRoom(room);
    setIsDeleteModalOpen(true);
  }

  function openAssignModal(room: Room) {
    setAssigningRoom(room);
    const hasTenants = (room.active_assignments?.length ?? 0) > 0;
    // Default contract end date: 1 year from now
    const defaultEndDate = new Date();
    defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1);
    setAssignData({
      tenant_id: '',
      start_date: new Date().toISOString().split('T')[0],
      deposit_amount: '',
      is_primary: !hasTenants,
      contract_end_date: defaultEndDate.toISOString().split('T')[0],
      notes: '',
    });
    setIsAssignModalOpen(true);
  }

  function openDetailModal(room: Room) {
    setViewingRoom(room);
    setIsDetailModalOpen(true);
  }

  function openExtendModal(assignment: RoomAssignment) {
    setExtendingAssignment(assignment);
    let defaultDate: Date;
    if (assignment.contract_end_date) {
      // Extend from current end date by 1 month
      defaultDate = new Date(assignment.contract_end_date);
      defaultDate.setMonth(defaultDate.getMonth() + 1);
    } else {
      // No date yet: default to 1 year from today
      defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() + 1);
    }
    setExtendData({ contract_end_date: defaultDate.toISOString().split('T')[0] });
    setIsExtendModalOpen(true);
  }

  async function handleExtendContract() {
    if (!extendingAssignment) return;
    setSaving(true);
    try {
      await extendContract(extendingAssignment.id, extendData.contract_end_date);
      await loadData();
      setIsExtendModalOpen(false);
    } catch (error) {
      alert('Không thể gia hạn hợp đồng. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formData.floor > 50) {
      alert('Tầng không được vượt quá 50.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        area_sqm: parseFloat(formData.area_sqm as any) || 0,
        monthly_rent: parseFloat(formData.monthly_rent as any) || 0,
      };
      if (editingRoom) {
        await updateRoom(editingRoom.id, payload);
      } else {
        await createRoom(payload);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save room:', error);
      alert('Không thể lưu phòng. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingRoom) return;
    try {
      await deleteRoom(deletingRoom.id);
      await loadData();
      setIsDeleteModalOpen(false);
    } catch (error: any) {
      console.error('Failed to delete room:', error);
      const msg = error?.response?.data?.error || error?.message || 'Không thể xóa phòng.';
      alert(msg);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningRoom) return;
    setSaving(true);
    try {
      await assignTenantToRoom(
        assigningRoom.id,
        assignData.tenant_id,
        assignData.start_date,
        parseFloat(assignData.deposit_amount as any) || 0,
        assignData.is_primary,
        assignData.notes,
        assignData.contract_end_date || undefined
      );
      await loadData();
      setIsAssignModalOpen(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không thể gán người thuê.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckout(assignment: RoomAssignment) {
    if (!confirm(`Xác nhận trả phòng cho ${assignment.tenant?.full_name}?`)) return;
    try {
      await endRoomAssignment(assignment.id);
      await loadData();
      // Refresh viewing room if open
      if (viewingRoom) {
        const updated = rooms.find(r => r.id === viewingRoom.id);
        if (updated) setViewingRoom(updated);
      }
    } catch (error) {
      alert('Không thể trả phòng. Vui lòng thử lại.');
    }
  }

  async function handleSetPrimary(assignment: RoomAssignment, roomId: string) {
    try {
      await setPrimaryTenant(assignment.id, roomId);
      await loadData();
    } catch (error) {
      alert('Không thể cập nhật chủ hợp đồng.');
    }
  }

  const filteredRooms = rooms.filter((r) => {
    const matchesStatus = filter === 'all' || r.status === filter;
    const matchesSearch = !searchQuery || r.room_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });
  const statusCounts = {
    all: rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length,
  };

  const availableForAssign = tenants.filter(
    (t) => !assigningRoom?.active_assignments?.some((a) => a.tenant_id === t.id)
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-charcoal-900 tracking-tight">Quản lý phòng</h1>
          <p className="text-charcoal-400 mt-2 text-base">Quản lý và theo dõi tất cả các phòng trọ</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4" />
          Thêm phòng mới
        </Button>
      </header>

      {/* Filters */}
      <section className="space-y-4">
        <div className="flex gap-2 items-center flex-wrap">
          {(['all', 'available', 'occupied', 'maintenance'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                filter === status
                  ? 'bg-white text-charcoal-900 shadow-card border border-charcoal-100'
                  : 'text-charcoal-400 hover:text-charcoal-600 hover:bg-white/50'
              }`}
            >
              {status === 'all' && 'Tất cả'}
              {status === 'available' && 'Trống'}
              {status === 'occupied' && 'Đang thuê'}
              {status === 'maintenance' && 'Bảo trì'}
              <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                filter === status ? 'bg-terra-100 text-terra-700' : 'bg-charcoal-100 text-charcoal-500'
              }`}>{statusCounts[status]}</span>
            </button>
          ))}
          <div className="relative ml-auto flex items-center gap-3">
            <div className="flex bg-charcoal-50 p-1 rounded-xl">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-charcoal-900' : 'text-charcoal-400 hover:text-charcoal-600'}`} title="Dạng thẻ">
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-charcoal-900' : 'text-charcoal-400 hover:text-charcoal-600'}`} title="Dạng danh sách">
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
              <input
                type="text"
                placeholder="Tìm theo số phòng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2.5 text-sm rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors w-48"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Expiring Contracts Alert */}
      {expiringContracts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">Hợp đồng sắp hết hạn</h3>
              <p className="text-sm text-amber-700 mt-1">
                {expiringContracts.length} hợp đồng sẽ hết hạn trong vòng 30 ngày tới
              </p>
              <div className="mt-3 space-y-2">
                {expiringContracts.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between bg-white/70 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-charcoal-900">
                        {assignment.tenant?.full_name} - Phòng {assignment.room?.room_number}
                      </span>
                      <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        Hết hạn: {assignment.contract_end_date ? new Date(assignment.contract_end_date).toLocaleDateString('vi-VN') : 'N/A'}
                      </span>
                    </div>
                    <button
                      onClick={() => openExtendModal(assignment)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-terra-600 bg-terra-50 hover:bg-terra-100 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Gia hạn
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Grid */}
      {filteredRooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-12">
          <EmptyState
            icon={<DoorOpen className="w-10 h-10" />}
            title="Chưa có phòng nào"
            description="Bắt đầu bằng cách thêm phòng trọ mới vào hệ thống"
            action={<Button onClick={openCreateModal}><Plus className="w-4 h-4" />Thêm phòng</Button>}
          />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <PropertyCard
              key={room.id}
              room={room}
              onView={() => openDetailModal(room)}
              onEdit={() => openEditModal(room)}
              onDelete={() => openDeleteModal(room)}
              onAssignTenant={() => openAssignModal(room)}
              onCheckout={handleCheckout}
              onSetPrimary={handleSetPrimary}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal-100">
                <th className="text-left px-6 py-4 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Phòng</th>
                <th className="text-left px-6 py-4 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Trạng thái</th>
                <th className="text-right px-6 py-4 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Giá thuê</th>
                <th className="text-right px-6 py-4 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Diện tích</th>
                <th className="text-left px-6 py-4 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Khách thuê</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-50">
              {filteredRooms.map((room) => {
                const variants: Record<string, 'success' | 'info' | 'default'> = { available: 'success', occupied: 'info', maintenance: 'default' };
                return (
                  <tr key={room.id} className="hover:bg-cream-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-charcoal-900">P. {room.room_number}</p>
                      <p className="text-sm text-charcoal-400">Tầng {room.floor}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={room.status} variant={variants[room.status] || 'default'} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-terra-600">
                      {room.monthly_rent.toLocaleString('vi-VN')}đ
                    </td>
                    <td className="px-6 py-4 text-right text-charcoal-600">
                      {room.area_sqm} m²
                    </td>
                    <td className="px-6 py-4">
                      {room.status === 'occupied' && (room.active_assignments?.length ?? 0) > 0 ? (
                        <div>
                          <p className="font-medium text-charcoal-900">
                            {room.active_assignments?.find(a => a.is_primary)?.tenant?.full_name || room.active_assignments?.[0]?.tenant?.full_name || 'Khách thuê'}
                          </p>
                          <p className="text-xs text-charcoal-400">{room.active_assignments?.length} người đang ở</p>
                        </div>
                      ) : (
                        <span className="text-sm text-charcoal-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openDetailModal(room)} className="p-2 text-charcoal-400 hover:text-charcoal-600 hover:bg-charcoal-50 rounded-lg" title="Chi tiết">
                          <Info className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEditModal(room)} className="p-2 text-charcoal-400 hover:text-terra-600 hover:bg-terra-50 rounded-lg" title="Sửa">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => openDeleteModal(room)} className="p-2 text-charcoal-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg" title="Xóa">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Room Detail Modal */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Chi tiết phòng ${viewingRoom?.room_number}`} size="lg">
        {viewingRoom && (
          <div className="p-6 space-y-6">
            {/* Room Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Trạng thái</p>
                <Badge status={viewingRoom.status} variant={
                  viewingRoom.status === 'available' ? 'success' : viewingRoom.status === 'occupied' ? 'info' : 'default'
                } />
              </div>
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Tầng</p>
                <p className="font-semibold text-charcoal-900">Tầng {viewingRoom.floor}</p>
              </div>
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Diện tích</p>
                <p className="font-semibold text-charcoal-900">{viewingRoom.area_sqm} m²</p>
              </div>
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Giá thuê/tháng</p>
                <p className="font-semibold text-terra-600">{viewingRoom.monthly_rent.toLocaleString('vi-VN')}đ</p>
              </div>
            </div>

            {/* Capacity */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-charcoal-700">Người đang ở</p>
                <p className="text-sm text-charcoal-500">
                  {viewingRoom.active_assignments?.length || 0}/{viewingRoom.max_occupants} người
                </p>
              </div>
              <div className="h-2 bg-charcoal-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-terra-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((viewingRoom.active_assignments?.length || 0) / (viewingRoom.max_occupants || 1)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Occupants */}
            {(viewingRoom.active_assignments?.length ?? 0) > 0 ? (
              <div>
                <p className="text-sm font-medium text-charcoal-700 mb-3">Danh sách người ở</p>
                <div className="space-y-3">
                  {viewingRoom.active_assignments!.map((assignment) => (
                    <div key={assignment.id} className="bg-white border border-charcoal-100 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            assignment.is_primary ? 'bg-amber-100' : 'bg-charcoal-50'
                          }`}>
                            {assignment.is_primary
                              ? <Crown className="w-5 h-5 text-amber-600" />
                              : <User className="w-5 h-5 text-charcoal-400" />
                            }
                          </div>
                          <div>
                            <p className="font-semibold text-charcoal-900">{assignment.tenant?.full_name}</p>
                            <p className={`text-xs font-medium ${assignment.is_primary ? 'text-amber-600' : 'text-charcoal-400'}`}>
                              {assignment.is_primary ? 'Chủ hợp đồng' : 'Người ở cùng'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-charcoal-100">
                        <div className="flex items-center gap-2 text-sm text-charcoal-500">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span>Vào ở: <span className="font-medium text-charcoal-700">{new Date(assignment.start_date).toLocaleDateString('vi-VN')}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-charcoal-500">
                          <Banknote className="w-4 h-4 shrink-0" />
                          <span>Cọc: <span className="font-medium text-charcoal-700">{Number(assignment.deposit_amount).toLocaleString('vi-VN')}đ</span></span>
                        </div>
                        {/* Contract end date - always shown */}
                        <div className="col-span-2 flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 text-charcoal-500">
                            <CalendarDays className="w-4 h-4 shrink-0 text-terra-500" />
                            {assignment.contract_end_date ? (
                              <span>Hết hạn HĐ: <span className="font-medium text-charcoal-700">{new Date(assignment.contract_end_date).toLocaleDateString('vi-VN')}</span></span>
                            ) : (
                              <span className="text-charcoal-400 italic">Chưa đặt ngày kết thúc HĐ</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {assignment.contract_end_date && (() => {
                              const daysLeft = Math.ceil((new Date(assignment.contract_end_date).getTime() - new Date().getTime()) / 86400000);
                              if (daysLeft <= 0) return <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">Đã hết hạn</span>;
                              if (daysLeft <= 30) return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">Còn {daysLeft} ngày</span>;
                              return null;
                            })()}
                            <button
                              onClick={() => openExtendModal(assignment)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-terra-600 bg-terra-50 hover:bg-terra-100 rounded-lg transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" />
                              {assignment.contract_end_date ? 'Gia hạn' : 'Đặt ngày'}
                            </button>
                          </div>
                        </div>
                        {assignment.notes && (
                          <div className="col-span-2 flex items-start gap-2 text-sm text-charcoal-500">
                            <Info className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{assignment.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-charcoal-400">Phòng hiện chưa có người ở</p>
              </div>
            )}

            {viewingRoom.description && (
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-2">Ghi chú</p>
                <p className="text-charcoal-700 text-sm">{viewingRoom.description}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-charcoal-100">
              <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>Đóng</Button>
              <Button onClick={() => { setIsDetailModalOpen(false); openEditModal(viewingRoom); }}>
                <Edit2 className="w-4 h-4" />Sửa thông tin
              </Button>
              {viewingRoom.status !== 'maintenance' && (viewingRoom.active_assignments?.length ?? 0) < (viewingRoom.max_occupants ?? 2) && (
                <Button variant="secondary" onClick={() => { setIsDetailModalOpen(false); openAssignModal(viewingRoom); }}>
                  <UserPlus className="w-4 h-4" />Thêm người
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRoom ? 'Sửa thông tin phòng' : 'Thêm phòng mới'} size="md">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Số phòng" name="room_number" value={formData.room_number} onChange={(v) => setFormData({ ...formData, room_number: v })} required placeholder="VD: 101" />
            <Input label="Tầng (tối đa 50)" name="floor" type="number" value={formData.floor} onChange={(v) => setFormData({ ...formData, floor: Math.min(parseInt(v) || 1, 50) })} min={1} max={50} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Diện tích (m²)" name="area_sqm" type="number" value={formData.area_sqm} onChange={(v) => setFormData({ ...formData, area_sqm: v })} min={0} step={0.1} />
            <Input label="Giá thuê/tháng (VNĐ)" name="monthly_rent" type="number" value={formData.monthly_rent} onChange={(v) => setFormData({ ...formData, monthly_rent: v })} min={0} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Sức chứa (người)" name="max_occupants" type="number" value={formData.max_occupants} onChange={(v) => setFormData({ ...formData, max_occupants: parseInt(v) || 2 })} min={1} max={10} required />
            <Input label="Trạng thái" name="status" type="select" value={formData.status} onChange={(v) => setFormData({ ...formData, status: v as 'available' | 'occupied' | 'maintenance' })}
              options={[{ value: 'available', label: 'Trống' }, { value: 'occupied', label: 'Đang thuê' }, { value: 'maintenance', label: 'Bảo trì' }]} />
          </div>
          <Input label="Ghi chú" name="description" type="textarea" value={formData.description} onChange={(v) => setFormData({ ...formData, description: v })} placeholder="Mô tả thêm về phòng..." rows={2} />
          <div className="flex gap-3 pt-5 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editingRoom ? 'Cập nhật' : 'Thêm mới'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Xác nhận xóa" size="sm">
        <div className="p-6">
          <p className="text-charcoal-600">Bạn có chắc muốn xóa phòng <strong className="text-charcoal-900">{deletingRoom?.room_number}</strong>? Hành động này không thể hoàn tác.</p>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={handleDelete}>Xóa phòng</Button>
          </div>
        </div>
      </Modal>

      {/* Assign Tenant Modal */}
      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title={`Thêm người vào phòng ${assigningRoom?.room_number}`} size="md">
        <form onSubmit={handleAssign} className="p-6 space-y-5">
          {availableForAssign.length === 0 ? (
            <div className="py-8 text-center text-charcoal-500">Không còn người thuê nào chưa vào phòng này.</div>
          ) : (
            <>
              <Input label="Chọn người thuê" name="tenant_id" type="select" value={assignData.tenant_id} onChange={(v) => setAssignData({ ...assignData, tenant_id: v })} required
                options={[{ value: '', label: '-- Chọn người thuê --' }, ...availableForAssign.map((t) => ({ value: t.id, label: t.full_name }))]} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Ngày bắt đầu thuê" name="start_date" type="date" value={assignData.start_date} onChange={(v) => setAssignData({ ...assignData, start_date: v })} required />
                <Input label="Tiền cọc (VNĐ)" name="deposit_amount" type="number" value={assignData.deposit_amount} onChange={(v) => setAssignData({ ...assignData, deposit_amount: v })} min={0} />
              </div>
              <Input label="Ngày kết thúc hợp đồng" name="contract_end_date" type="date" value={assignData.contract_end_date} onChange={(v) => setAssignData({ ...assignData, contract_end_date: v })} />
              {assignData.contract_end_date && (
                <div className="flex items-center gap-2 text-sm text-charcoal-500 bg-amber-50 px-4 py-2.5 rounded-xl">
                  <CalendarDays className="w-4 h-4 text-amber-500" />
                  <span>Hợp đồng hết hạn: {new Date(assignData.contract_end_date).toLocaleDateString('vi-VN')}</span>
                </div>
              )}
              <div className="flex items-center gap-3 p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <input
                  type="checkbox"
                  id="is_primary"
                  checked={assignData.is_primary}
                  onChange={(e) => setAssignData({ ...assignData, is_primary: e.target.checked })}
                  className="w-4 h-4 text-terra-500 rounded border-charcoal-300 focus:ring-terra-400"
                />
                <label htmlFor="is_primary" className="flex items-center gap-2 text-sm font-medium text-charcoal-700 cursor-pointer">
                  <Crown className="w-4 h-4 text-amber-500" />
                  Là chủ hợp đồng (người đại diện ký hợp đồng)
                </label>
              </div>
              <Input label="Ghi chú" name="notes" type="textarea" value={assignData.notes} onChange={(v) => setAssignData({ ...assignData, notes: v })} rows={2} />
              <div className="flex gap-3 pt-5 border-t border-charcoal-100">
                <Button type="button" variant="secondary" onClick={() => setIsAssignModalOpen(false)}>Hủy</Button>
                <Button type="submit" disabled={saving || !assignData.tenant_id}>{saving ? 'Đang xử lý...' : 'Xác nhận'}</Button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Extend Contract Modal */}
      <Modal isOpen={isExtendModalOpen} onClose={() => setIsExtendModalOpen(false)} title="Gia hạn hợp đồng" size="sm">
        <form onSubmit={(e) => { e.preventDefault(); handleExtendContract(); }} className="p-6 space-y-5">
          <div className="flex items-center gap-3 p-4 bg-charcoal-50 rounded-xl">
            <User className="w-5 h-5 text-charcoal-500" />
            <div>
              <p className="font-medium text-charcoal-900">{extendingAssignment?.tenant?.full_name}</p>
              <p className="text-sm text-charcoal-500">Phòng {extendingAssignment?.room?.room_number}</p>
            </div>
          </div>
          <Input
            label="Ngày kết thúc hợp đồng mới"
            name="contract_end_date"
            type="date"
            value={extendData.contract_end_date}
            onChange={(v) => setExtendData({ contract_end_date: v })}
            required
          />
          <div className="flex gap-3 pt-5 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsExtendModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Xác nhận gia hạn'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PropertyCard({
  room,
  onView,
  onEdit,
  onDelete,
  onAssignTenant,
  onCheckout,
  onSetPrimary,
}: {
  room: Room;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssignTenant: () => void;
  onCheckout: (a: RoomAssignment) => void;
  onSetPrimary: (a: RoomAssignment, roomId: string) => void;
}) {
  const statusConfig = {
    available: { variant: 'success' as const, bg: 'bg-sage-50', iconBg: 'bg-sage-100 text-sage-600' },
    occupied: { variant: 'info' as const, bg: 'bg-terra-50', iconBg: 'bg-terra-100 text-terra-600' },
    maintenance: { variant: 'default' as const, bg: 'bg-charcoal-50', iconBg: 'bg-charcoal-100 text-charcoal-500' },
  };

  const config = statusConfig[room.status];
  const currentOccupants = room.active_assignments?.length || 0;
  const maxOccupants = room.max_occupants || 2;
  const isFull = currentOccupants >= maxOccupants;
  const isMaintenance = room.status === 'maintenance';
  const isOccupied = currentOccupants > 0;

  return (
    <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden">
      {/* Header — clickable to view detail */}
      <div
        onClick={onView}
        className={`${config.bg} px-6 py-5 border-b border-charcoal-100 cursor-pointer hover:brightness-[0.97] transition-all`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.iconBg}`}>
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-charcoal-900">{room.room_number}</h3>
              <p className="text-sm text-charcoal-400">Tầng {room.floor}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={room.status} variant={config.variant} size="sm" />
            <div className="w-7 h-7 rounded-lg bg-white/60 flex items-center justify-center">
              <Info className="w-3.5 h-3.5 text-charcoal-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-4">
        {/* Key Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium">Diện tích</p>
            <p className="text-lg font-semibold text-charcoal-900 mt-1">{room.area_sqm} m²</p>
          </div>
          <div>
            <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium">Giá thuê</p>
            <p className="text-lg font-semibold text-terra-600 mt-1">{room.monthly_rent.toLocaleString('vi-VN')}đ</p>
          </div>
        </div>

        {/* Occupancy */}
        <div className="pt-4 border-t border-charcoal-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium">Sức chứa</p>
            <p className={`text-sm font-medium ${isFull ? 'text-amber-600' : 'text-charcoal-600'}`}>
              {currentOccupants}/{maxOccupants} người
            </p>
          </div>
          <div className="h-2 bg-charcoal-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isFull ? 'bg-amber-400' : 'bg-terra-400'}`}
              style={{ width: `${(currentOccupants / maxOccupants) * 100}%` }}
            />
          </div>
        </div>

        {/* Tenants */}
        {room.active_assignments && room.active_assignments.length > 0 && (
          <div className="pt-4 border-t border-charcoal-100 space-y-2">
            {room.active_assignments.map((assignment) => {
              const contractEndDate = assignment.contract_end_date ? new Date(assignment.contract_end_date) : null;
              const today = new Date();
              const daysUntilExpiry = contractEndDate ? Math.ceil((contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;

              return (
                <div key={assignment.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    {assignment.is_primary ? (
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Crown className="w-4 h-4 text-amber-600" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-charcoal-50 flex items-center justify-center">
                        <User className="w-4 h-4 text-charcoal-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-charcoal-900">{assignment.tenant?.full_name}</p>
                      <div className="flex items-center gap-2">
                        {assignment.is_primary && (
                          <p className="text-xs text-amber-600 font-medium">Chủ hợp đồng</p>
                        )}
                        {isExpiringSoon && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            Còn {daysUntilExpiry} ngày
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!assignment.is_primary && (
                      <button
                        onClick={() => onSetPrimary(assignment, room.id)}
                        className="p-1.5 rounded-lg text-charcoal-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                        title="Đặt làm chủ hợp đồng"
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onCheckout(assignment)}
                      className="p-1.5 rounded-lg text-charcoal-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      title="Trả phòng"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-charcoal-50/30 border-t border-charcoal-100 flex items-center justify-between">
        <button
          onClick={onAssignTenant}
          disabled={isMaintenance || isFull}
          title={isMaintenance ? 'Phòng đang bảo trì' : isFull ? 'Phòng đã đầy' : 'Thêm người'}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
            isMaintenance || isFull
              ? 'text-charcoal-300 bg-charcoal-50 cursor-not-allowed'
              : 'text-terra-600 bg-terra-50 hover:bg-terra-100'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Thêm người
        </button>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-2 rounded-xl text-charcoal-400 hover:text-charcoal-600 hover:bg-white transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isOccupied}
            title={isOccupied ? 'Không thể xóa khi có người đang ở' : 'Xóa phòng'}
            className={`p-2 rounded-xl transition-colors ${
              isOccupied
                ? 'text-charcoal-200 cursor-not-allowed'
                : 'text-charcoal-400 hover:text-rose-500 hover:bg-rose-50'
            }`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
