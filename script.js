// Данные для генерации карт
const cardData = {
    professions: [
        "Инженер-ядерщик", "Повар", "Врач", "Фермер", "Программист", 
        "Строитель", "Учитель", "Солдат", "Учёный", "Электрик",
        "Психолог", "Механик", "Химик", "Таксидермист", "Астролог"
    ],
    ages: ["18 лет", "25 лет", "34 года", "42 года", "51 год", "63 года", "72 года"],
    genders: ["Мужской", "Женский", "Небинарный"],
    healthStatuses: [
        "Идеальное здоровье", "Хроническая астма", "Аллергия на пыль", "Диабет", 
        "Отличный иммунитет", "Слепота на один глаз", "Гипертония", "Аллергия на арахис"
    ],
    phobias: [
        "Арахнофобия (боязнь пауков)", "Клаустрофобия", "Аквафобия", "Аэрофобия",
        "Агорафобия", "Трискаидекафобия (боязнь числа 13)", "Зоофобия", "Гемофобия (боязнь крови)"
    ],
    hobbies: [
        "Садоводство", "Игра на гитаре", "Чтение книг", "Коллекционирование марок",
        "Готовка", "Астрономия", "Шахматы", "Фотография", "Вышивание крестиком", "Пение"
    ],
    baggage: [
        "Аптечка первой помощи", "Набор инструментов", "Мешок картошки", 
        "Семена овощей", "Портативный генератор", "Книга 'Выживание в дикой природе'",
        "Радиостанция", "Палатка", "Фонарик с динамо-машиной", "Запас воды на 30 дней"
    ],
    traits: [
        "Лидерские качества", "Паникёр", "Оптимист", "Циник", 
        "Отличный переговорщик", "Хронический ворчун", "Невероятно удачлив", 
        "Аллергия на ложь", "Веган", "Храпит как трактор"
    ]
};

// Элементы DOM
const generateCardBtn = document.getElementById('generateCard');
const cardDisplay = document.getElementById('cardDisplay');
const startTimerBtn = document.getElementById('startTimer');
const pauseTimerBtn = document.getElementById('pauseTimer');
const resetTimerBtn = document.getElementById('resetTimer');
const timerButtons = document.querySelectorAll('.timer-btn');
const timerDisplay = document.getElementById('timer');
const playerNameInput = document.getElementById('playerName');
const saveCardBtn = document.getElementById('saveCard');
const playersList = document.getElementById('playersList');

// Таймер
let timerInterval;
let timeLeft = 300; // 5 минут по умолчанию
let isRunning = false;

// Текущая сгенерированная карта
let currentCard = null;

// Инициализация
function init() {
    updateTimerDisplay();
    loadPlayersFromStorage();
}

// Генерация случайной карты
function generateRandomCard() {
    const profession = getRandomItem(cardData.professions);
    const age = getRandomItem(cardData.ages);
    const gender = getRandomItem(cardData.genders);
    const health = getRandomItem(cardData.healthStatuses);
    const phobia = getRandomItem(cardData.phobias);
    const hobby = getRandomItem(cardData.hobbies);
    const baggage = getRandomItem(cardData.baggage);
    const trait = getRandomItem(cardData.traits);
    
    currentCard = {
        profession,
        age,
        gender,
        health,
        phobia,
        hobby,
        baggage,
        trait
    };
    
    displayCard(currentCard);
}

// Отображение карты
function displayCard(card) {
    const cardHTML = `
        <div class="generated-card">
            <h3>КАРТА ИГРОКА</h3>
            <div class="card-item"><strong>Профессия:</strong> ${card.profession}</div>
            <div class="card-item"><strong>Возраст:</strong> ${card.age}</div>
            <div class="card-item"><strong>Пол:</strong> ${card.gender}</div>
            <div class="card-item"><strong>Здоровье:</strong> ${card.health}</div>
            <div class="card-item"><strong>Фобия:</strong> ${card.phobia}</div>
            <div class="card-item"><strong>Хобби:</strong> ${card.hobby}</div>
            <div class="card-item"><strong>Багаж:</strong> ${card.baggage}</div>
            <div class="card-item"><strong>Особенность:</strong> ${card.trait}</div>
        </div>
    `;
    
    cardDisplay.innerHTML = cardHTML;
}

