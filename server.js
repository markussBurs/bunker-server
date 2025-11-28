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
            
            console.log(`✅ Room created: ${roomCode} by ${username}, players:`, room.players.map(p => p.username));
        } catch (error) {
            console.error('Error creating room:', error);
            socket.emit('error', { message: 'Ошибка создания комнаты' });
        }
    });

    socket.on('join_room', (data) => {
        try {
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
            
            // Проверяем, нет ли уже игрока с таким именем
            const existingPlayer = room.players.find(p => p.username === username);
            if (existingPlayer) {
                socket.emit('error', { message: 'Игрок с таким именем уже есть в комнате' });
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
            
            console.log(`✅ Player ${username} joined room ${roomCode}, total players:`, room.players.length);
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Ошибка присоединения к комнате' });
        }
    });

    socket.on('toggle_ready', () => {
        try {
            const player = players.get(socket.id);
            if (!player) {
                socket.emit('error', { message: 'Игрок не найден' });
                return;
            }
            
            const room = rooms.get(player.roomCode);
            if (!room) {
                socket.emit('error', { message: 'Комната не найдена' });
                return;
            }
            
            player.ready = !player.ready;
            
            console.log(`🔄 Player ${player.username} ready: ${player.ready}`);
            
            io.to(room.code).emit('players_update', room.players);
        } catch (error) {
            console.error('Error toggling ready:', error);
            socket.emit('error', { message: 'Ошибка изменения статуса готовности' });
        }
    });

    socket.on('reveal_attribute', (data) => {
        try {
            const player = players.get(socket.id);
            if (!player) return;
            
            const room = rooms.get(player.roomCode);
            if (!room) return;
            
            player.revealed[data.attribute] = true;
            
            io.to(room.code).emit('attribute_revealed', {
                playerId: player.id,
                attribute: data.attribute
            });

            io.to(room.code).emit('players_update', room.players);
        } catch (error) {
            console.error('Error revealing attribute:', error);
            socket.emit('error', { message: 'Ошибка раскрытия характеристики' });
        }
    });

    socket.on('start_game', () => {
        try {
            console.log('🚀 Received start_game request from socket:', socket.id);
            
            const player = players.get(socket.id);
            if (!player) {
                console.log('❌ Player not found for socket:', socket.id);
                socket.emit('error', { message: 'Игрок не найден' });
                return;
            }
            
            const room = rooms.get(player.roomCode);
            if (!room) {
                console.log('❌ Room not found for player:', player.username);
                socket.emit('error', { message: 'Комната не найдена' });
                return;
            }
            
            console.log('🔍 Checking permissions:', {
                playerId: player.id,
                hostId: room.host,
                isHost: player.id === room.host,
                playerUsername: player.username
            });
            
            // Проверяем, является ли игрок хостом
            if (room.host !== player.id) {
                console.log('❌ Player is not host:', player.username);
                socket.emit('error', { message: 'Только создатель комнаты может начать игру' });
                return;
            }
            
            // Проверяем, все ли игроки готовы
            const allReady = room.players.every(p => p.ready);
            const minPlayers = room.players.length >= 3;
            
            console.log('📊 Game start conditions:', {
                allReady,
                minPlayers,
                playersCount: room.players.length,
                players: room.players.map(p => ({ username: p.username, ready: p.ready }))
            });
            
            if (!allReady) {
                const notReadyPlayers = room.players.filter(p => !p.ready).map(p => p.username);
                socket.emit('error', { message: `Не все игроки готовы: ${notReadyPlayers.join(', ')}` });
                return;
            }
            
            if (!minPlayers) {
                socket.emit('error', { message: 'Недостаточно игроков для начала игры (минимум 3)' });
                return;
            }
            
            // Запускаем игру
            room.gameStarted = true;
            room.currentRound = 1;
            
            console.log(`🎮 Game started in room ${room.code} with ${room.players.length} players`);
            
            io.to(room.code).emit('game_started');
        } catch (error) {
            console.error('❌ Error starting game:', error);
            socket.emit('error', { message: 'Ошибка запуска игры' });
        }
    });

    socket.on('next_round', () => {
        try {
            const player = players.get(socket.id);
            if (!player) return;
            
            const room = rooms.get(player.roomCode);
            if (!room || !room.gameStarted) return;
            
            // Проверяем, является ли игрок хостом
            if (room.host !== player.id) {
                socket.emit('error', { message: 'Только создатель комнаты может переходить к следующему кругу' });
                return;
            }
            
            room.currentRound++;
            
            console.log(`🔄 Round ${room.currentRound} started in room ${room.code}`);
            
            io.to(room.code).emit('next_round', {
                round: room.currentRound
            });
        } catch (error) {
            console.error('Error starting next round:', error);
            socket.emit('error', { message: 'Ошибка перехода к следующему кругу' });
        }
    });

    socket.on('chat_message', (data) => {
        try {
            const player = players.get(socket.id);
            if (!player) return;
            
            const room = rooms.get(player.roomCode);
            if (!room) return;
            
            io.to(room.code).emit('chat_message', {
                username: player.username,
                message: data.message,
                context: data.context
            });
        } catch (error) {
            console.error('Error sending chat message:', error);
        }
    });

    socket.on('cast_vote', (data) => {
        try {
            const player = players.get(socket.id);
            if (!player) return;
            
            const room = rooms.get(player.roomCode);
            if (!room) return;
            
            player.vote = data.targetPlayerId;
            
            io.to(room.code).emit('player_voted', {
                playerId: player.id,
                targetPlayerId: data.targetPlayerId
            });
        } catch (error) {
            console.error('Error casting vote:', error);
            socket.emit('error', { message: 'Ошибка голосования' });
        }
    });

    socket.on('leave_room', () => {
        try {
            const player = players.get(socket.id);
            if (!player) return;
            
            const room = rooms.get(player.roomCode);
            if (!room) return;
            
            const playerUsername = player.username;
            
            room.players = room.players.filter(p => p.id !== player.id);
            players.delete(socket.id);
            
            if (room.players.length === 0) {
                rooms.delete(room.code);
                console.log(`🗑️ Room ${room.code} deleted (no players left)`);
            } else {
                if (room.host === player.id) {
                    room.host = room.players[0].id;
                    room.players[0].isHost = true;
                    console.log(`👑 New host assigned: ${room.players[0].username}`);
                }
                
                io.to(room.code).emit('player_left', {
                    username: playerUsername
                });

                io.to(room.code).emit('players_update', room.players);
                console.log(`👋 Player ${playerUsername} left room ${room.code}, remaining: ${room.players.length}`);
            }
            
            socket.leave(room.code);
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    });

    socket.on('disconnect', () => {
        try {
            console.log('🔌 Player disconnected:', socket.id);
            
            const player = players.get(socket.id);
            if (!player) return;
            
            const room = rooms.get(player.roomCode);
            if (!room) return;
            
            const playerUsername = player.username;
            
            room.players = room.players.filter(p => p.id !== player.id);
            players.delete(socket.id);
            
            if (room.players.length === 0) {
                rooms.delete(room.code);
                console.log(`🗑️ Room ${room.code} deleted (no players left after disconnect)`);
            } else {
                if (room.host === player.id) {
                    room.host = room.players[0].id;
                    room.players[0].isHost = true;
                    console.log(`👑 New host assigned after disconnect: ${room.players[0].username}`);
                }
                
                io.to(room.code).emit('player_left', {
                    username: playerUsername
                });

                io.to(room.code).emit('players_update', room.players);
                console.log(`👋 Player ${playerUsername} disconnected from room ${room.code}, remaining: ${room.players.length}`);
            }
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎯 Server running on port ${PORT}`);
    console.log(`📊 Current rooms: ${rooms.size}`);
});
