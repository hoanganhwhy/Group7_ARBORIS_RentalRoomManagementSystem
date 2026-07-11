import { useState } from 'react';
import {
  LayoutDashboard,
  DoorOpen,
  Users,
  Zap,
  FileText,
  Wrench,
  Building2,
  Settings as SettingsIcon,
  LogOut,
  LogOut as LogOutIcon, // Rename to avoid conflict if needed, but LogOut is fine
} from 'lucide-react';
import type { Page } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ProfileModal } from './ProfileModal';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  let navItems: { id: Page; label: string; icon: React.ReactNode; description: string }[] = [];
  
  if (user?.role === 'TENANT') {
    navItems = [
      { id: 'dashboard', label: 'Tổng quan', icon: <LayoutDashboard className="w-[18px] h-[18px]" />, description: 'Thông tin thuê' },
      { id: 'invoices', label: 'Hóa đơn', icon: <FileText className="w-[18px] h-[18px]" />, description: 'Thanh toán' },
      { id: 'repairs', label: 'Sửa chữa', icon: <Wrench className="w-[18px] h-[18px]" />, description: 'Yêu cầu bảo trì' },
    ];
  } else if (user?.role === 'ADMIN') {
    navItems = [
      { id: 'dashboard', label: 'Tổng quan', icon: <LayoutDashboard className="w-[18px] h-[18px]" />, description: 'Xem nhanh hoạt động' },
      { id: 'rooms', label: 'Phòng trọ', icon: <DoorOpen className="w-[18px] h-[18px]" />, description: 'Quản lý phòng' },
      { id: 'tenants', label: 'Người thuê', icon: <Users className="w-[18px] h-[18px]" />, description: 'Thông tin thuê' },
      { id: 'meter-readings', label: 'Điện nước', icon: <Zap className="w-[18px] h-[18px]" />, description: 'Chỉ số tiêu thụ' },
      { id: 'invoices', label: 'Hóa đơn', icon: <FileText className="w-[18px] h-[18px]" />, description: 'Thanh toán' },
      { id: 'repairs', label: 'Sửa chữa', icon: <Wrench className="w-[18px] h-[18px]" />, description: 'Yêu cầu bảo trì' },
    ];
  } else {
    // GUEST
    navItems = [
      { id: 'dashboard', label: 'Tổng quan', icon: <LayoutDashboard className="w-[18px] h-[18px]" />, description: 'Trạng thái tài khoản' },
    ];
  }

  return (
    <>
      <aside className="w-72 bg-white border-r border-charcoal-100/50 fixed h-screen flex flex-col z-40">
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
        <div className="px-4 py-5 border-t border-charcoal-100/50 bg-cream-50/50 flex items-center justify-between gap-2">
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-3 flex-1 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all text-left overflow-hidden group"
          >
            <div className="w-10 h-10 rounded-full bg-terra-100 flex items-center justify-center flex-shrink-0 group-hover:bg-terra-200 transition-colors">
              <span className="text-terra-700 font-bold text-sm">
                {user?.username?.[0]?.toUpperCase() || 'A'}
              </span>
            </div>
            <div className="text-sm truncate">
              <p className="font-semibold text-charcoal-900 leading-none truncate">{user?.full_name || user?.username}</p>
              <p className="text-xs text-charcoal-500 mt-1 truncate">{user?.role}</p>
            </div>
          </button>
          <button
            onClick={logout}
            className="p-2.5 text-charcoal-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors flex-shrink-0"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>
      
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