// Получение случайного элемента из массива
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Таймер
function startTimer() {
    if (isRunning) return;
    
    isRunning = true;
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            isRunning = false;
            timerDisplay.style.color = '#ff5555';
            alert("Время обсуждения истекло!");
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    isRunning = false;
}

function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    timeLeft = 300; // Сброс к 5 минутам
    updateTimerDisplay();
    timerDisplay.style.color = '#00ff88';
}

function setTimerTime(seconds) {
    if (isRunning) {
        if (!confirm("Таймер работает. Сменить время?")) return;
        pauseTimer();
    }
    
    timeLeft = seconds;
    updateTimerDisplay();
    timerDisplay.style.color = '#00ff88';
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Работа с игроками
function savePlayerCard() {
    const playerName = playerNameInput.value.trim();
    
    if (!playerName) {
        alert("Введите имя игрока!");
        return;
    }
    
    if (!currentCard) {
        alert("Сначала сгенерируйте карту!");
        return;
    }
    
    // Проверяем лимит игроков
    const playerEntries = playersList.querySelectorAll('.player-entry');
    if (playerEntries.length >= 12) {
        alert("Достигнут лимит в 12 игроков!");
        return;
    }
    
    // Создаем элемент игрока
    const playerElement = document.createElement('div');
    playerElement.className = 'player-entry';
    playerElement.innerHTML = `
        <div>
            <div class="player-name">${playerName}</div>
            <div class="player-profession">${currentCard.profession}, ${currentCard.age}</div>
        </div>
        <button class="delete-player"><i class="fas fa-times"></i></button>
    `;
    
    // Добавляем обработчик удаления
    const deleteBtn = playerElement.querySelector('.delete-player');
    deleteBtn.addEventListener('click', function() {
        playerElement.remove();
        savePlayersToStorage();
    });
    
    // Добавляем в список
    const emptyMessage = playersList.querySelector('.empty-list');
    if (emptyMessage) {
        emptyMessage.remove();
    }
    
    playersList.appendChild(playerElement);
    
    // Сохраняем в localStorage
    savePlayersToStorage();
    
    // Очищаем поле ввода
    playerNameInput.value = '';
    
    alert(`Карта для "${playerName}" сохранена!`);
}

function savePlayersToStorage() {
    const players = [];
    const playerEntries = playersList.querySelectorAll('.player-entry');
    
    playerEntries.forEach(entry => {
        const name = entry.querySelector('.player-name').textContent;
        const profession = entry.querySelector('.player-profession').textContent;
        players.push({ name, profession });
    });
    
    localStorage.setItem('bunkerPlayers', JSON.stringify(players));
}

function loadPlayersFromStorage() {
    const savedPlayers = localStorage.getItem('bunkerPlayers');
    
    if (savedPlayers) {
        const players = JSON.parse(savedPlayers);
        
        if (players.length > 0) {
            const emptyMessage = playersList.querySelector('.empty-list');
            if (emptyMessage) {
                emptyMessage.remove();
            }
            
            players.forEach(player => {
                const playerElement = document.createElement('div');
                playerElement.className = 'player-entry';
                playerElement.innerHTML = `
                    <div>
                        <div class="player-name">${player.name}</div>
                        <div class="player-profession">${player.profession}</div>
                    </div>
                    <button class="delete-player"><i class="fas fa-times"></i></button>
                `;
                
                const deleteBtn = playerElement.querySelector('.delete-player');
                deleteBtn.addEventListener('click', function() {
                    playerElement.remove();
                    savePlayersToStorage();
                    
                    // Если список пуст, показываем сообщение
                    if (playersList.children.length === 0) {
                        playersList.innerHTML = '<p class="empty-list">Пока никого нет. Будьте первым!</p>';
                    }
                });
                
                playersList.appendChild(playerElement);
            });
        }
    }
}

// Обработчики событий
generateCardBtn.addEventListener('click', generateRandomCard);

startTimerBtn.addEventListener('click', startTimer);
pauseTimerBtn.addEventListener('click', pauseTimer);
resetTimerBtn.addEventListener('click', resetTimer);

timerButtons.forEach(button => {
    button.addEventListener('click', function() {
        const time = parseInt(this.getAttribute('data-time'));
        setTimerTime(time);
    });
});

saveCardBtn.addEventListener('click', savePlayerCard);

playerNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        savePlayerCard();
    }
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', init);
