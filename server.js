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

const rooms = new Map();
const players = new Map();

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function generateRoomCode() {
    return 'BUNK' + Math.floor(1000 + Math.random() * 9000);
}

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
                currentRound: 1,
                voting: false
            };
            
            rooms.set(roomCode, room);
            players.set(socket.id, player);
            socket.join(roomCode);
            
            socket.emit('room_created', {
                roomCode,
                playerId: player.id
            });

            io.to(roomCode).emit('players_update', room.players);
            
            console.log(`✅ Room created: ${roomCode} by ${username}`);
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
            
            console.log(`✅ Player ${username} joined room ${roomCode}`);
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Ошибка присоединения к комнате' });
        }
    });

    socket.on('toggle_ready', () => {
        try {
            const player = players.get(socket.id);
            if (!player) return;
            
            const room = rooms.get(player.roomCode);
            if (!room) return;
            
            player.ready = !player.ready;
            
            console.log(`🔄 Player ${player.username} ready: ${player.ready}`);
            
            io.to(room.code).emit('players_update', room.players);
        } catch (error) {
            console.error('Error toggling ready:', error);
        }
    });

    socket.on('reveal_attribute', (data) => {
        try {
            const player = players.get(socket.id);
            if (!player) return;
            
            const room = rooms.get(player.roomCode);
            if (!room) return;
            
            if (room.currentRound === 1 && data.attribute !== 'profession') {
                socket.emit('error', { message: 'В первом круге можно раскрывать только профессию' });
                return;
            }
            
            player.revealed[data.attribute] = true;
            
            console.log(`🔓 Player ${player.username} revealed ${data.attribute}`);
            
            io.to(room.code).emit('attribute_revealed', {
                playerId: player.id,
                attribute: data.attribute
            });

            io.to(room.code).emit('players_update', room.players);
        } catch (error) {
            console.error('Error revealing attribute:', error);
        }
    });

    socket.on('start_game', () => {
        try {
            console.log('🚀 Received start_game request');
            
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
            
            if (room.host !== player.id) {
                socket.emit('error', { message: 'Только создатель комнаты может начать игру' });
                return;
            }
            
            const allReady = room.players.every(p => p.ready);
            const minPlayers = room.players.length >= 3;
            
            if (!allReady) {
                const notReadyPlayers = room.players.filter(p => !p.ready).map(p => p.username);
                socket.emit('error', { message: `Не все игроки готовы: ${notReadyPlayers.join(', ')}` });
                return;
            }
            
            if (!minPlayers) {
                socket.emit('error', { message: 'Недостаточно игроков для начала игры (минимум 3)' });
                return;
            }
            
            room.gameStarted = true;
            room.currentRound = 1;
            
            console.log(`🎮 Game started in room ${room.code}`);
            
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
            
            if (room.host !== player.id) {
                socket.emit('error', { message: 'Только создатель комнаты может переходить к следующему кругу' });
                return;
            }
            
            if (room.currentRound === 1) {
                const allRevealedProfession = room.players.every(p => p.revealed.profession);
                if (!allRevealedProfession) {
                    socket.emit('error', { message: 'Не все игроки раскрыли профессию' });
                    return;
                }
            }
            
            room.currentRound++;
            
            console.log(`🔄 Round ${room.currentRound} started in room ${room.code}`);
            
            io.to(room.code).emit('next_round', {
                round: room.currentRound
            });
            
            if (room.currentRound === 5) {
                setTimeout(() => {
                    startVoting(room);
                }, 3000);
            }
        } catch (error) {
            console.error('Error starting next round:', error);
        }
    });

    socket.on('start_voting', () => {
        try {
            const player = players.get(socket.id);
            if (!player) return;
            
            const room = rooms.get(player.roomCode);
            if (!room || !room.gameStarted) return;
            
            if (room.host !== player.id) {
                socket.emit('error', { message: 'Только создатель комнаты может начать голосование' });
                return;
            }
            
            startVoting(room);
        } catch (error) {
            console.error('Error starting voting:', error);
        }
    });

    function startVoting(room) {
        room.voting = true;
        room.players.forEach(player => {
            player.vote = null;
        });
        
        console.log(`🗳️ Voting started in room ${room.code}`);
        
        io.to(room.code).emit('start_voting');
    }

    socket.on('cast_vote', (data) => {
        try {
            const player = players.get(socket.id);
            if (!player) return;
            
            const room = rooms.get(player.roomCode);
            if (!room || !room.voting) return;
            
            if (data.targetPlayerId === player.id) {
                socket.emit('error', { message: 'Нельзя голосовать за себя' });
                return;
            }
            
            const targetPlayer = room.players.find(p => p.id === data.targetPlayerId);
            if (!targetPlayer) {
                socket.emit('error', { message: 'Игрок не найден' });
                return;
            }
            
            player.vote = data.targetPlayerId;
            
            console.log(`🗳️ Player ${player.username} voted for ${targetPlayer.username}`);
            
            checkVotingCompletion(room);
        } catch (error) {
            console.error('Error casting vote:', error);
        }
    });

    function checkVotingCompletion(room) {
        const allVoted = room.players.every(player => player.vote !== null);
        
        if (allVoted) {
            console.log(`✅ All players voted in room ${room.code}`);
            eliminatePlayer(room);
        }
    }

    function eliminatePlayer(room) {
        const voteCount = {};
        room.players.forEach(player => {
            if (player.vote) {
                voteCount[player.vote] = (voteCount[player.vote] || 0) + 1;
            }
        });
        
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
            
            room.players = room.players.filter(p => p.id !== eliminatedPlayerId);
            room.voting = false;
            
            console.log(`👋 Player ${eliminatedPlayer.username} eliminated from room ${room.code}`);
            
            io.to(room.code).emit('player_eliminated', {
                playerId: eliminatedPlayerId,
                username: eliminatedPlayer.username,
                voteCount: maxVotes
            });

            io.to(room.code).emit('players_update', room.players);
            
            if (room.players.length <= 3) {
                setTimeout(() => {
                    io.to(room.code).emit('game_ended', {
                        winners: room.players.map(p => p.username)
                    });
                }, 3000);
            }
        }
    }

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
                console.log(`🗑️ Room ${room.code} deleted`);
            } else {
                if (room.host === player.id) {
                    room.host = room.players[0].id;
                    room.players[0].isHost = true;
                }
                
                io.to(room.code).emit('player_left', {
                    username: playerUsername
                });

                io.to(room.code).emit('players_update', room.players);
            }
            
            socket.leave(room.code);
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    });

    socket.on('disconnect', () => {
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
            } else {
                if (room.host === player.id) {
                    room.host = room.players[0].id;
                    room.players[0].isHost = true;
                }
                
                io.to(room.code).emit('player_left', {
                    username: playerUsername
                });

                io.to(room.code).emit('players_update', room.players);
            }
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎯 Server running on port ${PORT}`);
});
