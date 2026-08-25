const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Deeksha@123',
    database: 'courtyard',
  });

  const items = [
    { id: 'gallery-1', url: '/img1.jpg', caption: 'Professional court lighting' },
    { id: 'gallery-2', url: '/im2.jpg', caption: 'Premium playing surface' },
    { id: 'gallery-3', url: '/img3.webp', caption: 'Ready for competitive play' },
    { id: 'gallery-4', url: '/img4.webp', caption: 'Weekend training sessions' },
    { id: 'gallery-5', url: '/img5.jpg', caption: 'High energy match nights' },
  ];

  await conn.execute('DELETE FROM gallery');

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    await conn.execute(
      'INSERT INTO gallery (id, url, caption, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(3), NOW(3))',
      [item.id, item.url, item.caption, i],
    );
  }

  const [rows] = await conn.query('SELECT id, url, caption, sort_order FROM gallery ORDER BY sort_order ASC');
  console.log(rows);

  await conn.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
