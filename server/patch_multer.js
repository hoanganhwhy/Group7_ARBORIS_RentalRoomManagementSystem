import fs from 'fs';
import path from 'path';

let content = fs.readFileSync('server.js', 'utf8');

const importLines = `
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fsPromises from 'fs/promises';
`;

// Add imports after import aiRoutes
content = content.replace(/import aiRoutes from '.\/src\/routes\/ai\.routes\.js';/, `import aiRoutes from './src/routes/ai.routes.js';\n${importLines}`);

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

// Add multer config after app.set('io', io);
content = content.replace(/app\.set\('io', io\);/, `app.set('io', io);\n${multerConfig}`);

// Add static route after app.use(express.json());
content = content.replace(/app\.use\(express\.json\(\)\);/, `app.use(express.json());\napp.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));`);

// Replace app.post('/api/rooms', async (req, res) => {
// with app.post('/api/rooms', upload.single('image'), async (req, res) => {
content = content.replace(/app\.post\('\/api\/rooms', async \(req, res\) => \{/, `app.post('/api/rooms', upload.single('image'), async (req, res) => {`);

// Replace app.put('/api/rooms/:id', async (req, res) => {
// with app.put('/api/rooms/:id', upload.single('image'), async (req, res) => {
content = content.replace(/app\.put\('\/api\/rooms\/:id', async \(req, res\) => \{/, `app.put('/api/rooms/:id', upload.single('image'), async (req, res) => {`);

fs.writeFileSync('server.js', content);
