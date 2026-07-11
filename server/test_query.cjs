const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./csdl_hostelmate.sqlite');

function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function run() {
  try {
    const t = await queryOne(`
      SELECT nt.ten_nha_tro as area 
      FROM khach_thue k 
      JOIN hop_dong_thue hd ON k.id = hd.khach_thue_id 
      JOIN phong p ON hd.phong_id = p.id 
      JOIN nha_tro nt ON p.nha_tro_id = nt.id
      WHERE k.id = ? AND hd.dang_hoat_dong = 1
    `, ['KT00001']);
    console.log("Result:", t);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
