import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath);

// Helper for generating room ID based on index
function generateRoomId(index) {
  const prefixAscii = Math.floor(index / 10000);
  const number = (index % 10000) + 1;
  const prefix = String.fromCharCode(65 + prefixAscii); // 65 is 'A'
  return `${prefix}${String(number).padStart(5, '0')}`;
}

async function migrate() {
  console.log('Starting ID migration...');

  db.serialize(() => {
    db.run('PRAGMA foreign_keys = OFF;');
    db.run('BEGIN TRANSACTION;');

    // 1. Fetch current rooms and map to new IDs
    db.all('SELECT id FROM phong', (err, rooms) => {
      if (err) throw err;
      const roomMap = {}; // old_id -> new_id
      rooms.forEach((room, index) => {
        roomMap[room.id] = generateRoomId(index);
      });

      // Update phong
      for (const oldId in roomMap) {
        db.run('UPDATE phong SET id = ? WHERE id = ?', [roomMap[oldId], oldId]);
      }

      // Update hop_dong_thue (phong_id)
      for (const oldId in roomMap) {
        db.run('UPDATE hop_dong_thue SET phong_id = ? WHERE phong_id = ?', [roomMap[oldId], oldId]);
      }

      // Update chi_so_dien_nuoc (phong_id)
      for (const oldId in roomMap) {
        db.run('UPDATE chi_so_dien_nuoc SET phong_id = ? WHERE phong_id = ?', [roomMap[oldId], oldId]);
      }

      // Update hoa_don (phong_id)
      for (const oldId in roomMap) {
        db.run('UPDATE hoa_don SET phong_id = ? WHERE phong_id = ?', [roomMap[oldId], oldId]);
      }

      // Update yeu_cau_sua_chua (phong_id)
      for (const oldId in roomMap) {
        db.run('UPDATE yeu_cau_sua_chua SET phong_id = ? WHERE phong_id = ?', [roomMap[oldId], oldId]);
      }
      
      console.log('Finished mapping rooms. Count:', Object.keys(roomMap).length);

      // 2. Fetch current tenants and map to new IDs
      db.all('SELECT id FROM khach_thue', (err, tenants) => {
        if (err) throw err;
        const tenantMap = {}; // old_id -> new_id
        tenants.forEach((tenant, index) => {
          tenantMap[tenant.id] = String(index + 1); // "1", "2", "3"...
        });

        // Update khach_thue
        for (const oldId in tenantMap) {
          db.run('UPDATE khach_thue SET id = ? WHERE id = ?', [tenantMap[oldId], oldId]);
        }

        // Update hop_dong_thue (khach_thue_id)
        for (const oldId in tenantMap) {
          db.run('UPDATE hop_dong_thue SET khach_thue_id = ? WHERE khach_thue_id = ?', [tenantMap[oldId], oldId]);
        }

        // Update hoa_don (khach_thue_id)
        for (const oldId in tenantMap) {
          db.run('UPDATE hoa_don SET khach_thue_id = ? WHERE khach_thue_id = ?', [tenantMap[oldId], oldId]);
        }

        // Update yeu_cau_sua_chua (khach_thue_id)
        for (const oldId in tenantMap) {
          db.run('UPDATE yeu_cau_sua_chua SET khach_thue_id = ? WHERE khach_thue_id = ?', [tenantMap[oldId], oldId]);
        }

        // Update users (tenant_id)
        for (const oldId in tenantMap) {
          db.run('UPDATE users SET tenant_id = ? WHERE tenant_id = ?', [tenantMap[oldId], oldId]);
        }
        
        // Note: For users table, if user is TENANT, their ID should also probably match tenant_id for simplicity as requested earlier.
        // The prompt says "tài khoàn của mỗi khách hàng có id tương ương id thông tin cá nhân dễ quản lý ."
        // Let's update users.id where role = 'TENANT'.
        for (const oldId in tenantMap) {
           db.run('UPDATE users SET id = ? WHERE tenant_id = ? AND role = "TENANT"', [tenantMap[oldId], tenantMap[oldId]]);
        }
        
        console.log('Finished mapping tenants. Count:', Object.keys(tenantMap).length);

        db.run('COMMIT;', (err) => {
          if (err) throw err;
          db.run('PRAGMA foreign_keys = ON;', () => {
            console.log('Migration completed successfully.');
            db.close();
          });
        });
      });
    });
  });
}

migrate().catch(console.error);
