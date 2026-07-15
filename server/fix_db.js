import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening db:', err);
    process.exit(1);
  }
});

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function fixDb() {
  try {
    await run('PRAGMA foreign_keys = OFF;');
    console.log('Foreign keys temporarily disabled for schema changes.');

    // 1. Fix room status
    // Any room that doesn't have an active contract (dang_hoat_dong=1) should be 'available'
    const resRooms = await run(`
      UPDATE phong 
      SET trang_thai = 'available' 
      WHERE id NOT IN (
        SELECT phong_id FROM hop_dong_thue WHERE dang_hoat_dong = 1
      ) AND trang_thai = 'occupied'
    `);
    console.log(`Updated ${resRooms.changes} rooms to 'available'.`);

    // 2. Fix KT00002 user creation
    // Check if KT00002 has a user
    const userRows = await query(`SELECT * FROM users WHERE tenant_id = 'KT00002'`);
    if (userRows.length === 0) {
      // Find KT00002 details
      const t2 = await query(`SELECT * FROM khach_thue WHERE id = 'KT00002'`);
      if (t2.length > 0) {
        const hashedPassword = await bcrypt.hash('123456', 10);
        await run(`
          INSERT INTO users (id, username, password_hash, role, tenant_id, full_name)
          VALUES (?, ?, ?, ?, ?, ?)
        `, ['U00002', 'khachthue2', hashedPassword, 'TENANT', 'KT00002', t2[0].ho_ten]);
        console.log('Created user for KT00002.');
      }
    }

    // 3. Fix redundant columns in hop_dong_thue
    // SQLite alter table drop column is supported from 3.35.0 (2021). 
    // We'll try it, if it fails we catch and ignore.
    try {
      await run(`UPDATE hop_dong_thue SET file_hop_dong = COALESCE(file_hop_dong, file_path)`);
      await run(`ALTER TABLE hop_dong_thue DROP COLUMN file_path`);
      console.log('Dropped file_path from hop_dong_thue.');
    } catch (e) {
      console.log('Could not drop file_path (maybe old SQLite or column missing):', e.message);
    }

    try {
      await run(`UPDATE hop_dong_thue SET chu_ky_khach = COALESCE(chu_ky_khach, chu_ky_nguoi_thue)`);
      await run(`ALTER TABLE hop_dong_thue DROP COLUMN chu_ky_nguoi_thue`);
      console.log('Dropped chu_ky_nguoi_thue from hop_dong_thue.');
    } catch (e) {
      console.log('Could not drop chu_ky_nguoi_thue (maybe old SQLite or column missing):', e.message);
    }

    // 4. Fix chat_messages
    // Check if group_type column exists
    try {
      await run(`ALTER TABLE chat_messages ADD COLUMN group_type TEXT`);
      console.log('Added group_type to chat_messages.');
    } catch(e) {
      // already exists
    }
    
    await run(`
      UPDATE chat_messages 
      SET group_type = receiver_id, receiver_id = NULL 
      WHERE receiver_id IN ('ADMIN', 'ALL', 'group')
    `);
    console.log('Fixed chat_messages receiver_id logic.');

    console.log('Database fixes completed.');
  } catch (error) {
    console.error('Error fixing db:', error);
  } finally {
    await run('PRAGMA foreign_keys = ON;');
    db.close();
  }
}

fixDb();
