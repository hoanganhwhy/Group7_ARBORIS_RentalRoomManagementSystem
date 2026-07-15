const fs = require('fs');

let code = fs.readFileSync('server/server.js', 'utf8');

// 1. Update mapTenant
code = code.replace(
  /notes:\s*t\.ghi_chu,/,
  "notes: t.ghi_chu,\n      username: t.username,"
);

// 2. Update getTenants list query
code = code.replace(
  /whereClause = 'WHERE ho_ten LIKE \? OR so_dien_thoai LIKE \? OR so_cccd LIKE \?';/,
  "whereClause = 'WHERE khach_thue.ho_ten LIKE ? OR khach_thue.so_dien_thoai LIKE ? OR khach_thue.so_cccd LIKE ?';"
);

code = code.replace(
  /const safeSortField = allowedSortFields\.includes\(sortField\) \? sortField : 'ho_ten';/,
  "const safeSortField = allowedSortFields.includes(sortField) ? `khach_thue.${sortField}` : 'khach_thue.ho_ten';"
);

code = code.replace(
  /const countResult = await queryOne\(`SELECT COUNT\(\*\) as total FROM khach_thue \$\{whereClause\}`,\s*params\);/,
  "const countResult = await queryOne(`SELECT COUNT(*) as total FROM khach_thue ${whereClause}`, params);"
);

code = code.replace(
  /const tenants = await query\(`SELECT \* FROM khach_thue \$\{whereClause\} ORDER BY \$\{safeSortField\} \$\{order\} LIMIT \? \nOFFSET \?`,\s*\[\.\.\.params, limit, offset\]\);/g,
  `const tenants = await query(\`SELECT khach_thue.*, users.username FROM khach_thue LEFT JOIN users ON khach_thue.id = users.tenant_id \${whereClause} ORDER BY \${safeSortField} \${order} LIMIT ? OFFSET ?\`, [...params, limit, offset]);`
);
// Also for the un-wrapped case (no newline)
code = code.replace(
  /const tenants = await query\(`SELECT \* FROM khach_thue \$\{whereClause\} ORDER BY \$\{safeSortField\} \$\{order\} LIMIT \? OFFSET \?`,\s*\[\.\.\.params, limit, offset\]\);/g,
  `const tenants = await query(\`SELECT khach_thue.*, users.username FROM khach_thue LEFT JOIN users ON khach_thue.id = users.tenant_id \${whereClause} ORDER BY \${safeSortField} \${order} LIMIT ? OFFSET ?\`, [...params, limit, offset]);`
);

// 3. Update getTenant by id query
code = code.replace(
  /const tenant = await queryOne\('SELECT \* FROM khach_thue WHERE id = \?',\s*\[req\.params\.id\]\);/g,
  "const tenant = await queryOne('SELECT khach_thue.*, users.username FROM khach_thue LEFT JOIN users ON khach_thue.id = users.tenant_id WHERE khach_thue.id = ?', [req.params.id]);"
);

fs.writeFileSync('server/server.js', code);
console.log("Patched server.js for tenant username");
