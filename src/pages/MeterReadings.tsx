import { useEffect, useState } from 'react';
import {
  Plus,
  Zap,
  Droplets,
  Edit2,
  Trash2,
  Calendar,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';
import {
  getMeterReadings,
  createMeterReading,
  updateMeterReading,
  deleteMeterReading,
  getRooms,
  getLatestMeterReading,
} from '../lib/api';

import type { MeterReading, Room } from '../types';
import { Pagination } from '../components/common/Pagination';
import { PageSizeSelector } from '../components/common/PageSizeSelector';
import { SearchInput } from '../components/common/SearchInput';

export function MeterReadings() {
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<MeterReading | null>(null);
  const [deletingReading, setDeletingReading] = useState<MeterReading | null>(null);

  const [formData, setFormData] = useState({
    room_id: '',
    reading_date: new Date().toISOString().split('T')[0],
    electricity_old: '' as string | number,
    electricity_new: '' as string | number,
    water_old: '' as string | number,
    water_new: '' as string | number,
    electricity_price_per_unit: 3500 as string | number,
    water_price_per_unit: 15000 as string | number,
  });

  const [saving, setSaving] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterYear, setFilterYear] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, hasNextPage: false, hasPreviousPage: false });

  // loadData uses the dependencies listed below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData();
  }, [page, limit, filterMonth, filterYear, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterMonth, filterYear, searchQuery]);

  async function loadData() {
    try {
      setLoading(true);
      const [readingsData, roomsData] = await Promise.all([
        getMeterReadings({ 
          page, 
          limit, 
          search: searchQuery,
          month: filterMonth > 0 ? filterMonth.toString() : undefined,
          year: filterYear > 0 ? filterYear.toString() : undefined
        } as any),
        getRooms({ limit: 100 }), // Fetch enough rooms for the dropdown
      ]);
      setReadings(readingsData.data || []);
      setPagination(readingsData.pagination);
      setRooms((roomsData.data || []).filter((r: Room) => r.status === 'occupied'));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPreviousReading(roomId: string) {
    if (!roomId) {
      setFormData({
        ...formData,
        room_id: roomId,
        electricity_old: '',
        water_old: '',
      });
      return;
    }

    setLoadingPrevious(true);
    try {
      const latest = await getLatestMeterReading(roomId);
      setFormData({
        ...formData,
        room_id: roomId,
        electricity_old: latest ? latest.electricity_new : '',
        water_old: latest ? latest.water_new : '',
        electricity_price_per_unit: latest?.electricity_price_per_unit || 3500,
        water_price_per_unit: latest?.water_price_per_unit || 15000,
      });
    } catch (error) {
      console.error('Failed to load previous reading:', error);
    } finally {
      setLoadingPrevious(false);
    }
  }

  function openCreateModal() {
    setEditingReading(null);
    setFormData({
      room_id: '',
      reading_date: new Date().toISOString().split('T')[0],
      electricity_old: '',
      electricity_new: '',
      water_old: '',
      water_new: '',
      electricity_price_per_unit: 3500,
      water_price_per_unit: 15000,
    });
    setIsModalOpen(true);
  }

  function openEditModal(reading: MeterReading) {
    setEditingReading(reading);
    setFormData({
      room_id: reading.room_id,
      reading_date: reading.reading_date,
      electricity_old: reading.electricity_old ?? '',
      electricity_new: reading.electricity_new ?? '',
      water_old: reading.water_old ?? '',
      water_new: reading.water_new ?? '',
      electricity_price_per_unit: reading.electricity_price_per_unit ?? 3500,
      water_price_per_unit: reading.water_price_per_unit ?? 15000,
    });
    setIsModalOpen(true);
  }

  function openDeleteModal(reading: MeterReading) {
    setDeletingReading(reading);
    setIsDeleteModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      ...formData,
      electricity_old: parseFloat(formData.electricity_old as any),
      electricity_new: parseFloat(formData.electricity_new as any),
      water_old: parseFloat(formData.water_old as any),
      water_new: parseFloat(formData.water_new as any),
      electricity_price_per_unit: parseFloat(formData.electricity_price_per_unit as any) || 0,
      water_price_per_unit: parseFloat(formData.water_price_per_unit as any) || 0,
    };

    if (isNaN(payload.electricity_old) || isNaN(payload.electricity_new) || 
        isNaN(payload.water_old) || isNaN(payload.water_new)) {
      alert('Vui lòng nhập đầy đủ tất cả chỉ số điện cũ, mới và nước cũ, mới. Không được để trống.');
      return;
    }

    if (payload.electricity_new < payload.electricity_old) {
      alert(`Chỉ số điện mới (${payload.electricity_new}) phải lớn hơn hoặc bằng chỉ số cũ (${payload.electricity_old})`);
      return;
    }
    if (payload.water_new < payload.water_old) {
      alert(`Chỉ số nước mới (${payload.water_new}) phải lớn hơn hoặc bằng chỉ số cũ (${payload.water_old})`);
      return;
    }

    setSaving(true);
    try {
      if (editingReading) {
        await updateMeterReading(editingReading.id, payload);
      } else {
        await createMeterReading(payload);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Failed to save reading:', error);
      const msg = error?.response?.data?.error || error?.message || 'Không thể lưu chỉ số. Vui lòng thử lại.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingReading) return;
    try {
      await deleteMeterReading(deletingReading.id);
      await loadData();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to delete reading:', error);
      alert('Không thể xóa chỉ số.');
    }
  }

  const elecOld = parseFloat(formData.electricity_old as any);
  const elecNew = parseFloat(formData.electricity_new as any);
  const watOld = parseFloat(formData.water_old as any);
  const watNew = parseFloat(formData.water_new as any);
  const elecPrice = parseFloat(formData.electricity_price_per_unit as any) || 0;
  const watPrice = parseFloat(formData.water_price_per_unit as any) || 0;

  const hasElecError = !isNaN(elecNew) && !isNaN(elecOld) && elecNew < elecOld;
  const hasWaterError = !isNaN(watNew) && !isNaN(watOld) && watNew < watOld;
  const electricityUsage = !isNaN(elecNew) && !isNaN(elecOld) ? Math.max(0, elecNew - elecOld) : 0;
  const waterUsage = !isNaN(watNew) && !isNaN(watOld) ? Math.max(0, watNew - watOld) : 0;
  const electricityCost = electricityUsage * elecPrice;
  const waterCost = waterUsage * watPrice;

  const filteredReadings = readings; // Filtering is now handled by backend

  if (loading) return <Spinner />;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-charcoal-900 tracking-tight">Điện nước</h1>
          <p className="text-charcoal-400 mt-2 text-base">Nhập và theo dõi chỉ số điện nước hàng tháng</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4" />
          Nhập chỉ số
        </Button>
      </header>

      {/* Filters */}
      <section className="flex gap-4 items-center justify-between">
        <div className="flex gap-4">
          <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="px-3 py-2.5 text-sm rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors w-40">
            <option value={0}>Tất cả tháng</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="px-3 py-2.5 text-sm rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors w-40">
            <option value={0}>Tất cả năm</option>
            {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="w-64">
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Tìm theo số phòng..." />
          </div>
        </div>
        <PageSizeSelector limit={limit} onLimitChange={setLimit} />
      </section>

      {filteredReadings.length === 0 ? (
        <EmptyState
          icon={<Zap className="w-8 h-8" />}
          title="Chưa có chỉ số nào"
          description="Bắt đầu nhập chỉ số điện nước để tạo hóa đơn"
          action={
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              Nhập chỉ số
            </Button>
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-charcoal-100 overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cream-50 border-b border-charcoal-100">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-charcoal-600">
                    Ngày
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-charcoal-600">
                    Phòng
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-charcoal-600">
                    Điện (kWh)
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-charcoal-600">
                    Tiền điện
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-charcoal-600">
                    Nước (m³)
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-charcoal-600">
                    Tiền nước
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-charcoal-600">
                    Tổng tiền
                  </th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-100">
                {filteredReadings.map((reading) => {
                  const elecUsage = reading.electricity_new - reading.electricity_old;
                  const waterUsage = reading.water_new - reading.water_old;
                  const elecCost = elecUsage * reading.electricity_price_per_unit;
                  const waterCost = waterUsage * reading.water_price_per_unit;
                  const total = elecCost + waterCost;

                  return (
                    <tr key={reading.id} className="hover:bg-cream-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-charcoal-400" />
                          <span className="text-charcoal-900 font-medium">
                            {new Date(reading.reading_date).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          status={reading.room ? `${reading.room.area} - P.${reading.room.room_number}` : ''}
                          variant="default"
                          size="sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <span className="text-charcoal-900 font-medium">{elecUsage}</span>
                        </div>
                        <div className="text-xs text-charcoal-400 mt-0.5">
                          {reading.electricity_old} → {reading.electricity_new}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-charcoal-900">
                        {elecCost.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Droplets className="w-4 h-4 text-blue-500" />
                          <span className="text-charcoal-900 font-medium">{waterUsage}</span>
                        </div>
                        <div className="text-xs text-charcoal-400 mt-0.5">
                          {reading.water_old} → {reading.water_new}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-charcoal-900">
                        {waterCost.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-terra-600">
                        {total.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditModal(reading)} title="Sửa"
                            className="p-2 rounded-xl text-charcoal-400 hover:text-terra-600 hover:bg-terra-50 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => openDeleteModal(reading)} title="Xóa"
                            className="p-2 rounded-xl text-charcoal-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
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
          
          {/* Pagination component */}
          {!loading && filteredReadings.length > 0 && (
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              hasNextPage={pagination.hasNextPage}
              hasPreviousPage={pagination.hasPreviousPage}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReading ? 'Sửa chỉ số' : 'Nhập chỉ số điện nước'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Chọn phòng"
              name="room_id"
              type="select"
              value={formData.room_id}
              onChange={(v) => loadPreviousReading(v)}
              required
              disabled={!!editingReading}
              options={[
                { value: '', label: '-- Chọn phòng --' },
                ...rooms.map((r) => ({
                  value: r.id,
                  label: `Phòng ${r.room_number}`,
                })),
              ]}
            />
            <Input
              label="Ngày ghi chỉ số"
              name="reading_date"
              type="date"
              value={formData.reading_date}
              onChange={(v) => setFormData({ ...formData, reading_date: v })}
              required
            />
          </div>

          {/* Electricity Section */}
          <div className="p-5 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-700" />
              </div>
              <h4 className="font-semibold text-charcoal-900">Điện</h4>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Chỉ số cũ (kWh)"
                name="electricity_old"
                type="number"
                value={formData.electricity_old}
                onChange={(v) => setFormData({ ...formData, electricity_old: v })}
                min={0}
                disabled={loadingPrevious}
              />
              <Input
                label="Chỉ số mới (kWh)"
                name="electricity_new"
                type="number"
                value={formData.electricity_new}
                onChange={(v) => setFormData({ ...formData, electricity_new: v })}
                min={Number(formData.electricity_old) || 0}
                required
              />
              <Input
                label="Đơn giá (đ/kWh)"
                name="electricity_price"
                type="number"
                value={formData.electricity_price_per_unit}
                onChange={(v) => setFormData({ ...formData, electricity_price_per_unit: v })}
                min={0}
              />
            </div>
            {hasElecError && (
              <p className="mt-3 text-sm text-rose-600 font-medium">
                Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ ({formData.electricity_old} kWh)
              </p>
            )}
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-charcoal-600">Thành tiền:</span>
              <span className={`font-bold ${hasElecError ? 'text-rose-500' : 'text-charcoal-900'}`}>
                {hasElecError ? 'Chỉ số không hợp lệ' : `${electricityCost.toLocaleString('vi-VN')}đ (${electricityUsage} kWh)`}
              </span>
            </div>
          </div>

          {/* Water Section */}
          <div className="p-5 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-200 flex items-center justify-center">
                <Droplets className="w-4 h-4 text-blue-700" />
              </div>
              <h4 className="font-semibold text-charcoal-900">Nước</h4>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Chỉ số cũ (m³)"
                name="water_old"
                type="number"
                value={formData.water_old}
                onChange={(v) => setFormData({ ...formData, water_old: v })}
                min={0}
                disabled={loadingPrevious}
              />
              <Input
                label="Chỉ số mới (m³)"
                name="water_new"
                type="number"
                value={formData.water_new}
                onChange={(v) => setFormData({ ...formData, water_new: v })}
                min={Number(formData.water_old) || 0}
                required
              />
              <Input
                label="Đơn giá (đ/m³)"
                name="water_price"
                type="number"
                value={formData.water_price_per_unit}
                onChange={(v) => setFormData({ ...formData, water_price_per_unit: v })}
                min={0}
              />
            </div>
            {hasWaterError && (
              <p className="mt-3 text-sm text-rose-600 font-medium">
                Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ ({formData.water_old} m³)
              </p>
            )}
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-charcoal-600">Thành tiền:</span>
              <span className={`font-bold ${hasWaterError ? 'text-rose-500' : 'text-charcoal-900'}`}>
                {hasWaterError ? 'Chỉ số không hợp lệ' : `${waterCost.toLocaleString('vi-VN')}đ (${waterUsage} m³)`}
              </span>
            </div>
          </div>

          {/* Total */}
          <div className="p-5 bg-cream-100 rounded-xl flex items-center justify-between">
            <span className="font-semibold text-charcoal-700">Tổng cộng:</span>
            <span className="text-2xl font-bold text-terra-600">
              {(electricityCost + waterCost).toLocaleString('vi-VN')}đ
            </span>
          </div>

          <div className="flex gap-3 pt-5 border-t border-charcoal-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : editingReading ? 'Cập nhật' : 'Lưu chỉ số'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Xác nhận xóa"
        size="sm"
      >
        <div className="p-6">
          <p className="text-charcoal-600">
            Bạn có chắc muốn xóa chỉ số ngày{' '}
            <strong className="text-charcoal-900">{deletingReading?.reading_date}</strong>?
          </p>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Xóa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

