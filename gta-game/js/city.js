// Генератор города
class CityGenerator {
    constructor(scene) {
        this.scene = scene;
        this.citySize = 1000; // Размер города
        this.blockSize = 60;  // Размер квартала
        this.roadWidth = 8;   // Ширина дороги
        this.buildings = [];
        this.roads = [];
        this.decorations = [];
    }

    generate() {
        console.log('Генерация города...');
        
        // Создаём земную поверхность
        this.createGround();
        
        // Создаём дорожную сеть
        this.createRoadNetwork();
        
        // Создаём здания
        this.createBuildings();
        
        // Добавляем растительность
        this.createVegetation();
        
        // Добавляем уличное освещение
        this.createStreetLights();
        
        // Добавляем парки
        this.createParks();
        
        console.log('Город создан');
    }

    createGround() {
        // Основная земля
        const groundGeometry = new THREE.PlaneGeometry(this.citySize * 2, this.citySize * 2);
        const groundTexture = this.createGroundTexture();
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            map: groundTexture,
            color: 0x4a5d3a 
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.name = 'ground';
        this.scene.add(ground);
    }

    createGroundTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Базовый зелёный цвет
        ctx.fillStyle = '#4a5d3a';
        ctx.fillRect(0, 0, 512, 512);
        
        // Добавляем текстуру травы
        for (let i = 0; i < 1000; i++) {
            ctx.fillStyle = `hsl(${90 + Math.random() * 20}, 40%, ${30 + Math.random() * 20}%)`;
            ctx.fillRect(
                Math.random() * 512, 
                Math.random() * 512, 
                Math.random() * 3 + 1, 
                Math.random() * 3 + 1
            );
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(20, 20);
        
        return texture;
    }

