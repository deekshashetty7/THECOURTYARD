const fetch = require('node-fetch');

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'deekshashetty81@gmail.com',
        password: 'Test@123',
        role: 'user',
      }),
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log('Body:', text);
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
