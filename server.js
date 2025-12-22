const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ВАЖНО: Укажите ваш фронтенд URL
const FRONTEND_URL = 'https://ваш-github-username.github.io';

const io = new Server(server, {
  cors: {
    origin: [
      FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Базовый endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Бункер - Backend Server',
    socket: 'WebSocket доступен по /socket.io/',
    status: 'active'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    rooms: 0,
    players: 0,
    socket: 'WebSocket ready'
  });
});

// Socket.io события
io.on('connection', (socket) => {
  console.log('✅ Новый игрок подключился:', socket.id);
  
  // Тестовое событие
  socket.emit('welcome', { 
    message: 'Добро пожаловать в Бункер!',
    playerId: socket.id 
  });
  
  // Обработчик создания комнаты
  socket.on('create-room', (data) => {
    console.log('Создание комнаты:', data);
    const roomId = 'TEST' + Math.random().toString(36).substr(2, 5).toUpperCase();
    socket.emit('room-created', { roomId });
  });
  
  // Обработчик присоединения
  socket.on('join-room', (data) => {
    console.log('Присоединение к комнате:', data);
    socket.emit('room-joined', { success: true, roomId: data.roomId });
  });
  
  // Отключение
  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
  });
});

// Запуск сервера
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен: https://bunker-backend-wgu1.onrender.com`);
  console.log(`📡 Socket.io готов на порту: ${PORT}`);
  console.log(`🌐 CORS разрешен для: ${FRONTEND_URL}`);
});
