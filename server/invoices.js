import cron from 'node-cron';

export const setupInvoices = (app, queryAll, queryOne, run) => {
  
  // Cron Job: Run every day at 00:00
  // For demo purposes, we will also scan when server starts
  const scanOverdueInvoices = async () => {
    try {
      console.log('[Cron] Scanning for overdue invoices...');
      const today = new Date().toISOString().split('T')[0];
      
      // Update pending invoices to overdue if han_thanh_toan < today
      await run(`
        UPDATE hoa_don 
        SET trang_thai = 'overdue' 
        WHERE trang_thai = 'pending' AND han_thanh_toan < ?
      `, [today]);

      console.log('[Cron] Finished scanning overdue invoices.');
      
      // NOTE: Here you would integrate nodemailer to send emails.
      // We will skip sending actual emails to avoid spamming the terminal,
      // but the architecture supports querying these 'overdue' invoices and sending emails.
    } catch (err) {
      console.error('[Cron Error]', err);
    }
  };

  cron.schedule('0 0 * * *', scanOverdueInvoices);
  scanOverdueInvoices(); // Run once on startup

  // Mock Payment IPN Webhook
  app.post('/api/payments/webhook', async (req, res) => {
    try {
      // In a real VNPay/Momo integration, req.body contains vnp_TxnRef, vnp_TransactionStatus, vnp_SecureHash
      // Here we simulate it
      const { ma_hoa_don, status, phuong_thuc } = req.body;
      
      if (!ma_hoa_don) return res.status(400).json({ error: 'Missing ma_hoa_don' });

      if (status === 'success') {
        const today = new Date().toISOString().split('T')[0];
        await run(`
          UPDATE hoa_don 
          SET trang_thai = 'paid', phuong_thuc_thanh_toan = ?, ngay_thanh_toan = ?
          WHERE ma_hoa_don = ?
        `, [phuong_thuc || 'Bank', today, ma_hoa_don]);
        
        res.json({ message: 'Payment successful', ma_hoa_don });
      } else {
        res.json({ message: 'Payment failed or pending' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Manual trigger for testing
  app.post('/api/invoices/check-overdue', async (req, res) => {
    await scanOverdueInvoices();
    res.json({ success: true });
  });
};
