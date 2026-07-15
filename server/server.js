import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { dbReady, query, queryOne, run } from './db.js';
import { setupContracts } from './contracts.js';
import { setupInvoices } from './invoices.js';
import { setupRepairs } from './repairs.js';
import { setupNotifications } from './notifications.js';
import aiRoutes from './src/routes/ai.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'hostelmate-super-secret-key-2024';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const FRONTEND_GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID?.trim();
const GOOGLE_NONCE_COOKIE = 'google_onboarding_nonce';

function isValidGoogleClientId(value) {
  return typeof value === 'string'
    && value.length > 0
    && !/your_google_client_id/i.test(value)
    && !/your_google_web_client_id/i.test(value)
    && value.endsWith('.apps.googleusercontent.com');
}

function getGoogleConfigurationError() {
  if (!isValidGoogleClientId(GOOGLE_CLIENT_ID)) return 'GOOGLE_NOT_CONFIGURED';
  if (FRONTEND_GOOGLE_CLIENT_ID && FRONTEND_GOOGLE_CLIENT_ID !== GOOGLE_CLIENT_ID) {
    return 'GOOGLE_CLIENT_ID_MISMATCH';
  }
  return null;
}

const googleClient = new OAuth2Client(
  isValidGoogleClientId(GOOGLE_CLIENT_ID) ? GOOGLE_CLIENT_ID : undefined,
);

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const googleNonceCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 10 * 60 * 1000,
  path: '/api/auth/onboarding',
};

