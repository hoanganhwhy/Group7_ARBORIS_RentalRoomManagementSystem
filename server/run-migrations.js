import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath);
const run = promisify(db.run.bind(db));
const all = promisify(db.all.bind(db));

async function runMigrations() {
  console.log('--- Bắt đầu chạy Migrations ---');
  
  // 1. Tạo bảng schema_migrations
  await run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Lấy danh sách migration đã chạy
  const appliedMigrations = await all(`SELECT version FROM schema_migrations`);
  const appliedSet = new Set(appliedMigrations.map(m => m.version));

  // 3. Định nghĩa các hàm migration bằng code JS để linh hoạt kiểm tra schema cũ
  const migrations = [
    {
      version: '001_initial_schema',
      up: async () => {
        const script = fs.readFileSync(join(__dirname, 'migrations', '001_initial_schema.sql'), 'utf-8');
        const statements = script.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (let stmt of statements) {
          await run(stmt);
        }
      }
    },
    {
      version: '002_refactor_nha_tro_phong',
      up: async () => {
        // Tạo bảng nha_tro
        await run(`
          CREATE TABLE IF NOT EXISTS nha_tro (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              ten_nha_tro TEXT NOT NULL,
              dia_chi TEXT NOT NULL,
              vi_do REAL,
              kinh_do REAL,
              mo_ta TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // Tạo 1 nhà trọ mặc định nếu chưa có
        await run(`INSERT INTO nha_tro (ten_nha_tro, dia_chi) SELECT 'Nhà trọ mặc định', 'Chưa xác định' WHERE NOT EXISTS (SELECT 1 FROM nha_tro)`);
        
        // Kiểm tra các cột của bảng phong hiện tại
        const columns = await all(`PRAGMA table_info(phong)`);
        const colNames = columns.map(c => c.name);
        
        // Bảng mới phong_new
        await run(`
          CREATE TABLE phong_new (
              id TEXT PRIMARY KEY,
              nha_tro_id INTEGER NOT NULL DEFAULT 1,
              so_phong TEXT NOT NULL,
              tang INTEGER NOT NULL DEFAULT 1,
              dien_tich REAL NOT NULL DEFAULT 0 CHECK (dien_tich > 0),
              gia_phong REAL NOT NULL DEFAULT 0 CHECK (gia_phong > 0),
              trang_thai TEXT NOT NULL DEFAULT 'available' CHECK (trang_thai IN ('available', 'occupied', 'maintenance')),
              mo_ta TEXT,
              so_nguoi_toi_da INTEGER NOT NULL DEFAULT 2 CHECK (so_nguoi_toi_da > 0),
              dieu_hoa INTEGER NOT NULL DEFAULT 0,
              may_giat INTEGER NOT NULL DEFAULT 0,
              noi_that INTEGER NOT NULL DEFAULT 0,
              ban_cong INTEGER NOT NULL DEFAULT 0,
              ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
              ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (nha_tro_id) REFERENCES nha_tro(id),
              UNIQUE(nha_tro_id, so_phong)
          )
        `);

        // Xây dựng câu lệnh INSERT INTO SELECT động
        const hasDieuHoa = colNames.includes('dieu_hoa');
        const hasMayGiat = colNames.includes('may_giat');
        const hasNoiThat = colNames.includes('noi_that');
        const hasBanCong = colNames.includes('ban_cong');

        const insertCols = ['id', 'so_phong', 'tang', 'dien_tich', 'gia_phong', 'trang_thai', 'mo_ta', 'so_nguoi_toi_da', 'ngay_tao', 'ngay_cap_nhat'];
        const selectCols = ['id', 'so_phong', 'tang', 'dien_tich', 'gia_phong', 'trang_thai', 'mo_ta', 'so_nguoi_toi_da', 'ngay_tao', 'ngay_cap_nhat'];
        
        insertCols.push('dieu_hoa', 'may_giat', 'noi_that', 'ban_cong');
        selectCols.push(hasDieuHoa ? 'dieu_hoa' : '0');
        selectCols.push(hasMayGiat ? 'may_giat' : '0');
        selectCols.push(hasNoiThat ? 'noi_that' : '0');
        selectCols.push(hasBanCong ? 'ban_cong' : '0');

        await run(`INSERT INTO phong_new (${insertCols.join(', ')}) SELECT ${selectCols.join(', ')} FROM phong`);
        await run(`DROP TABLE phong`);
        await run(`ALTER TABLE phong_new RENAME TO phong`);
        await run(`CREATE INDEX IF NOT EXISTS idx_rooms_status ON phong(trang_thai)`);
      }
    },
    {
      version: '003_refactor_users_tenants',
      up: async () => {
        // Tạo bảng Tenant (hồ sơ thuê)
        await run(`
          CREATE TABLE IF NOT EXISTS tenant (
            id TEXT PRIMARY KEY,
            user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            cccd TEXT,
            ngay_sinh TEXT,
            dia_chi_thuong_tru TEXT,
            nguoi_lien_he TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Sửa đổi hop_dong_thue để link đến tenant_id thay vì khach_thue_id.
        // Tạm thời ta chỉ tạo bảng Tenancy mới và copy dữ liệu
        await run(`
          CREATE TABLE IF NOT EXISTS tenancy (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            room_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
            start_date TEXT NOT NULL,
            end_date TEXT,
            status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'TERMINATED')),
            tien_dat_coc REAL DEFAULT 0,
            ghi_chu TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Chúng ta sẽ di chuyển dữ liệu từ khach_thue sang tenant, từ hop_dong_thue sang tenancy trong tương lai
        // Đối với migration này, ta chỉ tạo schema để dùng song song.
        // Xoá bỏ tham chiếu trực tiếp đến 'khach_thue' trong users.
        const userCols = await all(`PRAGMA table_info(users)`);
        if (userCols.some(c => c.name === 'status') === false) {
          await run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE'`);
        }
      }
    },
    {
      version: '004_roommate_requests',
      up: async () => {
        const script = fs.readFileSync(join(__dirname, 'migrations', '004_roommate_requests.sql'), 'utf-8');
        const statements = script.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (let stmt of statements) {
          await run(stmt);
        }
      }
    }
  ];

  for (let m of migrations) {
    if (!appliedSet.has(m.version)) {
      console.log(`Đang áp dụng migration: ${m.version}...`);
      try {
        await run('BEGIN TRANSACTION');
        await m.up();
        await run(`INSERT INTO schema_migrations (version) VALUES (?)`, [m.version]);
        await run('COMMIT');
        console.log(`Đã áp dụng thành công: ${m.version}`);
      } catch (err) {
        await run('ROLLBACK');
        console.error(`Lỗi khi chạy migration ${m.version}:`, err);
        process.exit(1);
      }
    } else {
      console.log(`Bỏ qua migration (đã áp dụng): ${m.version}`);
    }
  }

  console.log('--- Hoàn tất Migrations ---');
  db.close();
}

runMigrations().catch(console.error);
