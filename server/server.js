import express from 'express';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import crypto from 'crypto';
import http from 'http';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { query, queryOne, run, dbReady } from './db.js';
import { setupContracts } from './contracts.js';
import aiRoutes from './src/routes/ai.routes.js';
import { setupIntegratedRoutes } from './integrated-routes.js';
import { JWT_SECRET, corsOptions } from './src/config.js';
import { errorHandler } from './src/middleware/errorHandler.js';

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: corsOptions });
const port = Number(process.env.PORT || 5000);

app.set('trust proxy', 1);
app.set('io', io);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 15000, standardHeaders: true, legacyHeaders: false }));
app.use('/api/ai', aiRoutes);

// Realtime updates are only for signed-in users; the token comes from the login cookie.
io.use((socket, next) => {
  const token = /(?:^|;\s*)token=([^;]+)/.exec(socket.handshake.headers.cookie || '')?.[1];
  try {
    socket.data.user = jwt.verify(decodeURIComponent(token || ''), JWT_SECRET);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

const duplicateAccountMessage = 'Tên đăng nhập hoặc email Google đã được sử dụng.';

const validateTenantAccount = async (username, password) => {
  if (password && String(password).length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (username) {
    const admin = await queryOne('SELECT id FROM users WHERE username = ?', [String(username).trim()]);
    if (admin) return duplicateAccountMessage;
  }
  return null;
};

// Helper function to generate UUID
const generateId = () => crypto.randomUUID();
const PAYMENT_PREFIX = String(process.env.PAYMENT_PREFIX || 'HM').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'HM';
const ROOM_STATUSES = new Set(['available', 'occupied', 'maintenance']);
const INVOICE_STATUSES = new Set(['pending', 'paid', 'overdue', 'waiting_confirmation', 'review_needed']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const REPAIR_STATUSES = new Set(['new', 'in_progress', 'resolved', 'closed']);

const isNonNegativeNumber = (value) => value !== '' && value !== null && Number.isFinite(Number(value)) && Number(value) >= 0;
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(Date.parse(value));
const blankToNull = (value) => (value === undefined ? undefined : (String(value ?? '').trim() || null));
const todayInVietnam = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const csvCell = (value) => {
  const text = String(value ?? '');
  // A leading =, +, - or @ would run as a formula when the file is opened in Excel.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const validateRoom = ({ room_number, floor, area_sqm, monthly_rent, status, max_occupants }) => {
  if (room_number !== undefined && !String(room_number).trim()) return 'Vui lòng nhập mã phòng.';
  if (floor !== undefined && !(Number.isInteger(Number(floor)) && Number(floor) >= 0)) return 'Tầng không hợp lệ.';
  if (area_sqm !== undefined && !isNonNegativeNumber(area_sqm)) return 'Diện tích không hợp lệ.';
  if (monthly_rent !== undefined && !isNonNegativeNumber(monthly_rent)) return 'Giá phòng không hợp lệ.';
  if (status !== undefined && !ROOM_STATUSES.has(status)) return 'Trạng thái phòng không hợp lệ.';
  if (max_occupants !== undefined && !(Number.isInteger(Number(max_occupants)) && Number(max_occupants) >= 1)) return 'Số người tối đa phải từ 1 trở lên.';
  return null;
};

const validateInvoice = ({ invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, status }) => {
  if (!(Number.isInteger(Number(invoice_month)) && Number(invoice_month) >= 1 && Number(invoice_month) <= 12)) return 'Tháng hóa đơn không hợp lệ.';
  if (!(Number.isInteger(Number(invoice_year)) && Number(invoice_year) >= 2000)) return 'Năm hóa đơn không hợp lệ.';
  if (![room_rent, electricity_cost, water_cost, other_fees].every(isNonNegativeNumber)) return 'Các khoản tiền phải là số không âm.';
  if (!INVOICE_STATUSES.has(status)) return 'Trạng thái hóa đơn không hợp lệ.';
  return null;
};

const invoiceTotal = (rent, electricity, water, other) => Number(rent) + Number(electricity) + Number(water) + Number(other);

const duplicateInvoiceMessage = 'Phòng này đã có hóa đơn cho tháng được chọn.';

const validateReadings = (electricityOld, electricityNew, waterOld, waterNew) => {
  if (![electricityOld, electricityNew, waterOld, waterNew].every(isNonNegativeNumber)) return 'Các chỉ số điện nước không được là số âm.';
  if (Number(electricityNew) < Number(electricityOld)) return 'Chỉ số điện mới không được nhỏ hơn chỉ số cũ.';
  if (Number(waterNew) < Number(waterOld)) return 'Chỉ số nước mới không được nhỏ hơn chỉ số cũ.';
  return null;
};

const { authenticate, requireAdmin, requireTenant, canAccessRoom } = setupIntegratedRoutes(app, {
  query,
  queryOne,
  run,
  io,
  jwtSecret: JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
});
const adminOnly = [authenticate, requireAdmin];

// ----------------- SCHEMA MAPPERS (Vietnamese DB -> English API) -----------------
const mapRoom = (r) => {
  if (!r) return null;
  return {
    id: r.id,
    room_number: r.so_phong,
    floor: r.tang,
    area_sqm: r.dien_tich,
    monthly_rent: r.gia_phong,
    status: r.trang_thai,
    description: r.mo_ta,
    max_occupants: r.so_nguoi_toi_da,
    location: r.khu_vuc || '',
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
    google_email: t.google_email,
    is_locked: !!t.is_locked,
    must_change_password: !!t.must_change_password,
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
    created_at: i.ngay_tao,
    updated_at: i.ngay_cap_nhat
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

// ----------------- ROOMS API -----------------
app.get('/api/rooms', adminOnly, async (req, res) => {
  try {
    const rooms = await query('SELECT * FROM phong ORDER BY so_phong');

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

    res.json(mappedRooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms/:id', adminOnly, async (req, res) => {
  try {
    const room = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
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

app.post('/api/rooms', adminOnly, async (req, res) => {
  try {
    const id = generateId();
    const { room_number = '', floor = 1, area_sqm = 0, monthly_rent = 0, status = 'available', description = '', max_occupants = 2, location = 'Cơ sở chính' } = req.body;
    const invalid = validateRoom({ room_number, floor, area_sqm, monthly_rent, status, max_occupants });
    if (invalid) return res.status(400).json({ error: invalid });

    await run(`
      INSERT INTO phong (id, so_phong, tang, dien_tich, gia_phong, trang_thai, mo_ta, so_nguoi_toi_da, khu_vuc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, room_number, floor, area_sqm, monthly_rent, status, description, max_occupants, location]);

    const room = await queryOne('SELECT * FROM phong WHERE id = ?', [id]);
    res.status(201).json(mapRoom(room));
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Mã phòng này đã tồn tại trong hệ thống. Vui lòng chọn mã khác!' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rooms/:id', adminOnly, async (req, res) => {
  try {
    const { room_number, floor, area_sqm, monthly_rent, status, description, max_occupants, location } = req.body;

    const existing = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const invalid = validateRoom(req.body);
    if (invalid) return res.status(400).json({ error: invalid });

    const occupants = (await queryOne('SELECT COUNT(*) AS c FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1', [req.params.id]))?.c || 0;
    if (max_occupants !== undefined && Number(max_occupants) < occupants) {
      return res.status(400).json({ error: `Phòng đang có ${occupants} người ở, không thể giảm số người tối đa xuống ${max_occupants}.` });
    }
    if (status === 'available' && occupants > 0) {
      return res.status(400).json({ error: 'Phòng đang có người ở nên không thể chuyển sang trạng thái trống.' });
    }

    const updated = {
      so_phong: room_number !== undefined ? room_number : existing.so_phong,
      tang: floor !== undefined ? floor : existing.tang,
      dien_tich: area_sqm !== undefined ? area_sqm : existing.dien_tich,
      gia_phong: monthly_rent !== undefined ? monthly_rent : existing.gia_phong,
      trang_thai: status !== undefined ? status : existing.trang_thai,
      mo_ta: description !== undefined ? description : existing.mo_ta,
      so_nguoi_toi_da: max_occupants !== undefined ? max_occupants : existing.so_nguoi_toi_da,
      khu_vuc: location !== undefined ? location : existing.khu_vuc,
    };

    await run(`
      UPDATE phong 
      SET so_phong = ?, tang = ?, dien_tich = ?, gia_phong = ?, trang_thai = ?, mo_ta = ?, so_nguoi_toi_da = ?, khu_vuc = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updated.so_phong, updated.tang, updated.dien_tich, updated.gia_phong, updated.trang_thai, updated.mo_ta, updated.so_nguoi_toi_da, updated.khu_vuc, req.params.id]);

    const room = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
    res.json(mapRoom(room));
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Mã phòng này đã tồn tại trong hệ thống. Vui lòng chọn mã khác!' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rooms/:id', adminOnly, async (req, res) => {
  try {
    const activeAssign = await queryOne('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1', [req.params.id]);
    if (activeAssign) {
      return res.status(400).json({ error: 'Không thể xóa phòng đang có người thuê. Vui lòng thanh lý hợp đồng trước.' });
    }
    const unpaidInvoice = await queryOne(`SELECT id FROM hoa_don WHERE phong_id = ? AND trang_thai <> 'paid'`, [req.params.id]);
    if (unpaidInvoice) {
      return res.status(400).json({ error: 'Không thể xóa phòng còn hóa đơn chưa thanh toán.' });
    }
    await run('DELETE FROM phong WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------- TENANTS API -----------------
app.get('/api/tenants', adminOnly, async (req, res) => {
  try {
    const tenants = await query('SELECT * FROM khach_thue ORDER BY ho_ten');
    res.json(tenants.map(mapTenant));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tenants/:id', adminOnly, async (req, res) => {
  try {
    const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.params.id]);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(mapTenant(tenant));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tenants', adminOnly, async (req, res) => {
  try {
    const id = generateId();
    const { full_name, phone = '', email = '', id_card_number = '', date_of_birth = '', address = '', emergency_contact = '', notes = '', username = null, password = null, google_email = null } = req.body;
    if (!String(full_name || '').trim()) return res.status(400).json({ error: 'Vui lòng nhập họ tên người thuê.' });

    const accountError = await validateTenantAccount(username, password);
    if (accountError) return res.status(400).json({ error: accountError });
    const hashedPassword = password ? await bcrypt.hash(String(password), 10) : null;

    await run(`
      INSERT INTO khach_thue (id, ho_ten, so_dien_thoai, email, so_cccd, ngay_sinh, dia_chi, lien_he_khan_cap, ghi_chu, username, password, google_email, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, full_name, phone, email, id_card_number, date_of_birth, address, emergency_contact, notes, blankToNull(username), hashedPassword, blankToNull(google_email), hashedPassword ? 1 : 0]);

    const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [id]);
    res.status(201).json(mapTenant(tenant));
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed')) return res.status(400).json({ error: duplicateAccountMessage });
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tenants/:id', adminOnly, async (req, res) => {
  try {
    const { full_name, phone, email, id_card_number, date_of_birth, address, emergency_contact, notes, username, password, google_email } = req.body;
    const existing = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });
    if (full_name !== undefined && !String(full_name).trim()) return res.status(400).json({ error: 'Vui lòng nhập họ tên người thuê.' });

    const accountError = await validateTenantAccount(username, password);
    if (accountError) return res.status(400).json({ error: accountError });

    const nextLocked = req.body.is_locked !== undefined ? (req.body.is_locked ? 1 : 0) : existing.is_locked;
    const accountRevoked = username === null || username === '';
    // A new password or a lock ends the sessions the tenant already has open.
    const sessionsChanged = Boolean(password) || accountRevoked || (nextLocked && !existing.is_locked);

    const updated = {
      ho_ten: full_name !== undefined ? full_name : existing.ho_ten,
      so_dien_thoai: phone !== undefined ? phone : existing.so_dien_thoai,
      email: email !== undefined ? email : existing.email,
      so_cccd: id_card_number !== undefined ? id_card_number : existing.so_cccd,
      ngay_sinh: date_of_birth !== undefined ? date_of_birth : existing.ngay_sinh,
      dia_chi: address !== undefined ? address : existing.dia_chi,
      lien_he_khan_cap: emergency_contact !== undefined ? emergency_contact : existing.lien_he_khan_cap,
      ghi_chu: notes !== undefined ? notes : existing.ghi_chu,
      username: username !== undefined ? blankToNull(username) : existing.username,
      password: accountRevoked ? null : (password ? await bcrypt.hash(String(password), 10) : existing.password),
      google_email: google_email !== undefined ? blankToNull(google_email) : existing.google_email,
      is_locked: nextLocked,
      must_change_password: password ? 1 : (accountRevoked ? 0 : existing.must_change_password),
      token_version: Number(existing.token_version || 0) + (sessionsChanged ? 1 : 0),
    };

    await run(`
      UPDATE khach_thue 
      SET ho_ten = ?, so_dien_thoai = ?, email = ?, so_cccd = ?, ngay_sinh = ?, dia_chi = ?, lien_he_khan_cap = ?, ghi_chu = ?, username = ?, password = ?, google_email = ?, is_locked = ?, must_change_password = ?, token_version = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updated.ho_ten, updated.so_dien_thoai, updated.email, updated.so_cccd, updated.ngay_sinh, updated.dia_chi, updated.lien_he_khan_cap, updated.ghi_chu, updated.username, updated.password, updated.google_email, updated.is_locked, updated.must_change_password, updated.token_version, req.params.id]);

    const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.params.id]);
    res.json(mapTenant(tenant));
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed')) return res.status(400).json({ error: duplicateAccountMessage });
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tenants/:id', adminOnly, async (req, res) => {
  try {
    const activeAssign = await queryOne('SELECT id FROM hop_dong_thue WHERE khach_thue_id = ? AND dang_hoat_dong = 1', [req.params.id]);
    if (activeAssign) {
      return res.status(400).json({ error: 'Không thể xóa khách thuê đang có hợp đồng thuê phòng. Vui lòng thanh lý hợp đồng trước.' });
    }
    const unpaidInvoice = await queryOne(`SELECT id FROM hoa_don WHERE khach_thue_id = ? AND trang_thai IN ('pending', 'overdue')`, [req.params.id]);
    if (unpaidInvoice) {
      return res.status(400).json({ error: 'Không thể xóa khách thuê đang còn nợ hóa đơn chưa thanh toán.' });
    }
    await run('DELETE FROM khach_thue WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------- ROOM ASSIGNMENTS API -----------------
app.post('/api/room_assignments', adminOnly, async (req, res) => {
  try {
    const { room_id, tenant_id, start_date, deposit_amount = 0, is_primary, notes, contract_end_date } = req.body;
    if (!room_id || !tenant_id) return res.status(400).json({ error: 'Vui lòng chọn phòng và người thuê.' });
    if (!isValidDate(start_date)) return res.status(400).json({ error: 'Ngày bắt đầu không hợp lệ.' });
    if (contract_end_date && (!isValidDate(contract_end_date) || contract_end_date < start_date)) {
      return res.status(400).json({ error: 'Ngày hết hạn hợp đồng phải sau ngày bắt đầu.' });
    }
    if (!isNonNegativeNumber(deposit_amount)) return res.status(400).json({ error: 'Tiền đặt cọc không hợp lệ.' });

    const tenantExists = await queryOne('SELECT id FROM khach_thue WHERE id = ?', [tenant_id]);
    if (!tenantExists) return res.status(404).json({ error: 'Tenant not found' });

    // Check room status & capacity
    const room = await queryOne('SELECT id, trang_thai, so_nguoi_toi_da FROM phong WHERE id = ?', [room_id]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.trang_thai === 'maintenance') {
      return res.status(400).json({ error: 'Phòng đang bảo trì. Không thể thêm người.' });
    }

    // Check current occupancy count
    const currentAssignments = await query('SELECT id, khach_thue_id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1', [room_id]);
    const maxOccupants = room.so_nguoi_toi_da || 2;
    if (currentAssignments.length >= maxOccupants) {
      return res.status(400).json({ error: `Phòng đã đầy (tối đa ${maxOccupants} người).` });
    }

    // Check if tenant already has an active assignment in a DIFFERENT room
    // (Removed restriction: Tenants can now rent multiple rooms)

    // Check not already in this room
    const sameRoom = await query('SELECT id FROM hop_dong_thue WHERE khach_thue_id = ? AND phong_id = ? AND dang_hoat_dong = 1', [tenant_id, room_id]);
    if (sameRoom.length > 0) {
      return res.status(400).json({ error: 'Người thuê này đã ở phòng này rồi.' });
    }

    // Force primary if it's the first tenant
    let finalIsPrimary = is_primary;
    if (currentAssignments.length === 0) {
      finalIsPrimary = true;
    }

    // If marking as primary, unset any existing primary in the same room
    if (finalIsPrimary) {
      await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 0 WHERE phong_id = ? AND dang_hoat_dong = 1', [room_id]);
    }

    const id = generateId();
    await run(`
      INSERT INTO hop_dong_thue (id, phong_id, khach_thue_id, ngay_bat_dau, tien_dat_coc, dang_hoat_dong, la_nguoi_dai_dien, ghi_chu, ngay_het_han_hop_dong)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `, [id, room_id, tenant_id, start_date, deposit_amount, finalIsPrimary ? 1 : 0, notes || null, contract_end_date || null]);

    // Update room status to occupied
    await run("UPDATE phong SET trang_thai = 'occupied' WHERE id = ?", [room_id]);

    // --- NOTIFICATION TRIGGER ---
    const newTenant = await queryOne('SELECT ho_ten FROM khach_thue WHERE id = ?', [tenant_id]);
    const roomInfo = await queryOne('SELECT so_phong FROM phong WHERE id = ?', [room_id]);
    for (const assign of currentAssignments) {
      await run(`
        INSERT INTO notifications (sender_id, title, content, target_type, target_tenant_id, notification_type, action_url)
        VALUES ('system', ?, ?, 'tenant', ?, 'general', '/dashboard')
      `, [
        'Thành viên mới',
        `Phòng ${roomInfo?.so_phong} vừa có thêm thành viên mới: ${newTenant?.ho_ten || 'Khách thuê mới'}.`,
        assign.khach_thue_id
      ]);
    }

    // Notify the new tenant too
    await run(`
      INSERT INTO notifications (sender_id, title, content, target_type, target_tenant_id, notification_type, action_url)
      VALUES ('system', ?, ?, 'tenant', ?, 'general', '/dashboard')
    `, [
      'Chào mừng đến với hệ thống',
      `Bạn đã được thêm vào phòng ${roomInfo?.so_phong}. Chúc bạn có những trải nghiệm tuyệt vời.`,
      tenant_id
    ]);
    // ----------------------------

    const createdAssignment = await queryOne('SELECT * FROM hop_dong_thue WHERE id = ?', [id]);
    res.status(201).json(mapAssignment(createdAssignment));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/room_assignments/:id/primary', adminOnly, async (req, res) => {
  try {
    const { room_id } = req.body;
    if (!room_id) return res.status(400).json({ error: 'room_id is required' });
    const target = await queryOne('SELECT id FROM hop_dong_thue WHERE id = ? AND phong_id = ? AND dang_hoat_dong = 1', [req.params.id, room_id]);
    if (!target) return res.status(404).json({ error: 'Assignment not found' });

    // Unset all primary in room first
    await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 0 WHERE phong_id = ? AND dang_hoat_dong = 1', [room_id]);
    // Set new primary
    await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 1 WHERE id = ?', [req.params.id]);

    res.json({ message: 'Primary tenant updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/room_assignments/:id/end', adminOnly, async (req, res) => {
  try {
    const assignment = await queryOne('SELECT phong_id, la_nguoi_dai_dien, dang_hoat_dong FROM hop_dong_thue WHERE id = ?', [req.params.id]);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (!assignment.dang_hoat_dong) return res.status(400).json({ error: 'Hợp đồng này đã kết thúc.' });

    const todayStr = todayInVietnam();
    await run('UPDATE hop_dong_thue SET dang_hoat_dong = 0, ngay_ket_thuc = ? WHERE id = ?', [todayStr, req.params.id]);

    // Check if there are any remaining active assignments in the room
    const remaining = await query('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1 ORDER BY ngay_bat_dau ASC', [assignment.phong_id]);
    if (remaining.length === 0) {
      await run("UPDATE phong SET trang_thai = 'available' WHERE id = ? AND trang_thai = 'occupied'", [assignment.phong_id]);
    } else if (assignment.la_nguoi_dai_dien === 1) {
      // If the primary tenant checked out, promote the oldest remaining tenant
      await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 1 WHERE id = ?', [remaining[0].id]);
    }

    res.json({ message: 'Room assignment ended successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/room_assignments/:id/extend', adminOnly, async (req, res) => {
  try {
    const { contract_end_date } = req.body;
    if (!isValidDate(contract_end_date)) return res.status(400).json({ error: 'Ngày hết hạn hợp đồng không hợp lệ.' });
    const existing = await queryOne('SELECT ngay_bat_dau, dang_hoat_dong FROM hop_dong_thue WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });
    if (!existing.dang_hoat_dong) return res.status(400).json({ error: 'Hợp đồng này đã kết thúc.' });
    if (contract_end_date < existing.ngay_bat_dau) return res.status(400).json({ error: 'Ngày hết hạn hợp đồng phải sau ngày bắt đầu.' });
    // Clearing the stored file makes the next download regenerate the PDF with the new date.
    await run('UPDATE hop_dong_thue SET ngay_het_han_hop_dong = ?, file_hop_dong = NULL, ngay_cap_nhat = CURRENT_TIMESTAMP WHERE id = ?', [contract_end_date, req.params.id]);
    const updated = await queryOne('SELECT * FROM hop_dong_thue WHERE id = ?', [req.params.id]);
    res.json(mapAssignment(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/room_assignments/expiring', adminOnly, async (req, res) => {
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
app.get('/api/meter_readings', adminOnly, async (req, res) => {
  try {
    const data = await query(`
      SELECT mr.*, r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da
      FROM chi_so_dien_nuoc mr
      JOIN phong r ON mr.phong_id = r.id
      ORDER BY mr.ngay_ghi_so DESC
    `);

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

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/meter_readings/room/:roomId', adminOnly, async (req, res) => {
  try {
    const data = await query('SELECT * FROM chi_so_dien_nuoc WHERE phong_id = ? ORDER BY ngay_ghi_so DESC', [req.params.roomId]);
    res.json(data.map(mapReading));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/meter_readings/latest/:roomId', adminOnly, async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM chi_so_dien_nuoc WHERE phong_id = ? ORDER BY ngay_ghi_so DESC LIMIT 1', [req.params.roomId]);
    res.json(mapReading(row));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/meter_readings', adminOnly, async (req, res) => {
  try {
    const id = generateId();
    const { room_id, reading_date, electricity_old, electricity_new, water_old, water_new, electricity_price_per_unit = 3500, water_price_per_unit = 15000 } = req.body;

    if (!room_id || !reading_date || 
        electricity_old === undefined || electricity_old === null || electricity_old === '' ||
        electricity_new === undefined || electricity_new === null || electricity_new === '' ||
        water_old === undefined || water_old === null || water_old === '' ||
        water_new === undefined || water_new === null || water_new === '') {
      return res.status(400).json({ error: 'Các trường chỉ số điện nước không được để trống.' });
    }

    if (!isValidDate(reading_date)) return res.status(400).json({ error: 'Ngày ghi số không hợp lệ.' });
    const invalid = validateReadings(electricity_old, electricity_new, water_old, water_new);
    if (invalid) return res.status(400).json({ error: invalid });
    if (!isNonNegativeNumber(electricity_price_per_unit) || !isNonNegativeNumber(water_price_per_unit)) {
      return res.status(400).json({ error: 'Đơn giá điện nước không hợp lệ.' });
    }

    const monthPrefix = reading_date.substring(0, 7);
    const existingReading = await queryOne(`SELECT id FROM chi_so_dien_nuoc WHERE phong_id = ? AND ngay_ghi_so LIKE ?`, [room_id, `${monthPrefix}%`]);
    if (existingReading) {
      return res.status(400).json({ error: `Phòng này đã được chốt chỉ số điện nước trong tháng ${monthPrefix.split('-').reverse().join('/')}.` });
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

app.put('/api/meter_readings/:id', adminOnly, async (req, res) => {
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

    if (!isValidDate(updated.ngay_ghi_so)) return res.status(400).json({ error: 'Ngày ghi số không hợp lệ.' });
    const invalid = validateReadings(updated.so_dien_cu, updated.so_dien_moi, updated.so_nuoc_cu, updated.so_nuoc_moi);
    if (invalid) return res.status(400).json({ error: invalid });

    const monthPrefix = String(updated.ngay_ghi_so).substring(0, 7);
    const sameMonth = await queryOne('SELECT id FROM chi_so_dien_nuoc WHERE phong_id = ? AND ngay_ghi_so LIKE ? AND id <> ?', [updated.phong_id, `${monthPrefix}%`, req.params.id]);
    if (sameMonth) {
      return res.status(400).json({ error: `Phòng này đã được chốt chỉ số điện nước trong tháng ${monthPrefix.split('-').reverse().join('/')}.` });
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

app.delete('/api/meter_readings/:id', adminOnly, async (req, res) => {
  try {
    await run('DELETE FROM chi_so_dien_nuoc WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------- INVOICES API -----------------
app.get('/api/invoices', authenticate, async (req, res) => {
  try {
    // A tenant only ever sees their own invoices, whatever the query string says.
    const tenantId = req.user.role === 'TENANT' ? req.user.id : (req.query.tenant_id ? String(req.query.tenant_id) : null);
    const data = await query(`
      SELECT i.*, 
             r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
             t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach,
             mr.ngay_ghi_so, mr.so_dien_cu, mr.so_dien_moi, mr.so_nuoc_cu, mr.so_nuoc_moi, mr.don_gia_dien, mr.don_gia_nuoc
      FROM hoa_don i
      JOIN phong r ON i.phong_id = r.id
      LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
      LEFT JOIN chi_so_dien_nuoc mr ON i.chi_so_dien_nuoc_id = mr.id
      ${tenantId ? 'WHERE i.khach_thue_id = ? OR i.phong_id IN (SELECT phong_id FROM hop_dong_thue WHERE khach_thue_id = ? AND dang_hoat_dong = 1)' : ''}
      ORDER BY i.ngay_tao DESC
    `, tenantId ? [tenantId, tenantId] : []);

    const mapped = data.map(item => ({
      ...mapInvoice(item),
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
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invoices/export', adminOnly, async (req, res) => {
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
      csvContent += [item.ma_hoa_don || item.id, item.so_phong, item.ho_ten, item.thang_hoa_don, item.nam_hoa_don, item.tien_phong || 0, item.tien_dien || 0, item.tien_nuoc || 0, item.chi_phi_khac || 0, item.tong_tien || 0, statusText, item.han_thanh_toan].map(csvCell).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=danh_sach_hoa_don.csv');
    res.send('\ufeff' + csvContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invoices/:id', authenticate, async (req, res) => {
  try {
    const item = await queryOne(`
      SELECT i.*, 
             r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
             t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach,
             mr.ngay_ghi_so, mr.so_dien_cu, mr.so_dien_moi, mr.so_nuoc_cu, mr.so_nuoc_moi, mr.don_gia_dien, mr.don_gia_nuoc
      FROM hoa_don i
      JOIN phong r ON i.phong_id = r.id
      LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
      LEFT JOIN chi_so_dien_nuoc mr ON i.chi_so_dien_nuoc_id = mr.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!item) return res.status(404).json({ error: 'Invoice not found' });
    if (!(await canAccessRoom(req.user, item.phong_id, item.khach_thue_id))) {
      return res.status(403).json({ error: 'Không có quyền xem hóa đơn này' });
    }

    // Repair invoices created by older versions that did not assign a payment code.
    // Persisting it is required so the SePay webhook can match the transfer later.
    if (!String(item.ma_hoa_don || '').trim()) {
      const compactId = String(item.id || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      item.ma_hoa_don = `${PAYMENT_PREFIX}${compactId.slice(-10).padStart(10, '0')}`;
      await run('UPDATE hoa_don SET ma_hoa_don = ?, ngay_cap_nhat = CURRENT_TIMESTAMP WHERE id = ?', [item.ma_hoa_don, item.id]);
    }

    res.json({
      ...mapInvoice(item),
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

app.post('/api/invoices', adminOnly, async (req, res) => {
  try {
    const id = generateId();
    // The random suffix keeps two invoices created in the same millisecond from colliding.
    const invoiceCode = `${PAYMENT_PREFIX}${Date.now().toString().slice(-7)}${String(crypto.randomInt(1000)).padStart(3, '0')}`;
    const {
      room_id,
      tenant_id = null,
      meter_reading_id = null,
      invoice_month,
      invoice_year,
      room_rent,
      electricity_cost = 0,
      water_cost = 0,
      other_fees = 0,
      status = 'pending',
      due_date = null,
      notes = null,
    } = req.body;

    if (!room_id) return res.status(400).json({ error: 'Vui lòng chọn phòng.' });
    const invalid = validateInvoice({ invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, status });
    if (invalid) return res.status(400).json({ error: invalid });
    const roomExists = await queryOne('SELECT id FROM phong WHERE id = ?', [room_id]);
    if (!roomExists) return res.status(404).json({ error: 'Room not found' });
    const total_amount = invoiceTotal(room_rent, electricity_cost, water_cost, other_fees);

    await run(`
      INSERT INTO hoa_don (id, ma_hoa_don, phong_id, khach_thue_id, chi_so_dien_nuoc_id, thang_hoa_don, nam_hoa_don, tien_phong, tien_dien, tien_nuoc, chi_phi_khac, tong_tien, trang_thai, han_thanh_toan, ghi_chu)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, invoiceCode, room_id, tenant_id, meter_reading_id, invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, total_amount, status, due_date, notes]);

    const invoice = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [id]);
    res.status(201).json(mapInvoice(invoice));
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed')) return res.status(400).json({ error: duplicateInvoiceMessage });
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/invoices/:id', adminOnly, async (req, res) => {
  try {
    const { room_id, tenant_id, meter_reading_id, invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, status, due_date, notes, paid_date } = req.body;
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
      trang_thai: status !== undefined ? status : existing.trang_thai,
      han_thanh_toan: due_date !== undefined ? due_date : existing.han_thanh_toan,
      ngay_thanh_toan: paid_date !== undefined ? paid_date : existing.ngay_thanh_toan,
      ghi_chu: notes !== undefined ? notes : existing.ghi_chu,
    };

    const invalid = validateInvoice({
      invoice_month: updated.thang_hoa_don,
      invoice_year: updated.nam_hoa_don,
      room_rent: updated.tien_phong,
      electricity_cost: updated.tien_dien,
      water_cost: updated.tien_nuoc,
      other_fees: updated.chi_phi_khac,
      status: updated.trang_thai,
    });
    if (invalid) return res.status(400).json({ error: invalid });
    updated.tong_tien = invoiceTotal(updated.tien_phong, updated.tien_dien, updated.tien_nuoc, updated.chi_phi_khac);
    if (updated.trang_thai === 'paid' && !updated.ngay_thanh_toan) updated.ngay_thanh_toan = todayInVietnam();

    await run(`
      UPDATE hoa_don
      SET phong_id = ?, khach_thue_id = ?, chi_so_dien_nuoc_id = ?, thang_hoa_don = ?, nam_hoa_don = ?, tien_phong = ?, tien_dien = ?, tien_nuoc = ?, chi_phi_khac = ?, tong_tien = ?, trang_thai = ?, han_thanh_toan = ?, ngay_thanh_toan = ?, ghi_chu = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updated.phong_id, updated.khach_thue_id, updated.chi_so_dien_nuoc_id, updated.thang_hoa_don, updated.nam_hoa_don, updated.tien_phong, updated.tien_dien, updated.tien_nuoc, updated.chi_phi_khac, updated.tong_tien, updated.trang_thai, updated.han_thanh_toan, updated.ngay_thanh_toan, updated.ghi_chu, req.params.id]);

    const result = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
    io.emit('invoice_updated', { id: req.params.id, status: result.trang_thai });
    res.json(mapInvoice(result));
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed')) return res.status(400).json({ error: duplicateInvoiceMessage });
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/invoices/:id', adminOnly, async (req, res) => {
  try {
    await run('DELETE FROM hoa_don WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices/mark-overdue', authenticate, async (req, res) => {
  try {
    const today = todayInVietnam();
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

app.put('/api/invoices/:id/paid', adminOnly, async (req, res) => {
  try {
    const today = todayInVietnam();
    await run(`
      UPDATE hoa_don
      SET trang_thai = 'paid', ngay_thanh_toan = ?, phuong_thuc_thanh_toan = COALESCE(phuong_thuc_thanh_toan, 'Xác nhận thủ công'), ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [today, req.params.id]);

    const updated = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    io.emit('invoice_updated', { id: req.params.id, status: 'paid' });
    res.json(mapInvoice(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------- REPAIR REQUESTS API -----------------
app.get('/api/repair_requests', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.role === 'TENANT' ? req.user.id : (req.query.tenant_id ? String(req.query.tenant_id) : null);
    const data = await query(`
      SELECT rr.*, 
             r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
             t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach
      FROM yeu_cau_sua_chua rr
      JOIN phong r ON rr.phong_id = r.id
      LEFT JOIN khach_thue t ON rr.khach_thue_id = t.id
      ${tenantId ? 'WHERE rr.khach_thue_id = ? OR rr.phong_id IN (SELECT phong_id FROM hop_dong_thue WHERE khach_thue_id = ? AND dang_hoat_dong = 1)' : ''}
      ORDER BY rr.ngay_bao DESC
    `, tenantId ? [tenantId, tenantId] : []);

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

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/repair_requests/:id', authenticate, async (req, res) => {
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
    if (!(await canAccessRoom(req.user, item.phong_id, item.khach_thue_id))) {
      return res.status(403).json({ error: 'Không có quyền xem yêu cầu này' });
    }

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

app.post('/api/repair_requests', adminOnly, async (req, res) => {
  try {
    const id = generateId();
    const { room_id, tenant_id = null, title, description = '', priority = 'medium', status = 'new', assigned_to = null } = req.body;
    if (!room_id) return res.status(400).json({ error: 'Vui lòng chọn phòng cần sửa chữa.' });
    if (!String(title || '').trim()) return res.status(400).json({ error: 'Vui lòng nhập tiêu đề sự cố.' });
    if (!PRIORITIES.has(priority)) return res.status(400).json({ error: 'Mức độ ưu tiên không hợp lệ.' });
    if (!REPAIR_STATUSES.has(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });

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

    const created = await queryOne('SELECT * FROM yeu_cau_sua_chua WHERE id = ?', [id]);
    io.emit('repair_updated', { id, tenant_id, status, action: 'created' });
    res.status(201).json(mapRepair(created));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/repair_requests/:id', adminOnly, async (req, res) => {
  try {
    const { room_id, tenant_id, title, description, priority, status, assigned_to, resolution_notes, resolved_at } = req.body;
    const existing = await queryOne('SELECT * FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Repair request not found' });
    if (priority !== undefined && !PRIORITIES.has(priority)) return res.status(400).json({ error: 'Mức độ ưu tiên không hợp lệ.' });
    if (status !== undefined && !REPAIR_STATUSES.has(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });

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

    const result = await queryOne('SELECT * FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
    io.emit('repair_updated', {
      id: req.params.id,
      tenant_id: result?.khach_thue_id || null,
      status: result?.trang_thai || updated.trang_thai,
      action: 'updated',
    });
    res.json(mapRepair(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/repair_requests/:id', adminOnly, async (req, res) => {
  try {
    const existing = await queryOne('SELECT khach_thue_id FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
    await run('DELETE FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
    io.emit('repair_updated', { id: req.params.id, tenant_id: existing?.khach_thue_id || null, action: 'deleted' });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Tenant contract and portal routes.
setupContracts(app, query, queryOne, run, { authenticate, requireAdmin, requireTenant });

app.use('/api', (_req, res) => res.status(404).json({ error: 'Không tìm thấy API' }));
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  dbReady
    .then(() => {
      httpServer.listen(port, () => {
        console.log(`ARBORIS integrated server: http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exitCode = 1;
    });
}

export { app, httpServer };
export default app;
