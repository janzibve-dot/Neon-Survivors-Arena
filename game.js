
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
let isGameOver = false;
let frameCount = 0;
let scoreTime = 0;

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
        this.xp = 100; // Теперь это XP (опыт/жизнь)
    }

    update() {
        // Движение
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
        const side = Math.floor(Math.random() * 4); 
        this.radius = 15;
        this.speed = 2;
        this.color = '#e74c3c'; // Красный

        if (side === 0) { this.x = Math.random() * canvas.width; this.y = -this.radius; }
        else if (side === 1) { this.x = canvas.width + this.radius; this.y = Math.random() * canvas.height; }
        else if (side === 2) { this.x = Math.random() * canvas.width; this.y = canvas.height + this.radius; }
        else { this.x = -this.radius; this.y = Math.random() * canvas.height; }
    }

    update(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);
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
const enemies = [];

// --- 5. КОНЕЦ ИГРЫ ---
function gameOver() {
    isGameOver = true;
    document.getElementById('gameOverScreen').style.display = 'block';
    document.getElementById('finalTime').innerText = scoreTime;
}

// --- 6. ИГРОВОЙ ЦИКЛ ---
function animate() {
    if (isGameOver) return;

    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    frameCount++;

    // Таймер
    if (frameCount % 60 === 0) {
        scoreTime++;
        document.getElementById('timer').innerText = scoreTime;
    }

    // Спавн врагов
    if (frameCount % 60 === 0) {
        enemies.push(new Enemy());
    }

    // Игрок
    player.update();
    player.draw();

    // Враги
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(player);
        enemy.draw();

        // Проверка столкновения
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);

        if (dist < player.radius + enemy.radius) {
            // 1. Отнимаем 20 XP
            player.xp -= 20;
            // Обновляем текст на экране
            document.getElementById('xpValue').innerText = player.xp;

            // 2. Удаляем врага
            enemies.splice(i, 1);

            // 3. Если XP кончились (0 или меньше)
            if (player.xp <= 0) {
                gameOver();
            }
        }
    }
}

// Старт
animate();