    createRoadNetwork() {
        const roadMaterial = this.createRoadMaterial();
        const sidewalkMaterial = this.createSidewalkMaterial();
        
        // Вычисляем количество дорог
        const roadCount = Math.floor(this.citySize / this.blockSize);
        
        // Горизонтальные дороги
        for (let i = -roadCount; i <= roadCount; i++) {
            const z = i * this.blockSize;
            
            // Основная дорога
            const roadGeometry = new THREE.PlaneGeometry(this.citySize * 1.5, this.roadWidth);
            const road = new THREE.Mesh(roadGeometry, roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.set(0, 0.05, z);
            road.receiveShadow = true;
            road.name = `road_h_${i}`;
            this.scene.add(road);
            this.roads.push(road);
            
            // Тротуары
            this.createSidewalk(0, z, roadGeometry.parameters.width, this.roadWidth + 2, sidewalkMaterial);
            
            // Разметка дороги
            this.createRoadMarkings(0, z, roadGeometry.parameters.width, true);
        }
        
        // Вертикальные дороги
        for (let i = -roadCount; i <= roadCount; i++) {
            const x = i * this.blockSize;
            
            // Основная дорога
            const roadGeometry = new THREE.PlaneGeometry(this.roadWidth, this.citySize * 1.5);
            const road = new THREE.Mesh(roadGeometry, roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.set(x, 0.05, 0);
            road.receiveShadow = true;
            road.name = `road_v_${i}`;
            this.scene.add(road);
            this.roads.push(road);
            
            // Тротуары
            this.createSidewalk(x, 0, this.roadWidth + 2, roadGeometry.parameters.height, sidewalkMaterial);
            
            // Разметка дороги
            this.createRoadMarkings(x, 0, roadGeometry.parameters.height, false);
        }
    }

    createRoadMaterial() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Асфальт
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, 256, 256);
        
        // Добавляем шероховатость
        for (let i = 0; i < 500; i++) {
            ctx.fillStyle = `rgba(${40 + Math.random() * 20}, ${40 + Math.random() * 20}, ${40 + Math.random() * 20}, 0.5)`;
            ctx.fillRect(
                Math.random() * 256, 
                Math.random() * 256, 
                Math.random() * 2 + 1, 
                Math.random() * 2 + 1
            );
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        
        return new THREE.MeshLambertMaterial({ 
            map: texture,
            color: 0x333333
        });
    }

    createSidewalkMaterial() {
        return new THREE.MeshLambertMaterial({ 
            color: 0x666666
        });
    }

    createSidewalk(x, z, width, height, material) {
        const sidewalkHeight = 0.1;
        const sidewalkGeometry = new THREE.PlaneGeometry(width, height);
        const sidewalk = new THREE.Mesh(sidewalkGeometry, material);
        sidewalk.rotation.x = -Math.PI / 2;
        sidewalk.position.set(x, 0.02, z);
        sidewalk.receiveShadow = true;
        this.scene.add(sidewalk);
    }

    createRoadMarkings(x, z, length, isHorizontal) {
        const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const markingLength = 3;
        const markingWidth = 0.2;
        const spacing = 6;
        
        const count = Math.floor(length / spacing);
        
        for (let i = -count / 2; i < count / 2; i++) {
            const geometry = isHorizontal 
                ? new THREE.PlaneGeometry(markingLength, markingWidth)
                : new THREE.PlaneGeometry(markingWidth, markingLength);
            
            const marking = new THREE.Mesh(geometry, markingMaterial);
            marking.rotation.x = -Math.PI / 2;
            
            if (isHorizontal) {
                marking.position.set(i * spacing, 0.06, z);
            } else {
                marking.position.set(x, 0.06, i * spacing);
            }
            
            this.scene.add(marking);
        }
    }

    createBuildings() {
        const buildingTypes = [
            { color: 0x888888, minHeight: 20, maxHeight: 40 },  // Жилые дома
            { color: 0x666666, minHeight: 40, maxHeight: 80 },  // Офисные здания
            { color: 0x999999, minHeight: 60, maxHeight: 120 }, // Небоскрёбы
            { color: 0x777777, minHeight: 10, maxHeight: 25 }   // Магазины
        ];

        const roadCount = Math.floor(this.citySize / this.blockSize);
        
        for (let i = -roadCount; i < roadCount; i++) {
            for (let j = -roadCount; j < roadCount; j++) {
                // Пропускаем центральные кварталы для парка
                if (Math.abs(i) <= 1 && Math.abs(j) <= 1) continue;
                
                const centerX = (i + 0.5) * this.blockSize;
                const centerZ = (j + 0.5) * this.blockSize;
                
                this.createBuildingBlock(centerX, centerZ, buildingTypes);
            }
        }
    }

    createBuildingBlock(centerX, centerZ, buildingTypes) {
        const buildingsPerBlock = 2 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < buildingsPerBlock; i++) {
            const buildingType = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
            
            const width = 15 + Math.random() * 20;
            const depth = 15 + Math.random() * 20;
            const height = buildingType.minHeight + Math.random() * (buildingType.maxHeight - buildingType.minHeight);
            
            const offsetX = (Math.random() - 0.5) * 30;
            const offsetZ = (Math.random() - 0.5) * 30;
            
            const building = this.createBuilding(
                centerX + offsetX,
                centerZ + offsetZ,
                width, height, depth,
                buildingType.color
            );
            
            this.buildings.push(building);
        }
    }

    createBuilding(x, z, width, height, depth, color) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshLambertMaterial({ color });
        
        const building = new THREE.Mesh(geometry, material);
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        
        // Добавляем окна
        this.addWindows(building, width, height, depth);
        
