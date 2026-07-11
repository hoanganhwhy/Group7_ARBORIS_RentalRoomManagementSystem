import { run } from './server/db.js';

async function sync() {
  await run(`
    UPDATE users 
    SET 
      full_name = (SELECT ho_ten FROM khach_thue WHERE khach_thue.id = users.tenant_id),
      phone = (SELECT so_dien_thoai FROM khach_thue WHERE khach_thue.id = users.tenant_id),
      email = (SELECT email FROM khach_thue WHERE khach_thue.id = users.tenant_id),
      cccd = (SELECT so_cccd FROM khach_thue WHERE khach_thue.id = users.tenant_id),
      date_of_birth = (SELECT ngay_sinh FROM khach_thue WHERE khach_thue.id = users.tenant_id),
      address = (SELECT dia_chi FROM khach_thue WHERE khach_thue.id = users.tenant_id)
    WHERE role = 'TENANT' AND tenant_id IS NOT NULL
  `);
  console.log('Synced!');
}
sync();
