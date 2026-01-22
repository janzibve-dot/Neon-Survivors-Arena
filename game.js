
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
let killScore = 0; // Очки

// --- 2. УПРАВЛЕНИЕ ---
const keys = {};
// Координаты мыши
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Следим за движением мыши постоянно
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

// Стрельба по клику
window.addEventListener('mousedown', (e) => {
    if (isGameOver) return;
    // Стреляем в том направлении, куда смотрит игрок (this.angle)
    bullets.push(new Bullet(player.x, player.y, player.angle));
});


// --- 3. КЛАССЫ ---

// ИГРОК
class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 15;
        this.color = '#3498db'; // Синий
        this.speed = 5;
        this.xp = 100;
        this.angle = 0; // Куда смотрит игрок
        this.hitTimer = 0; // Таймер для красного мигания
    }

    update() {
        // Движение WASD
        if (keys['KeyW'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['KeyS'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['KeyA'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['KeyD'] || keys['ArrowRight']) this.x += this.speed;

        // Границы экрана
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > canvas.width - this.radius) this.x = canvas.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > canvas.height - this.radius) this.y = canvas.height - this.radius;

        // Поворот к мышке (вычисляем угол)
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

        // Уменьшаем таймер удара (если он был)
        if (this.hitTimer > 0) {
            this.hitTimer--;
        }
    }

    draw() {
        // Сохраняем текущие настройки рисования
        ctx.save();
        
        // Перемещаем "центр мира" в координаты игрока и поворачиваем
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Определяем цвет (Красный, если ударили, иначе Синий)
        if (this.hitTimer > 0) {
            ctx.fillStyle = '#e74c3c'; // Красный (пульсация)
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.beginPath();
        // Рисуем тело (круг)
        // Координаты 0, 0, потому что мы уже сместили ctx.translate
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Рисуем пушку (прямоугольник), чтобы видеть направление
        ctx.rect(0, -5, this.radius + 10, 10);
        ctx.fill();

        // Восстанавливаем настройки, чтобы не сломать отрисовку остального
        ctx.restore();
    }
}

// ПУЛЯ
class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.color = '#f1c40f';
        this.speed = 12;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
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
        this.color = '#e74c3c';

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
const bullets = [];

// --- 5. КОНЕЦ ИГРЫ ---
function gameOver() {
    isGameOver = true;
    document.getElementById('gameOverScreen').style.display = 'block';
    document.getElementById('finalTime').innerText = scoreTime;
    document.getElementById('finalScore').innerText = killScore;
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

    // Пули
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.update();
        bullet.draw();

        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(i, 1);
        }
    }

    // Враги
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(player);
        enemy.draw();

        // 1. Враг коснулся Игрока
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer < player.radius + enemy.radius) {
            player.xp -= 20;
            player.hitTimer = 10; // ВКЛЮЧАЕМ КРАСНЫЙ ЦВЕТ на 10 кадров
            
            document.getElementById('xpValue').innerText = player.xp;
            enemies.splice(i, 1);
            if (player.xp <= 0) gameOver();
            continue;
        }

        // 2. Пуля попала во Врага
        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            const distToBullet = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);

            if (distToBullet < enemy.radius + bullet.radius) {
                enemies.splice(i, 1);
                bullets.splice(j, 1);
                killScore++; // Одно очко
                document.getElementById('scoreValue').innerText = killScore;
                break; 
            }
        }
    }
}

// Старт
animate();
