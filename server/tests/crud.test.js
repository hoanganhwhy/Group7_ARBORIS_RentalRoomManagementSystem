import request from 'supertest';
import app from '../server.js';
import { closeDatabase, dbReady } from '../db.js';

let adminCookie = '';
let tenantCookie = '';
let roomId = '';
let tenantId = '';
let secondTenantId = '';
let assignmentId = '';
let secondAssignmentId = '';

const asAdmin = (req) => req.set('Cookie', adminCookie);
const asTenant = (req) => req.set('Cookie', tenantCookie);

describe('Admin CRUD and profile routes', () => {
  beforeAll(async () => {
    await dbReady;
    const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: '123456' });
    adminCookie = login.headers['set-cookie'][0];

    const room = await asAdmin(request(app).post('/api/rooms')).send({ room_number: 'C101', monthly_rent: 3000000, max_occupants: 3, location: 'Khu C' });
    roomId = room.body.id;
    const tenant = await asAdmin(request(app).post('/api/tenants')).send({ full_name: 'Người Thứ Nhất', phone: '0911111111', username: 'nguoi1', password: 'matkhau1' });
    tenantId = tenant.body.id;
    const second = await asAdmin(request(app).post('/api/tenants')).send({ full_name: 'Người Thứ Hai' });
    secondTenantId = second.body.id;

    const assignment = await asAdmin(request(app).post('/api/room_assignments')).send({
      room_id: roomId,
      tenant_id: tenantId,
      start_date: '2026-01-01',
      contract_end_date: '2030-01-01',
      deposit_amount: 1000000,
      is_primary: true,
    });
    assignmentId = assignment.body.id;
    const secondAssignment = await asAdmin(request(app).post('/api/room_assignments')).send({
      room_id: roomId,
      tenant_id: secondTenantId,
      start_date: '2026-01-01',
      deposit_amount: 0,
    });
    secondAssignmentId = secondAssignment.body.id;

    const tenantLogin = await request(app).post('/api/auth/login').send({ username: 'nguoi1', password: 'matkhau1' });
    tenantCookie = tenantLogin.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('rooms list and detail include the current tenants, primary first', async () => {
    const list = await asAdmin(request(app).get('/api/rooms'));
    expect(list.body[0].status).toBe('occupied');
    expect(list.body[0].active_assignments).toHaveLength(2);
    expect(list.body[0].current_tenant.id).toBe(tenantId);

    const detail = await asAdmin(request(app).get(`/api/rooms/${roomId}`));
    expect(detail.body.current_assignment.id).toBe(assignmentId);
    expect((await asAdmin(request(app).get('/api/rooms/missing'))).status).toBe(404);
    expect((await asAdmin(request(app).put('/api/rooms/missing')).send({})).status).toBe(404);
  });

  test('a room can be updated and an empty room deleted', async () => {
    const updated = await asAdmin(request(app).put(`/api/rooms/${roomId}`)).send({ monthly_rent: 3200000, description: 'Đã sơn lại' });
    expect(updated.body.monthly_rent).toBe(3200000);

    const empty = await asAdmin(request(app).post('/api/rooms')).send({ room_number: 'C102' });
    expect((await asAdmin(request(app).delete(`/api/rooms/${empty.body.id}`))).status).toBe(204);
    expect((await asAdmin(request(app).delete(`/api/rooms/${roomId}`))).status).toBe(400);
  });

  test('tenant detail, validation and deletion rules', async () => {
    expect((await asAdmin(request(app).get(`/api/tenants/${tenantId}`))).body.full_name).toBe('Người Thứ Nhất');
    expect((await asAdmin(request(app).get('/api/tenants/missing'))).status).toBe(404);
    expect((await asAdmin(request(app).post('/api/tenants')).send({})).status).toBe(400);
    expect((await asAdmin(request(app).put(`/api/tenants/${tenantId}`)).send({ password: '123' })).status).toBe(400);
    expect((await asAdmin(request(app).delete(`/api/tenants/${tenantId}`))).status).toBe(400);

    const leaving = await asAdmin(request(app).post('/api/tenants')).send({ full_name: 'Sắp Xóa' });
    expect((await asAdmin(request(app).delete(`/api/tenants/${leaving.body.id}`))).status).toBe(204);
  });

  test('assignment rules: capacity, duplicates, primary and extension', async () => {
    const duplicate = await asAdmin(request(app).post('/api/room_assignments')).send({
      room_id: roomId,
      tenant_id: tenantId,
      start_date: '2026-01-01',
    });
    expect(duplicate.status).toBe(400);

    const badDates = await asAdmin(request(app).post('/api/room_assignments')).send({
      room_id: roomId,
      tenant_id: secondTenantId,
      start_date: '2026-01-01',
      contract_end_date: '2025-01-01',
    });
    expect(badDates.status).toBe(400);

    expect((await asAdmin(request(app).put(`/api/room_assignments/${secondAssignmentId}/primary`)).send({})).status).toBe(400);
    expect((await asAdmin(request(app).put(`/api/room_assignments/${secondAssignmentId}/primary`)).send({ room_id: roomId })).status).toBe(200);
    expect((await asAdmin(request(app).put(`/api/room_assignments/${assignmentId}/primary`)).send({ room_id: roomId })).status).toBe(200);

    expect((await asAdmin(request(app).put(`/api/room_assignments/${assignmentId}/extend`)).send({ contract_end_date: 'soon' })).status).toBe(400);
    const extended = await asAdmin(request(app).put(`/api/room_assignments/${assignmentId}/extend`)).send({ contract_end_date: '2031-06-30' });
    expect(extended.body.contract_end_date).toBe('2031-06-30');

    const soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await asAdmin(request(app).put(`/api/room_assignments/${secondAssignmentId}/extend`)).send({ contract_end_date: soon });
    const expiring = await asAdmin(request(app).get('/api/room_assignments/expiring?withinDays=30'));
    expect(expiring.body.map((row) => row.id)).toEqual([secondAssignmentId]);
    expect(expiring.body[0].tenant.full_name).toBe('Người Thứ Hai');
  });

  test('meter readings can be listed, updated and deleted', async () => {
    const created = await asAdmin(request(app).post('/api/meter_readings')).send({
      room_id: roomId,
      reading_date: '2026-03-15',
      electricity_old: 1,
      electricity_new: 2,
      water_old: 1,
      water_new: 2,
    });
    expect(created.status).toBe(201);

    expect((await asAdmin(request(app).get('/api/meter_readings'))).body[0].room.room_number).toBe('C101');
    expect((await asAdmin(request(app).get(`/api/meter_readings/room/${roomId}`))).body).toHaveLength(1);
    expect((await asAdmin(request(app).get(`/api/meter_readings/latest/${roomId}`))).body.id).toBe(created.body.id);

    const updated = await asAdmin(request(app).put(`/api/meter_readings/${created.body.id}`)).send({ electricity_new: 5 });
    expect(updated.body.electricity_new).toBe(5);
    expect((await asAdmin(request(app).put('/api/meter_readings/missing')).send({})).status).toBe(404);
    expect((await asAdmin(request(app).delete(`/api/meter_readings/${created.body.id}`))).status).toBe(204);
  });

  test('invoices: edit, mark paid, overdue and delete', async () => {
    const invoice = await asAdmin(request(app).post('/api/invoices')).send({
      room_id: roomId,
      tenant_id: tenantId,
      invoice_month: 1,
      invoice_year: 2026,
      room_rent: 100,
      due_date: '2020-01-01',
    });
    expect((await asAdmin(request(app).post('/api/invoices')).send({ invoice_month: 1, invoice_year: 2026, room_rent: 1 })).status).toBe(400);
    expect((await asAdmin(request(app).post('/api/invoices')).send({ room_id: roomId, invoice_month: 13, invoice_year: 2026, room_rent: 1 })).status).toBe(400);
    expect((await asAdmin(request(app).post('/api/invoices')).send({ room_id: 'missing', invoice_month: 2, invoice_year: 2026, room_rent: 1 })).status).toBe(404);

    const overdue = await asTenant(request(app).post('/api/invoices/mark-overdue'));
    expect(overdue.status).toBe(200);
    const detail = await asAdmin(request(app).get(`/api/invoices/${invoice.body.id}`));
    expect(detail.body.status).toBe('overdue');

    const edited = await asAdmin(request(app).put(`/api/invoices/${invoice.body.id}`)).send({ other_fees: 50 });
    expect(edited.body.total_amount).toBe(150);
    expect((await asAdmin(request(app).put(`/api/invoices/${invoice.body.id}`)).send({ status: 'nonsense' })).status).toBe(400);
    expect((await asAdmin(request(app).put('/api/invoices/missing')).send({})).status).toBe(404);

    const paid = await asAdmin(request(app).put(`/api/invoices/${invoice.body.id}/paid`));
    expect(paid.body.status).toBe('paid');
    expect(paid.body.paid_date).toBeTruthy();
    expect((await asAdmin(request(app).put('/api/invoices/missing/paid'))).status).toBe(404);
    expect((await asAdmin(request(app).get('/api/invoices/missing'))).status).toBe(404);
    expect((await asAdmin(request(app).delete(`/api/invoices/${invoice.body.id}`))).status).toBe(204);
  });

  test('repairs: admin workflow and tenant edit rules', async () => {
    expect((await asAdmin(request(app).post('/api/repair_requests')).send({ room_id: roomId })).status).toBe(400);
    expect((await asAdmin(request(app).post('/api/repair_requests')).send({ room_id: roomId, title: 'A', priority: 'x' })).status).toBe(400);
    expect((await asAdmin(request(app).post('/api/repair_requests')).send({ room_id: roomId, title: 'A', tenant_id: 'missing' })).status).toBe(400);

    const created = await asAdmin(request(app).post('/api/repair_requests')).send({ room_id: roomId, title: 'Hỏng khóa', tenant_id: tenantId });
    expect(created.status).toBe(201);
    const list = await asAdmin(request(app).get('/api/repair_requests'));
    expect(list.body[0].room.room_number).toBe('C101');
    expect((await asAdmin(request(app).get(`/api/repair_requests/${created.body.id}`))).body.title).toBe('Hỏng khóa');
    expect((await asAdmin(request(app).get('/api/repair_requests/missing'))).status).toBe(404);
    expect((await asAdmin(request(app).put('/api/repair_requests/missing')).send({})).status).toBe(404);

    const edited = await asTenant(request(app).put(`/api/tenant/repair_requests/${created.body.id}`)).send({ title: 'Hỏng khóa cửa', priority: 'urgent' });
    expect(edited.body.title).toBe('Hỏng khóa cửa');
    expect((await asTenant(request(app).put(`/api/tenant/repair_requests/${created.body.id}`)).send({ title: '' })).status).toBe(400);
    expect((await asTenant(request(app).get('/api/tenant/repair_requests'))).body).toHaveLength(1);

    const removable = await asTenant(request(app).post('/api/tenant/repair_requests')).send({ room_id: roomId, title: 'Nhầm' });
    expect((await asTenant(request(app).delete(`/api/tenant/repair_requests/${removable.body.id}`))).status).toBe(204);

    await asAdmin(request(app).put(`/api/repair_requests/${created.body.id}`)).send({ status: 'in_progress' });
    expect((await asTenant(request(app).delete(`/api/tenant/repair_requests/${created.body.id}`))).status).toBe(400);
    expect((await asAdmin(request(app).delete(`/api/repair_requests/${created.body.id}`))).status).toBe(204);
  });

  test('badges and settings are available to signed-in users', async () => {
    expect((await asTenant(request(app).get('/api/badges'))).status).toBe(200);
    expect((await asAdmin(request(app).get('/api/badges'))).status).toBe(200);
    expect((await asAdmin(request(app).put('/api/settings')).send({ landlord_phone: '0900' })).status).toBe(200);
    expect((await asTenant(request(app).get('/api/settings'))).body.landlord_phone).toBe('0900');
    expect((await request(app).get('/api/landlord/contact')).body.phone).toBe('0900');
  });

  test('roommate posts belong to the tenant who created them', async () => {
    const created = await asTenant(request(app).post('/api/roommates')).send({ tieu_de: 'Tìm người ở ghép', gia_chia_se: 1000000 });
    expect(created.status).toBe(201);
    expect((await asTenant(request(app).get('/api/roommates'))).body).toHaveLength(1);
    expect((await asTenant(request(app).get('/api/roommates/my-requests'))).body).toHaveLength(1);
    expect((await asTenant(request(app).put(`/api/roommates/${created.body.id}/close`))).status).toBe(200);
    expect((await asTenant(request(app).get('/api/roommates'))).body).toHaveLength(0);
  });

  test('VietQR proxy validates its input', async () => {
    expect((await request(app).get('/api/public/vietqr-image?amount=0&content=HM1')).status).toBe(400);
    expect((await request(app).get('/api/public/vietqr-image?amount=1000&content=%3Cscript%3E')).status).toBe(400);
    expect((await request(app).get('/api/public/vietqr-image?amount=1000&content=HM1')).status).toBe(503);
  });

  test('Google login reports that it is not configured', async () => {
    const response = await request(app).post('/api/auth/google-login').send({ token: 'x' });
    expect(response.status).toBe(503);
  });

  test('profile update changes details and a new password ends other sessions', async () => {
    const updated = await asTenant(request(app).put('/api/auth/me')).send({ full_name: 'Tên Mới', address: 'Hà Nội' });
    expect(updated.body.user.full_name).toBe('Tên Mới');
    expect((await asTenant(request(app).put('/api/auth/me')).send({ password: '123' })).status).toBe(400);

    const changed = await asTenant(request(app).put('/api/auth/me')).send({ password: 'matkhau2' });
    expect(changed.body.user.must_change_password).toBe(false);
    expect((await asTenant(request(app).get('/api/auth/me'))).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ username: 'nguoi1', password: 'matkhau2' })).status).toBe(200);

    const admin = await asAdmin(request(app).put('/api/auth/me')).send({ phone: '0987' });
    expect(admin.body.user.phone).toBe('0987');
  });

  test('revoking an account blocks login and the old session', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 'nguoi1', password: 'matkhau2' });
    const cookie = login.headers['set-cookie'][0];
    const revoked = await asAdmin(request(app).put(`/api/tenants/${tenantId}`)).send({ username: null, password: null, google_email: null });
    expect(revoked.body.username).toBeNull();
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ username: 'nguoi1', password: 'matkhau2' })).status).toBe(401);
  });

  test('ending a primary contract promotes the remaining tenant', async () => {
    await asAdmin(request(app).post(`/api/room_assignments/${assignmentId}/end`));
    expect((await asAdmin(request(app).post(`/api/room_assignments/${assignmentId}/end`))).status).toBe(400);
    expect((await asAdmin(request(app).put(`/api/room_assignments/${assignmentId}/extend`)).send({ contract_end_date: '2032-01-01' })).status).toBe(400);

    const room = await asAdmin(request(app).get(`/api/rooms/${roomId}`));
    expect(room.body.current_assignment.id).toBe(secondAssignmentId);
    expect(room.body.current_assignment.is_primary).toBe(true);
  });
});
