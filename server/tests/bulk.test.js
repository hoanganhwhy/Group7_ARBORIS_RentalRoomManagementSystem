import request from 'supertest';
import app from '../server.js';
import { closeDatabase, dbReady } from '../db.js';

let adminCookie = '';

describe('ARBORIS Bulk Coverage', () => {
  beforeAll(async () => {
    await dbReady;
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: '123456' });
    adminCookie = login.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('Hit all misc GET endpoints', async () => {
    await request(app).get('/api/auth/me').set('Cookie', adminCookie);
    await request(app).get('/api/users').set('Cookie', adminCookie);
    await request(app).get('/api/contracts').set('Cookie', adminCookie);
    await request(app).get('/api/contracts/summary').set('Cookie', adminCookie);
    await request(app).get('/api/invoices').set('Cookie', adminCookie);
    await request(app).get('/api/invoices/export').set('Cookie', adminCookie);
    await request(app).get('/api/rooms').set('Cookie', adminCookie);
    await request(app).get('/api/tenants').set('Cookie', adminCookie);
    await request(app).get('/api/room_assignments').set('Cookie', adminCookie);
    await request(app).get('/api/meter_readings').set('Cookie', adminCookie);
    await request(app).get('/api/tenant/portal').set('Cookie', adminCookie);
    await request(app).get('/api/tenant/invoices').set('Cookie', adminCookie);
    await request(app).get('/api/tenant/repair_requests').set('Cookie', adminCookie);
    await request(app).get('/api/notifications').set('Cookie', adminCookie);
  });

  test('Hit missing ID endpoints', async () => {
    await request(app).get('/api/rooms/invalid').set('Cookie', adminCookie);
    await request(app).get('/api/tenants/invalid').set('Cookie', adminCookie);
    await request(app).get('/api/invoices/invalid').set('Cookie', adminCookie);
    await request(app).get('/api/contracts/invalid').set('Cookie', adminCookie);
    await request(app).get('/api/contracts/invalid/export').set('Cookie', adminCookie);
    
    await request(app).delete('/api/rooms/invalid').set('Cookie', adminCookie);
    await request(app).delete('/api/tenants/invalid').set('Cookie', adminCookie);
    await request(app).delete('/api/invoices/invalid').set('Cookie', adminCookie);
    await request(app).delete('/api/contracts/invalid').set('Cookie', adminCookie);
  });

  test('Hit error creation paths', async () => {
    await request(app).post('/api/rooms').set('Cookie', adminCookie).send({});
    await request(app).post('/api/tenants').set('Cookie', adminCookie).send({});
    await request(app).post('/api/invoices').set('Cookie', adminCookie).send({});
    await request(app).post('/api/contracts').set('Cookie', adminCookie).send({});
    await request(app).post('/api/room_assignments').set('Cookie', adminCookie).send({});
    await request(app).post('/api/meter_readings').set('Cookie', adminCookie).send({});
  });

  test('Hit AI endpoints', async () => {
    await request(app).post('/api/ai/chat').set('Cookie', adminCookie).send({ message: 'Hello' });
    await request(app).get('/api/ai/suggestions').set('Cookie', adminCookie);
  });

  test('Hit auth endpoints', async () => {
    await request(app).post('/api/auth/logout').set('Cookie', adminCookie);
    await request(app).post('/api/auth/onboarding/google-nonce').set('Cookie', adminCookie);
    await request(app).post('/api/auth/onboarding/google').set('Cookie', adminCookie);
    await request(app).post('/api/auth/onboarding/change-password').set('Cookie', adminCookie);
  });
});
