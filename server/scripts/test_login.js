const http = require('http');

const payload = JSON.stringify({
  email: 'deekshashetty81@gmail.com',
  password: 'Test@123',
  role: 'user',
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Request failed:', e.message);
});

req.write(payload);
req.end();
