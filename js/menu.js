// Управление меню
class MenuManager {
    constructor() {
        this.currentScreen = 'main-menu';
        this.gameStarted = false;
        this.gameData = {};
        
        this.initializeMenus();
        this.bindEvents();
    }

    initializeMenus() {
        // Получаем элементы меню
        this.mainMenu = document.getElementById('mainMenu');
        this.gameScreen = document.getElementById('gameScreen');
        this.pauseMenu = document.getElementById('pauseMenu');
        this.loadingScreen = document.getElementById('loadingScreen');
        
        // Показываем главное меню при загрузке
        this.showMainMenu();
    }

    bindEvents() {
        // Кнопки главного меню
        document.getElementById('startButton').addEventListener('click', () => {
            this.startNewGame();
        });

        document.getElementById('continueButton').addEventListener('click', () => {
            this.continueGame();
        });

        document.getElementById('settingsButton').addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('exitButton').addEventListener('click', () => {
            this.exitGame();
        });

        // Кнопки меню паузы
        document.getElementById('resumeButton').addEventListener('click', () => {
            this.resumeGame();
        });

        document.getElementById('saveButton').addEventListener('click', () => {
            this.saveGame();
        });

        document.getElementById('loadButton').addEventListener('click', () => {
            this.loadGame();
        });

        document.getElementById('mainMenuButton').addEventListener('click', () => {
            this.returnToMainMenu();
        });

        // Клавиша ESC для паузы
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                // Проверяем, хочет ли игра обработать ESC (например, закрыть магазин)
                if (window.gameInstance && window.gameInstance.handleEsc && window.gameInstance.handleEsc()) {
                    return;
                }

                if (this.currentScreen === 'game' && this.gameStarted) {
                    this.pauseGame();
                } else if (this.currentScreen === 'pause') {
                    this.resumeGame();
                }
            }
        });

        // Проверяем наличие сохранённой игры
        this.checkSavedGame();
    }

    showMainMenu() {
        this.hideAllScreens();
        this.mainMenu.classList.remove('hidden');
        this.currentScreen = 'main-menu';
    }

    showGameScreen() {
        this.hideAllScreens();
        this.gameScreen.classList.remove('hidden');
        this.currentScreen = 'game';
    }

    showPauseMenu() {
        this.pauseMenu.classList.remove('hidden');
        this.currentScreen = 'pause';
    }

    hidePauseMenu() {
        this.pauseMenu.classList.add('hidden');
        this.currentScreen = 'game';
    }

    showLoadingScreen() {
        this.hideAllScreens();
        this.loadingScreen.classList.remove('hidden');
        this.currentScreen = 'loading';
    }

    hideAllScreens() {
        this.mainMenu.classList.add('hidden');
        this.gameScreen.classList.add('hidden');
        this.pauseMenu.classList.add('hidden');
        this.loadingScreen.classList.add('hidden');
    }

    startNewGame() {
        this.showLoadingScreen();
        this.simulateLoading(() => {
            this.gameStarted = true;
            this.initializeGame();
            this.showGameScreen();
        });
    }

    continueGame() {
        const savedData = this.loadGameData();
        if (savedData) {
            this.showLoadingScreen();
            this.simulateLoading(() => {
                this.gameStarted = true;
                this.gameData = savedData;
                this.initializeGame(savedData);
                this.showGameScreen();
            });
        } else {
            this.showNotification('Нет сохранённых игр!', 'error');
        }
    }

    pauseGame() {
        if (this.gameStarted && window.gameInstance) {
            window.gameInstance.pause();
            this.showPauseMenu();
        }
    }

    resumeGame() {
        if (this.gameStarted && window.gameInstance) {
            window.gameInstance.resume();
            this.hidePauseMenu();
        }
    }

    saveGame() {
        if (this.gameStarted && window.gameInstance) {
            const gameState = window.gameInstance.getGameState();
            this.saveGameData(gameState);
            this.showNotification('Игра сохранена!', 'success');
        }
    }

    loadGame() {
        const savedData = this.loadGameData();
        if (savedData) {
            this.gameData = savedData;
            if (window.gameInstance) {
                window.gameInstance.loadGameState(savedData);
            }
            this.hidePauseMenu();
            this.showNotification('Игра загружена!', 'success');
        } else {
            this.showNotification('Нет сохранённых игр!', 'error');
        }
    }

    returnToMainMenu() {
        if (window.gameInstance) {
            window.gameInstance.destroy();
        }
        this.gameStarted = false;
        this.showMainMenu();
    }

    showSettings() {
        // TODO: Реализовать настройки
        this.showNotification('Настройки будут добавлены позже!', 'info');
    }

    exitGame() {
        if (confirm('Вы действительно хотите выйти из игры?')) {
            window.close();
        }
    }

    initializeGame(savedData = null) {
        console.log('Initializing game...');
        
        // Сначала пробуем простой движок
        if (window.SimpleGameEngine) {
            window.gameInstance = new window.SimpleGameEngine();
            const success = window.gameInstance.initialize(savedData);
            if (success) {
                console.log('Simple game engine initialized successfully');
                return;
            }
        }
        
        // Если простой движок не сработал, пробуем основной
        if (window.GameEngine) {
            console.log('Falling back to main GameEngine');
            window.gameInstance = new window.GameEngine();
            window.gameInstance.initialize(savedData);
        } else {
            console.error('No game engine available!');
        }
    }

    simulateLoading(callback) {
        const progressBar = document.getElementById('loadingProgress');
        const loadingText = document.getElementById('loadingText');
        
        const loadingSteps = [
            'Инициализация движка...',
            'Загрузка текстур...',
            'Создание города...',
            'Генерация трафика...',
            'Размещение NPC...',
            'Финализация...'
        ];

        let step = 0;
        const interval = setInterval(() => {
            const progress = ((step + 1) / loadingSteps.length) * 100;
            progressBar.style.width = progress + '%';
            
            if (step < loadingSteps.length) {
                loadingText.textContent = loadingSteps[step];
                step++;
            }

            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(callback, 500);
            }
        }, 500);
    }

    checkSavedGame() {
        const savedData = this.loadGameData();
        const continueButton = document.getElementById('continueButton');
        
        if (!savedData) {
            continueButton.style.opacity = '0.5';
            continueButton.style.pointerEvents = 'none';
        }
    }

    saveGameData(data) {
        try {
            localStorage.setItem('gtaGame_save', JSON.stringify({
                ...data,
                timestamp: Date.now()
            }));
            return true;
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            return false;
        }
    }

    loadGameData() {
        try {
            const data = localStorage.getItem('gtaGame_save');
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            return null;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#00ff00' : type === 'error' ? '#ff0000' : '#ffd700'};
            color: #000;
            padding: 1rem 2rem;
            border-radius: 5px;
            font-family: 'Orbitron', monospace;
            font-weight: 700;
            z-index: 2000;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Инициализация меню при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.menuManager = new MenuManager();
});

// Добавляем CSS для анимаций уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    }
`;
document.head.appendChild(style);