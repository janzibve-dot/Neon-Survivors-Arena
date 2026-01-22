
// --- 1. НАСТРОЙКИ ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Состояние игры
let isGameOver = false; // Игра идет?
let frameCount = 0;     // Счётчик кадров (нужен для таймера и спавна)
let scoreTime = 0;      // Время выживания

// --- 2. УПРАВЛЕНИЕ ---
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// --- 3. КЛАССЫ ---

// ИГРОК
class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 15;
        this.color = '#3498db'; // Синий
        this.speed = 5;
    }

    update() {
        // Движение (работает на любой раскладке)
        if (keys['KeyW'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['KeyS'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['KeyA'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['KeyD'] || keys['ArrowRight']) this.x += this.speed;

        // Границы экрана
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > canvas.width - this.radius) this.x = canvas.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > canvas.height - this.radius) this.y = canvas.height - this.radius;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// ВРАГ
class Enemy {
    constructor() {
        // Логика: спавним врага за краем экрана
        // Случайно выбираем сторону: 0-верх, 1-право, 2-низ, 3-лево
        const side = Math.floor(Math.random() * 4); 
        this.radius = 15;
        this.speed = 2; // Враги медленнее игрока
        this.color = '#e74c3c'; // Красный

        if (side === 0) { // Сверху
            this.x = Math.random() * canvas.width;
            this.y = -this.radius;
        } else if (side === 1) { // Справа
            this.x = canvas.width + this.radius;
            this.y = Math.random() * canvas.height;
        } else if (side === 2) { // Снизу
            this.x = Math.random() * canvas.width;
            this.y = canvas.height + this.radius;
        } else { // Слева
            this.x = -this.radius;
            this.y = Math.random() * canvas.height;
        }
    }

    update(player) {
        // Вычисляем угол к игроку
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);

        // Двигаем врага к игроку
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }

    draw() {
        ctx.beginPath();
        ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// --- 4. ИНИЦИАЛИЗАЦИЯ ---
const player = new Player();
const enemies = []; // Массив (список) всех врагов

// --- 5. ФУНКЦИЯ КОНЦА ИГРЫ ---
function gameOver() {
    isGameOver = true;
    // Показываем экран проигрыша
    document.getElementById('gameOverScreen').style.display = 'block';
    document.getElementById('finalTime').innerText = scoreTime;
}

// --- 6. ИГРОВОЙ ЦИКЛ ---
function animate() {
    if (isGameOver) return; // Если проиграли — стоп кадр

    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    frameCount++;

    // Обновляем таймер каждую секунду (примерно каждые 60 кадров)
    if (frameCount % 60 === 0) {
        scoreTime++;
        document.getElementById('timer').innerText = scoreTime;
    }

    // Создаем врага каждые 60 кадров (1 секунда)
    if (frameCount % 60 === 0) {
        enemies.push(new Enemy());
    }

    // Игрок
    player.update();
    player.draw();

    // Враги
    enemies.forEach((enemy, index) => {
        enemy.update(player);
        enemy.draw();

        // Проверка: коснулся ли враг игрока?
        // Math.hypot считает расстояние между двумя точками
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);

        // Если расстояние меньше суммы радиусов — касание!
        if (dist < player.radius + enemy.radius) {
            gameOver();
        }
    });
}

// Поехали!
animate();
