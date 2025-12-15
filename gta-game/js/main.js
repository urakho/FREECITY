// Главный файл приложения - связывает все компоненты
(function() {
    'use strict';

    // Глобальные переменные
    window.gameInstance = null;
    window.menuManager = null;
    window.controlsSystem = null;

    // Инициализация при загрузке DOM
    document.addEventListener('DOMContentLoaded', function() {
        console.log('GTA Game Loading...');
        initializeApp();
    });

    function initializeApp() {
        // Проверяем поддержку WebGL
        if (!checkWebGLSupport()) {
            showError('Ваш браузер не поддерживает WebGL. Игра не может быть запущена.');
            return;
        }

        // Инициализируем систему управления
        window.controlsSystem = new ControlsSystem();
        
        // Расширяем GameEngine для интеграции всех систем
        extendGameEngine();
        
        console.log('Application initialized successfully');
    }

    function checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!context;
        } catch (e) {
            return false;
        }
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 2rem;
            border-radius: 10px;
            text-align: center;
            font-family: 'Orbitron', monospace;
            z-index: 9999;
        `;
        errorDiv.innerHTML = `
            <h2>Ошибка</h2>
            <p>${message}</p>
            <p>Попробуйте обновить браузер или использовать Chrome/Firefox.</p>
        `;
        document.body.appendChild(errorDiv);
    }

    function extendGameEngine() {
        // Расширяем метод initialize класса GameEngine
        const originalInitialize = window.GameEngine.prototype.initialize;
        window.GameEngine.prototype.initialize = function(savedData) {
            // Вызываем оригинальный метод
            originalInitialize.call(this, savedData);
            
            // Добавляем дополнительные системы
            this.initializeAdditionalSystems();
            
            // Настройка кнопки качества
            this.setupQualityToggle();
        };

        // Добавляем новый метод для инициализации систем
        window.GameEngine.prototype.initializeAdditionalSystems = function() {
            // Инициализируем систему транспорта
            this.vehicleSystem = new VehicleSystem(this.scene);
            this.vehicleSystem.initialize();
            
            // Инициализируем систему NPC
            this.npcSystem = new NPCSystem(this.scene);
            this.npcSystem.initialize();
            
            // Создаём игрока (переопределяем базовый метод)
            if (this.player) {
                this.scene.remove(this.player.group);
            }
            this.player = new Player(this.scene, this.camera);
            
            console.log('All game systems initialized');
        };

        // Добавляем метод настройки кнопки качества
        window.GameEngine.prototype.setupQualityToggle = function() {
            const qualityButton = document.getElementById('qualityToggle');
            if (qualityButton) {
                qualityButton.addEventListener('click', () => {
                    this.toggleQuality();
                });
                
                // Применяем начальные настройки качества
                this.applyQualitySettings();
            }
        };

        // Расширяем метод update
        const originalUpdate = window.GameEngine.prototype.update;
        window.GameEngine.prototype.update = function() {
            // Вызываем оригинальный метод
            originalUpdate.call(this);
            
            // Обновляем дополнительные системы
            this.updateAdditionalSystems();
        };

        // Добавляем обновление дополнительных систем
        window.GameEngine.prototype.updateAdditionalSystems = function() {
            const deltaTime = this.clock.getDelta();
            
            // Обновляем транспорт
            if (this.vehicleSystem) {
                this.vehicleSystem.update(deltaTime);
            }
            
            // Обновляем NPC с меньшей частотой
            if (this.npcSystem && this.frameCount % 2 === 0) { // Каждый второй кадр
                this.npcSystem.update(deltaTime);
                // Добавляем случайные поведения реже
                if (Math.random() < 0.02) { // 2% шанс вместо 10%
                    this.npcSystem.addRandomBehaviors();
                }
            }
            
            // Проверяем взаимодействие игрока с NPC реже
            if (this.player && this.npcSystem && this.frameCount % 10 === 0) { // Каждый 10-й кадр
                this.checkPlayerNPCInteractions();
            }
            
            // Увеличиваем счётчик кадров
            this.frameCount = (this.frameCount || 0) + 1;
        };

        // Добавляем проверку взаимодействия игрока с NPC
        window.GameEngine.prototype.checkPlayerNPCInteractions = function() {
            const playerPosition = this.player.getPosition();
            const nearbyNPCs = this.npcSystem.getNearbyNPCs(playerPosition, 15);
            
            nearbyNPCs.forEach(npc => {
                if (Math.random() < 0.01) { // 1% шанс реакции
                    this.npcSystem.makeNPCReactToPlayer(npc, playerPosition);
                }
            });
        };

        // Расширяем метод getGameState для сохранения
        const originalGetGameState = window.GameEngine.prototype.getGameState;
        window.GameEngine.prototype.getGameState = function() {
            const baseState = originalGetGameState.call(this);
            
            // Добавляем состояния дополнительных систем
            if (this.player) {
                baseState.player = this.player.getState();
            }
            
            // Можно добавить состояния транспорта и NPC для сохранения
            // baseState.vehicles = this.vehicleSystem.getState();
            // baseState.npcs = this.npcSystem.getState();
            
            return baseState;
        };

        // Расширяем метод loadGameState для загрузки
        const originalLoadGameState = window.GameEngine.prototype.loadGameState;
        window.GameEngine.prototype.loadGameState = function(savedData) {
            originalLoadGameState.call(this, savedData);
            
            // Загружаем состояния дополнительных систем
            if (savedData.player && this.player) {
                this.player.setState(savedData.player);
            }
        };

        // Расширяем метод destroy
        const originalDestroy = window.GameEngine.prototype.destroy;
        window.GameEngine.prototype.destroy = function() {
            // Очищаем дополнительные системы
            if (this.vehicleSystem) {
                this.vehicleSystem.destroy();
                this.vehicleSystem = null;
            }
            
            if (this.npcSystem) {
                this.npcSystem.destroy();
                this.npcSystem = null;
            }
            
            if (this.player) {
                // Player cleanup handled by scene cleanup
                this.player = null;
            }
            
            // Вызываем оригинальный метод
            originalDestroy.call(this);
        };
    }

    // Глобальные функции утилиты
    window.gameUtils = {
        // Генерация случайного цвета
        randomColor: function() {
            return Math.floor(Math.random() * 16777215);
        },
        
        // Расстояние между двумя точками
        distance: function(pos1, pos2) {
            return Math.sqrt(
                Math.pow(pos2.x - pos1.x, 2) + 
                Math.pow(pos2.y - pos1.y, 2) + 
                Math.pow(pos2.z - pos1.z, 2)
            );
        },
        
        // Линейная интерполяция
        lerp: function(a, b, t) {
            return a + (b - a) * t;
        },
        
        // Нормализация угла к диапазону 0-2π
        normalizeAngle: function(angle) {
            while (angle < 0) angle += Math.PI * 2;
            while (angle >= Math.PI * 2) angle -= Math.PI * 2;
            return angle;
        },
        
        // Форматирование времени игры
        formatGameTime: function(hours) {
            const h = Math.floor(hours) % 24;
            const m = Math.floor((hours % 1) * 60);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        },
        
        // Проверка, находится ли точка в прямоугольнике
        pointInRect: function(point, rect) {
            return point.x >= rect.x && 
                   point.x <= rect.x + rect.width &&
                   point.y >= rect.y && 
                   point.y <= rect.y + rect.height;
        }
    };

    // Обработка ошибок
    window.addEventListener('error', function(event) {
        console.error('Game Error:', event.error);
        
        // Показываем пользователю уведомление об ошибке
        if (window.menuManager) {
            window.menuManager.showNotification(
                'Произошла ошибка в игре. Проверьте консоль браузера.', 
                'error'
            );
        }
    });

    // Обработка изменения видимости страницы
    document.addEventListener('visibilitychange', function() {
        if (window.gameInstance) {
            if (document.hidden) {
                // Ставим игру на паузу при сворачивании
                window.gameInstance.pause();
            } else {
                // Снимаем с паузы при возвращении (опционально)
                // window.gameInstance.resume();
            }
        }
    });

    // Обработка перед закрытием страницы
    window.addEventListener('beforeunload', function(event) {
        // Автосохранение перед закрытием
        if (window.gameInstance && window.gameInstance.gameStarted) {
            try {
                const gameState = window.gameInstance.getGameState();
                window.menuManager.saveGameData(gameState);
                console.log('Game auto-saved before exit');
            } catch (error) {
                console.error('Failed to auto-save:', error);
            }
        }
    });

    // Добавляем информацию о производительности
    let fpsCounter = 0;
    let lastTime = performance.now();
    
    function updatePerformanceStats() {
        const currentTime = performance.now();
        fpsCounter++;
        
        if (currentTime - lastTime >= 1000) {
            // Обновляем FPS раз в секунду
            const fps = Math.round(fpsCounter * 1000 / (currentTime - lastTime));
            
            // Можно показать FPS в интерфейсе
            const fpsDisplay = document.getElementById('fps-display');
            if (fpsDisplay) {
                fpsDisplay.textContent = `FPS: ${fps}`;
            }
            
            fpsCounter = 0;
            lastTime = currentTime;
            
            // Предупреждение о низкой производительности
            if (fps < 30 && window.menuManager) {
                console.warn(`Low FPS detected: ${fps}`);
            }
        }
        
        requestAnimationFrame(updatePerformanceStats);
    }
    
    // Запускаем счётчик производительности
    updatePerformanceStats();

    // Экспортируем функции для глобального доступа
    window.gameApp = {
        initialize: initializeApp,
        checkWebGLSupport: checkWebGLSupport,
        showError: showError
    };

    console.log('Main application script loaded');
})();