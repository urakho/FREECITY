// Система транспорта
class VehicleSystem {
    constructor(scene) {
        this.scene = scene;
        this.vehicles = [];
        this.roadNetwork = [];
        this.maxVehicles = 15;
        
        this.vehicleTypes = [
            {
                name: 'sedan',
                color: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff, 0x888888],
                width: 4, height: 3, length: 8
            },
            {
                name: 'suv',
                color: [0x444444, 0x666666, 0x333333, 0x555555],
                width: 5, height: 4, length: 10
            },
            {
                name: 'truck',
                color: [0x8B4513, 0xFF6347, 0x4169E1],
                width: 6, height: 5, length: 12
            }
        ];
    }

    initialize() {
        this.findRoads();
        this.spawnVehicles();
        console.log(`Создано ${this.vehicles.length} транспортных средств`);
    }

    findRoads() {
        // Находим дороги в сцене
        this.scene.traverse((child) => {
            if (child.name && child.name.startsWith('road_')) {
                this.roadNetwork.push({
                    object: child,
                    position: child.position.clone(),
                    isHorizontal: child.name.includes('_h_')
                });
            }
        });
    }

    spawnVehicles() {
        for (let i = 0; i < this.maxVehicles; i++) {
            if (this.roadNetwork.length === 0) break;
            
            const road = this.roadNetwork[Math.floor(Math.random() * this.roadNetwork.length)];
            const vehicle = this.createVehicle(road);
            
            if (vehicle) {
                this.vehicles.push(vehicle);
                this.scene.add(vehicle.group);
            }
        }
    }

    createVehicle(road) {
        const vehicleType = this.vehicleTypes[Math.floor(Math.random() * this.vehicleTypes.length)];
        const color = vehicleType.color[Math.floor(Math.random() * vehicleType.color.length)];
        
        const group = new THREE.Group();
        
        // Кузов автомобиля
        const bodyGeometry = new THREE.BoxGeometry(vehicleType.width, vehicleType.height, vehicleType.length);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = vehicleType.height / 2;
        body.castShadow = true;
        group.add(body);
        
        // Окна
        this.addWindows(group, vehicleType);
        
        // Колёса
        this.addWheels(group, vehicleType);
        
        // Фары
        this.addHeadlights(group, vehicleType);
        
        // Позиционирование на дороге
        const position = this.getRandomRoadPosition(road);
        group.position.copy(position);
        
        // Направление движения
        const direction = road.isHorizontal ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        if (Math.random() > 0.5) direction.multiplyScalar(-1);
        
        const vehicle = {
            group,
            type: vehicleType.name,
            speed: 0.2 + Math.random() * 0.3,
            direction: direction.clone(),
            road: road,
            targetPosition: null,
            path: [],
            currentPathIndex: 0
        };
        
        // Устанавливаем поворот
        if (road.isHorizontal) {
            group.rotation.y = direction.x > 0 ? 0 : Math.PI;
        } else {
            group.rotation.y = direction.z > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        
        return vehicle;
    }

    addWindows(group, vehicleType) {
        const windowMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x222244, 
            transparent: true, 
            opacity: 0.8 
        });
        
        // Переднее окно
        const frontWindowGeometry = new THREE.PlaneGeometry(vehicleType.width * 0.8, vehicleType.height * 0.6);
        const frontWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
        frontWindow.position.set(0, vehicleType.height * 0.7, vehicleType.length * 0.4);
        group.add(frontWindow);
        
        // Заднее окно
        const backWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
        backWindow.position.set(0, vehicleType.height * 0.7, -vehicleType.length * 0.4);
        backWindow.rotation.y = Math.PI;
        group.add(backWindow);
        
        // Боковые окна
        const sideWindowGeometry = new THREE.PlaneGeometry(vehicleType.length * 0.6, vehicleType.height * 0.6);
        
        const leftWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
        leftWindow.position.set(vehicleType.width * 0.4, vehicleType.height * 0.7, 0);
        leftWindow.rotation.y = Math.PI / 2;
        group.add(leftWindow);
        
        const rightWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
        rightWindow.position.set(-vehicleType.width * 0.4, vehicleType.height * 0.7, 0);
        rightWindow.rotation.y = -Math.PI / 2;
        group.add(rightWindow);
    }

    addWheels(group, vehicleType) {
        const wheelGeometry = new THREE.CylinderGeometry(1, 1, 0.5);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
        
        const wheelPositions = [
            { x: vehicleType.width * 0.4, z: vehicleType.length * 0.3 },
            { x: -vehicleType.width * 0.4, z: vehicleType.length * 0.3 },
            { x: vehicleType.width * 0.4, z: -vehicleType.length * 0.3 },
            { x: -vehicleType.width * 0.4, z: -vehicleType.length * 0.3 }
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos.x, 1, pos.z);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            group.add(wheel);
        });
    }

    addHeadlights(group, vehicleType) {
        const lightMaterial = new THREE.MeshLambertMaterial({ color: 0xffffaa, emissive: 0x222211 });
        const lightGeometry = new THREE.CircleGeometry(0.3);
        
        // Передние фары
        const leftHeadlight = new THREE.Mesh(lightGeometry, lightMaterial);
        leftHeadlight.position.set(vehicleType.width * 0.3, vehicleType.height * 0.3, vehicleType.length * 0.5);
        group.add(leftHeadlight);
        
        const rightHeadlight = new THREE.Mesh(lightGeometry, lightMaterial);
        rightHeadlight.position.set(-vehicleType.width * 0.3, vehicleType.height * 0.3, vehicleType.length * 0.5);
        group.add(rightHeadlight);
        
        // Задние фонари
        const tailLightMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0x220000 });
        const leftTaillight = new THREE.Mesh(lightGeometry, tailLightMaterial);
        leftTaillight.position.set(vehicleType.width * 0.3, vehicleType.height * 0.3, -vehicleType.length * 0.5);
        leftTaillight.rotation.y = Math.PI;
        group.add(leftTaillight);
        
        const rightTaillight = new THREE.Mesh(lightGeometry, tailLightMaterial);
        rightTaillight.position.set(-vehicleType.width * 0.3, vehicleType.height * 0.3, -vehicleType.length * 0.5);
        rightTaillight.rotation.y = Math.PI;
        group.add(rightTaillight);
    }

    getRandomRoadPosition(road) {
        const position = road.position.clone();
        
        if (road.isHorizontal) {
            position.x += (Math.random() - 0.5) * 100; // Случайная позиция по длине дороги
            position.z += (Math.random() - 0.5) * 3;   // Небольшое смещение по полосе
        } else {
            position.z += (Math.random() - 0.5) * 100; // Случайная позиция по длине дороги
            position.x += (Math.random() - 0.5) * 3;   // Небольшое смещение по полосе
        }
        
        position.y = 1; // Высота над дорогой
        return position;
    }

    update(deltaTime) {
        this.vehicles.forEach(vehicle => this.updateVehicle(vehicle, deltaTime));
    }

    updateVehicle(vehicle, deltaTime) {
        const moveDistance = vehicle.speed * deltaTime * 60; // Нормализуем к FPS
        
        // Предостановка: останавливаем машину заранее, если впереди NPC или игрок в пределах 5 метров
        try {
            const stopDistance = 5; // метров перед NPC/игроком
            const laneThreshold = 3.0; // боковое отклонение, чтобы учитывать нахождение на полосе
            const npcSystem = window.gameInstance && window.gameInstance.npcSystem;

            // helper to resume if target moved away
            const tryResume = (targetPos) => {
                if (!vehicle.stoppedFor) return;
                const vec = new THREE.Vector3().subVectors(targetPos, vehicle.group.position);
                const forward = vehicle.direction.clone().normalize();
                const forwardDist = vec.dot(forward);
                const lateral = Math.sqrt(Math.max(0, vec.lengthSq() - forwardDist * forwardDist));
                if (forwardDist > stopDistance + 1 || lateral > laneThreshold + 1) {
                    vehicle.speed = vehicle.prevSpeed || 0.2;
                    vehicle.stopped = false;
                    vehicle.stoppedFor = null;
                }
            };

            // If vehicle is already stopped for something, try resume relative to that target
            if (vehicle.stoppedFor && vehicle.stoppedFor.target) {
                tryResume(vehicle.stoppedFor.target);
            }

            // Check NPCs ahead
            if (!vehicle.stopped && npcSystem && npcSystem.npcs && npcSystem.npcs.length) {
                for (let i = 0; i < npcSystem.npcs.length; i++) {
                    const npc = npcSystem.npcs[i];
                    if (!npc || !npc.group || npc.state === 'dead') continue;
                    const vec = new THREE.Vector3().subVectors(npc.group.position, vehicle.group.position);
                    const forward = vehicle.direction.clone().normalize();
                    const forwardDist = vec.dot(forward);
                    const lateral = Math.sqrt(Math.max(0, vec.lengthSq() - forwardDist * forwardDist));
                    if (forwardDist > 0 && forwardDist < stopDistance && lateral < laneThreshold) {
                        vehicle.prevSpeed = vehicle.speed;
                        vehicle.speed = 0;
                        vehicle.stopped = true;
                        vehicle.stoppedFor = { type: 'npc', target: npc.group.position.clone() };
                        break;
                    }
                }
            }

            // Check player ahead
            if (!vehicle.stopped && window.gameInstance && window.gameInstance.player) {
                let playerPos = null;
                const p = window.gameInstance.player;
                if (p.group && p.group.position) playerPos = p.group.position.clone();
                else if (p.position) playerPos = new THREE.Vector3(p.position.x, p.position.y || 0, p.position.z);
                if (playerPos) {
                    const vec = new THREE.Vector3().subVectors(playerPos, vehicle.group.position);
                    const forward = vehicle.direction.clone().normalize();
                    const forwardDist = vec.dot(forward);
                    const lateral = Math.sqrt(Math.max(0, vec.lengthSq() - forwardDist * forwardDist));
                    if (forwardDist > 0 && forwardDist < stopDistance && lateral < laneThreshold) {
                        vehicle.prevSpeed = vehicle.speed;
                        vehicle.speed = 0;
                        vehicle.stopped = true;
                        vehicle.stoppedFor = { type: 'player', target: playerPos.clone() };
                    }
                }
            }
        } catch (e) {
            // ignore pre-stop errors
        }

        // Простое движение по прямой
        const movement = vehicle.direction.clone().multiplyScalar(moveDistance);
        vehicle.group.position.add(movement);
        
        // Проверяем, не выехал ли автомобиль за границы города
        const cityBounds = 500;
        if (Math.abs(vehicle.group.position.x) > cityBounds || 
            Math.abs(vehicle.group.position.z) > cityBounds) {
            this.respawnVehicle(vehicle);
        }
        
        // Случайные повороты на перекрёстках
        if (Math.random() < 0.001) { // 0.1% шанс поворота каждый кадр
            this.turnVehicle(vehicle);
        }

        // Никаких смертей NPC здесь — убираем логику попадания и респавна/скорой (поведение: машины заранее тормозят перед NPC/player)
    }

    

    turnVehicle(vehicle) {
        const currentDirection = vehicle.direction.clone();
        
        // Поворот на 90 градусов
        if (Math.random() > 0.5) {
            // Поворот направо
            vehicle.direction.set(-currentDirection.z, 0, currentDirection.x);
            vehicle.group.rotation.y += Math.PI / 2;
        } else {
            // Поворот налево
            vehicle.direction.set(currentDirection.z, 0, -currentDirection.x);
            vehicle.group.rotation.y -= Math.PI / 2;
        }
    }

    respawnVehicle(vehicle) {
        // Перемещаем автомобиль на новую дорогу
        const road = this.roadNetwork[Math.floor(Math.random() * this.roadNetwork.length)];
        const newPosition = this.getRandomRoadPosition(road);
        
        vehicle.group.position.copy(newPosition);
        vehicle.road = road;
        
        // Обновляем направление
        const direction = road.isHorizontal ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        if (Math.random() > 0.5) direction.multiplyScalar(-1);
        
        vehicle.direction = direction;
        
        // Обновляем поворот
        if (road.isHorizontal) {
            vehicle.group.rotation.y = direction.x > 0 ? 0 : Math.PI;
        } else {
            vehicle.group.rotation.y = direction.z > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
    }

    destroy() {
        this.vehicles.forEach(vehicle => {
            this.scene.remove(vehicle.group);
            
            // Очищаем геометрию и материалы
            vehicle.group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
        
        this.vehicles = [];
    }
}

// Экспортируем класс
window.VehicleSystem = VehicleSystem;