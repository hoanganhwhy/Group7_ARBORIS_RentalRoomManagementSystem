import { useEffect, useState } from 'react';
import {
  Plus,
  Wrench,
  Edit2,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  Calendar,
  MessageCircle,
  X,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import {
  getRepairRequests,
  createRepairRequest,
  updateRepairRequest,
  deleteRepairRequest,
  getRooms,
  getTenants,
} from '../lib/api';
import type { RepairRequest, Room, Tenant } from '../types';

export function Repairs() {
  const { user } = useAuth();
  const isTenant = user?.role === 'TENANT';
  const [repairs, setRepairs] = useState<RepairRequest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairRequest | null>(null);
  const [viewingRepair, setViewingRepair] = useState<RepairRequest | null>(null);
  const [deletingRepair, setDeletingRepair] = useState<RepairRequest | null>(null);
  const [filter, setFilter] = useState<'new' | 'in_progress' | 'resolved' | 'closed'>('new');
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterYear, setFilterYear] = useState<number>(0);
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  const [formData, setFormData] = useState({
    room_id: '',
    tenant_id: '',
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    status: 'new' as 'new' | 'in_progress' | 'resolved' | 'closed',
    assigned_to: '',
    resolution_notes: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [repairsData, roomsData, tenantsData] = await Promise.all([
        getRepairRequests(), getRooms(), getTenants(),
      ]);
      setRepairs(repairsData);
      setRooms(roomsData);
      setTenants(tenantsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingRepair(null);
    let defaultRoom = '';
    let defaultTenant = '';
    if (isTenant) {
      defaultTenant = user?.tenant_id || '';
      const tenantRoom = rooms.find(r => r.active_assignments?.some(a => a.tenant_id === defaultTenant));
      defaultRoom = tenantRoom?.id || '';
    }
    setFormData({ room_id: defaultRoom, tenant_id: defaultTenant, title: '', description: '', priority: 'medium', status: 'new', assigned_to: '', resolution_notes: '' });
    setIsModalOpen(true);
  }

  function openEditModal(repair: RepairRequest, e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditingRepair(repair);
    setFormData({
      room_id: repair.room_id,
      tenant_id: repair.tenant_id || '',
      title: repair.title,
      description: repair.description || '',
      priority: repair.priority,
      status: repair.status,
      assigned_to: repair.assigned_to || '',
      resolution_notes: repair.resolution_notes || '',
    });
    setIsModalOpen(true);
  }

  function openDetailModal(repair: RepairRequest) {
    setViewingRepair(repair);
    setIsDetailModalOpen(true);
  }

  function openDeleteModal(repair: RepairRequest, e?: React.MouseEvent) {
    e?.stopPropagation();
    setDeletingRepair(repair);
    setIsDeleteModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.tenant_id) {
      alert('Vui lòng chọn người báo (người thuê đăng ký ở phòng này).');
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...formData,
        tenant_id: formData.tenant_id,
        resolved_at: (formData.status === 'resolved' || formData.status === 'closed')
          ? new Date().toISOString() : null,
      };
      if (editingRepair) {
        await updateRepairRequest(editingRepair.id, data);
      } else {
        await createRepairRequest(data);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Failed to save repair request:', error);
      const msg = error?.response?.data?.error || error?.message || 'Không thể lưu yêu cầu. Vui lòng thử lại.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingRepair) return;
    try {
      await deleteRepairRequest(deletingRepair.id);
      await loadData();
      setIsDeleteModalOpen(false);
    } catch (error) {
      alert('Không thể xóa yêu cầu.');
    }
  }

  async function handleStatusChange(repair: RepairRequest, newStatus: 'in_progress' | 'resolved' | 'closed') {
    try {
      await updateRepairRequest(repair.id, {
        status: newStatus,
        resolved_at: (newStatus === 'resolved' || newStatus === 'closed') ? new Date().toISOString() : null,
      });
      await loadData();
      // Refresh the viewing repair if detail modal is open
      if (viewingRepair?.id === repair.id) {
        setIsDetailModalOpen(false);
      }
    } catch (error) {
      alert('Không thể cập nhật trạng thái.');
    }
  }

  const userRepairs = isTenant
    ? repairs.filter(r => r.tenant_id === user?.tenant_id)
    : repairs;

  const filteredRepairs = userRepairs.filter((repair) => {
    const matchesStatus = repair.status === filter;
    
    // Parse reported_at date
    const d = new Date(repair.reported_at);
    const matchesYear = filterYear === 0 || d.getFullYear() === filterYear;
    const matchesMonth = filterMonth === 0 || (d.getMonth() + 1) === filterMonth;
    const matchesFloor = filterFloor === 'all' || (repair.room && repair.room.floor.toString() === filterFloor);
    const matchesArea = filterArea === 'all' || (repair.room && repair.room.area === filterArea);
    const matchesDate = !filterDate || repair.reported_at.startsWith(filterDate);

    return matchesStatus && matchesYear && matchesMonth && matchesFloor && matchesArea && matchesDate;
  });

  const statusCounts = {
    new: userRepairs.filter((r) => r.status === 'new').length,
    in_progress: userRepairs.filter((r) => r.status === 'in_progress').length,
    resolved: userRepairs.filter((r) => r.status === 'resolved').length,
    closed: userRepairs.filter((r) => r.status === 'closed').length,
  };

  // Only tenants currently in the selected room can report a repair
  const tenantsInSelectedRoom = (() => {
    if (!formData.room_id) return [];
    const room = rooms.find((r) => r.id.toString() === formData.room_id.toString());
    return (room?.active_assignments ?? [])
      .map((a) => a.tenant)
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
  })();

  if (loading) return <Spinner />;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-charcoal-900 tracking-tight">Yêu cầu sửa chữa</h1>
          <p className="text-charcoal-400 mt-2 text-base">Quản lý và theo dõi các yêu cầu bảo trì</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4" />
          Tạo yêu cầu
        </Button>
      </header>

      {/* Filters */}
      <section className="space-y-4">
        <div className="flex gap-2 items-center flex-wrap">
          {(['new', 'in_progress', 'resolved', 'closed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                filter === status
                  ? 'bg-white text-charcoal-900 shadow-card border border-charcoal-100'
                  : 'text-charcoal-400 hover:text-charcoal-600 hover:bg-white/50'
              }`}
            >
              {status === 'new' && 'Mới tạo'}
              {status === 'in_progress' && 'Đang xử lý'}
              {status === 'resolved' && 'Đã xong'}
              {status === 'closed' && 'Lịch sử'}
              <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                filter === status ? 'bg-terra-100 text-terra-700' : 'bg-charcoal-100 text-charcoal-500'
              }`}>{statusCounts[status]}</span>
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-4 flex-wrap bg-white p-3 rounded-xl border border-charcoal-100 shadow-sm">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors"
            title="Lọc theo ngày báo cáo"
          />
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors"
          >
            <option value="all">Tất cả khu vực</option>
            {Array.from(new Set(rooms.map(r => r.area).filter(Boolean))).sort().map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors"
          >
            <option value="all">Tất cả tầng</option>
            {Array.from(new Set(rooms.map(r => r.floor))).sort((a,b)=>Number(a)-Number(b)).map(f => (
              <option key={f} value={f}>Tầng {f}</option>
            ))}
          </select>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors"
          >
            <option value={0}>Tất cả tháng</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors"
          >
            <option value={0}>Tất cả năm</option>
            {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </section>

      {filteredRepairs.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-8 h-8" />}
          title="Không có yêu cầu nào"
          description={filter === 'all' ? 'Chưa có yêu cầu sửa chữa nào' : 'Không có yêu cầu nào ở trạng thái này'}
          action={filter === 'all' ? <Button onClick={openCreateModal}><Plus className="w-4 h-4" />Tạo yêu cầu</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filteredRepairs.map((repair) => (
            <RepairCard
              key={repair.id}
              repair={repair}
              onView={() => openDetailModal(repair)}
              onEdit={(e) => openEditModal(repair, e)}
              onDelete={(e) => openDeleteModal(repair, e)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRepair ? 'Sửa yêu cầu' : 'Tạo yêu cầu sửa chữa'} size="lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input label="Tiêu đề" name="title" value={formData.title} onChange={(v) => setFormData({ ...formData, title: v })} required placeholder="VD: Bóng đèn bị hỏng" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Chọn phòng" name="room_id" type="select" value={formData.room_id}
              onChange={(v) => {
                const room = rooms.find((r) => r.id.toString() === v.toString());
                const primaryTenant = room?.active_assignments?.find((a) => a.is_primary)?.tenant;
                setFormData({ ...formData, room_id: v, tenant_id: primaryTenant?.id || '' });
              }}
              required
              disabled={isTenant}
              options={[{ value: '', label: '-- Chọn phòng --' }, ...rooms.map((r) => ({ value: r.id, label: `Phòng ${r.room_number}` }))]}
            />
            {!isTenant && (
              <Input label="Người báo (Bắt buộc)" name="tenant_id" type="select" value={formData.tenant_id}
                onChange={(v) => setFormData({ ...formData, tenant_id: v })}
                disabled={!formData.room_id}
                required
                options={[
                  {
                    value: '',
                    label: !formData.room_id
                      ? '-- Chọn phòng trước --'
                      : tenantsInSelectedRoom.length === 0
                      ? '-- Không có người ở phòng này --'
                      : '-- Chọn người báo --',
                  },
                  ...tenantsInSelectedRoom.map((t) => ({ value: t.id, label: t.full_name })),
                ]}
              />
            )}
          </div>
          <Input label="Mô tả chi tiết" name="description" type="textarea" value={formData.description} onChange={(v) => setFormData({ ...formData, description: v })} placeholder="Mô tả chi tiết sự cố..." rows={3} />
          {!isTenant && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Mức độ ưu tiên" name="priority" type="select" value={formData.priority}
                  onChange={(v) => setFormData({ ...formData, priority: v as 'low' | 'medium' | 'high' | 'urgent' })}
                  options={[{ value: 'low', label: 'Thấp' }, { value: 'medium', label: 'Trung bình' }, { value: 'high', label: 'Cao' }, { value: 'urgent', label: 'Khẩn cấp' }]}
                />
                <Input label="Trạng thái" name="status" type="select" value={formData.status}
                  onChange={(v) => setFormData({ ...formData, status: v as 'new' | 'in_progress' | 'resolved' | 'closed' })}
                  options={[{ value: 'new', label: 'Mới tạo' }, { value: 'in_progress', label: 'Đang xử lý' }, { value: 'resolved', label: 'Đã xong' }, { value: 'closed', label: 'Lịch sử' }]}
                />
              </div>
              <Input label="Người phụ trách" name="assigned_to" value={formData.assigned_to} onChange={(v) => setFormData({ ...formData, assigned_to: v })} placeholder="VD: Nguyễn Văn A" />
              {(formData.status === 'resolved' || formData.status === 'closed') && (
                <Input label="Ghi chú xử lý" name="resolution_notes" type="textarea" value={formData.resolution_notes} onChange={(v) => setFormData({ ...formData, resolution_notes: v })} placeholder="Mô tả cách xử lý..." rows={2} />
              )}
            </>
          )}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editingRepair ? 'Cập nhật' : 'Tạo yêu cầu'}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Chi tiết yêu cầu" size="lg">
        {viewingRepair && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <PriorityIcon priority={viewingRepair.priority} />
              <h3 className="text-xl font-bold text-slate-900 flex-1">{viewingRepair.title}</h3>
              <StatusBadge status={viewingRepair.status} />
            </div>

            {viewingRepair.description && (
              <div className="p-4 bg-cream-50 rounded-xl">
                <p className="text-charcoal-700">{viewingRepair.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-charcoal-500" />
                </div>
                <div>
                  <p className="text-xs text-charcoal-400">Phòng</p>
                  <p className="font-medium text-charcoal-900">{viewingRepair.room?.room_number}</p>
                </div>
              </div>
              {viewingRepair.tenant && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-charcoal-500" />
                  </div>
                  <div>
                    <p className="text-xs text-charcoal-400">Người báo</p>
                    <p className="font-medium text-charcoal-900">{viewingRepair.tenant.full_name}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-charcoal-500" />
                </div>
                <div>
                  <p className="text-xs text-charcoal-400">Ngày báo</p>
                  <p className="font-medium text-charcoal-900">{new Date(viewingRepair.reported_at).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
              {viewingRepair.assigned_to && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-charcoal-500" />
                  </div>
                  <div>
                    <p className="text-xs text-charcoal-400">Người phụ trách</p>
                    <p className="font-medium text-charcoal-900">{viewingRepair.assigned_to}</p>
                  </div>
                </div>
              )}
            </div>

            {viewingRepair.resolution_notes && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-charcoal-400" />
                  <p className="text-sm font-medium text-charcoal-600">Ghi chú xử lý</p>
                </div>
                <div className="p-3 bg-sage-50 rounded-xl border border-sage-200">
                  <p className="text-sage-800">{viewingRepair.resolution_notes}</p>
                </div>
              </div>
            )}

            {!isTenant && (
              <div className="flex gap-2 pt-5 border-t border-charcoal-100 flex-wrap">
                {viewingRepair.status === 'new' && (
                  <Button onClick={() => handleStatusChange(viewingRepair, 'in_progress')}>
                    <Clock className="w-4 h-4" />Bắt đầu xử lý
                  </Button>
                )}
                {viewingRepair.status === 'in_progress' && (
                  <Button variant="success" onClick={() => handleStatusChange(viewingRepair, 'resolved')}>
                    <CheckCircle className="w-4 h-4" />Đã hoàn thành
                  </Button>
                )}
                {viewingRepair.status === 'resolved' && (
                  <Button variant="secondary" onClick={() => handleStatusChange(viewingRepair, 'closed')}>
                    <X className="w-4 h-4" />Đóng yêu cầu
                  </Button>
                )}
                <Button variant="ghost" onClick={() => { setIsDetailModalOpen(false); openEditModal(viewingRepair); }}>
                  <Edit2 className="w-4 h-4" />Sửa
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Xác nhận xóa" size="sm">
        <div className="p-6">
          <p className="text-slate-600">Bạn có chắc muốn xóa yêu cầu <strong>{deletingRepair?.title}</strong>?</p>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={handleDelete}>Xóa</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RepairCard({
  repair,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  repair: RepairRequest;
  onView: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onStatusChange: (r: RepairRequest, s: 'in_progress' | 'resolved' | 'closed') => void;
}) {
  const priorityColors: Record<string, { bg: string; text: string; dot: string }> = {
    low: { bg: 'bg-charcoal-50', text: 'text-charcoal-500', dot: 'bg-charcoal-300' },
    medium: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
    high: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
    urgent: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-400' },
  };

  const priority = priorityColors[repair.priority] || priorityColors.medium;

  return (
    <div
      onClick={onView}
      className="bg-white rounded-2xl border border-charcoal-100 shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer overflow-hidden group"
    >
      <div className="px-7 py-6">
        <div className="flex items-start gap-5">
          {/* Priority indicator */}
          <div className={`w-1 h-16 rounded-full ${priority.dot} shrink-0`} />

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-charcoal-900">{repair.title}</h3>
                  <StatusBadge status={repair.status} />
                </div>
                {repair.description && (
                  <p className="text-charcoal-400 text-sm line-clamp-2 leading-relaxed">{repair.description}</p>
                )}
              </div>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-6 text-sm text-charcoal-400">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-charcoal-50 flex items-center justify-center">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <span>Phòng {repair.room?.room_number}</span>
              </div>
              {repair.tenant && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-charcoal-50 flex items-center justify-center">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span>{repair.tenant.full_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-charcoal-50 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <span>{new Date(repair.reported_at).toLocaleDateString('vi-VN')}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {repair.status === 'new' && (
              <button onClick={(e) => { e.stopPropagation(); onStatusChange(repair, 'in_progress'); }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-terra-600 bg-terra-50 hover:bg-terra-100 rounded-xl transition-colors">
                <Clock className="w-4 h-4" />Bắt đầu
              </button>
            )}
            {repair.status === 'in_progress' && (
              <button onClick={(e) => { e.stopPropagation(); onStatusChange(repair, 'resolved'); }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-sage-600 bg-sage-50 hover:bg-sage-100 rounded-xl transition-colors">
                <CheckCircle className="w-4 h-4" />Hoàn thành
              </button>
            )}
            <button onClick={onEdit} className="p-2.5 rounded-xl text-charcoal-400 hover:text-charcoal-600 hover:bg-charcoal-50 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2.5 rounded-xl text-charcoal-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'info' | 'warning' | 'success' | 'default'> = {
    new: 'info', in_progress: 'warning', resolved: 'success', closed: 'default',
  };
  return <Badge status={status} variant={variants[status]} />;
}

function PriorityIcon({ priority }: { priority: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    low: { label: 'Thấp', bg: 'bg-charcoal-100', text: 'text-charcoal-500' },
    medium: { label: 'Trung bình', bg: 'bg-blue-100', text: 'text-blue-600' },
    high: { label: 'Cao', bg: 'bg-amber-100', text: 'text-amber-600' },
    urgent: { label: 'Khẩn cấp', bg: 'bg-rose-100', text: 'text-rose-600' },
  };
  const c = config[priority] || config.medium;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${c.bg} ${c.text}`}>
      <AlertTriangle className="w-4 h-4 mr-1.5" />
      {c.label}
    </span>
  );
}
