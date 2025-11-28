const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Хранилище данных в памяти
const rooms = new Map();
const players = new Map();

// Генерация ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function generateRoomCode() {
    return 'BUNK' + Math.floor(1000 + Math.random() * 9000);
}

// Данные для генерации характеристик
const gameData = {
    professions: ["Врач", "Инженер", "Ученый", "Солдат", "Фермер", "Повар", "Учитель", "Строитель"],
    healthConditions: ["Здоров", "Легкое заболевание", "Хроническое заболевание", "Инвалидность"],
    biology: ["Мужчина, 25 лет", "Женщина, 30 лет", "Мужчина, 45 лет", "Женщина, 22 года"],
    hobbies: ["Садоводство", "Кулинария", "Ремонт техники", "Чтение", "Спорт"],
    luggage: ["Аптечка", "Консервы", "Вода", "Инструменты", "Книги", "Оружие"],
    phobias: ["Арахнофобия", "Клаустрофобия", "Агорафобия", "Акрофобия"],
    characters: ["Добрый", "Агрессивный", "Эгоистичный", "Альтруист", "Лидер"],
    additionalInfo: ["Имеет военную подготовку", "Знает основы медицины", "Умеет выращивать растения", "Разбирается в технике"]
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
        },
        vote: null
    };
}

// Socket.IO соединения
io.on('connection', (socket) => {
    console.log('Новый игрок:', socket.id);

    socket.on('create_room', (username) => {
        const roomCode = generateRoomCode();
        
        const player = generatePlayer(username, true);
        player.socketId = socket.id;
        player.roomCode = roomCode;
        
        const room = {
            code: roomCode,
            players: [player],
            host: player.id,
            gameStarted: false,
            currentSituation: 0,
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
        
        console.log(`Room created: ${roomCode} by ${username}`);
    });

    socket.on('join_room', (data) => {
        const { roomCode, username } = data;
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
        
        console.log(`Player ${username} joined room ${roomCode}`);
    });

    socket.on('toggle_ready', () => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomCode);
        if (!room) return;
        
        player.ready = !player.ready;
        
        io.to(room.code).emit('players_update', room.players);
    });

    socket.on('reveal_attribute', (data) => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomCode);
        if (!room) return;
        
        // Проверяем, можно ли раскрывать эту характеристику в текущем круге
        const roundAttributes = getRoundAttributes(room.currentRound);
        if (!roundAttributes.includes(data.attribute)) {
            socket.emit('error', { message: 'Эту характеристику нельзя раскрыть в текущем круге' });
            return;
        }
        
        player.revealed[data.attribute] = true;
        
        io.to(room.code).emit('attribute_revealed', {
            playerId: player.id,
            attribute: data.attribute
        });

        io.to(room.code).emit('players_update', room.players);
    });

    socket.on('start_game', () => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomCode);
        if (!room || room.host !== player.id) return;
        
        const allReady = room.players.every(p => p.ready);
        const minPlayers = room.players.length >= 3;
        
        if (!allReady || !minPlayers) {
            socket.emit('error', { message: 'Не все игроки готовы или недостаточно игроков (минимум 3)' });
            return;
        }
        
        room.gameStarted = true;
        room.currentRound = 1;
        
        io.to(room.code).emit('game_started');
        console.log(`Game started in room ${room.code}`);
    });

    socket.on('next_round', () => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomCode);
        if (!room || room.host !== player.id || !room.gameStarted) return;
        
        // Проверяем, не превышен ли лимит кругов
        if (room.currentRound >= 5) {
            socket.emit('error', { message: 'Достигнут максимальный номер круга' });
            return;
        }
        
        room.currentRound++;
        
        console.log(`Round ${room.currentRound} started in room ${room.code}`);
        
        io.to(room.code).emit('next_round', {
            round: room.currentRound
        });
    });

    socket.on('chat_message', (data) => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomCode);
        if (!room) return;
        
        io.to(room.code).emit('chat_message', {
            username: player.username,
            message: data.message,
            context: data.context
        });
    });

    socket.on('cast_vote', (data) => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomCode);
        if (!room) return;
        
        player.vote = data.targetPlayerId;
        
        io.to(room.code).emit('player_voted', {
            playerId: player.id,
            targetPlayerId: data.targetPlayerId
        });

        // Проверяем, все ли проголосовали
        checkVotingCompletion(room);
    });

    socket.on('leave_room', () => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomCode);
        if (!room) return;
        
        room.players = room.players.filter(p => p.id !== player.id);
        players.delete(socket.id);
        
        if (room.players.length === 0) {
            rooms.delete(room.code);
            console.log(`Room ${room.code} deleted (no players left)`);
        } else {
            if (room.host === player.id) {
                room.host = room.players[0].id;
                room.players[0].isHost = true;
            }
            
            io.to(room.code).emit('player_left', {
                username: player.username
            });

            io.to(room.code).emit('players_update', room.players);
            console.log(`Player ${player.username} left room ${room.code}`);
        }
        
        socket.leave(room.code);
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(player.roomCode);
        if (!room) return;
        
        room.players = room.players.filter(p => p.id !== player.id);
        players.delete(socket.id);
        
        if (room.players.length === 0) {
            rooms.delete(room.code);
            console.log(`Room ${room.code} deleted (no players left)`);
        } else {
            if (room.host === player.id) {
                room.host = room.players[0].id;
                room.players[0].isHost = true;
            }
            
            io.to(room.code).emit('player_left', {
                username: player.username
            });

            io.to(room.code).emit('players_update', room.players);
            console.log(`Player ${player.username} disconnected from room ${room.code}`);
        }
    });
});

// Вспомогательные функции
function getRoundAttributes(round) {
    const roundAttributes = {
        1: ['profession'],
        2: ['health', 'biology'],
        3: ['hobby', 'luggage'],
        4: ['phobia', 'character'],
        5: ['additionalInfo']
    };
    return roundAttributes[round] || [];
}

function checkVotingCompletion(room) {
    const allVoted = room.players.every(player => player.vote !== null);
    if (allVoted) {
        // Подсчитываем голоса
        const voteCount = {};
        room.players.forEach(player => {
            if (player.vote) {
                voteCount[player.vote] = (voteCount[player.vote] || 0) + 1;
            }
        });
        
        // Находим игрока с наибольшим количеством голосов
        let maxVotes = 0;
        let eliminatedPlayerId = null;
        
        Object.entries(voteCount).forEach(([playerId, votes]) => {
            if (votes > maxVotes) {
                maxVotes = votes;
                eliminatedPlayerId = playerId;
            }
        });
        
        if (eliminatedPlayerId) {
            const eliminatedPlayer = room.players.find(p => p.id === eliminatedPlayerId);
            io.to(room.code).emit('player_eliminated', {
                playerId: eliminatedPlayerId,
                username: eliminatedPlayer.username,
                voteCount: maxVotes
            });
            
            // Удаляем игрока из комнаты
            room.players = room.players.filter(p => p.id !== eliminatedPlayerId);
            
            // Сбрасываем голоса для следующего раунда
            room.players.forEach(player => {
                player.vote = null;
            });
            
            io.to(room.code).emit('players_update', room.players);
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
