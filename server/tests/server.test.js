import request from 'supertest';
import app from '../server.js';
import { closeDatabase, query, run, dbReady } from '../db.js';

describe('HostelMate API Endpoints & Business Logic Unit Tests', () => {
  
  beforeAll(async () => {
    // Wait until SQLite schema creation and sample data seeding are completed
    await dbReady;
  });

  afterAll(async () => {
    // Close SQLite database connection so Jest can exit cleanly
    await closeDatabase();
  });

  describe('1. Rooms API (/api/rooms)', () => {
    test('GET /api/rooms - Should return list of rooms', async () => {
      const res = await request(app).get('/api/rooms');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('GET /api/rooms/:id - Should return room detail', async () => {
      const res = await request(app).get('/api/rooms/r1');
      expect(res.status).toBe(200);
      expect(res.body.room_number).toBe('101');
    });

    test('GET /api/rooms/:id - Should return 404 for invalid room ID', async () => {
      const res = await request(app).get('/api/rooms/invalid_room_id');
      expect(res.status).toBe(404);
    });

    test('POST /api/rooms - Should create a new room', async () => {
      const payload = {
        room_number: '999',
        floor: 9,
        area_sqm: '45.5',
        monthly_rent: '4500000',
        max_occupants: '4',
        description: 'Phòng test vip'
      };
      const res = await request(app).post('/api/rooms').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.room_number).toBe('999');
      expect(res.body.area_sqm).toBe(45.5);
      expect(res.body.monthly_rent).toBe(4500000);
    });

    test('PUT /api/rooms/:id - Should update room details', async () => {
      const payload = {
        description: 'Updated description for r2'
      };
      const res = await request(app).put('/api/rooms/r2').send(payload);
      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated description for r2');
    });

    test('PUT /api/rooms/:id - Should return 404 if room to update not found', async () => {
      const res = await request(app).put('/api/rooms/non_existent').send({ description: 'test' });
      expect(res.status).toBe(404);
    });

    test('DELETE /api/rooms/:id - Should block deleting occupied room (Business rule)', async () => {
      const res = await request(app).delete('/api/rooms/r1');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Không thể xóa phòng đang có người thuê');
    });

    test('DELETE /api/rooms/:id - Should allow deleting available room', async () => {
      const tempRoomId = 'temp_room';
      await run(`
        INSERT INTO phong (id, so_phong, tang, dien_tich, gia_phong, trang_thai)
        VALUES (?, ?, 1, 20, 2000000, 'available')
      `, [tempRoomId, '888']);

      const res = await request(app).delete(`/api/rooms/${tempRoomId}`);
      expect(res.status).toBe(204);
    });
  });

  describe('2. Tenants API (/api/tenants)', () => {
    test('GET /api/tenants - Should return list of tenants', async () => {
      const res = await request(app).get('/api/tenants');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/tenants/:id - Should return tenant details', async () => {
      const res = await request(app).get('/api/tenants/t1');
      expect(res.status).toBe(200);
      expect(res.body.full_name).toBe('Nguyễn Văn A');
    });

    test('GET /api/tenants/:id - Should return 404 for invalid tenant ID', async () => {
      const res = await request(app).get('/api/tenants/non_existent');
      expect(res.status).toBe(404);
    });

    test('POST /api/tenants - Should create tenant with international country code phone format (+84)', async () => {
      const payload = {
        full_name: 'Khách Quốc Tế',
        phone: '+84988777666',
        email: 'international@test.com',
        id_card_number: '123456789012',
        address: 'Hà Nội, Việt Nam'
      };
      const res = await request(app).post('/api/tenants').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.phone).toBe('+84988777666');
    });

    test('PUT /api/tenants/:id - Should update tenant details', async () => {
      const payload = {
        full_name: 'Nguyen Van A (Updated)'
      };
      const res = await request(app).put('/api/tenants/t1').send(payload);
      expect(res.status).toBe(200);
      expect(res.body.full_name).toBe('Nguyen Van A (Updated)');
    });

    test('PUT /api/tenants/:id - Should return 404 if tenant to update not found', async () => {
      const res = await request(app).put('/api/tenants/non_existent').send({ full_name: 'test' });
      expect(res.status).toBe(404);
    });

    test('DELETE /api/tenants/:id - Should successfully delete tenant', async () => {
      const tempTenantId = 'temp_tenant';
      await run(`
        INSERT INTO khach_thue (id, ho_ten, so_dien_thoai)
        VALUES (?, 'Temp Tenant', '123')
      `, [tempTenantId]);

      const res = await request(app).delete(`/api/tenants/${tempTenantId}`);
      expect(res.status).toBe(204);
    });
  });

  describe('3. Meter Readings API (/api/meter_readings)', () => {
    test('GET /api/meter_readings - Should return list of meter readings', async () => {
      const res = await request(app).get('/api/meter_readings');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/meter_readings/room/:roomId - Should return room readings history', async () => {
      const res = await request(app).get('/api/meter_readings/room/r1');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/meter_readings/latest/:roomId - Should return latest reading', async () => {
      const res = await request(app).get('/api/meter_readings/latest/r1');
      expect(res.status).toBe(200);
      expect(res.body.room_id).toBe('r1');
    });

    test('POST /api/meter_readings - Should reject if electricity/water new is less than old (Business rule)', async () => {
      const payload = {
        room_id: 'r2',
        reading_date: '2026-07-08',
        electricity_old: '150',
        electricity_new: '120', // Invalid: new < old
        water_old: '50',
        water_new: '60',
        electricity_price_per_unit: '3500',
        water_price_per_unit: '15000'
      };
      const res = await request(app).post('/api/meter_readings').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Chỉ số điện mới không được nhỏ hơn chỉ số cũ.');
    });

    test('POST /api/meter_readings - Should allow if valid values', async () => {
      const payload = {
        room_id: 'r2',
        reading_date: '2026-07-08',
        electricity_old: '100',
        electricity_new: '230',
        water_old: '40',
        water_new: '55',
        electricity_price_per_unit: '3500',
        water_price_per_unit: '15000'
      };
      const res = await request(app).post('/api/meter_readings').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.electricity_new).toBe(230);
      expect(res.body.water_new).toBe(55);
    });

    test('PUT /api/meter_readings/:id - Should update reading details', async () => {
      const payload = {
        electricity_new: '250',
        water_new: '60'
      };
      const res = await request(app).put('/api/meter_readings/mr1').send(payload);
      expect(res.status).toBe(200);
      expect(res.body.electricity_new).toBe(250);
    });

    test('DELETE /api/meter_readings/:id - Should successfully delete reading', async () => {
      const tempReadingId = 'temp_reading';
      await run(`
        INSERT INTO chi_so_dien_nuoc (id, phong_id, ngay_ghi_so, so_dien_cu, so_dien_moi, so_nuoc_cu, so_nuoc_moi)
        VALUES (?, 'r2', '2026-07-08', 0, 10, 0, 5)
      `, [tempReadingId]);

      const res = await request(app).delete(`/api/meter_readings/${tempReadingId}`);
      expect(res.status).toBe(204);
    });
  });

  describe('4. Invoices API (/api/invoices)', () => {
    test('GET /api/invoices - Should return list of invoices', async () => {
      const res = await request(app).get('/api/invoices');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/invoices/:id - Should return invoice detail', async () => {
      const res = await request(app).get('/api/invoices/i1');
      expect(res.status).toBe(200);
      expect(res.body.room_id).toBe('r1');
    });

    test('GET /api/invoices/export - Should return Excel-compatible CSV export of invoices', async () => {
      const res = await request(app).get('/api/invoices/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename=danh_sach_hoa_don.csv');
      expect(res.text.startsWith('\ufeff')).toBe(true);
    });

    test('POST /api/invoices - Should create invoice successfully', async () => {
      const payload = {
        room_id: 'r1',
        tenant_id: 't1',
        invoice_month: 7,
        invoice_year: 2026,
        room_rent: 2500000,
        electricity_cost: 350000,
        water_cost: 150000,
        other_fees: 50000,
        total_amount: 3050000,
        status: 'pending',
        due_date: '2026-07-15'
      };
      const res = await request(app).post('/api/invoices').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.room_rent).toBe(2500000);
      expect(res.body.total_amount).toBe(3050000);
    });

    test('PUT /api/invoices/:id/paid - Should mark invoice as paid', async () => {
      const id = 'inv_test';
      await run(`
        INSERT INTO hoa_don (id, phong_id, khach_thue_id, thang_hoa_don, nam_hoa_don, tien_phong, tong_tien, trang_thai)
        VALUES (?, 'r1', 't1', 12, 2035, 2500000, 2500000, 'pending')
      `, [id]);

      const res = await request(app).put(`/api/invoices/${id}/paid`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('paid');
      expect(res.body.paid_date).toBeDefined();
    });

    test('POST /api/invoices/mark-overdue - Should scan and mark overdue invoices', async () => {
      const res = await request(app).post('/api/invoices/mark-overdue');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Overdue invoices updated');
    });

    test('DELETE /api/invoices/:id - Should successfully delete invoice', async () => {
      const id = 'inv_temp';
      await run(`
        INSERT INTO hoa_don (id, phong_id, khach_thue_id, thang_hoa_don, nam_hoa_don, tien_phong, tong_tien, trang_thai)
        VALUES (?, 'r1', 't1', 1, 2040, 200000, 200000, 'pending')
      `, [id]);

      const res = await request(app).delete(`/api/invoices/${id}`);
      expect(res.status).toBe(204);
    });
  });

  describe('5. Repair Requests API (/api/repair_requests)', () => {
    test('GET /api/repair_requests - Should return list of repair requests', async () => {
      const res = await request(app).get('/api/repair_requests');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/repair_requests/:id - Should return request detail', async () => {
      const res = await request(app).get('/api/repair_requests/rep1');
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Hỏng vòi nước');
    });

    test('POST /api/repair_requests - Should reject if reporting tenant is not assigned to the room (Business rule)', async () => {
      const payload = {
        room_id: 'r1',
        tenant_id: 't3',
        title: 'Bóng đèn bị cháy',
        description: 'Báo hỏng phòng r1',
        priority: 'medium',
        status: 'new'
      };
      const res = await request(app).post('/api/repair_requests').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Người thuê này không có hợp đồng thuê hoạt động tại phòng này');
    });

    test('POST /api/repair_requests - Should accept if reporting tenant resides in the room', async () => {
      const payload = {
        room_id: 'r1',
        tenant_id: 't1',
        title: 'Vòi nước rò rỉ',
        description: 'Vòi nước nhà vệ sinh rỉ nước liên tục',
        priority: 'high',
        status: 'new'
      };
      const res = await request(app).post('/api/repair_requests').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Vòi nước rò rỉ');
    });

    test('PUT /api/repair_requests/:id - Should update request details', async () => {
      const payload = {
        status: 'resolved',
        resolution_notes: 'Đã sửa xong'
      };
      const res = await request(app).put('/api/repair_requests/rep1').send(payload);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('resolved');
      expect(res.body.resolution_notes).toBe('Đã sửa xong');
    });

    test('DELETE /api/repair_requests/:id - Should successfully delete request', async () => {
      const id = 'rep_temp';
      await run(`
        INSERT INTO yeu_cau_sua_chua (id, phong_id, tieu_de, trang_thai)
        VALUES (?, 'r2', 'temp title', 'new')
      `, [id]);

      const res = await request(app).delete(`/api/repair_requests/${id}`);
      expect(res.status).toBe(204);
    });
  });

  describe('6. Assignments API (/api/room_assignments)', () => {
    test('GET /api/room_assignments/expiring - Should return expiring assignments', async () => {
      const res = await request(app).get('/api/room_assignments/expiring?withinDays=60');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('POST /api/room_assignments - Should successfully create room assignment contract', async () => {
      // Create a new tenant first
      const tenantRes = await request(app).post('/api/tenants').send({
        full_name: 'Khách Test Hợp Đồng',
        phone: '+84988777123',
        email: 'testhopdong@test.com',
        id_card_number: '111222333444'
      });
      const tenantId = tenantRes.body.id;

      // Assign the new tenant to available room r2
      const payload = {
        room_id: 'r2',
        tenant_id: tenantId,
        start_date: '2026-07-01',
        deposit_amount: '5000000',
        is_primary: true,
        notes: 'Hợp đồng mới',
        contract_end_date: '2027-07-01'
      };
      const res = await request(app).post('/api/room_assignments').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.tenant_id).toBe(tenantId);
      expect(res.body.room_id).toBe('r2');
    });

    test('PUT /api/room_assignments/:id/primary - Should change primary tenant in room', async () => {
      const res = await request(app).put('/api/room_assignments/a2/primary').send({ room_id: 'r3' });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Primary tenant updated successfully');
    });

    test('PUT /api/room_assignments/:id/extend - Should extend assignment end date', async () => {
      const res = await request(app).put('/api/room_assignments/a1/extend').send({ contract_end_date: '2028-12-31' });
      expect(res.status).toBe(200);
      expect(res.body.contract_end_date).toBe('2028-12-31');
    });

    test('POST /api/room_assignments/:id/end - Should end room assignment (check-out)', async () => {
      const res = await request(app).post('/api/room_assignments/a1/end');
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('ended successfully');
    });
  });
});
