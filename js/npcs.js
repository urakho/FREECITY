// Система NPC (неигровых персонажей)
class NPCSystem {
    constructor(scene) {
        this.scene = scene;
        this.npcs = [];
        this.walkingPaths = [];
        this.maxNPCs = 25;
        // Кэш материалов для уменьшения количества уникальных материалов
        this._materialCache = new Map();
        // Общий низкокачественный материал для дальних NPC (импосторы)
        this._lowDetailMaterial = new THREE.MeshBasicMaterial({ color: 0x999999 });
        // Очередь восстановления материалов (чтобы не делать много работу в один кадр)
        this._restoreQueue = [];
        this._maxRestoresPerFrame = 12;
        
        this.npcTypes = [
            {
                name: 'civilian',
                male: {
                    topColors: [0x3366CC, 0x228B22, 0x8B0000, 0xFF6347, 0x4682B4, 0x696969, 0x2F4F4F],
                    bottomColors: [0x000080, 0x8B4513, 0x000000, 0x2F4F4F, 0x483D8B],
                    hairStyles: ['short', 'buzz', 'medium'],
                    bodyScale: { x: 1.0, y: 1.0, z: 1.0 }
                },
                female: {
                    topColors: [0xFF69B4, 0xFF1493, 0xDDA0DD, 0x9370DB, 0x32CD32, 0xFF6347, 0x4169E1],
                    bottomColors: [0x000080, 0x8B0000, 0x000000, 0x4B0082, 0x800080],
                    hairStyles: ['long', 'ponytail', 'curly', 'bob'],
                    bodyScale: { x: 0.9, y: 0.95, z: 0.9 }
                },
                speed: 0.5 + Math.random() * 0.3
            },
            {
                name: 'businessman',
                male: {
                    topColors: [0x222222, 0x333333, 0x111111, 0x2F2F2F],
                    bottomColors: [0x000000, 0x333333, 0x2F2F2F],
                    hairStyles: ['short', 'slicked'],
                    bodyScale: { x: 1.1, y: 1.0, z: 1.0 }
                },
                female: {
                    topColors: [0x222222, 0x333333, 0x4B0082, 0x8B0000],
                    bottomColors: [0x000000, 0x333333, 0x2F2F2F, 0x4B0082],
                    hairStyles: ['bob', 'bun', 'short'],
                    bodyScale: { x: 0.9, y: 0.95, z: 0.9 }
                },
                speed: 0.7 + Math.random() * 0.2
            },
            {
                name: 'tourist',
                male: {
                    topColors: [0xff6347, 0x32cd32, 0x1e90ff, 0xffd700, 0xff69b4],
                    bottomColors: [0xFFE4B5, 0x87CEEB, 0xF0E68C, 0xDDA0DD],
                    hairStyles: ['messy', 'cap', 'long'],
                    bodyScale: { x: 1.0, y: 1.0, z: 1.0 }
                },
                female: {
                    topColors: [0xff6347, 0x32cd32, 0x1e90ff, 0xffd700, 0xff1493],
                    bottomColors: [0xFFE4B5, 0x87CEEB, 0xF0E68C, 0xDDA0DD],
                    hairStyles: ['long', 'ponytail', 'wavy'],
                    bodyScale: { x: 0.9, y: 0.95, z: 0.9 }
                },
                speed: 0.3 + Math.random() * 0.2
            }
        ];

        // Типы анимаций для разных персонажей
        this.animationTypes = [
            'normal', 'energetic', 'slow', 'confident', 'nervous', 'casual'
        ];
    }

    initialize() {
        this.findWalkingPaths();
        this.spawnNPCs();
        console.log(`Создано ${this.npcs.length} NPC`);
    }

    findWalkingPaths() {
        // Построим пути для ходьбы вдоль тротуаров.
        // Если в сцене есть дорожная сеть (vehicleSystem.roadNetwork), используем её чтобы
        // расположить тротуары параллельно дорогам и сдвинуть от них в сторону.
        this.walkingPaths = [];
        const citySize = 500;
        const sidewalkOffset = 10; // смещение тротуара от центра дороги (увеличено для безопасности)
        const vehicleSystem = window.gameInstance && window.gameInstance.vehicleSystem;
        const added = new Set();

        if (vehicleSystem && vehicleSystem.roadNetwork && vehicleSystem.roadNetwork.length) {
            for (let i = 0; i < vehicleSystem.roadNetwork.length; i++) {
                const r = vehicleSystem.roadNetwork[i];
                if (!r || !r.position) continue;
                if (r.isHorizontal) {
                    const z = r.position.z;
                    const topZ = z + sidewalkOffset;
                    const bottomZ = z - sidewalkOffset;
                    const keyTop = `h_${topZ}`;
                    const keyBottom = `h_${bottomZ}`;
                    if (!added.has(keyTop)) {
                        added.add(keyTop);
                        this.walkingPaths.push({
                            start: new THREE.Vector3(-citySize / 2, 0, topZ),
                            end: new THREE.Vector3(citySize / 2, 0, topZ),
                            direction: new THREE.Vector3(1, 0, 0),
                            isHorizontal: true
                        });
                    }
                    if (!added.has(keyBottom)) {
                        added.add(keyBottom);
                        this.walkingPaths.push({
                            start: new THREE.Vector3(citySize / 2, 0, bottomZ),
                            end: new THREE.Vector3(-citySize / 2, 0, bottomZ),
                            direction: new THREE.Vector3(-1, 0, 0),
                            isHorizontal: true
                        });
                    }
                } else {
                    const x = r.position.x;
                    const rightX = x + sidewalkOffset;
                    const leftX = x - sidewalkOffset;
                    const keyR = `v_${rightX}`;
                    const keyL = `v_${leftX}`;
                    if (!added.has(keyR)) {
                        added.add(keyR);
                        this.walkingPaths.push({
                            start: new THREE.Vector3(rightX, 0, -citySize / 2),
                            end: new THREE.Vector3(rightX, 0, citySize / 2),
                            direction: new THREE.Vector3(0, 0, 1),
                            isHorizontal: false
                        });
                    }
                    if (!added.has(keyL)) {
                        added.add(keyL);
                        this.walkingPaths.push({
                            start: new THREE.Vector3(leftX, 0, citySize / 2),
                            end: new THREE.Vector3(leftX, 0, -citySize / 2),
                            direction: new THREE.Vector3(0, 0, -1),
                            isHorizontal: false
                        });
                    }
                }
            }
        }

        // Если дорожной сети нет или пути не создались — fallback (с увеличенным смещением)
        if (this.walkingPaths.length === 0) {
            const blockSize = 60;
            const roadCount = Math.floor(citySize / blockSize);
            for (let i = -roadCount; i <= roadCount; i++) {
                const z = i * blockSize;
                this.walkingPaths.push({
                    start: new THREE.Vector3(-citySize / 2, 0, z + sidewalkOffset),
                    end: new THREE.Vector3(citySize / 2, 0, z + sidewalkOffset),
                    direction: new THREE.Vector3(1, 0, 0),
                    isHorizontal: true
                });
                this.walkingPaths.push({
                    start: new THREE.Vector3(citySize / 2, 0, z - sidewalkOffset),
                    end: new THREE.Vector3(-citySize / 2, 0, z - sidewalkOffset),
                    direction: new THREE.Vector3(-1, 0, 0),
                    isHorizontal: true
                });
            }
            for (let i = -roadCount; i <= roadCount; i++) {
                const x = i * blockSize;
                this.walkingPaths.push({
                    start: new THREE.Vector3(x + sidewalkOffset, 0, -citySize / 2),
                    end: new THREE.Vector3(x + sidewalkOffset, 0, citySize / 2),
                    direction: new THREE.Vector3(0, 0, 1),
                    isHorizontal: false
                });
                this.walkingPaths.push({
                    start: new THREE.Vector3(x - sidewalkOffset, 0, citySize / 2),
                    end: new THREE.Vector3(x - sidewalkOffset, 0, -citySize / 2),
                    direction: new THREE.Vector3(0, 0, -1),
                    isHorizontal: false
                });
            }
        }
    }

