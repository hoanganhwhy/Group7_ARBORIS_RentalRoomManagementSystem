import { Headphones, ShieldCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ open, onClose }: ForgotPasswordModalProps) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Quên mật khẩu" size="sm">
      <div className="p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wood-50 text-wood-600">
          <Headphones className="h-6 w-6" />
        </div>
        <p className="mt-4 text-sm leading-6 text-charcoal-600">
          Tài khoản người thuê do ban quản lý cấp. Để bảo vệ thông tin hợp đồng, vui lòng liên hệ ban quản lý để được đặt lại mật khẩu tạm thời.
        </p>
        <div className="mt-5 flex gap-3 rounded-2xl border border-sage-100 bg-sage-50 p-4 text-sm text-sage-800">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Không cung cấp mật khẩu hoặc mã xác minh Google cho bất kỳ ai.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-11 w-full rounded-xl bg-charcoal-900 text-sm font-semibold text-white transition hover:bg-charcoal-800"
        >
          Đã hiểu
        </button>
      </div>
    </Modal>
  );
}