const io = new SocketIOServer(server, {
  cors: { origin: true, credentials: true },
});
app.set('io', io);

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 15000 : 1000,
  message: { error: 'Có quá nhiều yêu cầu. Vui lòng thử lại sau.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 500 : 20,
  message: { error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const onboardingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 500 : 30,
  message: { error: 'Có quá nhiều yêu cầu xác minh. Vui lòng thử lại sau.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(apiLimiter);

function hasBcryptHash(value) {
  return /^\$2[aby]\$/.test(String(value || ''));
}

async function passwordMatches(password, storedPassword) {
  const stored = String(storedPassword || '');
  if (!stored) return false;
  if (hasBcryptHash(stored)) return bcrypt.compare(String(password || ''), stored);

  const suppliedBuffer = Buffer.from(String(password || ''));
  const storedBuffer = Buffer.from(stored);
  return suppliedBuffer.length === storedBuffer.length
    && crypto.timingSafeEqual(suppliedBuffer, storedBuffer);
}

function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Mật khẩu phải có ít nhất 8 ký tự.';
  }
  if (password.length > 128) {
    return 'Mật khẩu không được vượt quá 128 ký tự.';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Mật khẩu phải có chữ hoa, chữ thường và chữ số.';
  }
  return null;
}

function getNextStep(user) {
  const createdByAdmin = Boolean(user.created_by_admin);
  const mustChangePassword = Boolean(user.must_change_password);
  const onboardingCompleted = Boolean(user.onboarding_completed);

  if (createdByAdmin && !user.google_verified_at) return 'VERIFY_GOOGLE';
  if (mustChangePassword || !onboardingCompleted) return 'CHANGE_PASSWORD';
  return 'DASHBOARD';
}

function mapTenantUser(user) {
  const nextStep = getNextStep(user);
  return {
    id: user.id,
    username: user.username,
    role: 'TENANT',
    tenant_id: user.id,
    full_name: user.ho_ten,
    phone: user.so_dien_thoai,
    email: user.email,
    createdByAdmin: Boolean(user.created_by_admin),
    googleVerified: Boolean(user.google_verified_at),
    googleVerifiedAt: user.google_verified_at || null,
    mustChangePassword: Boolean(user.must_change_password),
    passwordChangedAt: user.password_changed_at || null,
    onboardingCompleted: Boolean(user.onboarding_completed),
    accountStatus: user.account_status || 'ACTIVE',
    nextStep,
  };
}

function issueSession(res, user) {
  const nextStep = getNextStep(user);
  const token = jwt.sign({
    id: user.id,
    role: 'TENANT',
    tenant_id: user.id,
    scope: nextStep === 'DASHBOARD' ? 'FULL' : 'ONBOARDING',
  }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, sessionCookieOptions);
}

function getRequestToken(req) {
  return req.cookies?.token
    || (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null);
}

export const authenticate = async (req, res, next) => {
  const token = getRequestToken(req);
  if (!token) return res.status(401).json({ error: 'Phiên đăng nhập không tồn tại.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role === 'TENANT') {
      const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [payload.id]);
      if (!tenant) {
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc bị vô hiệu hóa.' });
      }
      if ((tenant.account_status || 'ACTIVE') !== 'ACTIVE') {
        return res.status(403).json({ error: 'Tài khoản hiện không thể truy cập hệ thống.' });
      }

      const nextStep = getNextStep(tenant);
      req.user = {
        ...payload,
        role: 'TENANT',
        tenant_id: tenant.id,
        scope: nextStep === 'DASHBOARD' ? 'FULL' : 'ONBOARDING',
      };
      req.authRecord = tenant;
      return next();
    }

    const user = await queryOne('SELECT id FROM users WHERE id = ?', [payload.id]);
    if (!user) {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc bị vô hiệu hóa.' });
    }
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
};

export const checkRole = (role) => (req, res, next) => {
  if (req.user && req.user.role === role) return next();
  return res.status(403).json({ error: 'Không có quyền truy cập.' });
};

function requireOnboardingStep(step) {
  return (req, res, next) => {
    if (!req.authRecord || getNextStep(req.authRecord) !== step) {
      return res.status(409).json({
        error: 'Trạng thái thiết lập tài khoản đã thay đổi. Vui lòng tải lại trang.',
        nextStep: req.authRecord ? getNextStep(req.authRecord) : 'DASHBOARD',
      });
    }
    return next();
  };
}

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password || username.length > 254 || password.length > 128) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu.' });
  }

  try {
    const user = await queryOne(
      'SELECT * FROM khach_thue WHERE username = ? OR so_dien_thoai = ? OR email = ?',
      [username, username, username],
    );
    if (!user || !(await passwordMatches(password, user.password))) {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu.' });
    }

    const accountStatus = user.account_status || 'ACTIVE';
    if (accountStatus === 'LOCKED') {
      return res.status(423).json({ error: 'Tài khoản đã bị khóa. Vui lòng liên hệ ban quản lý.' });
    }
    if (accountStatus !== 'ACTIVE') {
      return res.status(403).json({ error: 'Tài khoản hiện không hoạt động.' });
    }

    if (!hasBcryptHash(user.password)) {
      const upgradedHash = await bcrypt.hash(password, 12);
      await run('UPDATE khach_thue SET password = ? WHERE id = ?', [upgradedHash, user.id]);
      user.password = upgradedHash;
    }

    issueSession(res, user);
    const responseUser = mapTenantUser(user);
    return res.json({
      success: true,
      user: responseUser,
      nextStep: responseUser.nextStep,
      require_password_change: responseUser.mustChangePassword,
    });
  } catch {
    return res.status(500).json({ error: 'Không thể đăng nhập lúc này. Vui lòng thử lại.' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  if (req.user.role !== 'TENANT') {
    return res.status(403).json({ error: 'Phiên đăng nhập không thuộc cổng người thuê.' });
  }
  const responseUser = mapTenantUser(req.authRecord);
  return res.json({ user: responseUser, nextStep: responseUser.nextStep });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie(GOOGLE_NONCE_COOKIE, { path: '/api/auth/onboarding' });
  res.json({ message: 'Đã đăng xuất.' });
});

app.get(
  '/api/auth/onboarding/google-nonce',
  onboardingLimiter,
  authenticate,
  requireOnboardingStep('VERIFY_GOOGLE'),
  (req, res) => {
    const nonce = crypto.randomBytes(32).toString('base64url');
    const state = jwt.sign(
      { nonce, userId: req.user.id },
      JWT_SECRET,
      { expiresIn: '10m', audience: 'google-onboarding', issuer: 'hostelmate' },
    );
    res.cookie(GOOGLE_NONCE_COOKIE, state, googleNonceCookieOptions);
    res.json({ nonce });
  },
);

app.set('googleTokenVerifier', async (credential) => {
  const configurationError = getGoogleConfigurationError();
  if (configurationError) {
    const error = new Error(configurationError);
    error.code = configurationError;
    throw error;
  }
  return googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
});

app.post(
  '/api/auth/onboarding/google',
  onboardingLimiter,
  authenticate,
  requireOnboardingStep('VERIFY_GOOGLE'),
  async (req, res) => {
    const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
    const stateToken = req.cookies?.[GOOGLE_NONCE_COOKIE];
    if (!credential || !stateToken) {
      return res.status(400).json({ error: 'Phiên xác minh Google không hợp lệ. Vui lòng thử lại.' });
    }

    // A nonce is single-use even when verification fails; the client must request a fresh one.
    res.clearCookie(GOOGLE_NONCE_COOKIE, { path: '/api/auth/onboarding' });

    try {
      const state = jwt.verify(stateToken, JWT_SECRET, {
        audience: 'google-onboarding',
        issuer: 'hostelmate',
      });
      if (state.userId !== req.user.id) {
        return res.status(403).json({ error: 'Phiên xác minh Google không thuộc tài khoản hiện tại.' });
      }

      const verifier = app.get('googleTokenVerifier');
      const ticket = await verifier(credential);
      const payload = typeof ticket?.getPayload === 'function' ? ticket.getPayload() : ticket;
      if (!payload || payload.nonce !== state.nonce || payload.email_verified !== true) {
        return res.status(400).json({ error: 'Google không thể xác minh email của bạn.' });
      }

      const googleAccountId = String(payload.sub || '').trim();
      const googleEmail = String(payload.email || '').trim().toLowerCase();
      if (!googleAccountId || !googleEmail) {
        return res.status(400).json({ error: 'Tài khoản Google không cung cấp đủ thông tin xác minh.' });
      }

      const expectedEmail = String(req.authRecord.email || '').trim().toLowerCase();
      if (expectedEmail && expectedEmail !== googleEmail) {
        return res.status(409).json({
          error: 'Email Google không trùng với email đã đăng ký. Vui lòng chọn đúng tài khoản Google.',
        });
      }

      const linkedUser = await queryOne(
        'SELECT id FROM khach_thue WHERE google_account_id = ? AND id <> ?',
        [googleAccountId, req.user.id],
      );
      if (linkedUser) {
        return res.status(409).json({ error: 'Tài khoản Google này đã được liên kết với người dùng khác.' });
      }

      await run('BEGIN IMMEDIATE TRANSACTION');
      try {
        await run(`
          UPDATE khach_thue
          SET google_email = ?,
              google_account_id = ?,
              google_verified_at = CURRENT_TIMESTAMP,
              ngay_cap_nhat = CURRENT_TIMESTAMP
          WHERE id = ? AND google_verified_at IS NULL
        `, [googleEmail, googleAccountId, req.user.id]);
        await run('COMMIT');
      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }

      const updatedUser = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.user.id]);
      issueSession(res, updatedUser);
      const responseUser = mapTenantUser(updatedUser);
      return res.json({ success: true, user: responseUser, nextStep: responseUser.nextStep });
    } catch (error) {
      if (error?.code === 'GOOGLE_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'Xác minh Google chưa được cấu hình trên máy chủ.' });
      }
      if (error?.code === 'GOOGLE_CLIENT_ID_MISMATCH') {
        return res.status(503).json({
          error: 'Google Client ID của frontend và backend chưa đồng bộ. Vui lòng kiểm tra cấu hình máy chủ.',
        });
      }
      if (String(error?.message || '').includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Tài khoản Google này đã được liên kết với người dùng khác.' });
      }
      return res.status(400).json({ error: 'Xác minh Google thất bại hoặc đã hết hạn. Vui lòng thử lại.' });
    }
  },
);