    spawnNPCs() {
        for (let i = 0; i < this.maxNPCs; i++) {
            if (this.walkingPaths.length === 0) break;
            
            const path = this.walkingPaths[Math.floor(Math.random() * this.walkingPaths.length)];
            const npc = this.createNPC(path);
            
            if (npc) {
                this.npcs.push(npc);
                this.scene.add(npc.group);
            }
        }
    }

    // Н.С.: убираем логику убийства NPC и респавна — вместо этого NPC отступает при близком прохождении машины

    _getMaterial(color) {
        const resolved = (color && color.isColor) ? color.getHex() : color;
        const key = `c_${resolved}`;
        if (this._materialCache.has(key)) return this._materialCache.get(key);
        const mat = new THREE.MeshLambertMaterial({ color: resolved });
        this._materialCache.set(key, mat);
        return mat;
    }

    createNPC(path) {
        const npcType = this.npcTypes[Math.floor(Math.random() * this.npcTypes.length)];
        const gender = Math.random() > 0.5 ? 'male' : 'female';
        const genderData = npcType[gender];
        
        const hairStyle = genderData.hairStyles[Math.floor(Math.random() * genderData.hairStyles.length)];
        const animationType = this.animationTypes[Math.floor(Math.random() * this.animationTypes.length)];
        
        // Определяем цвета одежды и кожи на основе данных о поле
        let topColor, bottomColor;
        
        if (Math.random() > 0.7) {
            const brightColors = [...genderData.topColors, 0xFFFFFF, 0xF0E68C, 0x87CEEB, 0xFFA500];
            topColor = brightColors[Math.floor(Math.random() * brightColors.length)];
            bottomColor = genderData.bottomColors[Math.floor(Math.random() * genderData.bottomColors.length)];
        } else {
            topColor = genderData.topColors[Math.floor(Math.random() * genderData.topColors.length)];
            bottomColor = genderData.bottomColors[Math.floor(Math.random() * genderData.bottomColors.length)];
        }
        
        const group = new THREE.Group();
        
        // Тело (торс) - адаптируется под пол
        const bodyGeometry = new THREE.BoxGeometry(0.8 * genderData.bodyScale.x, 1.2 * genderData.bodyScale.y, 0.4 * genderData.bodyScale.z);
        const bodyMaterial = this._getMaterial(topColor);
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.5;
        body.castShadow = true;
        group.add(body);
        
        // Голова и определение цвета кожи
        const headGeometry = new THREE.SphereGeometry(0.3 * (gender === 'female' ? 0.9 : 1.0));
        
        // Различные оттенки кожи
        const skinTones = [
            { h: 0.08, s: 0.5, l: 0.8 + Math.random() * 0.15 }, // Светлая кожа
            { h: 0.08, s: 0.6, l: 0.6 + Math.random() * 0.2 },  // Средняя кожа  
            { h: 0.06, s: 0.7, l: 0.4 + Math.random() * 0.2 },  // Смуглая кожа
            { h: 0.04, s: 0.4, l: 0.2 + Math.random() * 0.15 }, // Темная кожа
            { h: 0.05, s: 0.5, l: 0.15 + Math.random() * 0.1 }  // Очень темная кожа
        ];
        
        const skinTone = skinTones[Math.floor(Math.random() * skinTones.length)];
        const headSkinColor = new THREE.Color().setHSL(skinTone.h, skinTone.s, skinTone.l);
        
        // Выбираем цвета одежды с учетом тона кожи (для реалистичности)
        if (skinTone.l < 0.3) {
            // Для темной кожи - яркие и светлые цвета одежды
            const brightColors = [...genderData.topColors, 0xFFFFFF, 0xF0E68C, 0x87CEEB, 0xFFA500];
            topColor = brightColors[Math.floor(Math.random() * brightColors.length)];
            bottomColor = genderData.bottomColors[Math.floor(Math.random() * genderData.bottomColors.length)];
        } else {
            // Для светлой кожи - обычная палитра
            topColor = genderData.topColors[Math.floor(Math.random() * genderData.topColors.length)];
            bottomColor = genderData.bottomColors[Math.floor(Math.random() * genderData.bottomColors.length)];
        }
        
        const headMaterial = this._getMaterial(headSkinColor.getHex());
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 2.4;
        head.castShadow = true;
        group.add(head);
        
        // Волосы в зависимости от стиля
        const hair = this.createHair(hairStyle, gender);
        group.add(hair);
        
        // Ноги с учетом пола (брюки/юбки)
        const legGeometry = new THREE.BoxGeometry(
            0.3 * genderData.bodyScale.x, 
            1 * genderData.bodyScale.y, 
            0.3 * genderData.bodyScale.z
        );
        const legMaterial = this._getMaterial(bottomColor);
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(0.2 * genderData.bodyScale.x, 0.5, 0);
        leftLeg.castShadow = true;
        group.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(-0.2 * genderData.bodyScale.x, 0.5, 0);
        rightLeg.castShadow = true;
        group.add(rightLeg);
        
        // Обувь
        const shoeColors = [0x000000, 0x8B4513, 0x654321, 0x2F2F2F, 0x800000];
        const shoeColor = shoeColors[Math.floor(Math.random() * shoeColors.length)];
        const shoeGeometry = new THREE.BoxGeometry(
            0.35 * genderData.bodyScale.x,
            0.15,
            0.5
        );
        const shoeMaterial = this._getMaterial(shoeColor);
        
        const leftShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        leftShoe.position.set(0.2 * genderData.bodyScale.x, 0.08, 0.1);
        leftShoe.castShadow = true;
        group.add(leftShoe);
        
        const rightShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        rightShoe.position.set(-0.2 * genderData.bodyScale.x, 0.08, 0.1);
        rightShoe.castShadow = true;
        group.add(rightShoe);
        
        // Руки с учетом пола и цвета кожи
        const armGeometry = new THREE.BoxGeometry(
            0.2 * genderData.bodyScale.x, 
            0.8 * genderData.bodyScale.y, 
            0.2 * genderData.bodyScale.z
        );
        const armMaterial = this._getMaterial(headSkinColor);
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(0.5 * genderData.bodyScale.x, 1.4, 0);
        leftArm.castShadow = true;
        group.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(-0.5 * genderData.bodyScale.x, 1.4, 0);
        rightArm.castShadow = true;
        group.add(rightArm);
        
        // Кисти рук того же цвета кожи
        const handGeometry = new THREE.SphereGeometry(0.08);
        const handMaterial = this._getMaterial(headSkinColor);
        
        const leftHand = new THREE.Mesh(handGeometry, handMaterial);
        leftHand.position.set(0.5 * genderData.bodyScale.x, 1.0, 0);
        leftHand.castShadow = true;
        group.add(leftHand);
        
        const rightHand = new THREE.Mesh(handGeometry, handMaterial);
        rightHand.position.set(-0.5 * genderData.bodyScale.x, 1.0, 0);
        rightHand.castShadow = true;
        group.add(rightHand);
        
        // Добавляем аксессуары в зависимости от типа
        if (npcType.name === 'businessman' && gender === 'male') {
            // Галстук
            const tieGeometry = new THREE.BoxGeometry(0.1, 0.6, 0.05);
            const tieMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
            const tie = new THREE.Mesh(tieGeometry, tieMaterial);
            tie.position.set(0, 1.3, 0.21);
            group.add(tie);
        }
        
        if (npcType.name === 'tourist') {
            // Шляпа для туристов (иногда)
            if (Math.random() > 0.6) {
                const hatGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1);
                const hatMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                const hat = new THREE.Mesh(hatGeometry, hatMaterial);
                hat.position.y = 2.7;
                group.add(hat);
            }
        }
        
