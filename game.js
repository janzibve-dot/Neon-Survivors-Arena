
// --- 1. НАСТРОЙКА CANVAS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Функция растягивания на весь экран
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Вызываем сразу и при изменении размера окна браузера
resize();
window.addEventListener('resize', resize);


// --- 2. УПРАВЛЕНИЕ (Input Handler) ---
// Объект для хранения состояния клавиш (нажата или нет)
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
};

// Если клавишу нажали — ставим true
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key) || keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key] = true;
    }
});

// Если клавишу отпустили — ставим false
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key) || keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key] = false;
    }
});


// --- 3. КЛАСС ИГРОКА (Player) ---
class Player {
    constructor() {
        // Ставим игрока в центр экрана
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        
        // Параметры
        this.radius = 20;       // Радиус круга
        this.color = '#3498db'; // Ярко-синий цвет
        this.speed = 5;         // Скорость перемещения
        this.hp = 100;          // Здоровье (заготовка на будущее)
    }

    update() {
        // Логика движения
        // Используем || (ИЛИ), чтобы работали и буквы, и стрелки
        if (keys['w'] || keys['W'] || keys['ArrowUp']) {
            this.y -= this.speed;
        }
        if (keys['s'] || keys['S'] || keys['ArrowDown']) {
            this.y += this.speed;
        }
        if (keys['a'] || keys['A'] || keys['ArrowLeft']) {
            this.x -= this.speed;
        }
        if (keys['d'] || keys['D'] || keys['ArrowRight']) {
            this.x += this.speed;
        }

        // Логика границ (Коллизия со стенами)
        // Не даем уйти влево (меньше радиуса)
        if (this.x < this.radius) this.x = this.radius;
        // Не даем уйти вправо (ширина экрана минус радиус)
        if (this.x > canvas.width - this.radius) this.x = canvas.width - this.radius;
        // Верх
        if (this.y < this.radius) this.y = this.radius;
        // Низ
        if (this.y > canvas.height - this.radius) this.y = canvas.height - this.radius;
    }

    draw() {
        // Рисуем круг
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// Создаем игрока один раз перед циклом
const player = new Player();


// --- 4. ИГРОВОЙ ЦИКЛ (Game Loop) ---
function animate() {
    // 1. Очищаем экран (стираем прошлый кадр)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Обновляем данные
    player.update();

    // 3. Рисуем
    player.draw();

    // 4. Зацикливаем (браузер сам вызовет эту функцию ~60 раз в секунду)
    requestAnimationFrame(animate);
}

// Запускаем игру
animate();
