const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Настройка CORS для GitHub Pages
const allowedOrigins = [
  'https://ваш-username.github.io',
  'http://localhost:5173',
  'http://localhost:3000'
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Игровые комнаты
const rooms = new Map();
const players = new Map();

// Данные карт
const cardsData = {
  professions: [
    'Ядерный физик', 'Врач-хирург', 'Инженер', 'Фермер', 'Повар',
    'Строитель', 'Программист', 'Психолог', 'Учитель', 'Солдат',
    'Электрик', 'Химик', 'Биолог', 'Механик', 'Пилот'
  ],
  healthStatuses: [
    'Идеальное здоровье', 'Астма', 'Диабет', 'Аллергия на пыльцу',
    'Отличный иммунитет', 'Гипертония', 'Проблемы со зрением',
    'Здоров как бык', 'Аллергия на антибиотики', 'Хроническая усталость'
  ],
  ages: ['18 лет', '25 лет', '32 года', '41 год', '53 года', '67 лет', '74 года'],
  hobbies: [
    'Садоводство', 'Игра на гитаре', 'Кулинария', 'Шахматы',
    'Астрономия', 'Фотография', 'Рыбалка', 'Чтение', 'Бег',
    'Коллекционирование', 'Рисование', 'Пение'
  ],
  phobias: [
    'Арахнофобия (пауки)', 'Клаустрофобия', 'Акрофобия (высота)',
    'Агорафобия', 'Никтофобия (темнота)', 'Гемофобия (кровь)',
    'Дентофобия (стоматологи)', 'Авиафобия (полеты)',
    'Мизофобия (грязь)', 'Трипанофобия (уколы)'
  ],
  baggage: [
    'Аптечка первой помощи', 'Набор инструментов', 'Запас воды на месяц',
    'Семена овощей', 'Портативный генератор', 'Книга по выживанию',
    'Радиостанция', 'Теплая одежда', 'Спички и растопка', 'Фонари'
  ],
  specials: [
    'Лидерские качества', 'Паникер', 'Оптимист', 'Хороший переговорщик',
    'Везунчик', 'Храпит', 'Веган', 'Аллергия на ложь', 'Хронический ворчун',
    'Отличная память', 'Стратегическое мышление', 'Медицинские знания'
  ]
};

// Генерация уникального ID
const generateId = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Генерация набора карт для игрока
const generatePlayerCards = () => {
  const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  return {
    profession: getRandom(cardsData.professions),
    health: getRandom(cardsData.healthStatuses),
    age: getRandom(cardsData.ages),
    hobby: getRandom(cardsData.hobbies),
    phobia: getRandom(cardsData.phobias),
    baggage: getRandom(cardsData.baggage),
    special: getRandom(cardsData.specials)
  };
};

// События Socket.io
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  socket.on('create-room', ({ playerName }) => {
    const roomId = generateId();
    const playerId = socket.id;
    
    const room = {
      id: roomId,
      players: [{
        id: playerId,
        name: playerName,
        isHost: true,
        cards: null,
        voted: false
      }],
      gameStarted: false,
      currentRound: 0,
      timer: 300,
      voting: false,
      revealedCards: {},
      hostId: playerId
    };
    
    rooms.set(roomId, room);
    players.set(playerId, { roomId, playerName });
    
    socket.join(roomId);
    socket.emit('room-created', roomId);
    io.to(roomId).emit('room-updated', room);
    
    console.log(`Комната создана: ${roomId}, Ведущий: ${playerName}`);
  });

  socket.on('join-room', ({ roomId, playerName }) => {
    const room = rooms.get(roomId.toUpperCase());
    
    if (!room) {
      socket.emit('error', 'Комната не найдена');
      return;
    }
    
    if (room.gameStarted) {
      socket.emit('error', 'Игра уже началась');
      return;
    }
    
    if (room.players.length >= 8) {
      socket.emit('error', 'Комната заполнена');
      return;
    }
    
    const playerId = socket.id;
    room.players.push({
      id: playerId,
      name: playerName,
      isHost: false,
      cards: null,
      voted: false
    });
    
    players.set(playerId, { roomId: room.id, playerName });
    socket.join(room.id);
    io.to(room.id).emit('room-updated', room);
    
    console.log(`${playerName} присоединился к комнате ${roomId}`);
  });

  socket.on('start-game', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(playerData.roomId);
    if (!room || room.hostId !== socket.id || room.players.length < 4) return;
    
    room.gameStarted = true;
    room.currentRound = 1;
    
    // Раздача карт
    room.players.forEach(player => {
      player.cards = generatePlayerCards();
      io.to(player.id).emit('cards-dealt', player.cards);
    });
    
    io.to(room.id).emit('game-started', room);
    io.to(room.id).emit('round-started', {
      round: 1,
      cardType: 'profession'
    });
    
    console.log(`Игра началась в комнате ${room.id}`);
  });

  socket.on('reveal-card', ({ cardType }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(playerData.roomId);
    if (!room || !room.gameStarted) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.cards) return;
    
    // Проверяем, что это текущий раунд для этой карты
    const cardTypes = ['profession', 'health', 'age', 'hobby', 'phobia', 'baggage', 'special'];
    const currentCardType = cardTypes[room.currentRound - 1];
    
    if (cardType !== currentCardType) return;
    
    if (!room.revealedCards[player.id]) {
      room.revealedCards[player.id] = {};
    }
    
    room.revealedCards[player.id][cardType] = player.cards[cardType];
    
    io.to(room.id).emit('card-revealed', {
      playerId: player.id,
      playerName: player.name,
      cardType,
      cardValue: player.cards[cardType]
    });
    
    // Проверяем, все ли открыли карту
    const allRevealed = room.players.every(p => 
      room.revealedCards[p.id]?.[cardType]
    );
    
    if (allRevealed && room.currentRound < 7) {
      setTimeout(() => {
        room.currentRound++;
        io.to(room.id).emit('round-started', {
          round: room.currentRound,
          cardType: cardTypes[room.currentRound - 1]
        });
        
        // После 3 раундов начинаем голосование
        if (room.currentRound === 4) {
          startVoting(room);
        }
      }, 3000);
    }
  });

  socket.on('submit-vote', ({ votedPlayerId }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(playerData.roomId);
    if (!room || !room.voting) return;
    
    const voter = room.players.find(p => p.id === socket.id);
    if (!voter || voter.voted) return;
    
    voter.voted = true;
    voter.votedFor = votedPlayerId;
    
    // Проверяем, все ли проголосовали
    const allVoted = room.players.every(p => p.voted || p.id === votedPlayerId);
    
    if (allVoted) {
      endVoting(room);
    }
  });

  socket.on('disconnect', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(playerData.roomId);
    if (!room) return;
    
    // Удаляем игрока из комнаты
    room.players = room.players.filter(p => p.id !== socket.id);
    players.delete(socket.id);
    
    // Если комната пустая, удаляем её
    if (room.players.length === 0) {
      rooms.delete(room.id);
      console.log(`Комната ${room.id} удалена`);
    } else {
      // Если вышел ведущий, назначаем нового
      if (room.hostId === socket.id && room.players.length > 0) {
        room.hostId = room.players[0].id;
        room.players[0].isHost = true;
      }
      
      io.to(room.id).emit('room-updated', room);
      console.log(`${playerData.playerName} вышел из комнаты ${room.id}`);
    }
  });

  // Вспомогательные функции
  function startVoting(room) {
    room.voting = true;
    room.players.forEach(p => {
      p.voted = false;
      p.votedFor = null;
    });
    
    io.to(room.id).emit('vote-started', {
      duration: 60, // 60 секунд на голосование
      players: room.players.map(p => ({ id: p.id, name: p.name }))
    });
    
    // Автозавершение голосования через 60 секунд
    setTimeout(() => {
      if (room.voting) {
        endVoting(room);
      }
    }, 60000);
  }

  function endVoting(room) {
    room.voting = false;
    
    // Подсчет голосов
    const voteCounts = {};
    room.players.forEach(player => {
      if (player.votedFor) {
        voteCounts[player.votedFor] = (voteCounts[player.votedFor] || 0) + 1;
      }
    });
    
    // Находим игрока с максимальным количеством голосов
    let maxVotes = 0;
    let eliminatedPlayerId = null;
    
    Object.entries(voteCounts).forEach(([playerId, votes]) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        eliminatedPlayerId = playerId;
      }
    });
    
    const eliminatedPlayer = room.players.find(p => p.id === eliminatedPlayerId);
    
    // Удаляем исключенного игрока
    if (eliminatedPlayer) {
      room.players = room.players.filter(p => p.id !== eliminatedPlayerId);
      players.delete(eliminatedPlayerId);
      
      const eliminatedSocket = io.sockets.sockets.get(eliminatedPlayerId);
      if (eliminatedSocket) {
        eliminatedSocket.leave(room.id);
        eliminatedSocket.emit('eliminated', {
          reason: 'Исключен голосованием',
          votes: maxVotes
        });
      }
    }
    
    const results = {
      eliminated: eliminatedPlayer ? {
        id: eliminatedPlayer.id,
        name: eliminatedPlayer.name,
        votes: maxVotes
      } : null,
      voteCounts,
      remainingPlayers: room.players.length
    };
    
    io.to(room.id).emit('vote-ended', results);
    
    // Проверка конца игры
    if (room.players.length <= 3 || room.currentRound >= 7) {
      endGame(room);
    } else {
      // Продолжаем следующий раунд
      setTimeout(() => {
        room.currentRound++;
        const cardTypes = ['profession', 'health', 'age', 'hobby', 'phobia', 'baggage', 'special'];
        io.to(room.id).emit('round-started', {
          round: room.currentRound,
          cardType: cardTypes[room.currentRound - 1]
        });
      }, 5000);
    }
  }

  function endGame(room) {
    const winners = room.players;
    io.to(room.id).emit('game-ended', {
      winners,
      totalRounds: room.currentRound
    });
    
    // Очистка комнаты через 30 секунд
    setTimeout(() => {
      room.players.forEach(p => {
        players.delete(p.id);
      });
      rooms.delete(room.id);
    }, 30000);
  }
});

// REST API эндпоинты
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    rooms: rooms.size,
    players: players.size 
  });
});

app.post('/api/room/create', (req, res) => {
  const { playerName } = req.body;
  const roomId = generateId();
  
  res.json({ roomId });
});

app.post('/api/room/join', (req, res) => {
  const { roomId, playerName } = req.body;
  const room = rooms.get(roomId.toUpperCase());
  
  if (!room) {
    return res.status(404).json({ error: 'Комната не найдена' });
  }
  
  if (room.gameStarted) {
    return res.status(400).json({ error: 'Игра уже началась' });
  }
  
  if (room.players.length >= 8) {
    return res.status(400).json({ error: 'Комната заполнена' });
  }
  
  res.json({ success: true, roomId: room.id });
});

server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`📡 Socket.io готов к подключениям`);
});
