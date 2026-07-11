const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./csdl_hostelmate.sqlite');

db.all('SELECT k.id as tenant_id, nt.ten_nha_tro as area FROM khach_thue k JOIN hop_dong_thue hd ON k.id = hd.khach_thue_id JOIN phong p ON hd.phong_id = p.id JOIN nha_tro nt ON p.nha_tro_id = nt.id WHERE hd.dang_hoat_dong = 1', [], (err, rows) => {
  if (err) console.error(err);
  console.log('Areas:', rows);
});
