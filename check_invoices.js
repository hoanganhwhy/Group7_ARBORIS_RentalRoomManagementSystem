import { query } from './server/db.js';

async function checkInvoices() {
  const invoices = await query('SELECT * FROM hoa_don');
  console.log(invoices);
}
checkInvoices();
