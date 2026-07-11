import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, LogIn, Lock, User } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

import { loginUser, loginGoogle } from '../lib/api';

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginUser({ username, password });
      login(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const data = await loginGoogle(credentialResponse.credential);
      login(data.user);
    } catch (err: any) {
      setError(err.message);
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
          Smart Rental
        </h2>
        <p className="mt-2 text-center text-sm text-charcoal-500">
          Đăng nhập để trải nghiệm hệ thống quản lý trọ
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-card sm:rounded-2xl sm:px-10 border border-charcoal-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-charcoal-700">Tài khoản / Email / SĐT</label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-charcoal-400" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="focus:ring-terra-400 focus:border-terra-400 block w-full pl-10 sm:text-sm border-charcoal-200 rounded-xl py-3"
                  placeholder="Nhập tên đăng nhập, email hoặc SĐT"
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
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-terra-400 focus:border-terra-400 block w-full pl-10 sm:text-sm border-charcoal-200 rounded-xl py-3"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <a href="#" className="font-medium text-terra-600 hover:text-terra-500">
                  Quên mật khẩu?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-terra-500 hover:bg-terra-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-terra-500 transition-colors disabled:opacity-50"
              >
                {loading ? 'Đang đăng nhập...' : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Đăng nhập
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Hoặc tiếp tục với</span>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Đăng nhập Google thất bại')}
                theme="outline"
                size="large"
                width="100%"
                text="signin_with"
                shape="rectangular"
              />
            </div>
          </div>

          <div className="mt-6 text-center text-sm">
            <p className="text-charcoal-600">
              Vui lòng liên hệ Chủ nhà trọ để được cấp tài khoản đăng nhập.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
