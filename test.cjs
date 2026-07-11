const http = require('http');

const data = JSON.stringify({
  room_id: 'A00001',
  invoice_month: 7,
  invoice_year: 2026,
  room_rent: 2000,
  total_amount: 2000,
  status: 'pending'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/invoices',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
