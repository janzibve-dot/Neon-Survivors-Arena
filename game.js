
// --- 1. НАСТРОЙКИ И КОНСТАНТЫ ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Подстройка размера
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Состояния игры
const STATE = {
    MENU: 0,
    PLAYING: 1,
    LEVEL_UP: 2,
    GAME_OVER: 3
};

let currentState = STATE.MENU;
let frameCount = 0;
let scoreTime = 0;
let killScore = 0;

// Сложность
let spawnTimer = 0;
let spawnInterval = 90;
const MAX_ENEMIES = 50; // Жесткое ограничение количества врагов

// --- 2. УПРАВЛЕНИЕ ---
const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mousedown', () => {
    if (currentState === STATE.PLAYING) {
        player.tryShoot();
    }
});

// Кнопка "Играть" в начале
document.getElementById('startBtn').addEventListener('click', startGame);

// --- 3. ОПТИМИЗАЦИЯ (OBJECT POOLING) ---
class BulletPool {
    constructor(size) {
        this.pool = [];
        for (let i = 0; i < size; i++) {
            this.pool.push({
                active: false,
                x: 0, y: 0,
                vx: 0, vy: 0,
                radius: 5,
                color: '#f1c40f',
                life: 0
            });
        }
    }

    // Взять пулю из пула
    get(x, y, angle, speed, damage, size) {
        // Ищем первую неактивную пулю
        for (let bullet of this.pool) {
            if (!bullet.active) {
                bullet.active = true;
                bullet.x = x;
                bullet.y = y;
                bullet.vx = Math.cos(angle) * speed;
                bullet.vy = Math.sin(angle) * speed;
                bullet.life = 100; // Пуля живет ограниченное время
                bullet.damage = damage; // Урон пули
                bullet.radius = size;
                return;
            }
        }
        // Если пул полон, пуля просто не вылетит (это спасает от лагов)
    }

    updateAndDraw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f1c40f';
        ctx.fillStyle = '#f1c40f';

