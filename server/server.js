import './env.js';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { query, queryOne, run } from './db.js';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper function to generate UUID
const generateId = () => crypto.randomUUID();


const sanitizePaymentPrefix = (value) => {
  const sanitized = String(value || 'HM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return sanitized || 'HM';
};

const getPaymentPrefix = () => sanitizePaymentPrefix(process.env.PAYMENT_PREFIX);

const createPaymentCode = (invoiceId) => {
  const digest = crypto.createHash('sha256').update(String(invoiceId)).digest('hex').slice(0, 24).toUpperCase();
  return `${getPaymentPrefix()}${digest}`;
};

const getBankConfig = () => ({
  bankId: String(process.env.BANK_ID || '').trim(),
  accountNumber: String(process.env.BANK_ACCOUNT_NO || '').trim(),
  accountName: String(process.env.BANK_ACCOUNT_NAME || '').trim(),
  template: String(process.env.VIETQR_TEMPLATE || 'compact2').trim() || 'compact2',
});

const buildVietQrUrl = ({ bankId, accountNumber, accountName, template }, amount, paymentCode) => {
  const safeBankId = encodeURIComponent(bankId);
  const safeAccount = encodeURIComponent(accountNumber);
  const safeTemplate = encodeURIComponent(template);
  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(Number(amount) || 0))),
    addInfo: paymentCode,
    accountName,
  });
  return `https://img.vietqr.io/image/${safeBankId}-${safeAccount}-${safeTemplate}.png?${params.toString()}`;
};

const ensureInvoicePayment = async (invoice) => {
  const paymentCode = createPaymentCode(invoice.id);
  await run(`
    INSERT OR IGNORE INTO thanh_toan_hoa_don
      (hoa_don_id, ma_thanh_toan, so_tien_yeu_cau, so_tien_da_nhan, trang_thai)
    VALUES (?, ?, ?, 0, 'pending')
  `, [invoice.id, paymentCode, Number(invoice.tong_tien) || 0]);

  await run(`
    UPDATE thanh_toan_hoa_don
    SET so_tien_yeu_cau = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
    WHERE hoa_don_id = ?
  `, [Number(invoice.tong_tien) || 0, invoice.id]);

  return queryOne('SELECT * FROM thanh_toan_hoa_don WHERE hoa_don_id = ?', [invoice.id]);
};

