const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('server/csdl_hostelmate.sqlite');
db.get("SELECT trang_thai FROM hoa_don WHERE ma_hoa_don = 'HM1783697274464B1F'", (err, row) => {
    console.log(row);
});
