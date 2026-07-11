import React, { useState } from 'react';
import { Building2, UserPlus, Lock, User, Mail, Phone, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function Register({ onNavigateToLogin }: { onNavigateToLogin: () => void }) {
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: '',
    full_name: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp');
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đăng ký thất bại');
      }

      login(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-terra-500 rounded-2xl flex items-center justify-center shadow-lg shadow-terra-500/20">
            <Building2 className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-charcoal-900 tracking-tight">
          Tạo tài khoản mới
        </h2>
        <p className="mt-2 text-center text-sm text-charcoal-500">
          Tham gia trải nghiệm Smart Rental ngay hôm nay
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-card sm:rounded-2xl sm:px-10 border border-charcoal-100">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-charcoal-700">Tên đăng nhập</label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-charcoal-400" />
                </div>
                <input
                  type="text"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="focus:ring-terra-400 focus:border-terra-400 block w-full pl-10 sm:text-sm border-charcoal-200 rounded-xl py-3"
                  placeholder="VD: nguyenvan_a"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700">Họ và tên</label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-charcoal-400" />
                </div>
                <input
                  type="text"
                  name="full_name"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  className="focus:ring-terra-400 focus:border-terra-400 block w-full pl-10 sm:text-sm border-charcoal-200 rounded-xl py-3"
                  placeholder="Nguyễn Văn A"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700">Email</label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-charcoal-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="focus:ring-terra-400 focus:border-terra-400 block w-full pl-10 sm:text-sm border-charcoal-200 rounded-xl py-3"
                  placeholder="example@gmail.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700">Số điện thoại</label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-charcoal-400" />
                </div>
                <input
                  type="text"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="focus:ring-terra-400 focus:border-terra-400 block w-full pl-10 sm:text-sm border-charcoal-200 rounded-xl py-3"
                  placeholder="0912345678"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700">Mật khẩu</label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-charcoal-400" />
                </div>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="focus:ring-terra-400 focus:border-terra-400 block w-full pl-10 sm:text-sm border-charcoal-200 rounded-xl py-3"
                  placeholder="Bao gồm số, chữ và ký tự đặc biệt"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700">Xác nhận mật khẩu</label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-charcoal-400" />
                </div>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="focus:ring-terra-400 focus:border-terra-400 block w-full pl-10 sm:text-sm border-charcoal-200 rounded-xl py-3"
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-terra-500 hover:bg-terra-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-terra-500 transition-colors disabled:opacity-50"
              >
                {loading ? 'Đang tạo...' : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Đăng ký tài khoản
                  </>
                )}
              </button>
            </div>
            
            <div className="mt-4 text-center">
              <button 
                type="button"
                onClick={onNavigateToLogin} 
                className="inline-flex items-center text-sm font-medium text-terra-600 hover:text-terra-500 bg-transparent border-none p-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại đăng nhập
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
