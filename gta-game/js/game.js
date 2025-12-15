// Основной игровой движок
class GameEngine {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.canvas = null;
        this.clock = new THREE.Clock();
        
        this.player = null;
        this.city = null;
        this.vehicles = [];
        this.npcs = [];
        this.npcSystem = null;
        
        this.isPaused = false;
        this.isInitialized = false;
        
        this.gameState = {
            player: {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                health: 100,
                money: 50000,
                wantedLevel: 0
            },
            world: {
                time: 12.0, // 12:00
                weather: 'clear'
            },
            graphics: {
                quality: 'low', // low, medium, high
                shadows: false,
                lighting: 'basic'
            }
        };
    }

    initialize(savedData = null) {
        if (this.isInitialized) {
            this.destroy();
        }

        this.canvas = document.getElementById('gameCanvas');
        this.setupRenderer();
        this.setupScene();
        this.setupCamera();
        this.setupLights();
        
        if (savedData) {
            this.loadGameState(savedData);
        }

        this.createWorld();
        this.createPlayer();
        this.createNPCs();
        this.startGameLoop();
        
        this.isInitialized = true;
        console.log('Game Engine initialized');
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: false, // Отключаем для производительности
            alpha: false,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap; // Более простой тип теней
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        // Фон неба
        this.renderer.setClearColor(0x87CEEB, 1);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        
        // Туман для дальности видимости
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 2000);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            3000
        );
        
        this.camera.position.set(0, 50, 100);
        this.camera.lookAt(0, 0, 0);
    }

    setupLights() {
        // Направленный свет (солнце)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(100, 200, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024; // Уменьшено для производительности
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 300; // Уменьшено
        directionalLight.shadow.camera.left = -100; // Уменьшено
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);

        // Окружающий свет
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(ambientLight);

        // Свет заката/рассвета
        const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.4);
        this.scene.add(hemisphereLight);
    }

    createWorld() {
        if (!window.CityGenerator) {
            console.warn('CityGenerator не найден, создаём базовый мир');
            this.createBasicWorld();
            return;
        }
        
        this.city = new window.CityGenerator(this.scene);
        this.city.generate();
    }

    createBasicWorld() {
        // Создаём базовую землю
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x3a5f3a });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Простые здания
        this.createSimpleBuildings();
        
        // Дороги
        this.createSimpleRoads();
    }

    createSimpleBuildings() {
        const buildingCount = 50;
        const colors = [0x888888, 0x666666, 0x999999, 0x777777];
        
        for (let i = 0; i < buildingCount; i++) {
            const width = 20 + Math.random() * 30;
            const height = 30 + Math.random() * 100;
            const depth = 20 + Math.random() * 30;
            
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshLambertMaterial({ 
                color: colors[Math.floor(Math.random() * colors.length)]
            });
            const building = new THREE.Mesh(geometry, material);
            
            // Размещаем здания в сетке с небольшими отклонениями
            const gridSize = 80;
            const gridX = Math.floor(i / 7) - 3;
            const gridZ = (i % 7) - 3;
            
            building.position.set(
                gridX * gridSize + (Math.random() - 0.5) * 20,
                height / 2,
                gridZ * gridSize + (Math.random() - 0.5) * 20
            );
            
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);
        }
    }

    createSimpleRoads() {
        const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        
        // Горизонтальные дороги
        for (let i = -3; i <= 3; i++) {
            const roadGeometry = new THREE.PlaneGeometry(1000, 10);
            const road = new THREE.Mesh(roadGeometry, roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.set(0, 0.1, i * 80);
            road.receiveShadow = true;
            this.scene.add(road);
        }
        
        // Вертикальные дороги
        for (let i = -3; i <= 3; i++) {
            const roadGeometry = new THREE.PlaneGeometry(10, 1000);
            const road = new THREE.Mesh(roadGeometry, roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.set(i * 80, 0.1, 0);
            road.receiveShadow = true;
            this.scene.add(road);
        }
    }

    createPlayer() {
        if (window.Player) {
            this.player = new window.Player(this.scene, this.camera);
            this.player.setPosition(
                this.gameState.player.position.x,
                this.gameState.player.position.y,
                this.gameState.player.position.z
            );
        } else {
            console.warn('Player класс не найден');
            this.createBasicPlayer();
        }
    }

    createNPCs() {
        if (window.NPCSystem) {
            this.npcSystem = new window.NPCSystem(this.scene);
            this.npcSystem.initialize();
            console.log('NPC система инициализирована');
        } else {
            console.warn('NPCSystem класс не найден');
        }
    }

    createBasicPlayer() {
        // Простая капсула как игрок
        const geometry = new THREE.CapsuleGeometry(1, 3);
        const material = new THREE.MeshLambertMaterial({ color: 0xff4444 });
        const playerMesh = new THREE.Mesh(geometry, material);
        playerMesh.position.set(0, 2, 0);
        playerMesh.castShadow = true;
        this.scene.add(playerMesh);

        // Простое управление камерой
        this.setupBasicCameraControls();
    }

    setupBasicCameraControls() {
        const keys = {};
        
        document.addEventListener('keydown', (event) => {
            keys[event.code] = true;
        });
        
        document.addEventListener('keyup', (event) => {
            keys[event.code] = false;
        });

        this.updateCameraControls = () => {
            if (this.isPaused) return;

            const speed = 0.5;
            
            if (keys['KeyW'] || keys['ArrowUp']) {
                this.camera.position.z -= speed;
            }
            if (keys['KeyS'] || keys['ArrowDown']) {
                this.camera.position.z += speed;
            }
            if (keys['KeyA'] || keys['ArrowLeft']) {
                this.camera.position.x -= speed;
            }
            if (keys['KeyD'] || keys['ArrowRight']) {
                this.camera.position.x += speed;
            }
            if (keys['Space']) {
                this.camera.position.y += speed * 0.5;
            }
            if (keys['ShiftLeft']) {
                this.camera.position.y -= speed * 0.5;
            }
        };
    }

    startGameLoop() {
        const animate = () => {
            if (!this.isInitialized) return;
            
            requestAnimationFrame(animate);
            
            if (!this.isPaused) {
                this.update();
                this.render();
            }
        };
        
        animate();
    }

    update() {
        const deltaTime = this.clock.getDelta();
        
        // Обновляем игрока
        if (this.player && this.player.update) {
            this.player.update(deltaTime);
        } else if (this.updateCameraControls) {
            this.updateCameraControls();
        }
        
        // Обновляем транспорт
        this.vehicles.forEach(vehicle => {
            if (vehicle.update) vehicle.update(deltaTime);
        });
        
        // Обновляем NPC (передаем камеру для LOD/отсечения)
        if (this.npcSystem) {
            this.npcSystem.update(deltaTime, this.camera);
            this.npcSystem.addRandomBehaviors();
        }
        
        // Обновляем HUD
        this.updateHUD();
        
        // Обновляем время в игре
        this.updateGameTime(deltaTime);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    updateHUD() {
        // Обновляем здоровье
        const healthFill = document.getElementById('healthFill');
        if (healthFill) {
            healthFill.style.width = this.gameState.player.health + '%';
        }
        
        // Обновляем деньги
        const moneyDisplay = document.getElementById('money');
        if (moneyDisplay) {
            moneyDisplay.textContent = `$${this.gameState.player.money.toLocaleString()}`;
        }
        
        // Обновляем уровень розыска
        const wantedDisplay = document.getElementById('wantedLevel');
        if (wantedDisplay) {
            const stars = '★'.repeat(this.gameState.player.wantedLevel) + 
                         '☆'.repeat(5 - this.gameState.player.wantedLevel);
            wantedDisplay.textContent = stars;
        }
    }

    updateGameTime(deltaTime) {
        // Время в игре идёт быстрее реального (1 минута = 1 секунда)
        this.gameState.world.time += deltaTime * 60 / 3600; // Часы
        if (this.gameState.world.time >= 24) {
            this.gameState.world.time -= 24;
        }
        
        // Обновляем освещение в зависимости от времени
        this.updateLighting();
    }

    updateLighting() {
        const time = this.gameState.world.time;
        let lightIntensity = 1.0;
        let skyColor = 0x87CEEB;
        
        if (time < 6 || time > 20) {
            // Ночь
            lightIntensity = 0.2;
            skyColor = 0x191970;
        } else if (time < 8 || time > 18) {
            // Рассвет/закат
            lightIntensity = 0.6;
            skyColor = 0xFF6347;
        }
        
        // Обновляем освещение
        const directionalLight = this.scene.children.find(child => 
            child instanceof THREE.DirectionalLight
        );
        if (directionalLight) {
            directionalLight.intensity = lightIntensity;
        }
        
        // Обновляем цвет неба
        this.renderer.setClearColor(skyColor, 1);
        this.scene.fog.color.setHex(skyColor);
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
        this.clock.start();
    }

    getGameState() {
        if (this.player && this.player.getPosition) {
            const position = this.player.getPosition();
            this.gameState.player.position = position;
        }
        
        return { ...this.gameState, timestamp: Date.now() };
    }

    loadGameState(savedData) {
        this.gameState = { ...this.gameState, ...savedData };
        
        if (this.player && this.player.setPosition) {
            this.player.setPosition(
                this.gameState.player.position.x,
                this.gameState.player.position.y,
                this.gameState.player.position.z
            );
        }
    }

    destroy() {
        // Уничтожаем системы
        if (this.npcSystem) {
            this.npcSystem.destroy();
            this.npcSystem = null;
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // Очищаем сцену
        if (this.scene) {
            while(this.scene.children.length > 0) {
                const child = this.scene.children[0];
                this.scene.remove(child);
                
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        }
        
        this.isInitialized = false;
        console.log('Game Engine destroyed');
    }

    // Обработка изменения размера окна
    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Переключение качества графики
    toggleQuality() {
        const qualities = ['low', 'medium', 'high'];
        const currentIndex = qualities.indexOf(this.gameState.graphics.quality);
        const nextIndex = (currentIndex + 1) % qualities.length;
        
        this.gameState.graphics.quality = qualities[nextIndex];
        this.applyQualitySettings();
        
        // Обновляем текст кнопки
        const qualityButton = document.getElementById('qualityToggle');
        if (qualityButton) {
            const qualityNames = { low: 'Низкое качество', medium: 'Среднее качество', high: 'Высокое качество' };
            qualityButton.textContent = qualityNames[this.gameState.graphics.quality];
        }
        
        console.log(`Quality changed to: ${this.gameState.graphics.quality}`);
    }

    applyQualitySettings() {
        const quality = this.gameState.graphics.quality;
        
        if (quality === 'low') {
            this.renderer.shadowMap.enabled = false;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
            this.scene.fog.far = 1000;
        } else if (quality === 'medium') {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.BasicShadowMap;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            this.scene.fog.far = 1500;
        } else if (quality === 'high') {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.scene.fog.far = 2000;
        }
    }
}

// Экспортируем класс в глобальную область видимости
window.GameEngine = GameEngine;

// Обработчик изменения размера окна
window.addEventListener('resize', () => {
    if (window.gameInstance) {
        window.gameInstance.onWindowResize();
    }
});