import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server.js';
import { closeDatabase, dbReady, queryOne, run } from '../db.js';

const ACTIVE_USER_ID = 'auth_existing_active';
const ONBOARDING_USER_ID = 'auth_onboarding_user';
const DUPLICATE_USER_ID = 'auth_google_duplicate';
const originalGoogleVerifier = app.get('googleTokenVerifier');

async function deleteFixtures() {
  await run('DELETE FROM khach_thue WHERE id IN (?, ?, ?)', [
    ACTIVE_USER_ID,
    ONBOARDING_USER_ID,
    DUPLICATE_USER_ID,
  ]);
}

async function insertTenant({
  id,
  username,
  password,
  email,
  createdByAdmin,
  googleVerifiedAt = null,
  googleAccountId = null,
  mustChangePassword,
  onboardingCompleted,
  accountStatus = 'ACTIVE',
}) {
  await run(`
    INSERT INTO khach_thue (
      id, ho_ten, email, username, password, created_by_admin,
      google_verified_at, google_account_id, must_change_password,
      onboarding_completed, account_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    `Test ${username}`,
    email,
    username,
    password,
    createdByAdmin ? 1 : 0,
    googleVerifiedAt,
    googleAccountId,
    mustChangePassword ? 1 : 0,
    onboardingCompleted ? 1 : 0,
    accountStatus,
  ]);
}

describe('Tenant authentication and mandatory onboarding', () => {
  beforeAll(async () => {
    await dbReady;
    await deleteFixtures();
  });

  afterEach(async () => {
    app.set('googleTokenVerifier', originalGoogleVerifier);
    await deleteFixtures();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('an existing active tenant signs in directly and never receives password data', async () => {
    await insertTenant({
      id: ACTIVE_USER_ID,
      username: 'existing_active',
      password: await bcrypt.hash('ExistingPass1', 10),
      email: 'existing@example.com',
      createdByAdmin: false,
      mustChangePassword: false,
      onboardingCompleted: true,
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'existing_active', password: 'ExistingPass1' });

    expect(response.status).toBe(200);
    expect(response.body.nextStep).toBe('DASHBOARD');
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.user.password_hash).toBeUndefined();
    expect(response.body.user.onboardingCompleted).toBe(true);
  });

  test('locked and inactive tenants receive clear account-state errors', async () => {
    await insertTenant({
      id: ACTIVE_USER_ID,
      username: 'locked_tenant',
      password: await bcrypt.hash('ExistingPass1', 10),
      email: 'locked@example.com',
      createdByAdmin: false,
      mustChangePassword: false,
      onboardingCompleted: true,
      accountStatus: 'LOCKED',
    });

    const locked = await request(app)
      .post('/api/auth/login')
      .send({ username: 'locked_tenant', password: 'ExistingPass1' });
    expect(locked.status).toBe(423);

    await run("UPDATE khach_thue SET account_status = 'INACTIVE' WHERE id = ?", [ACTIVE_USER_ID]);
    const inactive = await request(app)
      .post('/api/auth/login')
      .send({ username: 'locked_tenant', password: 'ExistingPass1' });
    expect(inactive.status).toBe(403);
  });

  test('admin-created tenant must verify Google, change password, then can use the app', async () => {
    const agent = request.agent(app);
    await insertTenant({
      id: ONBOARDING_USER_ID,
      username: 'onboarding_user',
      password: 'TempPass1',
      email: 'onboarding@example.com',
      createdByAdmin: true,
      mustChangePassword: true,
      onboardingCompleted: false,
    });

    const login = await agent
      .post('/api/auth/login')
      .send({ username: 'onboarding_user', password: 'TempPass1' });
    expect(login.status).toBe(200);
    expect(login.body.nextStep).toBe('VERIFY_GOOGLE');
    expect(login.body.user.googleVerified).toBe(false);

    const passwordAfterLogin = await queryOne('SELECT password FROM khach_thue WHERE id = ?', [ONBOARDING_USER_ID]);
    expect(passwordAfterLogin.password).toMatch(/^\$2[aby]\$/);

    const blockedBeforeGoogle = await agent.get('/api/invoices');
    expect(blockedBeforeGoogle.status).toBe(403);
    expect(blockedBeforeGoogle.body.nextStep).toBe('VERIFY_GOOGLE');

    const refreshed = await agent.get('/api/auth/me');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.nextStep).toBe('VERIFY_GOOGLE');

    const firstNonce = await agent.get('/api/auth/onboarding/google-nonce');
    expect(firstNonce.status).toBe(200);
    app.set('googleTokenVerifier', async () => ({
      getPayload: () => ({
        sub: 'google-account-1',
        email: 'onboarding@example.com',
        email_verified: true,
        nonce: 'incorrect-nonce',
      }),
    }));
    const wrongState = await agent
      .post('/api/auth/onboarding/google')
      .send({ credential: 'invalid-state-credential' });
    expect(wrongState.status).toBe(400);

    await insertTenant({
      id: DUPLICATE_USER_ID,
      username: 'duplicate_google',
      password: await bcrypt.hash('ExistingPass1', 10),
      email: 'duplicate@example.com',
      createdByAdmin: false,
      googleVerifiedAt: new Date().toISOString(),
      googleAccountId: 'google-account-already-linked',
      mustChangePassword: false,
      onboardingCompleted: true,
    });

    const duplicateNonce = await agent.get('/api/auth/onboarding/google-nonce');
    app.set('googleTokenVerifier', async () => ({
      getPayload: () => ({
        sub: 'google-account-already-linked',
        email: 'onboarding@example.com',
        email_verified: true,
        nonce: duplicateNonce.body.nonce,
      }),
    }));
    const duplicateGoogle = await agent
      .post('/api/auth/onboarding/google')
      .send({ credential: 'duplicate-google-credential' });
    expect(duplicateGoogle.status).toBe(409);

    const validNonce = await agent.get('/api/auth/onboarding/google-nonce');
    app.set('googleTokenVerifier', async () => ({
      getPayload: () => ({
        sub: 'google-account-1',
        email: 'onboarding@example.com',
        email_verified: true,
        nonce: validNonce.body.nonce,
      }),
    }));
    const verified = await agent
      .post('/api/auth/onboarding/google')
      .send({ credential: 'valid-google-credential' });
    expect(verified.status).toBe(200);
    expect(verified.body.nextStep).toBe('CHANGE_PASSWORD');
    expect(verified.body.user.googleVerified).toBe(true);

    const blockedBeforePassword = await agent.get('/api/invoices');
    expect(blockedBeforePassword.status).toBe(403);
    expect(blockedBeforePassword.body.nextStep).toBe('CHANGE_PASSWORD');

    const weakPassword = await agent
      .post('/api/auth/onboarding/change-password')
      .send({ newPassword: 'short' });
    expect(weakPassword.status).toBe(400);

    const reusedTemporaryPassword = await agent
      .post('/api/auth/onboarding/change-password')
      .send({ newPassword: 'TempPass1' });
    expect(reusedTemporaryPassword.status).toBe(400);

    const completed = await agent
      .post('/api/auth/onboarding/change-password')
      .send({ newPassword: 'NewSecure2' });
    expect(completed.status).toBe(200);
    expect(completed.body.nextStep).toBe('DASHBOARD');
    expect(completed.body.user.onboardingCompleted).toBe(true);
    expect(completed.body.user.password).toBeUndefined();

    const storedState = await queryOne(`
      SELECT google_verified_at, google_account_id, must_change_password,
             password_changed_at, onboarding_completed
      FROM khach_thue WHERE id = ?
    `, [ONBOARDING_USER_ID]);
    expect(storedState.google_verified_at).toBeTruthy();
    expect(storedState.google_account_id).toBe('google-account-1');
    expect(storedState.must_change_password).toBe(0);
    expect(storedState.password_changed_at).toBeTruthy();
    expect(storedState.onboarding_completed).toBe(1);

    const allowedAfterCompletion = await agent.get('/api/invoices');
    expect(allowedAfterCompletion.status).toBe(200);

    const oldPasswordLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'onboarding_user', password: 'TempPass1' });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'onboarding_user', password: 'NewSecure2' });
    expect(newPasswordLogin.status).toBe(200);
    expect(newPasswordLogin.body.nextStep).toBe('DASHBOARD');
  });
});
