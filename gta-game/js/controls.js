// Система управления
class ControlsSystem {
    constructor() {
        this.isEnabled = true;
        this.keyStates = {};
        this.mouseState = {
            x: 0,
            y: 0,
            deltaX: 0,
            deltaY: 0,
            leftButton: false,
            rightButton: false
        };
        
        this.touchState = {
            touches: new Map(),
            joystick: { x: 0, y: 0, active: false }
        };

        this.pointerLocked = false;
        this.init();
    }

    init() {
        this.setupKeyboardControls();
        this.setupMouseControls();
        this.setupTouchControls();
        this.setupGamepadSupport();
        this.createTouchInterface();
        
        console.log('Controls system initialized');
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            if (!this.isEnabled) return;
            
            this.keyStates[event.code] = true;
            this.handleSpecialKeys(event);
        });

        document.addEventListener('keyup', (event) => {
            if (!this.isEnabled) return;
            
            this.keyStates[event.code] = false;
        });

        // Предотвращаем действия браузера по умолчанию
        document.addEventListener('keydown', (event) => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
                event.preventDefault();
            }
        });
    }

    setupMouseControls() {
        // Клик для захвата курсора
        document.addEventListener('click', () => {
            if (!this.pointerLocked && this.isEnabled) {
                document.body.requestPointerLock().catch(error => {
                    console.warn('Pointer lock request failed:', error);
                });
            }
        });

        // Обработка захвата/освобождения курсора
        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = document.pointerLockElement === document.body;
            
            if (this.pointerLocked) {
                console.log('Pointer locked');
            } else {
                console.log('Pointer unlocked');
            }
        });

        // Движение мыши
        document.addEventListener('mousemove', (event) => {
            if (!this.isEnabled || !this.pointerLocked) return;
            
            this.mouseState.deltaX = event.movementX;
            this.mouseState.deltaY = event.movementY;
        });

        // Кнопки мыши
        document.addEventListener('mousedown', (event) => {
            if (!this.isEnabled) return;
            
            if (event.button === 0) this.mouseState.leftButton = true;
            if (event.button === 2) this.mouseState.rightButton = true;
        });

        document.addEventListener('mouseup', (event) => {
            if (!this.isEnabled) return;
            
            if (event.button === 0) this.mouseState.leftButton = false;
            if (event.button === 2) this.mouseState.rightButton = false;
        });

        // Отключаем контекстное меню
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }

    setupTouchControls() {
        // Touch события
        document.addEventListener('touchstart', (event) => {
            this.handleTouchStart(event);
        }, { passive: false });

        document.addEventListener('touchmove', (event) => {
            this.handleTouchMove(event);
        }, { passive: false });

        document.addEventListener('touchend', (event) => {
            this.handleTouchEnd(event);
        }, { passive: false });
    }

    createTouchInterface() {
        if (!this.isTouchDevice()) return;

        // Создаём виртуальный джойстик для мобильных устройств
        this.createVirtualJoystick();
        this.createTouchButtons();
    }

    createVirtualJoystick() {
        const joystickContainer = document.createElement('div');
        joystickContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 120px;
            height: 120px;
            border: 2px solid rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.3);
            z-index: 1000;
            touch-action: none;
        `;
        joystickContainer.id = 'virtualJoystick';

        const joystickKnob = document.createElement('div');
        joystickKnob.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.8);
            transform: translate(-50%, -50%);
            transition: all 0.1s ease;
        `;
        joystickKnob.id = 'joystickKnob';

        joystickContainer.appendChild(joystickKnob);
        document.body.appendChild(joystickContainer);

        this.joystickContainer = joystickContainer;
        this.joystickKnob = joystickKnob;
    }

    createTouchButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 1000;
        `;

        // Кнопка прыжка
        const jumpButton = this.createTouchButton('ПРЫЖОК', () => {
            if (window.gameInstance && window.gameInstance.player) {
                window.gameInstance.player.jump();
            }
        });

        // Кнопка бега
        const runButton = this.createTouchButton('БЕГ', null, true);
        runButton.addEventListener('touchstart', () => {
            this.keyStates['ShiftLeft'] = true;
        });
        runButton.addEventListener('touchend', () => {
            this.keyStates['ShiftLeft'] = false;
        });

        // Кнопка взаимодействия
        const interactButton = this.createTouchButton('F', () => {
            if (window.gameInstance && window.gameInstance.player) {
                window.gameInstance.player.interactWithVehicle();
            }
        });

        buttonContainer.appendChild(jumpButton);
        buttonContainer.appendChild(runButton);
        buttonContainer.appendChild(interactButton);
        document.body.appendChild(buttonContainer);
    }

    createTouchButton(text, onPress, holdable = false) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            padding: 15px 20px;
            background: rgba(255, 215, 0, 0.8);
            color: black;
            border: none;
            border-radius: 5px;
            font-family: 'Orbitron', monospace;
            font-weight: 700;
            font-size: 12px;
            touch-action: manipulation;
            user-select: none;
        `;

        if (holdable) {
            button.addEventListener('touchstart', (event) => {
                event.preventDefault();
                button.style.background = 'rgba(255, 165, 0, 0.8)';
            });
            button.addEventListener('touchend', (event) => {
                event.preventDefault();
                button.style.background = 'rgba(255, 215, 0, 0.8)';
            });
        } else if (onPress) {
            button.addEventListener('touchstart', (event) => {
                event.preventDefault();
                button.style.background = 'rgba(255, 165, 0, 0.8)';
                onPress();
            });
            button.addEventListener('touchend', (event) => {
                event.preventDefault();
                button.style.background = 'rgba(255, 215, 0, 0.8)';
            });
        }

        return button;
    }

    handleTouchStart(event) {
        if (!this.isEnabled) return;
        
        event.preventDefault();
        
        for (let touch of event.changedTouches) {
            this.touchState.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startX: touch.clientX,
                startY: touch.clientY
            });
            
            // Проверяем, касается ли виртуального джойстика
            if (this.joystickContainer && this.isTouchInElement(touch, this.joystickContainer)) {
                this.touchState.joystick.active = true;
                this.updateJoystick(touch);
            }
        }
    }

    handleTouchMove(event) {
        if (!this.isEnabled) return;
        
        event.preventDefault();
        
        for (let touch of event.changedTouches) {
            if (this.touchState.touches.has(touch.identifier)) {
                const touchData = this.touchState.touches.get(touch.identifier);
                touchData.x = touch.clientX;
                touchData.y = touch.clientY;
                
                if (this.touchState.joystick.active) {
                    this.updateJoystick(touch);
                }
            }
        }
    }

    handleTouchEnd(event) {
        if (!this.isEnabled) return;
        
        event.preventDefault();
        
        for (let touch of event.changedTouches) {
            if (this.touchState.touches.has(touch.identifier)) {
                this.touchState.touches.delete(touch.identifier);
                
                if (this.touchState.joystick.active) {
                    this.touchState.joystick.active = false;
                    this.touchState.joystick.x = 0;
                    this.touchState.joystick.y = 0;
                    this.resetJoystick();
                }
            }
        }
    }

    updateJoystick(touch) {
        if (!this.joystickContainer) return;
        
        const rect = this.joystickContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let deltaX = touch.clientX - centerX;
        let deltaY = touch.clientY - centerY;
        
        const maxDistance = rect.width / 2 - 20;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > maxDistance) {
            deltaX = (deltaX / distance) * maxDistance;
            deltaY = (deltaY / distance) * maxDistance;
        }
        
        this.touchState.joystick.x = deltaX / maxDistance;
        this.touchState.joystick.y = -deltaY / maxDistance; // Инвертируем Y
        
        // Обновляем визуальное положение джойстика
        if (this.joystickKnob) {
            this.joystickKnob.style.transform = `translate(${-50 + (deltaX / maxDistance) * 30}%, ${-50 - (deltaY / maxDistance) * 30}%)`;
        }
    }

    resetJoystick() {
        if (this.joystickKnob) {
            this.joystickKnob.style.transform = 'translate(-50%, -50%)';
        }
    }

    isTouchInElement(touch, element) {
        const rect = element.getBoundingClientRect();
        return touch.clientX >= rect.left && touch.clientX <= rect.right &&
               touch.clientY >= rect.top && touch.clientY <= rect.bottom;
    }

    setupGamepadSupport() {
        // Проверяем поддержку геймпадов
        if (!navigator.getGamepads) return;
        
        this.gamepadIndex = -1;
        
        window.addEventListener('gamepadconnected', (event) => {
            console.log('Геймпад подключён:', event.gamepad.id);
            this.gamepadIndex = event.gamepad.index;
        });
        
        window.addEventListener('gamepaddisconnected', (event) => {
            console.log('Геймпад отключён:', event.gamepad.id);
            this.gamepadIndex = -1;
        });
    }

    handleSpecialKeys(event) {
        switch(event.code) {
            case 'Escape':
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                break;
            case 'F11':
                event.preventDefault();
                this.toggleFullscreen();
                break;
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Не удалось войти в полноэкранный режим:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // Методы для получения состояния управления
    isKeyPressed(keyCode) {
        return !!this.keyStates[keyCode];
    }

    getMovementVector() {
        const vector = { x: 0, y: 0 };
        
        // Клавиатура
        if (this.isKeyPressed('KeyW') || this.isKeyPressed('ArrowUp')) vector.y += 1;
        if (this.isKeyPressed('KeyS') || this.isKeyPressed('ArrowDown')) vector.y -= 1;
        if (this.isKeyPressed('KeyA') || this.isKeyPressed('ArrowLeft')) vector.x -= 1;
        if (this.isKeyPressed('KeyD') || this.isKeyPressed('ArrowRight')) vector.x += 1;
        
        // Виртуальный джойстик (мобильные устройства)
        if (this.touchState.joystick.active) {
            vector.x += this.touchState.joystick.x;
            vector.y += this.touchState.joystick.y;
        }
        
        // Геймпад
        const gamepadVector = this.getGamepadMovement();
        if (gamepadVector) {
            vector.x += gamepadVector.x;
            vector.y += gamepadVector.y;
        }
        
        return vector;
    }

    getMouseDelta() {
        const delta = {
            x: this.mouseState.deltaX,
            y: this.mouseState.deltaY
        };
        
        // Сбрасываем дельту после получения
        this.mouseState.deltaX = 0;
        this.mouseState.deltaY = 0;
        
        return delta;
    }

    getGamepadMovement() {
        if (this.gamepadIndex === -1) return null;
        
        const gamepad = navigator.getGamepads()[this.gamepadIndex];
        if (!gamepad) return null;
        
        const deadzone = 0.1;
        const leftStick = {
            x: Math.abs(gamepad.axes[0]) > deadzone ? gamepad.axes[0] : 0,
            y: Math.abs(gamepad.axes[1]) > deadzone ? -gamepad.axes[1] : 0 // Инвертируем Y
        };
        
        return leftStick;
    }

    isRunning() {
        return this.isKeyPressed('ShiftLeft') || this.isGamepadButtonPressed(0); // A button
    }

    isJumping() {
        const spacePressed = this.isKeyPressed('Space');
        const gamepadJump = this.isGamepadButtonPressed(1); // B button
        
        return spacePressed || gamepadJump;
    }

    isInteracting() {
        const fPressed = this.isKeyPressed('KeyF');
        const gamepadInteract = this.isGamepadButtonPressed(3); // Y button
        
        return fPressed || gamepadInteract;
    }

    isGamepadButtonPressed(buttonIndex) {
        if (this.gamepadIndex === -1) return false;
        
        const gamepad = navigator.getGamepads()[this.gamepadIndex];
        return gamepad && gamepad.buttons[buttonIndex] && gamepad.buttons[buttonIndex].pressed;
    }

    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
        this.keyStates = {};
        this.mouseState.deltaX = 0;
        this.mouseState.deltaY = 0;
    }

    destroy() {
        // Удаляем touch интерфейс
        const joystick = document.getElementById('virtualJoystick');
        if (joystick) joystick.remove();
        
        const buttons = document.querySelectorAll('.touch-button');
        buttons.forEach(button => button.remove());
        
        // Освобождаем захват курсора
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
}

// Экспортируем класс
window.ControlsSystem = ControlsSystem;