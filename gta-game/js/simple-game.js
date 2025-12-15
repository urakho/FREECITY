// Простая версия игрового движка для исправления черного экрана
class SimpleGameEngine {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.canvas = null;
        this.isRunning = false;
        this.player = null;
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.cameraDistance = 30;
        this.firstPersonMode = true; // Режим от первого лица
        this.npcs = []; // Массив NPC
        this.vehicles = []; // Массив машин
        this.roads = []; // Массив дорог для движения машин
        this.buildings = []; // Список зданий для LOD
        this._lodCounter = 0; // Счетчик кадров для LOD-апдейта
        this._buildingRestoreQueue = [];
        this._maxBuildingRestoresPerFrame = 6;
        
        // Управление машиной
        this.drivingVehicle = null; // Машина, которой управляет игрок
        
        // Система розыска
        this.wantedLevel = 0; // Уровень розыска (0-5 звезд)
        this.policeCars = []; // Полицейские машины
        this.tanks = []; // Танки для высоких уровней розыска
        this.jailPosition = new THREE.Vector3(-450, 0, -450); // Позиция тюрьмы
        this.isInJail = false; // Флаг нахождения в тюрьме
        
        // FPS оптимизация
        this.lastTime = 0;
        this.frameCount = 0;
        this.fpsDisplay = null;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        
        console.log('SimpleGameEngine created');
    }

    initialize() {
        try {
            console.log('Initializing SimpleGameEngine...');
            
            this.canvas = document.getElementById('gameCanvas');
            if (!this.canvas) {
                console.error('Canvas not found!');
                return false;
            }

            // Создаём рендерер
            this.renderer = new THREE.WebGLRenderer({ 
                canvas: this.canvas,
                antialias: false, // Отключаем для производительности
                alpha: false
            });
            
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setClearColor(0x87CEEB, 1); // Небесно-голубой фон
            this.renderer.shadowMap.enabled = false; // Отключаем тени для повышения FPS
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Ограничиваем пиксель-рейшо

            // Создаём сцену
            this.scene = new THREE.Scene();
            this.scene.fog = new THREE.Fog(0x87CEEB, 50, 300);

            // Создаём камеру
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(0, 20, 50);
            this.camera.lookAt(0, 0, 0);

            // Добавляем освещение
            this.setupLighting();

        // Создаём простой мир
        this.createSimpleWorld();

        // Создаём игрока
        this.createPlayer();

        // Создаём тюрьму
        this.createJail();

        // Создаём магазин оружия
        this.createWeaponShop();
        this.createShopUI();

        // Создаём движущихся NPC и машины
        this.createMovingEntities();

        // Настраиваем управление
        this.setupControls();

        // Запускаем цикл рендеринга
        this.startRenderLoop();

        // Инициализируем отображение уровня розыска
        this.updateWantedDisplay();

        // Скрываем инструкции через 10 секунд
        setTimeout(() => {
            const controlsHelp = document.getElementById('controlsHelp');
            if (controlsHelp) {
                controlsHelp.classList.add('hidden');
            }
        }, 10000);

        console.log('SimpleGameEngine initialized successfully');
        return true;        } catch (error) {
            console.error('Error initializing SimpleGameEngine:', error);
            return false;
        }
    }

    setupLighting() {
        // Направленный свет (солнце)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(50, 100, 25);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);

        // Окружающий свет
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
    }

    isOnRoad(x, z) {
        // Проверяем, находится ли позиция на дороге (обновлено для большого города)
        for (let road of this.roads) {
            if (road.type === 'horizontal') {
                if (Math.abs(z - road.z) < 12 && x >= road.startX - 5 && x <= road.endX + 5) {
                    return true;
                }
            } else if (road.type === 'vertical') {
                if (Math.abs(x - road.x) < 12 && z >= road.startZ - 5 && z <= road.endZ + 5) {
                    return true;
                }
            }
        }
        return false;
    }

    createSimpleWorld() {
        // Земля (увеличиваем в 5 раз)
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4a5d3a });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Сначала создаем дороги, чтобы потом размещать здания правильно
        this.roads = []; // Инициализируем массив дорог

        // Создаем больше дорог для большого города
        for (let i = -4; i <= 4; i++) {
            // Главные горизонтальные дороги (шире и длиннее)
            const roadGeometry = new THREE.PlaneGeometry(1000, 12);
            const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
            const road = new THREE.Mesh(roadGeometry, roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.set(0, 0.01, i * 120);
            this.scene.add(road);
            
            // Добавляем разметку на дороге
            const lineGeometry = new THREE.PlaneGeometry(950, 0.3);
            const lineMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
            const centerLine = new THREE.Mesh(lineGeometry, lineMaterial);
            centerLine.rotation.x = -Math.PI / 2;
            centerLine.position.set(0, 0.02, i * 120);
            this.scene.add(centerLine);
            
            // Тротуары
            const sidewalkGeometry = new THREE.PlaneGeometry(1000, 4);
            const sidewalkMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
            
            const sidewalk1 = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
            sidewalk1.rotation.x = -Math.PI / 2;
            sidewalk1.position.set(0, 0.005, i * 120 + 8);
            this.scene.add(sidewalk1);
            
            const sidewalk2 = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
            sidewalk2.rotation.x = -Math.PI / 2;
            sidewalk2.position.set(0, 0.005, i * 120 - 8);
            this.scene.add(sidewalk2);
            
            // Сохраняем информацию о дороге для движения машин
            this.roads.push({
                type: 'horizontal',
                z: i * 120,
                startX: -500,
                endX: 500
            });

            // Главные вертикальные дороги (шире и длиннее)
            const road2 = new THREE.Mesh(new THREE.PlaneGeometry(12, 1000), roadMaterial);
            road2.rotation.x = -Math.PI / 2;
            road2.position.set(i * 120, 0.01, 0);
            this.scene.add(road2);
            
            // Разметка для вертикальной дороги
            const centerLine2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 950), lineMaterial);
            centerLine2.rotation.x = -Math.PI / 2;
            centerLine2.position.set(i * 120, 0.02, 0);
            this.scene.add(centerLine2);
            
            // Тротуары для вертикальной дороги
            const sidewalk3 = new THREE.Mesh(new THREE.PlaneGeometry(4, 1000), sidewalkMaterial);
            sidewalk3.rotation.x = -Math.PI / 2;
            sidewalk3.position.set(i * 120 + 8, 0.005, 0);
            this.scene.add(sidewalk3);
            
            const sidewalk4 = new THREE.Mesh(new THREE.PlaneGeometry(4, 1000), sidewalkMaterial);
            sidewalk4.rotation.x = -Math.PI / 2;
            sidewalk4.position.set(i * 120 - 8, 0.005, 0);
            this.scene.add(sidewalk4);
            
            // Сохраняем информацию о вертикальной дороге
            this.roads.push({
                type: 'vertical',
                x: i * 120,
                startZ: -500,
                endZ: 500
            });
        }

        // Теперь создаем здания с окнами для большого города, избегая дорог
        for (let i = 0; i < 200; i++) { // Устанавливаем количество зданий 200
            const width = 8 + Math.random() * 15;
            const height = 15 + Math.random() * 30;
            const depth = 8 + Math.random() * 15;
            
            let x, z;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * 900;
                z = (Math.random() - 0.5) * 900;
                attempts++;
            } while (this.isOnRoad(x, z) && attempts < 50);
            
            if (attempts < 50) {
                this.createBuildingWithWindows(x, z, width, height, depth);
            }
        }

        console.log('Simple world created with', this.scene.children.length, 'objects');
    }

    createBuildingWithWindows(x, z, width, height, depth) {
        const buildingGroup = new THREE.Group();
        
        // Основной корпус здания
        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        
        // Расширенная палитра цветов для разных типов зданий
        const buildingColors = [
            // Кирпичные здания
            0x8B4513, 0xA0522D, 0xCD853F, 0xD2691E,
            // Бетонные здания
            0x696969, 0x778899, 0x708090, 0x2F4F4F,
            // Современные здания
            0x4682B4, 0x5F9EA0, 0x6495ED, 0x87CEEB,
            // Офисные здания
            0xB0C4DE, 0xDCDCDC, 0xF0F8FF, 0xF5F5F5,
            // Жилые дома
            0xD2B48C, 0xF5DEB3, 0xFFE4B5, 0xFFF8DC,
            // Промышленные здания
            0x556B2F, 0x8FBC8F, 0x2E8B57, 0x228B22
        ];
        
        const colorIndex = Math.floor(Math.random() * buildingColors.length);
        const baseColor = buildingColors[colorIndex];
        
        // Добавляем эффект поверхности (имитация материала)
        const buildingMaterial = new THREE.MeshLambertMaterial({ 
            color: baseColor,
            // Добавляем небольшое отражение для насыщенности
            emissive: new THREE.Color(baseColor).multiplyScalar(0.05)
        });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        buildingGroup.add(building);

        // Соберём части здания для LOD-переключения
        const highParts = [];
        highParts.push(building);
        
        // Добавляем крышу
        if (Math.random() > 0.3) {
            const roofGeometry = new THREE.BoxGeometry(width + 2, 1, depth + 2);
            const roofColors = [0x8B4513, 0x2F4F4F, 0x696969, 0x8B0000, 0x006400];
            const roofMaterial = new THREE.MeshLambertMaterial({ 
                color: roofColors[Math.floor(Math.random() * roofColors.length)]
            });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.y = height + 0.5;
            roof.castShadow = true;
            buildingGroup.add(roof);
            highParts.push(roof);
        }
        
        // Архитектурные детали (колонны, балконы)
        if (Math.random() > 0.6 && height > 15) {
            // Добавляем балконы
            const balconyGeometry = new THREE.BoxGeometry(width * 0.8, 0.5, 2);
            const balconyMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
            
            for (let floor = 2; floor < Math.floor(height / 4); floor += 2) {
                const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
                balcony.position.set(0, floor * 4, depth/2 + 1);
                balcony.castShadow = true;
                buildingGroup.add(balcony);
                highParts.push(balcony);
            }
        }
        
        // Создаем окна с рамами
        const windowMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x87CEEB, 
            transparent: true, 
            opacity: 0.8 
        });
        
        const windowFrameMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x444444
        });
        
        const windowSize = 1.5;
        const windowSpacing = 3;
        const floors = Math.floor(height / 4);
        
        // Окна на передней стороне (Z+)
        for (let floor = 1; floor < floors; floor++) {
            for (let w = 0; w < Math.floor(width / windowSpacing); w++) {
                // Рама окна
                const frameGeometry = new THREE.PlaneGeometry(windowSize + 0.2, windowSize + 0.2);
                const frame = new THREE.Mesh(frameGeometry, windowFrameMaterial);
                frame.position.set(
                    -width/2 + windowSpacing/2 + w * windowSpacing,
                    floor * 4,
                    depth/2 + 0.005
                );
                buildingGroup.add(frame);
                highParts.push(frame);
                
                // Стекло окна
                const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                window.position.set(
                    -width/2 + windowSpacing/2 + w * windowSpacing,
                    floor * 4,
                    depth/2 + 0.01
                );
                buildingGroup.add(window);
                highParts.push(window);
                
                // Случайно освещенные окна (чаще вечером)
                if (Math.random() > 0.6) {
                    const lightColors = [0xFFFFAA, 0xFFE4B5, 0xFFF8DC, 0xF0F8FF];
                    const lightMaterial = new THREE.MeshLambertMaterial({ 
                        color: lightColors[Math.floor(Math.random() * lightColors.length)], 
                        transparent: true, 
                        opacity: 0.7,
                        emissive: new THREE.Color(0xFFFFAA).multiplyScalar(0.3)
                    });
                    const lightWindow = new THREE.Mesh(windowGeometry, lightMaterial);
                    lightWindow.position.copy(window.position);
                    lightWindow.position.z += 0.001;
                    buildingGroup.add(lightWindow);
                    highParts.push(lightWindow);
                }
            }
        }

        // После создания всех деталей: добавляем метаданные для LOD
        // Сохраним оригинальные материалы и подготовим низкокачественный вариант
        const lowMat = new THREE.MeshBasicMaterial({ color: baseColor });
        buildingGroup.userData = buildingGroup.userData || {};
        buildingGroup.userData.highParts = highParts;
        buildingGroup.userData.lowMaterial = lowMat;
        buildingGroup.userData.isHighDetail = true;

        // Окна на задней стороне (Z-)
        for (let floor = 1; floor < floors; floor++) {
            for (let w = 0; w < Math.floor(width / windowSpacing); w++) {
                const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                window.position.set(
                    -width/2 + windowSpacing/2 + w * windowSpacing,
                    floor * 4,
                    -depth/2 - 0.01
                );
                window.rotation.y = Math.PI;
                buildingGroup.add(window);
                
                if (Math.random() > 0.7) {
                    const lightMaterial = new THREE.MeshLambertMaterial({ 
                        color: 0xFFFFAA, 
                        transparent: true, 
                        opacity: 0.6 
                    });
                    const lightWindow = new THREE.Mesh(windowGeometry, lightMaterial);
                    lightWindow.position.copy(window.position);
                    lightWindow.position.z -= 0.001;
                    lightWindow.rotation.y = Math.PI;
                    buildingGroup.add(lightWindow);
                }
            }
        }
        
        // Окна на левой стороне (X-)
        for (let floor = 1; floor < floors; floor++) {
            for (let d = 0; d < Math.floor(depth / windowSpacing); d++) {
                const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                window.position.set(
                    -width/2 - 0.01,
                    floor * 4,
                    -depth/2 + windowSpacing/2 + d * windowSpacing
                );
                window.rotation.y = Math.PI / 2;
                buildingGroup.add(window);
                
                if (Math.random() > 0.7) {
                    const lightMaterial = new THREE.MeshLambertMaterial({ 
                        color: 0xFFFFAA, 
                        transparent: true, 
                        opacity: 0.6 
                    });
                    const lightWindow = new THREE.Mesh(windowGeometry, lightMaterial);
                    lightWindow.position.copy(window.position);
                    lightWindow.position.x -= 0.001;
                    lightWindow.rotation.y = Math.PI / 2;
                    buildingGroup.add(lightWindow);
                }
            }
        }
        
        // Окна на правой стороне (X+)
        for (let floor = 1; floor < floors; floor++) {
            for (let d = 0; d < Math.floor(depth / windowSpacing); d++) {
                const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                window.position.set(
                    width/2 + 0.01,
                    floor * 4,
                    -depth/2 + windowSpacing/2 + d * windowSpacing
                );
                window.rotation.y = -Math.PI / 2;
                buildingGroup.add(window);
                
                if (Math.random() > 0.7) {
                    const lightMaterial = new THREE.MeshLambertMaterial({ 
                        color: 0xFFFFAA, 
                        transparent: true, 
                        opacity: 0.6 
                    });
                    const lightWindow = new THREE.Mesh(windowGeometry, lightMaterial);
                    lightWindow.position.copy(window.position);
                    lightWindow.position.x += 0.001;
                    lightWindow.rotation.y = -Math.PI / 2;
                    buildingGroup.add(lightWindow);
                }
            }
        }
        
        // Позиционируем и добавляем здание в сцену
        buildingGroup.position.set(x, 0, z);
        this.scene.add(buildingGroup);

        // Вычисляем BoundingBox один раз при создании (ПОСЛЕ позиционирования)
        buildingGroup.updateMatrixWorld();
        const box = new THREE.Box3().setFromObject(buildingGroup);
        // Расширяем немного для коллизии
        box.expandByScalar(0.5);
        
        // Регистрируем здание в списке движка для LOD-обработки
        if (!this.buildings) this.buildings = [];
        this.buildings.push({ 
            group: buildingGroup,
            box: box // Сохраняем вычисленный бокс
        });
    }

    createJail() {
        // Создаем тюрьму в виде большого серого здания с решетками
        const jailGroup = new THREE.Group();
        
        // Основное здание тюрьмы
        const jailGeometry = new THREE.BoxGeometry(20, 15, 20);
        const jailMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const jailBuilding = new THREE.Mesh(jailGeometry, jailMaterial);
        jailBuilding.position.y = 7.5;
        jailGroup.add(jailBuilding);
        
        // Крыша
        const roofGeometry = new THREE.BoxGeometry(22, 2, 22);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 16;
        jailGroup.add(roof);
        
        // Окна с решетками (имитация)
        const windowGeometry = new THREE.PlaneGeometry(3, 3);
        const windowMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x87CEEB, 
            transparent: true, 
            opacity: 0.7 
        });
        
        // Создаем окна на всех сторонах
        const windowPositions = [
            // Передняя сторона (Z+)
            [0, 5, 10.01], [0, 9, 10.01], [0, 13, 10.01],
            [-6, 5, 10.01], [-6, 9, 10.01], [-6, 13, 10.01],
            [6, 5, 10.01], [6, 9, 10.01], [6, 13, 10.01],
            // Задняя сторона (Z-)
            [0, 5, -10.01], [0, 9, -10.01], [0, 13, -10.01],
            // Боковые стороны
            [10.01, 5, 0], [10.01, 9, 0], [10.01, 13, 0],
            [-10.01, 5, 0], [-10.01, 9, 0], [-10.01, 13, 0]
        ];
        
        windowPositions.forEach(pos => {
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.set(pos[0], pos[1], pos[2]);
            
            // Поворачиваем окна на боковых сторонах
            if (Math.abs(pos[0]) > 5) {
                window.rotation.y = Math.PI / 2;
            }
            
            jailGroup.add(window);
            
            // Добавляем решетки
            const barsGeometry = new THREE.PlaneGeometry(3.2, 3.2);
            const barsMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x333333,
                transparent: true,
                opacity: 0.8
            });
            const bars = new THREE.Mesh(barsGeometry, barsMaterial);
            bars.position.copy(window.position);
            bars.position.z += pos[2] > 0 ? 0.01 : -0.01;
            if (Math.abs(pos[0]) > 5) {
                bars.rotation.y = Math.PI / 2;
            }
            jailGroup.add(bars);
        });
        
        // Дверь
        const doorGeometry = new THREE.PlaneGeometry(2, 4);
        const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, 2, 10.01);
        jailGroup.add(door);
        
        // Добавляем забор вокруг тюрьмы
        const fenceGeometry = new THREE.BoxGeometry(30, 2, 0.5);
        const fenceMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
        
        const fences = [
            [0, 1, 15], [0, 1, -15], [15, 1, 0], [-15, 1, 0]
        ];
        
        fences.forEach(pos => {
            const fence = new THREE.Mesh(fenceGeometry, fenceMaterial);
            fence.position.set(pos[0], pos[1], pos[2]);
            if (pos[2] !== 0) {
                fence.rotation.y = Math.PI / 2;
            }
            jailGroup.add(fence);
            
            // Добавляем колючую проволоку сверху
            const wireGeometry = new THREE.CylinderGeometry(0.05, 0.05, 30);
            const wireMaterial = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });
            const wire = new THREE.Mesh(wireGeometry, wireMaterial);
            wire.position.copy(fence.position);
            wire.position.y = 3;
            if (pos[2] !== 0) {
                wire.rotation.z = Math.PI / 2;
            } else {
                wire.rotation.x = Math.PI / 2;
            }
            jailGroup.add(wire);
        });
        
        // Позиционируем тюрьму
        jailGroup.position.copy(this.jailPosition);
        this.scene.add(jailGroup);
        
        // Вычисляем BoundingBox
        jailGroup.updateMatrixWorld(true);
        const jailBox = new THREE.Box3().setFromObject(jailGroup);
        jailBox.expandByScalar(0.5);
        
        // Добавляем тюрьму в список зданий для коллизий
        this.buildings.push({
            group: jailGroup,
            box: jailBox
        });
    }

    createWeaponShop() {
        // Позиция магазина оружия
        this.weaponShopPosition = new THREE.Vector3(100, 0, 100);
        
        const shopGroup = new THREE.Group();
        shopGroup.position.copy(this.weaponShopPosition);
        
        // Создаем текстуру кирпича для магазина
        const brickCanvas = document.createElement('canvas');
        brickCanvas.width = 512;
        brickCanvas.height = 512;
        const brickCtx = brickCanvas.getContext('2d');
        
        // Фон
        brickCtx.fillStyle = '#8B0000'; // Темно-красный фон
        brickCtx.fillRect(0, 0, 512, 512);
        
        // Кирпичи
        brickCtx.fillStyle = '#A52A2A'; // Коричневые кирпичи
        const brickWidth = 64;
        const brickHeight = 32;
        
        for (let y = 0; y < 512; y += brickHeight) {
            const offset = (y / brickHeight) % 2 === 0 ? 0 : brickWidth / 2;
            for (let x = -brickWidth; x < 512; x += brickWidth) {
                brickCtx.fillRect(x + offset + 2, y + 2, brickWidth - 4, brickHeight - 4);
            }
        }
        
        // Грязь/потертости убраны полностью
        
        const brickTexture = new THREE.CanvasTexture(brickCanvas);
        brickTexture.wrapS = THREE.RepeatWrapping;
        brickTexture.wrapT = THREE.RepeatWrapping;
        brickTexture.repeat.set(2, 1);
        
        // Здание магазина
        const buildingGeometry = new THREE.BoxGeometry(20, 10, 20);
        const buildingMaterial = new THREE.MeshLambertMaterial({ map: brickTexture });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = 5;
        building.castShadow = true;
        building.receiveShadow = true;
        shopGroup.add(building);
        
        // Вывеска "GUNS"
        const signGeometry = new THREE.BoxGeometry(10, 2, 1);
        
        // Создаем текстуру для вывески
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        
        // Металлическая рамка
        context.fillStyle = '#333';
        context.fillRect(0, 0, 512, 128);
        context.fillStyle = '#111';
        context.fillRect(10, 10, 492, 108);
        
        // Текст
        context.fillStyle = '#FF0000';
        context.font = 'bold 80px Impact';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = '#FF0000';
        context.shadowBlur = 20;
        context.fillText('GUNS & AMMO', 256, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const signMaterial = new THREE.MeshLambertMaterial({ map: texture });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(0, 8, 10.5);
        shopGroup.add(sign);
        
        // Витрина (стекло)
        const windowGeo = new THREE.PlaneGeometry(8, 4);
        const windowMat = new THREE.MeshLambertMaterial({ 
            color: 0x88CCFF, 
            transparent: true, 
            opacity: 0.6,
            emissive: 0x112244
        });
        const shopWindow = new THREE.Mesh(windowGeo, windowMat);
        shopWindow.position.set(-5, 3, 10.1);
        shopGroup.add(shopWindow);
        
        // Решетка на окне
        const barsCanvas = document.createElement('canvas');
        barsCanvas.width = 64;
        barsCanvas.height = 64;
        const barsCtx = barsCanvas.getContext('2d');
        barsCtx.strokeStyle = '#333';
        barsCtx.lineWidth = 4;
        barsCtx.strokeRect(0,0,64,64);
        barsCtx.beginPath();
        barsCtx.moveTo(32,0); barsCtx.lineTo(32,64);
        barsCtx.moveTo(0,32); barsCtx.lineTo(64,32);
        barsCtx.stroke();
        const barsTex = new THREE.CanvasTexture(barsCanvas);
        barsTex.wrapS = THREE.RepeatWrapping;
        barsTex.wrapT = THREE.RepeatWrapping;
        barsTex.repeat.set(4, 2);
        
        const barsGeo = new THREE.PlaneGeometry(8, 4);
        const barsMat = new THREE.MeshBasicMaterial({ map: barsTex, transparent: true });
        const bars = new THREE.Mesh(barsGeo, barsMat);
        bars.position.set(-5, 3, 10.2);
        shopGroup.add(bars);
        
        // Дверь
        const doorGeometry = new THREE.PlaneGeometry(4, 6);
        const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(5, 3, 10.1);
        shopGroup.add(door);
        
        // Продавец (NPC)
        const npcGroup = new THREE.Group();
        npcGroup.position.set(8, 0, 12); // Сдвинул продавца ближе к двери
        
        // Тело продавца
        const bodyGeo = new THREE.BoxGeometry(0.8, 1.2, 0.4);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Черная одежда
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.5;
        npcGroup.add(body);
        
        // Жилет (бронежилет)
        const vestGeo = new THREE.BoxGeometry(0.85, 0.6, 0.45);
        const vestMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const vest = new THREE.Mesh(vestGeo, vestMat);
        vest.position.y = 1.7;
        npcGroup.add(vest);
        
        // Голова
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Темная кожа
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 2.35;
        npcGroup.add(head);
        
        // Бандана
        const bandanaGeo = new THREE.BoxGeometry(0.52, 0.15, 0.52);
        const bandanaMat = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
        const bandana = new THREE.Mesh(bandanaGeo, bandanaMat);
        bandana.position.y = 2.5;
        npcGroup.add(bandana);
        
        // Ноги продавца
        const legGeometry = new THREE.BoxGeometry(0.3, 1.5, 0.3);
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0x223344 }); // Джинсы
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(0.2, 0.75, 0);
        npcGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(-0.2, 0.75, 0);
        npcGroup.add(rightLeg);
        
        // Руки
        const armGeo = new THREE.BoxGeometry(0.2, 1.0, 0.2);
        const armMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        const leftArm = new THREE.Mesh(armGeo, armMat);
        leftArm.position.set(0.5, 1.5, 0);
        npcGroup.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeo, armMat);
        rightArm.position.set(-0.5, 1.5, 0);
        npcGroup.add(rightArm);
        
        // Дробовик убран по просьбе
        /*
        const gunGeo = new THREE.BoxGeometry(0.1, 0.1, 1.2);
        const gunMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const gun = new THREE.Mesh(gunGeo, gunMat);
        gun.position.set(0.3, 1.2, 0.4);
        gun.rotation.x = -Math.PI / 4;
        npcGroup.add(gun);
        */
        
        shopGroup.add(npcGroup);
        this.scene.add(shopGroup);
        
        // Вычисляем BoundingBox для магазина один раз (ПОСЛЕ добавления в сцену и обновления матриц)
        shopGroup.updateMatrixWorld(true); // Обновляем матрицы всей группы
        building.updateMatrixWorld(); // Обновляем матрицу здания
        
        const shopBox = new THREE.Box3().setFromObject(building);
        shopBox.expandByScalar(0.5);
        
        // Добавляем в список зданий для коллизий ТОЛЬКО само здание
        this.buildings.push({ 
            group: building,
            box: shopBox
        });
        
        // Сохраняем позицию продавца для взаимодействия
        this.shopKeeperPosition = new THREE.Vector3(108, 0, 112); // 100+8, 0, 100+12
        
        console.log('Weapon shop created');
    }

    createShopUI() {
        const shopDiv = document.createElement('div');
        shopDiv.id = 'weaponShop';
        shopDiv.style.display = 'none';
        shopDiv.style.position = 'fixed';
        shopDiv.style.top = '50%';
        shopDiv.style.left = '50%';
        shopDiv.style.transform = 'translate(-50%, -50%)';
        shopDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        shopDiv.style.padding = '20px';
        shopDiv.style.borderRadius = '10px';
        shopDiv.style.color = 'white';
        shopDiv.style.zIndex = '2000';
        shopDiv.style.textAlign = 'center';
        shopDiv.style.border = '2px solid #8B0000';
        
        shopDiv.innerHTML = `
            <h2 style="color: #FF0000; margin-bottom: 20px;">МАГАЗИН ОРУЖИЯ</h2>
            <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                <div class="weapon-card" style="border: 1px solid #444; padding: 10px; cursor: pointer;" onclick="window.gameEngine.buyWeapon('ak47', 2000)">
                    <h3>AK-47</h3>
                    <p>Урон: Средний</p>
                    <p>Скорострельность: Высокая</p>
                    <p style="color: #00FF00;">$2,000</p>
                    <button style="background: #8B0000; color: white; border: none; padding: 5px 10px; cursor: pointer;">КУПИТЬ</button>
                </div>
                <div class="weapon-card" style="border: 1px solid #444; padding: 10px; cursor: pointer;" onclick="window.gameEngine.buyWeapon('smg', 1000)">
                    <h3>ПП (SMG)</h3>
                    <p>Урон: Низкий</p>
                    <p>Скорострельность: Очень высокая</p>
                    <p style="color: #00FF00;">$1,000</p>
                    <button style="background: #8B0000; color: white; border: none; padding: 5px 10px; cursor: pointer;">КУПИТЬ</button>
                </div>
                <div class="weapon-card" style="border: 1px solid #444; padding: 10px; cursor: pointer;" onclick="window.gameEngine.buyWeapon('rpg', 5000)">
                    <h3>РПГ</h3>
                    <p>Урон: Взрывной</p>
                    <p>Скорострельность: Низкая</p>
                    <p style="color: #00FF00;">$5,000</p>
                    <button style="background: #8B0000; color: white; border: none; padding: 5px 10px; cursor: pointer;">КУПИТЬ</button>
                </div>
            </div>
            <button onclick="window.gameEngine.closeShop()" style="background: #444; color: white; border: none; padding: 10px 20px; cursor: pointer; font-size: 16px;">ЗАКРЫТЬ</button>
        `;
        
        document.body.appendChild(shopDiv);
        
        // Делаем движок доступным глобально для кнопок
        window.gameEngine = this;
    }

    buyWeapon(type, price) {
        if (this.player.money >= price) {
            if (!this.player.weapons.includes(type)) {
                this.player.money -= price;
                this.player.weapons.push(type);
                this.updateMoneyDisplay();
                this.showGameMessage('Оружие куплено!');
                
                // Автоматически берем в руки
                this.equipWeapon(type);
                
                // Закрываем магазин после покупки
                this.closeShop();
            } else {
                this.showGameMessage('У вас уже есть это оружие!');
            }
        } else {
            this.showGameMessage('Недостаточно денег!');
        }
    }

    closeShop() {
        const shopDiv = document.getElementById('weaponShop');
        if (shopDiv) {
            shopDiv.style.display = 'none';
            // Возвращаем захват курсора
            this.canvas.requestPointerLock();
            this.isShopOpen = false;
        }
    }

    updateMoneyDisplay() {
        const moneyElement = document.getElementById('money');
        if (moneyElement) {
            moneyElement.textContent = '$' + this.player.money.toLocaleString();
        }
    }

    equipWeapon(type) {
        this.player.currentWeapon = type;
        console.log('Equipped:', type);
        
        // Визуализация оружия в руках (простая)
        // Удаляем старое оружие
        if (this.player.weaponMesh) {
            this.player.group.remove(this.player.weaponMesh);
        }
        // Удаляем оружие от первого лица если есть
        if (this.player.fpWeaponMesh) {
            this.camera.remove(this.player.fpWeaponMesh);
            this.player.fpWeaponMesh = null;
        }
        
        let geometry, material;
        
        if (type === 'ak47') {
            geometry = new THREE.BoxGeometry(0.1, 0.1, 0.8);
            material = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Коричневый
        } else if (type === 'smg') {
            geometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
            material = new THREE.MeshLambertMaterial({ color: 0x333333 }); // Черный
        } else if (type === 'rpg') {
            // РПГ - создаем группу с деталями
            const rpgGroup = new THREE.Group();
            
            // Основная труба
            const tubeGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1.0);
            const tubeMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            tube.rotation.z = Math.PI / 2;
            rpgGroup.add(tube);
            
            // Рукоятка
            const gripGeometry = new THREE.BoxGeometry(0.05, 0.2, 0.08);
            const gripMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
            const grip = new THREE.Mesh(gripGeometry, gripMaterial);
            grip.position.set(0, -0.15, 0);
            rpgGroup.add(grip);
            
            // Передняя часть (дуло)
            const muzzleGeometry = new THREE.CylinderGeometry(0.12, 0.08, 0.2);
            const muzzle = new THREE.Mesh(muzzleGeometry, tubeMaterial);
            muzzle.rotation.z = Math.PI / 2;
            muzzle.position.set(0.6, 0, 0);
            rpgGroup.add(muzzle);
            
            // Для режима от первого лица - добавляем к камере
            // Для третьего лица - к группе игрока
            rpgGroup.position.set(0.5, 1.6, 0.3);
            rpgGroup.rotation.y = -Math.PI / 2;
            rpgGroup.rotation.z = -0.2;
            
            this.player.weaponMesh = rpgGroup;
            this.player.group.add(rpgGroup);
            
            // Создаем отдельную модель для камеры (режим от первого лица)
            const fpRpgGroup = new THREE.Group();
            
            // Основная труба - используем BasicMaterial для видимости
            const fpTubeGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.6);
            const fpTubeMaterial = new THREE.MeshBasicMaterial({ color: 0x2F4F4F });
            const fpTube = new THREE.Mesh(fpTubeGeometry, fpTubeMaterial);
            fpTube.rotation.z = Math.PI / 2;
            fpRpgGroup.add(fpTube);
            
            // Дуло
            const fpMuzzleGeometry = new THREE.CylinderGeometry(0.06, 0.04, 0.15);
            const fpMuzzle = new THREE.Mesh(fpMuzzleGeometry, fpTubeMaterial);
            fpMuzzle.rotation.z = Math.PI / 2;
            fpMuzzle.position.set(0.35, 0, 0);
            fpRpgGroup.add(fpMuzzle);
            
            // Рукоятка
            const fpGripGeometry = new THREE.BoxGeometry(0.03, 0.12, 0.05);
            const fpGripMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
            const fpGrip = new THREE.Mesh(fpGripGeometry, fpGripMaterial);
            fpGrip.position.set(0, -0.08, 0);
            fpRpgGroup.add(fpGrip);
            
            // Позиционируем в правом нижнем углу экрана
            fpRpgGroup.position.set(0.25, -0.15, -0.5);
            fpRpgGroup.rotation.set(0.1, -0.3, 0);
            
            this.camera.add(fpRpgGroup);
            this.player.fpWeaponMesh = fpRpgGroup;
            
            return; // Выходим, чтобы не выполнять код ниже
        }
        
        if (geometry && material) {
            const weapon = new THREE.Mesh(geometry, material);
            weapon.position.set(0.5, 1.8, 0.5); // В правой руке
            weapon.rotation.y = -Math.PI / 2; // Направлено вперед (относительно тела)
            this.player.weaponMesh = weapon;
            this.player.group.add(weapon);
        }
    }

    shootWeapon() {
        // Нельзя стрелять из личного оружия в транспорте (но танк стреляет по пробелу отдельно)
        if (this.drivingVehicle) return;
        
        if (!this.player.currentWeapon || !this.player.weapons.includes(this.player.currentWeapon)) return;
        
        const weaponType = this.player.currentWeapon;
        const now = Date.now();
        
        // Задержка стрельбы
        let cooldown = 500; // По умолчанию
        if (weaponType === 'rpg') cooldown = 2000;
        else if (weaponType === 'ak47') cooldown = 100; // 10 выстрелов в секунду
        else if (weaponType === 'smg') cooldown = 50;   // 20 выстрелов в секунду
        
        if (this.player.lastShot && now - this.player.lastShot < cooldown) return;
        this.player.lastShot = now;
        
        console.log('Shooting with', weaponType);
        
        // Позиция выстрела (от камеры)
        const origin = this.player.group.position.clone();
        origin.y += 2; // Высота глаз
        
        // Направление (куда смотрит камера)
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        if (weaponType === 'rpg') {
            // Создаем детализированную ракету
            const rocketGroup = new THREE.Group();
            
            // Корпус ракеты
            const bodyGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.8);
            const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            rocketGroup.add(body);
            
            // Наконечник (боеголовка)
            const tipGeometry = new THREE.ConeGeometry(0.1, 0.25);
            const tipMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
            const tip = new THREE.Mesh(tipGeometry, tipMaterial);
            tip.position.y = 0.5;
            rocketGroup.add(tip);
            
            // Стабилизаторы
            const finGeometry = new THREE.BoxGeometry(0.02, 0.2, 0.15);
            const finMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
            for (let i = 0; i < 4; i++) {
                const fin = new THREE.Mesh(finGeometry, finMaterial);
                fin.position.y = -0.3;
                fin.rotation.y = (Math.PI / 2) * i;
                fin.position.x = Math.sin((Math.PI / 2) * i) * 0.1;
                fin.position.z = Math.cos((Math.PI / 2) * i) * 0.1;
                rocketGroup.add(fin);
            }
            
            // Огненный след (сферы)
            const flameGeometry = new THREE.SphereGeometry(0.12);
            const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xFF4500, transparent: true, opacity: 0.8 });
            const flame = new THREE.Mesh(flameGeometry, flameMaterial);
            flame.position.y = -0.5;
            flame.name = 'flame';
            rocketGroup.add(flame);
            
            const flame2Geometry = new THREE.SphereGeometry(0.08);
            const flame2Material = new THREE.MeshBasicMaterial({ color: 0xFFFF00, transparent: true, opacity: 0.9 });
            const flame2 = new THREE.Mesh(flame2Geometry, flame2Material);
            flame2.position.y = -0.45;
            rocketGroup.add(flame2);
            
            rocketGroup.position.copy(origin).add(direction.clone().multiplyScalar(2));
            rocketGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            
            rocketGroup.userData = {
                velocity: direction.clone().multiplyScalar(0.8),
                gravity: -0.008, // Небольшая гравитация
                isRocket: true,
                damage: 500,
                creationTime: now,
                isExplosive: true,
                explosionRadius: 4,
                fromPlayer: true
            };
            
            this.scene.add(rocketGroup);
            if (!this.projectiles) this.projectiles = [];
            this.projectiles.push(rocketGroup);
            
        } else {
            // Создаем пулю (физический объект)
            const bulletGeometry = new THREE.SphereGeometry(0.1, 4, 4);
            const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
            const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
            
            bullet.position.copy(origin).add(direction.clone().multiplyScalar(1.0));
            
            // Скорость пули (быстрая)
            const speed = 2.0; 
            
            bullet.userData = {
                velocity: direction.clone().multiplyScalar(speed),
                gravity: 0, // Пули летят прямо
                isBullet: true,
                damage: (weaponType === 'ak47' ? 25 : 15), // Базовый урон (для машин)
                weaponType: weaponType, // Тип оружия для расчета урона по NPC
                creationTime: now,
                fromPlayer: true
            };
            
            this.scene.add(bullet);
            if (!this.projectiles) this.projectiles = [];
            this.projectiles.push(bullet);
            
            // Звук выстрела (визуально - вспышка)
            // Можно добавить PointLight на короткое время
        }
    }

    createMovingEntities() {
        // Создаём движущихся NPC
        this.createWalkingNPCs();
        
        // Создаём движущиеся машины
        this.createDrivingVehicles();
        
        console.log('Created', this.npcs.length, 'NPCs and', this.vehicles.length, 'vehicles');
    }

    createWalkingNPCs() {
        // Создаём точки маршрутов для NPC (тротуары рядом с дорогами)
        const walkingPaths = [];
        
        // Тротуары вдоль горизонтальных дорог (расширено для полного покрытия)
        for (let i = -8; i <= 8; i++) {
            const z = i * 60; // Уменьшаем расстояние для большей плотности
            // Основные тротуары
            walkingPaths.push({
                start: new THREE.Vector3(-400, 0, z + 12),
                end: new THREE.Vector3(400, 0, z + 12),
                direction: new THREE.Vector3(1, 0, 0)
            });
            walkingPaths.push({
                start: new THREE.Vector3(400, 0, z - 12),
                end: new THREE.Vector3(-400, 0, z - 12),
                direction: new THREE.Vector3(-1, 0, 0)
            });
            
            // Дополнительные внутренние тротуары
            walkingPaths.push({
                start: new THREE.Vector3(-400, 0, z + 6),
                end: new THREE.Vector3(400, 0, z + 6),
                direction: new THREE.Vector3(1, 0, 0)
            });
            walkingPaths.push({
                start: new THREE.Vector3(400, 0, z - 6),
                end: new THREE.Vector3(-400, 0, z - 6),
                direction: new THREE.Vector3(-1, 0, 0)
            });
        }
        
        // Тротуары вдоль вертикальных дорог (расширено для полного покрытия)
        for (let i = -8; i <= 8; i++) {
            const x = i * 60; // Уменьшаем расстояние для большей плотности
            // Основные тротуары
            walkingPaths.push({
                start: new THREE.Vector3(x + 12, 0, -400),
                end: new THREE.Vector3(x + 12, 0, 400),
                direction: new THREE.Vector3(0, 0, 1)
            });
            walkingPaths.push({
                start: new THREE.Vector3(x - 12, 0, 400),
                end: new THREE.Vector3(x - 12, 0, -400),
                direction: new THREE.Vector3(0, 0, -1)
            });
            
            // Дополнительные внутренние тротуары
            walkingPaths.push({
                start: new THREE.Vector3(x + 6, 0, -400),
                end: new THREE.Vector3(x + 6, 0, 400),
                direction: new THREE.Vector3(0, 0, 1)
            });
            walkingPaths.push({
                start: new THREE.Vector3(x - 6, 0, 400),
                end: new THREE.Vector3(x - 6, 0, -400),
                direction: new THREE.Vector3(0, 0, -1)
            });
        }
        
        // Добавляем диагональные пути для разнообразия
        for (let i = -6; i <= 6; i++) {
            for (let j = -6; j <= 6; j++) {
                const x = i * 80;
                const z = j * 80;
                // Короткие маршруты в разных направлениях
                walkingPaths.push({
                    start: new THREE.Vector3(x - 20, 0, z),
                    end: new THREE.Vector3(x + 20, 0, z),
                    direction: new THREE.Vector3(1, 0, 0)
                });
                walkingPaths.push({
                    start: new THREE.Vector3(x, 0, z - 20),
                    end: new THREE.Vector3(x, 0, z + 20),
                    direction: new THREE.Vector3(0, 0, 1)
                });
            }
        }

        // Создаём 400 NPC с равномерным распределением по всему миру
        const maxNPCs = 400;
        this.walkingPaths = walkingPaths; // Сохраняем для использования в навигации
        
        console.log(`Создано ${walkingPaths.length} путей для распределения NPC`);
        
        for (let i = 0; i < maxNPCs; i++) {
            const path = walkingPaths[i % walkingPaths.length]; // Используем циклично
            
            // Добавляем случайное смещение для разнообразия
            const modifiedPath = {
                start: path.start.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    0,
                    (Math.random() - 0.5) * 10
                )),
                end: path.end.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    0,
                    (Math.random() - 0.5) * 10
                )),
                direction: path.direction.clone()
            };
            
            const npc = this.createNPC(modifiedPath);
            if (npc) {
                this.npcs.push(npc);
                this.scene.add(npc.group);
            }
        }
    }

    _updateBuildingLOD() {
        if (!this.camera || !this.buildings) return;
        const camPos = this.camera.position;
        const highRangeSq = 100 * 100; // внутри 100 - высокий уровень
        const lowRangeSq = 250 * 250; // дальше 250 - низкий уровень

        for (let i = 0; i < this.buildings.length; i++) {
            const group = this.buildings[i];
            if (!group || !group.userData) continue;
            const dx = camPos.x - group.position.x;
            const dz = camPos.z - group.position.z;
            const dist2 = dx * dx + dz * dz;

            if (dist2 > lowRangeSq) {
                // низкое качество: заменить основной материал и скрыть детали окон
                if (group.userData.isHighDetail) {
                    const parts = group.userData.highParts || [];
                    for (let p = 0; p < parts.length; p++) {
                        const mesh = parts[p];
                        if (!mesh) continue;
                        if (mesh.geometry && mesh.geometry.type === 'BoxGeometry') {
                            mesh.userData._origMat = mesh.userData._origMat || mesh.material;
                            mesh.material = group.userData.lowMaterial;
                        } else {
                            mesh.visible = false;
                        }
                    }
                    group.userData.isHighDetail = false;
                }
            } else if (dist2 > highRangeSq) {
                // среднее расстояние: частично упрощаем (скрываем детали, но оставляем основное)
                if (group.userData.isHighDetail) {
                    const parts = group.userData.highParts || [];
                    for (let p = 0; p < parts.length; p++) {
                        const mesh = parts[p];
                        if (!mesh) continue;
                        if (mesh.geometry && mesh.geometry.type === 'BoxGeometry') {
                            mesh.userData._origMat = mesh.userData._origMat || mesh.material;
                            mesh.material = group.userData.lowMaterial;
                        } else {
                            mesh.visible = false;
                        }
                    }
                    group.userData.isHighDetail = false;
                }
            } else {
                // близко: вернуть высокое качество
                if (!group.userData.isHighDetail) {
                    // Поставим в очередь восстановления, чтобы не делать много работы в одном кадре
                    if (!group.userData._queuedForRestore) {
                        group.userData._queuedForRestore = true;
                        this._buildingRestoreQueue.push(group);
                    }
                }
            }
        }
    }

    _processBuildingRestoreQueue() {
        let restored = 0;
        while (this._buildingRestoreQueue.length > 0 && restored < this._maxBuildingRestoresPerFrame) {
            const group = this._buildingRestoreQueue.shift();
            if (!group || !group.userData) continue;
            const parts = group.userData.highParts || [];
            for (let p = 0; p < parts.length; p++) {
                const mesh = parts[p];
                if (!mesh) continue;
                if (mesh.geometry && mesh.geometry.type === 'BoxGeometry') {
                    if (mesh.userData && mesh.userData._origMat) mesh.material = mesh.userData._origMat;
                } else {
                    mesh.visible = true;
                }
            }
            group.userData.isHighDetail = true;
            group.userData._queuedForRestore = false;
            restored++;
        }
    }

    createNPC(path) {
        const npcGroup = new THREE.Group();
        
        // Определяем пол (50/50)
        const gender = Math.random() > 0.5 ? 'male' : 'female';
        const bodyScale = gender === 'female' ? { x: 0.9, y: 0.95, z: 0.9 } : { x: 1.0, y: 1.0, z: 1.0 };
        
        // Цвета одежды в зависимости от пола
        const maleClothing = {
            tops: [0x4682B4, 0x228B22, 0x8B0000, 0x2F4F4F, 0x483D8B, 0x696969],
            bottoms: [0x000080, 0x8B4513, 0x000000, 0x2F4F4F, 0x483D8B]
        };
        const femaleClothing = {
            tops: [0xFF69B4, 0xFF1493, 0xDDA0DD, 0x9370DB, 0x32CD32, 0xFF6347, 0x4169E1],
            bottoms: [0x000080, 0x8B0000, 0x000000, 0x4B0082, 0x800080, 0x8B008B]
        };
        
        const clothing = gender === 'female' ? femaleClothing : maleClothing;
        const topColor = clothing.tops[Math.floor(Math.random() * clothing.tops.length)];
        const bottomColor = clothing.bottoms[Math.floor(Math.random() * clothing.bottoms.length)];
        
        // Тело с учетом пола
        const bodyGeometry = new THREE.BoxGeometry(
            0.8 * bodyScale.x, 
            1.2 * bodyScale.y, 
            0.4 * bodyScale.z
        );
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: topColor });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.5;
        body.castShadow = true;
        npcGroup.add(body);
        
        // Голова с разными оттенками кожи
        const headSize = gender === 'female' ? 0.28 : 0.3;
        const headGeometry = new THREE.SphereGeometry(headSize);
        const skinTones = [
            { h: 0.08, s: 0.5, l: 0.8 + Math.random() * 0.15 }, // Светлая
            { h: 0.08, s: 0.6, l: 0.6 + Math.random() * 0.2 },  // Средняя
            { h: 0.06, s: 0.7, l: 0.4 + Math.random() * 0.2 },  // Смуглая
            { h: 0.04, s: 0.4, l: 0.2 + Math.random() * 0.15 }, // Темная
            { h: 0.05, s: 0.5, l: 0.15 + Math.random() * 0.1 }  // Очень темная
        ];
        const skinTone = skinTones[Math.floor(Math.random() * skinTones.length)];
        const skinColor = new THREE.Color().setHSL(skinTone.h, skinTone.s, skinTone.l);
        const headMaterial = new THREE.MeshLambertMaterial({ color: skinColor
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 2.4;
        head.castShadow = true;
        npcGroup.add(head);
        
        // Волосы в зависимости от пола
        const hair = this.createHair(gender, skinColor);
        if (hair) {
            npcGroup.add(hair);
        }
        
        // Ноги с учетом пола
        const legGeometry = new THREE.BoxGeometry(
            0.3 * bodyScale.x, 
            0.8 * bodyScale.y, 
            0.3 * bodyScale.z
        );
        const legMaterial = new THREE.MeshLambertMaterial({ color: bottomColor });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(0.2 * bodyScale.x, 0.5, 0);
        leftLeg.castShadow = true;
        leftLeg.name = 'leftLeg';
        npcGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(-0.2 * bodyScale.x, 0.5, 0);
        rightLeg.castShadow = true;
        rightLeg.name = 'rightLeg';
        npcGroup.add(rightLeg);
        
        // Руки с цветом кожи
        const armGeometry = new THREE.BoxGeometry(
            0.2 * bodyScale.x, 
            0.8 * bodyScale.y, 
            0.2 * bodyScale.z
        );
        const armMaterial = new THREE.MeshLambertMaterial({ color: skinColor });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(0.5 * bodyScale.x, 1.4, 0);
        leftArm.castShadow = true;
        leftArm.name = 'leftArm';
        npcGroup.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(-0.5 * bodyScale.x, 1.4, 0);
        rightArm.castShadow = true;
        rightArm.name = 'rightArm';
        npcGroup.add(rightArm);
        
        // Кисти рук
        const handGeometry = new THREE.SphereGeometry(0.08);
        const handMaterial = new THREE.MeshLambertMaterial({ color: skinColor });
        
        const leftHand = new THREE.Mesh(handGeometry, handMaterial);
        leftHand.position.set(0.5 * bodyScale.x, 1.0, 0);
        leftHand.castShadow = true;
        npcGroup.add(leftHand);
        
        const rightHand = new THREE.Mesh(handGeometry, handMaterial);
        rightHand.position.set(-0.5 * bodyScale.x, 1.0, 0);
        rightHand.castShadow = true;
        npcGroup.add(rightHand);
        
        // Обувь
        const shoeGeometry = new THREE.BoxGeometry(0.4 * bodyScale.x, 0.2, 0.6);
        const shoeColors = [0x000000, 0x8B4513, 0x2F4F4F, 0x800000];
        const shoeMaterial = new THREE.MeshLambertMaterial({ 
            color: shoeColors[Math.floor(Math.random() * shoeColors.length)]
        });
        
        const leftShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        leftShoe.position.set(0.2 * bodyScale.x, 0.1, 0.1);
        leftShoe.castShadow = true;
        leftShoe.name = 'leftShoe';
        npcGroup.add(leftShoe);
        
        const rightShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        rightShoe.position.set(-0.2 * bodyScale.x, 0.1, 0.1);
        rightShoe.castShadow = true;
        rightShoe.name = 'rightShoe';
        npcGroup.add(rightShoe);
        
        // Позиция на начале пути (обновлено для уменьшенных NPC)
        const startPos = path.start.clone();
        startPos.x += (Math.random() - 0.5) * 5; // Меньше смещение для обычных NPC
        startPos.z += (Math.random() - 0.5) * 2;
        npcGroup.position.copy(startPos);
        
        // Поворот в направлении движения
        if (path.direction.x > 0) npcGroup.rotation.y = 0;
        else if (path.direction.x < 0) npcGroup.rotation.y = Math.PI;
        else if (path.direction.z > 0) npcGroup.rotation.y = Math.PI / 2;
        else npcGroup.rotation.y = -Math.PI / 2;
        
        return {
            group: npcGroup,
            path: path,
            target: path.end.clone(),
            gender: gender,
            speed: gender === 'female' ? (0.06 + Math.random() * 0.03) : (0.08 + Math.random() * 0.04),
            walkingTime: Math.random() * Math.PI * 2,
            animationType: this.getRandomAnimationType(gender),
            bodyParts: {
                leftLeg: leftLeg,
                rightLeg: rightLeg,
                leftArm: leftArm,
                rightArm: rightArm,
                leftHand: leftHand,
                rightHand: rightHand,
                leftShoe: leftShoe,
                rightShoe: rightShoe
            },
            personalityTraits: {
                energy: Math.random(),
                confidence: Math.random(),
                nervousness: Math.random()
            },
            health: 100 // Здоровье NPC
        };
    }

    createRoadNetwork() {
        this.roadSegments = [];
        this.roadIntersections = [];
        
        // Создаем перекрестки для машин
        for (let i = -4; i <= 4; i++) {
            for (let j = -4; j <= 4; j++) {
                this.roadIntersections.push({
                    x: i * 120,
                    z: j * 120,
                    id: `road_${i}_${j}`,
                    connections: []
                });
            }
        }
        
        // Горизонтальные дороги с двумя полосами
        for (let i = -4; i <= 4; i++) {
            const z = i * 120;
            for (let j = -4; j < 4; j++) {
                const startX = j * 120;
                const endX = (j + 1) * 120;
                
                // Правая полоса (движение вправо)
                this.roadSegments.push({
                    start: new THREE.Vector3(startX, 0, z - 3),
                    end: new THREE.Vector3(endX, 0, z - 3),
                    direction: new THREE.Vector3(1, 0, 0),
                    lane: 'right',
                    type: 'horizontal',
                    intersectionStart: `road_${j}_${i}`,
                    intersectionEnd: `road_${j + 1}_${i}`
                });
                
                // Левая полоса (движение влево)
                this.roadSegments.push({
                    start: new THREE.Vector3(endX, 0, z + 3),
                    end: new THREE.Vector3(startX, 0, z + 3),
                    direction: new THREE.Vector3(-1, 0, 0),
                    lane: 'left',
                    type: 'horizontal',
                    intersectionStart: `road_${j + 1}_${i}`,
                    intersectionEnd: `road_${j}_${i}`
                });
            }
        }
        
        // Вертикальные дороги с двумя полосами
        for (let i = -4; i <= 4; i++) {
            const x = i * 120;
            for (let j = -4; j < 4; j++) {
                const startZ = j * 120;
                const endZ = (j + 1) * 120;
                
                // Нижняя полоса (движение вниз)
                this.roadSegments.push({
                    start: new THREE.Vector3(x - 3, 0, startZ),
                    end: new THREE.Vector3(x - 3, 0, endZ),
                    direction: new THREE.Vector3(0, 0, 1),
                    lane: 'right',
                    type: 'vertical',
                    intersectionStart: `road_${i}_${j}`,
                    intersectionEnd: `road_${i}_${j + 1}`
                });
                
                // Верхняя полоса (движение вверх)
                this.roadSegments.push({
                    start: new THREE.Vector3(x + 3, 0, endZ),
                    end: new THREE.Vector3(x + 3, 0, startZ),
                    direction: new THREE.Vector3(0, 0, -1),
                    lane: 'left',
                    type: 'vertical',
                    intersectionStart: `road_${i}_${j + 1}`,
                    intersectionEnd: `road_${i}_${j}`
                });
            }
        }
    }
    
    createDrivingVehicles() {
        // Сначала создаем дорожную сеть
        this.createRoadNetwork();
        
        // Создаём машины для новой дорожной системы
        const maxVehicles = Math.min(this.roadSegments.length, 20);
        for (let i = 0; i < maxVehicles; i++) {
            const road = this.roadSegments[Math.floor(Math.random() * this.roadSegments.length)];
            const vehicle = this.createVehicle(road);
            if (vehicle) {
                this.vehicles.push(vehicle);
                this.scene.add(vehicle.group);
                
                // Создаем NPC-водителя для машины
                const driverNPC = this.createDriverNPC(vehicle);
                if (driverNPC) {
                    vehicle.driverNPC = driverNPC;
                    this.npcs.push(driverNPC);
                    this.scene.add(driverNPC.group);
                }
            }
        }
    }

    createRoadNetwork() {
        this.roadSegments = [];
        this.roadIntersections = [];
        
        // Создаем перекрестки для машин
        for (let i = -4; i <= 4; i++) {
            for (let j = -4; j <= 4; j++) {
                this.roadIntersections.push({
                    x: i * 120,
                    z: j * 120,
                    id: `road_${i}_${j}`
                });
            }
        }
        
        // Горизонтальные дороги с двумя полосами
        for (let i = -4; i <= 4; i++) {
            const z = i * 120;
            for (let j = -4; j < 4; j++) {
                const startX = j * 120;
                const endX = (j + 1) * 120;
                
                // Правая полоса (движение вправо)
                this.roadSegments.push({
                    start: new THREE.Vector3(startX, 0, z - 3),
                    end: new THREE.Vector3(endX, 0, z - 3),
                    direction: new THREE.Vector3(1, 0, 0),
                    lane: 'right',
                    type: 'horizontal'
                });
                
                // Левая полоса (движение влево)
                this.roadSegments.push({
                    start: new THREE.Vector3(endX, 0, z + 3),
                    end: new THREE.Vector3(startX, 0, z + 3),
                    direction: new THREE.Vector3(-1, 0, 0),
                    lane: 'left',
                    type: 'horizontal'
                });
            }
        }
        
        // Вертикальные дороги с двумя полосами
        for (let i = -4; i <= 4; i++) {
            const x = i * 120;
            for (let j = -4; j < 4; j++) {
                const startZ = j * 120;
                const endZ = (j + 1) * 120;
                
                // Нижняя полоса (движение вниз)
                this.roadSegments.push({
                    start: new THREE.Vector3(x - 3, 0, startZ),
                    end: new THREE.Vector3(x - 3, 0, endZ),
                    direction: new THREE.Vector3(0, 0, 1),
                    lane: 'right',
                    type: 'vertical'
                });
                
                // Верхняя полоса (движение вверх)  
                this.roadSegments.push({
                    start: new THREE.Vector3(x + 3, 0, endZ),
                    end: new THREE.Vector3(x + 3, 0, startZ),
                    direction: new THREE.Vector3(0, 0, -1),
                    lane: 'left',
                    type: 'vertical'
                });
            }
        }
    }

    createVehicle(road) {
        const vehicleGroup = new THREE.Group();
        
        // Кузов (размеры: ширина 4, высота 1.5, длина 8 - по направлению движения)
        const bodyGeometry = new THREE.BoxGeometry(4, 1.5, 8);
        const vehicleColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x888888, 0x444444];
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: vehicleColors[Math.floor(Math.random() * vehicleColors.length)]
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.55;
        body.castShadow = true;
        vehicleGroup.add(body);
        
        // Окна
        const windowGeometry = new THREE.BoxGeometry(3.5, 1.2, 6);
        const windowMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x222244, 
            transparent: true, 
            opacity: 0.7 
        });
        const windows = new THREE.Mesh(windowGeometry, windowMaterial);
        windows.position.y = 2.4;
        vehicleGroup.add(windows);
        
        // Передние и задние фары
        const frontLightGeometry = new THREE.SphereGeometry(0.3);
        const frontLightMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x444444 });
        
        // Передние фары
        const frontLeftLight = new THREE.Mesh(frontLightGeometry, frontLightMaterial);
        frontLeftLight.position.set(1.2, 1.3, 4.2);
        vehicleGroup.add(frontLeftLight);
        
        const frontRightLight = new THREE.Mesh(frontLightGeometry, frontLightMaterial);
        frontRightLight.position.set(-1.2, 1.3, 4.2);
        vehicleGroup.add(frontRightLight);
        
        // Задние фары
        const backLightMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0x220000 });
        const backLeftLight = new THREE.Mesh(frontLightGeometry, backLightMaterial);
        backLeftLight.position.set(1.2, 1.3, -4.2);
        vehicleGroup.add(backLeftLight);
        
        const backRightLight = new THREE.Mesh(frontLightGeometry, backLightMaterial);
        backRightLight.position.set(-1.2, 1.3, -4.2);
        vehicleGroup.add(backRightLight);
        
        // Колёса (расположены правильно для движения вперед)
        const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.3);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
        
        const wheelPositions = [
            { x: 1.5, z: 2.8 }, { x: -1.5, z: 2.8 },   // Передние колеса
            { x: 1.5, z: -2.8 }, { x: -1.5, z: -2.8 } // Задние колеса
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos.x, 0.8, pos.z);
            wheel.rotation.z = Math.PI / 2; // Поворачиваем колесо на 90 градусов
            wheel.castShadow = true;
            vehicleGroup.add(wheel);
        });
        
        // Позиционирование на дороге
        const startPos = road.start.clone();
        // Убираем случайное смещение чтобы машины ехали по центру дороги
        startPos.y = 0; // Машина касается дороги колесами
        
        vehicleGroup.position.copy(startPos);
        
        // Поворачиваем машину передом по направлению движения
        const angle = Math.atan2(road.direction.x, road.direction.z);
        vehicleGroup.rotation.y = angle;
        
        return {
            group: vehicleGroup,
            roadSegment: road,
            target: road.end.clone(),
            speed: 0.15 + Math.random() * 0.1,
            waitTime: 0,
            turnCooldown: 0,
            currentDirection: road.direction.clone(),
            driverNPC: null, // NPC-водитель
            isPlayerDriven: false, // Управляется ли игроком
            health: 100 // Здоровье машины
        };
    }

    createPlayer() {
        // Создаём группу игрока (уменьшен в 3 раза)
        this.player = {
            group: new THREE.Group(),
            position: new THREE.Vector3(0, 0, 0),
            velocity: new THREE.Vector3(0, 0, 0),
            rotation: 0,
            speed: 0.3,
            jumpSpeed: 0.5,
            onGround: true,
            money: 1000,
            weapons: [],
            currentWeapon: null,
            health: 100
        };

        // Тело игрока (уменьшено в 3 раза)
        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.4);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.5;
        body.castShadow = true;
        this.player.group.add(body);

        // Голова игрока (уменьшена в 3 раза)
        const headGeometry = new THREE.SphereGeometry(0.3);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDBB7 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 2.4;
        head.castShadow = true;
        this.player.group.add(head);

        // Волосы игрока (уменьшены в 3 раза)
        const hairGeometry = new THREE.SphereGeometry(0.32);
        const hairMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.position.y = 2.5;
        hair.scale.set(1, 0.8, 1);
        hair.castShadow = true;
        this.player.group.add(hair);

        // Ноги (уменьшены в 3 раза)
        const legGeometry = new THREE.BoxGeometry(0.3, 1, 0.3);
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(0.2, 0.5, 0);
        leftLeg.castShadow = true;
        this.player.group.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(-0.2, 0.5, 0);
        rightLeg.castShadow = true;
        this.player.group.add(rightLeg);

        // Руки (уменьшены в 3 раза)
        const armGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
        const armMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDBB7 });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(0.5, 1.4, 0);
        leftArm.castShadow = true;
        this.player.group.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(-0.5, 1.4, 0);
        rightArm.castShadow = true;
        this.player.group.add(rightArm);

        // Обувь игрока (уменьшена в 3 раза)
        const shoeGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.6);
        const shoeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
        
        const leftShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        leftShoe.position.set(0.2, 0.1, 0.1);
        leftShoe.castShadow = true;
        this.player.group.add(leftShoe);
        
        const rightShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        rightShoe.position.set(-0.2, 0.1, 0.1);
        rightShoe.castShadow = true;
        this.player.group.add(rightShoe);

        // Позиционируем игрока
        this.player.group.position.copy(this.player.position);
        this.scene.add(this.player.group);

        console.log('Player created');
    }

    setupControls() {
        // Клавиатура
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            if (event.code === 'Space') {
                // Предотвращаем стандартное поведение (scroll)
                event.preventDefault();
                
                // Если в танке - не вызываем playerJump
                if (!this.drivingVehicle || !this.drivingVehicle.isTank) {
                    this.playerJump();
                }
            }
            
            if (event.code === 'KeyH') {
                // Показываем/скрываем инструкции
                const controlsHelp = document.getElementById('controlsHelp');
                if (controlsHelp) {
                    controlsHelp.classList.toggle('hidden');
                }
            }
            
            if (event.code === 'KeyV') {
                // Переключение между первым и третьим лицом
                this.firstPersonMode = !this.firstPersonMode;
                console.log('Camera mode:', this.firstPersonMode ? 'First Person' : 'Third Person');
            }
            
            if (event.code === 'KeyE') {
                // Проверяем взаимодействие с магазином оружия
                if (this.shopKeeperPosition && this.player.position.distanceTo(this.shopKeeperPosition) < 5) {
                    const shopDiv = document.getElementById('weaponShop');
                    if (shopDiv) {
                        if (shopDiv.style.display === 'none') {
                            shopDiv.style.display = 'block';
                            document.exitPointerLock();
                            this.isShopOpen = true;
                        } else {
                            this.closeShop();
                        }
                    }
                    return;
                }
                
                // Захват машины или выход из нее
                this.handleVehicleInteraction();
            }
            
            // Переключение оружия
            if (event.code === 'Digit1') this.equipWeapon('ak47');
            if (event.code === 'Digit2') this.equipWeapon('smg');
            if (event.code === 'Digit3') this.equipWeapon('rpg');
        });

        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });

        // Мышь для поворота камеры и стрельбы
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0) { // Левая кнопка мыши
                this.mouseDown = true;
                
                if (document.pointerLockElement === document.body) {
                    // Если в танке - стреляем из танка
                    if (this.drivingVehicle && this.drivingVehicle.isTank) {
                        console.log('Mouse click in tank - shooting');
                        this.tankPlayerShoot(this.drivingVehicle);
                    } else {
                        this.shootWeapon();
                    }
                } else if (event.target.tagName !== 'BUTTON' && event.target.closest('#weaponShop') === null) {
                    // Если клик не по кнопке магазина и не по магазину, захватываем курсор
                    document.body.requestPointerLock().catch(error => {
                        console.warn('Pointer lock request failed:', error);
                    });
                }
            }
        });
        
        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) {
                this.mouseDown = false;
            }
        });

        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === document.body) {
                this.mouseX -= event.movementX * 0.002;
                this.mouseY -= event.movementY * 0.002;
                
                // Ограничиваем вертикальный угол
                this.mouseY = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.mouseY));
            }
        });

        // Колесо мыши для зума или поворота башни танка
        document.addEventListener('wheel', (event) => {
            if (this.drivingVehicle && this.drivingVehicle.isTank) {
                // Если в танке - поворачиваем башню
                if (this.drivingVehicle.turret) {
                    // Инициализируем целевой угол, если его нет
                    if (this.drivingVehicle.turretTargetRotation === undefined) {
                        this.drivingVehicle.turretTargetRotation = this.drivingVehicle.turret.rotation.y;
                    }
                    this.drivingVehicle.turretTargetRotation -= event.deltaY * 0.005;
                }
            } else {
                // Иначе - зум камеры
                this.cameraDistance += event.deltaY * 0.01;
                this.cameraDistance = Math.max(10, Math.min(50, this.cameraDistance));
            }
        });

        console.log('Controls setup complete');
    }

    playerJump() {
        if (this.player && this.player.onGround) {
            this.player.velocity.y = this.player.jumpSpeed;
            this.player.onGround = false;
        }
    }

    handleVehicleInteraction() {
        if (!this.player) return;
        
        // Если игрок уже в машине - выходим из нее
        if (this.drivingVehicle) {
            this.exitVehicle();
            return;
        }
        
        // Ищем ближайшую машину в радиусе 3 метров
        let nearestVehicle = null;
        let minDistance = 3;
        
        for (let vehicle of this.vehicles) {
            const distance = this.player.position.distanceTo(vehicle.group.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestVehicle = vehicle;
            }
        }
        
        // Проверяем танки
        if (this.tanks) {
            for (let tank of this.tanks) {
                const distance = this.player.position.distanceTo(tank.group.position);
                if (distance < minDistance) {
                    // Можно войти только если водитель мертв
                    if (tank.driverDead) {
                        minDistance = distance;
                        nearestVehicle = tank;
                    }
                }
            }
        }
        
        if (nearestVehicle) {
            this.enterVehicle(nearestVehicle);
        }
    }

    enterVehicle(vehicle) {
        console.log('Входим в машину, isTank:', vehicle.isTank);
        
        // Выкидываем NPC-водителя, если он есть
        if (vehicle.driverNPC) {
            // Удаляем NPC из списка и сцены
            const npcIndex = this.npcs.indexOf(vehicle.driverNPC);
            if (npcIndex > -1) {
                this.npcs.splice(npcIndex, 1);
            }
            this.scene.remove(vehicle.driverNPC.group);
            vehicle.driverNPC = null;
        }
        
        // Сохраняем текущую позицию игрока
        this.playerExitPosition = this.player.position.clone();
        
        // Перемещаем игрока в машину (делаем невидимым)
        this.player.group.visible = false;
        this.player.inVehicle = true;
        
        // Скрываем оружие от первого лица, если оно есть
        if (this.player.fpWeaponMesh) {
            this.player.fpWeaponMesh.visible = false;
        }
        
        // Устанавливаем машину как управляемую игроком
        this.drivingVehicle = vehicle;
        vehicle.isPlayerDriven = true;
        vehicle.speed = 0; // Останавливаем машину
        
        // Убеждаемся, что машина видима
        if (vehicle.group) vehicle.group.visible = true;
        
        // Сбрасываем флаги остановки
        vehicle.stopped = false;
        vehicle.stoppedFor = null;
        
        console.log('Игрок теперь управляет машиной');
    }

    exitVehicle() {
        if (!this.drivingVehicle) return;
        
        console.log('Выходим из машины');
        
        // Возвращаем игрока на землю рядом с машиной
        const exitPosition = this.drivingVehicle.group.position.clone();
        exitPosition.x += 2; // Выходим сбоку
        exitPosition.y = 0;
        this.player.position.copy(exitPosition);
        this.player.group.position.copy(exitPosition);
        this.player.group.visible = true;
        this.player.inVehicle = false;
        
        // Показываем оружие от первого лица обратно
        if (this.player.fpWeaponMesh) {
            this.player.fpWeaponMesh.visible = true;
        }
        
        // Освобождаем машину
        this.drivingVehicle.isPlayerDriven = false;
        this.drivingVehicle.speed = 0; // Останавливаем машину
        this.drivingVehicle.isAbandoned = true; // Помечаем как брошенную, чтобы ИИ не перехватывал управление
        this.drivingVehicle = null;
        
        // Проверяем арест при выходе из машины (если полиция рядом)
        const policeNearby = this.policeCars.some(police => {
            if (!police || !police.group) return false;
            const distance = this.player.position.distanceTo(police.group.position);
            return distance < 20; // В радиусе 20 единиц
        });
        
        if (this.wantedLevel >= 1 && policeNearby) {
            this.arrestPlayer();
            return;
        }
        
        console.log('Игрок вышел из машины');
    }

    createDriverNPC(vehicle) {
        // Создаем NPC-водителя для машины
        const driverPath = {
            start: vehicle.group.position.clone(),
            end: vehicle.group.position.clone(),
            direction: new THREE.Vector3(1, 0, 0),
            isHorizontal: true
        };
        
        const driverNPC = this.createNPC(driverPath);
        if (driverNPC) {
            // Помещаем водителя внутрь машины
            driverNPC.group.position.copy(vehicle.group.position);
            driverNPC.group.position.y = 0.5; // Высота сиденья
            
            // Водитель не двигается
            driverNPC.state = 'idle';
            driverNPC.speed = 0;
            
            // Добавляем ссылку на машину
            driverNPC.vehicle = vehicle;
            
            return driverNPC;
        }
        return null;
    }

    updateVehicleControl() {
        if (!this.drivingVehicle) return;
        
        const vehicle = this.drivingVehicle;
        
        // Если это танк, используем управление танком
        if (vehicle.isTank) {
            this.updateTankControl(vehicle);
            return;
        }
        
        // Если машина сломана, не позволяем ей двигаться
        if (vehicle.isBroken) return;
        
        const deltaTime = 0.016;
        
        // Управление машиной
        let acceleration = 0;
        let turnAmount = 0;
        
        // Движение вперед/назад
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            acceleration = 1;
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            acceleration = -0.5; // Задний ход медленнее
        }
        
        // Поворот
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            turnAmount = 1;
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            turnAmount = -1;
        }
        
        // Ускоренный режим (Q + W)
        let boostMultiplier = 1;
        if ((this.keys['KeyW'] || this.keys['ArrowUp']) && this.keys['KeyQ']) {
            boostMultiplier = 2.5; // Ускорение в 2.5 раза
        }
        
        // Применяем ускорение
        const maxSpeed = 0.4 * boostMultiplier;
        const accelerationRate = 0.02;
        
        if (acceleration > 0) {
            vehicle.speed = Math.min(maxSpeed, vehicle.speed + accelerationRate);
        } else if (acceleration < 0) {
            vehicle.speed = Math.max(-0.2, vehicle.speed + acceleration * accelerationRate);
        } else {
            // Замедление при отсутствии газа
            vehicle.speed *= 0.95;
            if (Math.abs(vehicle.speed) < 0.01) vehicle.speed = 0;
        }
        
        // Поворот машины (свободный поворот независимо от скорости)
        const turnSpeed = 0.05; // Постоянная скорость поворота
        vehicle.group.rotation.y += turnAmount * turnSpeed;
        
        // Обновляем направление движения
        vehicle.currentDirection.set(
            Math.sin(vehicle.group.rotation.y),
            0,
            Math.cos(vehicle.group.rotation.y)
        );
        
        // Движение машины
        const moveVector = vehicle.currentDirection.clone().multiplyScalar(vehicle.speed);
        const newPosition = vehicle.group.position.clone().add(moveVector);
        
        // Проверяем столкновения со зданиями перед применением движения
        if (!this.checkVehicleBuildingCollisionsAtPosition(vehicle, newPosition)) {
            // Применяем движение только если нет столкновения
            vehicle.group.position.copy(newPosition);
            
            // Анимация колес
            const wheels = vehicle.group.children.filter(child => 
                child.geometry && child.geometry.type === 'CylinderGeometry'
            );
            wheels.forEach(wheel => {
                wheel.rotation.x += vehicle.speed * 3; // Вращение колес
            });
        } else {
            // При столкновении останавливаем машину
            vehicle.speed = 0;
            // Если скорость была высокой, можно нанести урон, но не убивать сразу
            if (Math.abs(vehicle.speed) > 0.5) {
                // Можно добавить звук удара или эффект
                console.log('Удар о здание!');
            }
        }
        
        // Проверяем границы карты
        this.finalizeVehicleUpdate(vehicle);
    }

    updateTankControl(tank) {
        console.log('updateTankControl called'); // Отладка
        
        // Управление движением (W/S)
        let acceleration = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) acceleration = 0.5;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) acceleration = -0.3;
        
        // Поворот корпуса (A/D) - танк может разворачиваться на месте
        let turnAmount = 0;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) turnAmount = 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) turnAmount = -1;
        
        // Применяем ускорение
        const maxSpeed = 0.15; // Танк медленный
        const accelerationRate = 0.005;
        
        if (acceleration > 0) {
            tank.speed = Math.min(maxSpeed, tank.speed + accelerationRate);
        } else if (acceleration < 0) {
            tank.speed = Math.max(-0.1, tank.speed + acceleration * accelerationRate);
        } else {
            tank.speed *= 0.9; // Быстрое торможение гусеницами
            if (Math.abs(tank.speed) < 0.001) tank.speed = 0;
        }
        
        // Поворот
        const turnSpeed = 0.03;
        tank.group.rotation.y += turnAmount * turnSpeed;
        
        // Обновляем направление
        tank.currentDirection.set(
            Math.sin(tank.group.rotation.y),
            0,
            Math.cos(tank.group.rotation.y)
        );
        
        // Движение
        const moveVector = tank.currentDirection.clone().multiplyScalar(tank.speed);
        const newPosition = tank.group.position.clone().add(moveVector);
        
        // Проверка столкновений (упрощенная для танка - он может давить машины, но не здания)
        if (!this.checkVehicleBuildingCollisionsAtPosition(tank, newPosition)) {
            tank.group.position.copy(newPosition);
        } else {
            tank.speed = 0;
        }
        
        // Стрельба (Пробел)
        if (this.keys['Space']) {
            console.log('Space detected, calling tankPlayerShoot');
            this.tankPlayerShoot(tank);
        }
        
        // Также проверяем левую кнопку мыши
        if (this.mouseDown) {
            console.log('Mouse detected in tank, calling tankPlayerShoot');
            this.tankPlayerShoot(tank);
        }

        // Плавный поворот башни
        if (tank.turret && tank.turretTargetRotation !== undefined) {
            const diff = tank.turretTargetRotation - tank.turret.rotation.y;
            if (Math.abs(diff) > 0.001) {
                tank.turret.rotation.y += diff * 0.1; // Плавная интерполяция
            } else {
                tank.turret.rotation.y = tank.turretTargetRotation;
            }
        }

        this.finalizeVehicleUpdate(tank);
    }

    tankPlayerShoot(tank) {
        const now = Date.now();
        const cooldown = 1000; // 1 секунда перезарядки (быстрее)
        
        if (tank.lastShot && now - tank.lastShot < cooldown) {
            // Показываем сообщение о перезарядке
            const reloadTime = ((cooldown - (now - tank.lastShot)) / 1000).toFixed(1);
            this.showGameMessage(`Перезарядка: ${reloadTime}с`);
            return; 
        }
        tank.lastShot = now;
        
        console.log('Player tank shoot! Creating realistic projectile...');
        this.showGameMessage('ВЫСТРЕЛ!');
        
        // Позиция выстрела
        const origin = tank.group.position.clone();
        origin.y += 2.8; // Высота башни
        
        // Направление (куда смотрит башня)
        let turretRotation = tank.group.rotation.y;
        if (tank.turret) {
            turretRotation += tank.turret.rotation.y;
        }
        
        const direction = new THREE.Vector3(
            Math.sin(turretRotation),
            0,
            Math.cos(turretRotation)
        );
        
        // Создаем реалистичный снаряд (Группа)
        const shellGroup = new THREE.Group();
        
        // Тело снаряда (цилиндр)
        const bodyGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        // Цилиндр по умолчанию ориентирован по Y, что нам и нужно для updateEntities
        shellGroup.add(body);
        
        // Наконечник (конус)
        const tipGeo = new THREE.ConeGeometry(0.08, 0.15);
        const tipMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.y = 0.325; // Сверху цилиндра
        shellGroup.add(tip);
        
        // Трассер (светящийся задник)
        const tracerGeo = new THREE.SphereGeometry(0.07);
        const tracerMat = new THREE.MeshBasicMaterial({ color: 0xFF5500 });
        const tracer = new THREE.Mesh(tracerGeo, tracerMat);
        tracer.position.y = -0.25;
        shellGroup.add(tracer);
        
        // Начальная позиция - на конце ствола
        const spawnPos = origin.clone().add(direction.clone().multiplyScalar(6.5));
        shellGroup.position.copy(spawnPos);
        
        // Ориентация снаряда (направляем ось Y по вектору стрельбы)
        shellGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        
        // Добавляем вертикальный угол для навесной стрельбы (немного вверх)
        const tiltAxis = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
        // shellGroup.rotateOnWorldAxis(tiltAxis, -0.05); // Чуть вверх
        
        // Начальная скорость с учетом подъема ствола
        const velocity = direction.clone().multiplyScalar(2.5);
        velocity.y += 0.1; // Небольшой подброс вверх для баллистики
        
        shellGroup.userData = {
            velocity: velocity,
            gravity: -0.015, // Гравитация для падения
            isRocket: true,
            isExplosive: true,
            explosionRadius: 10,
            damage: 1000,
            creationTime: now,
            fromPlayer: true,
            fromTank: true,
            owner: tank,
            hasTrail: true // Флаг для создания дымного следа
        };
        
        this.scene.add(shellGroup);
        if (!this.projectiles) this.projectiles = [];
        this.projectiles.push(shellGroup);
        
        // Эффект выстрела (вспышка)
        const flashGeo = new THREE.SphereGeometry(0.8);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xFFAA00, transparent: true, opacity: 0.8 });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(spawnPos);
        this.scene.add(flash);
        setTimeout(() => this.scene.remove(flash), 80);
        
        // Дым от выстрела
        this.createSmokePuff(spawnPos, 1.5);
        
        // Отдача танка
        const recoil = direction.clone().multiplyScalar(-0.3);
        tank.group.position.add(recoil);
        
        console.log('Realistic tank shell fired');
    }

    createSmokePuff(position, size = 1) {
        const smokeGeo = new THREE.SphereGeometry(size * 0.5);
        const smokeMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.6 });
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        smoke.position.copy(position);
        
        // Случайное смещение
        smoke.position.x += (Math.random() - 0.5) * 0.5;
        smoke.position.y += (Math.random() - 0.5) * 0.5;
        smoke.position.z += (Math.random() - 0.5) * 0.5;
        
        this.scene.add(smoke);
        
        // Анимация дыма
        let opacity = 0.6;
        let scale = 1;
        
        const animateSmoke = () => {
            opacity -= 0.02;
            scale += 0.05;
            
            if (opacity <= 0) {
                this.scene.remove(smoke);
                return;
            }
            
            smoke.material.opacity = opacity;
            smoke.scale.setScalar(scale);
            smoke.position.y += 0.05; // Дым поднимается
            
            requestAnimationFrame(animateSmoke);
        };
        
        animateSmoke();
    }

    showGameMessage(text) {
        let msgDiv = document.getElementById('gameMessage');
        if (!msgDiv) {
            msgDiv = document.createElement('div');
            msgDiv.id = 'gameMessage';
            msgDiv.style.position = 'fixed';
            msgDiv.style.top = '20%';
            msgDiv.style.left = '50%';
            msgDiv.style.transform = 'translate(-50%, -50%)';
            msgDiv.style.color = 'yellow';
            msgDiv.style.fontSize = '24px';
            msgDiv.style.fontWeight = 'bold';
            msgDiv.style.textShadow = '2px 2px 0 #000';
            msgDiv.style.pointerEvents = 'none';
            msgDiv.style.zIndex = '1000';
            document.body.appendChild(msgDiv);
        }
        
        msgDiv.textContent = text;
        msgDiv.style.opacity = '1';
        
        // Скрываем через время
        if (this.messageTimeout) clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            msgDiv.style.opacity = '0';
        }, 1000);
    }

    finalizeVehicleUpdate(vehicle) {
        const cityBounds = 500;
        if (Math.abs(vehicle.group.position.x) > cityBounds || 
            Math.abs(vehicle.group.position.z) > cityBounds) {
            // Возвращаем машину в центр
            vehicle.group.position.x = Math.max(-cityBounds + 10, Math.min(cityBounds - 10, vehicle.group.position.x));
            vehicle.group.position.z = Math.max(-cityBounds + 10, Math.min(cityBounds - 10, vehicle.group.position.z));
        }
        
        // Проверяем столкновения с NPC (сбиваем их)
        this.checkVehicleNPCCollisions(vehicle);
        
        // Проверяем столкновения с другими машинами
        this.checkVehicleVehicleCollisions(vehicle);
        
        // Обновляем камеру для машины
        this.updateVehicleCamera();
    }

    updateVehicleCamera() {
        if (!this.drivingVehicle) return;
        
        const vehicle = this.drivingVehicle;
        
        // Вид строго сзади машины
        let offset = new THREE.Vector3(0, 5, -12);
        if (vehicle.isTank) {
             offset = new THREE.Vector3(0, 8, -18); // Выше и дальше для танка
        }
        
        const cameraOffset = offset.clone();
        cameraOffset.applyQuaternion(vehicle.group.quaternion);
        this.camera.position.copy(vehicle.group.position).add(cameraOffset);
        this.camera.lookAt(vehicle.group.position);
    }

    checkVehicleNPCCollisions(vehicle) {
        if (!this.npcs || this.npcs.length === 0) return;
        
        // Создаем bounding box для машины
        const vehicleBox = new THREE.Box3().setFromObject(vehicle.group);
        vehicleBox.expandByVector(new THREE.Vector3(0.5, 0.5, 0.5)); // Увеличиваем для лучшего обнаружения
        
        for (let i = this.npcs.length - 1; i >= 0; i--) {
            const npc = this.npcs[i];
            if (!npc || !npc.group || npc.state === 'dead') continue;
            
            // Создаем bounding box для NPC
            const npcBox = new THREE.Box3().setFromObject(npc.group);
            npcBox.expandByVector(new THREE.Vector3(0.25, 0.5, 0.25));
            
            // Проверяем столкновение
            if (vehicleBox.intersectsBox(npcBox)) {
                this.killNPCByVehicle(npc, vehicle);
            }
        }
    }

    killNPC(npc) {
        if (npc.state === 'dead') return;
        
        console.log('NPC убит!');
        npc.state = 'dead';
        
        // Опрокидываем NPC
        npc.group.rotation.x = -Math.PI / 2;
        npc.group.position.y = 0.2;
        
        // Увеличиваем уровень розыска
        this.increaseWantedLevel();
        
        // Удаляем через время
        setTimeout(() => {
            const index = this.npcs.indexOf(npc);
            if (index > -1) {
                this.npcs.splice(index, 1);
                this.scene.remove(npc.group);
            }
        }, 30000);
    }

    killNPCByVehicle(npc, vehicle) {
        console.log('Машина сбила NPC!');
        
        // Меняем состояние NPC на мертвого
        npc.state = 'dead';
        
        // Останавливаем все анимации
        if (npc.walkingAnimation) {
            const { leftLeg, rightLeg, leftArm, rightArm, leftHand, rightHand, leftShoe, rightShoe } = npc.walkingAnimation;
            if (leftLeg) leftLeg.rotation.x = 0;
            if (rightLeg) rightLeg.rotation.x = 0;
            if (leftArm) leftArm.rotation.x = 0;
            if (rightArm) rightArm.rotation.x = 0;
            if (leftHand) leftHand.rotation.x = 0;
            if (rightHand) rightHand.rotation.x = 0;
            if (leftShoe) leftShoe.rotation.x = 0;
            if (rightShoe) rightShoe.rotation.x = 0;
        }
        
        // Добавляем эффект "падения" - NPC падает на землю
        npc.group.position.y = 0.1; // Немного приподнимаем над землей
        npc.group.rotation.z = Math.PI / 2; // Поворачиваем на бок
        npc.group.rotation.x = Math.PI / 4; // Немного наклоняем
        
        // Меняем цвет тела на более бледный (эффект смерти)
        npc.group.traverse((child) => {
            if (child.isMesh && child.material) {
                if (child.material.color) {
                    child.material.color.setHex(0x888888); // Серый цвет для трупа
                }
            }
        });
        
        // Удаляем NPC из списка через некоторое время (чтобы труп остался лежать)
        setTimeout(() => {
            const index = this.npcs.indexOf(npc);
            if (index > -1) {
                this.npcs.splice(index, 1);
                this.scene.remove(npc.group);
            }
        }, 30000); // Труп лежит 30 секунд
        
        // Добавляем небольшой эффект толчка машине
        const pushDirection = new THREE.Vector3().subVectors(vehicle.group.position, npc.group.position).normalize();
        vehicle.group.position.add(pushDirection.multiplyScalar(0.5));
        
        // Увеличиваем уровень розыска
        this.increaseWantedLevel();
    }

    checkVehicleVehicleCollisions(vehicle) {
        if (!this.vehicles || this.vehicles.length <= 1) return;
        
        // Создаем bounding box для текущей машины
        const vehicleBox = new THREE.Box3().setFromObject(vehicle.group);
        vehicleBox.expandByVector(new THREE.Vector3(0.5, 0.5, 0.5));
        
        for (let otherVehicle of this.vehicles) {
            if (otherVehicle === vehicle || !otherVehicle.group) continue;
            
            // Создаем bounding box для другой машины
            const otherBox = new THREE.Box3().setFromObject(otherVehicle.group);
            otherBox.expandByVector(new THREE.Vector3(0.5, 0.5, 0.5));
            
            // Проверяем столкновение
            if (vehicleBox.intersectsBox(otherBox)) {
                // Особая логика для танков
                if (vehicle.isTank && !otherVehicle.isTank) {
                    // Танк давит машину
                    console.log('Танк раздавил машину!');
                    this.breakVehicle(otherVehicle);
                    // Танк не получает повреждений, только замедляется
                    vehicle.speed *= 0.5;
                } else if (!vehicle.isTank && otherVehicle.isTank) {
                    // Машина врезалась в танк
                    console.log('Машина врезалась в танк!');
                    this.breakVehicle(vehicle);
                } else {
                    // Обычное столкновение (машина-машина или танк-танк)
                    this.handleVehicleCrash(vehicle, otherVehicle);
                }
                break; // Выходим после первого столкновения
            }
        }
    }

    checkVehicleBuildingCollisions(vehicle) {
        if (!this.buildings || this.buildings.length === 0) return;
        
        // Создаем bounding box для машины
        const vehicleBox = new THREE.Box3().setFromObject(vehicle.group);
        vehicleBox.expandByVector(new THREE.Vector3(0.3, 0.3, 0.3));
        
        for (let building of this.buildings) {
            if (!building || !building.group) continue;
            
            // Создаем bounding box для здания
            const buildingBox = new THREE.Box3().setFromObject(building.group);
            
            // Проверяем столкновение
            if (vehicleBox.intersectsBox(buildingBox)) {
                this.handleBuildingCrash(vehicle);
                break;
            }
        }
    }

    checkVehicleBuildingCollisionsAtPosition(vehicle, position) {
        if (!this.buildings || this.buildings.length === 0) return false;
        
        // Создаем bounding box для машины в новой позиции
        const vehicleBox = new THREE.Box3().setFromObject(vehicle.group);
        vehicleBox.translate(position.clone().sub(vehicle.group.position)); // Смещаем bounding box к новой позиции
        vehicleBox.expandByVector(new THREE.Vector3(0.3, 0.3, 0.3));
        
        for (let building of this.buildings) {
            if (!building || !building.group) continue;
            
            // Создаем bounding box для здания
            const buildingBox = new THREE.Box3().setFromObject(building.group);
            // Добавляем плотность - расширяем bounding box здания
            buildingBox.expandByScalar(0.5);
            
            // Проверяем столкновение
            if (vehicleBox.intersectsBox(buildingBox)) {
                return true; // Есть столкновение
            }
        }
        
        return false; // Нет столкновения
    }

    handleVehicleCrash(vehicle1, vehicle2) {
        console.log('Столкновение между машинами!');
        
        // Ломаем обе машины
        this.breakVehicle(vehicle1);
        this.breakVehicle(vehicle2);
        
        // Добавляем эффект толчка
        const crashDirection = new THREE.Vector3().subVectors(vehicle1.group.position, vehicle2.group.position).normalize();
        vehicle1.group.position.add(crashDirection.multiplyScalar(1.0));
        vehicle2.group.position.add(crashDirection.multiplyScalar(-1.0));
        
        // Останавливаем обе машины
        vehicle1.speed = 0;
        vehicle2.speed = 0;
    }

    handleBuildingCrash(vehicle) {
        console.log('Машина врезалась в здание!');
        
        // Ломаем машину
        this.breakVehicle(vehicle);
        
        // Игрок отлетает и умирает
        this.killPlayerFromVehicleCrash(vehicle);
    }

    breakVehicle(vehicle) {
        // Эффект поломки машины
        vehicle.isBroken = true;
        vehicle.speed = 0;
        
        // Меняем цвет машины на поврежденный
        vehicle.group.traverse((child) => {
            if (child.isMesh && child.material && child.material.color) {
                child.material.color.setHex(0x444444); // Темно-серый цвет для сломанной машины
            }
        });
        
        // Добавляем эффект дыма/повреждений (просто поворачиваем машину)
        vehicle.group.rotation.z += Math.PI / 6; // Немного наклоняем
        vehicle.group.rotation.x += Math.PI / 12;
        
        // Через некоторое время машина исчезает
        setTimeout(() => {
            if (vehicle.group && vehicle.group.parent) {
                vehicle.group.parent.remove(vehicle.group);
            }
            const index = this.vehicles.indexOf(vehicle);
            if (index > -1) {
                this.vehicles.splice(index, 1);
            }
        }, 10000); // Машина исчезает через 10 секунд
    }

    killPlayerFromVehicleCrash(vehicle) {
        if (!this.drivingVehicle || this.drivingVehicle !== vehicle) return;
        
        console.log('Игрок погиб в аварии!');
        
        // Выкидываем игрока из машины с эффектом отлета
        const crashDirection = vehicle.currentDirection.clone().multiplyScalar(-2);
        crashDirection.y = 1; // Добавляем вертикальную компоненту для отлета
        
        this.player.position.copy(vehicle.group.position).add(crashDirection);
        this.player.velocity.set(crashDirection.x, crashDirection.y, crashDirection.z);
        this.player.onGround = false;
        
        // Игрок умирает
        this.player.isDead = true;
        this.player.group.visible = false;
        
        // Выходим из машины
        this.drivingVehicle = null;
        
        // Через 3 секунды респавним игрока
        setTimeout(() => {
            this.respawnPlayer();
        }, 3000);
    }

    respawnPlayer() {
        console.log('Респавн игрока');
        
        // Возвращаем игрока к жизни
        this.player.isDead = false;
        this.player.group.visible = true;
        this.player.position.set(0, 0, 0);
        this.player.velocity.set(0, 0, 0);
        this.player.onGround = true;
        
        // Сбрасываем камеру
        this.firstPersonMode = false;
    }

    increaseWantedLevel() {
        if (this.wantedLevel < 5) {
            this.wantedLevel++;
            console.log(`Уровень розыска повышен до ${this.wantedLevel} звезд!`);
            this.updateWantedDisplay();
            this.spawnPolice();
        }
    }

    updateWantedDisplay() {
        const wantedElement = document.getElementById('wantedLevel');
        if (wantedElement) {
            let stars = '';
            for (let i = 0; i < 5; i++) {
                stars += i < this.wantedLevel ? '★' : '☆';
            }
            wantedElement.textContent = stars;
        }
    }

    spawnPolice() {
        // Очищаем старых полицейских
        this.clearPolice();
        
        if (this.wantedLevel >= 1 && this.wantedLevel <= 3) {
            // Спавним одну полицейскую машину при любом уровне розыска
            const policeCount = 1;
            
            for (let i = 0; i < policeCount; i++) {
                const policeCar = this.createPoliceCar();
                if (policeCar) {
                    this.policeCars.push(policeCar);
                    this.vehicles.push(policeCar);
                }
            }
        } else if (this.wantedLevel >= 4) {
            // Спавним танки
            const tankCount = this.wantedLevel - 3; // 1 танк на 4 звезды, 2 танка на 5 звезд
            
            for (let i = 0; i < tankCount; i++) {
                const tank = this.createTank();
                if (tank) {
                    this.tanks.push(tank);
                }
            }
        }
    }

    createPoliceCar() {
        const vehicleGroup = new THREE.Group();
        
        // Кузов (синий цвет для полиции - как обычная машина, но синяя)
        const bodyGeometry = new THREE.BoxGeometry(4, 1.5, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x000080 }); // Темно-синий
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.55;
        body.castShadow = true;
        vehicleGroup.add(body);
        
        // Окна
        const windowGeometry = new THREE.BoxGeometry(3.5, 1.2, 6);
        const windowMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x222244, 
            transparent: true, 
            opacity: 0.7 
        });
        const windows = new THREE.Mesh(windowGeometry, windowMaterial);
        windows.position.y = 2.4;
        vehicleGroup.add(windows);
        
        // Передние и задние фары
        const frontLightGeometry = new THREE.SphereGeometry(0.3);
        const frontLightMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x444444 });
        
        // Передние фары
        const frontLeftLight = new THREE.Mesh(frontLightGeometry, frontLightMaterial);
        frontLeftLight.position.set(1.2, 1.3, 4.2);
        vehicleGroup.add(frontLeftLight);
        
        const frontRightLight = new THREE.Mesh(frontLightGeometry, frontLightMaterial);
        frontRightLight.position.set(-1.2, 1.3, 4.2);
        vehicleGroup.add(frontRightLight);
        
        // Задние фары
        const backLightMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0x220000 });
        const backLeftLight = new THREE.Mesh(frontLightGeometry, backLightMaterial);
        backLeftLight.position.set(1.2, 1.3, -4.2);
        vehicleGroup.add(backLeftLight);
        
        const backRightLight = new THREE.Mesh(frontLightGeometry, backLightMaterial);
        backRightLight.position.set(-1.2, 1.3, -4.2);
        vehicleGroup.add(backRightLight);
        
        // Колёса (как у обычных машин)
        const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.3);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
        
        const wheelPositions = [
            { x: 1.5, z: 2.8 }, { x: -1.5, z: 2.8 },   // Передние колеса
            { x: 1.5, z: -2.8 }, { x: -1.5, z: -2.8 } // Задние колеса
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos.x, 0.8, pos.z);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            vehicleGroup.add(wheel);
        });
        
        // Мигалки на крыше (добавляем к обычной машине)
        const lightbarGeometry = new THREE.BoxGeometry(3, 0.3, 0.8);
        const redLightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFF0000,
            emissive: 0x880000
        });
        const blueLightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x0000FF,
            emissive: 0x000088
        });
        
        const redLight = new THREE.Mesh(lightbarGeometry, redLightMaterial);
        redLight.position.set(-0.75, 3.1, 0);
        vehicleGroup.add(redLight);
        
        const blueLight = new THREE.Mesh(lightbarGeometry, blueLightMaterial);
        blueLight.position.set(0.75, 3.1, 0);
        vehicleGroup.add(blueLight);
        
        // Спавним машину недалеко от игрока
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 10; // Еще ближе к игроку
        vehicleGroup.position.set(
            this.player.position.x + Math.cos(angle) * distance,
            0,
            this.player.position.z + Math.sin(angle) * distance
        );
        
        // Добавляем к сцене
        this.scene.add(vehicleGroup);
        
        return {
            group: vehicleGroup,
            redLight: redLight,
            blueLight: blueLight,
            lightTimer: 0,
            speed: 0.3 + Math.random() * 0.2, // Полиция ездит быстрее
            currentDirection: new THREE.Vector3(0, 0, 1),
            target: this.player.position.clone(),
            isPolice: true,
            isPlayerDriven: false,
            isBroken: false
        };
    }

    createTank() {
        // Создаем детализированный танк
        const tankGroup = new THREE.Group();
        
        // Материалы
        const darkGreen = new THREE.MeshLambertMaterial({ color: 0x1a3300 }); // Темно-зеленый
        const lightGreen = new THREE.MeshLambertMaterial({ color: 0x336600 }); // Светло-зеленый
        const blackMetal = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Черный металл
        const greyMetal = new THREE.MeshLambertMaterial({ color: 0x444444 }); // Серый металл
        
        // Основной корпус (нижняя часть)
        const chassisGeometry = new THREE.BoxGeometry(4.8, 1.5, 7.5);
        const chassis = new THREE.Mesh(chassisGeometry, darkGreen);
        chassis.position.y = 1.2;
        chassis.castShadow = true;
        tankGroup.add(chassis);
        
        // Верхняя часть корпуса (наклонная)
        const upperHullGeometry = new THREE.BoxGeometry(4.8, 0.8, 6);
        const upperHull = new THREE.Mesh(upperHullGeometry, lightGreen);
        upperHull.position.y = 2.35;
        upperHull.castShadow = true;
        tankGroup.add(upperHull);
        
        // Детали корпуса (люки, решетки)
        const hatchGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.1, 8);
        const hatch = new THREE.Mesh(hatchGeometry, greyMetal);
        hatch.position.set(1.2, 2.8, 1.5);
        tankGroup.add(hatch);
        
        const ventGeometry = new THREE.BoxGeometry(2, 0.1, 1.5);
        const vent = new THREE.Mesh(ventGeometry, blackMetal);
        vent.position.set(0, 2.8, -1.5);
        tankGroup.add(vent);
        
        // Башня
        const turretGroup = new THREE.Group();
        turretGroup.position.y = 2.8;
        tankGroup.add(turretGroup);
        
        // Основа башни
        const turretBaseGeometry = new THREE.BoxGeometry(3, 1.2, 4);
        const turretBase = new THREE.Mesh(turretBaseGeometry, lightGreen);
        turretBase.position.y = 0.6;
        turretBase.castShadow = true;
        turretGroup.add(turretBase);
        
        // Командирская башенка
        const cupolaGeometry = new THREE.CylinderGeometry(0.5, 0.6, 0.5, 8);
        const cupola = new THREE.Mesh(cupolaGeometry, darkGreen);
        cupola.position.set(0.8, 1.4, 0.5);
        turretGroup.add(cupola);
        
        // Антенна
        const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3);
        const antenna = new THREE.Mesh(antennaGeometry, blackMetal);
        antenna.position.set(-1, 2.5, -1.5);
        turretGroup.add(antenna);
        
        // Пушка
        const gunGroup = new THREE.Group();
        gunGroup.position.set(0, 0.6, 2); // Крепление пушки спереди башни
        turretGroup.add(gunGroup);
        
        // Ствол
        const barrelGeometry = new THREE.CylinderGeometry(0.25, 0.3, 5);
        const barrel = new THREE.Mesh(barrelGeometry, greyMetal);
        barrel.rotation.x = -Math.PI / 2; // Направлен вперед по Z
        barrel.position.z = 2.5;
        gunGroup.add(barrel);
        
        // Дульный тормоз
        const muzzleBrakeGeometry = new THREE.BoxGeometry(0.8, 0.4, 0.6);
        const muzzleBrake = new THREE.Mesh(muzzleBrakeGeometry, blackMetal);
        muzzleBrake.position.z = 5;
        gunGroup.add(muzzleBrake);
        
        // Маска пушки (утолщение у основания)
        const mantletGeometry = new THREE.BoxGeometry(1, 1, 1);
        const mantlet = new THREE.Mesh(mantletGeometry, darkGreen);
        mantlet.position.z = 0;
        gunGroup.add(mantlet);
        
        // Гусеницы
        const trackGeometry = new THREE.BoxGeometry(0.8, 1.2, 7.8);
        
        const leftTrack = new THREE.Mesh(trackGeometry, blackMetal);
        leftTrack.position.set(-2.6, 0.6, 0);
        tankGroup.add(leftTrack);
        
        const rightTrack = new THREE.Mesh(trackGeometry, blackMetal);
        rightTrack.position.set(2.6, 0.6, 0);
        tankGroup.add(rightTrack);
        
        // Колеса внутри гусениц (декорация)
        const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.9, 12);
        const wheelPositions = [-3, -1.5, 0, 1.5, 3];
        
        wheelPositions.forEach(z => {
            // Левые колеса
            const lWheel = new THREE.Mesh(wheelGeometry, greyMetal);
            lWheel.rotation.z = Math.PI / 2;
            lWheel.position.set(-2.6, 0.5, z);
            tankGroup.add(lWheel);
            
            // Правые колеса
            const rWheel = new THREE.Mesh(wheelGeometry, greyMetal);
            rWheel.rotation.z = Math.PI / 2;
            rWheel.position.set(2.6, 0.5, z);
            tankGroup.add(rWheel);
        });
        
        // Спавним танк недалеко от игрока
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 20;
        tankGroup.position.set(
            this.player.position.x + Math.cos(angle) * distance,
            0,
            this.player.position.z + Math.sin(angle) * distance
        );
        
        // Добавляем к сцене
        this.scene.add(tankGroup);
        
        return {
            group: tankGroup,
            turret: turretGroup, // Ссылка на башню для поворота
            gun: gunGroup, // Ссылка на пушку
            speed: 0.12, // Танки медленные
            currentDirection: new THREE.Vector3(0, 0, 1),
            target: this.player.position.clone(),
            lastShot: 0,
            isTank: true
        };
    }

    clearPolice() {
        // Удаляем полицейские машины
        this.policeCars.forEach(police => {
            if (police === this.drivingVehicle) return; // Не удаляем машину игрока
            if (police.group && police.group.parent) {
                police.group.parent.remove(police.group);
            }
        });
        // Оставляем только машину игрока
        this.policeCars = this.policeCars.filter(p => p === this.drivingVehicle);
        
        // Удаляем танки
        this.tanks.forEach(tank => {
            if (tank === this.drivingVehicle) return; // Не удаляем танк игрока
            if (tank.group && tank.group.parent) {
                tank.group.parent.remove(tank.group);
            }
        });
        // Оставляем только танк игрока
        this.tanks = this.tanks.filter(t => t === this.drivingVehicle);
    }

    updatePolice() {
        // Обновляем полицейские машины
        this.policeCars.forEach(police => {
            if (!police || !police.group || police.isBroken) return;
            
            // Анимация мигалок
            police.lightTimer += 0.1;
            const lightIntensity = Math.sin(police.lightTimer) > 0 ? 1 : 0.3;
            
            if (police.redLight && police.blueLight) {
                police.redLight.material.emissive.setHex(lightIntensity > 0.5 ? 0x880000 : 0x220000);
                police.blueLight.material.emissive.setHex(lightIntensity > 0.5 ? 0x000088 : 0x000022);
            }
            
            // Преследуем игрока или его машину - умное преследование
            const targetPosition = this.drivingVehicle ? this.drivingVehicle.group.position : this.player.position;
            const direction = new THREE.Vector3().subVectors(targetPosition, police.group.position);
            const distance = direction.length();
            
            // Всегда поворачиваемся к цели для преследования
            const targetAngle = Math.atan2(direction.x, direction.z);
            police.group.rotation.y = targetAngle;
            
            police.currentDirection.set(
                Math.sin(targetAngle),
                0,
                Math.cos(targetAngle)
            );
            
            // Проверяем столкновения с NPC перед движением
            let canMove = true;
            if (this.npcs && this.npcs.length > 0) {
                const vehicleBox = new THREE.Box3().setFromObject(police.group);
                vehicleBox.expandByVector(new THREE.Vector3(0.5, 0.5, 0.5));
                
                for (let npc of this.npcs) {
                    if (!npc || !npc.group || npc.state === 'dead') continue;
                    
                    const npcBox = new THREE.Box3().setFromObject(npc.group);
                    npcBox.expandByVector(new THREE.Vector3(0.25, 0.5, 0.25));
                    
                    if (vehicleBox.intersectsBox(npcBox)) {
                        canMove = false;
                        break;
                    }
                }
            }
            
            // Проверяем столкновения со зданиями
            if (canMove && this.buildings && this.buildings.length > 0) {
                const vehicleBox = new THREE.Box3().setFromObject(police.group);
                vehicleBox.expandByVector(new THREE.Vector3(0.5, 0.5, 0.5));
                
                for (let building of this.buildings) {
                    if (!building || !building.group) continue;
                    
                    building.group.updateMatrixWorld();
                    const buildingBox = new THREE.Box3().setFromObject(building.group);
                    buildingBox.expandByScalar(0.5);
                    
                    if (vehicleBox.intersectsBox(buildingBox)) {
                        canMove = false;
                        break;
                    }
                }
            }
            
            if (distance > 6 && canMove) { // Подъезжаем не ближе 6 метров (примерно 3 метра зазора)
                // Двигаемся к цели быстрее обычных машин
                const moveVector = police.currentDirection.clone().multiplyScalar(police.speed * 1.5); // 50% быстрее
                police.group.position.add(moveVector);
                
                // Анимация колес
                const wheels = police.group.children.filter(child => 
                    child.geometry && child.geometry.type === 'CylinderGeometry'
                );
                wheels.forEach(wheel => {
                    wheel.rotation.x += police.speed * 4; // Быстрее вращаем колеса
                });
            } else if (!canMove) {
                // Останавливаемся перед препятствиями
                police.speed = 0;
            } else {
                // Когда подъехали на дистанцию атаки
                // Останавливаемся и поворачиваемся лицом к цели
                police.group.lookAt(targetPosition);
            }
        });
        
        // Обновляем танки
        this.tanks.forEach(tank => {
            if (!tank || !tank.group) return;
            
            // Если танк брошен игроком или водитель мертв - он не должен действовать
            if (tank.isAbandoned || tank.driverDead) return;
            
            // Преследуем цель (игрока или его машину)
            const targetPosition = this.drivingVehicle ? this.drivingVehicle.group.position : this.player.position;
            const direction = new THREE.Vector3().subVectors(targetPosition, tank.group.position);
            const distance = direction.length();
            
            if (distance > 8) { // Держим дистанцию (танк большой, 8 единиц это около 3-4 метров зазора)
                direction.normalize();
                
                // Поворачиваем корпус танка к цели (езда прямо на цель)
                const targetAngle = Math.atan2(direction.x, direction.z);
                tank.group.rotation.y = targetAngle;
                
                tank.currentDirection.set(
                    Math.sin(targetAngle),
                    0,
                    Math.cos(targetAngle)
                );
                
                // Проверяем столкновения со зданиями
                let canMove = true;
                if (this.buildings && this.buildings.length > 0) {
                    const vehicleBox = new THREE.Box3().setFromObject(tank.group);
                    vehicleBox.expandByVector(new THREE.Vector3(0.5, 0.5, 0.5));
                    
                    for (let building of this.buildings) {
                        if (!building || !building.group) continue;
                        
                        building.group.updateMatrixWorld();
                        const buildingBox = new THREE.Box3().setFromObject(building.group);
                        buildingBox.expandByScalar(0.5);
                        
                        if (vehicleBox.intersectsBox(buildingBox)) {
                            canMove = false;
                            break;
                        }
                    }
                }
                
                if (canMove) {
                    // Двигаемся к цели
                    const moveVector = tank.currentDirection.clone().multiplyScalar(tank.speed);
                    tank.group.position.add(moveVector);
                }
            }
            
            // Поворот башни на цель (всегда, даже если стоим)
            // Но не поворачиваем башню, если это танк игрока (игрок управляет колесиком)
            if (tank.turret && tank !== this.drivingVehicle) {
                const targetAngle = Math.atan2(targetPosition.x - tank.group.position.x, targetPosition.z - tank.group.position.z);
                // Вычисляем локальный угол поворота башни (относительно корпуса)
                let localAngle = targetAngle - tank.group.rotation.y;
                
                // Нормализуем угол
                while (localAngle > Math.PI) localAngle -= Math.PI * 2;
                while (localAngle < -Math.PI) localAngle += Math.PI * 2;
                
                // Плавный поворот башни
                const rotateSpeed = 0.05;
                if (tank.turret.rotation.y < localAngle) tank.turret.rotation.y += rotateSpeed;
                if (tank.turret.rotation.y > localAngle) tank.turret.rotation.y -= rotateSpeed;
                
                // Если разница небольшая, фиксируем
                if (Math.abs(tank.turret.rotation.y - localAngle) < rotateSpeed) {
                    tank.turret.rotation.y = localAngle;
                }
            }
            
            // Стреляем в цель
            const now = Date.now();
            if (now - tank.lastShot > 2000 && distance < 50) { // Стреляем если цель близко
                this.tankShoot(tank);
                tank.lastShot = now;
            }
        });
    }

    tankShoot(tank) {
        console.log('Танк стреляет!');
        
        // Создаем снаряд
        const bulletGeometry = new THREE.SphereGeometry(0.2);
        const bulletMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Позиция выстрела (из дула пушки)
        bullet.position.copy(tank.group.position);
        bullet.position.y = 3; // Высота башни
        
        // Направление выстрела - учитываем поворот башни
        const turretRotation = tank.turret ? tank.turret.rotation.y + tank.group.rotation.y : tank.group.rotation.y;
        const bulletDirection = new THREE.Vector3(
            Math.sin(turretRotation),
            0,
            Math.cos(turretRotation)
        );
        
        bullet.position.add(bulletDirection.clone().multiplyScalar(4)); // Смещение от дула пушки
        
        bullet.userData = {
            direction: bulletDirection,
            speed: 2,
            isBullet: true,
            damage: 100, // Один выстрел уничтожает машину
            fromAI: true // Снаряд от ИИ танка
        };
        
        this.scene.add(bullet);
        
        // Анимируем снаряд
        const animateBullet = () => {
            bullet.position.add(bulletDirection.clone().multiplyScalar(bullet.userData.speed));
            
            // Проверяем столкновение с игроком или его машиной
            if (this.drivingVehicle) {
                // Столкновение с машиной игрока
                const vehicleBox = new THREE.Box3().setFromObject(this.drivingVehicle.group);
                if (vehicleBox.containsPoint(bullet.position)) {
                    // Если игрок в танке и снаряд от ИИ, игнорируем урон
                    if (!(this.drivingVehicle.isTank && bullet.userData.fromAI)) {
                        this.handleTankHit(this.drivingVehicle);
                    }
                    this.scene.remove(bullet);
                    return;
                }
            } else {
                // Столкновение с игроком пешком
                const playerBox = new THREE.Box3(
                    new THREE.Vector3(this.player.position.x - 0.5, this.player.position.y, this.player.position.z - 0.5),
                    new THREE.Vector3(this.player.position.x + 0.5, this.player.position.y + 2, this.player.position.z + 0.5)
                );
                if (playerBox.containsPoint(bullet.position)) {
                    // Не убиваем игрока снарядом ИИ танка если он не в машине
                    if (!bullet.userData.fromAI) {
                        this.killPlayerFromTank();
                    }
                    this.scene.remove(bullet);
                    return;
                }
            }
            
            // Удаляем снаряд если он улетел слишком далеко
            const distance = bullet.position.distanceTo(tank.group.position);
            if (distance > 200) {
                this.scene.remove(bullet);
                return;
            }
            
            requestAnimationFrame(animateBullet);
        };
        
        animateBullet();
    }

    handleTankHit(vehicle) {
        console.log('Танк попал в машину игрока!');
        
        // Уничтожаем машину мгновенно
        this.breakVehicle(vehicle);
        
        // Игрок отлетает
        const crashDirection = vehicle.currentDirection.clone().multiplyScalar(-3);
        crashDirection.y = 2;
        
        this.player.position.copy(vehicle.group.position).add(crashDirection);
        this.player.velocity.set(crashDirection.x, crashDirection.y, crashDirection.z);
        this.player.onGround = false;
        
        // Выходим из машины
        this.drivingVehicle = null;
        
        // Увеличиваем уровень розыска еще больше
        if (this.wantedLevel < 5) {
            this.wantedLevel++;
            this.updateWantedDisplay();
        }
    }

    killPlayerFromTank() {
        console.log('Танк убил игрока!');
        
        // Игрок умирает
        this.player.isDead = true;
        this.player.group.visible = false;
        
        // Респавним через 3 секунды
        setTimeout(() => {
            this.respawnPlayer();
        }, 3000);
    }

    arrestPlayer() {
        console.log('Игрок арестован!');
        
        // Отправляем в тюрьму
        this.player.position.copy(this.jailPosition);
        this.player.group.position.copy(this.jailPosition);
        this.isInJail = true;
        
        // Сбрасываем уровень розыска
        this.wantedLevel = 0;
        this.updateWantedDisplay();
        
        // Очищаем полицию
        this.clearPolice();
        
        // Через 10 секунд выпускаем из тюрьмы
        setTimeout(() => {
            this.releaseFromJail();
        }, 10000);
    }

    releaseFromJail() {
        console.log('Игрок выпущен из тюрьмы');
        
        // Возвращаем на стартовую позицию
        this.player.position.set(0, 0, 0);
        this.player.group.position.set(0, 0, 0);
        this.isInJail = false;
    }

    checkPlayerBuildingCollisions(position) {
        if (!this.buildings || this.buildings.length === 0) return false;
        
        // Создаем bounding box для игрока, охватывающий область от текущей до новой позиции
        const currentPos = this.player.position;
        const playerBox = new THREE.Box3(
            new THREE.Vector3(
                Math.min(position.x - 0.5, currentPos.x - 0.5),
                Math.min(position.y, currentPos.y),
                Math.min(position.z - 0.5, currentPos.z - 0.5)
            ),
            new THREE.Vector3(
                Math.max(position.x + 0.5, currentPos.x + 0.5),
                Math.max(position.y + 2.5, currentPos.y + 2.5),
                Math.max(position.z + 0.5, currentPos.z + 0.5)
            )
        );
        
        for (let building of this.buildings) {
            if (!building || !building.group) continue;
            
            // Используем закэшированный BoundingBox если есть
            let buildingBox;
            if (building.box) {
                buildingBox = building.box;
            } else {
                // Fallback для старых объектов (если есть)
                building.group.updateMatrixWorld();
                buildingBox = new THREE.Box3().setFromObject(building.group);
                buildingBox.expandByScalar(0.5);
                // Кэшируем на будущее
                building.box = buildingBox;
            }
            
            // Проверяем столкновение
            if (playerBox.intersectsBox(buildingBox)) {
                return true; // Есть столкновение
            }
        }
        
        return false; // Нет столкновения
    }

    checkNPCMovement(npc, newPosition) {
        // Проверяем столкновения со зданиями (оптимизировано)
        if (this.buildings && this.buildings.length > 0) {
            // Создаем bounding box для NPC
            const npcBox = new THREE.Box3(
                new THREE.Vector3(newPosition.x - 0.5, newPosition.y, newPosition.z - 0.5),
                new THREE.Vector3(newPosition.x + 0.5, newPosition.y + 2, newPosition.z + 0.5)
            );
            
            for (let building of this.buildings) {
                if (!building || !building.group) continue;
                
                // Используем закэшированный BoundingBox
                let buildingBox;
                if (building.box) {
                    buildingBox = building.box;
                } else {
                    // Fallback
                    building.group.updateMatrixWorld();
                    buildingBox = new THREE.Box3().setFromObject(building.group);
                    buildingBox.expandByScalar(0.5);
                    building.box = buildingBox;
                }
                
                if (npcBox.intersectsBox(buildingBox)) {
                    return false; // Есть столкновение со зданием
                }
            }
        }
        
        return true; // Нет столкновений
    }

    avoidObstacle(npc, originalDirection) {
        // Пытаемся обойти препятствие, поворачивая влево или вправо
        const avoidanceOptions = [
            Math.PI / 4,    // 45 градусов вправо
            -Math.PI / 4,   // 45 градусов влево
            Math.PI / 2,    // 90 градусов вправо
            -Math.PI / 2,   // 90 градусов влево
        ];
        
        for (let angleOffset of avoidanceOptions) {
            const avoidDirection = originalDirection.clone();
            avoidDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleOffset);
            
            const testPosition = npc.group.position.clone();
            const moveVector = avoidDirection.clone().multiplyScalar(npc.speed);
            testPosition.add(moveVector);
            
            if (this.checkNPCMovement(npc, testPosition)) {
                // Можем двигаться в этом направлении
                const angle = Math.atan2(avoidDirection.x, avoidDirection.z);
                npc.group.rotation.y = angle;
                
                avoidDirection.multiplyScalar(npc.speed);
                npc.group.position.add(avoidDirection);
                return;
            }
        }
        
        // Если не можем обойти - останавливаемся и поворачиваемся случайно
        if (!npc.stuckTime) npc.stuckTime = Date.now();
        
        if (Date.now() - npc.stuckTime > 2000) { // Через 2 секунды меняем цель
            const randomAngle = Math.random() * Math.PI * 2;
            const newTarget = new THREE.Vector3(
                npc.group.position.x + Math.cos(randomAngle) * 10,
                0,
                npc.group.position.z + Math.sin(randomAngle) * 10
            );
            npc.target = newTarget;
            npc.stuckTime = null;
        }
    }

    destroyTank(tank) {
        // Удаляем танк из сцены
        this.scene.remove(tank.group);
        
        // Удаляем из массива танков
        const index = this.tanks.indexOf(tank);
        if (index > -1) {
            this.tanks.splice(index, 1);
        }
        
        // Если это был танк игрока, выбрасываем игрока
        if (tank === this.drivingVehicle) {
            this.exitVehicle();
        }
        
        console.log('Tank destroyed and removed from game');
    }

    updatePlayer() {
        if (!this.player) return;

        // Если игрок в тюрьме - не позволяем двигаться
        if (this.isInJail) return;

        // Если игрок в машине - управляем машиной вместо пешком
        if (this.drivingVehicle) {
            this.updateVehicleControl();
            return;
        }

        // Автоматическая стрельба если зажата кнопка мыши
        if (this.mouseDown && document.pointerLockElement === document.body) {
            this.shootWeapon();
        }

        const deltaTime = 0.016; // Примерно 60 FPS
        
        // Движение
        const moveVector = new THREE.Vector3();
        let isMoving = false;

        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            moveVector.z -= 1;
            isMoving = true;
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            moveVector.z += 1;
            isMoving = true;
        }
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            moveVector.x -= 1;
            isMoving = true;
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            moveVector.x += 1;
            isMoving = true;
        }

        if (isMoving) {
            // Нормализуем вектор движения
            moveVector.normalize();
            
            // В режиме от первого лица движение относительно направления взгляда
            if (this.firstPersonMode) {
                const forward = new THREE.Vector3(0, 0, -1);
                const right = new THREE.Vector3(1, 0, 0);
                
                // Применяем поворот камеры к векторам направления
                forward.applyQuaternion(this.camera.quaternion);
                right.applyQuaternion(this.camera.quaternion);
                
                // Убираем вертикальную составляющую для движения по земле
                forward.y = 0;
                right.y = 0;
                forward.normalize();
                right.normalize();
                
                const finalMove = new THREE.Vector3();
                finalMove.addScaledVector(forward, -moveVector.z); // Инвертируем Z для правильного направления
                finalMove.addScaledVector(right, moveVector.x);
                finalMove.multiplyScalar(this.player.speed);
                
                this.player.velocity.x = finalMove.x;
                this.player.velocity.z = finalMove.z;
            } else {
                // Режим от третьего лица (старая логика)
                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                cameraDirection.y = 0;
                cameraDirection.normalize();
                
                const rightVector = new THREE.Vector3();
                rightVector.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
                
                const finalMove = new THREE.Vector3();
                finalMove.addScaledVector(cameraDirection, -moveVector.z);
                finalMove.addScaledVector(rightVector, moveVector.x);
                finalMove.multiplyScalar(this.player.speed);
                
                this.player.velocity.x = finalMove.x;
                this.player.velocity.z = finalMove.z;
                
                // Поворачиваем игрока в направлении движения (только в третьем лице)
                if (finalMove.length() > 0) {
                    this.player.rotation = Math.atan2(finalMove.x, finalMove.z);
                    this.player.group.rotation.y = this.player.rotation;
                }
            }
        } else {
            // Замедляем игрока
            this.player.velocity.x *= 0.8;
            this.player.velocity.z *= 0.8;
        }

        // Гравитация
        if (!this.player.onGround) {
            this.player.velocity.y -= 1.5 * deltaTime;
        }

        // Проверяем столкновения со зданиями перед применением движения
        const newPosition = this.player.position.clone().add(this.player.velocity);
        if (!this.checkPlayerBuildingCollisions(newPosition)) {
            // Применяем движение только если нет столкновения
            this.player.position.add(this.player.velocity);
        } else {
            // При столкновении останавливаем горизонтальное движение
            this.player.velocity.x = 0;
            this.player.velocity.z = 0;
        }

        // Проверяем землю
        if (this.player.position.y <= 0) {
            this.player.position.y = 0;
            this.player.velocity.y = 0;
            this.player.onGround = true;
        } else {
            this.player.onGround = false;
        }

        // Обновляем позицию группы
        this.player.group.position.copy(this.player.position);

        // Обновляем камеру
        this.updateCamera();
    }

    updateCamera() {
        if (!this.player || this.drivingVehicle) return;

        if (this.firstPersonMode) {
            // Режим от первого лица - камера в позиции глаз обычного игрока
            const eyePosition = this.player.position.clone();
            eyePosition.y += 2.2; // Высота глаз для обычного игрока
            
            this.camera.position.copy(eyePosition);
            
            // Поворот камеры на основе движения мыши
            const euler = new THREE.Euler(this.mouseY, this.mouseX, 0, 'YXZ');
            this.camera.setRotationFromEuler(euler);
            
            // Скрываем модель игрока в режиме от первого лица
            this.player.group.visible = false;
            // Но оставляем оружие видимым
            if (this.player.weaponMesh) {
                this.player.weaponMesh.visible = true;
            }
        } else {
            // Режим от третьего лица - камера следует за обычным игроком
            const targetPosition = this.player.position.clone();
            targetPosition.y += 4; // Уменьшили высоту цели

            const cameraPosition = new THREE.Vector3();
            cameraPosition.x = targetPosition.x + this.cameraDistance * Math.sin(this.mouseX) * Math.cos(this.mouseY);
            cameraPosition.y = targetPosition.y + this.cameraDistance * Math.sin(this.mouseY);
            cameraPosition.z = targetPosition.z + this.cameraDistance * Math.cos(this.mouseX) * Math.cos(this.mouseY);

            this.camera.position.copy(cameraPosition);
            this.camera.lookAt(targetPosition);
            
            // Показываем модель игрока в режиме от третьего лица
            this.player.group.visible = true;
        }
    }

    updateEntities() {
        // Обновляем NPC
        this.npcs.forEach(npc => this.updateNPC(npc));
        
        // Обновляем машины
        this.vehicles.forEach(vehicle => this.updateVehicle(vehicle));
        
        // Обновляем полицию и танки
        this.updatePolice();
        
        // Обновляем снаряды
        if (this.projectiles) {
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const projectile = this.projectiles[i];
                
                // Применяем гравитацию если есть
                if (projectile.userData.gravity) {
                    projectile.userData.velocity.y += projectile.userData.gravity;
                    
                    // Обновляем ориентацию ракеты по направлению полета
                    const direction = projectile.userData.velocity.clone().normalize();
                    if (direction.length() > 0) {
                        projectile.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
                    }
                }
                
                projectile.position.add(projectile.userData.velocity);
                
                // Создаем дымный след для снарядов с флагом hasTrail
                if (projectile.userData.hasTrail && Math.random() > 0.5) {
                    this.createSmokePuff(projectile.position.clone(), 0.5);
                }
                
                // Анимация огня для ракет
                const flame = projectile.getObjectByName ? projectile.getObjectByName('flame') : null;
                if (flame) {
                    flame.scale.setScalar(0.8 + Math.random() * 0.4);
                }
                
                // Проверка столкновений
                let hit = false;
                
                // С землей
                if (projectile.position.y <= 0) {
                    hit = true;
                    projectile.position.y = 0; // Взрыв происходит на поверхности
                }
                
                // С NPC (оптимизировано через дистанцию)
                if (!hit) {
                    // Используем цилиндрическую проверку коллизий, так как origin NPC в ногах (y=0),
                    // а пули летят на уровне груди/головы
                    const npcRadiusSq = 0.6 * 0.6; // Радиус поражения
                    const npcHeight = 2.8; // Высота NPC
                    
                    for (let npc of this.npcs) {
                        if (npc.state === 'dead' || !npc.group) continue;
                        
                        // Проверка по горизонтали (XZ)
                        const dx = projectile.position.x - npc.group.position.x;
                        const dz = projectile.position.z - npc.group.position.z;
                        const distSqXZ = dx*dx + dz*dz;
                        
                        if (distSqXZ < npcRadiusSq) {
                            // Проверка по вертикали (Y)
                            const dy = projectile.position.y - npc.group.position.y;
                            
                            if (dy > 0 && dy < npcHeight) {
                                hit = true;
                                
                                if (projectile.userData.isBullet) {
                                    // Пуля наносит урон
                                    if (!npc.health) npc.health = 100;
                                    
                                    let damage = projectile.userData.damage || 10;
                                    
                                    if (projectile.userData.weaponType === 'ak47') {
                                        damage = 34;
                                    } else if (projectile.userData.weaponType === 'smg') {
                                        damage = 7;
                                    }
                                    
                                    npc.health -= damage;
                                    console.log(`Hit NPC! Health: ${npc.health}`);
                                    
                                    if (npc.health <= 0) {
                                        // Награда за убийство
                                        const reward = Math.floor(250 + Math.random() * 501);
                                        this.player.money += reward;
                                        this.updateMoneyDisplay();
                                        console.log(`Earned $${reward} for killing NPC`);
                                        
                                        this.killNPC(npc);
                                    } else {
                                        // Визуальный отклик - небольшое смещение
                                        npc.group.position.add(projectile.userData.velocity.clone().normalize().multiplyScalar(0.05));
                                        // Можно покрасить в красный на мгновение (если бы материалы поддерживали)
                                    }
                                } else {
                                    // Ракета убивает сразу
                                    this.killNPC(npc); 
                                }
                                break;
                            }
                        }
                    }
                }
                
                // С машинами (не танками) (оптимизировано)
                if (!hit) {
                    const hitDistSq = 3.0 * 3.0; // Примерный радиус коллизии машины
                    
                    for (let vehicle of this.vehicles) {
                        if (!vehicle.group || vehicle.isTank) continue; // Пропускаем танки
                        
                        // Быстрая проверка по дистанции
                        if (projectile.position.distanceToSquared(vehicle.group.position) < hitDistSq) {
                            hit = true;
                            
                            if (projectile.userData.isBullet) {
                                // Пуля наносит урон
                                if (!vehicle.health) vehicle.health = 100;
                                vehicle.health -= projectile.userData.damage || 10;
                                
                                if (vehicle.health <= 0) {
                                    this.handleBuildingCrash(vehicle); // Взрыв машины
                                }
                            } else {
                                // Ракета взрывает сразу
                                this.handleBuildingCrash(vehicle); 
                            }
                            break;
                        }
                    }
                }
                
                // С танками (отдельная логика) (оптимизировано)
                if (!hit && this.tanks) {
                    const hitDistSq = 3.5 * 3.5; // Танк побольше
                    
                    for (let tank of this.tanks) {
                        if (!tank.group) continue;
                        // Игнорируем танк, который выпустил снаряд
                        if (projectile.userData.owner === tank) continue;
                        
                        if (projectile.position.distanceToSquared(tank.group.position) < hitDistSq) {
                            hit = true;
                            
                            if (projectile.userData.isBullet) {
                                // Пули не пробивают танк
                                // Можно добавить звук рикошета или искры
                            } else {
                                // Танк игрока не получает урон от ИИ
                                if (tank === this.drivingVehicle && projectile.userData.fromAI) {
                                    // Игнорируем урон
                                } else if (projectile.userData.fromPlayer && projectile.userData.fromTank) {
                                    // Только снаряд танка игрока уничтожает вражеский танк
                                    this.destroyTank(tank);
                                } else {
                                    // RPG только убивает водителя
                                    tank.driverDead = true;
                                    console.log('Tank driver killed by RPG!');
                                }
                            }
                            break;
                        }
                    }
                }
                
                // Со зданиями (оптимизировано)
                if (!hit && this.buildings) {
                    // Для зданий используем Box3, так как они большие и разной формы
                    // Но создаем Box для снаряда только один раз
                    const projBox = new THREE.Box3().setFromObject(projectile);
                    
                    for (let building of this.buildings) {
                        if (!building.group) continue;
                        
                        // Используем кэшированный box
                        let buildBox;
                        if (building.box) {
                            buildBox = building.box;
                        } else {
                            building.group.updateMatrixWorld();
                            buildBox = new THREE.Box3().setFromObject(building.group);
                            building.box = buildBox;
                        }
                        
                        if (projBox.intersectsBox(buildBox)) {
                            hit = true;
                            break;
                        }
                    }
                }
                
                // Удаление при попадании или по времени
                if (hit || Date.now() - projectile.userData.creationTime > 5000) {
                    this.scene.remove(projectile);
                    this.projectiles.splice(i, 1);
                    
                    if (hit) {
                        // Эффект взрыва
                        if (projectile.userData.isExplosive) {
                            this.createExplosion(
                                projectile.position, 
                                projectile.userData.explosionRadius,
                                projectile.userData.fromPlayer || false,
                                projectile.userData.fromAI || false,
                                projectile.userData.fromTank || false
                            );
                        } else {
                            console.log('Projectile hit');
                        }
                    }
                }
            }
        }
    }

    createExplosion(position, radius, fromPlayer = false, fromAI = false, fromTank = false) {
        console.log('Explosion at', position, 'radius', radius, 'fromPlayer:', fromPlayer, 'fromAI:', fromAI);
        
        // Устанавливаем радиус поражения равным максимальному визуальному размеру взрыва
        // Анимация увеличивает сферу примерно в 2.5 раза, поэтому и урон должен быть таким же
        const effectiveRadius = radius * 2.5;
        
        // Визуальный эффект взрыва
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xFF4500, transparent: true, opacity: 0.8 });
        const explosion = new THREE.Mesh(geometry, material);
        explosion.position.copy(position);
        this.scene.add(explosion);
        
        // Дополнительное кольцо взрывной волны
        const waveGeo = new THREE.RingGeometry(radius, radius + 0.5, 32);
        const waveMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        const wave = new THREE.Mesh(waveGeo, waveMat);
        wave.position.copy(position);
        wave.rotation.x = -Math.PI / 2;
        this.scene.add(wave);
        
        // Анимация исчезновения (быстрая и масштабная)
        let scale = 1;
        const animateExplosion = () => {
            scale += 0.1; // Быстрое расширение
            explosion.scale.set(scale, scale, scale);
            explosion.material.opacity -= 0.05;
            
            wave.scale.setScalar(scale * 1.5);
            wave.material.opacity -= 0.03;
            
            if (explosion.material.opacity > 0) {
                requestAnimationFrame(animateExplosion);
            } else {
                this.scene.remove(explosion);
                this.scene.remove(wave);
            }
        };
        animateExplosion();
        
        // Урон по области - ВСЕМ в радиусе
        const effectiveRadiusSq = effectiveRadius * effectiveRadius;
        
        // 1. NPC - убиваем и отбрасываем
        for (let i = 0; i < this.npcs.length; i++) {
            const npc = this.npcs[i];
            if (!npc.group) continue;
            
            const distSq = npc.group.position.distanceToSquared(position);
            
            if (distSq < effectiveRadiusSq) {
                this.killNPC(npc);
                
                // Отбрасываем NPC от взрыва
                let pushDir = new THREE.Vector3().subVectors(npc.group.position, position);
                if (pushDir.lengthSq() < 0.01) {
                    pushDir = new THREE.Vector3(Math.random()-0.5, 1, Math.random()-0.5);
                }
                pushDir.normalize();
                pushDir.y = 0.5; // Подбрасываем вверх
                npc.group.position.add(pushDir.multiplyScalar(3));
            }
        }
        
        // 2. Машины - взрываем и отбрасываем
        for (let i = 0; i < this.vehicles.length; i++) {
            const vehicle = this.vehicles[i];
            if (!vehicle.group) continue;
            
            const distSq = vehicle.group.position.distanceToSquared(position);
            
            if (distSq < effectiveRadiusSq) {
                // Танки не взрываются от взрывов (только водитель умирает), если это не прямой выстрел танка
                if (!vehicle.isTank) {
                    this.handleBuildingCrash(vehicle); // Взрыв машины
                    
                    // Отбрасываем машину
                    let pushDir = new THREE.Vector3().subVectors(vehicle.group.position, position);
                    if (pushDir.lengthSq() < 0.01) {
                        pushDir = new THREE.Vector3(Math.random()-0.5, 1, Math.random()-0.5);
                    }
                    pushDir.normalize();
                    pushDir.y = 0.2;
                    vehicle.group.position.add(pushDir.multiplyScalar(2));
                    vehicle.group.rotation.z += Math.random() * 0.5; // Наклоняем
                    vehicle.group.rotation.x += Math.random() * 0.5;
                }
            }
        }
        
        // 3. Танки (убиваем водителя или уничтожаем)
        if (this.tanks) {
            this.tanks.forEach(tank => {
                if (tank.group && tank.group.position.distanceToSquared(position) < effectiveRadiusSq) {
                    // Танк игрока не получает урон от ИИ
                    if (tank === this.drivingVehicle && fromAI) {
                        console.log('Player tank is immune to AI explosions');
                        return;
                    }

                    // Танк игрока не получает урон от своих же снарядов
                    if (tank === this.drivingVehicle && fromPlayer) {
                        return;
                    }
                    
                    // Если взрыв от игрока
                    if (fromPlayer) {
                        if (fromTank) {
                            // Танковый снаряд уничтожает танк
                            this.destroyTank(tank);
                            console.log('Tank destroyed by player tank!');
                        } else {
                            // РПГ только убивает водителя
                            tank.driverDead = true;
                            console.log('Tank driver killed by player RPG!');
                        }
                    } else {
                        // Иначе только водитель умирает
                        tank.driverDead = true;
                        console.log('Tank driver killed!');
                    }
                }
            });
        }
    }

    updateNPC(npc) {
        // Пропускаем мертвых NPC
        if (npc.state === 'dead') return;
        
        // Водители машин не двигаются
        if (npc.vehicle) {
            // Синхронизируем позицию водителя с машиной
            npc.group.position.copy(npc.vehicle.group.position);
            npc.group.position.y = 0.5; // Высота сиденья
            return;
        }
        
        // Движение к цели
        const direction = new THREE.Vector3().subVectors(npc.target, npc.group.position);
        const distance = direction.length();
        
        if (distance > 2) {
            direction.normalize();
            
            // Проверяем коллизии перед движением
            const newPosition = npc.group.position.clone();
            const moveVector = direction.clone().multiplyScalar(npc.speed);
            newPosition.add(moveVector);
            
            // Проверяем столкновения с машинами
            let canMove = this.checkNPCMovement(npc, newPosition);
            
            if (canMove) {
                // Поворачиваем NPC в направлении движения
                const angle = Math.atan2(direction.x, direction.z);
                npc.group.rotation.y = angle;
                
                direction.multiplyScalar(npc.speed);
                npc.group.position.add(direction);
            } else {
                // Пытаемся обойти препятствие
                this.avoidObstacle(npc, direction);
            }
            
            // Анимация ходьбы
            npc.walkingTime += npc.speed * 3;
            
            // Используем bodyParts из нового формата NPC
            if (npc.bodyParts) {
                const { leftLeg, rightLeg, leftArm, rightArm, leftShoe, rightShoe } = npc.bodyParts;
                
                // Расчет углов для анимации в зависимости от пола и типа анимации
                let legSwingIntensity = 0.3;
                let armSwingIntensity = 0.2;
                
                if (npc.gender === 'female') {
                    legSwingIntensity *= 0.8; // Более изящные движения
                    armSwingIntensity *= 0.7;
                }
                
                // Применяем личностные черты
                if (npc.personalityTraits) {
                    legSwingIntensity *= (0.5 + npc.personalityTraits.energy * 0.5);
                    armSwingIntensity *= (0.5 + npc.personalityTraits.confidence * 0.5);
                }
                
                const legSwing = Math.sin(npc.walkingTime) * legSwingIntensity;
                const armSwing = Math.sin(npc.walkingTime + Math.PI) * armSwingIntensity;
                const bodyBob = Math.sin(npc.walkingTime * 2) * 0.02;
                
                // Анимация ног
                if (leftLeg && rightLeg) {
                    leftLeg.rotation.x = legSwing;
                    rightLeg.rotation.x = -legSwing;
                }
                
                // Анимация рук
                if (leftArm && rightArm) {
                    leftArm.rotation.x = armSwing;
                    rightArm.rotation.x = -armSwing;
                }
                
                // Анимация обуви
                if (leftShoe && rightShoe) {
                    leftShoe.rotation.x = legSwing * 0.5;
                    rightShoe.rotation.x = -legSwing * 0.5;
                }
                
                // Покачивание тела
                npc.group.position.y = bodyBob;
            }
            
        } else {
            // Достигли цели - выбираем новый путь
            this.resetNPCAnimation(npc);
            
            // Находим новый путь на перекрестке
            const newPath = this.findNewPathForNPC(npc);
            if (newPath) {
                npc.path = newPath;
                npc.target = newPath.end.clone();
                
                // Добавляем небольшую паузу на перекрестке
                npc.waitTime = 0.5 + Math.random() * 1.0;
            } else {
                // Если не нашли новый путь, разворачиваемся
                npc.target = npc.target.equals(npc.path.end) ? npc.path.start.clone() : npc.path.end.clone();
            }
        }
    }
    
    resetNPCAnimation(npc) {
        // Сбрасываем все части тела в исходные позиции
        if (npc.bodyParts) {
            Object.values(npc.bodyParts).forEach(part => {
                if (part && part.rotation) {
                    part.rotation.x = 0;
                    part.rotation.y = 0;
                    part.rotation.z = 0;
                }
            });
        }
        
        // Сброс позиции тела
        npc.group.position.y = 0;
    }

    updateVehicle(vehicle) {
        // Не обновляем сломанные машины
        if (vehicle.isBroken) return;
        
        // Не обновляем машины, которыми управляет игрок
        if (vehicle.isPlayerDriven) return;
        
        // Не обновляем брошенные игроком машины
        if (vehicle.isAbandoned) return;
        
        // Не обновляем полицейские машины (они обновляются в updatePolice)
        if (vehicle.isPolice) return;
        
        // Принудительное возобновление движения если машина остановлена слишком долго
        if (vehicle.stopped && vehicle.stoppedFor) {
            if (!vehicle.stopTime) vehicle.stopTime = Date.now();
            else if (Date.now() - vehicle.stopTime > 10000) { // 10 секунд
                console.log('Принудительное возобновление движения машины');
                vehicle.speed = vehicle.prevSpeed || 0.2;
                vehicle.stopped = false;
                vehicle.stoppedFor = null;
                vehicle.stopTime = null;
            }
        } else {
            vehicle.stopTime = null;
        }
        
        // Проверяем время ожидания на перекрестке
        if (vehicle.waitTime && vehicle.waitTime > 0) {
            vehicle.waitTime -= 0.016; // Примерно 16ms на кадр
            return;
        }
        
        // Движение к цели
        const direction = new THREE.Vector3().subVectors(vehicle.target, vehicle.group.position);
        const distance = direction.length();
        
        if (distance > 3) {
            direction.normalize();
            
            // Плавный поворот машины к цели
            const targetAngle = Math.atan2(direction.x, direction.z);
            let currentAngle = vehicle.group.rotation.y;
            
            // Нормализуем углы
            while (targetAngle - currentAngle > Math.PI) currentAngle += 2 * Math.PI;
            while (targetAngle - currentAngle < -Math.PI) currentAngle -= 2 * Math.PI;
            
            // Плавный поворот
            const turnSpeed = 0.05;
            const angleDiff = targetAngle - currentAngle;
            if (Math.abs(angleDiff) > 0.1) {
                vehicle.group.rotation.y += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnSpeed);
            } else {
                vehicle.group.rotation.y = targetAngle;
            }
            
            // Обновляем направление движения (инициализируем, если отсутствует)
            if (!vehicle.currentDirection) vehicle.currentDirection = new THREE.Vector3();
            vehicle.currentDirection.set(
                Math.sin(vehicle.group.rotation.y),
                0,
                Math.cos(vehicle.group.rotation.y)
            );
            
            // Проверка предостановки перед движением: заранее останавливаемся на 5 м перед игроком
            try {
                const stopDistance = 5; // метров

                // Если машина была остановлена, проверяем можно ли возобновить движение
                if (vehicle.stoppedFor && vehicle.stoppedFor.target && this.player) {
                    let playerPos = null;
                    if (this.player.group && this.player.group.position) {
                        playerPos = this.player.group.position.clone();
                    } else if (this.player.position) {
                        playerPos = new THREE.Vector3(this.player.position.x, this.player.position.y || 0, this.player.position.z);
                    }
                    
                    if (playerPos) {
                        const distanceToPlayer = vehicle.group.position.distanceTo(playerPos);
                        
                        // Возобновляем движение если игрок ушел дальше 7 метров
                        if (distanceToPlayer > stopDistance + 2) {
                            console.log(`Машина возобновляет движение! Игрок ушел на ${distanceToPlayer.toFixed(2)}м`);
                            vehicle.speed = vehicle.prevSpeed || 0.2;
                            vehicle.stopped = false;
                            vehicle.stoppedFor = null;
                        }
                    }
                }

                // Проверка игрока впереди - используем this.player напрямую
                if (!vehicle.stopped && this.player) {
                    let playerPos = null;
                    if (this.player.group && this.player.group.position) {
                        playerPos = this.player.group.position.clone();
                    } else if (this.player.position) {
                        playerPos = new THREE.Vector3(this.player.position.x, this.player.position.y || 0, this.player.position.z);
                    }

                    if (playerPos) {
                        const distanceToPlayer = vehicle.group.position.distanceTo(playerPos);
                        
                        // Проверяем, находится ли игрок впереди машины
                        const toPlayer = new THREE.Vector3().subVectors(playerPos, vehicle.group.position).normalize();
                        const forward = vehicle.currentDirection.clone().normalize();
                        const dotProduct = toPlayer.dot(forward);
                        
                        // Отладка расстояния
                        if (Math.random() < 0.05) {
                            console.log(`Расстояние до игрока: ${distanceToPlayer.toFixed(2)}м, dot=${dotProduct.toFixed(2)}`);
                        }
                        
                        // Останавливаемся если игрок близко И находится впереди машины
                        if (distanceToPlayer < stopDistance && dotProduct > 0.3) { // dotProduct > 0.3 значит игрок примерно впереди
                            console.log(`Машина останавливается перед игроком! Расстояние: ${distanceToPlayer.toFixed(2)}м`);
                            if (!vehicle.prevSpeed) vehicle.prevSpeed = vehicle.speed || 0.2;
                            vehicle.speed = 0;
                            vehicle.stopped = true;
                            vehicle.stoppedFor = { type: 'player', target: playerPos.clone() };
                        }
                    }
                }
            } catch (e) {
                console.log('Pre-stop error:', e);
            }

            // Движение вперед (по направлению машины) - только если не остановлены
            const moveVector = vehicle.currentDirection.clone().multiplyScalar(vehicle.speed);
            
            // Отладка движения
            if (Math.random() < 0.02 && vehicle.speed > 0) {
                console.log(`Машина движется: speed=${vehicle.speed.toFixed(3)}, stopped=${vehicle.stopped}`);
            }
            
            // Добавляем небольшие отклонения для реалистичности
            const sway = Math.sin(Date.now() * 0.002 + vehicle.group.position.x) * 0.01;
            moveVector.x += sway * 0.1;
            moveVector.z += sway * 0.1;

            vehicle.group.position.add(moveVector);
            
            // Анимация колес (поворот колес при движении)
            const wheels = vehicle.group.children.filter(child => 
                child.geometry && child.geometry.type === 'CylinderGeometry'
            );
            wheels.forEach(wheel => {
                wheel.rotation.x += vehicle.speed * 2; // Крутим колесо вокруг оси X (как в реальности)
            });

            // Проверяем столкновения с NPC (AABB), только если машина не уже остановлена
            try {
                if (!vehicle.stopped && this.npcs && this.npcs.length) {
                    const vehBox = new THREE.Box3().setFromObject(vehicle.group);
                    if (!vehBox.isEmpty()) {
                        vehBox.expandByVector(new THREE.Vector3(0.5, 0.5, 0.5));
                        for (let i = 0; i < this.npcs.length; i++) {
                            const npc = this.npcs[i];
                            if (!npc || !npc.group || npc.state === 'dead') continue;
                            const npcBox = new THREE.Box3().setFromObject(npc.group);
                            if (npcBox.isEmpty()) continue;
                            npcBox.expandByVector(new THREE.Vector3(0.25, 0.5, 0.25));
                            if (vehBox.intersectsBox(npcBox)) {
                                // Столкновение — останавливаем машину кратковременно, но не убиваем NPC
                                vehicle.prevSpeed = vehicle.speed;
                                vehicle.speed = 0;
                                vehicle.stopped = true;
                                // Помещаем причину остановки (чтобы восстанавливаться позже)
                                vehicle.stoppedFor = { type: 'obstacle', target: npc.group.position.clone() };
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                // ignore collision errors
            }
            
        } else {
            // Достигли конца сегмента - ищем новый путь
            const newSegment = this.findNewRoadSegment(vehicle);
            if (newSegment) {
                vehicle.roadSegment = newSegment;
                vehicle.target = newSegment.end.clone();
                
                // Добавляем время ожидания на перекрестке
                vehicle.waitTime = 0.3 + Math.random() * 0.7;
                
                // Обновляем направление
                vehicle.currentDirection = newSegment.direction.clone();
            } else {
                // Если не нашли новый сегмент, респавним
                this.respawnVehicle(vehicle);
            }
        }
    }

    respawnVehicle(vehicle) {
        // Выбираем новый случайный сегмент дороги
        const newSegment = this.roadSegments[Math.floor(Math.random() * this.roadSegments.length)];
        
        // Устанавливаем позицию в начале сегмента
        const newPos = newSegment.start.clone();
        newPos.x += (Math.random() - 0.5) * 2;
        newPos.z += (Math.random() - 0.5) * 2;
        newPos.y = 0.02;
        
        vehicle.group.position.copy(newPos);
        vehicle.roadSegment = newSegment;
        vehicle.target = newSegment.end.clone();
        vehicle.waitTime = 0;
        
        // Правильно ориентируем машину по направлению дороги
        const angle = Math.atan2(newSegment.direction.x, newSegment.direction.z);
        vehicle.group.rotation.y = angle;
        
        // Обновляем направление движения
        vehicle.currentDirection = newSegment.direction.clone();
    }

    

    startRenderLoop() {
        if (this.isRunning) return; // Уже запущен
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.fpsDisplay = document.getElementById('fps-display');
        
        const animate = (currentTime) => {
            if (!this.isRunning) return;
            
            requestAnimationFrame(animate);
            
            const deltaTime = currentTime - this.lastTime;
            
            // Подсчет FPS
            this.frameCount++;
            if (this.frameCount % 60 === 0) {
                const fps = Math.round(1000 / deltaTime);
                if (this.fpsDisplay) {
                    this.fpsDisplay.textContent = `FPS: ${fps}`;
                }
                this.frameCount = 0;
            }
            
            this.lastTime = currentTime;

            // LOD обновление зданий каждые 30 кадров
            this._lodCounter = (this._lodCounter || 0) + 1;
            if (this._lodCounter % 30 === 0) {
                this._updateBuildingLOD();
            }
            // Обрабатываем очередь восстановления зданий небольшими порциями каждый кадр
            this._processBuildingRestoreQueue();
            
            // Обновляем игрока
            this.updatePlayer();
            
            // Обновляем NPC и машины (с оптимизацией)
            this.updateEntities();
            
            this.renderer.render(this.scene, this.camera);
        };
        
        animate(performance.now());
        console.log('Render loop started');
    }

    stop() {
        this.isRunning = false;
    }

    pause() {
        this.isRunning = false;
        console.log('Game paused');
    }

    resume() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.startRenderLoop();
            console.log('Game resumed');
            
            // Возвращаем захват курсора с небольшой задержкой
            setTimeout(() => {
                document.body.requestPointerLock();
            }, 100);
        }
    }

    handleEsc() {
        if (this.isShopOpen) {
            this.closeShop();
            return true;
        }
        return false;
    }

    destroy() {
        this.stop();
        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    // Методы для навигации NPC
    findNewPathForNPC(npc) {
        // Находим возможные пути с текущей позиции
        const currentPos = npc.group.position;
        const availablePaths = [];
        
        // Ищем пути, которые начинаются рядом с текущей позицией
        this.walkingPaths.forEach(path => {
            const distanceToStart = currentPos.distanceTo(path.start);
            if (distanceToStart < 20 && path !== npc.path) {
                availablePaths.push(path);
            }
        });
        
        if (availablePaths.length > 0) {
            // Выбираем случайный путь
            return availablePaths[Math.floor(Math.random() * availablePaths.length)];
        }
        
        // Если не нашли новых путей, возвращаем null
        return null;
    }

    findNewRoadSegment(vehicle) {
        // Находим возможные сегменты дорог с текущей позиции
        const currentPos = vehicle.group.position;
        const availableSegments = [];
        
        // Ищем сегменты, которые начинаются рядом с текущей позицией
        if (this.roadSegments) {
            this.roadSegments.forEach(segment => {
                const distanceToStart = currentPos.distanceTo(segment.start);
                if (distanceToStart < 25 && segment !== vehicle.roadSegment) {
                    // Проверяем, совместимо ли направление (избегаем разворотов на 180°)
                    const currentDir = vehicle.currentDirection || vehicle.roadSegment.direction;
                    const dot = currentDir.dot(segment.direction);
                    
                    // Разрешаем прямое движение и повороты, но не развороты
                    if (dot > -0.5) {
                        // Добавляем вес в зависимости от типа поворота
                        let weight = 1;
                        if (dot > 0.8) weight = 3; // Прямое движение предпочтительнее
                        else if (dot > 0) weight = 2; // Небольшие повороты
                        
                        for (let i = 0; i < weight; i++) {
                            availableSegments.push(segment);
                        }
                    }
                }
            });
        }
        
        if (availableSegments.length > 0) {
            // Выбираем случайный сегмент с учетом весов
            return availableSegments[Math.floor(Math.random() * availableSegments.length)];
        }
        
        // Если не нашли новых сегментов, возвращаем null
        return null;
    }

    createHair(gender, skinColor) {
        const hairColors = [0x8B4513, 0x000000, 0x654321, 0xFFD700, 0x800000, 0x2F4F4F];
        const hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];
        const hairMaterial = new THREE.MeshLambertMaterial({ color: hairColor });
        
        let hair;
        
        if (gender === 'female') {
            // Женские прически
            const femaleStyles = ['long', 'ponytail', 'bob', 'curly'];
            const style = femaleStyles[Math.floor(Math.random() * femaleStyles.length)];
            
            switch (style) {
                case 'long':
                    hair = new THREE.Group();
                    const longTop = new THREE.Mesh(new THREE.SphereGeometry(0.32), hairMaterial);
                    longTop.position.y = 2.5;
                    longTop.scale.set(1, 0.8, 1.1);
                    hair.add(longTop);
                    
                    const longBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.1), hairMaterial);
                    longBack.position.set(0, 2.1, -0.25);
                    hair.add(longBack);
                    break;
                    
                case 'ponytail':
                    hair = new THREE.Group();
                    const ponytailTop = new THREE.Mesh(new THREE.SphereGeometry(0.3), hairMaterial);
                    ponytailTop.position.y = 2.5;
                    ponytailTop.scale.set(1, 0.7, 1);
                    hair.add(ponytailTop);
                    
                    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), hairMaterial);
                    tail.position.set(0, 2.0, -0.25);
                    hair.add(tail);
                    break;
                    
                case 'bob':
                    hair = new THREE.Mesh(new THREE.SphereGeometry(0.32), hairMaterial);
                    hair.position.y = 2.5;
                    hair.scale.set(1.1, 0.7, 1.1);
                    break;
                    
                case 'curly':
                    hair = new THREE.Mesh(new THREE.SphereGeometry(0.34), hairMaterial);
                    hair.position.y = 2.52;
                    hair.scale.set(1.1, 0.85, 1.1);
                    break;
                    
                default:
                    hair = new THREE.Mesh(new THREE.SphereGeometry(0.32), hairMaterial);
                    hair.position.y = 2.5;
                    hair.scale.set(1, 0.8, 1);
            }
        } else {
            // Мужские прически
            const maleStyles = ['short', 'buzz', 'medium', 'slicked'];
            const style = maleStyles[Math.floor(Math.random() * maleStyles.length)];
            
            switch (style) {
                case 'short':
                    hair = new THREE.Mesh(new THREE.SphereGeometry(0.31), hairMaterial);
                    hair.position.y = 2.48;
                    hair.scale.set(1, 0.7, 1);
                    break;
                    
                case 'buzz':
                    hair = new THREE.Mesh(new THREE.SphereGeometry(0.305), hairMaterial);
                    hair.position.y = 2.45;
                    hair.scale.set(1, 0.6, 1);
                    break;
                    
                case 'medium':
                    hair = new THREE.Mesh(new THREE.SphereGeometry(0.32), hairMaterial);
                    hair.position.y = 2.5;
                    hair.scale.set(1, 0.75, 1.05);
                    break;
                    
                case 'slicked':
                    hair = new THREE.Mesh(new THREE.SphereGeometry(0.31), hairMaterial);
                    hair.position.y = 2.48;
                    hair.scale.set(1, 0.6, 0.9);
                    break;
                    
                default:
                    hair = new THREE.Mesh(new THREE.SphereGeometry(0.32), hairMaterial);
                    hair.position.y = 2.5;
                    hair.scale.set(1, 0.75, 1);
            }
        }
        
        hair.castShadow = true;
        return hair;
    }

    getRandomAnimationType(gender) {
        const maleAnimations = ['normal', 'confident', 'casual', 'energetic'];
        const femaleAnimations = ['elegant', 'graceful', 'energetic', 'confident'];
        
        const animations = gender === 'female' ? femaleAnimations : maleAnimations;
        return animations[Math.floor(Math.random() * animations.length)];
    }
}

// Экспортируем простой движок
window.SimpleGameEngine = SimpleGameEngine;