        for (let bullet of this.pool) {
            if (bullet.active) {
                // Движение
                bullet.x += bullet.vx;
                bullet.y += bullet.vy;
                bullet.life--;

                // Выход за экран или смерть по времени
                if (bullet.life <= 0 || 
                    bullet.x < 0 || bullet.x > canvas.width || 
                    bullet.y < 0 || bullet.y > canvas.height) {
                    bullet.active = false;
                    continue;
                }

                // Отрисовка
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
}

// Создаем пул на 100 пуль (больше не нужно)
const bulletPool = new BulletPool(100);

// --- 4. КЛАССЫ ---

class Player {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 15;
        this.color = '#3498db';
        this.speed = 5;
        this.angle = 0;
        this.hitTimer = 0;

        // Характеристики RPG
        this.maxHp = 100;
        this.hp = 100;
        this.level = 1;
        this.xp = 0;
        this.nextLevelXp = 100;
        
        // Характеристики оружия
        this.damage = 1;      // Урон
        this.fireRate = 20;   // Задержка (меньше = быстрее)
        this.cooldown = 0;
    }

    update() {
        // Движение
        if (keys['KeyW'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['KeyS'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['KeyA'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['KeyD'] || keys['ArrowRight']) this.x += this.speed;

        // Границы
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

        if (this.hitTimer > 0) this.hitTimer--;
        if (this.cooldown > 0) this.cooldown--;
    }

    tryShoot() {
        if (this.cooldown <= 0) {
            bulletPool.get(this.x, this.y, this.angle, 12, this.damage, 5);
            this.cooldown = this.fireRate;
        }
    }

    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.levelUp();
        }
        updateUI();
    }

    levelUp() {
        this.xp -= this.nextLevelXp;
        this.level++;
        this.nextLevelXp = Math.floor(this.nextLevelXp * 1.2); // Следующий уровень сложнее на 20%
        
        // ПАУЗА ИГРЫ
        currentState = STATE.LEVEL_UP;
        showUpgradeScreen();
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.shadowBlur = 15;
        if (this.hitTimer > 0) {
            ctx.fillStyle = '#e74c3c';
            ctx.shadowColor = '#e74c3c';
        } else {
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
        }

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.rect(0, -5, this.radius + 10, 10); // Дуло
        ctx.fill();
        ctx.restore();
    }
}

class Enemy {
    constructor() {
        const side = Math.floor(Math.random() * 4);
        const typeChance = Math.random();
        this.waitTimer = 60; // 1 секунда задержки

        if (typeChance < 0.2) { 
            this.type = 'tank';
            this.radius = 25;
            this.speed = 1.5;
            this.hp = 6;     // Увеличили HP
            this.damage = 30;
            this.xpReward = 50;
            this.color = '#8e44ad';
        } else if (typeChance < 0.5) { 
            this.type = 'runner';
            this.radius = 10;
            this.speed = 4;
            this.hp = 1;
            this.damage = 10;
            this.xpReward = 15;
            this.color = '#e67e22';
        } else { 
            this.type = 'normal';
            this.radius = 15;
            this.speed = 2.5;
            this.hp = 2;
            this.damage = 15;
            this.xpReward = 20;
            this.color = '#e74c3c';
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
            // Медленный выход
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
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
        ctx.globalAlpha = this.waitTimer > 0 ? 0.5 : 1.0;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

// --- 5. ФУНКЦИИ ИГРОВОГО ПРОЦЕССА ---

const player = new Player();
let enemies = [];

// Список возможных улучшений
const upgradesList = [
    { 
        title: "УРОН +1", 
        desc: "Ваши пули бьют больнее", 
        apply: () => { player.damage += 1; }
    },
    { 
        title: "СКОРОСТРЕЛЬНОСТЬ", 
        desc: "Вы стреляете быстрее", 
        apply: () => { player.fireRate = Math.max(5, player.fireRate - 2); }
    },
    { 
        title: "МАКС. HP +20", 
        desc: "Увеличивает макс. жизни и лечит", 
        apply: () => { player.maxHp += 20; player.hp += 20; }
    },
    {
        title: "ЛЕЧЕНИЕ",
        desc: "Восстановить 50% здоровья",
        apply: () => { player.hp = Math.min(player.maxHp, player.hp + (player.maxHp / 2)); }
    }
];

function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('gameOverScreen').style.display = 'none';
    
    // Сброс
    player.reset();
    enemies = [];
    // Сброс пуль в пуле
    bulletPool.pool.forEach(b => b.active = false);
    
    scoreTime = 0;
    killScore = 0;
    spawnInterval = 90;
    frameCount = 0;
    
    updateUI();
    currentState = STATE.PLAYING;
    animate();
}

function gameOver() {
    currentState = STATE.GAME_OVER;
    document.getElementById('gameOverScreen').style.display = 'flex';
    document.getElementById('finalTime').innerText = scoreTime;
    document.getElementById('finalScore').innerText = killScore;
    document.getElementById('ui').style.display = 'none';
}

function showUpgradeScreen() {
    const container = document.getElementById('upgradeContainer');
    container.innerHTML = ''; // Очистка старых кнопок
    document.getElementById('levelUpScreen').style.display = 'flex';

    // Выбираем 3 случайных улучшения
    for (let i = 0; i < 3; i++) {
        const upgrade = upgradesList[Math.floor(Math.random() * upgradesList.length)];
        
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
            <div class="upgrade-title">${upgrade.title}</div>
            <div class="upgrade-desc">${upgrade.desc}</div>
        `;
        
        card.onclick = () => {
            upgrade.apply(); // Применяем эффект
            document.getElementById('levelUpScreen').style.display = 'none';
            currentState = STATE.PLAYING; // Продолжаем игру
            updateUI();
        };
        
        container.appendChild(card);
    }
}

function updateUI() {
    document.getElementById('hpValue').innerText = Math.floor(player.hp);
    document.getElementById('maxHpValue').innerText = player.maxHp;
    document.getElementById('xpValue').innerText = player.xp;
    document.getElementById('nextLevelXp').innerText = player.nextLevelXp;
    document.getElementById('levelValue').innerText = player.level;
    document.getElementById('scoreValue').innerText = killScore;
}

function drawGrid() {
    ctx.beginPath();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = 0; y <= canvas.height; y += 50) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
}

// --- 6. ГЛАВНЫЙ ЦИКЛ ---
function animate() {
    // Если игра закончена или в меню, цикл не останавливаем, но логику не обновляем
    if (currentState === STATE.GAME_OVER || currentState === STATE.MENU) return;

    requestAnimationFrame(animate);

    // Если уровень повышается, рисуем всё, но не обновляем (эффект паузы)
    if (currentState === STATE.LEVEL_UP) {
        // Можно затемнить фон
        return; 
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    // 1. Таймер
    frameCount++;
    if (frameCount % 60 === 0) {
        scoreTime++;
        document.getElementById('timer').innerText = scoreTime;
        // Усложнение
        if (scoreTime % 15 === 0 && spawnInterval > 20) spawnInterval -= 5;
    }

    // 2. Спавн врагов (с лимитом)
    spawnTimer++;
    if (spawnTimer >= spawnInterval && enemies.length < MAX_ENEMIES) {
        enemies.push(new Enemy());
        spawnTimer = 0;
    }

    // 3. Обновление объектов
    player.update();
    player.draw();

    bulletPool.updateAndDraw();

    // 4. Враги
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(player);
        enemy.draw();

        // Столкновение с игроком
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer < player.radius + enemy.radius) {
            player.hp -= enemy.damage;
            player.hitTimer = 10;
            enemies.splice(i, 1);
            updateUI();
            if (player.hp <= 0) gameOver();
            continue;
        }

        // Столкновение с пулями из пула
        for (let bullet of bulletPool.pool) {
            if (!bullet.active) continue; // Пропускаем неактивные

            const distToBullet = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (distToBullet < enemy.radius + bullet.radius) {
                bullet.active = false; // "Удаляем" пулю
                enemy.hp -= bullet.damage; // Учитываем прокачанный урон

                if (enemy.hp <= 0) {
                    enemies.splice(i, 1);
                    killScore++;
                    player.gainXp(enemy.xpReward); // Даем опыт
                }
                break; // Пуля попала, выходим из цикла пуль
            }
        }
    }
}