const secureEqual = (actual, expected) => {
  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractPaymentCode = (payload) => {
  const prefix = getPaymentPrefix();
  const pattern = new RegExp(`${escapeRegex(prefix)}[A-F0-9]{24}`, 'i');
  const candidates = [payload?.code, payload?.content, payload?.description]
    .filter(Boolean)
    .map((value) => String(value));

  for (const candidate of candidates) {
    const match = candidate.match(pattern);
    if (match) return match[0].toUpperCase();
  }
  return null;
};

const mapBankTransaction = (item) => ({
  id: item.id,
  provider: item.nha_cung_cap,
  provider_transaction_id: item.ma_giao_dich_ncc,
  reference_code: item.ma_tham_chieu,
  gateway: item.ngan_hang,
  account_number: item.so_tai_khoan,
  transfer_type: item.loai_giao_dich,
  amount: Number(item.so_tien) || 0,
  accumulated: item.so_du_sau_giao_dich === null ? null : Number(item.so_du_sau_giao_dich),
  content: item.noi_dung,
  payment_code: item.ma_thanh_toan,
  invoice_id: item.hoa_don_id,
  transaction_date: item.thoi_gian_giao_dich,
  created_at: item.ngay_tao,
});

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
app.get('/api/rooms', async (req, res) => {
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

app.get('/api/rooms/:id', async (req, res) => {
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

app.post('/api/rooms', async (req, res) => {
  try {
    const id = generateId();
    const { room_number, floor = 1, area_sqm = 0, monthly_rent = 0, status = 'available', description = '', max_occupants = 2 } = req.body;
    
    await run(`
      INSERT INTO phong (id, so_phong, tang, dien_tich, gia_phong, trang_thai, mo_ta, so_nguoi_toi_da)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, room_number, floor, area_sqm, monthly_rent, status, description, max_occupants]);

    const room = await queryOne('SELECT * FROM phong WHERE id = ?', [id]);
    res.status(201).json(mapRoom(room));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rooms/:id', async (req, res) => {
  try {
    const { room_number, floor, area_sqm, monthly_rent, status, description, max_occupants } = req.body;
    
    const existing = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const updated = {
      so_phong: room_number !== undefined ? room_number : existing.so_phong,
      tang: floor !== undefined ? floor : existing.tang,
      dien_tich: area_sqm !== undefined ? area_sqm : existing.dien_tich,
      gia_phong: monthly_rent !== undefined ? monthly_rent : existing.gia_phong,
      trang_thai: status !== undefined ? status : existing.trang_thai,
      mo_ta: description !== undefined ? description : existing.mo_ta,
      so_nguoi_toi_da: max_occupants !== undefined ? max_occupants : existing.so_nguoi_toi_da,
    };

    await run(`
      UPDATE phong 
      SET so_phong = ?, tang = ?, dien_tich = ?, gia_phong = ?, trang_thai = ?, mo_ta = ?, so_nguoi_toi_da = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updated.so_phong, updated.tang, updated.dien_tich, updated.gia_phong, updated.trang_thai, updated.mo_ta, updated.so_nguoi_toi_da, req.params.id]);

    const room = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
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
    await run('DELETE FROM phong WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------- TENANTS API -----------------
app.get('/api/tenants', async (req, res) => {
  try {
    const tenants = await query('SELECT * FROM khach_thue ORDER BY ho_ten');
    res.json(tenants.map(mapTenant));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tenants/:id', async (req, res) => {
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

app.post('/api/tenants', async (req, res) => {
  try {
    const id = generateId();
    const { full_name, phone = '', email = '', id_card_number = '', date_of_birth = '', address = '', emergency_contact = '', notes = '' } = req.body;
    
    await run(`
      INSERT INTO khach_thue (id, ho_ten, so_dien_thoai, email, so_cccd, ngay_sinh, dia_chi, lien_he_khan_cap, ghi_chu)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, full_name, phone, email, id_card_number, date_of_birth, address, emergency_contact, notes]);

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

    const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.params.id]);
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

    // Check if tenant already has an active assignment in a DIFFERENT room
    const existingDiffRoom = await query('SELECT id FROM hop_dong_thue WHERE khach_thue_id = ? AND dang_hoat_dong = 1 AND phong_id != ?', [tenant_id, room_id]);
    if (existingDiffRoom.length > 0) {
      return res.status(400).json({ error: 'Người thuê này đang thuê phòng khác rồi. Vui lòng trả phòng cũ trước.' });
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

    const id = generateId();
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
    const id = generateId();
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
    const data = await query(`
      SELECT i.*, 
             r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
             t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach,
             mr.ngay_ghi_so, mr.so_dien_cu, mr.so_dien_moi, mr.so_nuoc_cu, mr.so_nuoc_moi, mr.don_gia_dien, mr.don_gia_nuoc
      FROM hoa_don i
      JOIN phong r ON i.phong_id = r.id
      LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
      LEFT JOIN chi_so_dien_nuoc mr ON i.chi_so_dien_nuoc_id = mr.id
      ORDER BY i.ngay_tao DESC
    `);

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

app.post('/api/invoices', async (req, res) => {
  try {
    const id = generateId();
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
      total_amount,
      status = 'pending',
      due_date = null,
      notes = null,
    } = req.body;

    await run(`
      INSERT INTO hoa_don (id, phong_id, khach_thue_id, chi_so_dien_nuoc_id, thang_hoa_don, nam_hoa_don, tien_phong, tien_dien, tien_nuoc, chi_phi_khac, tong_tien, trang_thai, han_thanh_toan, ghi_chu)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, room_id, tenant_id, meter_reading_id, invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, total_amount, status, due_date, notes]);

    const invoice = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [id]);
    res.status(201).json(mapInvoice(invoice));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const { room_id, tenant_id, meter_reading_id, invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, total_amount, status, due_date, notes, paid_date } = req.body;
    const existing = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    if (existing.trang_thai === 'paid') {
      return res.status(409).json({
        error: 'Hóa đơn đã thanh toán và đã bị khóa. Không thể chỉnh sửa.',
      });
    }

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
    const existing = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (existing.trang_thai === 'paid') {
      return res.status(409).json({
        error: 'Hóa đơn đã thanh toán và đã bị khóa. Không thể xóa.',
      });
    }

    await run('DELETE FROM hoa_don WHERE id = ?', [req.params.id]);
    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });

    const payment = await ensureInvoicePayment(updated);
    if (payment) {
      await run(`
        UPDATE thanh_toan_hoa_don
        SET so_tien_da_nhan = so_tien_yeu_cau, trang_thai = 'paid', ngay_cap_nhat = CURRENT_TIMESTAMP
        WHERE hoa_don_id = ?
      `, [req.params.id]);
    }

    res.json(mapInvoice(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------- QR PAYMENT & BANK TRANSACTIONS API -----------------
app.get('/api/invoices/:id/payment', async (req, res) => {
  try {
    const invoice = await queryOne(`
      SELECT i.*, r.so_phong, t.ho_ten
      FROM hoa_don i
      JOIN phong r ON i.phong_id = r.id
      LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const bank = getBankConfig();
    if (!bank.bankId || !bank.accountNumber || !bank.accountName) {
      return res.status(503).json({
        error: 'Chưa cấu hình tài khoản nhận tiền. Hãy thiết lập BANK_ID, BANK_ACCOUNT_NO và BANK_ACCOUNT_NAME trong file .env.',
      });
    }

    const payment = await ensureInvoicePayment(invoice);
    if (!payment) {
      return res.status(500).json({ error: 'Không thể tạo mã thanh toán cho hóa đơn.' });
    }

    const transactions = await query(`
      SELECT * FROM giao_dich_ngan_hang
      WHERE hoa_don_id = ?
      ORDER BY COALESCE(thoi_gian_giao_dich, ngay_tao) DESC
      LIMIT 20
    `, [invoice.id]);

    const requiredAmount = Number(invoice.tong_tien) || 0;
    const receivedAmount = Number(payment.so_tien_da_nhan) || 0;
    const invoicePaid = invoice.trang_thai === 'paid';
    const paymentStatus = invoicePaid ? 'paid' : payment.trang_thai;
    const remainingAmount = invoicePaid ? 0 : Math.max(0, requiredAmount - receivedAmount);
    // Khi hóa đơn đã thanh toán, backend không trả lại URL VietQR để mã cũ
    // không thể tiếp tục được mở hoặc quét lại từ giao diện.
    const qrAmount = remainingAmount > 0 ? remainingAmount : requiredAmount;
    const qrLocked = invoicePaid;

    res.json({
      invoice_id: invoice.id,
      room_number: invoice.so_phong,
      tenant_name: invoice.ho_ten,
      invoice_status: invoice.trang_thai,
      payment_status: paymentStatus,
      payment_code: payment.ma_thanh_toan,
      required_amount: requiredAmount,
      received_amount: receivedAmount,
      remaining_amount: remainingAmount,
      bank: {
        bank_id: bank.bankId,
        account_number: bank.accountNumber,
        account_name: bank.accountName,
      },
      qr_locked: qrLocked,
      qr_url: qrLocked ? null : buildVietQrUrl(bank, qrAmount, payment.ma_thanh_toan),
      transactions: transactions.map(mapBankTransaction),
    });
  } catch (error) {
    console.error('Payment QR error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bank-transactions', async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(String(req.query.limit || '20'), 10);
    const limit = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 20));
    const data = await query(`
      SELECT * FROM giao_dich_ngan_hang
      ORDER BY COALESCE(thoi_gian_giao_dich, ngay_tao) DESC
      LIMIT ?
    `, [limit]);

    res.json(data.map(mapBankTransaction));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhooks/sepay', async (req, res) => {
  try {
    const expectedApiKey = String(
      process.env.SEPAY_WEBHOOK_API_KEY || (process.env.NODE_ENV === 'test' ? 'test-sepay-key' : '')
    );

    if (!expectedApiKey) {
      return res.status(503).json({
        success: false,
        message: 'SEPAY_WEBHOOK_API_KEY chưa được cấu hình trên server.',
      });
    }

    const authorization = String(req.get('authorization') || '');
    const providedApiKey = authorization.startsWith('Apikey ') ? authorization.slice(7) : '';
    if (!providedApiKey || !secureEqual(providedApiKey, expectedApiKey)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body || {};
    const transferType = String(payload.transferType || '').toLowerCase();
    const amount = Number(payload.transferAmount);
    const accountNumber = String(payload.accountNumber || '').trim();

    if (!['in', 'out'].includes(transferType) || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    }

    const configuredAccounts = String(
      process.env.SEPAY_ALLOWED_ACCOUNT_NUMBERS || process.env.BANK_ACCOUNT_NO || ''
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (configuredAccounts.length > 0 && (!accountNumber || !configuredAccounts.includes(accountNumber))) {
      return res.status(200).json({ success: true, ignored: true, reason: 'account_not_allowed' });
    }

    const rawProviderId = payload.id ?? payload.referenceCode ?? payload.referenceNumber;
    const fallbackHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const providerTransactionId = `sepay:${String(rawProviderId || fallbackHash)}`;
    const paymentCode = extractPaymentCode(payload);
    const payment = paymentCode
      ? await queryOne(`
          SELECT p.*, h.trang_thai AS invoice_status
          FROM thanh_toan_hoa_don p
          JOIN hoa_don h ON h.id = p.hoa_don_id
          WHERE p.ma_thanh_toan = ?
        `, [paymentCode])
      : null;

    // Giao dịch dùng lại mã của hóa đơn đã thanh toán vẫn được lưu để đối soát,
    // nhưng không được gắn hoặc cộng thêm vào hóa đơn đã khóa.
    const activePayment = payment && payment.invoice_status !== 'paid' ? payment : null;

    const insertResult = await run(`
      INSERT OR IGNORE INTO giao_dich_ngan_hang (
        id, nha_cung_cap, ma_giao_dich_ncc, ma_tham_chieu, ngan_hang, so_tai_khoan,
        loai_giao_dich, so_tien, so_du_sau_giao_dich, noi_dung, ma_thanh_toan,
        hoa_don_id, thoi_gian_giao_dich, du_lieu_goc
      ) VALUES (?, 'sepay', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generateId(),
      providerTransactionId,
      payload.referenceCode || payload.referenceNumber || null,
      payload.gateway || null,
      accountNumber || null,
      transferType,
      amount,
      Number.isFinite(Number(payload.accumulated)) ? Number(payload.accumulated) : null,
      payload.content || payload.description || null,
      paymentCode,
      activePayment?.hoa_don_id || null,
      payload.transactionDate || null,
      JSON.stringify(payload),
    ]);

    if (insertResult.changes === 0) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    let invoicePaid = false;
    let receivedAmount = 0;

    if (activePayment && transferType === 'in') {
      const aggregate = await queryOne(`
        SELECT COALESCE(SUM(so_tien), 0) AS total_received
        FROM giao_dich_ngan_hang
        WHERE hoa_don_id = ? AND loai_giao_dich = 'in'
      `, [activePayment.hoa_don_id]);

      receivedAmount = Number(aggregate?.total_received) || 0;
      const requiredAmount = Number(activePayment.so_tien_yeu_cau) || 0;
      const paymentStatus = receivedAmount >= requiredAmount && requiredAmount > 0
        ? 'paid'
        : receivedAmount > 0
          ? 'partial'
          : 'pending';

      await run(`
        UPDATE thanh_toan_hoa_don
        SET so_tien_da_nhan = ?, trang_thai = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
        WHERE hoa_don_id = ?
      `, [receivedAmount, paymentStatus, activePayment.hoa_don_id]);

      if (paymentStatus === 'paid') {
        const paidDate = String(payload.transactionDate || new Date().toISOString()).slice(0, 10);
        await run(`
          UPDATE hoa_don
          SET trang_thai = 'paid', ngay_thanh_toan = COALESCE(ngay_thanh_toan, ?), ngay_cap_nhat = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [paidDate, activePayment.hoa_don_id]);
        invoicePaid = true;
      }
    }

    return res.status(200).json({
      success: true,
      matched_invoice: activePayment?.hoa_don_id || null,
      received_amount: receivedAmount,
      invoice_paid: invoicePaid,
    });
  } catch (error) {
    console.error('SePay webhook error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});


// ----------------- REPAIR REQUESTS API -----------------
app.get('/api/repair_requests', async (req, res) => {
  try {
    const data = await query(`
      SELECT rr.*, 
             r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
             t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach
      FROM yeu_cau_sua_chua rr
      JOIN phong r ON rr.phong_id = r.id
      LEFT JOIN khach_thue t ON rr.khach_thue_id = t.id
      ORDER BY rr.ngay_bao DESC
    `);

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
    const id = generateId();
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


// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

export default app;
