export const GOOGLE_OAUTH_CONFIGURATION_ERROR =
  'Google OAuth chưa được cấu hình. Vui lòng bổ sung VITE_GOOGLE_CLIENT_ID hợp lệ và khởi động lại ứng dụng.';

export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

export const isGoogleClientIdConfigured =
  googleClientId.length > 0
  && !/your_google_client_id/i.test(googleClientId)
  && !/your_google_web_client_id/i.test(googleClientId)
  && googleClientId.endsWith('.apps.googleusercontent.com');
