import {
  PiGridFourLight,
  PiArmchairLight,
  PiUsersLight,
  PiIdentificationBadgeLight,
  PiLightningLight,
  PiReceiptLight,
  PiWrenchLight,
} from 'react-icons/pi';
import type { Page } from '../../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: <PiGridFourLight className="w-5 h-5" />, description: 'Xem nhanh hoạt động' },
  { id: 'rooms', label: 'Phòng trọ', icon: <PiArmchairLight className="w-5 h-5" />, description: 'Quản lý phòng' },
  { id: 'tenants', label: 'Người thuê', icon: <PiUsersLight className="w-5 h-5" />, description: 'Thông tin thuê' },
  { id: 'tenant-accounts', label: 'Tài khoản', icon: <PiIdentificationBadgeLight className="w-5 h-5" />, description: 'Quản lý tài khoản' },
  { id: 'meter-readings', label: 'Điện nước', icon: <PiLightningLight className="w-5 h-5" />, description: 'Chỉ số tiêu thụ' },
  { id: 'invoices', label: 'Hóa đơn', icon: <PiReceiptLight className="w-5 h-5" />, description: 'Thanh toán' },
  { id: 'repairs', label: 'Sửa chữa', icon: <PiWrenchLight className="w-5 h-5" />, description: 'Yêu cầu bảo trì' },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-72 bg-white border-r border-charcoal-100/50 fixed h-screen flex flex-col">
      {/* Brand Section */}
      <div className="px-7 py-8 border-b border-charcoal-100/50 flex justify-center">
        <h1 className="text-4xl font-serif text-charcoal-900 tracking-widest uppercase relative inline-block">
          ARBORIS
          <span className="absolute top-1 -right-3 text-[10px] tracking-normal text-charcoal-500 font-sans">TM</span>
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-wood-50 shadow-sm'
                  : 'hover:bg-cream-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-wood-500 text-white shadow-soft'
                  : 'bg-charcoal-50 text-charcoal-400'
              }`}>
                {item.icon}
              </div>
              <div className="flex-1 text-left">
                <span className={`block text-sm font-medium ${isActive ? 'text-wood-700' : 'text-charcoal-600'}`}>
                  {item.label}
                </span>
                <span className={`block text-xs mt-0.5 ${isActive ? 'text-wood-500' : 'text-charcoal-400'}`}>
                  {item.description}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-7 py-5 border-t border-charcoal-100/50 bg-cream-50/50">
        <p className="text-xs text-charcoal-400 text-center leading-relaxed">
          Phiên bản 1.0.0<br />
          <span className="text-charcoal-300">Phần mềm quản lý phòng trọ</span>
        </p>
      </div>
    </aside>
  );
}
