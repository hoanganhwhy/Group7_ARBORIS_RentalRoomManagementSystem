import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Copy, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { getInvoice, reportPayment } from '../lib/api';
import type { Invoice } from '../types';

export function MockPaymentGateway({ invoiceId, amount, onBack }: { invoiceId: string; amount: number; onBack: () => void }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadInvoice() {
      try {
        const data = await getInvoice(invoiceId);
        if (isMounted) {
          setInvoice(data);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load invoice details:', error);
        if (isMounted) setLoading(false);
      }
    }

    loadInvoice();
    const intervalId = window.setInterval(loadInvoice, 3000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [invoiceId]);

  // Đã tắt giả lập tự động để bạn test tính năng chuyển khoản thật qua SePay.

  // Tự động quay lại (đóng màn hình) sau 3 giây khi thanh toán thành công
  useEffect(() => {
    if (invoice?.status === 'paid') {
      const timer = setTimeout(() => {
        onBack();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [invoice?.status, onBack]);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert('Đã sao chép: ' + text);
  };

  const handleReportPayment = async () => {
    if (!invoice?.id) return;
    try {
      setReporting(true);
      await reportPayment(invoice.id);
      // Wait for the next poll to update UI, or just update locally:
      setInvoice({ ...invoice, status: 'waiting_confirmation' });
    } catch (error) {
      alert('Có lỗi xảy ra khi báo cáo thanh toán');
      console.error(error);
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-terra-600 animate-spin mb-4" />
        <p className="text-charcoal-600">Đang tải thông tin thanh toán...</p>
      </div>
    );
  }

  if (invoice?.status === 'paid') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-charcoal-900 mb-2">Thanh toán thành công!</h2>
        <p className="text-charcoal-600 mb-8 max-w-md text-lg">
          Hóa đơn {invoice.ma_hoa_don} của bạn đã được xác nhận thanh toán tự động qua VietQR.
        </p>
        <Button onClick={onBack} size="lg" className="w-full max-w-sm">
          Quay lại danh sách hóa đơn
        </Button>
      </div>
    );
  }

  if (invoice?.status === 'waiting_confirmation') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-12 h-12 text-yellow-600" />
        </div>
        <h2 className="text-3xl font-bold text-charcoal-900 mb-2">Đang chờ xác nhận</h2>
        <p className="text-charcoal-600 mb-8 max-w-md text-lg">
          Hóa đơn {invoice.ma_hoa_don} đã được báo cáo thanh toán. Vui lòng chờ chủ nhà xác nhận.
        </p>
        <Button onClick={onBack} size="lg" className="w-full max-w-sm">
          Quay lại danh sách hóa đơn
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-charcoal-50 z-50 overflow-y-auto">
      <div className="bg-white sticky top-0 z-10 px-4 py-4 flex items-center shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-charcoal-50 transition-colors">
          <ArrowLeft className="w-6 h-6 text-charcoal-700" />
        </button>
        <h1 className="text-lg font-bold text-charcoal-900 ml-2">Thanh toán VietQR</h1>
      </div>

      <div className="max-w-md mx-auto p-4 pb-24">
        {/* Total Amount Card */}
        <div className="bg-gradient-to-br from-terra-500 to-terra-600 rounded-2xl p-6 text-white text-center shadow-lg mb-6">
          <p className="text-terra-100 mb-2">Tổng số tiền cần thanh toán</p>
          <p className="text-4xl font-bold">
            {amount.toLocaleString('vi-VN')} đ
          </p>
          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between text-sm items-center">
            <span>Mã hóa đơn:</span>
            <span className="font-mono font-bold bg-white/20 px-2 py-1 rounded select-all">{invoice?.ma_hoa_don}</span>
          </div>
        </div>

        {/* QR Code Section */}
        {invoice?.qrUrl ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-charcoal-100 flex flex-col items-center mb-6 text-center">
            <h3 className="font-semibold text-charcoal-900 mb-2">Quét mã để thanh toán</h3>
            <p className="text-sm text-charcoal-500 mb-6">Sử dụng ứng dụng ngân hàng hoặc MoMo để quét mã</p>
            
            <div className="bg-white p-2 rounded-xl shadow-md border border-charcoal-100 mb-6 w-full max-w-[280px] aspect-square flex items-center justify-center">
              <img 
                src={invoice.qrUrl} 
                alt="VietQR Code" 
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            
            <div className="flex justify-between items-center bg-charcoal-50 p-3 rounded-xl border border-charcoal-100 w-full mb-6">
              <div className="flex flex-col text-left">
                <span className="text-xs text-charcoal-400 font-medium uppercase tracking-wide">Nội dung chuyển khoản</span>
                <span className="font-bold text-charcoal-900 font-mono text-base">{invoice?.ma_hoa_don}</span>
              </div>
              <button onClick={() => copyToClipboard(invoice?.ma_hoa_don || '')} className="p-2 bg-white text-terra-600 hover:bg-terra-50 rounded-lg transition-colors border border-charcoal-100 shadow-sm">
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 w-full mt-2">
              <div className="flex items-center gap-3 text-terra-600 bg-terra-50 px-4 py-3 rounded-xl w-full justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Đang chờ quét tự động...</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 rounded-2xl p-6 text-center border border-rose-100 mb-6 flex flex-col items-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-3" />
            <p className="text-rose-600 font-medium mb-2">Chưa cấu hình tài khoản nhận tiền</p>
            <p className="text-sm text-rose-500">
              Vui lòng nhắc chủ nhà cấu hình <code className="bg-rose-100 px-1 rounded">BANK_ID</code>, <code className="bg-rose-100 px-1 rounded">BANK_ACCOUNT_NO</code>, <code className="bg-rose-100 px-1 rounded">BANK_ACCOUNT_NAME</code> trong file <code className="bg-rose-100 px-1 rounded">.env</code> của Server.
            </p>
          </div>
        )}


        <Button
          onClick={handleReportPayment}
          disabled={reporting || !invoice?.qrUrl}
          className="w-full mb-6 justify-center"
          size="lg"
        >
          {reporting ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="w-5 h-5 mr-2" />
          )}
          {reporting ? 'Đang gửi xác nhận...' : 'Tôi đã chuyển khoản thành công'}
        </Button>

        <div className="bg-blue-50 text-blue-700 p-5 rounded-2xl text-sm leading-relaxed mb-6 border border-blue-100 shadow-sm">
          <p className="font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Lưu ý quan trọng:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Nội dung chuyển khoản (Mã hóa đơn) phải <strong>chính xác tuyệt đối</strong> để hệ thống tự động nhận diện.</li>
            <li>Sau khi chuyển khoản thành công, màn hình này sẽ tự động cập nhật nếu hệ thống có kết nối API tự động.</li>
            <li>Nếu chờ lâu không thấy cập nhật, bạn có thể bấm nút <strong>"Tôi đã chuyển khoản thành công"</strong> để báo cho chủ nhà biết.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
