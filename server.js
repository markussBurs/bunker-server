const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

// Настройка CORS для Socket.io
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Простой тестовый endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Простое хранилище
const rooms = new Map();
const players = new Map();

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function generateRoomCode() {
  return 'BUNK' + Math.floor(1000 + Math.random() * 9000);
}

// Данные для игры
const gameData = {
  professions: ["Врач", "Инженер", "Ученый", "Солдат"],
  healthConditions: ["Здоров", "Легкое заболевание"],
  biology: ["Мужчина, 25 лет", "Женщина, 30 лет"],
  hobbies: ["Садоводство", "Кулинария"],
  luggage: ["Аптечка", "Консервы"],
  phobias: ["Арахнофобия", "Клаустрофобия"],
  characters: ["Добрый", "Агрессивный"],
  additionalInfo: ["Имеет военную подготовку", "Знает медицину"]
};

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generatePlayer(username, isHost = false) {
  return {
    id: generateId(),
    username,
    socketId: null,
    roomCode: null,
    profession: getRandomItem(gameData.professions),
    health: getRandomItem(gameData.healthConditions),
    biology: getRandomItem(gameData.biology),
    hobby: getRandomItem(gameData.hobbies),
    luggage: getRandomItem(gameData.luggage),
    phobia: getRandomItem(gameData.phobias),
    character: getRandomItem(gameData.characters),
    additionalInfo: getRandomItem(gameData.additionalInfo),
    ready: false,
    isHost,
    revealed: {
      profession: false,
      health: false,
      biology: false,
      hobby: false,
      luggage: false,
      phobia: false,
      character: false,
      additionalInfo: false
    }
  };
}

// Socket.io события
io.on('connection', (socket) => {
  console.log('✅ Новое подключение:', socket.id);

  socket.emit('connected', { message: 'Подключено к серверу', socketId: socket.id });

  socket.on('create_room', (username) => {
    console.log('🎮 Создание комнаты пользователем:', username);
    
    try {
      const roomCode = generateRoomCode();
      const player = generatePlayer(username, true);
      player.socketId = socket.id;
      player.roomCode = roomCode;
      
      const room = {
        code: roomCode,
        players: [player],
        host: player.id,
        gameStarted: false,
        currentRound: 1
      };
      
      rooms.set(roomCode, room);
      players.set(socket.id, player);
      socket.join(roomCode);
      
      socket.emit('room_created', {
        roomCode,
        playerId: player.id
      });

      io.to(roomCode).emit('players_update', room.players);
      console.log(`✅ Комната создана: ${roomCode}`);
      
    } catch (error) {
      console.error('❌ Ошибка создания комнаты:', error);
      socket.emit('error', { message: 'Ошибка создания комнаты' });
    }
  });

  socket.on('join_room', (data) => {
    const { roomCode, username } = data;
    console.log('🎮 Присоединение к комнате:', roomCode, 'пользователь:', username);
    
    try {
      const room = rooms.get(roomCode);
      
      if (!room) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }
      
      if (room.gameStarted) {
        socket.emit('error', { message: 'Игра уже началась' });
        return;
      }
      
      const player = generatePlayer(username, false);
      player.socketId = socket.id;
      player.roomCode = roomCode;
      
      room.players.push(player);
      players.set(socket.id, player);
      socket.join(roomCode);
      
      io.to(roomCode).emit('player_joined', {
        username: player.username
      });

      io.to(roomCode).emit('players_update', room.players);
      
      socket.emit('room_joined', {
        roomCode: roomCode,
        playerId: player.id
      });
      
      console.log(`✅ Игрок ${username} присоединился к комнате ${roomCode}`);
      
    } catch (error) {
      console.error('❌ Ошибка присоединения:', error);
      socket.emit('error', { message: 'Ошибка присоединения к комнате' });
    }
  });

  socket.on('toggle_ready', () => {
    const player = players.get(socket.id);
    if (!player) return;
    
    const room = rooms.get(player.roomCode);
    if (!room) return;
    
    player.ready = !player.ready;
    io.to(room.code).emit('players_update', room.players);
  });

  socket.on('disconnect', () => {
    console.log('❌ Отключение:', socket.id);
    
    const player = players.get(socket.id);
    if (!player) return;
    
    const room = rooms.get(player.roomCode);
    if (!room) return;
    
    room.players = room.players.filter(p => p.id !== player.id);
    players.delete(socket.id);
    
    if (room.players.length === 0) {
      rooms.delete(room.code);
    } else {
      if (room.host === player.id) {
        room.host = room.players[0].id;
        room.players[0].isHost = true;
      }
      
      io.to(room.code).emit('player_left', {
        username: player.username
      });

      io.to(room.code).emit('players_update', room.players);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
