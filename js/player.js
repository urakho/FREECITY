// Класс игрока с управлением
class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.group = new THREE.Group();
        
        // Характеристики игрока
        this.health = 100;
        this.money = 50000;
        this.wantedLevel = 0;
        
        // Физические параметры
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.canJump = true;
        
        // Параметры движения
        this.walkSpeed = 5;
        this.runSpeed = 10;
        this.jumpSpeed = 15;
        this.gravity = -30;
        
        // Состояния
        this.isRunning = false;
        this.isInVehicle = false;
        this.currentVehicle = null;
        
        // Камера
        this.cameraOffset = new THREE.Vector3(0, 5, 10);
        this.cameraTarget = new THREE.Vector3();
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseSensitivity = 0.002;
        
        // Анимация
        this.walkingTime = 0;
        this.bodyParts = {};
        
        this.init();
        this.setupControls();
    }

    init() {
        this.createPlayerModel();
        this.scene.add(this.group);
        this.setupCamera();
        console.log('Player initialized');
    }

    createPlayerModel() {
        // Тело
        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.4);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.5;
        body.castShadow = true;
        this.group.add(body);
        this.bodyParts.body = body;

        // Голова
        const headGeometry = new THREE.SphereGeometry(0.3);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDBB7 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 2.4;
        head.castShadow = true;
        this.group.add(head);
        this.bodyParts.head = head;

        // Волосы
        const hairGeometry = new THREE.SphereGeometry(0.32);
        const hairMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.position.y = 2.5;
        hair.scale.y = 0.8;
        hair.castShadow = true;
        this.group.add(hair);

        // Ноги
        const legGeometry = new THREE.BoxGeometry(0.3, 1, 0.3);
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(0.2, 0.5, 0);
        leftLeg.castShadow = true;
        this.group.add(leftLeg);
        this.bodyParts.leftLeg = leftLeg;
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(-0.2, 0.5, 0);
        rightLeg.castShadow = true;
        this.group.add(rightLeg);
        this.bodyParts.rightLeg = rightLeg;

        // Руки
        const armGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
        const armMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDBB7 });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(0.5, 1.4, 0);
        leftArm.castShadow = true;
        this.group.add(leftArm);
        this.bodyParts.leftArm = leftArm;
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(-0.5, 1.4, 0);
        rightArm.castShadow = true;
        this.group.add(rightArm);
        this.bodyParts.rightArm = rightArm;

        this.group.position.copy(this.position);
    }

    setupCamera() {
        // Устанавливаем начальную позицию камеры
        this.updateCameraPosition();
        
        // Захват курсора для управления камерой
        document.addEventListener('click', () => {
            if (document.pointerLockElement !== document.body) {
                document.body.requestPointerLock().catch(error => {
                    console.warn('Pointer lock request failed:', error);
                });
            }
        });

        // Обработка движения мыши
        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === document.body) {
                this.mouseX -= event.movementX * this.mouseSensitivity;
                this.mouseY -= event.movementY * this.mouseSensitivity;
                
                // Ограничиваем вертикальный угол
                this.mouseY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.mouseY));
            }
        });
    }

    setupControls() {
        this.keys = {};
        
        // Обработка нажатий клавиш
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            // Специальные действия
            switch(event.code) {
                case 'Space':
                    event.preventDefault();
                    this.jump();
                    break;
                case 'KeyF':
                    this.interactWithVehicle();
                    break;
                case 'ShiftLeft':
                    this.isRunning = true;
                    break;
            }
        });

        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
            
            if (event.code === 'ShiftLeft') {
                this.isRunning = false;
            }
        });
    }

    update(deltaTime) {
        if (!this.isInVehicle) {
            this.updateMovement(deltaTime);
            this.updateAnimation(deltaTime);
        } else {
            this.updateVehicleControls(deltaTime);
        }
        
        this.updatePhysics(deltaTime);
        this.updateCameraPosition();
        this.checkCollisions();
    }

    updateMovement(deltaTime) {
        const moveVector = new THREE.Vector3();
        const speed = this.isRunning ? this.runSpeed : this.walkSpeed;
        
        // Вычисляем направление движения относительно камеры
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();
        
        const rightVector = new THREE.Vector3();
        rightVector.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
        rightVector.normalize();

        // WASD движение
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            moveVector.add(cameraDirection);
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            moveVector.sub(cameraDirection);
        }
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            moveVector.sub(rightVector);
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            moveVector.add(rightVector);
        }

        // Нормализуем и применяем скорость
        if (moveVector.length() > 0) {
            moveVector.normalize();
            moveVector.multiplyScalar(speed * deltaTime);
            
            this.velocity.x = moveVector.x;
            this.velocity.z = moveVector.z;
            
            // Поворачиваем игрока в направлении движения
            const angle = Math.atan2(moveVector.x, moveVector.z);
            this.group.rotation.y = angle;
        } else {
            // Затухание движения
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;
        }
    }

    updateAnimation(deltaTime) {
        const isMoving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1;
        
        if (isMoving) {
            this.walkingTime += deltaTime * (this.isRunning ? 10 : 6);
            
            // Анимация ходьбы/бега
            const legSwing = Math.sin(this.walkingTime) * 0.4;
            const armSwing = Math.sin(this.walkingTime + Math.PI) * 0.3;
            
            this.bodyParts.leftLeg.rotation.x = legSwing;
            this.bodyParts.rightLeg.rotation.x = -legSwing;
            this.bodyParts.leftArm.rotation.x = armSwing;
            this.bodyParts.rightArm.rotation.x = -armSwing;
            
            // Покачивание тела
            this.bodyParts.body.rotation.z = Math.sin(this.walkingTime * 2) * 0.05;
        } else {
            // Возврат к нейтральной позе
            this.bodyParts.leftLeg.rotation.x *= 0.9;
            this.bodyParts.rightLeg.rotation.x *= 0.9;
            this.bodyParts.leftArm.rotation.x *= 0.9;
            this.bodyParts.rightArm.rotation.x *= 0.9;
            this.bodyParts.body.rotation.z *= 0.9;
        }
    }

    updatePhysics(deltaTime) {
        // Гравитация
        if (!this.onGround) {
            this.velocity.y += this.gravity * deltaTime;
        }

        // Применяем скорость к позиции
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

        // Проверка с землёй
        if (this.position.y <= 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.onGround = true;
            this.canJump = true;
        } else {
            this.onGround = false;
        }

        // Обновляем позицию группы
        this.group.position.copy(this.position);
    }

    updateCameraPosition() {
        // Третий лицо камера
        const cameraDistance = 15;
        const cameraHeight = 8;
        
        const targetPosition = this.position.clone();
        targetPosition.y += cameraHeight;
        
        // Вычисляем позицию камеры на основе углов мыши
        const cameraPosition = new THREE.Vector3();
        cameraPosition.x = targetPosition.x + cameraDistance * Math.sin(this.mouseX) * Math.cos(this.mouseY);
        cameraPosition.y = targetPosition.y + cameraDistance * Math.sin(this.mouseY);
        cameraPosition.z = targetPosition.z + cameraDistance * Math.cos(this.mouseX) * Math.cos(this.mouseY);
        
        this.camera.position.copy(cameraPosition);
        this.camera.lookAt(targetPosition);
    }

    jump() {
        if (this.onGround && this.canJump) {
            this.velocity.y = this.jumpSpeed;
            this.onGround = false;
            this.canJump = false;
        }
    }

    interactWithVehicle() {
        if (this.isInVehicle) {
            this.exitVehicle();
        } else {
            this.enterNearestVehicle();
        }
    }

    enterNearestVehicle() {
        // Поиск ближайшего транспорта
        if (window.gameInstance && window.gameInstance.vehicleSystem) {
            const vehicles = window.gameInstance.vehicleSystem.vehicles;
            let nearestVehicle = null;
            let minDistance = 5; // Максимальная дистанция для входа

            vehicles.forEach(vehicle => {
                const distance = this.position.distanceTo(vehicle.group.position);
                if (distance < minDistance) {
                    nearestVehicle = vehicle;
                    minDistance = distance;
                }
            });

            if (nearestVehicle) {
                this.isInVehicle = true;
                this.currentVehicle = nearestVehicle;
                this.group.visible = false;
                
                // Позиционируем игрока в машине
                this.position.copy(nearestVehicle.group.position);
                this.position.y += 2;
                
                console.log('Вошли в транспорт');
            }
        }
    }

    exitVehicle() {
        if (this.isInVehicle && this.currentVehicle) {
            this.isInVehicle = false;
            
            // Выходим рядом с машиной
            this.position.copy(this.currentVehicle.group.position);
            this.position.x += 3; // Выходим сбоку
            this.position.y = 0;
            
            this.group.visible = true;
            this.currentVehicle = null;
            
            console.log('Вышли из транспорта');
        }
    }

    updateVehicleControls(deltaTime) {
        if (!this.currentVehicle) return;

        const vehicle = this.currentVehicle;
        const acceleration = 0.5;
        const maxSpeed = 1.5;
        const turnSpeed = 2;

        // Управление автомобилем
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            vehicle.speed = Math.min(vehicle.speed + acceleration * deltaTime, maxSpeed);
        } else if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            vehicle.speed = Math.max(vehicle.speed - acceleration * deltaTime, -maxSpeed * 0.5);
        } else {
            // Естественное замедление
            vehicle.speed *= 0.98;
        }

        // Поворот
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            if (Math.abs(vehicle.speed) > 0.1) {
                vehicle.group.rotation.y += turnSpeed * deltaTime * Math.sign(vehicle.speed);
            }
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            if (Math.abs(vehicle.speed) > 0.1) {
                vehicle.group.rotation.y -= turnSpeed * deltaTime * Math.sign(vehicle.speed);
            }
        }

        // Движение автомобиля
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(vehicle.group.quaternion);
        forward.multiplyScalar(vehicle.speed * deltaTime * 60);
        
        vehicle.group.position.add(forward);
        
        // Обновляем направление в системе транспорта
        vehicle.direction.copy(forward).normalize();
        
        // Синхронизируем позицию игрока с автомобилем
        this.position.copy(vehicle.group.position);
        this.position.y += 2;
    }

    checkCollisions() {
        // Простая проверка столкновений с границами города
        const cityBounds = 1000;
        
        if (this.position.x > cityBounds) this.position.x = cityBounds;
        if (this.position.x < -cityBounds) this.position.x = -cityBounds;
        if (this.position.z > cityBounds) this.position.z = cityBounds;
        if (this.position.z < -cityBounds) this.position.z = -cityBounds;
    }

    // Методы для работы с характеристиками
    takeDamage(amount) {
        this.health -= amount;
        this.health = Math.max(0, this.health);
        
        if (this.health <= 0) {
            this.die();
        }
    }

    addMoney(amount) {
        this.money += amount;
    }

    spendMoney(amount) {
        if (this.money >= amount) {
            this.money -= amount;
            return true;
        }
        return false;
    }

    increaseWantedLevel() {
        this.wantedLevel = Math.min(5, this.wantedLevel + 1);
    }

    decreaseWantedLevel() {
        this.wantedLevel = Math.max(0, this.wantedLevel - 1);
    }

    die() {
        console.log('Game Over');
        // Респавн или возврат в меню
        this.health = 100;
        this.position.set(0, 0, 0);
        this.wantedLevel = 0;
        
        if (this.isInVehicle) {
            this.exitVehicle();
        }
    }

    // Методы для сохранения/загрузки
    getPosition() {
        return this.position.clone();
    }

    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.group.position.copy(this.position);
    }

    getState() {
        return {
            position: this.position.clone(),
            health: this.health,
            money: this.money,
            wantedLevel: this.wantedLevel,
            isInVehicle: this.isInVehicle
        };
    }

    setState(state) {
        if (state.position) {
            this.setPosition(state.position.x, state.position.y, state.position.z);
        }
        if (state.health !== undefined) this.health = state.health;
        if (state.money !== undefined) this.money = state.money;
        if (state.wantedLevel !== undefined) this.wantedLevel = state.wantedLevel;
        
        if (state.isInVehicle && !this.isInVehicle) {
            // Логика для входа в автомобиль при загрузке
        } else if (!state.isInVehicle && this.isInVehicle) {
            this.exitVehicle();
        }
    }
}

// Экспортируем класс
window.Player = Player;