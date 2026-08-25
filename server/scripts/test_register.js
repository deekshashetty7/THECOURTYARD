const http = require('http');

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const email = `temp-${Date.now()}@example.com`;
  const body = {
    name: 'Temp User',
    email,
    phone: '+911234567890',
    password: 'TempPass123!',
  };

  try {
    const result = await postJson('http://127.0.0.1:3000/api/auth/register', body);
    console.log('Status:', result.status);
    console.log('Body:', result.body);
  } catch (error) {
    console.error('Register test failed:', error);
    process.exitCode = 1;
  }
})();
