import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  MailCheck,
  ShieldCheck,
} from 'lucide-react';
import type { User } from '../types';
import { completeOnboarding, getGoogleOnboardingNonce, verifyGoogleOnboarding } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordField } from '../components/auth/PasswordField';
import {
  GOOGLE_OAUTH_CONFIGURATION_ERROR,
  isGoogleClientIdConfigured,
} from '../lib/googleOAuth';

interface AccountSetupProps {
  onActivated: (user: User) => void;
}

interface PasswordErrors {
  password?: string;
  confirmPassword?: string;
  general?: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AccountSetup({ onActivated }: AccountSetupProps) {
  const { user, updateUser, logout } = useAuth();
  const [nonce, setNonce] = useState('');
  const [googlePreparing, setGooglePreparing] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [passwordLoading, setPasswordLoading] = useState(false);

  const isGoogleStep = user?.nextStep === 'VERIFY_GOOGLE';
  const currentStep = isGoogleStep ? 1 : 2;

  const prepareGoogle = useCallback(async () => {
    if (!isGoogleStep) return;
    if (!isGoogleClientIdConfigured) {
      setGooglePreparing(false);
      setNonce('');
      setGoogleError(GOOGLE_OAUTH_CONFIGURATION_ERROR);
      return;
    }
    setGooglePreparing(true);
    setGoogleError('');
    setNonce('');
    try {
      const response = await getGoogleOnboardingNonce();
      setNonce(response.nonce);
    } catch (error) {
      setGoogleError(getErrorMessage(error, 'Không thể khởi tạo xác minh Google. Vui lòng thử lại.'));
    } finally {
      setGooglePreparing(false);
    }
  }, [isGoogleStep]);

  useEffect(() => {
    prepareGoogle();
  }, [prepareGoogle]);

  if (!user) return null;

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential || googleLoading) {
      setGoogleError('Google không trả về thông tin xác minh. Vui lòng thử lại.');
      return;
    }

