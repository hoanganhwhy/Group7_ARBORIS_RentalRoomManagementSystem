import { query } from './server/db.js';

async function checkUsers() {
  const users = await query('SELECT * FROM users');
  console.log('USERS:', users);
  
  const tenants = await query('SELECT * FROM khach_thue');
  console.log('TENANTS:', tenants);
  
  const invoices = await query('SELECT * FROM hoa_don');
  console.log('INVOICES:', invoices);
}
checkUsers();
