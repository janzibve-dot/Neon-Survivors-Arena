
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
let killScore = 0;

// --- 2. УПРАВЛЕНИЕ ---
const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mousedown', (e) => {
    if (isGameOver) return;
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
        this.angle = 0;
        this.hitTimer = 0;
    }

    update() {
        // Движение
        if (keys['KeyW'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['KeyS'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['KeyA'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['KeyD'] || keys['ArrowRight']) this.x += this.speed;

        // Границы
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > canvas.width - this.radius) this.x = canvas.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > canvas.height - this.radius) this.y = canvas.height - this.radius;

        // Поворот
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

        // Таймер удара
        if (this.hitTimer > 0) this.hitTimer--;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.hitTimer > 0) {
            ctx.fillStyle = '#e74c3c'; // Красный при ударе
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.rect(0, -5, this.radius + 10, 10);
        ctx.fill();
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

// АПТЕЧКА (Новый класс)
class HealthPack {
    constructor() {
        // Спавнится в случайном месте экрана
        this.x = Math.random() * (canvas.width - 40) + 20;
        this.y = Math.random() * (canvas.height - 40) + 20;
        this.radius = 12;
        this.color = '#2ecc71'; // Зеленый
    }

    draw() {
        ctx.beginPath();
        // Рисуем крестик или квадратик
        ctx.rect(this.x - 10, this.y - 10, 20, 20);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // Белый крест внутри для красоты
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x - 3, this.y - 8, 6, 16);
        ctx.fillRect(this.x - 8, this.y - 3, 16, 6);
        ctx.closePath();
    }
}

// ВРАГ (Обновленный класс)
class Enemy {
    constructor() {
        const side = Math.floor(Math.random() * 4);
        
        // Случайный выбор типа врага
        const typeChance = Math.random(); // Число от 0.0 до 1.0

        if (typeChance < 0.2) { 
            // 20% шанс - ТАНК (Фиолетовый)
            this.type = 'tank';
            this.radius = 25;     // Большой
            this.speed = 1.5;     // Медленный
            this.hp = 3;          // 3 жизни
            this.damage = 40;     // Больно бьет
            this.color = '#8e44ad';
        } else if (typeChance < 0.5) { 
            // 30% шанс - БЕГУН (Оранжевый)
            this.type = 'runner';
            this.radius = 10;     // Маленький
            this.speed = 4;       // Быстрый
            this.hp = 1;          // 1 жизнь
            this.damage = 10;     // Слабо бьет
            this.color = '#e67e22';
        } else { 
            // 50% шанс - ОБЫЧНЫЙ (Красный)
            this.type = 'normal';
            this.radius = 15;
            this.speed = 2.5;
            this.hp = 1;
            this.damage = 20;
            this.color = '#e74c3c';
        }

        // Спавн за краем экрана
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
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        // Обводка, чтобы видеть границы лучше
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.closePath();
    }
}

// --- 4. ИНИЦИАЛИЗАЦИЯ ---
const player = new Player();
const enemies = [];
const bullets = [];
const healthPacks = []; // Массив для аптечек

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

    // Таймер и Спавн Врагов
    if (frameCount % 60 === 0) {
        scoreTime++;
        document.getElementById('timer').innerText = scoreTime;
        enemies.push(new Enemy());
    }

    // Спавн Аптечки (редко, каждые 15 секунд)
    if (frameCount % 900 === 0) { 
        healthPacks.push(new HealthPack());
    }

    // Игрок
    player.update();
    player.draw();

    // Аптечки
    for (let i = healthPacks.length - 1; i >= 0; i--) {
        const pack = healthPacks[i];
        pack.draw();

        // Проверка: Игрок подобрал аптечку?
        const dist = Math.hypot(player.x - pack.x, player.y - pack.y);
        if (dist < player.radius + pack.radius) {
            // Лечим, но не больше 100
            player.xp = Math.min(player.xp + 20, 100);
            document.getElementById('xpValue').innerText = player.xp;
            healthPacks.splice(i, 1); // Удаляем аптечку
        }
    }

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
            player.xp -= enemy.damage; // Урон зависит от типа врага
            player.hitTimer = 10;
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
                // Пуля попала!
                bullets.splice(j, 1); // Пуля исчезает
                enemy.hp--; // Отнимаем жизнь у врага

                // Если у врага кончились жизни (для Танка это важно)
                if (enemy.hp <= 0) {
                    enemies.splice(i, 1);
                    killScore++;
                    document.getElementById('scoreValue').innerText = killScore;
                }
                break;
            }
        }
    }
}

// Старт
animate();