    setGoogleLoading(true);
    setGoogleError('');
    try {
      const result = await verifyGoogleOnboarding(response.credential);
      updateUser(result.user);
    } catch (error) {
      setGoogleError(getErrorMessage(error, 'Xác minh Google thất bại. Vui lòng thử lại.'));
      await prepareGoogle();
    } finally {
      setGoogleLoading(false);
    }
  };

  const validatePasswords = () => {
    const errors: PasswordErrors = {};
    if (newPassword.length < 8) errors.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
    else if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      errors.password = 'Mật khẩu phải có chữ hoa, chữ thường và chữ số.';
    }
    if (!confirmPassword) errors.confirmPassword = 'Vui lòng nhập lại mật khẩu mới.';
    else if (newPassword !== confirmPassword) errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordLoading || !validatePasswords()) return;

    setPasswordLoading(true);
    try {
      const result = await completeOnboarding(newPassword);
      onActivated(result.user);
    } catch (error) {
      setPasswordErrors({
        general: getErrorMessage(error, 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.'),
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const passwordRules = [
    { label: 'Ít nhất 8 ký tự', valid: newPassword.length >= 8 },
    { label: 'Có chữ hoa và chữ thường', valid: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) },
    { label: 'Có ít nhất một chữ số', valid: /\d/.test(newPassword) },
  ];

  return (
    <AuthShell>
      <div className="auth-card rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_80px_-32px_rgba(43,43,43,0.28)] backdrop-blur sm:p-9">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-charcoal-500">
            {[1, 2].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] ${
                  step < currentStep
                    ? 'border-sage-500 bg-sage-500 text-white'
                    : step === currentStep
                      ? 'border-wood-600 bg-wood-600 text-white'
                      : 'border-charcoal-200 bg-white text-charcoal-400'
                }`}>
                  {step < currentStep ? <Check className="h-3.5 w-3.5" /> : step}
                </span>
                {step === 1 && <span className="hidden sm:inline">Xác minh</span>}
                {step === 2 && <span className="hidden sm:inline">Mật khẩu</span>}
                {step === 1 && <span className="mx-1 h-px w-5 bg-charcoal-200 sm:w-8" />}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal-400 transition hover:text-charcoal-700"
          >
            <LogOut className="h-3.5 w-3.5" />
            Đăng xuất
          </button>
        </div>

        {isGoogleStep ? (
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wood-50 text-wood-600">
              <MailCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-5 font-serif text-[30px] font-semibold leading-tight text-charcoal-900">
              Xác minh tài khoản Gmail
            </h2>
            <p className="mt-3 text-sm leading-6 text-charcoal-500">
              Tài khoản của bạn được quản trị viên tạo với mật khẩu tạm thời. Vui lòng liên kết tài khoản Google để bảo vệ tài khoản và tiếp tục sử dụng hệ thống.
            </p>

            <div className="mt-6 rounded-2xl border border-sage-100 bg-sage-50/80 p-4">
              <div className="flex gap-3 text-sm text-sage-800">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="leading-5">
                  {user.email
                    ? `Hãy chọn tài khoản Google khớp với email ${user.email}.`
                    : 'Google chỉ được dùng để xác minh danh tính, không thay thế bước đổi mật khẩu.'}
                </p>
              </div>
            </div>

            {googleError && (
              <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{googleError}</span>
              </div>
            )}

            <div className="mt-6 flex min-h-12 items-center justify-center rounded-2xl border border-charcoal-100 bg-charcoal-50/50 p-2">
              {!isGoogleClientIdConfigured ? (
                <button
                  type="button"
                  disabled
                  className="h-10 rounded-full border border-charcoal-200 bg-white px-6 text-sm font-semibold text-charcoal-400 disabled:cursor-not-allowed"
                >
                  Xác minh bằng Google
                </button>
              ) : googlePreparing || googleLoading ? (
                <div className="flex items-center gap-2 py-2 text-sm font-semibold text-charcoal-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {googleLoading ? 'Đang xác minh với Google...' : 'Đang chuẩn bị xác minh...'}
                </div>
              ) : nonce ? (
                <GoogleLogin
                  nonce={nonce}
                  onSuccess={handleGoogleSuccess}
                  onError={() => {
                    setGoogleError('Bạn đã hủy hoặc Google không thể hoàn tất xác minh. Vui lòng thử lại.');
                    prepareGoogle();
                  }}
                  theme="outline"
                  size="large"
                  shape="pill"
                  text="continue_with"
                  width="320"
                />
              ) : (
                <button
                  type="button"
                  onClick={prepareGoogle}
                  className="h-10 px-4 text-sm font-semibold text-wood-700 hover:underline"
                >
                  Thử khởi tạo lại xác minh Google
                </button>
              )}
            </div>

            <p className="mt-4 text-center text-xs text-charcoal-400">
              Không có tùy chọn bỏ qua bước xác minh này.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wood-50 text-wood-600">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="mt-5 font-serif text-[30px] font-semibold leading-tight text-charcoal-900">
              Tạo mật khẩu mới
            </h2>
            <p className="mt-3 text-sm leading-6 text-charcoal-500">
              {user.googleVerified
                ? 'Google đã xác minh thành công. Hãy thay mật khẩu tạm thời để hoàn tất kích hoạt tài khoản.'
                : 'Theo yêu cầu bảo mật, hãy đặt mật khẩu mới trước khi tiếp tục sử dụng hệ thống.'}
            </p>

            {user.googleVerified && (
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm font-semibold text-sage-700">
                <CheckCircle2 className="h-4 w-4" />
                Đã xác minh Google
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} noValidate className="mt-6 space-y-5">
              <PasswordField
                id="setup-new-password"
                label="Mật khẩu mới"
                value={newPassword}
                onChange={(value) => {
                  setNewPassword(value);
                  setPasswordErrors((current) => ({ ...current, password: undefined, general: undefined }));
                }}
                error={passwordErrors.password}
                autoComplete="new-password"
                disabled={passwordLoading}
              />

              <div className="grid gap-2 rounded-2xl bg-cream-100 p-4 sm:grid-cols-2">
                {passwordRules.map((rule) => (
                  <div key={rule.label} className={`flex items-center gap-2 text-xs font-medium ${
                    rule.valid ? 'text-sage-700' : 'text-charcoal-400'
                  }`}>
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full ${
                      rule.valid ? 'bg-sage-500 text-white' : 'border border-charcoal-300 bg-white'
                    }`}>
                      {rule.valid && <Check className="h-2.5 w-2.5" />}
                    </span>
                    {rule.label}
                  </div>
                ))}
              </div>

              <PasswordField
                id="setup-confirm-password"
                label="Xác nhận mật khẩu mới"
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  setPasswordErrors((current) => ({ ...current, confirmPassword: undefined, general: undefined }));
                }}
                error={passwordErrors.confirmPassword}
                autoComplete="new-password"
                disabled={passwordLoading}
              />

              {passwordErrors.general && (
                <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{passwordErrors.general}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={passwordLoading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-wood-600 px-5 text-sm font-bold text-white shadow-[0_10px_28px_-12px_rgba(117,75,46,0.85)] transition hover:-translate-y-0.5 hover:bg-wood-700 disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0"
              >
                {passwordLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang cập nhật...
                  </>
                ) : (
                  'Đổi mật khẩu và tiếp tục'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