        // Позиционирование на тротуаре
        const startPosition = this.getRandomPathPosition(path);
        group.position.copy(startPosition);
        
        // Поворот в направлении движения
        if (path.direction.x > 0) {
            group.rotation.y = 0;
        } else if (path.direction.x < 0) {
            group.rotation.y = Math.PI;
        } else if (path.direction.z > 0) {
            group.rotation.y = Math.PI / 2;
        } else {
            group.rotation.y = -Math.PI / 2;
        }
        
        const npc = {
            group,
            type: npcType.name,
            gender,
            speed: npcType.speed,
            direction: path.direction.clone(),
            path: path,
            targetPosition: path.end.clone(),
            walkingAnimation: {
                time: Math.random() * Math.PI * 2,
                leftLeg: leftLeg,
                rightLeg: rightLeg,
                leftArm: leftArm,
                rightArm: rightArm,
                leftHand: leftHand,
                rightHand: rightHand,
                leftShoe: leftShoe,
                rightShoe: rightShoe,
                type: animationType,
                intensity: 0.5 + Math.random() * 0.5,
                frequency: 1 + Math.random() * 0.5
            },
            state: 'walking',
            idleTime: 0,
            maxIdleTime: 3 + Math.random() * 5,
            personalityTraits: {
                nervousness: Math.random(),
                confidence: Math.random(),
                energy: Math.random()
            },
            skinColor: headSkinColor,
            // Вспомогательные поля для LOD/пропуска обновлений
            _frameCounter: 0,
            _lastUpdateTime: 0
        };
        
