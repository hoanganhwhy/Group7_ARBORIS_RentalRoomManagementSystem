import {
  LayoutDashboard,
  DoorOpen,
  Users,
  Zap,
  FileText,
  Wrench,
  Building2,
} from 'lucide-react';
import type { Page } from '../../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: <LayoutDashboard className="w-[18px] h-[18px]" />, description: 'Xem nhanh hoạt động' },
  { id: 'rooms', label: 'Phòng trọ', icon: <DoorOpen className="w-[18px] h-[18px]" />, description: 'Quản lý phòng' },
  { id: 'tenants', label: 'Người thuê', icon: <Users className="w-[18px] h-[18px]" />, description: 'Thông tin thuê' },
  { id: 'meter-readings', label: 'Điện nước', icon: <Zap className="w-[18px] h-[18px]" />, description: 'Chỉ số tiêu thụ' },
  { id: 'invoices', label: 'Hóa đơn', icon: <FileText className="w-[18px] h-[18px]" />, description: 'Thanh toán' },
  { id: 'repairs', label: 'Sửa chữa', icon: <Wrench className="w-[18px] h-[18px]" />, description: 'Yêu cầu bảo trì' },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-72 bg-white border-r border-charcoal-100/50 fixed h-screen flex flex-col">
      {/* Brand Section */}
      <div className="px-7 py-8 border-b border-charcoal-100/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-terra-500 rounded-2xl flex items-center justify-center shadow-soft">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-charcoal-900 tracking-tight">Quản Lý Phòng Trọ</h1>
            <p className="text-sm text-charcoal-400 mt-0.5">Hệ thống quản lý chuyên nghiệp</p>
          </div>
        </div>
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
                  ? 'bg-terra-50 shadow-sm'
                  : 'hover:bg-cream-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-terra-500 text-white shadow-soft'
                  : 'bg-charcoal-50 text-charcoal-400'
              }`}>
                {item.icon}
              </div>
              <div className="flex-1 text-left">
                <span className={`block text-sm font-medium ${isActive ? 'text-terra-700' : 'text-charcoal-600'}`}>
                  {item.label}
                </span>
                <span className={`block text-xs mt-0.5 ${isActive ? 'text-terra-500' : 'text-charcoal-400'}`}>
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