app.post(
  '/api/auth/onboarding/change-password',
  onboardingLimiter,
  authenticate,
  requireOnboardingStep('CHANGE_PASSWORD'),
  async (req, res) => {
    const newPassword = req.body?.newPassword;
    const policyError = validateNewPassword(newPassword);
    if (policyError) return res.status(400).json({ error: policyError });

    try {
      if (await passwordMatches(newPassword, req.authRecord.password)) {
        return res.status(400).json({ error: 'Mật khẩu mới không được trùng với mật khẩu tạm thời.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await run('BEGIN IMMEDIATE TRANSACTION');
      try {
        await run(`
          UPDATE khach_thue
          SET password = ?,
              must_change_password = 0,
              password_changed_at = CURRENT_TIMESTAMP,
              onboarding_completed = 1,
              ngay_cap_nhat = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [hashedPassword, req.user.id]);
        await run('COMMIT');
      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }

      const updatedUser = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.user.id]);
      issueSession(res, updatedUser);
      const responseUser = mapTenantUser(updatedUser);
      return res.json({
        success: true,
        message: 'Kích hoạt tài khoản thành công.',
        user: responseUser,
        nextStep: responseUser.nextStep,
      });
    } catch {
      return res.status(500).json({ error: 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.' });
    }
  },
);

app.post('/api/auth/change-password', authenticate, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (req.user.role !== 'TENANT' || getNextStep(req.authRecord) !== 'DASHBOARD') {
    return res.status(403).json({ error: 'Vui lòng hoàn tất thiết lập tài khoản trước.' });
  }

  const policyError = validateNewPassword(newPassword);
  if (policyError) return res.status(400).json({ error: policyError });

  try {
    if (!(await passwordMatches(oldPassword, req.authRecord.password))) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
    }
    if (await passwordMatches(newPassword, req.authRecord.password)) {
      return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await run(`
      UPDATE khach_thue
      SET password = ?, password_changed_at = CURRENT_TIMESTAMP, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [hashedPassword, req.user.id]);
    return res.json({ message: 'Đổi mật khẩu thành công.' });
  } catch {
    return res.status(500).json({ error: 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.' });
  }
});

async function blockIncompleteOnboarding(req, res, next) {
  if (!getRequestToken(req)) return next();
  return authenticate(req, res, () => {
    if (req.user.role === 'TENANT' && getNextStep(req.authRecord) !== 'DASHBOARD') {
      return res.status(403).json({
        error: 'Vui lòng hoàn tất thiết lập tài khoản trước khi sử dụng chức năng này.',
        nextStep: getNextStep(req.authRecord),
      });
    }
    return next();
  });
}

app.use('/api', blockIncompleteOnboarding);
app.use('/api/ai', aiRoutes);
setupContracts(app, query, queryOne, run);
setupInvoices(app, query, queryOne, run);
setupRepairs(app, query, queryOne, run);
setupNotifications(app, authenticate);

if (process.env.NODE_ENV !== 'test') {
  dbReady
    .then(() => {
      server.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });
    })
    .catch((error) => {
      console.error('Server could not start because the database is unavailable:', error.message);
      process.exitCode = 1;
    });
}

export default app;
