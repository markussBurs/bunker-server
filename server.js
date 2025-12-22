const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Раздача статических файлов (HTML, CSS, JS, изображения)
app.use(express.static(__dirname));

// Все GET-запросы, не ведущие к статике, отправляют index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Сервер игры "Бункер" запущен на порту ${PORT}`);
  console.log(`👉 Откройте: https://bunker-server-uzz6.onrender.com`);
});