        return npc;
    }

    createHair(style, gender) {
        const hairColors = [0x8B4513, 0x000000, 0xFFD700, 0xA0522D, 0x696969, 0x654321];
        const hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];
        const hairMaterial = new THREE.MeshLambertMaterial({ color: hairColor });
        
        let hair;
        
        switch (style) {
            case 'short':
                hair = new THREE.Mesh(new THREE.SphereGeometry(0.32), hairMaterial);
                hair.position.y = 2.5;
                hair.scale.set(1, 0.7, 1);
                break;
                
            case 'buzz':
                hair = new THREE.Mesh(new THREE.SphereGeometry(0.31), hairMaterial);
                hair.position.y = 2.45;
                hair.scale.set(1, 0.6, 1);
                break;
                
            case 'medium':
                hair = new THREE.Mesh(new THREE.SphereGeometry(0.33), hairMaterial);
                hair.position.y = 2.5;
                hair.scale.set(1, 0.8, 1.1);
                break;
                
            case 'long':
                const longHair = new THREE.Group();
                const topHair = new THREE.Mesh(new THREE.SphereGeometry(0.32), hairMaterial);
                topHair.position.y = 2.5;
                topHair.scale.set(1, 0.8, 1);
                longHair.add(topHair);
                
                const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.2), hairMaterial);
                backHair.position.set(0, 2.1, -0.25);
                longHair.add(backHair);
                
                hair = longHair;
                break;
                
            case 'ponytail':
                const ponytail = new THREE.Group();
                const mainHair = new THREE.Mesh(new THREE.SphereGeometry(0.31), hairMaterial);
                mainHair.position.y = 2.5;
                mainHair.scale.set(1, 0.7, 1);
                ponytail.add(mainHair);
                
                const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5), hairMaterial);
                tail.position.set(0, 2.0, -0.3);
                ponytail.add(tail);
                
                hair = ponytail;
                break;
                
            case 'curly':
                hair = new THREE.Mesh(new THREE.SphereGeometry(0.35), hairMaterial);
                hair.position.y = 2.55;
                hair.scale.set(1.1, 0.9, 1.1);
                break;
                
            case 'bob':
                hair = new THREE.Mesh(new THREE.SphereGeometry(0.32), hairMaterial);
                hair.position.y = 2.5;
                hair.scale.set(1.1, 0.75, 1.1);
                break;
                
            case 'slicked':
                hair = new THREE.Mesh(new THREE.SphereGeometry(0.31), hairMaterial);
                hair.position.y = 2.48;
                hair.scale.set(1, 0.6, 0.9);
                break;
                
            case 'bun':
                const bun = new THREE.Group();
                const baseHair = new THREE.Mesh(new THREE.SphereGeometry(0.3), hairMaterial);
                baseHair.position.y = 2.45;
                baseHair.scale.set(1, 0.6, 1);
                bun.add(baseHair);
                
                const bunTop = new THREE.Mesh(new THREE.SphereGeometry(0.15), hairMaterial);
                bunTop.position.set(0, 2.7, -0.2);
                bun.add(bunTop);
                
                hair = bun;
                break;
                
            case 'wavy':
                hair = new THREE.Mesh(new THREE.SphereGeometry(0.33), hairMaterial);
                hair.position.y = 2.52;
                hair.scale.set(1.05, 0.85, 1.05);
                break;
                
            case 'messy':
                hair = new THREE.Mesh(new THREE.SphereGeometry(0.34), hairMaterial);
                hair.position.y = 2.53;
                hair.scale.set(1.1, 0.8, 1.1);
                break;
                
            case 'cap':
                const cap = new THREE.Group();
                const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15), new THREE.MeshLambertMaterial({ color: 0x4169E1 }));
                capBase.position.y = 2.6;
                cap.add(capBase);
                
                const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.02), new THREE.MeshLambertMaterial({ color: 0x4169E1 }));
                visor.position.set(0, 2.52, 0.25);
                visor.rotation.x = Math.PI / 8;
                cap.add(visor);
                
                hair = cap;
                break;
                
            default:
                hair = new THREE.Mesh(new THREE.SphereGeometry(0.32), hairMaterial);
                hair.position.y = 2.5;
                hair.scale.y = 0.8;
        }
        
        hair.castShadow = true;
        return hair;
    }

    getRandomPathPosition(path) {
        const t = Math.random();
        const position = new THREE.Vector3().lerpVectors(path.start, path.end, t);
        position.y = 0;

        // Небольшие смещения по тротуару, чтобы NPC не шли строго по центру линии
        const lateralJitter = (Math.random() - 0.5) * 3.0; // до ±1.5 ед.
        if (path.isHorizontal) {
            position.z += lateralJitter;
        } else {
            position.x += lateralJitter;
        }

        // Если есть система дорог, убедимся, что позиция не оказывается на проезжей части
        const vehicleSystem = window.gameInstance && window.gameInstance.vehicleSystem;
        const roadHalfWidth = 3.5; // приблизительная половина проезжей части
        try {
            if (vehicleSystem && vehicleSystem.roadNetwork && vehicleSystem.roadNetwork.length) {
                for (let i = 0; i < vehicleSystem.roadNetwork.length; i++) {
                    const r = vehicleSystem.roadNetwork[i];
                    if (!r || !r.position) continue;
                    if (r.isHorizontal) {
                        const dz = Math.abs(position.z - r.position.z);
                        if (dz < roadHalfWidth + 0.5) {
                            // Оттолкнуть на безопасное расстояние в сторону
                            const sign = (position.z - r.position.z) >= 0 ? 1 : -1;
                            position.z = r.position.z + sign * (roadHalfWidth + 1.5);
                        }
                    } else {
                        const dx = Math.abs(position.x - r.position.x);
                        if (dx < roadHalfWidth + 0.5) {
                            const sign = (position.x - r.position.x) >= 0 ? 1 : -1;
                            position.x = r.position.x + sign * (roadHalfWidth + 1.5);
                        }
                    }
                }
            }
        } catch (e) {}

        return position;
    }

    update(deltaTime, camera) {
        // Если передана камера, используем дистанционное LOD/отсечение и редкое обновление дальних NPC
        if (camera) {
            const camPos = camera.position;
            const fullRangeSq = 60 * 60; // внутри 60 ед. — полное обновление
            const partialRangeSq = 120 * 120; // 60-120 — обновление реже
            const cullRangeSq = 200 * 200; // дальше 200 — не рендерить/не обновлять

            for (let i = 0; i < this.npcs.length; i++) {
                const npc = this.npcs[i];
                const dist2 = camPos.distanceToSquared(npc.group.position);

                if (dist2 > cullRangeSq) {
                    // Дальний диапазон: не прячем персонажей, а показываем упрощённую версию (импостор)
                    if (!npc._isImpostor) {
                        npc._isImpostor = true;
                        npc._savedMaterials = [];
                        // Преобразование в импостор может быть дорогим для больших групп — делаем это частично
                        npc.group.traverse(child => {
                            if (child.isMesh) {
                                npc._savedMaterials.push({ mesh: child, mat: child.material });
                                child.material = this._lowDetailMaterial;
                            }
                        });
                    }
                    // Пропускаем обновления анимации/логики для дальних NPC
                    continue;
                }

                // Если ранее был impostor — восстановить материалы
                if (npc._isImpostor) {
                    // Не восстанавливаем всё сразу — ставим в очередь восстановления
                    if (!npc._queuedForRestore) {
                        npc._queuedForRestore = true;
                        this._restoreQueue.push(npc);
                    }
                    // Пока NPC не восстановлен, пропускаем обновления
                    continue;
                }

                // Видим или близко — показываем
                if (!npc.group.visible) npc.group.visible = true;

                if (dist2 > partialRangeSq) {
                    // Дальний диапазон: обновляем движение и поведение реже
                    npc._frameCounter = (npc._frameCounter || 0) + 1;
                    if (npc._frameCounter % 2 === 0) {
                        this.updateNPC(npc, deltaTime * 0.5);
                    }
                } else {
                    // Близкий диапазон: полное обновление
                    this.updateNPC(npc, deltaTime);
                }
            }
        } else {
            // Без камеры — поведение прежнее
            this.npcs.forEach(npc => this.updateNPC(npc, deltaTime));
        }

        // Обрабатываем очередь восстановления (фиксированное количество в кадр)
        let restores = 0;
        while (this._restoreQueue.length > 0 && restores < this._maxRestoresPerFrame) {
            const npcToRestore = this._restoreQueue.shift();
            if (!npcToRestore) continue;
            npcToRestore._queuedForRestore = false;
            // Восстанавливаем материалы
            if (npcToRestore._savedMaterials && npcToRestore._savedMaterials.length) {
                for (let s = 0; s < npcToRestore._savedMaterials.length; s++) {
                    const entry = npcToRestore._savedMaterials[s];
                    if (entry && entry.mesh) {
                        entry.mesh.material = entry.mat;
                    }
                }
            }
            npcToRestore._isImpostor = false;
            npcToRestore._savedMaterials = null;
            restores++;
        }
    }

    updateNPC(npc, deltaTime) {
        if (npc.state === 'walking') {
            this.updateWalking(npc, deltaTime);
            this.updateWalkingAnimation(npc, deltaTime);
        } else if (npc.state === 'idle') {
            this.updateIdle(npc, deltaTime);
        }
        
        // Случайная смена состояния
        if (Math.random() < 0.001) { // 0.1% шанс каждый кадр
            this.changeNPCState(npc);
        }
    }

    updateWalking(npc, deltaTime) {
        // Если мёртв — не обновляем
        if (npc.state === 'dead') return;

        const moveDistance = npc.speed * deltaTime * 60;

        // Если NPC перебегает дорогу — используем цель crossTarget и чуть большую скорость
        if (npc.state === 'crossing' && npc.crossTarget) {
            const dir = new THREE.Vector3().subVectors(npc.crossTarget, npc.group.position);
            const dist = dir.length();
            if (dist < 0.5) {
                // Достиг другой стороны
                npc.state = 'walking';
                npc.crossTarget = null;
            } else {
                dir.normalize();
                const movement = dir.multiplyScalar(moveDistance * 1.6);
                npc.group.position.add(movement);
                // Проверяем столкновения с машинами
                this._checkVehicleCollisions(npc);
                return;
            }
        }

        const movement = npc.direction.clone().multiplyScalar(moveDistance);
        npc.group.position.add(movement);
        
        // Проверяем, достиг ли NPC конца пути
        const distanceToTarget = npc.group.position.distanceTo(npc.targetPosition);
        if (distanceToTarget < 5 || this.isOutOfBounds(npc.group.position)) {
            // Иногда при достижении края пути - попытаемся перебежать дорогу
            if (Math.random() < 0.35) {
                if (this.attemptCrossRoad(npc)) {
                    return;
                }
            }
            this.respawnNPC(npc);
        }
    }

    attemptCrossRoad(npc) {
        // Попробовать перейти дорогу, но только если рядом найдена подходящая перпендикулярная дорога
        if (!npc.path) return false;

        const vehicleSystem = window.gameInstance && window.gameInstance.vehicleSystem;
        const crossSearchDist = 40; // макс. расстояние до дороги, где можно перейти
        const roadHalfWidth = 3.5;
        const curPos = npc.group.position.clone();
        let foundRoad = null;

        if (vehicleSystem && vehicleSystem.roadNetwork && vehicleSystem.roadNetwork.length) {
            for (let i = 0; i < vehicleSystem.roadNetwork.length; i++) {
                const r = vehicleSystem.roadNetwork[i];
                if (!r || !r.position) continue;
                // Ищем дорогу, перпендикулярную текущему пути
                if (r.isHorizontal === npc.path.isHorizontal) continue;

                if (r.isHorizontal) {
                    const dz = Math.abs(curPos.z - r.position.z);
                    if (dz < crossSearchDist) {
                        foundRoad = r;
                        break;
                    }
                } else {
                    const dx = Math.abs(curPos.x - r.position.x);
                    if (dx < crossSearchDist) {
                        foundRoad = r;
                        break;
                    }
                }
            }
        }

        // Если не нашли подходящей дороги рядом — не перебегаем
        if (!foundRoad) return false;

        // Вычисляем цель на другой стороне проезжей части
        const target = curPos.clone();
        if (npc.path.isHorizontal) {
            // ходим по X, значит пересекаем по Z
            const sign = (curPos.z < foundRoad.position.z) ? 1 : -1;
            target.z = foundRoad.position.z + sign * (roadHalfWidth + 2 + 6); // проезжая часть + тротуар
        } else {
            const sign = (curPos.x < foundRoad.position.x) ? 1 : -1;
            target.x = foundRoad.position.x + sign * (roadHalfWidth + 2 + 6);
        }

        if (this.isOutOfBounds(target)) return false;

        npc.state = 'crossing';
        npc.crossTarget = target;
        npc.speed = npc.speed * (1.2 + Math.random() * 0.4);
        return true;
    }

    _checkVehicleCollisions(npc) {
        // Проверяем машины в глобальной системе, если она есть
        try {
            const vehicleSystem = window.gameInstance && window.gameInstance.vehicleSystem;
            if (!vehicleSystem || !vehicleSystem.vehicles) return;

            const npPos = npc.group.position;
            for (let i = 0; i < vehicleSystem.vehicles.length; i++) {
                const v = vehicleSystem.vehicles[i];
                if (!v || !v.group) continue;

                const vPos = v.group.position;
                const dx = npPos.x - vPos.x;
                const dz = npPos.z - vPos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Размеры и порог столкновения
                const vehicleSize = (v.type === 'truck') ? 3.2 : (v.type === 'suv' ? 2.8 : 2.2);
                const collisionRadius = 1.2 + vehicleSize;

                if (dist < collisionRadius) {
                    // Машина рядом — отходим в сторону вместо смерти
                    try {
                        npc.state = 'idle';
                        npc.idleTime = 0;
                        // Оттолкнуть NPC немного в сторону от машины
                        const push = new THREE.Vector3().subVectors(npc.group.position, v.group.position);
                        push.y = 0;
                        if (push.lengthSq() > 0.0001) push.normalize().multiplyScalar(1.5);
                        else push.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(1.5);
                        npc.group.position.add(push);
                        npc.crossTarget = null;
                    } catch (e) {
                        // ignore
                    }
                    return;
                }

                // Также если машина очень близко спереди по направлению движения — шанс быть сбитым
                const toVehicle = new THREE.Vector3().subVectors(vPos, npPos).normalize();
                const approachDot = toVehicle.dot(v.direction || new THREE.Vector3(0,0,1));
                        if (dist < collisionRadius * 3 && approachDot > 0.5) {
                    // Машина приближается — NPC старается уйти с дороги
                    if (npc.state === 'crossing') {
                        try {
                            const push = new THREE.Vector3().subVectors(npc.group.position, v.group.position);
                            push.y = 0;
                            if (push.lengthSq() > 0.0001) push.normalize().multiplyScalar(1.0);
                            else push.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(1.0);
                            npc.group.position.add(push);
                            npc.crossTarget = null;
                            npc.state = 'idle';
                            npc.idleTime = 0;
                        } catch (e) {}
                        return;
                    }
                }
            }
        } catch (e) {
            // Безопасно игнорируем
        }
    }

    updateWalkingAnimation(npc, deltaTime) {
        const animSpeed = deltaTime * 8 * npc.walkingAnimation.frequency;
        npc.walkingAnimation.time += animSpeed;
        
        let legSwing, armSwing, bodyBob = 0;
        
        // Разные типы анимации
        switch (npc.walkingAnimation.type) {
            case 'energetic':
                legSwing = Math.sin(npc.walkingAnimation.time) * 0.5 * npc.walkingAnimation.intensity;
                armSwing = Math.sin(npc.walkingAnimation.time + Math.PI) * 0.4 * npc.walkingAnimation.intensity;
                bodyBob = Math.sin(npc.walkingAnimation.time * 2) * 0.1;
                break;
                
            case 'slow':
                legSwing = Math.sin(npc.walkingAnimation.time * 0.7) * 0.2 * npc.walkingAnimation.intensity;
                armSwing = Math.sin(npc.walkingAnimation.time * 0.7 + Math.PI) * 0.15 * npc.walkingAnimation.intensity;
                bodyBob = Math.sin(npc.walkingAnimation.time * 1.4) * 0.05;
                break;
                
            case 'confident':
                legSwing = Math.sin(npc.walkingAnimation.time) * 0.35 * npc.walkingAnimation.intensity;
                armSwing = Math.sin(npc.walkingAnimation.time + Math.PI) * 0.3 * npc.walkingAnimation.intensity;
                bodyBob = 0; // Уверенная походка без качания
                // Прямая спина
                npc.group.rotation.z = Math.sin(npc.walkingAnimation.time) * 0.02;
                break;
                
            case 'nervous':
                legSwing = Math.sin(npc.walkingAnimation.time * 1.2) * 0.25 * npc.walkingAnimation.intensity;
                armSwing = Math.sin(npc.walkingAnimation.time * 1.2 + Math.PI) * 0.2 * npc.walkingAnimation.intensity;
                bodyBob = Math.sin(npc.walkingAnimation.time * 2.4) * 0.08;
                // Нервное подергивание
                if (Math.random() < 0.1) {
                    armSwing += (Math.random() - 0.5) * 0.1;
                }
                break;
                
            case 'casual':
                legSwing = Math.sin(npc.walkingAnimation.time * 0.9) * 0.3 * npc.walkingAnimation.intensity;
                armSwing = Math.sin(npc.walkingAnimation.time * 0.9 + Math.PI) * 0.25 * npc.walkingAnimation.intensity;
                bodyBob = Math.sin(npc.walkingAnimation.time * 1.8) * 0.06;
                break;
                
            default: // normal
                legSwing = Math.sin(npc.walkingAnimation.time) * 0.3 * npc.walkingAnimation.intensity;
                armSwing = Math.sin(npc.walkingAnimation.time + Math.PI) * 0.2 * npc.walkingAnimation.intensity;
                bodyBob = Math.sin(npc.walkingAnimation.time * 2) * 0.07;
        }
        
        // Анимация ног
        npc.walkingAnimation.leftLeg.rotation.x = legSwing;
        npc.walkingAnimation.rightLeg.rotation.x = -legSwing;
        
        // Анимация рук с учетом пола
        const armMultiplier = npc.gender === 'female' ? 0.8 : 1.0;
        npc.walkingAnimation.leftArm.rotation.x = armSwing * armMultiplier;
        npc.walkingAnimation.rightArm.rotation.x = -armSwing * armMultiplier;
        
        // Кисти рук следуют за движением рук
        if (npc.walkingAnimation.leftHand && npc.walkingAnimation.rightHand) {
            npc.walkingAnimation.leftHand.rotation.x = armSwing * armMultiplier * 0.5;
            npc.walkingAnimation.rightHand.rotation.x = -armSwing * armMultiplier * 0.5;
        }
        
        // Анимация обуви (небольшое движение при ходьбе)
        if (npc.walkingAnimation.leftShoe && npc.walkingAnimation.rightShoe) {
            npc.walkingAnimation.leftShoe.rotation.x = legSwing * 0.3;
            npc.walkingAnimation.rightShoe.rotation.x = -legSwing * 0.3;
        }
        
        // Покачивание тела
        if (bodyBob !== 0) {
            npc.group.position.y = bodyBob;
        }
        
        // Дополнительные женские анимации
        if (npc.gender === 'female') {
            // Легкое покачивание бедрами
            const hipSway = Math.sin(npc.walkingAnimation.time) * 0.05;
            npc.group.rotation.y += hipSway;
            
            // Более элегантное движение рук
            npc.walkingAnimation.leftArm.rotation.z = Math.sin(npc.walkingAnimation.time) * 0.1;
            npc.walkingAnimation.rightArm.rotation.z = -Math.sin(npc.walkingAnimation.time) * 0.1;
        }
        
        // Персональные черты влияют на анимацию
        if (npc.personalityTraits.nervousness > 0.7) {
            // Быстрые, дерганые движения
            const nervousTwitch = Math.sin(npc.walkingAnimation.time * 3) * 0.05;
            npc.walkingAnimation.leftArm.rotation.y = nervousTwitch;
            npc.walkingAnimation.rightArm.rotation.y = -nervousTwitch;
        }
        
        if (npc.personalityTraits.confidence > 0.8) {
            // Широкие шаги
            legSwing *= 1.2;
            npc.walkingAnimation.leftLeg.rotation.x = legSwing;
            npc.walkingAnimation.rightLeg.rotation.x = -legSwing;
        }
        
        if (npc.personalityTraits.energy > 0.8) {
            // Подпрыгивание при ходьбе
            const energyBounce = Math.abs(Math.sin(npc.walkingAnimation.time * 2)) * 0.1;
            npc.group.position.y += energyBounce;
        }
    }

    updateIdle(npc, deltaTime) {
        npc.idleTime += deltaTime;
        
        // Разные типы простоя в зависимости от типа персонажа и пола
        const idleTime = npc.idleTime * 2;
        
        if (npc.type === 'businessman') {
            // Деловые люди проверяют время, говорят по телефону
            if (Math.sin(idleTime) > 0.8) {
                // Поднимает руку к уху (телефон)
                npc.walkingAnimation.rightArm.rotation.x = -Math.PI / 3;
                npc.walkingAnimation.rightArm.rotation.z = Math.PI / 4;
            } else if (Math.sin(idleTime * 1.5) > 0.9) {
                // Смотрит на запястье (часы)
                npc.walkingAnimation.leftArm.rotation.x = -Math.PI / 6;
                npc.walkingAnimation.leftArm.rotation.z = -Math.PI / 6;
            } else {
                // Возвращаем руки в нормальное положение
                npc.walkingAnimation.leftArm.rotation.x = 0;
                npc.walkingAnimation.leftArm.rotation.z = 0;
                npc.walkingAnimation.rightArm.rotation.x = 0;
                npc.walkingAnimation.rightArm.rotation.z = 0;
            }
        } else if (npc.type === 'tourist') {
            // Туристы осматриваются, фотографируют
            const lookAround = Math.sin(idleTime * 0.7) * 0.5;
            npc.group.rotation.y += lookAround * deltaTime;
            
            if (Math.sin(idleTime * 1.2) > 0.85) {
                // Поднимает руки (фотографирует)
                npc.walkingAnimation.leftArm.rotation.x = -Math.PI / 4;
                npc.walkingAnimation.rightArm.rotation.x = -Math.PI / 4;
                npc.walkingAnimation.leftArm.rotation.z = -Math.PI / 6;
                npc.walkingAnimation.rightArm.rotation.z = Math.PI / 6;
            }
        } else {
            // Обычные граждане
            if (npc.gender === 'female') {
                // Женщины могут поправить волосы
                if (Math.sin(idleTime * 1.3) > 0.9) {
                    npc.walkingAnimation.rightArm.rotation.x = -Math.PI / 3;
                    npc.walkingAnimation.rightArm.rotation.z = Math.PI / 4;
                }
            } else {
                // Мужчины могут почесать затылок
                if (Math.sin(idleTime * 1.1) > 0.9) {
                    npc.walkingAnimation.rightArm.rotation.x = -Math.PI / 2;
                    npc.walkingAnimation.rightArm.rotation.z = Math.PI / 3;
                }
            }
        }
        
        // Небольшое покачивание
        const sway = Math.sin(idleTime * 0.5) * 0.05;
        npc.group.position.y = sway;
        
        // Дыхание (движение торса)
        const breathing = Math.sin(idleTime * 3) * 0.02;
        const body = npc.group.children.find(child => child.geometry && child.geometry.type === 'BoxGeometry' && child.position.y > 1);
        if (body) {
            body.scale.z = 1 + breathing;
        }
        
        // Возврат к ходьбе после максимального времени ожидания
        if (npc.idleTime >= npc.maxIdleTime) {
            npc.state = 'walking';
            npc.idleTime = 0;
            npc.group.position.y = 0;
            
            // Сброс анимаций рук и кистей
            npc.walkingAnimation.leftArm.rotation.x = 0;
            npc.walkingAnimation.leftArm.rotation.z = 0;
            npc.walkingAnimation.rightArm.rotation.x = 0;
            npc.walkingAnimation.rightArm.rotation.z = 0;
            
            if (npc.walkingAnimation.leftHand && npc.walkingAnimation.rightHand) {
                npc.walkingAnimation.leftHand.rotation.x = 0;
                npc.walkingAnimation.rightHand.rotation.x = 0;
            }
        }
    }

    changeNPCState(npc) {
        if (npc.state === 'walking' && Math.random() > 0.7) {
            npc.state = 'idle';
            npc.idleTime = 0;
            
            // Останавливаем анимацию ходьбы
            npc.walkingAnimation.leftLeg.rotation.x = 0;
            npc.walkingAnimation.rightLeg.rotation.x = 0;
            npc.walkingAnimation.leftArm.rotation.x = 0;
            npc.walkingAnimation.rightArm.rotation.x = 0;
        }
    }

    isOutOfBounds(position) {
        const bounds = 600;
        return Math.abs(position.x) > bounds || Math.abs(position.z) > bounds;
    }

    respawnNPC(npc) {
        // Выбираем новый путь
        const newPath = this.walkingPaths[Math.floor(Math.random() * this.walkingPaths.length)];
        const newPosition = this.getRandomPathPosition(newPath);
        
        npc.group.position.copy(newPosition);
        npc.path = newPath;
        npc.direction = newPath.direction.clone();
        npc.targetPosition = newPath.end.clone();
        npc.state = 'walking';
        npc.idleTime = 0;
        
        // Обновляем поворот
        if (newPath.direction.x > 0) {
            npc.group.rotation.y = 0;
        } else if (newPath.direction.x < 0) {
            npc.group.rotation.y = Math.PI;
        } else if (newPath.direction.z > 0) {
            npc.group.rotation.y = Math.PI / 2;
        } else {
            npc.group.rotation.y = -Math.PI / 2;
        }
    }

    // Дополнительные поведения NPC
    addRandomBehaviors() {
        this.npcs.forEach(npc => {
            // Пропускаем дальние/невидимые NPC — экономия CPU
            if (npc.group && npc.group.visible === false) return;
            // Случайные повороты головы в зависимости от типа
            const headTurnChance = npc.type === 'tourist' ? 0.02 : 0.01;
            if (Math.random() < headTurnChance) {
                const head = npc.group.children.find(child => 
                    child.geometry && 
                    (child.geometry.type === 'SphereGeometry' || child.geometry.isGeometry) && 
                    child.position.y > 2
                );
                if (head) {
                    const turnAngle = (Math.random() - 0.5) * (npc.type === 'tourist' ? 1.0 : 0.5);
                    head.rotation.y = turnAngle;
                    
                    // Возврат головы в нормальное положение
                    setTimeout(() => {
                        if (head.rotation) head.rotation.y = 0;
                    }, 1000 + Math.random() * 2000);
                }
            }
            
            // Разные жесты в зависимости от пола и типа
            if (Math.random() < 0.003) {
                const rightArm = npc.walkingAnimation.rightArm;
                const leftArm = npc.walkingAnimation.leftArm;
                const originalRightRotation = rightArm.rotation.x;
                const originalLeftRotation = leftArm.rotation.x;
                
                if (npc.gender === 'female') {
                    if (npc.type === 'civilian') {
                        // Женщины могут помахать рукой
                        rightArm.rotation.x = -Math.PI / 6;
                        rightArm.rotation.z = Math.PI / 4;
                        
                        // Машут рукой
                        let waveCount = 0;
                        const waveInterval = setInterval(() => {
                            rightArm.rotation.z = Math.PI / 4 + Math.sin(Date.now() * 0.01) * Math.PI / 8;
                            waveCount++;
                            if (waveCount > 30) {
                                clearInterval(waveInterval);
                                rightArm.rotation.x = originalRightRotation;
                                rightArm.rotation.z = 0;
                            }
                        }, 50);
                    } else if (npc.type === 'businessman') {
                        // Деловые женщины могут поправить одежду
                        leftArm.rotation.x = -Math.PI / 4;
                        leftArm.rotation.z = -Math.PI / 6;
                        
                        setTimeout(() => {
                            leftArm.rotation.x = originalLeftRotation;
                            leftArm.rotation.z = 0;
                        }, 1500);
                    }
                } else {
                    if (npc.type === 'businessman') {
                        // Деловые мужчины могут поправить галстук
                        rightArm.rotation.x = -Math.PI / 6;
                        rightArm.rotation.y = Math.PI / 8;
                        
                        setTimeout(() => {
                            rightArm.rotation.x = originalRightRotation;
                            rightArm.rotation.y = 0;
                        }, 1000);
                    } else if (npc.type === 'tourist') {
                        // Туристы-мужчины могут указать на что-то
                        rightArm.rotation.x = -Math.PI / 3;
                        rightArm.rotation.z = Math.PI / 6;
                        
                        setTimeout(() => {
                            rightArm.rotation.x = originalRightRotation;
                            rightArm.rotation.z = 0;
                        }, 2000);
                    } else {
                        // Обычные мужчины могут потянуться
                        rightArm.rotation.x = -Math.PI / 2;
                        leftArm.rotation.x = -Math.PI / 2;
                        
                        setTimeout(() => {
                            rightArm.rotation.x = originalRightRotation;
                            leftArm.rotation.x = originalLeftRotation;
                        }, 1500);
                    }
                }
            }
            
            // Эмоциональные реакции на основе черт личности
            if (Math.random() < 0.001) {
                if (npc.personalityTraits.nervousness > 0.7) {
                    // Нервные NPC могут оглядываться
                    const currentRotation = npc.group.rotation.y;
                    npc.group.rotation.y += (Math.random() - 0.5) * Math.PI / 2;
                    
                    setTimeout(() => {
                        npc.group.rotation.y = currentRotation;
                    }, 500);
                }
                
                if (npc.personalityTraits.energy > 0.8) {
                    // Энергичные NPC могут подпрыгнуть
                    const originalY = npc.group.position.y;
                    let jumpHeight = 0;
                    const jumpDuration = 300;
                    const startTime = Date.now();
                    
                    const jumpInterval = setInterval(() => {
                        const elapsed = Date.now() - startTime;
                        const progress = elapsed / jumpDuration;
                        
                        if (progress < 0.5) {
                            jumpHeight = progress * 2 * 0.3;
                        } else {
                            jumpHeight = (2 - progress * 2) * 0.3;
                        }
                        
                        npc.group.position.y = originalY + jumpHeight;
                        
                        if (progress >= 1) {
                            clearInterval(jumpInterval);
                            npc.group.position.y = originalY;
                        }
                    }, 16);
                }
            }
        });
    }

    destroy() {
        this.npcs.forEach(npc => {
            this.scene.remove(npc.group);
            
            // Очищаем геометрию и материалы
            npc.group.traverse(child => {
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
        
        this.npcs = [];
    }

    // Методы для взаимодействия с игроком
    getNearbyNPCs(playerPosition, radius = 10) {
        return this.npcs.filter(npc => {
            const distance = npc.group.position.distanceTo(playerPosition);
            return distance <= radius;
        });
    }

    makeNPCReactToPlayer(npc, playerPosition) {
        // NPC поворачивается к игроку
        const direction = new THREE.Vector3().subVectors(playerPosition, npc.group.position);
        const angle = Math.atan2(direction.x, direction.z);
        npc.group.rotation.y = angle;
        
        // Переходит в состояние ожидания
        npc.state = 'idle';
        npc.idleTime = 0;
    }
}

// Экспортируем класс
window.NPCSystem = NPCSystem;