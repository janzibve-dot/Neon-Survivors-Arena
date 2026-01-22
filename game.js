
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


// --- 2. УПРАВЛЕНИЕ (ИСПРАВЛЕНО) ---
// Храним состояние клавиш по их коду (KeyW, ArrowUp и т.д.)
// Это позволяет игнорировать раскладку (RU/EN)
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
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
        this.hp = 100;          // Здоровье
    }

    update() {
        // Логика движения
        // KeyW = физическая клавиша W (даже если это Ц)
        if (keys['KeyW'] || keys['ArrowUp']) {
            this.y -= this.speed;
        }
        if (keys['KeyS'] || keys['ArrowDown']) {
            this.y += this.speed;
        }
        if (keys['KeyA'] || keys['ArrowLeft']) {
            this.x -= this.speed;
        }
        if (keys['KeyD'] || keys['ArrowRight']) {
            this.x += this.speed;
        }

        // Логика границ (Коллизия со стенами)
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > canvas.width - this.radius) this.x = canvas.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
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

// Создаем игрока
const player = new Player();


// --- 4. ИГРОВОЙ ЦИКЛ ---
function animate() {
    // Очищаем экран
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Обновляем и рисуем игрока
    player.update();
    player.draw();

    // Зацикливаем
    requestAnimationFrame(animate);
}

// Запускаем игру
animate();
