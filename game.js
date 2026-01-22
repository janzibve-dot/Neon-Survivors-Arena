
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

// НАСТРОЙКИ СЛОЖНОСТИ (НОВОЕ)
let spawnTimer = 0;
let spawnInterval = 90; // Начальная скорость спавна (90 кадров = 1.5 секунды)
const minSpawnInterval = 20; // Максимальная скорость (не чаще чем раз в 0.3 сек)

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
        this.color = '#3498db'; 
        this.speed = 5;
        this.xp = 100;
        this.angle = 0;
        this.hitTimer = 0;
    }

    update() {
        if (keys['KeyW'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['KeyS'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['KeyA'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['KeyD'] || keys['ArrowRight']) this.x += this.speed;

        if (this.x < this.radius) this.x = this.radius;
        if (this.x > canvas.width - this.radius) this.x = canvas.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > canvas.height - this.radius) this.y = canvas.height - this.radius;

        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

        if (this.hitTimer > 0) this.hitTimer--;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.hitTimer > 0) ctx.fillStyle = '#e74c3c';
        else ctx.fillStyle = this.color;

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

// АПТЕЧКА
class HealthPack {
    constructor() {
        this.x = Math.random() * (canvas.width - 40) + 20;
        this.y = Math.random() * (canvas.height - 40) + 20;
        this.radius = 12;
        this.color = '#2ecc71';
    }

    draw() {
        ctx.beginPath();
        ctx.rect(this.x - 10, this.y - 10, 20, 20);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x - 3, this.y - 8, 6, 16);
        ctx.fillRect(this.x - 8, this.y - 3, 16, 6);
        ctx.closePath();
    }
}

// ВРАГ
class Enemy {
    constructor() {
        const side = Math.floor(Math.random() * 4);
        const typeChance = Math.random();

        // Баланс появления типов врагов
        if (typeChance < 0.2) { 
            this.type = 'tank';
            this.radius = 25;
            this.speed = 1.5;
            this.hp = 3;
            this.damage = 40;
            this.color = '#8e44ad';
        } else if (typeChance < 0.5) { 
            this.type = 'runner';
            this.radius = 10;
            this.speed = 4;
            this.hp = 1;
            this.damage = 10;
            this.color = '#e67e22';
        } else { 
            this.type = 'normal';
            this.radius = 15;
            this.speed = 2.5;
            this.hp = 1;
            this.damage = 20;
            this.color = '#e74c3c';
        }

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
const healthPacks = [];

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

    // 1. Считаем время (каждую секунду)
    if (frameCount % 60 === 0) {
        scoreTime++;
        document.getElementById('timer').innerText = scoreTime;
        
        // КАЖДЫЕ 10 СЕКУНД УСЛОЖНЯЕМ ИГРУ
        if (scoreTime % 10 === 0) {
            if (spawnInterval > minSpawnInterval) {
                spawnInterval -= 5; // Враги начинают появляться чуть быстрее
                // Выводим в консоль для проверки (нажми F12 в браузере, чтобы видеть)
                console.log("Сложность повышена! Интервал: " + spawnInterval);
            }
        }
    }

    // 2. УМНЫЙ СПАВН ВРАГОВ
    spawnTimer++;
    // Если пришло время спавна И врагов на экране меньше 50
    if (spawnTimer >= spawnInterval && enemies.length < 50) {
        enemies.push(new Enemy());
        spawnTimer = 0; // Сбрасываем таймер
    }

    // 3. Спавн Аптечки (каждые 15 секунд)
    if (frameCount % 900 === 0) { 
        healthPacks.push(new HealthPack());
    }

    // --- ОБНОВЛЕНИЕ ОБЪЕКТОВ ---

    player.update();
    player.draw();

    // Аптечки
    for (let i = healthPacks.length - 1; i >= 0; i--) {
        const pack = healthPacks[i];
        pack.draw();
        if (Math.hypot(player.x - pack.x, player.y - pack.y) < player.radius + pack.radius) {
            player.xp = Math.min(player.xp + 20, 100);
            document.getElementById('xpValue').innerText = player.xp;
            healthPacks.splice(i, 1);
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

        // Столкновение с игроком
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer < player.radius + enemy.radius) {
            player.xp -= enemy.damage;
            player.hitTimer = 10;
            document.getElementById('xpValue').innerText = player.xp;
            enemies.splice(i, 1);
            if (player.xp <= 0) gameOver();
            continue;
        }

        // Попадание пули
        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            const distToBullet = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);

            if (distToBullet < enemy.radius + bullet.radius) {
                bullets.splice(j, 1); 
                enemy.hp--; 
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
