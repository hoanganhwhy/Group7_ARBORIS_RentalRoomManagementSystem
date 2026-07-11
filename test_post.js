import http from 'http';

const postData = JSON.stringify({
  room_id: 'A00002',
  invoice_month: 7,
  invoice_year: 2023,
  room_rent: 1000,
  electricity_cost: 1000,
  water_cost: 1000,
  other_fees: 0,
  total_amount: 3000,
  status: 'pending',
  due_date: '2026-07-17',
  notes: ''
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/invoices',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
