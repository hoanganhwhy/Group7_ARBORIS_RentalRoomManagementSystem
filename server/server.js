import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';

dotenv.config({ path: path.join(process.cwd(), '.env') });

import cors from 'cors';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { query, queryOne, run } from './db.js';
import { setupContracts } from './contracts.js';
import { setupInvoices } from './invoices.js';
import aiRoutes from './src/routes/ai.routes.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fsPromises from 'fs/promises';

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

// Setup Socket.io
const io = new SocketIOServer(server, {
  cors: { origin: true, credentials: true }
});
app.set('io', io);

const uploadDir = path.join(process.cwd(), 'uploads', 'rooms');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG and WEBP images are allowed'));
    }
  }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Enable trust proxy because of Cloudflare Tunnel / Ngrok
app.set('trust proxy', 1);

// Security - Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15000, // Limit each IP to 15000 requests per `window` (Increased for testing)
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each IP to 1000 create account requests per `window` (Increased for testing)
  message: { error: 'Quá nhiều yêu cầu tạo tài khoản từ IP này. Vui lòng thử lại sau 1 giờ.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure CORS to allow credentials
app.use(cors({ 
  origin: true, 
  credentials: true 
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Apply general rate limiting to all requests
app.use(apiLimiter);
app.use(cookieParser());

// Mount routes
app.use('/api/ai', aiRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'hostelmate-super-secret-key-2024';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs (Increased for testing)
  message: { error: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authenticate = async (req, res, next) => {
  const token = req.cookies.token || (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    // Check token_version to ensure token wasn't invalidated
    const user = await queryOne('SELECT token_version FROM users WHERE id = ?', [payload.id]);
    const dbVersion = user ? (user.token_version || 0) : null;
    
    if (!user || dbVersion !== payload.token_version) {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc bị vô hiệu hóa' });
    }
    
    req.user = payload;
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err);
    res.status(401).json({ error: err.message || 'Invalid token' });
  }
};

export const checkRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role === role) {
      next();
    } else {
      res.status(403).json({ error: 'Không có quyền truy cập.' });
    }
  };
};

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    // Allows login via username, phone, or email
    const user = await queryOne('SELECT * FROM users WHERE username = ? OR phone = ? OR email = ?', [username, username, username]);
    if (!user) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Tài khoản đang bị khóa do nhập sai nhiều lần. Hãy thử lại sau.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = (user.login_attempts || 0) + 1;
      let lockedUntil = null;
      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await run('UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?', [attempts, lockedUntil, user.id]);
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    }
    
    // Reset attempts on success
    await run('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);

    const token = jwt.sign({ id: user.id, role: user.role, tenant_id: user.tenant_id, token_version: user.token_version || 0 }, JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user: { id: user.id, username: user.username, role: user.role, tenant_id: user.tenant_id, full_name: user.full_name, phone: user.phone, email: user.email, cccd: user.cccd, date_of_birth: user.date_of_birth, address: user.address } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/auth/google-login', async (req, res) => {
  const { token } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;
    const googleId = payload.sub;

    let user = await queryOne('SELECT * FROM users WHERE email = ? OR google_id = ?', [email, googleId]);
    
    if (!user) {
      // Create GUEST user
      const id = generateId();
      await run(`
        INSERT INTO users (id, username, password_hash, role, email, full_name, google_id)
        VALUES (?, ?, ?, 'GUEST', ?, ?, ?)
      `, [id, email, '', email, name, googleId]);
      user = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    } else if (!user.google_id) {
      await run('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
    }

    const jwtToken = jwt.sign({ id: user.id, role: user.role, tenant_id: user.tenant_id, token_version: user.token_version || 0 }, JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user: { id: user.id, username: user.username, role: user.role, tenant_id: user.tenant_id, full_name: user.full_name, email: user.email } });
  } catch (error) {
    res.status(401).json({ error: 'Đăng nhập Google thất bại' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Đăng xuất thành công' });
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await queryOne('SELECT id, username, role, tenant_id, full_name, phone, email, cccd, date_of_birth, address FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate UUID
export const generateId = () => crypto.randomUUID();

export async function generatePrefixedIdDB(tableName, prefix) {
  const row = await queryOne(`SELECT id FROM ${tableName} ORDER BY id DESC LIMIT 1`);
  let nextNum = 1;
  if (row && row.id && row.id.startsWith(prefix)) {
    const numPart = row.id.substring(prefix.length);
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }
  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

// ----------------- NOTIFICATION HELPER -----------------
export async function createNotification(io, { sender_id, target_type, target_tenant_id, notification_type, title, content, reference_id, action_url }) {
  try {
    const result = await run(`
      INSERT INTO notifications (sender_id, title, content, target_type, target_tenant_id, notification_type, reference_id, action_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [sender_id, title, content, target_type, target_tenant_id, notification_type || 'general', reference_id || null, action_url || null]);
    
    const notification_id = result.lastID;
    
    if (target_type === 'INDIVIDUAL' && target_tenant_id) {
      await run(`INSERT INTO notification_recipients (notification_id, tenant_id) VALUES (?, ?)`, [notification_id, target_tenant_id]);
    } else if (target_type === 'ALL') {
      const tenants = await query('SELECT id FROM khach_thue WHERE trang_thai = "active" OR trang_thai = "ending"');
      for (const t of tenants) {
        await run(`INSERT INTO notification_recipients (notification_id, tenant_id) VALUES (?, ?)`, [notification_id, t.id]);
      }
    } else if (target_type === 'AREA') {
      const tenants = await query(`
        SELECT k.id 
        FROM khach_thue k
        JOIN hop_dong_thue hd ON k.id = hd.khach_thue_id
        JOIN phong p ON hd.phong_id = p.id
        JOIN nha_tro nt ON p.nha_tro_id = nt.id
        WHERE nt.ten_nha_tro = ? AND (k.trang_thai = "active" OR k.trang_thai = "ending")
      `, [target_tenant_id]);
      for (const t of tenants) {
        await run(`INSERT INTO notification_recipients (notification_id, tenant_id) VALUES (?, ?)`, [notification_id, t.id]);
      }
    }

    if (io) {
      io.emit('notification', { 
        id: notification_id, 
        target_type, 
        target_tenant_id,
        notification_type
      });
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// ----------------- SCHEMA MAPPERS (Vietnamese DB -> English API) -----------------
const mapRoom = (r) => {
  if (!r) return null;
  return {
    id: r.id,
    area: r.khu_vuc,
    room_number: r.so_phong,
    floor: r.tang,
    area_sqm: r.dien_tich,
    monthly_rent: r.gia_phong,
    status: r.trang_thai,
    description: r.mo_ta,
    max_occupants: r.so_nguoi_toi_da,
    address: r.dia_chi,
    distance_km: r.khoang_cach_km,
    air_conditioner: Boolean(r.dieu_hoa),
    washing_machine: Boolean(r.may_giat),
    furnished: Boolean(r.noi_that),
    balcony: Boolean(r.ban_cong),
    image_url: r.anh_dai_dien,
    created_at: r.ngay_tao,
    updated_at: r.ngay_cap_nhat
  };
};

const mapTenant = (t) => {
  if (!t) return null;
  return {
    id: t.id,
    full_name: t.ho_ten,
    phone: t.so_dien_thoai,
    email: t.email,
    id_card_number: t.so_cccd,
    date_of_birth: t.ngay_sinh,
    address: t.dia_chi,
    emergency_contact: t.lien_he_khan_cap,
    notes: t.ghi_chu,
      username: t.username,
    created_at: t.ngay_tao,
    updated_at: t.ngay_cap_nhat
  };
};

const mapAssignment = (a) => {
  if (!a) return null;
  return {
    id: a.id,
    room_id: a.phong_id,
    tenant_id: a.khach_thue_id,
    start_date: a.ngay_bat_dau,
    end_date: a.ngay_ket_thuc,
    is_active: !!a.dang_hoat_dong,
    deposit_amount: a.tien_dat_coc,
    is_primary: !!a.la_nguoi_dai_dien,
    contract_end_date: a.ngay_het_han_hop_dong,
    notes: a.ghi_chu,
    created_at: a.ngay_tao,
    updated_at: a.ngay_cap_nhat
  };
};

const mapReading = (m) => {
  if (!m) return null;
  return {
    id: m.id,
    room_id: m.phong_id,
    reading_date: m.ngay_ghi_so,
    electricity_old: m.so_dien_cu,
    electricity_new: m.so_dien_moi,
    water_old: m.so_nuoc_cu,
    water_new: m.so_nuoc_moi,
    electricity_price_per_unit: m.don_gia_dien,
    water_price_per_unit: m.don_gia_nuoc,
    created_at: m.ngay_tao,
    updated_at: m.ngay_cap_nhat
  };
};

const mapInvoice = (i) => {
  if (!i) return null;
  return {
    id: i.id,
    ma_hoa_don: i.ma_hoa_don,
    room_id: i.phong_id,
    tenant_id: i.khach_thue_id,
    meter_reading_id: i.chi_so_dien_nuoc_id,
    invoice_month: i.thang_hoa_don,
    invoice_year: i.nam_hoa_don,
    room_rent: i.tien_phong,
    electricity_cost: i.tien_dien,
    water_cost: i.tien_nuoc,
    other_fees: i.chi_phi_khac,
    total_amount: i.tong_tien,
    status: i.trang_thai,
    due_date: i.han_thanh_toan,
    paid_date: i.ngay_thanh_toan,
    notes: i.ghi_chu,
    created_at: i.created_at || i.ngay_tao,
    updated_at: i.ngay_cap_nhat || i.updated_at
  };
};

const mapRepair = (rep) => {
  if (!rep) return null;
  return {
    id: rep.id,
    room_id: rep.phong_id,
    tenant_id: rep.khach_thue_id,
    title: rep.tieu_de,
    description: rep.mo_ta,
    priority: rep.muc_do_uu_tien,
    status: rep.trang_thai,
    reported_at: rep.ngay_bao,
    resolved_at: rep.ngay_xu_ly_xong,
    assigned_to: rep.nguoi_xu_ly,
    resolution_notes: rep.ghi_chu_giai_quyet,
    created_at: rep.ngay_tao,
    updated_at: rep.ngay_cap_nhat
  };
};

app.put('/api/auth/me', authenticate, async (req, res) => {
  const { full_name, phone, password, email, cccd, date_of_birth, address } = req.body;
  try {
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let newHash = user.password_hash;
    let newTokenVersion = user.token_version || 0;
    let newJwtNeeded = false;
    
    if (password && password.trim() !== '') {
      newHash = await bcrypt.hash(password, 10);
      newTokenVersion += 1;
      newJwtNeeded = true;
    }

    await run('UPDATE users SET full_name = ?, phone = ?, email = ?, cccd = ?, date_of_birth = ?, address = ?, password_hash = ?, token_version = ? WHERE id = ?', [
      full_name !== undefined ? full_name : user.full_name,
      phone !== undefined ? phone : user.phone,
      email !== undefined ? email : user.email,
      cccd !== undefined ? cccd : user.cccd,
      date_of_birth !== undefined ? date_of_birth : user.date_of_birth,
      address !== undefined ? address : user.address,
      newHash,
      newTokenVersion,
      req.user.id
    ]);

    // Sync to khach_thue table if tenant
    if (user.role === 'TENANT' && user.tenant_id) {
      await run(`
        UPDATE khach_thue 
        SET ho_ten = ?, so_dien_thoai = ?, email = ?, so_cccd = ?, ngay_sinh = ?, dia_chi = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        full_name !== undefined ? full_name : user.full_name,
        phone !== undefined ? phone : user.phone,
        email !== undefined ? email : user.email,
        cccd !== undefined ? cccd : user.cccd,
        date_of_birth !== undefined ? date_of_birth : user.date_of_birth,
        address !== undefined ? address : user.address,
        user.tenant_id
      ]);
    }

    if (newJwtNeeded) {
      const token = jwt.sign({ id: user.id, role: user.role, tenant_id: user.tenant_id, token_version: newTokenVersion }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }

    const updatedUser = await queryOne('SELECT id, username, role, tenant_id, full_name, phone, email, cccd, date_of_birth, address FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const getPaginationParams = (req) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// ----------------- DASHBOARD API -----------------
// ----------------- ROOMS API -----------------
app.get('/api/rooms', async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const { search, sortBy, sortOrder, status, area, floor } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (p.so_phong LIKE ? OR n.dia_chi LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status && status !== 'all') {
      whereClause += ' AND p.trang_thai = ?';
      params.push(status);
    }
    
    if (area && area !== 'all') {
      whereClause += ' AND n.ten_nha_tro = ?';
      params.push(area);
    }
    
    if (floor && floor !== 'all') {
      whereClause += ' AND p.tang = ?';
      params.push(floor);
    }

    const sortField = sortBy || 'p.so_phong';
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Verify sortField to prevent SQL Injection
    const allowedSortFields = ['p.so_phong', 'p.gia_phong', 'p.dien_tich', 'p.ngay_tao'];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'p.so_phong';

    const countResult = await queryOne(`SELECT COUNT(*) as total FROM phong p LEFT JOIN nha_tro n ON p.nha_tro_id = n.id ${whereClause}`, params);
    const totalItems = countResult.total;

    const rooms = await query(`
      SELECT p.*, n.ten_nha_tro as khu_vuc, n.dia_chi 
      FROM phong p LEFT JOIN nha_tro n ON p.nha_tro_id = n.id 
      ${whereClause}
      ORDER BY ${safeSortField} ${order}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    // Fetch all active assignments for mapping
    const assignments = await query(`
      SELECT ra.*, t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach
      FROM hop_dong_thue ra
      JOIN khach_thue t ON ra.khach_thue_id = t.id
      WHERE ra.dang_hoat_dong = 1
    `);

    // Map assignments and tenants to rooms
    const mappedRooms = rooms.map(room => {
      const roomAssignments = assignments
        .filter(a => a.phong_id === room.id)
        .map(a => ({
          id: a.id,
          room_id: a.phong_id,
          tenant_id: a.khach_thue_id,
          start_date: a.ngay_bat_dau,
          end_date: a.ngay_ket_thuc,
          is_active: !!a.dang_hoat_dong,
          is_primary: !!a.la_nguoi_dai_dien,
          deposit_amount: a.tien_dat_coc,
          notes: a.ghi_chu,
          contract_end_date: a.ngay_het_han_hop_dong,
          tenant: {
            id: a.khach_thue_id,
            full_name: a.ho_ten,
            phone: a.so_dien_thoai,
            email: a.email,
            id_card_number: a.so_cccd,
            date_of_birth: a.ngay_sinh,
            address: a.dia_chi,
            emergency_contact: a.lien_he_khan_cap,
            notes: a.ghi_chu_khach,
          }
        }));

      // Sort so primary is first
      roomAssignments.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
      const tenants = roomAssignments.map(a => a.tenant);
      const activeAssignments = roomAssignments;
      const roomDetails = mapRoom(room);

      return {
        ...roomDetails,
        current_tenant: tenants[0] || null,
        current_assignment: activeAssignments[0] || null,
        tenants,
        active_assignments: activeAssignments,
      };
    });

    res.json({
      data: mappedRooms,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms/:id', async (req, res) => {
  try {
    const room = await queryOne('SELECT p.*, n.ten_nha_tro as khu_vuc, n.dia_chi FROM phong p LEFT JOIN nha_tro n ON p.nha_tro_id = n.id WHERE p.id = ?', [req.params.id]);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const assignments = await query(`
      SELECT ra.*, t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach
      FROM hop_dong_thue ra
      JOIN khach_thue t ON ra.khach_thue_id = t.id
      WHERE ra.phong_id = ? AND ra.dang_hoat_dong = 1
    `, [room.id]);

    const activeAssignments = assignments.map(a => ({
      id: a.id,
      room_id: a.phong_id,
      tenant_id: a.khach_thue_id,
      start_date: a.ngay_bat_dau,
      end_date: a.ngay_ket_thuc,
      is_active: !!a.dang_hoat_dong,
      is_primary: !!a.la_nguoi_dai_dien,
      deposit_amount: a.tien_dat_coc,
      notes: a.ghi_chu,
      contract_end_date: a.ngay_het_han_hop_dong,
      tenant: {
        id: a.khach_thue_id,
        full_name: a.ho_ten,
        phone: a.so_dien_thoai,
        email: a.email,
        id_card_number: a.so_cccd,
        date_of_birth: a.ngay_sinh,
        address: a.dia_chi,
        emergency_contact: a.lien_he_khan_cap,
        notes: a.ghi_chu_khach,
      }
    }));

    activeAssignments.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    const currentAssignment = activeAssignments[0] || null;

    res.json({
      ...mapRoom(room),
      current_tenant: currentAssignment?.tenant || null,
      current_assignment: currentAssignment || null,
      active_assignments: activeAssignments,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms', upload.single('image'), async (req, res) => {
  try {
    const maxRow = await queryOne('SELECT MAX(id) as maxId FROM phong');
    let id = 'A00001';
    if (maxRow && maxRow.maxId) {
      const match = maxRow.maxId.match(/^([A-Z])(\d{5})$/);
      if (match) {
        let prefix = match[1];
        let num = parseInt(match[2], 10);
        num += 1;
        if (num > 10000) {
          prefix = String.fromCharCode(prefix.charCodeAt(0) + 1);
          num = 1;
        }
        id = `${prefix}${String(num).padStart(5, '0')}`;
      }
    }
    const { 
      area = 'Khu A', room_number, floor = 1, area_sqm = 0, monthly_rent = 0, status = 'available', description = '', max_occupants = 2,
      air_conditioner = false, washing_machine = false, furnished = false, balcony = false
    } = req.body;
      let anh_dai_dien = null;
      if (req.file) {
        anh_dai_dien = '/uploads/rooms/' + req.file.filename;
      }
    
    // Tìm hoặc tạo nhà trọ mới dựa trên khu vực (area)
    let nha_tro = await queryOne('SELECT id FROM nha_tro WHERE ten_nha_tro = ?', [area]);
    let nha_tro_id = 1;
    if (nha_tro) {
      nha_tro_id = nha_tro.id;
    } else {
      await run('INSERT INTO nha_tro (ten_nha_tro, dia_chi) VALUES (?, ?)', [area, area]);
      const newNhaTro = await queryOne('SELECT id FROM nha_tro WHERE ten_nha_tro = ?', [area]);
      if (newNhaTro) nha_tro_id = newNhaTro.id;
    }

    await run(`
      INSERT INTO phong (id, nha_tro_id, so_phong, tang, dien_tich, gia_phong, trang_thai, mo_ta, so_nguoi_toi_da, dieu_hoa, may_giat, noi_that, ban_cong, anh_dai_dien)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, nha_tro_id, room_number, floor, area_sqm, monthly_rent, status, description, max_occupants, air_conditioner ? 1 : 0, washing_machine ? 1 : 0, furnished ? 1 : 0, balcony ? 1 : 0]);

    const room = await queryOne('SELECT p.*, n.ten_nha_tro as khu_vuc, n.dia_chi FROM phong p LEFT JOIN nha_tro n ON p.nha_tro_id = n.id WHERE p.id = ?', [id]);
    res.status(201).json(mapRoom(room));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rooms/:id', upload.single('image'), async (req, res) => {
  try {
    const { 
        area, room_number, floor, area_sqm, monthly_rent, status, description, max_occupants,
        address, distance_km, air_conditioner, washing_machine, furnished, balcony, remove_image
      } = req.body;
    
    const existing = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

      let anh_dai_dien = existing.anh_dai_dien;
      if (req.file) {
        anh_dai_dien = '/uploads/rooms/' + req.file.filename;
        if (existing.anh_dai_dien) {
          try {
            await fsPromises.unlink(path.join(process.cwd(), existing.anh_dai_dien));
          } catch(e) {}
        }
      } else if (remove_image === 'true' || remove_image === true) {
        anh_dai_dien = null;
        if (existing.anh_dai_dien) {
          try {
            await fsPromises.unlink(path.join(process.cwd(), existing.anh_dai_dien));
          } catch(e) {}
        }
      }

    const updated = {
      khu_vuc: area !== undefined ? area : existing.khu_vuc,
      so_phong: room_number !== undefined ? room_number : existing.so_phong,
      tang: floor !== undefined ? floor : existing.tang,
      dien_tich: area_sqm !== undefined ? area_sqm : existing.dien_tich,
      gia_phong: monthly_rent !== undefined ? monthly_rent : existing.gia_phong,
    };
    
    // Tìm hoặc tạo nhà trọ mới dựa trên khu vực (area)
    let nha_tro_id = existing.nha_tro_id;
    if (area) {
      let nha_tro = await queryOne('SELECT id FROM nha_tro WHERE ten_nha_tro = ?', [area]);
      if (nha_tro) {
        nha_tro_id = nha_tro.id;
      } else {
        await run('INSERT INTO nha_tro (ten_nha_tro, dia_chi) VALUES (?, ?)', [area, area]);
        const newNhaTro = await queryOne('SELECT id FROM nha_tro WHERE ten_nha_tro = ?', [area]);
        if (newNhaTro) nha_tro_id = newNhaTro.id;
      }
    }

    await run(`
      UPDATE phong 
      SET nha_tro_id = ?, so_phong = ?, tang = ?, dien_tich = ?, gia_phong = ?, trang_thai = ?, mo_ta = ?, so_nguoi_toi_da = ?, dieu_hoa = ?, may_giat = ?, noi_that = ?, ban_cong = ?, anh_dai_dien = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      nha_tro_id,
      room_number !== undefined ? room_number : existing.so_phong,
      floor !== undefined ? floor : existing.tang,
      area_sqm !== undefined ? area_sqm : existing.dien_tich,
      monthly_rent !== undefined ? monthly_rent : existing.gia_phong,
      status !== undefined ? status : existing.trang_thai,
      description !== undefined ? description : existing.mo_ta,
      max_occupants !== undefined ? max_occupants : existing.so_nguoi_toi_da,
      air_conditioner !== undefined ? (air_conditioner ? 1 : 0) : existing.dieu_hoa,
      washing_machine !== undefined ? (washing_machine ? 1 : 0) : existing.may_giat,
      furnished !== undefined ? (furnished ? 1 : 0) : existing.noi_that,
      balcony !== undefined ? (balcony ? 1 : 0) : existing.ban_cong,
      anh_dai_dien,
      req.params.id
    ]);

    const room = await queryOne('SELECT p.*, n.ten_nha_tro as khu_vuc, n.dia_chi FROM phong p LEFT JOIN nha_tro n ON p.nha_tro_id = n.id WHERE p.id = ?', [req.params.id]);
    res.json(mapRoom(room));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    const activeAssign = await queryOne('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1', [req.params.id]);
    if (activeAssign) {
      return res.status(400).json({ error: 'Không thể xóa phòng đang có người thuê. Vui lòng thanh lý hợp đồng trước.' });
    }
    const existing = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
      if (existing && existing.anh_dai_dien) {
        try {
          await fsPromises.unlink(path.join(process.cwd(), existing.anh_dai_dien));
        } catch(e) {}
      }
      await run('DELETE FROM phong WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------- USERS API -----------------
app.get('/api/admin/users', authenticate, checkRole('ADMIN'), async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const { search, sortBy, sortOrder } = req.query;

    let whereClause = "WHERE role != 'ADMIN'";
    const params = [];

    if (search) {
      whereClause += ' AND (username LIKE ? OR email LIKE ? OR phone LIKE ? OR full_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const sortField = sortBy || 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const allowedSortFields = ['username', 'email', 'phone', 'full_name', 'created_at'];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';

    const countResult = await queryOne(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
    const totalItems = countResult.total;

    const users = await query(`
      SELECT id, username, email, phone, full_name, role, tenant_id, created_at 
      FROM users 
      ${whereClause} 
      ORDER BY ${safeSortField} ${order} 
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      data: users,
      pagination: {
        page, limit, totalItems, totalPages: Math.ceil(totalItems/limit),
        hasNextPage: page * limit < totalItems, hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/users', authenticate, checkRole('ADMIN'), async (req, res) => {
  const { username, password, full_name, phone } = req.body;
  const nameToUse = full_name?.trim() || 'Chưa cập nhật';
  const phoneToUse = phone?.trim() || '';
  
  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    const existingUser = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại.' });
    }

    // Generate a new tenant record automatically
    const tenantId = await generatePrefixedIdDB('khach_thue', 'KT');
    await run(`
      INSERT INTO khach_thue (id, ho_ten, so_dien_thoai, email)
      VALUES (?, ?, ?, '')
    `, [tenantId, nameToUse, phoneToUse]);

    const id = generateId();
    const hash = await bcrypt.hash(password, 10);
    
    await run(`
      INSERT INTO users (id, username, password_hash, role, tenant_id, full_name, phone, email)
      VALUES (?, ?, ?, 'TENANT', ?, ?, ?, '')
    `, [id, username, hash, tenantId, nameToUse, phoneToUse]);

    res.json({ success: true, message: 'Tạo tài khoản thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------- AI CHATBOT API -----------------
// Has been moved to src/routes/ai.routes.js


// ----------------- TENANTS API -----------------
app.get('/api/tenants', async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const { search, sortBy, sortOrder } = req.query;

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = 'WHERE khach_thue.ho_ten LIKE ? OR khach_thue.so_dien_thoai LIKE ? OR khach_thue.so_cccd LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const sortField = sortBy || 'ho_ten';
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const allowedSortFields = ['ho_ten', 'so_dien_thoai', 'so_cccd'];
    const safeSortField = allowedSortFields.includes(sortField) ? `khach_thue.${sortField}` : 'khach_thue.ho_ten';

    const countResult = await queryOne(`SELECT COUNT(*) as total FROM khach_thue ${whereClause}`, params);
    const totalItems = countResult.total;

    const tenants = await query(`SELECT khach_thue.*, users.username FROM khach_thue LEFT JOIN users ON khach_thue.id = users.tenant_id ${whereClause} ORDER BY ${safeSortField} ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    
    res.json({
      data: tenants.map(mapTenant),
      pagination: {
        page, limit, totalItems, totalPages: Math.ceil(totalItems/limit),
        hasNextPage: page * limit < totalItems, hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tenants/:id', async (req, res) => {
  try {
    const tenant = await queryOne('SELECT khach_thue.*, users.username FROM khach_thue LEFT JOIN users ON khach_thue.id = users.tenant_id WHERE khach_thue.id = ?', [req.params.id]);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(mapTenant(tenant));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tenants', async (req, res) => {
  try {
    const id = await generatePrefixedIdDB('khach_thue', 'KT');
    const { full_name, phone = '', email = '', id_card_number = '', date_of_birth = '', address = '', emergency_contact = '', notes = '' } = req.body;
    
    await run(`
      INSERT INTO khach_thue (id, ho_ten, so_dien_thoai, email, so_cccd, ngay_sinh, dia_chi, lien_he_khan_cap, ghi_chu)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, full_name, phone, email, id_card_number, date_of_birth, address, emergency_contact, notes]);

    // Automatically create a user account for the tenant
    try {
      const defaultPassword = 'password123';
      const hash = await bcrypt.hash(defaultPassword, 10);
      const username = id; // Enforce username to be exactly the tenant ID
      await run(`
        INSERT INTO users (id, username, password_hash, role, tenant_id, full_name, phone, email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, username, hash, 'TENANT', id, full_name, phone, email]);
    } catch (userErr) {
      console.error('Failed to create user account for tenant:', userErr);
    }

    const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [id]);
    res.status(201).json(mapTenant(tenant));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tenants/:id', async (req, res) => {
  try {
    const { full_name, phone, email, id_card_number, date_of_birth, address, emergency_contact, notes } = req.body;
    const existing = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });

    const updated = {
      ho_ten: full_name !== undefined ? full_name : existing.ho_ten,
      so_dien_thoai: phone !== undefined ? phone : existing.so_dien_thoai,
      email: email !== undefined ? email : existing.email,
      so_cccd: id_card_number !== undefined ? id_card_number : existing.so_cccd,
      ngay_sinh: date_of_birth !== undefined ? date_of_birth : existing.ngay_sinh,
      dia_chi: address !== undefined ? address : existing.dia_chi,
      lien_he_khan_cap: emergency_contact !== undefined ? emergency_contact : existing.lien_he_khan_cap,
      ghi_chu: notes !== undefined ? notes : existing.ghi_chu,
    };

    await run(`
      UPDATE khach_thue 
      SET ho_ten = ?, so_dien_thoai = ?, email = ?, so_cccd = ?, ngay_sinh = ?, dia_chi = ?, lien_he_khan_cap = ?, ghi_chu = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updated.ho_ten, updated.so_dien_thoai, updated.email, updated.so_cccd, updated.ngay_sinh, updated.dia_chi, updated.lien_he_khan_cap, updated.ghi_chu, req.params.id]);

    // Sync to users table
    try {
      await run(`
        UPDATE users 
        SET full_name = ?, phone = ?, email = ?, cccd = ?, date_of_birth = ?, address = ?
        WHERE tenant_id = ?
      `, [updated.ho_ten, updated.so_dien_thoai, updated.email, updated.so_cccd, updated.ngay_sinh, updated.dia_chi, req.params.id]);
    } catch (e) {
      console.error('Failed to sync tenant update to user account:', e);
    }

    const tenant = await queryOne('SELECT khach_thue.*, users.username FROM khach_thue LEFT JOIN users ON khach_thue.id = users.tenant_id WHERE khach_thue.id = ?', [req.params.id]);
    res.json(mapTenant(tenant));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tenants/:id', async (req, res) => {
  try {
    await run('DELETE FROM khach_thue WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------- ROOM ASSIGNMENTS API -----------------
app.post('/api/room_assignments', async (req, res) => {
  try {
    const { room_id, tenant_id, start_date, deposit_amount, is_primary, notes, contract_end_date } = req.body;

    // Check room status & capacity
    const room = await queryOne('SELECT id, trang_thai, so_nguoi_toi_da FROM phong WHERE id = ?', [room_id]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.trang_thai === 'maintenance') {
      return res.status(400).json({ error: 'Phòng đang bảo trì. Không thể thêm người.' });
    }

    // Check current occupancy count
    const currentAssignments = await query('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1', [room_id]);
    const maxOccupants = room.so_nguoi_toi_da || 2;
    if (currentAssignments.length >= maxOccupants) {
      return res.status(400).json({ error: `Phòng đã đầy (tối đa ${maxOccupants} người).` });
    }

    // Check not already in this room
    const sameRoom = await query('SELECT id FROM hop_dong_thue WHERE khach_thue_id = ? AND phong_id = ? AND dang_hoat_dong = 1', [tenant_id, room_id]);
    if (sameRoom.length > 0) {
      return res.status(400).json({ error: 'Người thuê này đã ở phòng này rồi.' });
    }

    // If marking as primary, unset any existing primary in the same room
    if (is_primary) {
      await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 0 WHERE phong_id = ? AND dang_hoat_dong = 1', [room_id]);
    }

    const id = await generatePrefixedIdDB('hop_dong_thue', 'HDT');
    await run(`
      INSERT INTO hop_dong_thue (id, phong_id, khach_thue_id, ngay_bat_dau, tien_dat_coc, dang_hoat_dong, la_nguoi_dai_dien, ghi_chu, ngay_het_han_hop_dong)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `, [id, room_id, tenant_id, start_date, deposit_amount, is_primary ? 1 : 0, notes || null, contract_end_date || null]);

    // Update room status to occupied
    await run("UPDATE phong SET trang_thai = 'occupied' WHERE id = ?", [room_id]);

    const createdAssignment = await queryOne('SELECT * FROM hop_dong_thue WHERE id = ?', [id]);
    res.status(201).json(mapAssignment(createdAssignment));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/room_assignments/:id/primary', async (req, res) => {
  try {
    const { room_id } = req.body;
    if (!room_id) return res.status(400).json({ error: 'room_id is required' });

    // Unset all primary in room first
    await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 0 WHERE phong_id = ? AND dang_hoat_dong = 1', [room_id]);
    // Set new primary
    await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 1 WHERE id = ?', [req.params.id]);

    res.json({ message: 'Primary tenant updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/room_assignments/:id/end', async (req, res) => {
  try {
    const assignment = await queryOne('SELECT phong_id FROM hop_dong_thue WHERE id = ?', [req.params.id]);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    const todayStr = new Date().toISOString().split('T')[0];
    await run('UPDATE hop_dong_thue SET dang_hoat_dong = 0, ngay_ket_thuc = ? WHERE id = ?', [todayStr, req.params.id]);

    // Check if there are any remaining active assignments in the room
    const remaining = await query('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1', [assignment.phong_id]);
    if (remaining.length === 0) {
      await run("UPDATE phong SET trang_thai = 'available' WHERE id = ?", [assignment.phong_id]);
    }

    res.json({ message: 'Room assignment ended successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/room_assignments/:id/extend', async (req, res) => {
  try {
    const { contract_end_date } = req.body;
    await run('UPDATE hop_dong_thue SET ngay_het_han_hop_dong = ? WHERE id = ?', [contract_end_date, req.params.id]);
    const updated = await queryOne('SELECT * FROM hop_dong_thue WHERE id = ?', [req.params.id]);
    res.json(mapAssignment(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/room_assignments/expiring', async (req, res) => {
  try {
    const withinDays = parseInt(req.query.withinDays || '30', 10);
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + withinDays);

    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];

    const data = await query(`
      SELECT ra.*, 
             t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach,
             r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da
      FROM hop_dong_thue ra
      JOIN khach_thue t ON ra.khach_thue_id = t.id
      JOIN phong r ON ra.phong_id = r.id
      WHERE ra.dang_hoat_dong = 1
        AND ra.ngay_het_han_hop_dong IS NOT NULL
        AND ra.ngay_het_han_hop_dong >= ?
        AND ra.ngay_het_han_hop_dong <= ?
      ORDER BY ra.ngay_het_han_hop_dong ASC
    `, [todayStr, futureStr]);

    const mapped = data.map(item => ({
      ...mapAssignment(item),
      tenant: {
        id: item.khach_thue_id,
        full_name: item.ho_ten,
        phone: item.so_dien_thoai,
        email: item.email,
        id_card_number: item.so_cccd,
        date_of_birth: item.ngay_sinh,
        address: item.dia_chi,
        emergency_contact: item.lien_he_khan_cap,
        notes: item.ghi_chu_khach,
      },
      room: {
        id: item.phong_id,
        room_number: item.so_phong,
        floor: item.tang,
        area_sqm: item.dien_tich,
        monthly_rent: item.gia_phong,
        status: item.room_status,
        description: item.room_desc,
        max_occupants: item.so_nguoi_toi_da,
      }
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------- METER READINGS API -----------------
app.get('/api/meter_readings', async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const { search, sortBy, sortOrder, month, year } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND r.so_phong LIKE ?';
      params.push(`%${search}%`);
    }

    if (month && month !== '0') {
      const monthStr = month.padStart(2, '0');
      whereClause += " AND strftime('%m', mr.ngay_ghi_so) = ?";
      params.push(monthStr);
    }

    if (year && year !== '0') {
      whereClause += " AND strftime('%Y', mr.ngay_ghi_so) = ?";
      params.push(year.toString());
    }

    const sortField = sortBy || 'mr.ngay_ghi_so';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const allowedSortFields = ['mr.ngay_ghi_so', 'r.so_phong'];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'mr.ngay_ghi_so';

    const countResult = await queryOne(`SELECT COUNT(*) as total FROM chi_so_dien_nuoc mr JOIN phong r ON mr.phong_id = r.id ${whereClause}`, params);
    const totalItems = countResult.total;

    const data = await query(`
      SELECT mr.*, r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da
      FROM chi_so_dien_nuoc mr
      JOIN phong r ON mr.phong_id = r.id
      ${whereClause}
      ORDER BY ${safeSortField} ${order}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const mapped = data.map(item => ({
      ...mapReading(item),
      room: {
        id: item.phong_id,
        room_number: item.so_phong,
        floor: item.tang,
        area_sqm: item.dien_tich,
        monthly_rent: item.gia_phong,
        status: item.room_status,
        description: item.room_desc,
        max_occupants: item.so_nguoi_toi_da,
      }
    }));

    res.json({
      data: mapped,
      pagination: {
        page, limit, totalItems, totalPages: Math.ceil(totalItems/limit),
        hasNextPage: page * limit < totalItems, hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/meter_readings/room/:roomId', async (req, res) => {
  try {
    const data = await query('SELECT * FROM chi_so_dien_nuoc WHERE phong_id = ? ORDER BY ngay_ghi_so DESC', [req.params.roomId]);
    res.json(data.map(mapReading));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/meter_readings/latest/:roomId', async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM chi_so_dien_nuoc WHERE phong_id = ? ORDER BY ngay_ghi_so DESC LIMIT 1', [req.params.roomId]);
    res.json(mapReading(row));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/meter_readings', async (req, res) => {
  try {
    const id = await generatePrefixedIdDB('chi_so_dien_nuoc', 'DN');
    const { room_id, reading_date, electricity_old, electricity_new, water_old, water_new, electricity_price_per_unit = 3500, water_price_per_unit = 15000 } = req.body;

    if (!room_id || !reading_date || 
        electricity_old === undefined || electricity_old === null || electricity_old === '' ||
        electricity_new === undefined || electricity_new === null || electricity_new === '' ||
        water_old === undefined || water_old === null || water_old === '' ||
        water_new === undefined || water_new === null || water_new === '') {
      return res.status(400).json({ error: 'Các trường chỉ số điện nước không được để trống.' });
    }

    if (Number(electricity_new) < Number(electricity_old)) {
      return res.status(400).json({ error: 'Chỉ số điện mới không được nhỏ hơn chỉ số cũ.' });
    }
    if (Number(water_new) < Number(water_old)) {
      return res.status(400).json({ error: 'Chỉ số nước mới không được nhỏ hơn chỉ số cũ.' });
    }

    await run(`
      INSERT INTO chi_so_dien_nuoc (id, phong_id, ngay_ghi_so, so_dien_cu, so_dien_moi, so_nuoc_cu, so_nuoc_moi, don_gia_dien, don_gia_nuoc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, room_id, reading_date, electricity_old, electricity_new, water_old, water_new, electricity_price_per_unit, water_price_per_unit]);

    const created = await queryOne('SELECT * FROM chi_so_dien_nuoc WHERE id = ?', [id]);
    res.status(201).json(mapReading(created));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/meter_readings/:id', async (req, res) => {
  try {
    const { room_id, reading_date, electricity_old, electricity_new, water_old, water_new, electricity_price_per_unit, water_price_per_unit } = req.body;
    const existing = await queryOne('SELECT * FROM chi_so_dien_nuoc WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Reading not found' });

    const updated = {
      phong_id: room_id !== undefined ? room_id : existing.phong_id,
      ngay_ghi_so: reading_date !== undefined ? reading_date : existing.ngay_ghi_so,
      so_dien_cu: electricity_old !== undefined ? electricity_old : existing.so_dien_cu,
      so_dien_moi: electricity_new !== undefined ? electricity_new : existing.so_dien_moi,
      so_nuoc_cu: water_old !== undefined ? water_old : existing.so_nuoc_cu,
      so_nuoc_moi: water_new !== undefined ? water_new : existing.so_nuoc_moi,
      don_gia_dien: electricity_price_per_unit !== undefined ? electricity_price_per_unit : existing.don_gia_dien,
      don_gia_nuoc: water_price_per_unit !== undefined ? water_price_per_unit : existing.don_gia_nuoc,
    };

    if (!updated.phong_id || !updated.ngay_ghi_so || 
        updated.so_dien_cu === undefined || updated.so_dien_cu === null || updated.so_dien_cu === '' ||
        updated.so_dien_moi === undefined || updated.so_dien_moi === null || updated.so_dien_moi === '' ||
        updated.so_nuoc_cu === undefined || updated.so_nuoc_cu === null || updated.so_nuoc_cu === '' ||
        updated.so_nuoc_moi === undefined || updated.so_nuoc_moi === null || updated.so_nuoc_moi === '') {
      return res.status(400).json({ error: 'Các trường chỉ số điện nước không được để trống.' });
    }

    if (Number(updated.so_dien_moi) < Number(updated.so_dien_cu)) {
      return res.status(400).json({ error: 'Chỉ số điện mới không được nhỏ hơn chỉ số cũ.' });
    }
    if (Number(updated.so_nuoc_moi) < Number(updated.so_nuoc_cu)) {
      return res.status(400).json({ error: 'Chỉ số nước mới không được nhỏ hơn chỉ số cũ.' });
    }

    await run(`
      UPDATE chi_so_dien_nuoc
      SET phong_id = ?, ngay_ghi_so = ?, so_dien_cu = ?, so_dien_moi = ?, so_nuoc_cu = ?, so_nuoc_moi = ?, don_gia_dien = ?, don_gia_nuoc = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updated.phong_id, updated.ngay_ghi_so, updated.so_dien_cu, updated.so_dien_moi, updated.so_nuoc_cu, updated.so_nuoc_moi, updated.don_gia_dien, updated.don_gia_nuoc, req.params.id]);

    const result = await queryOne('SELECT * FROM chi_so_dien_nuoc WHERE id = ?', [req.params.id]);
    res.json(mapReading(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/meter_readings/:id', async (req, res) => {
  try {
    await run('DELETE FROM chi_so_dien_nuoc WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------- INVOICES API -----------------
app.get('/api/invoices', async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const { search, sortBy, sortOrder, status, month, year, floor, area, date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (r.so_phong LIKE ? OR t.ho_ten LIKE ? OR i.ma_hoa_don LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status && status !== 'all') {
      whereClause += ' AND i.trang_thai = ?';
      params.push(status);
    }
    if (month && month !== '0') {
      whereClause += ' AND i.thang = ?';
      params.push(parseInt(month));
    }
    if (year && year !== '0') {
      whereClause += ' AND i.nam = ?';
      params.push(parseInt(year));
    }
    if (floor && floor !== 'all') {
      whereClause += ' AND r.tang = ?';
      params.push(floor);
    }
    if (area && area !== 'all') {
      whereClause += ' AND n.ten_nha_tro = ?';
      params.push(area);
    }
    if (date) {
      whereClause += ' AND i.han_thanh_toan LIKE ?';
      params.push(`${date}%`);
    }

    const sortField = sortBy || 'i.created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const allowedSortFields = ['i.created_at', 'i.ma_hoa_don', 'r.so_phong', 't.ho_ten', 'i.tong_tien', 'i.trang_thai'];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'i.created_at';

    const countResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM hoa_don i 
      JOIN phong r ON i.phong_id = r.id 
      LEFT JOIN khach_thue t ON i.khach_thue_id = t.id 
      ${whereClause}
    `, params);
    const totalItems = countResult.total;

    const data = await query(`
      SELECT i.*, 
             r.so_phong, n.ten_nha_tro as khu_vuc, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
             t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach,
             mr.ngay_ghi_so, mr.so_dien_cu, mr.so_dien_moi, mr.so_nuoc_cu, mr.so_nuoc_moi, mr.don_gia_dien, mr.don_gia_nuoc
      FROM hoa_don i
      JOIN phong r ON i.phong_id = r.id
      LEFT JOIN nha_tro n ON r.nha_tro_id = n.id
      LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
      LEFT JOIN chi_so_dien_nuoc mr ON i.chi_so_dien_nuoc_id = mr.id
      ${whereClause}
      ORDER BY ${safeSortField} ${order}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const mapped = data.map(item => ({
      ...mapInvoice(item),
      room: {
        id: item.phong_id,
        room_number: item.so_phong,
        area: item.khu_vuc,
        floor: item.tang,
        area_sqm: item.dien_tich,
        monthly_rent: item.gia_phong,
        status: item.room_status,
        description: item.room_desc,
        max_occupants: item.so_nguoi_toi_da,
      },
      tenant: item.khach_thue_id ? {
        id: item.khach_thue_id,
        full_name: item.ho_ten,
        phone: item.so_dien_thoai,
        email: item.email,
        id_card_number: item.so_cccd,
        date_of_birth: item.ngay_sinh,
        address: item.dia_chi,
        emergency_contact: item.lien_he_khan_cap,
        notes: item.ghi_chu_khach,
      } : null,
      meter_reading: item.chi_so_dien_nuoc_id ? {
        id: item.chi_so_dien_nuoc_id,
        room_id: item.phong_id,
        reading_date: item.ngay_ghi_so,
        electricity_old: item.so_dien_cu,
        electricity_new: item.so_dien_moi,
        water_old: item.so_nuoc_cu,
        water_new: item.so_nuoc_moi,
        electricity_price_per_unit: item.don_gia_dien,
        water_price_per_unit: item.don_gia_nuoc,
      } : null
    }));

    res.json({
      data: mapped,
      pagination: {
        page, limit, totalItems, totalPages: Math.ceil(totalItems/limit),
        hasNextPage: page * limit < totalItems, hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invoices/export', async (req, res) => {
  try {
    const data = await query(`
      SELECT i.*, r.so_phong, t.ho_ten
      FROM hoa_don i
      JOIN phong r ON i.phong_id = r.id
      LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
      ORDER BY i.nam_hoa_don DESC, i.thang_hoa_don DESC
    `);

    let csvContent = 'Mã hóa đơn,Số phòng,Khách thuê,Tháng,Năm,Tiền phòng,Tiền điện,Tiền nước,Phí khác,Tổng cộng,Trạng thái,Hạn thanh toán\n';
    
    data.forEach(item => {
      const statusText = item.trang_thai === 'paid' ? 'Đã thanh toán' : (item.trang_thai === 'overdue' ? 'Quá hạn' : 'Chưa thanh toán');
      csvContent += `${item.id},${item.so_phong || ''},${item.ho_ten || ''},${item.thang_hoa_don},${item.nam_hoa_don},${item.tien_phong || 0},${item.tien_dien || 0},${item.tien_nuoc || 0},${item.chi_phi_khac || 0},${item.tong_tien || 0},${statusText},${item.han_thanh_toan || ''}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=danh_sach_hoa_don.csv');
    res.send('\ufeff' + csvContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const item = await queryOne(`
      SELECT i.*, 
             r.so_phong, n.ten_nha_tro as khu_vuc, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
             t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach,
             mr.ngay_ghi_so, mr.so_dien_cu, mr.so_dien_moi, mr.so_nuoc_cu, mr.so_nuoc_moi, mr.don_gia_dien, mr.don_gia_nuoc
      FROM hoa_don i
      JOIN phong r ON i.phong_id = r.id
      LEFT JOIN nha_tro n ON r.nha_tro_id = n.id
      LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
      LEFT JOIN chi_so_dien_nuoc mr ON i.chi_so_dien_nuoc_id = mr.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!item) return res.status(404).json({ error: 'Invoice not found' });

    // Build VietQR Url
    let qrUrl = null;
    const bankId = process.env.BANK_ID;
    const accountNumber = process.env.BANK_ACCOUNT_NO;
    const accountName = process.env.BANK_ACCOUNT_NAME;
    if (bankId && accountNumber && accountName) {
      const baseUrl = `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNumber)}-compact2.png`;
      const parameters = new URLSearchParams({
        amount: String(item.tong_tien),
        addInfo: item.ma_hoa_don,
        accountName
      });
      qrUrl = `${baseUrl}?${parameters.toString()}`;
    }

    res.json({
      ...mapInvoice(item),
      qrUrl,
      room: {
        id: item.phong_id,
        room_number: item.so_phong,
        floor: item.tang,
        area_sqm: item.dien_tich,
        monthly_rent: item.gia_phong,
        status: item.room_status,
        description: item.room_desc,
        max_occupants: item.so_nguoi_toi_da,
      },
      tenant: item.khach_thue_id ? {
        id: item.khach_thue_id,
        full_name: item.ho_ten,
        phone: item.so_dien_thoai,
        email: item.email,
        id_card_number: item.so_cccd,
        date_of_birth: item.ngay_sinh,
        address: item.dia_chi,
        emergency_contact: item.lien_he_khan_cap,
        notes: item.ghi_chu_khach,
      } : null,
      meter_reading: item.chi_so_dien_nuoc_id ? {
        id: item.chi_so_dien_nuoc_id,
        room_id: item.phong_id,
        reading_date: item.ngay_ghi_so,
        electricity_old: item.so_dien_cu,
        electricity_new: item.so_dien_moi,
        water_old: item.so_nuoc_cu,
        water_new: item.so_nuoc_moi,
        electricity_price_per_unit: item.don_gia_dien,
        water_price_per_unit: item.don_gia_nuoc,
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const id = await generatePrefixedIdDB('hoa_don', 'HD');
    
    // Generate ma_hoa_don like HM + timestamp + random hex (e.g. HM1720612345ABCDEF)
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const ma_hoa_don = `HM${Math.floor(Date.now() / 1000)}${randomHex}`;

    let {
      room_id,
      tenant_id = null,
      meter_reading_id = null,
      invoice_month,
      invoice_year,
      room_rent,
      electricity_cost = 0,
      water_cost = 0,
      other_fees = 0,
      total_amount,
      status = 'pending',
      due_date = null,
      notes = null,
    } = req.body;

    meter_reading_id = meter_reading_id || null;
    tenant_id = tenant_id || null;

    await run(`
      INSERT INTO hoa_don (id, ma_hoa_don, phong_id, khach_thue_id, chi_so_dien_nuoc_id, thang_hoa_don, nam_hoa_don, tien_phong, tien_dien, tien_nuoc, chi_phi_khac, tong_tien, trang_thai, han_thanh_toan, ghi_chu)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, ma_hoa_don, room_id, tenant_id, meter_reading_id, invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, total_amount, status, due_date, notes]);

    if (tenant_id) {
      await createNotification(req.app.get('io'), {
        sender_id: 'ADMIN',
        target_type: 'INDIVIDUAL',
        target_tenant_id: tenant_id,
        notification_type: 'INVOICE_CREATED',
        title: 'Hóa đơn tháng mới',
        content: `Bạn có hóa đơn mới (Kỳ ${invoice_month}/${invoice_year}) cần thanh toán. Tổng tiền: ${Number(total_amount).toLocaleString('vi-VN')}đ`,
        reference_id: id,
        action_url: '/invoices'
      });
    }

    const invoice = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [id]);
    res.status(201).json(mapInvoice(invoice));
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const { room_id, tenant_id, meter_reading_id, invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, total_amount, status, due_date, notes, paid_date } = req.body;
    const existing = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const updated = {
      phong_id: room_id !== undefined ? room_id : existing.phong_id,
      khach_thue_id: tenant_id !== undefined ? tenant_id : existing.khach_thue_id,
      chi_so_dien_nuoc_id: meter_reading_id !== undefined ? meter_reading_id : existing.chi_so_dien_nuoc_id,
      thang_hoa_don: invoice_month !== undefined ? invoice_month : existing.thang_hoa_don,
      nam_hoa_don: invoice_year !== undefined ? invoice_year : existing.nam_hoa_don,
      tien_phong: room_rent !== undefined ? room_rent : existing.tien_phong,
      tien_dien: electricity_cost !== undefined ? electricity_cost : existing.tien_dien,
      tien_nuoc: water_cost !== undefined ? water_cost : existing.tien_nuoc,
      chi_phi_khac: other_fees !== undefined ? other_fees : existing.chi_phi_khac,
      tong_tien: total_amount !== undefined ? total_amount : existing.tong_tien,
      trang_thai: status !== undefined ? status : existing.trang_thai,
      han_thanh_toan: due_date !== undefined ? due_date : existing.han_thanh_toan,
      ngay_thanh_toan: paid_date !== undefined ? paid_date : existing.ngay_thanh_toan,
      ghi_chu: notes !== undefined ? notes : existing.ghi_chu,
    };

    await run(`
      UPDATE hoa_don
      SET phong_id = ?, khach_thue_id = ?, chi_so_dien_nuoc_id = ?, thang_hoa_don = ?, nam_hoa_don = ?, tien_phong = ?, tien_dien = ?, tien_nuoc = ?, chi_phi_khac = ?, tong_tien = ?, trang_thai = ?, han_thanh_toan = ?, ngay_thanh_toan = ?, ghi_chu = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updated.phong_id, updated.khach_thue_id, updated.chi_so_dien_nuoc_id, updated.thang_hoa_don, updated.nam_hoa_don, updated.tien_phong, updated.tien_dien, updated.tien_nuoc, updated.chi_phi_khac, updated.tong_tien, updated.trang_thai, updated.han_thanh_toan, updated.ngay_thanh_toan, updated.ghi_chu, req.params.id]);

    const result = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
    res.json(mapInvoice(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    await run('DELETE FROM hoa_don WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices/mark-overdue', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await run(`
      UPDATE hoa_don
      SET trang_thai = 'overdue'
      WHERE trang_thai = 'pending'
        AND han_thanh_toan IS NOT NULL
        AND han_thanh_toan < ?
    `, [today]);
    res.json({ message: 'Overdue invoices updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/invoices/:id/paid', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await run(`
      UPDATE hoa_don
      SET trang_thai = 'paid', ngay_thanh_toan = ?
      WHERE id = ?
    `, [today, req.params.id]);

    const updated = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
    res.json(mapInvoice(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------- REPAIR REQUESTS API -----------------
app.get('/api/landlord/contact', async (req, res) => {
  try {
    const admin = await queryOne('SELECT full_name, phone FROM users WHERE role = "ADMIN" LIMIT 1');
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json({ name: admin.full_name, phone: admin.phone });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/repair_requests', async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const { search, sortBy, sortOrder, status, month, year, floor, area, date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (r.so_phong LIKE ? OR rr.tieu_de LIKE ? OR t.ho_ten LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status && status !== 'all') {
      whereClause += ' AND rr.trang_thai = ?';
      params.push(status);
    }
    if (month && month !== '0') {
      whereClause += " AND strftime('%m', rr.ngay_bao) = ?";
      params.push(month.padStart(2, '0'));
    }
    if (year && year !== '0') {
      whereClause += " AND strftime('%Y', rr.ngay_bao) = ?";
      params.push(year.toString());
    }
    if (floor && floor !== 'all') {
      whereClause += ' AND r.tang = ?';
      params.push(floor);
    }
    if (area && area !== 'all') {
      whereClause += ' AND n.ten_nha_tro = ?';
      params.push(area);
    }
    if (date) {
      whereClause += ' AND rr.ngay_bao LIKE ?';
      params.push(`${date}%`);
    }

    const sortField = sortBy || 'rr.ngay_bao';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const allowedSortFields = ['rr.ngay_bao', 'rr.tieu_de', 'r.so_phong', 't.ho_ten', 'rr.trang_thai'];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'rr.ngay_bao';

    const countResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM yeu_cau_sua_chua rr 
      JOIN phong r ON rr.phong_id = r.id 
      LEFT JOIN khach_thue t ON rr.khach_thue_id = t.id 
      LEFT JOIN nha_tro n ON r.nha_tro_id = n.id
      ${whereClause}
    `, params);
    const totalItems = countResult.total;

    const data = await query(`
      SELECT rr.*, 
             r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da, n.ten_nha_tro as khu_vuc,
             t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach
      FROM yeu_cau_sua_chua rr
      JOIN phong r ON rr.phong_id = r.id
      LEFT JOIN khach_thue t ON rr.khach_thue_id = t.id
      LEFT JOIN nha_tro n ON r.nha_tro_id = n.id
      ${whereClause}
      ORDER BY ${safeSortField} ${order}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const mapped = data.map(item => ({
      ...mapRepair(item),
      room: {
        id: item.phong_id,
        room_number: item.so_phong,
        floor: item.tang,
        area_sqm: item.dien_tich,
        monthly_rent: item.gia_phong,
        status: item.room_status,
        description: item.room_desc,
        max_occupants: item.so_nguoi_toi_da,
      },
      tenant: item.khach_thue_id ? {
        id: item.khach_thue_id,
        full_name: item.ho_ten,
        phone: item.so_dien_thoai,
        email: item.email,
        id_card_number: item.so_cccd,
        date_of_birth: item.ngay_sinh,
        address: item.dia_chi,
        emergency_contact: item.lien_he_khan_cap,
        notes: item.ghi_chu_khach,
      } : null
    }));

    res.json({
      data: mapped,
      pagination: {
        page, limit, totalItems, totalPages: Math.ceil(totalItems/limit),
        hasNextPage: page * limit < totalItems, hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/repair_requests/:id', async (req, res) => {
  try {
    const item = await queryOne(`
      SELECT rr.*, 
             r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
             t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach
      FROM yeu_cau_sua_chua rr
      JOIN phong r ON rr.phong_id = r.id
      LEFT JOIN khach_thue t ON rr.khach_thue_id = t.id
      WHERE rr.id = ?
    `, [req.params.id]);

    if (!item) return res.status(404).json({ error: 'Repair request not found' });

    res.json({
      ...mapRepair(item),
      room: {
        id: item.phong_id,
        room_number: item.so_phong,
        floor: item.tang,
        area_sqm: item.dien_tich,
        monthly_rent: item.gia_phong,
        status: item.room_status,
        description: item.room_desc,
        max_occupants: item.so_nguoi_toi_da,
      },
      tenant: item.khach_thue_id ? {
        id: item.khach_thue_id,
        full_name: item.ho_ten,
        phone: item.so_dien_thoai,
        email: item.email,
        id_card_number: item.so_cccd,
        date_of_birth: item.ngay_sinh,
        address: item.dia_chi,
        emergency_contact: item.lien_he_khan_cap,
        notes: item.ghi_chu_khach,
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/repair_requests', async (req, res) => {
  try {
    const id = await generatePrefixedIdDB('yeu_cau_sua_chua', 'SC');
    const { room_id, tenant_id = null, title, description = '', priority = 'medium', status = 'new', assigned_to = null } = req.body;
    
    if (tenant_id) {
      const assigned = await queryOne('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND khach_thue_id = ? AND dang_hoat_dong = 1', [room_id, tenant_id]);
      if (!assigned) {
        return res.status(400).json({ error: 'Người thuê này không có hợp đồng thuê hoạt động tại phòng này.' });
      }
    }

    await run(`
      INSERT INTO yeu_cau_sua_chua (id, phong_id, khach_thue_id, tieu_de, mo_ta, muc_do_uu_tien, trang_thai, nguoi_xu_ly)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, room_id, tenant_id, title, description, priority, status, assigned_to]);

    if (tenant_id) {
      await createNotification(req.app.get('io'), {
        sender_id: tenant_id,
        target_type: 'ADMIN',
        target_tenant_id: null,
        notification_type: 'REPAIR_CREATED',
        title: 'Yêu cầu sửa chữa mới',
        content: `Khách thuê vừa tạo yêu cầu sửa chữa: ${title}`,
        reference_id: id,
        action_url: '/repairs'
      });
    }

    const created = await queryOne('SELECT * FROM yeu_cau_sua_chua WHERE id = ?', [id]);
    res.status(201).json(mapRepair(created));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/repair_requests/:id', async (req, res) => {
  try {
    const { room_id, tenant_id, title, description, priority, status, assigned_to, resolution_notes, resolved_at } = req.body;
    const existing = await queryOne('SELECT * FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Repair request not found' });

    let finalResolvedAt = resolved_at;
    if (status === 'resolved' && existing.trang_thai !== 'resolved' && !resolved_at) {
      finalResolvedAt = new Date().toISOString();
    }

    const updated = {
      phong_id: room_id !== undefined ? room_id : existing.phong_id,
      khach_thue_id: tenant_id !== undefined ? tenant_id : existing.khach_thue_id,
      tieu_de: title !== undefined ? title : existing.tieu_de,
      mo_ta: description !== undefined ? description : existing.mo_ta,
      muc_do_uu_tien: priority !== undefined ? priority : existing.muc_do_uu_tien,
      trang_thai: status !== undefined ? status : existing.trang_thai,
      nguoi_xu_ly: assigned_to !== undefined ? assigned_to : existing.nguoi_xu_ly,
      ghi_chu_giai_quyet: resolution_notes !== undefined ? resolution_notes : existing.ghi_chu_giai_quyet,
      ngay_xu_ly_xong: finalResolvedAt !== undefined ? finalResolvedAt : existing.ngay_xu_ly_xong,
    };

    await run(`
      UPDATE yeu_cau_sua_chua
      SET phong_id = ?, khach_thue_id = ?, tieu_de = ?, mo_ta = ?, muc_do_uu_tien = ?, trang_thai = ?, nguoi_xu_ly = ?, ghi_chu_giai_quyet = ?, ngay_xu_ly_xong = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updated.phong_id, updated.khach_thue_id, updated.tieu_de, updated.mo_ta, updated.muc_do_uu_tien, updated.trang_thai, updated.nguoi_xu_ly, updated.ghi_chu_giai_quyet, updated.ngay_xu_ly_xong, req.params.id]);

    if (updated.khach_thue_id && existing.trang_thai !== updated.trang_thai) {
      const statusMap = {
        'in_progress': 'đang được xử lý',
        'resolved': 'đã hoàn thành',
        'cancelled': 'đã bị hủy'
      };
      if (statusMap[updated.trang_thai]) {
        await createNotification(req.app.get('io'), {
          sender_id: 'ADMIN',
          target_type: 'INDIVIDUAL',
          target_tenant_id: updated.khach_thue_id,
          notification_type: 'REPAIR_UPDATED',
          title: 'Cập nhật yêu cầu sửa chữa',
          content: `Yêu cầu "${updated.tieu_de}" ${statusMap[updated.trang_thai]}`,
          reference_id: req.params.id,
          action_url: '/repairs'
        });
      }
    }

    const result = await queryOne('SELECT * FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
    res.json(mapRepair(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/repair_requests/:id', async (req, res) => {
  try {
    await run('DELETE FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

setupContracts(app, query, queryOne, run);
setupInvoices(app, query, queryOne, run);

// ----------------- SETTINGS API -----------------
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await queryOne('SELECT * FROM cai_dat_he_thong WHERE id = "default"');
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', async (req, res) => {
  console.log('PUT /api/settings request body:', req.body);
  const { momo_number, momo_name, bank_name, bank_account, bank_owner } = req.body;
  try {
    await run(`
      UPDATE cai_dat_he_thong 
      SET momo_number = ?, momo_name = ?, bank_name = ?, bank_account = ?, bank_owner = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = 'default'
    `, [momo_number, momo_name, bank_name, bank_account, bank_owner]);
    
    const settings = await queryOne('SELECT * FROM cai_dat_he_thong WHERE id = "default"');
    console.log('Updated settings:', settings);
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------- PAYMENTS API -----------------
// Khách thuê báo cáo đã thanh toán (Tự động xác nhận cho môi trường test)
app.post('/api/invoices/:id/report-payment', async (req, res) => {
  const invoiceId = req.params.id;
  try {
    const invoice = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [invoiceId]);
    if (!invoice) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
    if (invoice.trang_thai === 'paid') return res.status(400).json({ error: 'Hóa đơn đã được thanh toán' });
    
    // Đã sửa thành tự động xác nhận (paid) luôn thay vì chờ xác nhận (waiting_confirmation)
    await run(`
      UPDATE hoa_don 
      SET trang_thai = 'paid', ngay_thanh_toan = CURRENT_TIMESTAMP, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [invoiceId]);

    // Lấy thông tin phòng để báo cho Admin
    let roomStr = "";
    const room = await queryOne('SELECT so_phong FROM phong WHERE id = ?', [invoice.phong_id]);
    if (room) roomStr = `Phòng ${room.so_phong} `;

    await createNotification(req.app.get('io'), {
      sender_id: invoice.khach_thue_id || 'TENANT',
      target_type: 'ADMIN',
      target_tenant_id: null,
      notification_type: 'PAYMENT_SUCCESS',
      title: 'Khách thuê đã thanh toán',
      content: `${roomStr}đã chuyển khoản thành công hóa đơn tháng ${invoice.thang_hoa_don}. Tổng tiền: ${Number(invoice.tong_tien).toLocaleString('vi-VN')}đ`,
      reference_id: invoiceId,
      action_url: '/invoices'
    });

    res.json({ success: true, message: 'Đã tự động xác nhận thanh toán thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chủ nhà xác nhận đã nhận tiền
app.patch('/api/admin/invoices/:id/confirm-payment', async (req, res) => {
  const invoiceId = req.params.id;
  try {
    const invoice = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [invoiceId]);
    if (!invoice) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
    if (invoice.trang_thai !== 'waiting_confirmation') return res.status(400).json({ error: 'Hóa đơn không ở trạng thái chờ xác nhận' });
    
    await run(`
      UPDATE hoa_don 
      SET trang_thai = 'paid', ngay_thanh_toan = CURRENT_TIMESTAMP, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [invoiceId]);
    res.json({ success: true, message: 'Đã xác nhận thanh toán thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook SePay
app.post('/api/webhooks/sepay', async (req, res) => {
  const providedAuthorization = req.get("Authorization");
  const expectedAuthorization = `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}`;

  if (!process.env.SEPAY_WEBHOOK_API_KEY || providedAuthorization !== expectedAuthorization) {
    return res.status(401).json({ success: false, message: "Webhook không hợp lệ" });
  }

  const { id, accountNumber, content, transferType, transferAmount, referenceCode } = req.body;

  if (!id || !Number.isFinite(Number(transferAmount))) {
    console.log("SEPAY WEBHOOK FAIL 400. Body:", req.body);
    return res.status(400).json({ success: false, message: "Dữ liệu webhook không hợp lệ", body: req.body });
  }

  if (transferType !== "in") {
    return res.json({ success: true, ignored: true });
  }

  if (process.env.BANK_ACCOUNT_NO && String(accountNumber) !== String(process.env.BANK_ACCOUNT_NO)) {
    return res.json({ success: true, ignored: true, reason: "ACCOUNT_MISMATCH" });
  }

  const normalizedContent = String(content || "").toUpperCase();
  const codeMatch = normalizedContent.match(/HM\d+[A-F0-9]{6}/);
  const paymentCode = codeMatch?.[0] || null;

  try {
    await run(`
      INSERT OR IGNORE INTO bank_transactions (
        provider_transaction_id, account_number, transfer_amount, transfer_content, reference_code, raw_payload
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [String(id), String(accountNumber || ""), Number(transferAmount), String(content || ""), String(referenceCode || ""), JSON.stringify(req.body)]);
    
    // In sqlite, we can't easily check if INSERT OR IGNORE actually inserted without a separate SELECT, 
    // but the uniqueness of provider_transaction_id handles deduplication. Let's query to ensure it's not a duplicate processing
    
    if (!paymentCode) {
      return res.json({ success: true, matched: false, reason: "PAYMENT_CODE_NOT_FOUND" });
    }

    const invoice = await queryOne('SELECT * FROM hoa_don WHERE ma_hoa_don = ?', [paymentCode]);

    if (!invoice) {
      return res.json({ success: true, matched: false, reason: "INVOICE_NOT_FOUND" });
    }

    if (Number(transferAmount) !== Number(invoice.tong_tien)) {
      return res.json({ success: true, matched: false, reason: "AMOUNT_MISMATCH" });
    }

    await run(`
      UPDATE hoa_don
      SET trang_thai = 'paid', ngay_thanh_toan = CURRENT_TIMESTAMP, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ? AND trang_thai != 'paid' AND tong_tien = ?
    `, [invoice.id, Number(transferAmount)]);

    return res.json({ success: true, matched: true, invoiceId: invoice.id, paymentStatus: "PAID" });

  } catch (error) {
    console.error('SePay Webhook Error:', error);
    return res.status(500).json({ success: false });
  }
});

// ----------------- NOTIFICATIONS API -----------------

app.post('/api/notifications', authenticate, checkRole('ADMIN'), async (req, res) => {
  const { title, content, targetType, targetTenantId } = req.body;
  try {
    if (!title || !content || !targetType) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    await createNotification(req.app.get('io'), {
      sender_id: req.user.id,
      target_type: targetType === 'personal' ? 'INDIVIDUAL' : targetType === 'all' ? 'ALL' : 'AREA',
      target_tenant_id: targetTenantId || null,
      notification_type: 'ANNOUNCEMENT',
      title,
      content,
      reference_id: null,
      action_url: '/notifications'
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notifications/my', authenticate, async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const isArchive = req.query.archive === 'true' ? 1 : 0;
    
    if (req.user.role === 'ADMIN') {
      const countResult = await queryOne('SELECT COUNT(*) as total FROM notifications WHERE is_deleted = ?', [isArchive]);
      const totalItems = countResult.total;
      
      const unreadResult = await queryOne('SELECT COUNT(*) as unread FROM notifications WHERE target_type = "ADMIN" AND is_read = 0 AND is_deleted = ?', [isArchive]);

      const notifs = await query(`
        SELECT n.*, 
          (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id) as total_recipients,
          (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id AND nr.is_read = 1) as read_count,
          (SELECT COUNT(*) FROM notification_replies nrep WHERE nrep.notification_id = n.id) as reply_count
        FROM notifications n 
        WHERE n.is_deleted = ?
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
      `, [isArchive, limit, offset]);
      
      res.json({
        data: notifs,
        pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems/limit), hasNextPage: page * limit < totalItems, hasPreviousPage: page > 1 },
        unreadCount: unreadResult.unread
      });
    } else {
      if (!req.user.tenant_id) return res.json({ data: [], pagination: { page, limit, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false }, unreadCount: 0 });
      
      const countResult = await queryOne('SELECT COUNT(*) as total FROM notification_recipients WHERE tenant_id = ? AND is_deleted = ?', [req.user.tenant_id, isArchive]);
      const totalItems = countResult.total;

      const unreadResult = await queryOne('SELECT COUNT(*) as unread FROM notification_recipients WHERE tenant_id = ? AND is_read = 0 AND is_deleted = ?', [req.user.tenant_id, isArchive]);

      const notifs = await query(`
        SELECT n.*, nr.is_read, nr.read_at,
          (SELECT COUNT(*) FROM notification_replies nrep WHERE nrep.notification_id = n.id) as reply_count
        FROM notifications n
        JOIN notification_recipients nr ON n.id = nr.notification_id
        WHERE nr.tenant_id = ? AND nr.is_deleted = ?
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
      `, [req.user.tenant_id, isArchive, limit, offset]);

      res.json({
        data: notifs,
        pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems/limit), hasNextPage: page * limit < totalItems, hasPreviousPage: page > 1 },
        unreadCount: unreadResult.unread
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notifications/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      await run('UPDATE notifications SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    } else if (req.user.tenant_id) {
      await run('UPDATE notification_recipients SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND tenant_id = ?', [req.params.id, req.user.tenant_id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/notifications/:id/restore', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      await run('UPDATE notifications SET is_deleted = 0, deleted_at = NULL WHERE id = ?', [req.params.id]);
    } else if (req.user.tenant_id) {
      await run('UPDATE notification_recipients SET is_deleted = 0, deleted_at = NULL WHERE notification_id = ? AND tenant_id = ?', [req.params.id, req.user.tenant_id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notifications/:id', authenticate, async (req, res) => {
  try {
    const notif = await queryOne('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    if (!notif) return res.status(404).json({ error: 'Không tìm thấy thông báo' });

    // Access control
    if (req.user.role !== 'ADMIN') {
      const recipient = await queryOne('SELECT * FROM notification_recipients WHERE notification_id = ? AND tenant_id = ?', [req.params.id, req.user.tenant_id]);
      if (!recipient) return res.status(403).json({ error: 'Không có quyền truy cập' });
    }

    const replies = await query('SELECT * FROM notification_replies WHERE notification_id = ? ORDER BY created_at ASC', [req.params.id]);
    
    // For admin, fetch read status of recipients
    let recipients = [];
    if (req.user.role === 'ADMIN') {
      recipients = await query(`
        SELECT nr.*, t.ho_ten, t.so_dien_thoai
        FROM notification_recipients nr
        JOIN khach_thue t ON nr.tenant_id = t.id
        WHERE nr.notification_id = ?
      `, [req.params.id]);
    }

    res.json({ notification: notif, replies, recipients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      await run('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND target_type = "ADMIN" AND is_read = 0', [req.params.id]);
    } else if (req.user.tenant_id) {
      await run('UPDATE notification_recipients SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND tenant_id = ? AND is_read = 0', [req.params.id, req.user.tenant_id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/notifications/read-all', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      await run('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE target_type = "ADMIN" AND is_read = 0');
    } else if (req.user.tenant_id) {
      await run('UPDATE notification_recipients SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND is_read = 0', [req.user.tenant_id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/:id/replies', authenticate, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Nội dung không được để trống' });

  try {
    // Basic verification
    const notif = await queryOne('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    if (!notif) return res.status(404).json({ error: 'Không tìm thấy thông báo' });

    if (req.user.role !== 'ADMIN') {
      const recipient = await queryOne('SELECT * FROM notification_recipients WHERE notification_id = ? AND tenant_id = ?', [req.params.id, req.user.tenant_id]);
      if (!recipient) return res.status(403).json({ error: 'Không có quyền truy cập' });
    }

    await run(`
      INSERT INTO notification_replies (notification_id, sender_user_id, sender_role, content)
      VALUES (?, ?, ?, ?)
    `, [req.params.id, req.user.id, req.user.role.toLowerCase(), content]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------- FRIENDS API -----------------

app.get('/api/friends', authenticate, async (req, res) => {
  if (req.user.role !== 'TENANT') return res.json([]);
  try {
    const friends = await query(`
      SELECT f.id as request_id, f.nguoi_gui_id, f.nguoi_nhan_id, f.trang_thai, f.ngay_tao,
             k.id as tenant_id, k.ho_ten, k.so_dien_thoai
      FROM danh_ba_ban_be f
      JOIN khach_thue k ON (k.id = f.nguoi_gui_id OR k.id = f.nguoi_nhan_id)
      WHERE (f.nguoi_gui_id = ? OR f.nguoi_nhan_id = ?) 
        AND k.id != ?
    `, [req.user.tenant_id, req.user.tenant_id, req.user.tenant_id]);
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/friends/request', authenticate, async (req, res) => {
  if (req.user.role !== 'TENANT') return res.status(403).json({ error: 'Chỉ khách thuê mới được kết bạn' });
  try {
    const { phone_number } = req.body;
    const target = await queryOne('SELECT id FROM khach_thue WHERE so_dien_thoai = ?', [phone_number]);
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng với số điện thoại này' });
    if (target.id === req.user.tenant_id) return res.status(400).json({ error: 'Không thể tự kết bạn với chính mình' });
    
    const existing = await queryOne('SELECT * FROM danh_ba_ban_be WHERE (nguoi_gui_id = ? AND nguoi_nhan_id = ?) OR (nguoi_gui_id = ? AND nguoi_nhan_id = ?)', [req.user.tenant_id, target.id, target.id, req.user.tenant_id]);
    if (existing) return res.status(400).json({ error: 'Đã gửi lời mời hoặc đã là bạn bè' });
    
    const id = await generatePrefixedIdDB('danh_ba_ban_be', 'FR');
    await run('INSERT INTO danh_ba_ban_be (id, nguoi_gui_id, nguoi_nhan_id) VALUES (?, ?, ?)', [id, req.user.tenant_id, target.id]);
    
    const io = req.app.get('io');
    if (io) io.emit('friend_update', { target_id: target.id });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/friends/respond', authenticate, async (req, res) => {
  if (req.user.role !== 'TENANT') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { request_id, action } = req.body;
    const reqDb = await queryOne('SELECT * FROM danh_ba_ban_be WHERE id = ? AND nguoi_nhan_id = ? AND trang_thai = "pending"', [request_id, req.user.tenant_id]);
    if (!reqDb) return res.status(404).json({ error: 'Không tìm thấy lời mời' });
    
    if (action === 'accept') {
      await run('UPDATE danh_ba_ban_be SET trang_thai = "accepted" WHERE id = ?', [request_id]);
    } else {
      await run('DELETE FROM danh_ba_ban_be WHERE id = ?', [request_id]);
    }
    
    const io = req.app.get('io');
    if (io) io.emit('friend_update', { target_id: reqDb.nguoi_gui_id });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- CHAT API -----------------

app.get('/api/chat/my-area', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'TENANT' || !req.user.tenant_id) return res.json({ area: null });
    const t = await queryOne(`
      SELECT nt.ten_nha_tro as area 
      FROM khach_thue k 
      JOIN hop_dong_thue hd ON k.id = hd.khach_thue_id 
      JOIN phong p ON hd.phong_id = p.id 
      JOIN nha_tro nt ON p.nha_tro_id = nt.id
      WHERE k.id = ? AND hd.dang_hoat_dong = 1
    `, [req.user.tenant_id]);
    res.json({ area: t?.area || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chat', authenticate, async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const isArchive = req.query.archive === 'true' ? 1 : 0;
    const isGroup = req.query.is_group === 'true' ? 1 : 0;
    
    if (isGroup) {
      // Group chat
      const receiverId = req.query.receiver_id || 'ALL'; // 'ALL' or specific area
      
      let allowedAreas = ['ALL'];
      if (req.user.role === 'TENANT' && req.user.tenant_id) {
        // Find tenant's area
        const t = await queryOne(`
          SELECT nt.ten_nha_tro as area 
          FROM khach_thue k 
          JOIN hop_dong_thue hd ON k.id = hd.khach_thue_id 
          JOIN phong p ON hd.phong_id = p.id 
          JOIN nha_tro nt ON p.nha_tro_id = nt.id
          WHERE k.id = ? AND hd.dang_hoat_dong = 1
        `, [req.user.tenant_id]);
        if (t && t.area) {
          allowedAreas.push(t.area);
        }
      } else if (req.user.role === 'ADMIN') {
        // Admin can access all areas, so if they specify an area, we allow it.
        if (receiverId !== 'ALL') allowedAreas.push(receiverId);
      }

      if (req.user.role === 'TENANT' && !allowedAreas.includes(receiverId)) {
        return res.status(403).json({ error: 'Không có quyền truy cập khu vực này' });
      }

      const countResult = await queryOne(`SELECT COUNT(*) as total FROM chat_messages WHERE is_group_chat = 1 AND (group_type = ? OR group_type IS NULL)`, [receiverId]);
      const totalItems = countResult.total;

      const messages = await query(`
        SELECT c.*, u.full_name as sender_name 
        FROM chat_messages c
        LEFT JOIN users u ON c.sender_id = u.id
        WHERE c.is_group_chat = 1 AND (c.group_type = ? OR c.group_type IS NULL)
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `, [receiverId, limit, offset]);

      return res.json({
        data: messages.reverse(),
        pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems/limit), hasNextPage: page * limit < totalItems, hasPreviousPage: page > 1 }
      });
    }

    // 1-1 Chat
    const receiverId = req.query.receiver_id;
    if (!receiverId && req.user.role === 'ADMIN') return res.json({ data: [], pagination: { page, limit, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } }); 
    
    let target1, target2;
    if (req.user.role === 'ADMIN') {
      target1 = 'ADMIN';
      target2 = receiverId;
      // Mark as read
      await run(`
        UPDATE chat_messages 
        SET is_read = 1 
        WHERE is_group_chat = 0 AND sender_id = ? AND group_type = 'ADMIN' AND is_read = 0
      `, [target2]);
    } else {
      target1 = req.user.tenant_id;
      target2 = receiverId || 'ADMIN';
      // Mark as read
      await run(`
        UPDATE chat_messages 
        SET is_read = 1 
        WHERE is_group_chat = 0 AND sender_id = ? AND receiver_id = ? AND is_read = 0
      `, [target2, target1]);
    }

    const countResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM chat_messages 
      WHERE is_group_chat = 0 
      AND ((sender_id = ? AND (receiver_id = ? OR group_type = ?)) OR (sender_id = ? AND (receiver_id = ? OR group_type = ?)))
    `, [target1, target2, target2, target2, target1, target1]);
    const totalItems = countResult.total;

    const messages = await query(`
      SELECT c.*, u.full_name as sender_name 
      FROM chat_messages c
      LEFT JOIN users u ON c.sender_id = u.id
      WHERE c.is_group_chat = 0
      AND (
        (c.sender_id = ? AND c.receiver_id = ?) OR
        (c.sender_id = ? AND c.receiver_id = ?)
      )
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [target1, target2, target2, target1, limit, offset]);

    return res.json({
      data: messages.reverse(),
      pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems/limit), hasNextPage: page * limit < totalItems, hasPreviousPage: page > 1 }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', authenticate, async (req, res) => {
  try {
    const { content, is_group, receiver_id } = req.body;
    if (!content) return res.status(400).json({ error: 'Nội dung không được để trống' });
    
    // Group ALL is Read-Only for TENANT
    if (is_group && receiver_id === 'ALL' && req.user.role === 'TENANT') {
      return res.status(403).json({ error: 'Khách thuê chỉ được phép xem nhóm chat Tất cả khu trọ' });
    }

    let targetId = receiver_id;
    if (is_group) {
      targetId = receiver_id || 'ALL';
    } else {
      targetId = (req.user.role === 'TENANT' && !receiver_id) ? 'ADMIN' : receiver_id;
    }

    const senderId = req.user.role === 'TENANT' ? req.user.tenant_id : req.user.id;

    await run(`
      INSERT INTO chat_messages (sender_id, sender_role, receiver_id, is_group_chat, content, group_type)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [senderId, req.user.role, is_group || targetId === 'ADMIN' ? null : targetId, is_group ? 1 : 0, content, is_group || targetId === 'ADMIN' ? targetId : null]);
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('chat_message', { senderId, targetId, is_group });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/chat/:id', authenticate, async (req, res) => {
  try {
    await run('UPDATE chat_messages SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/chat/:id/restore', authenticate, async (req, res) => {
  try {
    await run('UPDATE chat_messages SET is_deleted = 0, deleted_at = NULL WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------- BADGES API -----------------
app.get('/api/badges', authenticate, async (req, res) => {
  try {
    let unreadChat = 0;
    let notifications = { total: 0, INVOICE_CREATED: 0, REPAIR_CREATED: 0, REPAIR_UPDATED: 0, PAYMENT_SUCCESS: 0, ANNOUNCEMENT: 0 };
    let invoiceCount = 0;
    let repairCount = 0;

    if (req.user.role === 'ADMIN') {
      const c = await queryOne(`SELECT COUNT(*) as count FROM chat_messages WHERE is_group_chat = 0 AND group_type = 'ADMIN' AND is_read = 0 AND is_deleted = 0`);
      unreadChat = c.count;
      
      const adminNotifs = await query(`
        SELECT notification_type, COUNT(*) as count
        FROM notifications
        WHERE target_type = 'ADMIN' AND is_read = 0 AND is_deleted = 0
        GROUP BY notification_type
      `);
      adminNotifs.forEach(n => {
        notifications[n.notification_type] = n.count;
        notifications.total += n.count;
      });

      invoiceCount = notifications.PAYMENT_SUCCESS || 0;
      repairCount = notifications.REPAIR_CREATED || 0;
    } else {
      const c = await queryOne(`SELECT COUNT(*) as count FROM chat_messages WHERE is_group_chat = 0 AND receiver_id = ? AND is_read = 0 AND is_deleted = 0`, [req.user.tenant_id]);
      unreadChat = c.count;
      
      const tenantNotifs = await query(`
        SELECT n.notification_type, COUNT(*) as count
        FROM notification_recipients nr
        JOIN notifications n ON nr.notification_id = n.id
        WHERE nr.tenant_id = ? AND nr.is_read = 0 AND nr.is_deleted = 0
        GROUP BY n.notification_type
      `, [req.user.tenant_id]);
      
      tenantNotifs.forEach(n => {
        notifications[n.notification_type] = n.count;
        notifications.total += n.count;
      });

      invoiceCount = notifications.INVOICE_CREATED || 0;
      repairCount = notifications.REPAIR_UPDATED || 0;
    }

    res.json({ 
      chat: unreadChat, 
      notifications: notifications.total, 
      invoices: invoiceCount, 
      repairs: repairCount,
      notificationDetails: notifications
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto cleanup deleted items older than 30 days
async function cleanupDeletedItems() {
  try {
    await run(`DELETE FROM chat_messages WHERE is_deleted = 1 AND deleted_at < datetime('now', '-30 days')`);
    await run(`DELETE FROM notifications WHERE is_deleted = 1 AND deleted_at < datetime('now', '-30 days')`);
    await run(`DELETE FROM notification_recipients WHERE is_deleted = 1 AND deleted_at < datetime('now', '-30 days')`);
  } catch(e) {
    console.error('Cleanup error:', e);
  }
}
setInterval(cleanupDeletedItems, 24 * 60 * 60 * 1000); // run daily
setTimeout(cleanupDeletedItems, 5000); // run 5 seconds after startup


// Start server
if (process.env.NODE_ENV !== 'test') {
  server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

export default app;
