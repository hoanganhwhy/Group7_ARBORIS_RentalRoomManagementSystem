import fs from 'fs';
import path from 'path';

let content = fs.readFileSync('server.js', 'utf8');

// 1. Add Multer and File Imports
const importLines = `
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fsPromises from 'fs/promises';
`;
content = content.replace(/import aiRoutes from '.\/src\/routes\/ai\.routes\.js';/, `import aiRoutes from './src/routes/ai.routes.js';\n${importLines}`);

// 2. Setup Multer Storage
const multerConfig = `
const uploadDir = path.join(process.cwd(), 'uploads', 'rooms');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG and WEBP images are allowed'));
    }
  }
});
`;
content = content.replace(/app\.set\('io', io\);/, `app.set('io', io);\n${multerConfig}`);

// 3. Static Server
content = content.replace(/app\.use\(express\.json\(\)\);/, `app.use(express.json());\napp.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));`);

// 4. Update POST /api/rooms
const postRoomsOriginal = `    const { area, room_number, floor, area_sqm, monthly_rent, status = 'available', description, max_occupants, air_conditioner, washing_machine, furnished, balcony } = req.body;`;
const postRoomsNew = `    const { area, room_number, floor, area_sqm, monthly_rent, status = 'available', description, max_occupants, air_conditioner, washing_machine, furnished, balcony } = req.body;
    let anh_dai_dien = null;
    if (req.file) {
      anh_dai_dien = '/uploads/rooms/' + req.file.filename;
    }`;
content = content.replace(postRoomsOriginal, postRoomsNew);
content = content.replace(/app\.post\('\/api\/rooms', async \(req, res\) => \{/, `app.post('/api/rooms', upload.single('image'), async (req, res) => {`);

const postInsertOriginal = `INSERT INTO phong (id, nha_tro_id, so_phong, tang, dien_tich, gia_phong, trang_thai, mo_ta, so_nguoi_toi_da, dieu_hoa, may_giat, noi_that, ban_cong)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const postInsertNew = `INSERT INTO phong (id, nha_tro_id, so_phong, tang, dien_tich, gia_phong, trang_thai, mo_ta, so_nguoi_toi_da, dieu_hoa, may_giat, noi_that, ban_cong, anh_dai_dien)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
content = content.replace(postInsertOriginal, postInsertNew);

const postParamsOriginal = `air_conditioner ? 1 : 0, washing_machine ? 1 : 0, furnished ? 1 : 0, balcony ? 1 : 0]);`;
const postParamsNew = `air_conditioner ? 1 : 0, washing_machine ? 1 : 0, furnished ? 1 : 0, balcony ? 1 : 0, anh_dai_dien]);`;
content = content.replace(postParamsOriginal, postParamsNew);

// 5. Update PUT /api/rooms/:id
const putRoomsOriginal = `    const { 
      area, room_number, floor, area_sqm, monthly_rent, status, description, max_occupants,
      address, distance_km, air_conditioner, washing_machine, furnished, balcony
    } = req.body;`;
const putRoomsNew = `    const { 
      area, room_number, floor, area_sqm, monthly_rent, status, description, max_occupants,
      address, distance_km, air_conditioner, washing_machine, furnished, balcony, remove_image
    } = req.body;`;
content = content.replace(putRoomsOriginal, putRoomsNew);
content = content.replace(/app\.put\('\/api\/rooms\/:id', async \(req, res\) => \{/, `app.put('/api/rooms/:id', upload.single('image'), async (req, res) => {`);

const putLogicOriginal = `const existing = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);`;
const putLogicNew = `const existing = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
    let anh_dai_dien = existing.anh_dai_dien;
    if (req.file) {
      anh_dai_dien = '/uploads/rooms/' + req.file.filename;
      if (existing.anh_dai_dien) {
        try {
          await fsPromises.unlink(path.join(process.cwd(), existing.anh_dai_dien));
        } catch(e) {}
      }
    } else if (remove_image === 'true') {
      anh_dai_dien = null;
      if (existing.anh_dai_dien) {
        try {
          await fsPromises.unlink(path.join(process.cwd(), existing.anh_dai_dien));
        } catch(e) {}
      }
    }`;
content = content.replace(putLogicOriginal, putLogicNew);

const putUpdateOriginal = `UPDATE phong 
      SET nha_tro_id = ?, so_phong = ?, tang = ?, dien_tich = ?, gia_phong = ?, trang_thai = ?, mo_ta = ?, so_nguoi_toi_da = ?, dieu_hoa = ?, may_giat = ?, noi_that = ?, ban_cong = ?, ngay_cap_nhat = CURRENT_TIMESTAMP`;
const putUpdateNew = `UPDATE phong 
      SET nha_tro_id = ?, so_phong = ?, tang = ?, dien_tich = ?, gia_phong = ?, trang_thai = ?, mo_ta = ?, so_nguoi_toi_da = ?, dieu_hoa = ?, may_giat = ?, noi_that = ?, ban_cong = ?, anh_dai_dien = ?, ngay_cap_nhat = CURRENT_TIMESTAMP`;
content = content.replace(putUpdateOriginal, putUpdateNew);

const putParamsOriginal = `balcony !== undefined ? (balcony ? 1 : 0) : existing.ban_cong
    ],`;
const putParamsNew = `balcony !== undefined ? (balcony ? 1 : 0) : existing.ban_cong,
      anh_dai_dien
    ],`;
// Wait, the regex might be tricky. Let's just replace the exact block.
// To be safe I will use replace_file_content on server.js manually, or a better string replacement.
