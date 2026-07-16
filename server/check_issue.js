import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, tenant_id FROM users", (err, users) => {
    console.log("Users:", users);
});
db.all("SELECT * FROM khach_thue WHERE id IN ('KT00010', 'KT00011')", (err, kt) => {
    console.log("Khach Thue:", kt);
});
db.all("SELECT * FROM hop_dong_thue WHERE khach_thue_id IN ('KT00010', 'KT00011')", (err, hd) => {
    console.log("Hop dong thue:", hd);
});
db.all("SELECT * FROM hoa_don", (err, hd) => {
    console.log("Hoa don:", hd);
});
