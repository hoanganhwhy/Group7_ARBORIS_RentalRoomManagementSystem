import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'csdl_hostelmate.sqlite');

const db = new sqlite3.Database(dbPath);

function generatePrefixedId(prefix, index) {
  return `${prefix}${String(index + 1).padStart(5, '0')}`;
}

async function migrate() {
  console.log('Starting prefixed IDs migration...');

  db.serialize(() => {
    db.run('PRAGMA foreign_keys = OFF;');
    db.run('BEGIN TRANSACTION;');

    // 1. khach_thue -> KT00001
    db.all('SELECT id FROM khach_thue ORDER BY ROWID', (err, rows) => {
      if (err) throw err;
      const map = {};
      rows.forEach((row, index) => {
        map[row.id] = generatePrefixedId('KT', index);
      });

      for (const oldId in map) {
        db.run('UPDATE khach_thue SET id = ? WHERE id = ?', [map[oldId], oldId]);
        db.run('UPDATE hop_dong_thue SET khach_thue_id = ? WHERE khach_thue_id = ?', [map[oldId], oldId]);
        db.run('UPDATE hoa_don SET khach_thue_id = ? WHERE khach_thue_id = ?', [map[oldId], oldId]);
        db.run('UPDATE yeu_cau_sua_chua SET khach_thue_id = ? WHERE khach_thue_id = ?', [map[oldId], oldId]);
        db.run('UPDATE users SET tenant_id = ? WHERE tenant_id = ?', [map[oldId], oldId]);
        db.run('UPDATE users SET id = ? WHERE id = ? AND role = "TENANT"', [map[oldId], oldId]);
      }
      console.log('Finished khach_thue. Count:', Object.keys(map).length);

      // 2. hop_dong_thue -> HDT00001
      db.all('SELECT id FROM hop_dong_thue ORDER BY ROWID', (err, rows) => {
        if (err) throw err;
        const map2 = {};
        rows.forEach((row, index) => {
          map2[row.id] = generatePrefixedId('HDT', index);
        });

        for (const oldId in map2) {
          db.run('UPDATE hop_dong_thue SET id = ? WHERE id = ?', [map2[oldId], oldId]);
        }
        console.log('Finished hop_dong_thue. Count:', Object.keys(map2).length);

        // 3. chi_so_dien_nuoc -> DN00001
        db.all('SELECT id FROM chi_so_dien_nuoc ORDER BY ROWID', (err, rows) => {
          if (err) throw err;
          const map3 = {};
          rows.forEach((row, index) => {
            map3[row.id] = generatePrefixedId('DN', index);
          });

          for (const oldId in map3) {
            db.run('UPDATE chi_so_dien_nuoc SET id = ? WHERE id = ?', [map3[oldId], oldId]);
            db.run('UPDATE hoa_don SET chi_so_dien_nuoc_id = ? WHERE chi_so_dien_nuoc_id = ?', [map3[oldId], oldId]);
          }
          console.log('Finished chi_so_dien_nuoc. Count:', Object.keys(map3).length);

          // 4. hoa_don -> HD00001
          db.all('SELECT id FROM hoa_don ORDER BY ROWID', (err, rows) => {
            if (err) throw err;
            const map4 = {};
            rows.forEach((row, index) => {
              map4[row.id] = generatePrefixedId('HD', index);
            });

            for (const oldId in map4) {
              db.run('UPDATE hoa_don SET id = ? WHERE id = ?', [map4[oldId], oldId]);
            }
            console.log('Finished hoa_don. Count:', Object.keys(map4).length);

            // 5. yeu_cau_sua_chua -> SC00001
            db.all('SELECT id FROM yeu_cau_sua_chua ORDER BY ROWID', (err, rows) => {
              if (err) throw err;
              const map5 = {};
              rows.forEach((row, index) => {
                map5[row.id] = generatePrefixedId('SC', index);
              });

              for (const oldId in map5) {
                db.run('UPDATE yeu_cau_sua_chua SET id = ? WHERE id = ?', [map5[oldId], oldId]);
              }
              console.log('Finished yeu_cau_sua_chua. Count:', Object.keys(map5).length);

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
      });
    });
  });
}

migrate().catch(console.error);
