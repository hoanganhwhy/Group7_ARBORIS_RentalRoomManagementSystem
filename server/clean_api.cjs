const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
const unused = [
  "app.get\\('/api/meter_readings/room/:roomId'",
  "app.get\\('/api/roommates'",
  "app.get\\('/api/roommates/my-requests'",
  "app.put\\('/api/roommates/:id/close'",
  "app.patch\\('/api/admin/invoices/:id/confirm-payment'",
  "app.get\\('/api/settings'",
  "app.put\\('/api/settings'"
];
unused.forEach(p => {
  const regex = new RegExp(p + '(?:[\\s\\S]*?^\\})\\);', 'm');
  code = code.replace(regex, '');
});
code = code.replace(/\n\s*\n\s*\n/g, '\n\n');
fs.writeFileSync('server.js', code);
