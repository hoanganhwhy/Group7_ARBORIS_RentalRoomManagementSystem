import cron from 'node-cron';

export const setupInvoices = (app, queryAll, queryOne, run) => {

  app.get('/api/invoices', async (req, res) => {
    try {
      const { tenant_id } = req.query;
      let query = `
        SELECT i.*,
               r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
               t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach,
               mr.ngay_ghi_so, mr.so_dien_cu, mr.so_dien_moi, mr.so_nuoc_cu, mr.so_nuoc_moi, mr.don_gia_dien, mr.don_gia_nuoc
        FROM hoa_don i
        LEFT JOIN phong r ON i.phong_id = r.id
        LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
        LEFT JOIN chi_so_dien_nuoc mr ON i.chi_so_dien_nuoc_id = mr.id
      `;
      const params = [];
      if (tenant_id) {
        query += `
          WHERE i.phong_id IN (
            SELECT phong_id FROM hop_dong_thue
            WHERE khach_thue_id = ? AND dang_hoat_dong = 1
          )
        `;
        params.push(tenant_id);
      }
      query += ' ORDER BY i.nam_hoa_don DESC, i.thang_hoa_don DESC';

      const rows = await queryAll(query, params);
      const data = rows.map(i => ({
        id: i.id,
        ma_hoa_don: i.ma_hoa_don,
        room_id: i.phong_id,
        tenant_id: i.khach_thue_id,
        meter_reading_id: i.chi_so_dien_nuoc_id,
        invoice_month: i.thang_hoa_don,
        invoice_year: i.nam_hoa_don,
        room_rent: i.tien_phong,
        electricity_cost: i.tien_dien,
        water_cost: i.tien_nuoc,
        other_fees: i.chi_phi_khac,
        total_amount: i.tong_tien,
        status: i.trang_thai,
        due_date: i.han_thanh_toan,
        paid_date: i.ngay_thanh_toan,
        notes: i.ghi_chu,
        created_at: i.ngay_tao,
        updated_at: i.ngay_cap_nhat,
        room: i.so_phong ? {
          id: i.phong_id,
          room_number: i.so_phong,
          floor: i.tang,
          area_sqm: i.dien_tich,
          monthly_rent: i.gia_phong,
          status: i.room_status,
          description: i.room_desc,
          max_occupants: i.so_nguoi_toi_da
        } : undefined,
        tenant: i.ho_ten ? {
          id: i.khach_thue_id,
          full_name: i.ho_ten,
          phone: i.so_dien_thoai,
          email: i.email
        } : undefined
      }));

      res.json({
        data,
        pagination: {
          page: 1, limit: 10000, totalItems: data.length, totalPages: 1, hasNextPage: false, hasPreviousPage: false
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/invoices/:id', async (req, res) => {
    try {
      const row = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
      if (!row) return res.status(404).json({ error: 'Invoice not found' });
      const i = row;
      res.json({
        id: i.id, ma_hoa_don: i.ma_hoa_don, room_id: i.phong_id, tenant_id: i.khach_thue_id,
        meter_reading_id: i.chi_so_dien_nuoc_id, invoice_month: i.thang_hoa_don, invoice_year: i.nam_hoa_don,
        room_rent: i.tien_phong, electricity_cost: i.tien_dien, water_cost: i.tien_nuoc, other_fees: i.chi_phi_khac,
        total_amount: i.tong_tien, status: i.trang_thai, due_date: i.han_thanh_toan, paid_date: i.ngay_thanh_toan,
        notes: i.ghi_chu, created_at: i.ngay_tao, updated_at: i.ngay_cap_nhat
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


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

  if (process.env.NODE_ENV !== 'test') {
    cron.schedule('0 0 * * *', scanOverdueInvoices);
    scanOverdueInvoices(); // Run once on startup
  }

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
