import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../lib/api';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordField } from '../components/auth/PasswordField';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';

interface LoginErrors {
  username?: string;
  password?: string;
  general?: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Không thể đăng nhập lúc này. Vui lòng thử lại.';
}

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const validate = () => {
    const nextErrors: LoginErrors = {};
    if (!username.trim()) nextErrors.username = 'Vui lòng nhập tài khoản, email hoặc số điện thoại.';
    if (!password) nextErrors.password = 'Vui lòng nhập mật khẩu.';
    else if (password.length < 6) nextErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || !validate()) return;

    setLoading(true);
    try {
      const response = await loginUser({ username: username.trim(), password });
      login(response.user);
    } catch (error) {
      setErrors({ general: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-card rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_80px_-32px_rgba(43,43,43,0.28)] backdrop-blur sm:p-9">
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-wood-100 bg-wood-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-wood-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Cổng truy cập an toàn
          </div>
          <h2 className="font-serif text-[34px] font-semibold leading-tight text-charcoal-900">
            Chào mừng trở lại
          </h2>
          <p className="mt-2 text-sm leading-6 text-charcoal-500">
            Đăng nhập để quản lý cuộc sống thuê trọ của bạn.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="login-username" className="mb-2 block text-sm font-semibold text-charcoal-700">
              Tài khoản / Email / Số điện thoại
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-charcoal-400" />
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setErrors((current) => ({ ...current, username: undefined, general: undefined }));
                }}
                autoComplete="username"
                disabled={loading}
                aria-invalid={Boolean(errors.username)}
                aria-describedby={errors.username ? 'login-username-error' : undefined}
                placeholder="Nhập thông tin đăng nhập"
                className={`h-12 w-full rounded-2xl border bg-white pl-12 pr-4 text-sm text-charcoal-900 shadow-sm transition placeholder:text-charcoal-300 disabled:cursor-not-allowed disabled:bg-charcoal-50 ${
                  errors.username
                    ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
                    : 'border-charcoal-200 hover:border-charcoal-300 focus:border-wood-400 focus:ring-wood-100'
                }`}
              />
            </div>
            {errors.username && (
              <p id="login-username-error" className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.username}
              </p>
            )}
          </div>

          <PasswordField
            id="login-password"
            label="Mật khẩu"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined, general: undefined }));
            }}
            error={errors.password}
            disabled={loading}
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm font-semibold text-wood-600 transition hover:text-wood-800 hover:underline"
            >
              Quên mật khẩu?
            </button>
          </div>

          {errors.general && (
            <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-wood-600 px-5 text-sm font-bold text-white shadow-[0_10px_28px_-12px_rgba(117,75,46,0.85)] transition hover:-translate-y-0.5 hover:bg-wood-700 hover:shadow-[0_14px_32px_-12px_rgba(94,58,36,0.9)] disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang đăng nhập...
              </>
            ) : (
              <>
                Đăng nhập
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <p className="mt-7 border-t border-charcoal-100 pt-6 text-center text-xs leading-5 text-charcoal-400">
          Chưa có tài khoản? Vui lòng liên hệ ban quản lý để được cấp thông tin đăng nhập.
        </p>
      </div>

      <p className="mt-5 text-center text-[11px] text-charcoal-400">
        © {new Date().getFullYear()} ARBORIS · Thông tin của bạn được bảo vệ
      </p>

      <ForgotPasswordModal
        open={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </AuthShell>
  );
}
