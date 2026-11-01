import request from 'supertest';
import app from '../server.js';
import { closeDatabase, dbReady, queryOne } from '../db.js';

let adminCookie = '';
let tenantCookie = '';
let otherTenantCookie = '';
let roomId = '';
let otherRoomId = '';
let tenantId = '';
let otherTenantId = '';
let assignmentId = '';
let invoiceId = '';
let invoiceCode = '';
let repairId = '';

const asAdmin = (req) => req.set('Cookie', adminCookie);
const asTenant = (req) => req.set('Cookie', tenantCookie);
const asOtherTenant = (req) => req.set('Cookie', otherTenantCookie);

const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });

const webhook = (body) => request(app)
  .post('/api/webhooks/sepay')
  .set('Authorization', 'Apikey test-webhook-key')
  .send(body);

describe('ARBORIS integrated API', () => {
  beforeAll(async () => {
    await dbReady;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('accounts', () => {
    test('starts with an empty database and a hashed default admin', async () => {
      const health = await request(app).get('/api/health');
      expect(health.status).toBe(200);
      expect(health.body.database).toMatchObject({
        phong: 0,
        khach_thue: 0,
        hop_dong_thue: 0,
        hoa_don: 0,
        yeu_cau_sua_chua: 0,
      });

      const admin = await queryOne("SELECT password_hash FROM users WHERE username = 'admin'");
      expect(admin.password_hash.startsWith('$2')).toBe(true);

      const response = await login('admin', '123456');
      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('ADMIN');
      adminCookie = response.headers['set-cookie'][0];
    });

    test('rejects a wrong password', async () => {
      const response = await login('admin', 'wrong-password');
      expect(response.status).toBe(401);
    });

    test('admin can create rooms, tenants, a contract and an account', async () => {
      const room = await asAdmin(request(app).post('/api/rooms')).send({
        room_number: 'T101',
        floor: 1,
        area_sqm: 25,
        monthly_rent: 2500000,
        max_occupants: 2,
        location: 'Khu A',
      });
      expect(room.status).toBe(201);
      roomId = room.body.id;

      const otherRoom = await asAdmin(request(app).post('/api/rooms')).send({ room_number: 'T102', monthly_rent: 2000000 });
      otherRoomId = otherRoom.body.id;

      const tenant = await asAdmin(request(app).post('/api/tenants')).send({
        full_name: 'Khách thuê Test',
        phone: '0900000000',
        email: 'tenant@test.local',
      });
      expect(tenant.status).toBe(201);
      tenantId = tenant.body.id;

      const otherTenant = await asAdmin(request(app).post('/api/tenants')).send({ full_name: 'Khách Khác', phone: '0900000001' });
      otherTenantId = otherTenant.body.id;

      const assignment = await asAdmin(request(app).post('/api/room_assignments')).send({
        room_id: roomId,
        tenant_id: tenantId,
        start_date: '2026-07-01',
        contract_end_date: '2027-07-01',
        deposit_amount: 2500000,
        is_primary: true,
      });
      expect(assignment.status).toBe(201);
      assignmentId = assignment.body.id;

      await asAdmin(request(app).post('/api/room_assignments')).send({
        room_id: otherRoomId,
        tenant_id: otherTenantId,
        start_date: '2026-07-01',
        deposit_amount: 0,
      });

      const account = await asAdmin(request(app).put(`/api/tenants/${tenantId}`)).send({
        username: 'tenanttest',
        password: '654321',
      });
      expect(account.status).toBe(200);
      expect(account.body.username).toBe('tenanttest');
      await asAdmin(request(app).put(`/api/tenants/${otherTenantId}`)).send({ username: 'tenantother', password: '123123' });
    });

    test('tenant passwords are hashed and never returned by the API', async () => {
      const stored = await queryOne('SELECT password FROM khach_thue WHERE id = ?', [tenantId]);
      expect(stored.password.startsWith('$2')).toBe(true);

      const tenants = await asAdmin(request(app).get('/api/tenants'));
      expect(tenants.status).toBe(200);
      for (const tenant of tenants.body) expect(tenant).not.toHaveProperty('password');
    });

    test('a new tenant must change the password, then the flag clears', async () => {
      const first = await login('tenanttest', '654321');
      expect(first.status).toBe(200);
      expect(first.body.user.role).toBe('TENANT');
      expect(first.body.require_password_change).toBe(true);
      const firstCookie = first.headers['set-cookie'][0];

      const wrongOld = await request(app).post('/api/auth/change-password').set('Cookie', firstCookie)
        .send({ oldPassword: 'nope', newPassword: 'new-password' });
      expect(wrongOld.status).toBe(400);

      const changed = await request(app).post('/api/auth/change-password').set('Cookie', firstCookie)
        .send({ oldPassword: '654321', newPassword: 'new-password' });
      expect(changed.status).toBe(200);

      // Changing the password ends the old session; the response carries a new one.
      const oldSession = await request(app).get('/api/auth/me').set('Cookie', firstCookie);
      expect(oldSession.status).toBe(401);
      const newSession = await request(app).get('/api/auth/me').set('Cookie', changed.headers['set-cookie'][0]);
      expect(newSession.status).toBe(200);
      expect(newSession.body.user.must_change_password).toBe(false);

      const second = await login('tenanttest', 'new-password');
      expect(second.body.require_password_change).toBe(false);
      tenantCookie = second.headers['set-cookie'][0];

      const other = await login('tenantother', '123123');
      otherTenantCookie = other.headers['set-cookie'][0];
    });

    test('a username taken by the admin or another tenant is refused', async () => {
      const taken = await asAdmin(request(app).put(`/api/tenants/${otherTenantId}`)).send({ username: 'tenanttest' });
      expect(taken.status).toBe(400);
      const admin = await asAdmin(request(app).put(`/api/tenants/${otherTenantId}`)).send({ username: 'admin' });
      expect(admin.status).toBe(400);
    });

    test('locking an account ends the session and blocks login', async () => {
      const lock = await asAdmin(request(app).put(`/api/tenants/${otherTenantId}`)).send({ is_locked: true });
      expect(lock.body.is_locked).toBe(true);

      expect((await asOtherTenant(request(app).get('/api/auth/me'))).status).toBe(401);
      expect((await login('tenantother', '123123')).status).toBe(403);

      await asAdmin(request(app).put(`/api/tenants/${otherTenantId}`)).send({ is_locked: false });
      otherTenantCookie = (await login('tenantother', '123123')).headers['set-cookie'][0];
      expect((await asOtherTenant(request(app).get('/api/auth/me'))).status).toBe(200);
    });
  });

  describe('access control', () => {
    const adminRoutes = [
      ['get', '/api/rooms'],
      ['post', '/api/rooms'],
      ['delete', '/api/rooms/x'],
      ['get', '/api/tenants'],
      ['put', '/api/tenants/x'],
      ['delete', '/api/tenants/x'],
      ['post', '/api/room_assignments'],
      ['post', '/api/room_assignments/x/end'],
      ['get', '/api/room_assignments/expiring'],
      ['get', '/api/meter_readings'],
      ['post', '/api/meter_readings'],
      ['get', '/api/invoices/export'],
      ['post', '/api/invoices'],
      ['put', '/api/invoices/x'],
      ['put', '/api/invoices/x/paid'],
      ['delete', '/api/invoices/x'],
      ['post', '/api/repair_requests'],
      ['put', '/api/repair_requests/x'],
      ['delete', '/api/repair_requests/x'],
      ['post', '/api/contracts/x/generate'],
      ['get', '/api/admin/users'],
      ['put', '/api/settings'],
    ];

    test.each(adminRoutes)('%s %s requires login and the admin role', async (method, path) => {
      expect((await request(app)[method](path)).status).toBe(401);
      expect((await asTenant(request(app)[method](path))).status).toBe(403);
    });

    test.each([
      ['get', '/api/invoices'],
      ['get', '/api/invoices/x'],
      ['get', '/api/repair_requests'],
      ['get', '/api/tenant/portal'],
      ['get', '/api/contracts/x/download'],
      ['post', '/api/contracts/x/sign'],
      ['post', '/api/ai/chat'],
    ])('%s %s requires login', async (method, path) => {
      expect((await request(app)[method](path)).status).toBe(401);
    });

    test('a forged token is rejected', async () => {
      const response = await request(app).get('/api/rooms').set('Authorization', 'Bearer not-a-real-token');
      expect(response.status).toBe(401);
    });

    test('the portal ignores a tenant_id belonging to someone else', async () => {
      const portal = await asOtherTenant(request(app).get(`/api/tenant/portal?tenant_id=${tenantId}`));
      expect(portal.status).toBe(200);
      expect(portal.body.rentals).toHaveLength(1);
      expect(portal.body.rentals[0].room.id).toBe(otherRoomId);
    });

    test('a tenant cannot sign or download another tenant\'s contract', async () => {
      const signature = 'data:image/png;base64,iVBORw0KGgo=';
      const sign = await asOtherTenant(request(app).post(`/api/contracts/${assignmentId}/sign`)).send({ signatureBase64: signature });
      expect(sign.status).toBe(403);
      const download = await asOtherTenant(request(app).get(`/api/contracts/${assignmentId}/download`));
      expect(download.status).toBe(403);
    });
  });

  describe('validation', () => {
    test('rejects bad room data with a clear message', async () => {
      expect((await asAdmin(request(app).post('/api/rooms')).send({})).status).toBe(400);
      expect((await asAdmin(request(app).post('/api/rooms')).send({ room_number: 'X', monthly_rent: -1 })).status).toBe(400);
      expect((await asAdmin(request(app).post('/api/rooms')).send({ room_number: 'X', max_occupants: 0 })).status).toBe(400);
    });

    test('a duplicate room number in the same area is refused', async () => {
      const duplicate = await asAdmin(request(app).post('/api/rooms')).send({ room_number: 'T101', location: 'Khu A' });
      expect(duplicate.status).toBe(400);
    });

    test('an occupied room cannot be marked empty or shrunk below its occupants', async () => {
      const empty = await asAdmin(request(app).put(`/api/rooms/${roomId}`)).send({ status: 'available' });
      expect(empty.status).toBe(400);
      const shrink = await asAdmin(request(app).put(`/api/rooms/${roomId}`)).send({ max_occupants: 0 });
      expect(shrink.status).toBe(400);
    });

    test('meter readings cannot be negative, go backwards or repeat a month', async () => {
      const base = { room_id: roomId, reading_date: '2026-07-15', electricity_old: 100, electricity_new: 110, water_old: 10, water_new: 12 };
      expect((await asAdmin(request(app).post('/api/meter_readings')).send({ ...base, electricity_old: -1 })).status).toBe(400);
      expect((await asAdmin(request(app).post('/api/meter_readings')).send({ ...base, electricity_new: 90 })).status).toBe(400);
      expect((await asAdmin(request(app).post('/api/meter_readings')).send(base)).status).toBe(201);
      expect((await asAdmin(request(app).post('/api/meter_readings')).send({ ...base, reading_date: '2026-07-20' })).status).toBe(400);

      const august = await asAdmin(request(app).post('/api/meter_readings')).send({ ...base, reading_date: '2026-08-15' });
      expect(august.status).toBe(201);
      const moved = await asAdmin(request(app).put(`/api/meter_readings/${august.body.id}`)).send({ reading_date: '2026-07-25' });
      expect(moved.status).toBe(400);
    });
  });

  describe('invoices and payments', () => {
    test('the server computes the invoice total', async () => {
      const invoice = await asAdmin(request(app).post('/api/invoices')).send({
        room_id: roomId,
        tenant_id: tenantId,
        invoice_month: 7,
        invoice_year: 2026,
        room_rent: 2500000,
        electricity_cost: 35000,
        water_cost: 30000,
        other_fees: 0,
        total_amount: 1,
        due_date: '2026-07-22',
      });
      expect(invoice.status).toBe(201);
      expect(invoice.body.total_amount).toBe(2565000);
      invoiceId = invoice.body.id;
      invoiceCode = invoice.body.ma_hoa_don;
    });

    test('a second invoice for the same room and month is refused', async () => {
      const duplicate = await asAdmin(request(app).post('/api/invoices')).send({ room_id: roomId, invoice_month: 7, invoice_year: 2026, room_rent: 1 });
      expect(duplicate.status).toBe(400);
    });

    test('a tenant only sees invoices for their own room', async () => {
      const own = await asTenant(request(app).get('/api/invoices'));
      expect(own.body.map((item) => item.id)).toEqual([invoiceId]);

      const spoofed = await asOtherTenant(request(app).get(`/api/invoices?tenant_id=${tenantId}`));
      expect(spoofed.body).toEqual([]);

      expect((await asTenant(request(app).get(`/api/invoices/${invoiceId}`))).status).toBe(200);
      expect((await asOtherTenant(request(app).get(`/api/invoices/${invoiceId}`))).status).toBe(403);
    });

    test('another tenant cannot report payment on the invoice', async () => {
      const response = await asOtherTenant(request(app).post(`/api/invoices/${invoiceId}/report-payment`));
      expect(response.status).toBe(403);
    });

    test('manual flow: tenant reports the transfer, admin confirms it', async () => {
      const report = await asTenant(request(app).post(`/api/invoices/${invoiceId}/report-payment`));
      expect(report.body.status).toBe('waiting_confirmation');

      const confirm = await asAdmin(request(app).patch(`/api/admin/invoices/${invoiceId}/confirm-payment`));
      expect(confirm.body.status).toBe('paid');

      const again = await asTenant(request(app).post(`/api/invoices/${invoiceId}/report-payment`));
      expect(again.status).toBe(400);
    });

    test('SePay webhook marks the correct invoice as paid and is idempotent', async () => {
      const invoice = await asAdmin(request(app).post('/api/invoices')).send({
        room_id: roomId,
        tenant_id: tenantId,
        invoice_month: 8,
        invoice_year: 2026,
        room_rent: 1000000,
      });
      const body = {
        id: 'TEST-TRANSACTION-001',
        accountNumber: '0000000000',
        transferType: 'in',
        transferAmount: 1000000,
        content: invoice.body.ma_hoa_don,
      };

      const first = await webhook(body);
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ success: true });

      const paid = await asAdmin(request(app).get(`/api/invoices/${invoice.body.id}`));
      expect(paid.body.status).toBe('paid');

      const duplicate = await webhook(body);
      expect(duplicate.body).toEqual({ success: true });
      const row = await queryOne('SELECT so_tien_da_nhan FROM hoa_don WHERE id = ?', [invoice.body.id]);
      expect(row.so_tien_da_nhan).toBe(1000000);
    });

    test('SePay webhook rejects a wrong API key', async () => {
      const response = await request(app).post('/api/webhooks/sepay').set('Authorization', 'Apikey wrong').send({ content: invoiceCode });
      expect(response.status).toBe(401);
    });

    test('the CSV export quotes values and neutralises spreadsheet formulas', async () => {
      await asAdmin(request(app).put(`/api/tenants/${tenantId}`)).send({ full_name: '=HYPERLINK("x"),Nguyen' });
      const csv = await asAdmin(request(app).get('/api/invoices/export'));
      expect(csv.status).toBe(200);
      expect(csv.text).toContain(`"'=HYPERLINK(""x""),Nguyen"`);
      expect(csv.text).toContain(`"${invoiceCode}"`);
      await asAdmin(request(app).put(`/api/tenants/${tenantId}`)).send({ full_name: 'Khách thuê Test' });
    });
  });

  describe('repair requests', () => {
    test('a tenant can create a request for their own room only', async () => {
      const repair = await asTenant(request(app).post('/api/tenant/repair_requests')).send({
        room_id: roomId,
        title: 'Máy lạnh không hoạt động',
        description: 'Cần kiểm tra',
        priority: 'high',
      });
      expect(repair.status).toBe(201);
      expect(repair.body.tenant_id).toBe(tenantId);
      repairId = repair.body.id;

      const otherRoom = await asTenant(request(app).post('/api/tenant/repair_requests')).send({ room_id: otherRoomId, title: 'Không phải phòng tôi' });
      expect(otherRoom.status).toBe(400);
    });

    test('a tenant cannot read another room\'s request', async () => {
      expect((await asOtherTenant(request(app).get(`/api/repair_requests/${repairId}`))).status).toBe(403);
      expect((await asOtherTenant(request(app).get('/api/repair_requests'))).body).toEqual([]);
    });

    test('a tenant confirms the repair only after the admin resolves it', async () => {
      const early = await asTenant(request(app).put(`/api/tenant/repair_requests/${repairId}/confirm`));
      expect(early.status).toBe(400);

      const resolved = await asAdmin(request(app).put(`/api/repair_requests/${repairId}`)).send({ status: 'resolved', resolution_notes: 'Đã thay tụ điện' });
      expect(resolved.body.status).toBe('resolved');
      expect(resolved.body.resolved_at).toBeTruthy();

      const confirmed = await asTenant(request(app).put(`/api/tenant/repair_requests/${repairId}/confirm`));
      expect(confirmed.body.status).toBe('closed');
    });
  });

  describe('contracts', () => {
    test('a tenant signs their own contract once and can download the PDF', async () => {
      const signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==';
      const invalid = await asTenant(request(app).post(`/api/contracts/${assignmentId}/sign`)).send({ signatureBase64: 'javascript:alert(1)' });
      expect(invalid.status).toBe(400);

      const signed = await asTenant(request(app).post(`/api/contracts/${assignmentId}/sign`)).send({ signatureBase64: signature });
      expect(signed.status).toBe(200);

      const twice = await asTenant(request(app).post(`/api/contracts/${assignmentId}/sign`)).send({ signatureBase64: signature });
      expect(twice.status).toBe(400);

      const pdf = await asTenant(request(app).get(`/api/contracts/${assignmentId}/download`));
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('pdf');
    });

    test('a tenant can rent the same room again after each move-out', async () => {
      const room = await asAdmin(request(app).post('/api/rooms')).send({ room_number: 'T103' });
      const tenant = await asAdmin(request(app).post('/api/tenants')).send({ full_name: 'Khách Quay Lại' });
      const assign = () => asAdmin(request(app).post('/api/room_assignments')).send({
        room_id: room.body.id,
        tenant_id: tenant.body.id,
        start_date: '2026-07-01',
        deposit_amount: 0,
      });

      for (let round = 0; round < 3; round += 1) {
        const assignment = await assign();
        expect(assignment.status).toBe(201);
        const end = await asAdmin(request(app).post(`/api/room_assignments/${assignment.body.id}/end`));
        expect(end.status).toBe(200);
      }

      const roomAfter = await asAdmin(request(app).get(`/api/rooms/${room.body.id}`));
      expect(roomAfter.body.status).toBe('available');
    });

    test('ending a contract keeps a room that is under maintenance', async () => {
      const room = await asAdmin(request(app).post('/api/rooms')).send({ room_number: 'T104' });
      const tenant = await asAdmin(request(app).post('/api/tenants')).send({ full_name: 'Khách Bảo Trì' });
      const assignment = await asAdmin(request(app).post('/api/room_assignments')).send({
        room_id: room.body.id,
        tenant_id: tenant.body.id,
        start_date: '2026-07-01',
        deposit_amount: 0,
      });
      await asAdmin(request(app).put(`/api/rooms/${room.body.id}`)).send({ status: 'maintenance' });
      await asAdmin(request(app).post(`/api/room_assignments/${assignment.body.id}/end`));

      const roomAfter = await asAdmin(request(app).get(`/api/rooms/${room.body.id}`));
      expect(roomAfter.body.status).toBe('maintenance');
    });
  });

  describe('misc', () => {
    test('roommate requests without a title return 400 instead of crashing', async () => {
      const response = await asTenant(request(app).post('/api/roommates')).send({});
      expect(response.status).toBe(400);
    });

    test('unknown settings keys are refused', async () => {
      const response = await asAdmin(request(app).put('/api/settings')).send({ jwt_secret: 'x' });
      expect(response.status).toBe(400);
    });

    test('the chatbot reports a missing API key without failing the server', async () => {
      const response = await asTenant(request(app).post('/api/ai/chat')).send({ message: 'Xin chào' });
      expect(response.status).toBe(503);
    });

    test('an unknown API path returns JSON 404', async () => {
      const response = await request(app).get('/api/does-not-exist');
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
    });

    test('malformed JSON returns 400', async () => {
      const response = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
      expect(response.status).toBe(400);
    });

    test('admin can list tenant accounts', async () => {
      const users = await asAdmin(request(app).get('/api/admin/users'));
      expect(users.status).toBe(200);
      expect(users.body.data.some((row) => row.tenant_id === tenantId && row.role === 'TENANT')).toBe(true);
    });

    test('logout clears the session cookie', async () => {
      const response = await request(app).post('/api/auth/logout');
      expect(response.status).toBe(200);
      expect(response.headers['set-cookie'][0]).toContain('token=;');
    });
  });
});
