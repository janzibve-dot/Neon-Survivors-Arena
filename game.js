
// --- 1. НАСТРОЙКИ ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const STATE = { MENU: 0, PLAYING: 1, LEVEL_UP: 2, GAME_OVER: 3 };
let currentState = STATE.MENU;

let frameCount = 0;
let scoreTime = 0;
let killScore = 0;
let spawnTimer = 0;
let spawnInterval = 90;
const MAX_ENEMIES = 50;

// Управление
const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mousedown', () => {
    if (currentState === STATE.PLAYING) player.tryShoot();
});
document.getElementById('startBtn').addEventListener('click', startGame);

// --- 2. ВИЗУАЛЬНЫЕ ЭФФЕКТЫ ---

// ФОН (Звездное поле)
class Background {
    constructor() {
        this.stars = [];
        for(let i=0; i<100; i++) {
            this.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.5 + 0.1
            });
        }
    }
    update() {
        this.stars.forEach(star => {
            star.y += star.speed;
            if (star.y > canvas.height) {
                star.y = 0;
                star.x = Math.random() * canvas.width;
            }
        });
    }
    draw() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.stars.forEach(star => {
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}
const bg = new Background();

// СИСТЕМА ЧАСТИЦ (Взрывы)
class ParticlePool {
    constructor(size) {
        this.pool = [];
        for(let i=0; i<size; i++) {
            this.pool.push({
                active: false, x:0, y:0, vx:0, vy:0, life:0, color:'#fff', size:0
            });
        }
    }

    explode(x, y, color, count) {
        let spawned = 0;
        for(let p of this.pool) {
            if(!p.active) {
                p.active = true;
                p.x = x;
                p.y = y;
                // Случайный разлет
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 3 + 1;
                p.vx = Math.cos(angle) * speed;
                p.vy = Math.sin(angle) * speed;
                p.life = 1.0; // Жизнь от 1.0 до 0.0
                p.decay = Math.random() * 0.03 + 0.01; // Скорость затухания
                p.color = color;
                p.size = Math.random() * 3 + 1;
                spawned++;
                if(spawned >= count) break;
            }
        }
    }

    updateAndDraw() {
        // Режим наложения для свечения
        ctx.globalCompositeOperation = 'lighter';
        for(let p of this.pool) {
            if(p.active) {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= p.decay;
                
                if(p.life <= 0) {
                    p.active = false;
                    continue;
                }

                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over'; // Возвращаем нормальный режим
    }
}
const particlePool = new ParticlePool(500); // 500 частиц максимум

// ПУЛ ПУЛЬ
class BulletPool {
    constructor(size) {
        this.pool = [];
        for (let i = 0; i < size; i++) {
            this.pool.push({
                active: false, x: 0, y: 0, vx: 0, vy: 0,
                radius: 4, color: '#00ffcc', life: 0, trail: [] 
            });
        }
    }

    get(x, y, angle, speed, damage) {
        for (let b of this.pool) {
            if (!b.active) {
                b.active = true;
                b.x = x; b.y = y;
                b.vx = Math.cos(angle) * speed;
                b.vy = Math.sin(angle) * speed;
                b.life = 100;
                b.damage = damage;
                b.trail = []; // Сброс следа
                return;
            }
        }
    }

    updateAndDraw() {
        ctx.lineCap = 'round';
        for (let b of this.pool) {
            if (b.active) {
                // Сохраняем позицию для следа
                b.trail.push({x: b.x, y: b.y});
                if(b.trail.length > 5) b.trail.shift(); // Хвост длиной 5 кадров

                b.x += b.vx;
                b.y += b.vy;
                b.life--;

                if (b.life <= 0 || b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
                    b.active = false;
                    continue;
                }

                // Рисуем хвост (Trail)
                ctx.strokeStyle = `rgba(0, 255, 204, 0.5)`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                if(b.trail.length > 0) {
                    ctx.moveTo(b.trail[0].x, b.trail[0].y);
                    for(let t of b.trail) ctx.lineTo(t.x, t.y);
                    ctx.lineTo(b.x, b.y);
                }
                ctx.stroke();

                // Рисуем саму пулю (Светящаяся точка)
                ctx.shadowBlur = 10;
                ctx.shadowColor = b.color;
                ctx.fillStyle = '#fff'; // Белый центр
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    }
}
const bulletPool = new BulletPool(100);


// --- 3. ИГРОВЫЕ СУЩНОСТИ ---

class Player {
    constructor() { this.reset(); }

    reset() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 15;
        this.color = '#00ffcc'; // Основной неоновый цвет
        this.speed = 5;
        this.angle = 0;
        
        // Stats
        this.maxHp = 100;
        this.hp = 100;
        this.level = 1;
        this.xp = 0;
        this.nextLevelXp = 100;
        this.damage = 1;
        this.fireRate = 15;
        this.cooldown = 0;

        // Visual states
        this.hitTimer = 0;
        this.muzzleFlash = 0;
    }

    update() {
        if (keys['KeyW'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['KeyS'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['KeyA'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['KeyD'] || keys['ArrowRight']) this.x += this.speed;

        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

        if (this.hitTimer > 0) this.hitTimer--;
        if (this.cooldown > 0) this.cooldown--;
        if (this.muzzleFlash > 0) this.muzzleFlash--;
    }

    tryShoot() {
        if (this.cooldown <= 0) {
            // Спавн пули из кончика пушки
            const gunLen = 25;
            const bx = this.x + Math.cos(this.angle) * gunLen;
            const by = this.y + Math.sin(this.angle) * gunLen;
            
            bulletPool.get(bx, by, this.angle, 15, this.damage);
            
            this.cooldown = this.fireRate;
            this.muzzleFlash = 3; // Вспышка на 3 кадра
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
        this.nextLevelXp = Math.floor(this.nextLevelXp * 1.2);
        currentState = STATE.LEVEL_UP;
        showUpgradeScreen();
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.hitTimer = 10;
        
        // Эффект красного экрана
        const overlay = document.getElementById('damageOverlay');
        overlay.style.opacity = '0.5';
        setTimeout(() => overlay.style.opacity = '0', 100);

        if (this.hp <= 0) gameOver();
        updateUI();
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Пульсация при низком HP
        if (this.hp < this.maxHp * 0.3) {
            const pulse = (Math.sin(Date.now() / 100) + 1) / 2; // 0..1
            ctx.shadowBlur = 10 + pulse * 20;
            ctx.shadowColor = 'red';
        } else {
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;
        }

        // Цвет корпуса (мигает белым при уроне)
        ctx.fillStyle = this.hitTimer > 0 ? '#fff' : this.color;

        // Рисуем корпус (круг)
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Рисуем пушку
        ctx.fillStyle = this.hitTimer > 0 ? '#fff' : '#00bfa5';
        ctx.fillRect(0, -5, 25, 10);

        // Вспышка выстрела
        if (this.muzzleFlash > 0) {
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#fff';
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(28, 0, 8 + Math.random() * 5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

class Enemy {
    constructor() {
        const side = Math.floor(Math.random() * 4);
        const typeChance = Math.random();
        this.waitTimer = 60;
        this.hitFlash = 0; // Для мигания при попадании

        if (typeChance < 0.2) { 
            this.type = 'tank'; this.radius = 25; this.speed = 1.2; 
            this.hp = 6; this.maxHp = 6; this.damage = 30; this.xpReward = 50; 
            this.color = '#bf00ff'; // Фиолетовый
        } else if (typeChance < 0.5) { 
            this.type = 'runner'; this.radius = 10; this.speed = 4; 
            this.hp = 1; this.maxHp = 1; this.damage = 10; this.xpReward = 15; 
            this.color = '#ffaa00'; // Оранжевый
        } else { 
            this.type = 'normal'; this.radius = 15; this.speed = 2.0; 
            this.hp = 2; this.maxHp = 2; this.damage = 15; this.xpReward = 20; 
            this.color = '#ff0055'; // Малиновый
        }

        const offset = this.radius * 2;
        if (side === 0) { this.x = Math.random() * canvas.width; this.y = -offset; }
        else if (side === 1) { this.x = canvas.width + offset; this.y = Math.random() * canvas.height; }
        else if (side === 2) { this.x = Math.random() * canvas.width; this.y = canvas.height + offset; }
        else { this.x = -offset; this.y = Math.random() * canvas.height; }
    }

    update(player) {
        if (this.hitFlash > 0) this.hitFlash--;
        
        if (this.waitTimer > 0) {
            this.waitTimer--;
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
        
        // Свечение
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        // Прозрачность при спавне
        ctx.globalAlpha = this.waitTimer > 0 ? 0.3 : 1.0;
        
        // Белый цвет при попадании
        ctx.fillStyle = this.hitFlash > 0 ? '#fff' : this.color;
        
        // Рисуем геометрические фигуры
        ctx.beginPath();
        if (this.type === 'tank') {
            // Танк - Квадрат
            ctx.rect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);
        } else if (this.type === 'runner') {
            // Бегун - Треугольник
            ctx.moveTo(this.x + Math.cos(0)*this.radius, this.y + Math.sin(0)*this.radius);
            ctx.lineTo(this.x + Math.cos(2.1)*this.radius, this.y + Math.sin(2.1)*this.radius);
            ctx.lineTo(this.x + Math.cos(4.2)*this.radius, this.y + Math.sin(4.2)*this.radius);
        } else {
            // Обычный - Шестиугольник (почти круг)
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        }
        ctx.fill();

        // Полоска здоровья над врагом (только если ранен)
        if (this.hp < this.maxHp) {
            ctx.shadowBlur = 0; // Убираем свечение для полоски
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x - 15, this.y - this.radius - 10, 30, 4);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(this.x - 15, this.y - this.radius - 10, 30 * (this.hp / this.maxHp), 4);
        }

        ctx.restore();
    }
}

// --- 4. ОСНОВНАЯ ЛОГИКА ---

const player = new Player();
let enemies = [];
const upgradesList = [
    { title: "УСИЛИТЕЛЬ УРОНА", desc: "Урон +1", apply: () => player.damage++ },
    { title: "ОХЛАЖДЕНИЕ", desc: "Скорость стрельбы +15%", apply: () => player.fireRate = Math.max(5, player.fireRate - 2) },
    { title: "НАНО-БРОНЯ", desc: "Макс HP +20, Лечение +20", apply: () => { player.maxHp += 20; player.hp += 20; } },
    { title: "АВАРИЙНЫЙ РЕМОНТ", desc: "Полное лечение", apply: () => player.hp = player.maxHp }
];

function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('gameOverScreen').style.display = 'none';
    
    player.reset();
    enemies = [];
    bulletPool.pool.forEach(b => b.active = false);
    particlePool.pool.forEach(p => p.active = false);
    
    scoreTime = 0;
    killScore = 0;
    spawnInterval = 90;
    frameCount = 0;
    currentState = STATE.PLAYING;
    updateUI();
    animate();
}

function gameOver() {
    currentState = STATE.GAME_OVER;
    document.getElementById('ui').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'flex';
    document.getElementById('finalTime').innerText = scoreTime;
    document.getElementById('finalScore').innerText = killScore;
}

function showUpgradeScreen() {
    const container = document.getElementById('upgradeContainer');
    container.innerHTML = '';
    document.getElementById('levelUpScreen').style.display = 'flex';

    for (let i = 0; i < 3; i++) {
        const upgrade = upgradesList[Math.floor(Math.random() * upgradesList.length)];
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `<div class="upgrade-title">${upgrade.title}</div><div class="upgrade-desc">${upgrade.desc}</div>`;
        card.onclick = () => {
            upgrade.apply();
            document.getElementById('levelUpScreen').style.display = 'none';
            currentState = STATE.PLAYING;
            updateUI();
        };
        container.appendChild(card);
    }
}

function updateUI() {
    // Обновляем полоску HP
    const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
    document.getElementById('hpBar').style.width = hpPercent + '%';
    document.getElementById('hpText').innerText = `${Math.floor(player.hp)}/${player.maxHp}`;
    
    // Обновляем полоску XP
    const xpPercent = Math.min(100, (player.xp / player.nextLevelXp) * 100);
    document.getElementById('xpBar').style.width = xpPercent + '%';
    
    document.getElementById('levelValue').innerText = player.level;
    document.getElementById('scoreValue').innerText = killScore;
}

// Рисуем курсор-прицел
function drawCursor() {
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffcc';
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    
    ctx.shadowBlur = 0;
}

function animate() {
    if (currentState === STATE.GAME_OVER || currentState === STATE.MENU) return;
    requestAnimationFrame(animate);
    if (currentState === STATE.LEVEL_UP) return;

    // Очистка с прозрачностью для эффекта следа (небольшой блюр движения)
    // ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
    // ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Но для лучшей производительности просто чистим:
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    bg.update();
    bg.draw();

    frameCount++;
    if (frameCount % 60 === 0) {
        scoreTime++;
        document.getElementById('timer').innerText = scoreTime;
        if (scoreTime % 10 === 0 && spawnInterval > 20) spawnInterval -= 5;
    }

    spawnTimer++;
    if (spawnTimer >= spawnInterval && enemies.length < MAX_ENEMIES) {
        enemies.push(new Enemy());
        spawnTimer = 0;
    }

    // Обновляем объекты
    particlePool.updateAndDraw();
    player.update();
    player.draw();
    bulletPool.updateAndDraw();

    // Враги и Коллизии
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(player);
        enemy.draw();

        // Враг бьет игрока
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer < player.radius + enemy.radius) {
            player.takeDamage(enemy.damage);
            particlePool.explode(enemy.x, enemy.y, enemy.color, 5); // Мелкий взрыв при ударе
            enemies.splice(i, 1);
            continue;
        }

        // Пуля бьет врага
        for (let b of bulletPool.pool) {
            if (!b.active) continue;
            const distToBullet = Math.hypot(b.x - enemy.x, b.y - enemy.y);
            if (distToBullet < enemy.radius + b.radius + 5) {
                b.active = false;
                enemy.hp -= b.damage;
                enemy.hitFlash = 3; // Мигание
                particlePool.explode(b.x, b.y, '#fff', 2); // Искры от пули

                if (enemy.hp <= 0) {
                    enemies.splice(i, 1);
                    killScore++;
                    player.gainXp(enemy.xpReward);
                    particlePool.explode(enemy.x, enemy.y, enemy.color, 15); // Большой взрыв смерти
                }
                break;
            }
        }
    }
    
    drawCursor(); // Рисуем прицел поверх всего
}
