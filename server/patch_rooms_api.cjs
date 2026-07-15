const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// 1. Add Multer and File Imports
if (!code.includes('import multer from')) {
  code = code.replace(
    /import aiRoutes from '.\/src\/routes\/ai\.routes\.js';/,
    `import aiRoutes from './src/routes/ai.routes.js';\nimport multer from 'multer';\nimport { v4 as uuidv4 } from 'uuid';\nimport fsPromises from 'fs/promises';`
  );
}

// 2. Setup Multer Storage
if (!code.includes('const uploadDir = path.join')) {
  code = code.replace(
    /app\.set\('io', io\);/,
    `app.set('io', io);\n\nconst uploadDir = path.join(process.cwd(), 'uploads', 'rooms');\nif (!fs.existsSync(uploadDir)) {\n  fs.mkdirSync(uploadDir, { recursive: true });\n}\n\nconst storage = multer.diskStorage({\n  destination: function (req, file, cb) {\n    cb(null, uploadDir);\n  },\n  filename: function (req, file, cb) {\n    const ext = path.extname(file.originalname);\n    cb(null, uuidv4() + ext);\n  }\n});\n\nconst upload = multer({ \n  storage: storage,\n  limits: { fileSize: 5 * 1024 * 1024 },\n  fileFilter: (req, file, cb) => {\n    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {\n      cb(null, true);\n    } else {\n      cb(new Error('Only JPG, PNG and WEBP images are allowed'));\n    }\n  }\n});`
  );
}

// 3. Static Server
if (!code.includes("app.use('/uploads'")) {
  code = code.replace(
    /app\.use\(express\.json\(\)\);/,
    `app.use(express.json());\napp.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));`
  );
}

// 4. POST /api/rooms
code = code.replace(
  /app\.post\('\/api\/rooms', async \(req, res\) => \{/,
  `app.post('/api/rooms', upload.single('image'), async (req, res) => {`
);

const postBodyRegex = /const\s*\{\s*area\s*=\s*'Khu A',([^}]*)\}\s*=\s*req\.body;/;
const matchBody = code.match(postBodyRegex);
if (matchBody) {
  code = code.replace(
    postBodyRegex,
    matchBody[0] + `\n      let anh_dai_dien = null;\n      if (req.file) {\n        anh_dai_dien = '/uploads/rooms/' + req.file.filename;\n      }`
  );
}

const postInsertRegex = /INSERT INTO phong \(([^)]+)\)\n\s*VALUES \(([^)]+)\)/;
const matchInsert = code.match(postInsertRegex);
if (matchInsert && !matchInsert[0].includes('anh_dai_dien')) {
  code = code.replace(
    postInsertRegex,
    `INSERT INTO phong (${matchInsert[1]}, anh_dai_dien)\n        VALUES (${matchInsert[2]}, ?)`
  );
}

const postParamsRegex = /ban_cong \? 1 : 0\]\);/;
code = code.replace(
  postParamsRegex,
  `ban_cong ? 1 : 0, anh_dai_dien]);`
);

// 5. PUT /api/rooms/:id
code = code.replace(
  /app\.put\('\/api\/rooms\/:id', async \(req, res\) => \{/,
  `app.put('/api/rooms/:id', upload.single('image'), async (req, res) => {`
);

const putBodyRegex = /const\s*\{\s*area, room_number,([^}]*)\}\s*=\s*req\.body;/;
const matchPutBody = code.match(putBodyRegex);
if (matchPutBody) {
  code = code.replace(
    putBodyRegex,
    `const { \n        area, room_number, floor, area_sqm, monthly_rent, status, description, max_occupants,\n        address, distance_km, air_conditioner, washing_machine, furnished, balcony, remove_image\n      } = req.body;`
  );
}

const putLogicRegex = /const existing = await queryOne\('SELECT \* FROM phong WHERE id = \?', \[req\.params\.id\]\);([^}]*)return res\.status\(404\)\.json\(\{ error: 'Room not found' \}\);\n\s*\}/;
const matchPutLogic = code.match(putLogicRegex);
if (matchPutLogic) {
  const newPutLogic = matchPutLogic[0] + `\n\n      let anh_dai_dien = existing.anh_dai_dien;\n      if (req.file) {\n        anh_dai_dien = '/uploads/rooms/' + req.file.filename;\n        if (existing.anh_dai_dien) {\n          try {\n            await fsPromises.unlink(path.join(process.cwd(), existing.anh_dai_dien));\n          } catch(e) {}\n        }\n      } else if (remove_image === 'true' || remove_image === true) {\n        anh_dai_dien = null;\n        if (existing.anh_dai_dien) {\n          try {\n            await fsPromises.unlink(path.join(process.cwd(), existing.anh_dai_dien));\n          } catch(e) {}\n        }\n      }`;
  code = code.replace(matchPutLogic[0], newPutLogic);
}

const putUpdateRegex = /UPDATE phong \n\s*SET nha_tro_id = \?,([^W]+)WHERE id = \?/;
const matchPutUpdate = code.match(putUpdateRegex);
if (matchPutUpdate && !matchPutUpdate[0].includes('anh_dai_dien = ?')) {
  code = code.replace(
    /ban_cong = \?, ngay_cap_nhat = CURRENT_TIMESTAMP/,
    `ban_cong = ?, anh_dai_dien = ?, ngay_cap_nhat = CURRENT_TIMESTAMP`
  );
}

const putParamsRegex = /balcony !== undefined \? \(balcony \? 1 : 0\) : existing\.ban_cong\n\s*\]/;
if (code.match(putParamsRegex)) {
  code = code.replace(
    putParamsRegex,
    `balcony !== undefined ? (balcony ? 1 : 0) : existing.ban_cong,\n        anh_dai_dien\n      ]`
  );
}

// 6. DELETE /api/rooms/:id
const delLogicRegex = /await run\('DELETE FROM phong WHERE id = \?', \[req\.params\.id\]\);/;
if (code.match(delLogicRegex)) {
  code = code.replace(
    delLogicRegex,
    `const existing = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);\n      if (existing && existing.anh_dai_dien) {\n        try {\n          await fsPromises.unlink(path.join(process.cwd(), existing.anh_dai_dien));\n        } catch(e) {}\n      }\n      await run('DELETE FROM phong WHERE id = ?', [req.params.id]);`
  );
}

fs.writeFileSync('server.js', code);
console.log('Patched server.js successfully');
