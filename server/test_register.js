fetch('http://localhost:5000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'testguest2',
    password: 'Password@123',
    email: 'test2@test.com',
    phone: '0912345678',
    full_name: 'Test Guest'
  })
}).then(res => res.json().then(data => ({status: res.status, data})))
  .then(console.log)
  .catch(console.error);
