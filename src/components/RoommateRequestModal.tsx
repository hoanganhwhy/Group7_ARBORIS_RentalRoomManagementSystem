import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { createRoommateRequest } from '../lib/api';

interface RoommateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RoommateRequestModal({ isOpen, onClose, onSuccess }: RoommateRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    tieu_de: '',
    mo_ta: '',
    gia_chia_se: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tieu_de || !formData.gia_chia_se) {
      setError('Vui lòng điền tiêu đề và mức giá mong muốn chia sẻ.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createRoommateRequest({
        tieu_de: formData.tieu_de,
        mo_ta: formData.mo_ta,
        gia_chia_se: Number(formData.gia_chia_se.replace(/[^0-9]/g, ''))
      });
      onSuccess();
      onClose();
      // reset
      setFormData({
        tieu_de: '',
        mo_ta: '',
        gia_chia_se: ''
      });
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tạo yêu cầu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal-900/50 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-100/50">
          <h2 className="text-xl font-semibold text-charcoal-900 tracking-tight">Đăng Tin Tìm Ở Ghép</h2>
          <button
            onClick={onClose}
            className="p-2 text-charcoal-400 hover:text-charcoal-600 hover:bg-cream-50 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="p-4 mb-6 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <form id="roommate-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
                Tiêu đề tin đăng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.tieu_de}
                onChange={(e) => setFormData({ ...formData, tieu_de: e.target.value })}
                placeholder="VD: Tìm 1 nam/nữ ở ghép phòng sạch sẽ..."
                className="w-full px-4 py-2.5 bg-white border border-charcoal-200 rounded-xl text-charcoal-900 placeholder:text-charcoal-300 focus:border-terra-500 focus:ring-2 focus:ring-terra-500/20 transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
                Giá chia sẻ (VNĐ/Tháng) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.gia_chia_se}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setFormData({ ...formData, gia_chia_se: val ? Number(val).toLocaleString('vi-VN') : '' });
                }}
                placeholder="VD: 1.500.000"
                className="w-full px-4 py-2.5 bg-white border border-charcoal-200 rounded-xl text-charcoal-900 placeholder:text-charcoal-300 focus:border-terra-500 focus:ring-2 focus:ring-terra-500/20 transition-all outline-none"
              />
              <p className="mt-1 text-xs text-charcoal-400">Mức giá mà người mới cần đóng góp hàng tháng.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
                Mô tả chi tiết
              </label>
              <textarea
                value={formData.mo_ta}
                onChange={(e) => setFormData({ ...formData, mo_ta: e.target.value })}
                rows={5}
                placeholder="Mô tả về thói quen sinh hoạt, yêu cầu với người ở ghép, tiện ích dùng chung..."
                className="w-full px-4 py-2.5 bg-white border border-charcoal-200 rounded-xl text-charcoal-900 placeholder:text-charcoal-300 focus:border-terra-500 focus:ring-2 focus:ring-terra-500/20 transition-all outline-none resize-none"
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-charcoal-100/50 bg-cream-50/50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-charcoal-600 bg-white border border-charcoal-200 rounded-xl hover:bg-cream-50 hover:text-charcoal-900 transition-all shadow-sm"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            form="roommate-form"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-terra-500 rounded-xl hover:bg-terra-600 transition-all shadow-sm shadow-terra-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Đăng Tin
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
