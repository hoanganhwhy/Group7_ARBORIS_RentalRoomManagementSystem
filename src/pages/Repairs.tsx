import { useEffect, useState } from 'react';
import { PiPlusLight, PiWrenchLight, PiPencilSimpleLight, PiTrashLight, PiClockLight, PiCheckCircleLight, PiWarningLight, PiUserLight, PiCalendarBlankLight, PiChatCircleLight, PiXLight } from 'react-icons/pi';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';
import {
  getRepairRequests,
  createRepairRequest,
  updateRepairRequest,
  deleteRepairRequest,
  getRooms,
  getTenants,
} from '../lib/api';
import type { RepairRequest, Room, Tenant } from '../types';
import { useAuth } from '../context/AuthContext';

export function Repairs() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
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
  const [filter, setFilter] = useState<'all' | 'new' | 'in_progress' | 'resolved' | 'closed'>('all');

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
      setRepairs(repairsData?.data || repairsData || []);
      setRooms(roomsData?.data || roomsData || []);
      setTenants(tenantsData?.data || tenantsData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingRepair(null);
    setFormData({ room_id: '', tenant_id: '', title: '', description: '', priority: 'medium', status: 'new', assigned_to: '', resolution_notes: '' });
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
      alert('Vui lòng chọnngười báo (người thuê đăng ký ở phòng này).');
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
      const msg = error?.response?.data?.error || error?.message || 'Không thỒ lưu yêu cầu. Vui lòng thử lại.';
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
      alert('Không thỒ xóa yêu cầu.');
    }
  }

  async function handleStatusChange(repair: RepairRequest, newStatus: 'in_progress' | 'resolved' | 'closed') {
    try {
      const updatedRepairData = {
        status: newStatus,
        resolved_at: (newStatus === 'resolved' || newStatus === 'closed') ? new Date().toISOString() : null,
      };
      await updateRepairRequest(repair.id, updatedRepairData);
      await loadData();
      
      // Update viewingRepair immediately so the UI reflects the change
      if (viewingRepair?.id === repair.id) {
        setViewingRepair({ ...repair, ...updatedRepairData } as RepairRequest);
      }
    } catch (error) {
      alert('Không thể cập nhật trạng thái.');
    }
  }

  const filteredRepairs = repairs.filter((r) => filter === 'all' || r.status === filter);

  const statusCounts = {
    all: repairs.length,
    new: repairs.filter((r) => r.status === 'new').length,
    in_progress: repairs.filter((r) => r.status === 'in_progress').length,
    resolved: repairs.filter((r) => r.status === 'resolved').length,
    closed: repairs.filter((r) => r.status === 'closed').length,
  };

  // Only tenants currently in the selected room can report a repair
  const tenantsInSelectedRoom = (() => {
    if (!formData.room_id) return [];
    const room = rooms.find((r) => r.id === formData.room_id);
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
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Sửa chữa</h1>
          <p className="text-charcoal-400 mt-2 text-sm">Quản lý và theo dõi các yêu cầu bảo trì</p>
        </div>
        <Button onClick={openCreateModal}>
          <PiPlusLight className="w-4 h-4" />
          Tạo yêu cầu
        </Button>
      </header>

      {/* Filters */}
      <section className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'new', 'in_progress', 'resolved', 'closed'] as const).map((status) => (
            <button key={status} onClick={() => setFilter(status)}
              className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                filter === status
                  ? 'bg-white text-charcoal-900 shadow-card border border-charcoal-100'
                  : 'text-charcoal-400 hover:text-charcoal-600 hover:bg-white/50'
              }`}
            >
              {status === 'all' && 'Tất cả'}
              {status === 'new' && 'Mới'}
              {status === 'in_progress' && 'Đang xử lý'}
              {status === 'resolved' && 'Đã xong'}
              {status === 'closed' && 'Đã đóng'}
              <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                filter === status ? 'bg-wood-100 text-wood-700' : 'bg-charcoal-100 text-charcoal-500'
              }`}>{statusCounts[status]}</span>
            </button>
          ))}
        </div>
      </section>

      {filteredRepairs.length === 0 ? (
        <EmptyState
          icon={<PiWrenchLight className="w-8 h-8" />}
          title="Không có yêu cầu nào"
          description={filter === 'all' ? 'Chưa có yêu cầu sửa chữa nào' : 'Không có yêu cầu nào ở trạng thái này'}
          action={filter === 'all' ? <Button onClick={openCreateModal}><PiPlusLight className="w-4 h-4" />Tạo yêu cầu</Button> : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cream-50/50 border-b border-cream-200 text-xs uppercase tracking-widest text-charcoal-500 font-semibold">
                <th className="px-4 py-3">Phòng</th>
                <th className="px-4 py-3">Yêu cầu</th>
                <th className="px-4 py-3 text-center">Mức độ</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3">Ngày báo</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {filteredRepairs.map((repair) => {
                const priorityColors: Record<string, { bg: string; text: string; label: string }> = {
                  low: { bg: 'bg-charcoal-50', text: 'text-charcoal-500', label: 'Thấp' },
                  medium: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Trung bình' },
                  high: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Cao' },
                  urgent: { bg: 'bg-rose-50', text: 'text-rose-600', label: 'Khẩn cấp' },
                };
                const priority = priorityColors[repair.priority] || priorityColors.medium;
                return (
                  <tr key={repair.id} onClick={() => openDetailModal(repair)} className="hover:bg-cream-50/50 transition-colors group cursor-pointer">
                    <td className="px-4 py-3 align-middle">
                      <p className="font-serif font-medium text-wood-700 text-[15px]">P.{repair.room?.room_number}</p>
                      <p className="text-xs text-charcoal-400 mt-0.5">{repair.tenant?.full_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <p className="font-serif font-semibold text-charcoal-900 tracking-wide line-clamp-1">{repair.title}</p>
                      {repair.description && <p className="text-xs text-charcoal-400 mt-0.5 line-clamp-1">{repair.description}</p>}
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider ${priority.bg} ${priority.text}`}>
                        {priority.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <StatusBadge status={repair.status} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="font-serif lining-nums tabular-nums font-medium text-charcoal-600">
                        {new Date(repair.reported_at).toLocaleDateString('vi-VN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      {isAdmin && (
                        <div className="flex justify-end items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          {repair.status === 'new' && (
                            <button onClick={() => handleStatusChange(repair, 'in_progress')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-wood-600 bg-wood-50 hover:bg-wood-100 rounded-lg border border-wood-200 transition-colors">
                              <PiClockLight className="w-3.5 h-3.5" /> Bắt đầu
                            </button>
                          )}
                          {repair.status === 'in_progress' && (
                            <button onClick={() => handleStatusChange(repair, 'resolved')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-sage-600 bg-sage-50 hover:bg-sage-100 rounded-lg border border-sage-200 transition-colors">
                              <PiCheckCircleLight className="w-3.5 h-3.5" /> Xong
                            </button>
                          )}
                            {repair.status !== 'closed' && (
                              <button onClick={(e) => openEditModal(repair, e as any)} className="p-1.5 rounded-lg text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 transition-colors bg-white border border-transparent hover:border-wood-200" title="Sửa">
                                <PiPencilSimpleLight className="w-4 h-4" />
                              </button>
                            )}
                          <button onClick={(e) => openDeleteModal(repair, e as any)} className="p-1.5 rounded-lg text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 transition-colors bg-white border border-transparent hover:border-rose-200" title="Xóa">
                            <PiTrashLight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRepair ? 'Sửa yêu cầu' : 'Tạo yêu cầu sửa chữa'} size="lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          <Input label="Tiêu đề" name="title" value={formData.title} onChange={(v) => setFormData({ ...formData, title: v })} required placeholder="VD: Bóng đèn bị hỏng" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Chọn phòng" name="room_id" type="select" value={formData.room_id}
              onChange={(v) => {
                const room = rooms.find((r) => r.id === v);
                const primaryTenant = room?.active_assignments?.find((a) => a.is_primary)?.tenant;
                setFormData({ ...formData, room_id: v, tenant_id: primaryTenant?.id || '' });
              }}
              required
              options={[{ value: '', label: '-- Chọn phòng --' }, ...rooms.map((r) => ({ value: r.id, label: `Phòng ${r.room_number}` }))]}
            />
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
                    : '-- Chọnngười báo --',
                },
                ...tenantsInSelectedRoom.map((t) => ({ value: t.id, label: t.full_name })),
              ]}
            />
          </div>
          <Input label="Mô tả chi tiết" name="description" type="textarea" value={formData.description} onChange={(v) => setFormData({ ...formData, description: v })} placeholder="Mô tả chi tiết sự cố..." rows={2} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Mức độ ưu tiên" name="priority" type="select" value={formData.priority}
              onChange={(v) => setFormData({ ...formData, priority: v as 'low' | 'medium' | 'high' | 'urgent' })}
              options={[{ value: 'low', label: 'Thấp' }, { value: 'medium', label: 'Trung bình' }, { value: 'high', label: 'Cao' }, { value: 'urgent', label: 'Khẩn cấp' }]}
            />
            <Input label="Trạng thái" name="status" type="select" value={formData.status}
              onChange={(v) => setFormData({ ...formData, status: v as 'new' | 'in_progress' | 'resolved' | 'closed' })}
              options={[{ value: 'new', label: 'Mới tạo' }, { value: 'in_progress', label: 'Đang xử lý' }, { value: 'resolved', label: 'Đã xong' }, { value: 'closed', label: 'Đã đóng' }]}
            />
          </div>
          <Input label="Người phụ trách" name="assigned_to" value={formData.assigned_to} onChange={(v) => setFormData({ ...formData, assigned_to: v })} placeholder="VD: Nguyễn Văn A" />
          {(formData.status === 'resolved' || formData.status === 'closed') && (
            <Input label="Ghi chú xử lý" name="resolution_notes" type="textarea" value={formData.resolution_notes} onChange={(v) => setFormData({ ...formData, resolution_notes: v })} placeholder="Mô tả cách xử lý..." rows={2} />
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
              <h3 className="text-2xl font-serif font-bold text-charcoal-900 flex-1 tracking-wide">{viewingRepair.title}</h3>
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
                  <PiWrenchLight className="w-4 h-4 text-charcoal-500" />
                </div>
                <div>
                  <p className="text-xs text-charcoal-400">Phòng</p>
                  <p className="font-medium text-charcoal-900">{viewingRepair.room?.room_number}</p>
                </div>
              </div>
              {viewingRepair.tenant && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center">
                    <PiUserLight className="w-4 h-4 text-charcoal-500" />
                  </div>
                  <div>
                    <p className="text-xs text-charcoal-400">Người báo</p>
                    <p className="font-medium text-charcoal-900">{viewingRepair.tenant.full_name}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center">
                  <PiCalendarBlankLight className="w-4 h-4 text-charcoal-500" />
                </div>
                <div>
                  <p className="text-xs text-charcoal-400">Ngày báo</p>
                  <p className="font-medium text-charcoal-900">{new Date(viewingRepair.reported_at).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
              {viewingRepair.assigned_to && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center">
                    <PiUserLight className="w-4 h-4 text-charcoal-500" />
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
                  <PiChatCircleLight className="w-4 h-4 text-charcoal-400" />
                  <p className="text-sm font-medium text-charcoal-600">Ghi chú xử lý</p>
                </div>
                <div className="p-3 bg-sage-50 rounded-xl border border-sage-200">
                  <p className="text-sage-800">{viewingRepair.resolution_notes}</p>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="flex gap-2 pt-5 border-t border-charcoal-100 flex-wrap">
                {viewingRepair.status === 'new' && (
                  <Button onClick={() => handleStatusChange(viewingRepair, 'in_progress')}>
                    <PiClockLight className="w-4 h-4" />Bắt đầu xử lý
                  </Button>
                )}
                {viewingRepair.status === 'in_progress' && (
                  <Button variant="success" onClick={() => handleStatusChange(viewingRepair, 'resolved')}>
                    <PiCheckCircleLight className="w-4 h-4" />Đã hoàn thành
                  </Button>
                )}
                {viewingRepair.status === 'resolved' && (
                  <Button variant="secondary" onClick={() => handleStatusChange(viewingRepair, 'closed')}>
                    <PiXLight className="w-4 h-4" />Đóng yêu cầu
                  </Button>
                )}
                {viewingRepair.status !== 'closed' && (
                  <Button variant="ghost" onClick={() => { setIsDetailModalOpen(false); openEditModal(viewingRepair); }}>
                    <PiPencilSimpleLight className="w-4 h-4" />Sửa
                  </Button>
                )}
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
      <PiWarningLight className="w-4 h-4 mr-1.5" />
      {c.label}
    </span>
  );
}

