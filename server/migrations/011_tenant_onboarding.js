const ONBOARDING_COLUMNS = [
  ['username', 'TEXT'],
  ['password', 'TEXT'],
  ['google_email', 'TEXT'],
  ['created_by_admin', 'INTEGER NOT NULL DEFAULT 1 CHECK (created_by_admin IN (0, 1))'],
  ['google_verified_at', 'TEXT'],
  ['google_account_id', 'TEXT'],
  ['must_change_password', 'INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1))'],
  ['password_changed_at', 'TEXT'],
  ['onboarding_completed', 'INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0, 1))'],
  ["account_status", "TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'LOCKED', 'INACTIVE'))"],
];

/**
 * Adds tenant authentication/onboarding state without rebuilding khach_thue.
 * Existing tenants are backfilled as already active so this migration never
 * forces established accounts through onboarding.
 */
export async function migrateTenantOnboarding({ run, all }) {
  const columns = await all('PRAGMA table_info(khach_thue)');
  const existingNames = new Set(columns.map((column) => column.name));
  const hadLifecycleState = existingNames.has('must_change_password')
    || existingNames.has('onboarding_completed');

  for (const [name, definition] of ONBOARDING_COLUMNS) {
    if (!existingNames.has(name)) {
      await run(`ALTER TABLE khach_thue ADD COLUMN ${name} ${definition}`);
    }
  }

  if (!hadLifecycleState) {
    await run(`
      UPDATE khach_thue
      SET created_by_admin = 0,
          must_change_password = 0,
          onboarding_completed = 1,
          account_status = 'ACTIVE'
    `);
  }

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_khach_thue_google_account_id
    ON khach_thue(google_account_id)
    WHERE google_account_id IS NOT NULL
  `);
  await run(`
    CREATE INDEX IF NOT EXISTS idx_khach_thue_onboarding
    ON khach_thue(onboarding_completed, must_change_password)
  `);
}