        this.scene.add(building);
        return building;
    }

    addWindows(building, width, height, depth) {
        const windowMaterial = new THREE.MeshLambertMaterial({ 
            color: Math.random() > 0.3 ? 0xffffaa : 0x222222,
            emissive: Math.random() > 0.3 ? 0x444422 : 0x000000
        });
        
        const windowSize = 1.5;
        const windowSpacing = 6; // Увеличиваем расстояние
        
        // Окна на передней и задней стенах
        const windowsX = Math.floor(width / windowSpacing);
        const windowsY = Math.floor(height / windowSpacing);
        
        for (let i = 0; i < windowsX; i++) {
            for (let j = 0; j < windowsY; j++) {
                const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
                const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
                const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
                
                const offsetX = (i - windowsX / 2) * windowSpacing;
                const offsetY = (j - windowsY / 2) * windowSpacing;
                
                // Передняя стена
                window1.position.set(offsetX, offsetY, depth / 2 + 0.01);
                building.add(window1);
                
                // Задняя стена
                window2.position.set(offsetX, offsetY, -depth / 2 - 0.01);
                window2.rotation.y = Math.PI;
                building.add(window2);
            }
        }
        
        // Окна на боковых стенах
        const windowsZ = Math.floor(depth / windowSpacing);
        
        for (let i = 0; i < windowsZ; i++) {
            for (let j = 0; j < windowsY; j++) {
                const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
                const window3 = new THREE.Mesh(windowGeometry, windowMaterial);
                const window4 = new THREE.Mesh(windowGeometry, windowMaterial);
                
                const offsetZ = (i - windowsZ / 2) * windowSpacing;
                const offsetY = (j - windowsY / 2) * windowSpacing;
                
                // Правая стена
                window3.position.set(width / 2 + 0.01, offsetY, offsetZ);
                window3.rotation.y = Math.PI / 2;
                building.add(window3);
                
                // Левая стена
                window4.position.set(-width / 2 - 0.01, offsetY, offsetZ);
                window4.rotation.y = -Math.PI / 2;
                building.add(window4);
            }
        }
    }

    createVegetation() {
        // Деревья вдоль дорог
        this.createStreetTrees();
        
        // Случайная растительность
        this.createRandomVegetation();
    }

    createStreetTrees() {
        const roadCount = Math.floor(this.citySize / this.blockSize);
        
        for (let i = -roadCount; i <= roadCount; i++) {
            // Деревья вдоль горизонтальных дорог
            const z = i * this.blockSize;
            for (let x = -this.citySize / 2; x <= this.citySize / 2; x += 25) {
                if (Math.random() > 0.3) {
                    this.createTree(x + (Math.random() - 0.5) * 5, z + 8 + Math.random() * 4);
                    this.createTree(x + (Math.random() - 0.5) * 5, z - 8 - Math.random() * 4);
                }
            }
            
            // Деревья вдоль вертикальных дорог
            const x = i * this.blockSize;
            for (let z = -this.citySize / 2; z <= this.citySize / 2; z += 25) {
                if (Math.random() > 0.3) {
                    this.createTree(x + 8 + Math.random() * 4, z + (Math.random() - 0.5) * 5);
                    this.createTree(x - 8 - Math.random() * 4, z + (Math.random() - 0.5) * 5);
                }
            }
        }
    }

    createRandomVegetation() {
        for (let i = 0; i < 100; i++) {
            const x = (Math.random() - 0.5) * this.citySize * 1.5;
            const z = (Math.random() - 0.5) * this.citySize * 1.5;
            
            // Проверяем, что не на дороге
            if (this.isOnRoad(x, z)) continue;
            
            if (Math.random() > 0.6) {
                this.createTree(x, z);
            } else {
                this.createBush(x, z);
            }
        }
    }

    createTree(x, z) {
        const group = new THREE.Group();
        
        // Ствол
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, 8);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 4;
        trunk.castShadow = true;
        group.add(trunk);
        
        // Крона
        const crownGeometry = new THREE.SphereGeometry(4 + Math.random() * 2);
        const crownMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color().setHSL(0.25, 0.6, 0.3 + Math.random() * 0.2)
        });
        const crown = new THREE.Mesh(crownGeometry, crownMaterial);
        crown.position.y = 10 + Math.random() * 2;
        crown.castShadow = true;
        group.add(crown);
        
        group.position.set(x, 0, z);
        this.scene.add(group);
        this.decorations.push(group);
    }

    createBush(x, z) {
        const bushGeometry = new THREE.SphereGeometry(1 + Math.random());
        const bushMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color().setHSL(0.28, 0.7, 0.25 + Math.random() * 0.15)
        });
        const bush = new THREE.Mesh(bushGeometry, bushMaterial);
        bush.position.set(x, bushGeometry.parameters.radius, z);
        bush.castShadow = true;
        bush.receiveShadow = true;
        this.scene.add(bush);
        this.decorations.push(bush);
    }

    createStreetLights() {
        const roadCount = Math.floor(this.citySize / this.blockSize);
        
        for (let i = -roadCount; i <= roadCount; i += 2) {
            for (let j = -roadCount; j <= roadCount; j += 2) {
                const x = j * this.blockSize;
                const z = i * this.blockSize;
                
                this.createStreetLight(x + 15, z + 15);
            }
        }
    }

    createStreetLight(x, z) {
        const group = new THREE.Group();
        
        // Столб
        const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, 12);
        const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.y = 6;
        pole.castShadow = true;
        group.add(pole);
        
        // Фонарь
        const lightGeometry = new THREE.SphereGeometry(0.8);
        const lightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffaa,
            emissive: 0x444422
        });
        const lightBulb = new THREE.Mesh(lightGeometry, lightMaterial);
        lightBulb.position.y = 12;
        group.add(lightBulb);
        
        // Точечный свет (уменьшено для производительности)
        const pointLight = new THREE.PointLight(0xffffaa, 0.3, 20); // Уменьшена интенсивность и радиус
        pointLight.position.set(0, 12, 0);
        pointLight.castShadow = false; // Отключено для производительности
        group.add(pointLight);
        
        group.position.set(x, 0, z);
        this.scene.add(group);
        this.decorations.push(group);
    }

    createParks() {
        // Центральный парк
        this.createCentralPark();
    }

    createCentralPark() {
        const parkSize = this.blockSize * 2;
        
        // Трава в парке
        const grassGeometry = new THREE.PlaneGeometry(parkSize, parkSize);
        const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const grass = new THREE.Mesh(grassGeometry, grassMaterial);
        grass.rotation.x = -Math.PI / 2;
        grass.position.y = 0.01;
        grass.receiveShadow = true;
        this.scene.add(grass);
        
        // Деревья в парке
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * parkSize * 0.8;
            const z = (Math.random() - 0.5) * parkSize * 0.8;
            this.createTree(x, z);
        }
        
        // Кусты в парке
        for (let i = 0; i < 30; i++) {
            const x = (Math.random() - 0.5) * parkSize * 0.9;
            const z = (Math.random() - 0.5) * parkSize * 0.9;
            this.createBush(x, z);
        }
        
        // Пруд
        this.createPond(0, 0);
    }

    createPond(x, z) {
        const pondGeometry = new THREE.CircleGeometry(15);
        const pondMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x4169E1,
            transparent: true,
            opacity: 0.7
        });
        const pond = new THREE.Mesh(pondGeometry, pondMaterial);
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(x, 0.02, z);
        pond.receiveShadow = true;
        this.scene.add(pond);
        this.decorations.push(pond);
    }

    isOnRoad(x, z) {
        const blockX = Math.round(x / this.blockSize);
        const blockZ = Math.round(z / this.blockSize);
        
        const distToRoadX = Math.abs(x - blockX * this.blockSize);
        const distToRoadZ = Math.abs(z - blockZ * this.blockSize);
        
        return distToRoadX < this.roadWidth / 2 || distToRoadZ < this.roadWidth / 2;
    }
}

// Экспортируем класс
window.CityGenerator = CityGenerator;