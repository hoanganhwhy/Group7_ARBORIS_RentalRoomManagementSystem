import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.BANK_ID = '970422';
process.env.BANK_ACCOUNT_NO = '0123456789';
process.env.BANK_ACCOUNT_NAME = 'HOSTELMATE TEST';
process.env.VIETQR_TEMPLATE = 'compact2';
process.env.PAYMENT_PREFIX = 'HM';
process.env.SEPAY_WEBHOOK_API_KEY = 'test-sepay-key';
process.env.SEPAY_ALLOWED_ACCOUNT_NUMBERS = '0123456789';

const [{ default: request }, { default: app }, database] = await Promise.all([
  import('supertest'),
  import('../server.js'),
  import('../db.js'),
]);

const { dbReady, run, closeDatabase } = database;

try {
  await dbReady;

  const invoiceId = 'verify_qr_payment';
  await run(`
    INSERT INTO hoa_don (
      id, phong_id, khach_thue_id, thang_hoa_don, nam_hoa_don,
      tien_phong, tong_tien, trang_thai, han_thanh_toan
    ) VALUES (?, 'r1', 't1', 10, 2046, 3000000, 3000000, 'pending', '2046-10-15')
  `, [invoiceId]);

  const payment = await request(app).get(`/api/invoices/${invoiceId}/payment`);
  assert.equal(payment.status, 200);
  assert.match(payment.body.payment_code, /^HM[A-F0-9]{24}$/);
  assert.equal(payment.body.remaining_amount, 3000000);
  assert.match(payment.body.qr_url, /^https:\/\/img\.vietqr\.io\/image\//);

  const paymentCode = payment.body.payment_code;
  const webhook = (id, amount, content = paymentCode) => request(app)
    .post('/api/webhooks/sepay')
    .set('Authorization', 'Apikey test-sepay-key')
    .send({
      id,
      gateway: 'MB',
      transactionDate: `2046-10-01 08:0${id - 1}:00`,
      accountNumber: '0123456789',
      content,
      transferType: 'in',
      transferAmount: amount,
      accumulated: 5000000 + amount,
      referenceCode: `VERIFY-${id}`,
    });

  const unauthorized = await request(app)
    .post('/api/webhooks/sepay')
    .set('Authorization', 'Apikey invalid')
    .send({ transferType: 'in', transferAmount: 1 });
  assert.equal(unauthorized.status, 401);

  const partial = await webhook(1, 1000000, `THANH TOAN ${paymentCode}`);
  assert.equal(partial.status, 200);
  assert.equal(partial.body.invoice_paid, false);
  assert.equal(partial.body.received_amount, 1000000);

  const duplicate = await webhook(1, 1000000, `THANH TOAN ${paymentCode}`);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);

  const completed = await webhook(2, 2000000, `CON LAI ${paymentCode}`);
  assert.equal(completed.status, 200);
  assert.equal(completed.body.invoice_paid, true);
  assert.equal(completed.body.received_amount, 3000000);

  const invoice = await request(app).get(`/api/invoices/${invoiceId}`);
  assert.equal(invoice.status, 200);
  assert.equal(invoice.body.status, 'paid');

  const finalPayment = await request(app).get(`/api/invoices/${invoiceId}/payment`);
  assert.equal(finalPayment.body.payment_status, 'paid');
  assert.equal(finalPayment.body.remaining_amount, 0);
  assert.equal(finalPayment.body.transactions.length, 2);

  console.log('PASS: VietQR + SePay payment flow verified end-to-end.');
} finally {
  await closeDatabase();
}
