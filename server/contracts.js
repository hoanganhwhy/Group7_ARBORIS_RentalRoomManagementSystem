import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const setupContracts = (app, queryAll, queryOne, run) => {
  // Ensure uploads/contracts exists
  const contractsDir = path.join(__dirname, 'uploads', 'contracts');
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  app.post('/api/contracts/:id/generate', async (req, res) => {
    try {
      const contractId = req.params.id;
      // Fetch contract, tenant, and room details
      const contract = await queryOne('SELECT * FROM hop_dong_thue WHERE id = ?', [contractId]);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });

      const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [contract.khach_thue_id]);
      const room = await queryOne('SELECT * FROM phong WHERE id = ?', [contract.phong_id]);

      const fileName = `contract_${contractId}_${Date.now()}.pdf`;
      const filePath = path.join(contractsDir, fileName);

      // Create PDF
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Try to use Arial font if available, else default (default won't support VN properly, but it's a fallback)
      const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
      if (fs.existsSync(fontPath)) {
        doc.font(fontPath);
      }

      // Title
      doc.fontSize(20).text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' });
      doc.fontSize(14).text('Độc lập - Tự do - Hạnh phúc', { align: 'center' });
      doc.moveDown();
      doc.fontSize(18).text('HỢP ĐỒNG THUÊ PHÒNG TRỌ', { align: 'center' });
      doc.moveDown(2);

      // Content
      doc.fontSize(12);
      doc.text(`Hôm nay, ngày ${new Date().toLocaleDateString('vi-VN')}, chúng tôi gồm:`);
      doc.moveDown();
      doc.text('BÊN CHO THUÊ (BÊN A):', { underline: true });
      doc.text('Đại diện: Chủ nhà HostelMate');
      doc.moveDown();
      doc.text('BÊN THUÊ (BÊN B):', { underline: true });
      doc.text(`Họ và tên: ${tenant.ho_ten || '...................................'}`);
      doc.text(`SĐT: ${tenant.so_dien_thoai || '...................................'}`);
      doc.text(`CCCD: ${tenant.so_cccd || '...................................'}`);
      doc.text(`Địa chỉ: ${tenant.dia_chi || '...................................'}`);
      doc.moveDown();
      
      doc.text('NỘI DUNG HỢP ĐỒNG:', { underline: true });
      doc.text(`Bên A đồng ý cho Bên B thuê phòng: ${room.so_phong} (Khu: ${room.khu_vuc})`);
      doc.text(`Giá thuê: ${room.gia_phong.toLocaleString()} VNĐ/tháng`);
      doc.text(`Tiền đặt cọc: ${(contract.tien_dat_coc || 0).toLocaleString()} VNĐ`);
      doc.text(`Ngày bắt đầu thuê: ${contract.ngay_bat_dau}`);
      doc.text(`Ngày kết thúc (dự kiến): ${contract.ngay_ket_thuc || 'Không xác định'}`);
      
      doc.moveDown(3);
      doc.text('BÊN A (Ký, ghi rõ họ tên)                                      BÊN B (Ký, ghi rõ họ tên)');
      
      // Add signature image if available
      if (contract.chu_ky_khach) {
        try {
          // chu_ky_khach is a base64 data URI: "data:image/png;base64,iVBORw0KGgo..."
          const base64Data = contract.chu_ky_khach.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          doc.image(imageBuffer, 350, doc.y, { width: 150 });
        } catch (err) {
          console.error('Failed to add signature to PDF', err);
        }
      }

      doc.end();

      stream.on('finish', async () => {
        // Update DB
        await run('UPDATE hop_dong_thue SET file_hop_dong = ? WHERE id = ?', [fileName, contractId]);
        res.json({ success: true, fileName });
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Download PDF
  app.get('/api/contracts/:id/download', async (req, res) => {
    try {
      // NOTE: Normally we should authenticate the user here using cookies/tokens.
      // For simplicity in Phase 2 Demo, we'll allow downloading if the ID matches.
      const contractId = req.params.id;
      const contract = await queryOne('SELECT * FROM hop_dong_thue WHERE id = ?', [contractId]);
      if (!contract || !contract.file_hop_dong) return res.status(404).send('Not found');

      const filePath = path.join(contractsDir, contract.file_hop_dong);
      if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

      res.download(filePath);
    } catch (error) {
      res.status(500).send('Server Error');
    }
  });

  // Sign contract
  app.post('/api/contracts/:id/sign', async (req, res) => {
    try {
      const contractId = req.params.id;
      const { signatureBase64 } = req.body;
      
      if (!signatureBase64) return res.status(400).json({ error: 'Signature is required' });

      await run('UPDATE hop_dong_thue SET chu_ky_khach = ?, trang_thai_ky = "Đã ký" WHERE id = ?', [signatureBase64, contractId]);
      
      // Auto regenerate PDF
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Tenant portal data
  app.get('/api/tenant/portal', async (req, res) => {
    try {
      const { tenant_id } = req.query;
      if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });

      // Get active assignment
      const assignment = await queryOne('SELECT * FROM hop_dong_thue WHERE khach_thue_id = ? AND dang_hoat_dong = 1', [tenant_id]);
      
      let room = null;
      let dien_nuoc_info = null;
      let chu_hop_dong = null;
      let so_nguoi_o = 0;

      if (assignment) {
        const rawRoom = await queryOne('SELECT p.*, n.ten_nha_tro as khu_vuc FROM phong p LEFT JOIN nha_tro n ON p.nha_tro_id = n.id WHERE p.id = ?', [assignment.phong_id]);
        if (rawRoom) {
          room = {
            ...rawRoom,
            room_number: rawRoom.so_phong,
            area: rawRoom.khu_vuc
          };
        }

        // Get electricity and water prices from the latest meter reading
        const latestReading = await queryOne('SELECT don_gia_dien, don_gia_nuoc FROM chi_so_dien_nuoc WHERE phong_id = ? ORDER BY ngay_ghi_so DESC LIMIT 1', [assignment.phong_id]);
        dien_nuoc_info = latestReading || { don_gia_dien: 3500, don_gia_nuoc: 15000 };

        // Get contract owner (nguoi dai dien)
        const ownerAssignment = await queryOne('SELECT khach_thue_id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1 AND la_nguoi_dai_dien = 1', [assignment.phong_id]);
        if (ownerAssignment) {
          const owner = await queryOne('SELECT ho_ten FROM khach_thue WHERE id = ?', [ownerAssignment.khach_thue_id]);
          if (owner) chu_hop_dong = owner.ho_ten;
        }

        // Get total occupants
        const occupants = await queryAll('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1', [assignment.phong_id]);
        so_nguoi_o = occupants.length;
      }

      // Get invoices
      const invoices = await queryAll('SELECT * FROM hoa_don WHERE khach_thue_id = ? AND trang_thai IN ("pending", "overdue")', [tenant_id]);
      const mappedInvoices = invoices.map(i => ({
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
        created_at: i.created_at || i.ngay_tao,
        updated_at: i.ngay_cap_nhat || i.updated_at
      }));
      
      res.json({
        assignment,
        room,
        dien_nuoc_info,
        chu_hop_dong,
        so_nguoi_o,
        unpaidInvoices: mappedInvoices
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
