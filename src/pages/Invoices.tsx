import { useEffect, useState } from 'react';
import {
  Plus,
  FileText,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { MockPaymentGateway } from './MockPaymentGateway';
import {
  getInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markOverdueInvoices,
  getRooms,
  getMeterReadings,
  confirmPayment,
} from '../lib/api';
import type { Invoice, Room, MeterReading } from '../types';
import { Pagination } from '../components/common/Pagination';
import { PageSizeSelector } from '../components/common/PageSizeSelector';
import { SearchInput } from '../components/common/SearchInput';

export function Invoices() {
  const { user } = useAuth();
  const isTenant = user?.role === 'TENANT';
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'paid' | 'overdue' | 'waiting_confirmation'
  >('pending');
  const [filterMonth, setFilterMonth] = useState<number>(0); // 0 = all
  const [filterYear, setFilterYear] = useState<number>(0); // 0 = all
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, hasNextPage: false, hasPreviousPage: false });

  // Add state for all invoices to compute summary
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);

  const [formData, setFormData] = useState({
    room_id: '',
    meter_reading_id: '',
    invoice_month: new Date().getMonth() + 1,
    invoice_year: new Date().getFullYear(),
    room_rent: '' as string | number,
    electricity_cost: '' as string | number,
    water_cost: '' as string | number,
    other_fees: '',
    due_date: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  // loadData uses the dependencies listed below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData();
  }, [page, limit, filter, filterMonth, filterYear, filterFloor, filterArea, filterDate, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filter, filterMonth, filterYear, filterFloor, filterArea, filterDate, searchQuery]);

  async function loadData() {
    try {
      setLoading(true);
      // Mark any pending invoices past their due date as overdue before fetching
      await markOverdueInvoices().catch(() => {});
      const [invoicesData, allInvoicesData, roomsData, readingsData] = await Promise.all([
        getInvoices({
          page,
          limit,
          search: searchQuery,
          status: filter !== 'all' ? filter : undefined,
          month: filterMonth > 0 ? filterMonth.toString() : undefined,
          year: filterYear > 0 ? filterYear.toString() : undefined,
          floor: filterFloor !== 'all' ? filterFloor : undefined,
          area: filterArea !== 'all' ? filterArea : undefined,
          date: filterDate || undefined,
        } as any),
        getInvoices({ limit: 10000 }), // Fetch all for summary stats
        getRooms({ limit: 100 }),
        getMeterReadings({ limit: 1000 }),
      ]);
      setInvoices(invoicesData.data || []);
      setPagination(invoicesData.pagination);
      setAllInvoices(allInvoicesData.data || []);
      setRooms(roomsData.data || []);
      setReadings(readingsData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingInvoice(null);
    setFormData({
      room_id: '',
      meter_reading_id: '',
      invoice_month: new Date().getMonth() + 1,
      invoice_year: new Date().getFullYear(),
      room_rent: '',
      electricity_cost: '',
      water_cost: '',
      other_fees: '',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: '',
    });
    setIsModalOpen(true);
  }

  function openEditModal(invoice: Invoice) {
    setEditingInvoice(invoice);
    setFormData({
      room_id: String(invoice.room_id),
      meter_reading_id: invoice.meter_reading_id ? String(invoice.meter_reading_id) : '',
      invoice_month: invoice.invoice_month,
      invoice_year: invoice.invoice_year,
      room_rent: invoice.room_rent ?? '',
      electricity_cost: invoice.electricity_cost ?? '',
      water_cost: invoice.water_cost ?? '',
      other_fees: invoice.other_fees != null ? String(invoice.other_fees) : '',
      due_date: invoice.due_date || '',
      notes: invoice.notes || '',
    });
    setIsModalOpen(true);
  }

  function openDeleteModal(invoice: Invoice) {
    setDeletingInvoice(invoice);
    setIsDeleteModalOpen(true);
  }

  function handleRoomChange(roomId: string) {
    const room = rooms.find((r) => r.id.toString() === roomId.toString());
    if (room) {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      setFormData({
        ...formData,
        room_id: roomId,
        room_rent: room.monthly_rent,
        due_date: dueDate,
      });
    } else {
      setFormData({ ...formData, room_id: roomId });
    }
  }

  function handleReadingChange(readingId: string) {
    const reading = readings.find((r) => r.id.toString() === readingId.toString());
    if (reading) {
      const elecCost = (reading.electricity_new - reading.electricity_old) * reading.electricity_price_per_unit;
      const waterCost = (reading.water_new - reading.water_old) * reading.water_price_per_unit;
      
      setFormData({
        ...formData,
        meter_reading_id: readingId,
        electricity_cost: elecCost,
        water_cost: waterCost,
      });
    } else {
      setFormData({ ...formData, meter_reading_id: readingId });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const room = rooms.find((r) => r.id.toString() === formData.room_id.toString());
      const rentVal = parseFloat(formData.room_rent as any) || 0;
      const elecVal = parseFloat(formData.electricity_cost as any) || 0;
      const waterVal = parseFloat(formData.water_cost as any) || 0;
      const otherVal = parseFloat(formData.other_fees as any) || 0;

      const totalAmount = rentVal + elecVal + waterVal + otherVal;

      const data = {
        ...formData,
        room_rent: rentVal,
        electricity_cost: elecVal,
        water_cost: waterVal,
        other_fees: otherVal,
        tenant_id: room?.current_tenant?.id || room?.current_assignment?.tenant_id || null,
        total_amount: totalAmount,
        status: editingInvoice ? editingInvoice.status : ('pending' as const),
      };

      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, data);
      } else {
        await createInvoice(data);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save invoice:', error);
      alert('Không thể lưu hóa đơn. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingInvoice) return;
    try {
      await deleteInvoice(deletingInvoice.id);
      await loadData();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      alert('Không thể xóa hóa đơn.');
    }
  }

  const handleMarkPaid = async (invoice: Invoice) => {
    try {
      await updateInvoice(invoice.id, { status: 'paid', paid_date: new Date().toISOString() });
      await loadData();
    } catch (err) {
      console.error('Failed to mark invoice as paid', err);
    }
  };

  const handleConfirmPayment = async (invoice: Invoice) => {
    try {
      await confirmPayment(invoice.id);
      await loadData();
      alert('Đã xác nhận thanh toán thành công!');
    } catch (err) {
      console.error('Failed to confirm payment', err);
      alert('Có lỗi xảy ra khi xác nhận thanh toán.');
    }
  };

  const userInvoices = isTenant 
    ? allInvoices.filter(i => i.tenant_id === user?.tenant_id)
    : allInvoices;

  const filteredInvoices = invoices; // Backend handles filtering now

  const statusCounts = {
    pending: userInvoices.filter(i => i.status === 'pending').length,
    paid: userInvoices.filter(i => i.status === 'paid').length,
    overdue: userInvoices.filter(i => i.status === 'overdue').length,
    waiting_confirmation: userInvoices.filter(i => i.status === 'waiting_confirmation').length,
  };

  const totalPending = userInvoices
    .filter((i) => i.status === 'pending')
    .reduce((sum, i) => sum + Number(i.total_amount), 0);

  const totalPaid = userInvoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.total_amount), 0);

  if (loading) return <Spinner />;

  if (payingInvoice) {
    return <MockPaymentGateway invoiceId={payingInvoice.id} amount={Number(payingInvoice.total_amount)} onBack={() => { setPayingInvoice(null); loadData(); }} />;
  }

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-charcoal-900 tracking-tight">Hóa đơn</h1>
          <p className="text-charcoal-400 mt-2 text-base">Lập và quản lý hóa đơn thanh toán</p>
        </div>
        {!isTenant && (
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            Tạo hóa đơn
          </Button>
        )}
      </header>

      {/* Financial Summary */}
      <section className={`grid ${isTenant ? 'grid-cols-2' : 'grid-cols-3'} gap-6`}>
        <div className="bg-sage-50 rounded-2xl border border-sage-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-charcoal-500 font-medium">{isTenant ? 'Tổng đã trả' : 'Doanh thu đã thu'}</p>
              <p className="text-2xl font-semibold text-charcoal-900 mt-2">
                {totalPaid.toLocaleString('vi-VN')}đ
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-sage-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-sage-600" />
            </div>
          </div>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-charcoal-500 font-medium">{isTenant ? 'Đang nợ' : 'Chờ thanh toán'}</p>
              <p className="text-2xl font-semibold text-charcoal-900 mt-2">
                {totalPending.toLocaleString('vi-VN')}đ
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
        {!isTenant && (
          <div className="bg-rose-50 rounded-2xl border border-rose-100 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-charcoal-500 font-medium">Quá hạn</p>
                <p className="text-2xl font-semibold text-rose-600 mt-2">
                  {statusCounts.overdue} hóa đơn
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-rose-600" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Filters */}
      <section className="space-y-4">
        <div className="flex bg-charcoal-50 p-1.5 rounded-xl border border-charcoal-200">
          {(['pending', 'waiting_confirmation', 'paid', 'overdue'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                filter === status
                  ? 'bg-white text-charcoal-900 shadow-card border border-charcoal-100'
                  : 'text-charcoal-400 hover:text-charcoal-600 hover:bg-white/50'
              }`}
            >
              {status === 'pending' && 'Chờ thanh toán'}
              {status === 'waiting_confirmation' && 'Chờ xác nhận'}
              {status === 'paid' && 'Lịch sử'}
              {status === 'overdue' && 'Quá hạn'}
              <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                filter === status ? 'bg-terra-100 text-terra-700' : 'bg-charcoal-100 text-charcoal-500'
              }`}>{statusCounts[status]}</span>
            </button>
          ))}
        </div>
          <div className="flex items-center gap-4 flex-wrap">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-charcoal-200 focus:ring-terra-400 focus:border-terra-400 bg-white text-charcoal-900 transition-colors"
              title="Lọc theo ngày thanh toán"
            />
            {!isTenant && (
              <>
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
                  {Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => Number(a) - Number(b)).map(f => (
                    <option key={f} value={f}>Tầng {f}</option>
                  ))}
                </select>
              </>
            )}
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
            <div className="w-64 ml-auto">
              <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Tìm hóa đơn..." />
            </div>
            <PageSizeSelector limit={limit} onLimitChange={setLimit} />
          </div>
      </section>

      {/* Invoice Table */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-12">
          <EmptyState
            icon={<FileText className="w-10 h-10" />}
            title="Chưa có hóa đơn nào"
            description={isTenant ? "Bạn chưa có hóa đơn nào." : "Tạo hóa đơn đầu tiên cho người thuê phòng"}
            action={!isTenant ? <Button onClick={openCreateModal}><Plus className="w-4 h-4" />Tạo hóa đơn</Button> : undefined}
          />
        </div>
      ) : (
        <>
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal-100">
                <th className="text-left px-7 py-5 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Kỳ hóa đơn</th>
                <th className="text-left px-7 py-5 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Phòng</th>
                <th className="text-right px-7 py-5 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Tiền phòng</th>
                <th className="text-right px-7 py-5 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Điện + Nước</th>
                <th className="text-right px-7 py-5 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Tổng</th>
                <th className="text-left px-7 py-5 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Hạn</th>
                <th className="text-left px-7 py-5 text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Trạng thái</th>
                <th className="px-7 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-50">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-cream-50/50 transition-colors">
                  <td className="px-7 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-charcoal-50 flex items-center justify-center text-sm font-medium text-charcoal-600">
                        {invoice.invoice_month}/{invoice.invoice_year.toString().slice(-2)}
                      </div>
                    </div>
                  </td>
                  <td className="px-7 py-5">
                    <p className="font-medium text-charcoal-900">{invoice.room ? `${invoice.room.area} - P.${invoice.room.room_number}` : '—'}</p>
                    <p className="text-sm text-charcoal-400 mt-0.5">{invoice.tenant?.full_name || '—'}</p>
                  </td>
                  <td className="px-7 py-5 text-right text-charcoal-600">
                    {invoice.room_rent.toLocaleString('vi-VN')}đ
                  </td>
                  <td className="px-7 py-5 text-right text-charcoal-600">
                    {(invoice.electricity_cost + invoice.water_cost).toLocaleString('vi-VN')}đ
                  </td>
                  <td className="px-7 py-5 text-right">
                    <p className="font-semibold text-charcoal-900">{invoice.total_amount.toLocaleString('vi-VN')}đ</p>
                  </td>
                  <td className="px-7 py-5 text-charcoal-400">
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="px-7 py-5">
                    <InvoiceStatusBadge status={invoice.status} isTenant={isTenant} />
                  </td>
                  <td className="px-7 py-5">
                    <div className="flex items-center justify-end gap-2">
                      {isTenant ? (
                        <>
                          {invoice.status === 'pending' && (
                            <Button 
                              size="sm"
                              className="bg-[#A50064] hover:bg-[#80004d] text-white py-1.5 px-3 h-auto text-sm"
                              onClick={() => setPayingInvoice(invoice)}
                            >
                              <CreditCard className="w-4 h-4 mr-2" />
                              Thanh toán
                            </Button>
                          )}
                          {invoice.status === 'waiting_confirmation' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              Chờ xác nhận
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {invoice.status === 'pending' && (
                            <button onClick={() => handleMarkPaid(invoice)} className="px-3 py-1.5 text-xs font-medium text-sage-600 bg-sage-50 hover:bg-sage-100 rounded-lg transition-colors">
                              Đã thanh toán
                            </button>
                          )}
                          {invoice.status === 'waiting_confirmation' && (
                            <button onClick={() => handleConfirmPayment(invoice)} className="px-3 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors">
                              Xác nhận tiền vào
                            </button>
                          )}
                          <button onClick={() => openEditModal(invoice)} disabled={invoice.status === 'paid'}
                            className={`p-2 rounded-lg transition-colors ${invoice.status === 'paid' ? 'text-charcoal-200' : 'text-charcoal-400 hover:text-terra-600 hover:bg-terra-50'}`}>
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => openDeleteModal(invoice)} disabled={invoice.status === 'paid'}
                            className={`p-2 rounded-lg transition-colors ${invoice.status === 'paid' ? 'text-charcoal-200' : 'text-charcoal-400 hover:text-red-600 hover:bg-red-50'}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination component */}
          {!loading && filteredInvoices.length > 0 && (
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
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingInvoice ? 'Sửa hóa đơn' : 'Tạo hóa đơn mới'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Chọn phòng"
              name="room_id"
              type="select"
              value={formData.room_id}
              onChange={handleRoomChange}
              required
              options={[
                { value: '', label: '-- Chọn phòng --' },
                ...rooms
                  .filter((r) => r.status === 'occupied')
                  .map((r) => ({
                    value: r.id,
                    label: `Phòng ${r.room_number}${r.current_tenant ? ` - ${r.current_tenant.full_name}` : ''}`,
                  })),
              ]}
            />
            <Input
              label="Chỉ số điện nước (bắt buộc)"
              name="meter_reading_id"
              type="select"
              required
              value={formData.meter_reading_id}
              onChange={handleReadingChange}
              options={[
                { value: '', label: '-- Chọn chỉ số --' },
                ...readings
                  .filter((r) => String(r.room_id) === String(formData.room_id))
                  .map((r) => ({
                    value: r.id,
                    label: `${new Date(r.reading_date).toLocaleDateString('vi-VN')}`,
                  })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Kỳ hóa đơn (Tháng)"
              name="invoice_month"
              type="select"
              required
              value={formData.invoice_month.toString()}
              onChange={(v) => setFormData({ ...formData, invoice_month: parseInt(v) || 1 })}
              options={Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: `Tháng ${i + 1}` }))}
            />
            <Input
              label="Kỳ hóa đơn (Năm)"
              name="invoice_year"
              type="select"
              required
              value={formData.invoice_year.toString()}
              onChange={(v) => setFormData({ ...formData, invoice_year: parseInt(v) || new Date().getFullYear() })}
              options={Array.from({ length: 11 }, (_, i) => {
                const year = new Date().getFullYear() - 5 + i;
                return { value: year.toString(), label: year.toString() };
              })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tiền phòng (VNĐ)"
              name="room_rent"
              type="number"
              value={formData.room_rent}
              onChange={(v) => setFormData({ ...formData, room_rent: v })}
              min={0}
              required
              disabled={true}
            />
            <Input
              label="Hạn thanh toán"
              name="due_date"
              type="date"
              value={formData.due_date}
              onChange={(v) => setFormData({ ...formData, due_date: v })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Tiền điện (VNĐ)"
              name="electricity_cost"
              type="number"
              value={formData.electricity_cost}
              onChange={(v) => setFormData({ ...formData, electricity_cost: v })}
              min={0}
              disabled={true}
            />
            <Input
              label="Tiền nước (VNĐ)"
              name="water_cost"
              type="number"
              value={formData.water_cost}
              onChange={(v) => setFormData({ ...formData, water_cost: v })}
              min={0}
              disabled={true}
            />
            <Input
              label="Phí khác (VNĐ)"
              name="other_fees"
              type="number"
              value={formData.other_fees}
              onChange={(v) => setFormData({ ...formData, other_fees: v })}
              min={0}
              disabled={true}
            />
          </div>
          <Input
            label="Ghi chú"
            name="notes"
            type="textarea"
            value={formData.notes}
            onChange={(v) => setFormData({ ...formData, notes: v })}
            rows={2}
          />

          {/* Total */}
          <div className="p-5 bg-cream-100 rounded-xl flex items-center justify-between">
            <span className="font-semibold text-charcoal-700">Tổng tiền:</span>
            <span className="text-2xl font-bold text-terra-600">
              {(
                (parseFloat(formData.room_rent as any) || 0) +
                (parseFloat(formData.electricity_cost as any) || 0) +
                (parseFloat(formData.water_cost as any) || 0) +
                (parseFloat(formData.other_fees as any) || 0)
              ).toLocaleString('vi-VN')}
              đ
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
              {saving ? 'Đang lưu...' : editingInvoice ? 'Cập nhật' : 'Tạo hóa đơn'}
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
            Bạn có chắc muốn xóa hóa đơn <strong className="text-charcoal-900">{deletingInvoice?.invoice_month}/
            {deletingInvoice?.invoice_year}</strong>?
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

function InvoiceStatusBadge({
  status,
  isTenant,
}: {
  status: Invoice['status'];
  isTenant?: boolean;
}) {
  const variants: Record<Invoice['status'], 'default' | 'success' | 'warning' | 'danger'> = {
    pending: 'default',
    paid: 'success',
    waiting_confirmation: 'warning',
    overdue: isTenant ? 'warning' : 'danger',
  };
  
  if (isTenant && status === 'overdue') {
    // Show as a warning badge with label 'Chưa thanh toán' for tenants instead of 'Quá hạn'
    return (
      <span className="inline-flex items-center justify-center font-medium px-2.5 py-1 text-sm bg-amber-100 text-amber-700 rounded-lg">
        Chưa thanh toán
      </span>
    );
  }
  
  return <Badge status={status} variant={variants[status]} />;
}
