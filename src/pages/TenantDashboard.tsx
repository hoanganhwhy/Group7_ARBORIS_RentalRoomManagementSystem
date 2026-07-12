import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, FileText, Wrench, Phone, PenTool, Download, CreditCard } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { MockPaymentGateway } from './MockPaymentGateway';
import { getRepairRequests } from '../lib/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface TenantDashboardProps {
  onNavigate?: (page: string) => void;
}

export function TenantDashboard({ onNavigate }: TenantDashboardProps = {}) {
  const { user } = useAuth();
  const userFullName = (user as { full_name?: string } | null)?.full_name;
  const [contactInfo, setContactInfo] = useState<{ name: string; phone: string } | null>(null);
  const [portalData, setPortalData] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [repairSummary, setRepairSummary] = useState({ total: 0, active: 0 });
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const sigPad = useRef<any>(null);

  useEffect(() => {
    fetch(`${API_URL}/landlord/contact`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) setContactInfo(data);
      })
      .catch(err => console.error(err));

    if (user?.tenant_id) {
      loadPortalData();
      loadNotifications();
      loadRepairSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadNotifications = async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/my?archive=false&limit=3`, {
        credentials: 'include'
      });
      if (res.ok) {
        const result = await res.json();
        setNotifications(result.data ? result.data.slice(0, 3) : []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadPortalData = async () => {
    try {
      const res = await fetch(`${API_URL}/tenant/portal?tenant_id=${user?.tenant_id}`);
      if (res.ok) {
        setPortalData(await res.json());
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadRepairSummary = async () => {
    try {
      const result = await getRepairRequests({ limit: 10000 } as any);
      const rows = result.data || [];
      const tenantRows = rows.filter(
        (repair: any) =>
          String(repair.tenant_id) === String(user?.tenant_id)
      );

      setRepairSummary({
        total: tenantRows.length,
        active: tenantRows.filter(
          (repair: any) =>
            repair.status === 'new' ||
            repair.status === 'in_progress'
        ).length,
      });
    } catch (error) {
      console.error('Failed to load repair summary:', error);
      setRepairSummary({ total: 0, active: 0 });
    }
  };

  const handleSignContract = async () => {
    if (sigPad.current?.isEmpty()) {
      alert('Vui lòng ký tên trước khi xác nhận');
      return;
    }
    setSaving(true);
    try {
      const signatureBase64 = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
      const res = await fetch(`${API_URL}/contracts/${portalData.assignment.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureBase64 })
      });
      if (res.ok) {
        alert('Ký hợp đồng thành công!');
        setIsSignModalOpen(false);
        loadPortalData();
      } else {
        alert('Lỗi khi ký hợp đồng');
      }
    } catch {
      alert('Lỗi hệ thống');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadContract = () => {
    if (portalData?.assignment?.id) {
      window.open(`${API_URL}/contracts/${portalData.assignment.id}/download`, '_blank');
    }
  };

  if (payingInvoice) {
    return <MockPaymentGateway invoiceId={payingInvoice.id} amount={Number(payingInvoice.total_amount)} onBack={() => { setPayingInvoice(null); loadPortalData(); loadRepairSummary(); }} />;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-charcoal-900 tracking-tight">Xin chào, {userFullName || user?.username}</h1>
        <p className="text-charcoal-400 mt-2">Tổng quan thông tin thuê phòng của bạn</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-card border border-charcoal-100 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-terra-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-terra-500" />
            </div>
            <div className="w-full">
              <h3 className="text-sm font-medium text-charcoal-500">Phòng Đang Thuê</h3>
              <p className="text-xl font-semibold text-charcoal-900 mt-1">
                {portalData?.room ? `${portalData.room.area} - P.${portalData.room.room_number}` : 'Chưa xếp phòng'}
              </p>
              
              {portalData?.room && (
                <div className="mt-4 grid grid-cols-2 gap-y-3 gap-x-4 text-sm text-charcoal-600">
                  <div>
                    <span className="block text-xs text-charcoal-400 mb-0.5">Giá phòng</span>
                    <span className="font-medium">{portalData.room.gia_phong?.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div>
                    <span className="block text-xs text-charcoal-400 mb-0.5">Số người ở</span>
                    <span className="font-medium">{portalData.so_nguoi_o}/{portalData.room.so_nguoi_toi_da} người</span>
                  </div>
                  <div>
                    <span className="block text-xs text-charcoal-400 mb-0.5">Giá điện</span>
                    <span className="font-medium">{portalData.dien_nuoc_info?.don_gia_dien?.toLocaleString('vi-VN')}đ/kwh</span>
                  </div>
                  <div>
                    <span className="block text-xs text-charcoal-400 mb-0.5">Giá nước</span>
                    <span className="font-medium">{portalData.dien_nuoc_info?.don_gia_nuoc?.toLocaleString('vi-VN')}đ/khối</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-xs text-charcoal-400 mb-0.5">Chủ hợp đồng</span>
                    <span className="font-medium">{portalData.chu_hop_dong === userFullName ? 'Bạn (Đại diện)' : portalData.chu_hop_dong || 'Đang cập nhật'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          {portalData?.assignment?.file_hop_dong && (
            <div className="mt-2 pt-4 border-t border-charcoal-50">
              {portalData.assignment.trang_thai_ky === 'Đã ký' ? (
                <Button variant="secondary" className="w-full justify-center text-blue-600 bg-blue-50" onClick={handleDownloadContract}>
                  <Download className="w-4 h-4 mr-2" /> Tải hợp đồng
                </Button>
              ) : (
                <Button className="w-full justify-center" onClick={() => setIsSignModalOpen(true)}>
                  <PenTool className="w-4 h-4 mr-2" /> Ký hợp đồng trực tuyến
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-card border border-charcoal-100 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-terra-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-terra-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-charcoal-500">Hóa Đơn Cần Đóng</h3>
              <p className="text-xl font-semibold text-charcoal-900 mt-1">
                {portalData?.unpaidInvoices?.length > 0 
                  ? `${portalData.unpaidInvoices.reduce((sum: number, inv: any) => sum + inv.total_amount, 0).toLocaleString('vi-VN')} VNĐ` 
                  : '0 VNĐ'}
              </p>
              <p className="text-xs text-charcoal-400 mt-1">{portalData?.unpaidInvoices?.length || 0} hóa đơn chưa thanh toán</p>
            </div>
          </div>
          {portalData?.unpaidInvoices?.length > 0 && (
            <div className="mt-2 pt-4 border-t border-charcoal-50">
              <Button className="w-full justify-center bg-[#A50064] hover:bg-[#80004d] text-white" onClick={() => setPayingInvoice(portalData.unpaidInvoices[0])}>
                <CreditCard className="w-4 h-4 mr-2" /> Thanh toán hóa đơn gần nhất
              </Button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onNavigate?.('repairs')}
          className="bg-white p-6 rounded-2xl shadow-card border border-charcoal-100 flex items-start gap-4 text-left hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="w-12 h-12 bg-terra-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Wrench className="w-6 h-6 text-terra-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-charcoal-500">Yêu Cầu Sửa Chữa</h3>
            <p className="text-xl font-semibold text-charcoal-900 mt-1">
              {repairSummary.total} yêu cầu
            </p>
            <p className="text-xs text-charcoal-400 mt-1">
              {repairSummary.active} yêu cầu đang xử lý
            </p>
          </div>
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-2xl shadow-card border border-charcoal-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-charcoal-900">Thông báo từ chủ nhà</h2>
            {onNavigate && notifications.length > 0 && (
              <button onClick={() => onNavigate('notifications')} className="text-sm font-medium text-terra-600 hover:text-terra-700">
                Xem tất cả
              </button>
            )}
          </div>
          
          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map(n => (
                <div key={n.id} className="p-3 bg-cream-50 rounded-xl border border-cream-200">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-charcoal-900 line-clamp-1">{n.title}</h3>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-terra-500 mt-1.5 flex-shrink-0"></span>}
                  </div>
                  <p className="text-sm text-charcoal-500 line-clamp-2">{n.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-charcoal-500 py-4 text-center">
              Chưa có thông báo mới.
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-card border border-charcoal-100">
          <h2 className="text-xl font-semibold text-charcoal-900 mb-4">Liên hệ quản lý</h2>
          {contactInfo ? (
            <div className="flex items-center gap-4 p-4 bg-cream-50 rounded-xl border border-cream-200">
              <div className="w-12 h-12 bg-terra-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-terra-600" />
              </div>
              <div>
                <p className="font-semibold text-charcoal-900">{contactInfo.name}</p>
                <p className="text-terra-600 font-medium mt-0.5">{contactInfo.phone}</p>
              </div>
            </div>
          ) : (
            <div className="text-charcoal-500 py-4 text-center">
              Đang tải thông tin liên hệ...
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isSignModalOpen} onClose={() => setIsSignModalOpen(false)} title="Ký Hợp Đồng Điện Tử">
        <div className="p-4 space-y-4">
          <p className="text-sm text-charcoal-600">Vui lòng ký tên của bạn vào khung bên dưới để xác nhận Hợp đồng thuê phòng. Chữ ký này sẽ được đính kèm vào Hợp đồng PDF.</p>
          
          <div className="border-2 border-dashed border-charcoal-200 rounded-xl bg-white overflow-hidden">
            <SignatureCanvas 
              ref={sigPad}
              canvasProps={{ className: 'w-full h-48 cursor-crosshair' }}
              backgroundColor="white"
            />
          </div>
          
          <div className="flex justify-end gap-2 text-sm">
            <button type="button" onClick={() => sigPad.current?.clear()} className="text-charcoal-500 hover:text-charcoal-700">Xóa chữ ký</button>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsSignModalOpen(false)}>Hủy</Button>
            <Button type="button" onClick={handleSignContract} disabled={saving}>
              {saving ? 'Đang xử lý...' : 'Ký & Xác nhận'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
