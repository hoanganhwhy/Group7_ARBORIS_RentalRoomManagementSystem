import { jest } from '@jest/globals';

const sendMessage = jest.fn();

jest.unstable_mockModule('@google/genai', () => ({
  GoogleGenAI: class {
    chats = { create: () => ({ sendMessage }) };
  },
}));

const toolCalls = (...calls) => ({ functionCalls: calls });
const lastToolResult = (index = 0) => sendMessage.mock.lastCall[0].message[index].functionResponse.response.result;

describe('AI chatbot', () => {
  let request;
  let app;
  let closeDatabase;
  let adminCookie;
  let tenantCookie;

  const chat = (cookie, body = { message: 'Xin chào' }) => request(app).post('/api/ai/chat').set('Cookie', cookie).send(body);

  beforeAll(async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    request = (await import('supertest')).default;
    app = (await import('../server.js')).default;
    const db = await import('../db.js');
    closeDatabase = db.closeDatabase;
    await db.dbReady;

    const admin = await request(app).post('/api/auth/login').send({ username: 'admin', password: '123456' });
    adminCookie = admin.headers['set-cookie'][0];

    const roomA = await request(app).post('/api/rooms').set('Cookie', adminCookie).send({ room_number: 'A1', monthly_rent: 2000000, location: 'Khu A' });
    await request(app).post('/api/rooms').set('Cookie', adminCookie).send({ room_number: 'B1', monthly_rent: 2000000, location: 'Khu B' });
    const tenant = await request(app).post('/api/tenants').set('Cookie', adminCookie).send({ full_name: 'Khách AI', username: 'khachai', password: 'matkhau1' });
    await request(app).post('/api/room_assignments').set('Cookie', adminCookie).send({ room_id: roomA.body.id, tenant_id: tenant.body.id, start_date: '2026-01-01' });

    const login = await request(app).post('/api/auth/login').send({ username: 'khachai', password: 'matkhau1' });
    tenantCookie = login.headers['set-cookie'][0];
  });

  beforeEach(() => sendMessage.mockReset());

  afterAll(async () => {
    await closeDatabase();
  });

  test('rejects an empty or oversized message', async () => {
    expect((await chat(tenantCookie, { message: ' ' })).status).toBe(400);
    expect((await chat(tenantCookie, { message: 'a'.repeat(2001) })).status).toBe(400);
  });

  test('returns the model reply when no tool is needed', async () => {
    sendMessage.mockResolvedValueOnce({ text: 'Chào bạn' });
    const response = await chat(tenantCookie, { message: 'Xin chào', history: [{ role: 'ai', content: 'Hi' }, { role: 'user', content: '' }] });
    expect(response.status).toBe(200);
    expect(response.body.reply).toBe('Chào bạn');
  });

  test('filters rooms by the area the admin entered', async () => {
    sendMessage
      .mockResolvedValueOnce(toolCalls({ name: 'search_rooms', args: { area: 'Khu B', maxPrice: 3000000, availableOnly: true } }))
      .mockResolvedValueOnce({ text: 'Có một phòng' });
    await chat(tenantCookie);
    expect(lastToolResult().count).toBe(1);
    expect(lastToolResult().data[0].so_phong).toBe('B1');
  });

  test('answers every function call in a turn', async () => {
    sendMessage
      .mockResolvedValueOnce(toolCalls({ name: 'get_my_current_room' }, { name: 'get_my_invoices' }, { name: 'get_my_repair_requests' }))
      .mockResolvedValueOnce({ text: 'Xong' });
    await chat(tenantCookie);
    expect(sendMessage.mock.lastCall[0].message).toHaveLength(3);
    expect(lastToolResult(0).data[0].so_phong).toBe('A1');
  });

  test('stops after the tool round limit', async () => {
    sendMessage.mockResolvedValue(toolCalls({ name: 'get_all_areas' }));
    const response = await chat(tenantCookie);
    expect(response.status).toBe(200);
    expect(sendMessage).toHaveBeenCalledTimes(6);
  });

  test.each([
    'get_admin_room_summary',
    'get_admin_invoice_summary',
    'admin_get_room_invoices',
    'admin_get_room_repair_requests',
    'admin_get_room_tenant',
  ])('a tenant cannot use the admin tool %s', async (name) => {
    sendMessage
      .mockResolvedValueOnce(toolCalls({ name, args: { roomCode: 'A1' } }))
      .mockResolvedValueOnce({ text: 'x' });
    await chat(tenantCookie);
    expect(lastToolResult().success).toBe(false);
  });

  test.each([
    ['get_admin_room_summary', {}],
    ['get_admin_invoice_summary', {}],
    ['admin_get_room_invoices', { roomCode: 'A1', area: 'Khu A' }],
    ['admin_get_room_repair_requests', { roomCode: 'A1', area: 'Khu A' }],
    ['admin_get_room_tenant', { roomCode: 'A1', area: 'Khu A' }],
    ['get_room_by_code', { roomCode: 'A1', area: 'Khu A' }],
    ['get_available_rooms', {}],
    ['get_roommate_requests', {}],
  ])('admin tool %s succeeds', async (name, args) => {
    sendMessage
      .mockResolvedValueOnce(toolCalls({ name, args }))
      .mockResolvedValueOnce({ text: 'x' });
    await chat(adminCookie);
    expect(lastToolResult().success).toBe(true);
  });

  test('hides the area of an occupied room from tenants', async () => {
    sendMessage
      .mockResolvedValueOnce(toolCalls({ name: 'get_room_by_code', args: { roomCode: 'A1' } }))
      .mockResolvedValueOnce({ text: 'x' });
    await chat(tenantCookie);
    expect(lastToolResult().data.khu_vuc).toBe('Bảo mật');
  });

  test('reports roommates for the tenant and rejects unknown tools', async () => {
    sendMessage
      .mockResolvedValueOnce(toolCalls({ name: 'get_my_roommates' }, { name: 'not_a_tool' }))
      .mockResolvedValueOnce({ text: 'x' });
    await chat(tenantCookie);
    expect(lastToolResult(0).success).toBe(true);
    expect(lastToolResult(1).success).toBe(false);
  });

  test('a model failure returns a generic error without internal details', async () => {
    sendMessage.mockRejectedValueOnce(new Error('secret upstream detail'));
    const response = await chat(tenantCookie);
    expect(response.status).toBe(500);
    expect(response.body.error).not.toContain('secret');
  });
});
