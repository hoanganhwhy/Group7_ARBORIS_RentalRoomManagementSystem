import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, FileText, Wrench } from 'lucide-react';

export function TenantDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-charcoal-900 tracking-tight">Xin chào, {user?.username}</h1>
        <p className="text-charcoal-400 mt-2">Tổng quan thông tin thuê phòng của bạn</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-card border border-charcoal-100 flex items-start gap-4">
          <div className="w-12 h-12 bg-terra-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-terra-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-charcoal-500">Phòng Đang Thuê</h3>
            <p className="text-xl font-semibold text-charcoal-900 mt-1">Đang cập nhật</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-card border border-charcoal-100 flex items-start gap-4">
          <div className="w-12 h-12 bg-terra-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-terra-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-charcoal-500">Hóa Đơn Cần Đóng</h3>
            <p className="text-xl font-semibold text-charcoal-900 mt-1">0 VNĐ</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-card border border-charcoal-100 flex items-start gap-4">
          <div className="w-12 h-12 bg-terra-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Wrench className="w-6 h-6 text-terra-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-charcoal-500">Yêu Cầu Sửa Chữa</h3>
            <p className="text-xl font-semibold text-charcoal-900 mt-1">0 sự cố</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-8 rounded-2xl shadow-card border border-charcoal-100">
        <h2 className="text-xl font-semibold text-charcoal-900 mb-4">Thông báo từ chủ nhà</h2>
        <div className="text-charcoal-500 py-8 text-center">
          Chưa có thông báo mới.
        </div>
      </div>
    </div>
  );
}
