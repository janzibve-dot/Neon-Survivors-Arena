
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

// Сложность
let spawnTimer = 0;
let spawnInterval = 90; 
const minSpawnInterval = 20;

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

// --- ФУНКЦИЯ РИСОВАНИЯ СЕТКИ (НОВОЕ) ---
function drawGrid() {
    ctx.beginPath();
    ctx.strokeStyle = '#222'; // Очень темный серый цвет линий
    ctx.lineWidth = 1;

    const gridSize = 50; // Размер клетки

    // Вертикальные линии
    for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }

    // Горизонтальные линии
    for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    
    ctx.stroke();
    ctx.closePath();
}


// --- 3. КЛАССЫ С ЭФФЕКТАМИ СВЕЧЕНИЯ ---

// ИГРОК
class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 15;
        this.color = '#3498db'; // Синий неон
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

        // Настраиваем свечение
        ctx.shadowBlur = 15; // Сила свечения
        if (this.hitTimer > 0) {
            ctx.fillStyle = '#e74c3c';
            ctx.shadowColor = '#e74c3c'; // Красное свечение при ударе
        } else {
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color; // Синее свечение обычно
        }

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.rect(0, -5, this.radius + 10, 10);
        ctx.fill();
        
        ctx.restore(); // Сброс эффектов
    }
}

// ПУЛЯ
class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.color = '#f1c40f'; // Желтый неон
        this.speed = 12;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10; // Пули светятся слабее
        ctx.shadowColor = this.color;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
        
        ctx.restore();
    }
}

// АПТЕЧКА
class HealthPack {
    constructor() {
        this.x = Math.random() * (canvas.width - 40) + 20;
        this.y = Math.random() * (canvas.height - 40) + 20;
        this.radius = 12;
        this.color = '#2ecc71'; // Зеленый неон
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.rect(this.x - 10, this.y - 10, 20, 20);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // Белый крест не должен сильно светиться, рисуем поверх
        ctx.shadowBlur = 0; 
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x - 3, this.y - 8, 6, 16);
        ctx.fillRect(this.x - 8, this.y - 3, 16, 6);
        ctx.closePath();
        
        ctx.restore();
    }
}

// ВРАГ
class Enemy {
    constructor() {
        const side = Math.floor(Math.random() * 4);
        const typeChance = Math.random();
        this.waitTimer = 60; 

        if (typeChance < 0.2) { 
            this.type = 'tank';
            this.radius = 25;
            this.speed = 1.2;
            this.hp = 3;
            this.damage = 40;
            this.color = '#8e44ad'; // Фиолетовый
        } else if (typeChance < 0.5) { 
            this.type = 'runner';
            this.radius = 10;
            this.speed = 3.5;
            this.hp = 1;
            this.damage = 10;
            this.color = '#e67e22'; // Оранжевый
        } else { 
            this.type = 'normal';
            this.radius = 15;
            this.speed = 2;
            this.hp = 1;
            this.damage = 20;
            this.color = '#e74c3c'; // Красный
        }

        const offset = this.radius * 2; 
        if (side === 0) { this.x = Math.random() * canvas.width; this.y = -offset; }
        else if (side === 1) { this.x = canvas.width + offset; this.y = Math.random() * canvas.height; }
        else if (side === 2) { this.x = Math.random() * canvas.width; this.y = canvas.height + offset; }
        else { this.x = -offset; this.y = Math.random() * canvas.height; }
    }

    update(player) {
        if (this.waitTimer > 0) {
            this.waitTimer--;
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * 0.5;
            this.y += Math.sin(angle) * 0.5;
            return;
        }
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }

    draw() {
        ctx.save();
        if (this.waitTimer > 0) {
            ctx.globalAlpha = 0.5;
            // При появлении свечение слабее
            ctx.shadowBlur = 5;
        } else {
            ctx.globalAlpha = 1.0;
            // Полное свечение
            ctx.shadowBlur = 15;
        }
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // Убираем черную обводку, она портит неон
        // ctx.strokeStyle = 'black';
        // ctx.lineWidth = 1;
        // ctx.stroke();
        
        ctx.closePath();
        ctx.restore();
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

    // 1. Сначала рисуем фон (сетку)
    drawGrid();

    frameCount++;
    if (frameCount % 60 === 0) {
        scoreTime++;
        document.getElementById('timer').innerText = scoreTime;
        if (scoreTime % 10 === 0) {
            if (spawnInterval > minSpawnInterval) {
                spawnInterval -= 5; 
            }
        }
    }

    spawnTimer++;
    if (spawnTimer >= spawnInterval && enemies.length < 50) {
        enemies.push(new Enemy());
        spawnTimer = 0; 
    }

    if (frameCount % 900 === 0) { 
        healthPacks.push(new HealthPack());
    }

    // 2. Рисуем игровые объекты поверх сетки
    player.update();
    player.draw();

    for (let i = healthPacks.length - 1; i >= 0; i--) {
        const pack = healthPacks[i];
        pack.draw();
        if (Math.hypot(player.x - pack.x, player.y - pack.y) < player.radius + pack.radius) {
            player.xp = Math.min(player.xp + 20, 100);
            document.getElementById('xpValue').innerText = player.xp;
            healthPacks.splice(i, 1);
        }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.update();
        bullet.draw();
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(i, 1);
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(player);
        enemy.draw();

        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer < player.radius + enemy.radius) {
            player.xp -= enemy.damage;
            player.hitTimer = 10;
            document.getElementById('xpValue').innerText = player.xp;
            enemies.splice(i, 1);
            if (player.xp <= 0) gameOver();
            continue;
        }

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

animate();
