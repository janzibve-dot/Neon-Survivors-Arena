
/* game.js */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const STATE = { MENU: 0, PLAYING: 1, LEVEL_UP: 2, GAME_OVER: 3, PAUSE: 4 };
let currentState = STATE.MENU;

// Глобальные переменные
let frameCount = 0;
let scoreTime = 0;
let killScore = 0;
let spawnInterval = 90;
const MAX_ENEMIES = 60;

// Ресурсы игрока
let medkits = 0;
let stars = 0;

// Ввод
const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let isMouseDown = false;
let isRightMouseDown = false;

// Слушатели событий
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    keys[e.key] = true;
    if ((e.code === 'Escape' || e.code === 'KeyP') && (currentState === STATE.PLAYING || currentState === STATE.PAUSE)) {
        togglePause();
    }
    // Аптечка на "1"
    if (e.key === '1' && currentState === STATE.PLAYING) {
        if (medkits > 0 && player.hp < player.maxHp) {
            medkits--;
            player.hp = Math.min(player.hp + 30, player.maxHp);
            floatText.show(player.x, player.y, "+30 HP", "#00ff00");
            updateUI();
        }
    }
});
window.addEventListener('keyup', e => { keys[e.code] = false; keys[e.key] = false; });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

// Мышь: ЛКМ (0) и ПКМ (2)
window.addEventListener('mousedown', (e) => {
    if (e.button === 0) isMouseDown = true;
    if (e.button === 2) {
        isRightMouseDown = true;
        player.tryFireMissile(); // Одиночный выстрел или зажим? Сделаем по клику или зажиму.
    }
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) isMouseDown = false;
    if (e.button === 2) isRightMouseDown = false;
});
window.addEventListener('contextmenu', e => e.preventDefault()); // Блокируем меню браузера

// --- ЗВУКИ (Заглушки) ---
const sound = {
    shoot: () => {}, // Сюда можно подключить Web Audio API
    hit: () => {},
    levelUp: () => {}
};

// --- ВИЗУАЛ ---
class Background {
    constructor() {
        this.stars = [];
        for(let i=0; i<80; i++) this.stars.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1, speed: Math.random() * 1 + 0.2,
            color: Math.random() > 0.5 ? '#00f3ff' : '#ff00ff'
        });
    }
    update() {
        this.stars.forEach(s => {
            s.y += s.speed;
            if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
        });
    }
    draw() {
        ctx.save();
        this.stars.forEach(s => {
            ctx.fillStyle = s.color; ctx.globalAlpha = 0.4;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
        ctx.restore();
    }
}
const bg = new Background();

class FloatingText {
    constructor() { this.pool = []; }
    show(x, y, text, color) { this.pool.push({x, y, text, color, life: 40}); }
    updateAndDraw() {
        ctx.font = "bold 16px 'Share Tech Mono'";
        for (let i = this.pool.length - 1; i >= 0; i--) {
            let t = this.pool[i]; t.y -= 1; t.life--;
            ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
            if (t.life <= 0) this.pool.splice(i, 1);
        }
    }
}
const floatText = new FloatingText();

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.life -= this.decay;
        return this.life > 0;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4); // Квадратные частицы
        ctx.globalAlpha = 1.0;
    }
}
let particles = [];

// --- ЛУТ (Исправлен на видимый) ---
class Loot {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.active = true;
        this.life = (type === 'star') ? 900 : 600; // 15сек звезда, 10сек остальное
        this.size = 14; // Крупный размер
        this.angle = 0;
        this.magnet = false;
    }
    update() {
        this.life--;
        this.angle += 0.05; // Вращение для видимости
        
        // Магнит
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < 120) this.magnet = true;
        
        if (this.magnet) {
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(a) * 8; this.y += Math.sin(a) * 8;
        }

        if (dist < player.radius + this.size) {
            this.active = false;
            this.collect();
        }
        if (this.life <= 0) this.active = false;
    }
    collect() {
        if (this.type === 'xp') player.gainXp(10);
        else if (this.type === 'boss_xp') player.gainXp(500);
        else if (this.type === 'medkit') {
            medkits++;
            floatText.show(this.x, this.y, "MEDKIT", "#ff2a2a");
            updateUI();
        } else if (this.type === 'star') {
            stars++;
            floatText.show(this.x, this.y, "STAR", "#ffea00");
            updateUI();
        } else if (this.type === 'missile') {
            player.missileAmmo++;
            floatText.show(this.x, this.y, "MISSILE", "#ffaa00");
            updateUI();
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        // Легкая пульсация
        const scale = 1 + Math.sin(frameCount * 0.1) * 0.1;
        ctx.scale(scale, scale);

        // Свечение
        ctx.shadowBlur = 15;
        
        if (this.type.includes('xp')) {
            ctx.shadowColor = '#00ff00';
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(-4, -4, 8, 8); // Зеленый квадрат
        } 
        else if (this.type === 'medkit') {
            // Красный квадрат с белым крестом
            ctx.shadowColor = '#ff0000';
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-8, -8, 16, 16);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-2, -6, 4, 12);
            ctx.fillRect(-6, -2, 12, 4);
        } 
        else if (this.type === 'star') {
            // Желтый ромб
            ctx.shadowColor = '#ffff00';
            ctx.fillStyle = '#ffff00';
            ctx.rotate(this.angle);
            ctx.beginPath();
            ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0);
            ctx.fill();
        } 
        else if (this.type === 'missile') {
            // Оранжевый треугольник
            ctx.shadowColor = '#ffaa00';
            ctx.fillStyle = '#ffaa00';
            ctx.rotate(this.angle);
            ctx.beginPath();
            ctx.moveTo(0, -10); ctx.lineTo(8, 8); ctx.lineTo(-8, 8);
            ctx.fill();
        }
        ctx.restore();
    }
}
let lootList = [];

// --- ПУЛИ И РАКЕТЫ ---
class Bullet {
    constructor(x, y, angle, damage) {
        this.x = x; this.y = y; this.angle = angle;
        this.vx = Math.cos(angle) * 15; this.vy = Math.sin(angle) * 15;
        this.damage = damage;
        this.active = true;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if(this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.active = false;
    }
    draw() {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#00f3ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx, this.y - this.vy); ctx.stroke();
    }
}
let bullets = [];

class Missile {
    constructor(x, y, target) {
        this.x = x; this.y = y; 
        this.target = target;
        this.angle = -Math.PI/2; // Начало полета вверх (визуально) или рандомно
        this.speed = 4;
        this.active = true;
        this.life = 120;
    }
    update() {
        this.life--;
        if (this.life <= 0) this.active = false;
        
        // Логика самонаведения
        if (this.target && this.target.hp > 0) {
            const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            // Плавный поворот (Steering)
            let diff = angleToTarget - this.angle;
            // Нормализация угла
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += diff * 0.1; // Скорость поворота
            this.speed += 0.2; // Ускорение
        } else {
            // Если цель мертва, ищем новую
            this.target = findNearestEnemy(this.x, this.y);
        }

        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        // Частицы хвоста ракеты
        if (frameCount % 3 === 0) {
            particles.push(new Particle(this.x, this.y, '#ffaa00'));
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(8, 0); ctx.lineTo(-6, 5); ctx.lineTo(-6, -5);
        ctx.fill();
        ctx.restore();
    }
}
let missiles = [];

// --- ИГРОК ---
class Player {
    constructor() { this.reset(); }
    reset() {
        this.x = canvas.width / 2; this.y = canvas.height / 2; this.radius = 15;
        this.color = '#00f3ff';
        this.speed = 5; this.angle = 0;
        this.maxHp = 100; this.hp = 100;
        this.level = 1; this.xp = 0; this.nextLevelXp = 100;
        this.damage = 10; this.fireRate = 10; this.cooldown = 0;
        this.missileAmmo = 3; // Стартовые ракеты
        this.missileCooldown = 0;
    }
    update() {
        if (keys['KeyW'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['KeyS'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['KeyA'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['KeyD'] || keys['ArrowRight']) this.x += this.speed;
        
        this.x = Math.max(15, Math.min(canvas.width - 15, this.x));
        this.y = Math.max(15, Math.min(canvas.height - 15, this.y));
        
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        
        if (this.cooldown > 0) this.cooldown--;
        if (this.missileCooldown > 0) this.missileCooldown--;

        if (isMouseDown) this.shoot();
    }
    shoot() {
        if (this.cooldown <= 0) {
            bullets.push(new Bullet(this.x, this.y, this.angle, this.damage));
            this.cooldown = this.fireRate;
            sound.shoot();
        }
    }
    tryFireMissile() {
        if (this.missileCooldown <= 0 && this.missileAmmo > 0) {
            const target = findNearestEnemy(this.x, this.y);
            if (target) {
                missiles.push(new Missile(this.x, this.y, target));
                this.missileAmmo--;
                this.missileCooldown = 30; // Задержка между ракетами
                updateUI();
            } else {
                floatText.show(this.x, this.y, "NO TARGET", "#fff");
            }
        } else if (this.missileAmmo <= 0) {
            floatText.show(this.x, this.y, "NO AMMO", "#555");
        }
    }
    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.xp -= this.nextLevelXp; this.level++;
            this.nextLevelXp = Math.floor(this.nextLevelXp * 1.2);
            currentState = STATE.LEVEL_UP; showUpgradeScreen();
        }
        updateUI();
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.shadowBlur = 15; ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        // Треугольник игрока
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-10, 12); ctx.lineTo(-5, 0); ctx.lineTo(-10, -12);
        ctx.fill();
        ctx.restore();
    }
}
const player = new Player();

// --- ВРАГИ ---
class Enemy {
    constructor(isBoss = false) {
        this.isBoss = isBoss;
        if (isBoss) {
            this.x = canvas.width / 2; this.y = -100;
            this.hp = 500 + (player.level * 100); this.maxHp = this.hp;
            this.radius = 60; this.speed = 1; this.color = '#ff2a2a';
            this.damage = 2; document.getElementById('bossContainer').style.display = 'block';
        } else {
            const edge = Math.floor(Math.random() * 4);
            if (edge === 0) { this.x = Math.random() * canvas.width; this.y = -30; }
            else if (edge === 1) { this.x = canvas.width + 30; this.y = Math.random() * canvas.height; }
            else if (edge === 2) { this.x = Math.random() * canvas.width; this.y = canvas.height + 30; }
            else { this.x = -30; this.y = Math.random() * canvas.height; }
            
            this.hp = 20 + (player.level * 5); this.maxHp = this.hp;
            this.radius = 15; this.speed = 2 + Math.random(); this.color = '#ff00ff';
            this.damage = 10;
        }
    }
    update() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        if (this.isBoss) {
            ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2); // Босс - Квадрат
            ctx.strokeStyle = '#fff'; ctx.strokeRect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);
        } else {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) ctx.lineTo(this.x + this.radius * Math.cos(i * 2 * Math.PI / 6), this.y + this.radius * Math.sin(i * 2 * Math.PI / 6));
            ctx.fill(); // Враг - Шестиугольник
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.restore();
    }
}
let enemies = [];
let bossActive = false;

// --- СИСТЕМА ---

function findNearestEnemy(x, y) {
    let nearest = null;
    let minDist = Infinity;
    for (let e of enemies) {
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < minDist) { minDist = d; nearest = e; }
    }
    return nearest;
}

function showUpgradeScreen() {
    const container = document.getElementById('upgradeContainer'); container.innerHTML = '';
    document.getElementById('levelUpScreen').style.display = 'flex';
    const upgrades = [
        { name: "POWER UP", desc: "Урон +10", func: () => player.damage += 10 },
        { name: "SPEED UP", desc: "Скорость стрельбы", func: () => player.fireRate = Math.max(5, player.fireRate - 2) },
        { name: "HP BOOST", desc: "Макс HP +20", func: () => { player.maxHp += 20; player.hp += 20; } },
        { name: "ROCKETS", desc: "+3 Ракеты", func: () => player.missileAmmo += 3 }
    ];
    upgrades.sort(() => Math.random() - 0.5).slice(0, 3).forEach(u => {
        const btn = document.createElement('div');
        btn.className = 'upgrade-card';
        btn.innerHTML = `<h3 style="color:#ffea00">${u.name}</h3><p>${u.desc}</p>`;
        btn.onclick = () => {
            u.func();
            document.getElementById('levelUpScreen').style.display = 'none';
            currentState = STATE.PLAYING; updateUI();
        };
        container.appendChild(btn);
    });
}

function updateUI() {
    document.getElementById('hpBar').style.width = (player.hp / player.maxHp * 100) + '%';
    document.getElementById('hpText').innerText = Math.floor(player.hp) + "/" + player.maxHp;
    document.getElementById('xpBar').style.width = (player.xp / player.nextLevelXp * 100) + '%';
    document.getElementById('levelValue').innerText = player.level;
    document.getElementById('medkitVal').innerText = medkits;
    document.getElementById('starVal').innerText = stars;
    document.getElementById('missileVal').innerText = player.missileAmmo;
}

function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    player.reset(); enemies = []; bullets = []; particles = []; lootList = []; missiles = [];
    medkits = 0; stars = 0; scoreTime = 0; bossActive = false;
    currentState = STATE.PLAYING;
    animate();
}

function togglePause() {
    if(currentState === STATE.PLAYING) { currentState = STATE.PAUSE; document.getElementById('pauseScreen').style.display = 'flex'; }
    else if(currentState === STATE.PAUSE) { currentState = STATE.PLAYING; document.getElementById('pauseScreen').style.display = 'none'; }
}

function animate() {
    if (currentState === STATE.GAME_OVER || currentState === STATE.MENU) return;
    requestAnimationFrame(animate);
    if (currentState === STATE.PAUSE || currentState === STATE.LEVEL_UP) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bg.draw(); bg.update();

    frameCount++;
    if (frameCount % 60 === 0 && !bossActive) {
        scoreTime++; document.getElementById('timer').innerText = scoreTime;
        if (scoreTime > 0 && scoreTime % 60 === 0) { // Каждую минуту босс
            bossActive = true; enemies = []; // Чистим мелких
            enemies.push(new Enemy(true));
        }
    }

    // Спавн врагов
    if (!bossActive && frameCount % spawnInterval === 0 && enemies.length < MAX_ENEMIES) {
        enemies.push(new Enemy());
    }

    player.update(); player.draw();

    // Обновление пуль
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; b.update(); b.draw();
        if (!b.active) { bullets.splice(i, 1); continue; }
        
        // Попадание
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 5) {
                e.hp -= b.damage; b.active = false;
                particles.push(new Particle(e.x, e.y, '#fff'));
                if (e.hp <= 0) killEnemy(e, j);
                break;
            }
        }
    }

    // Обновление ракет
    for (let i = missiles.length - 1; i >= 0; i--) {
        let m = missiles[i]; m.update(); m.draw();
        if (!m.active) { missiles.splice(i, 1); continue; }

        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (Math.hypot(e.x - m.x, e.y - m.y) < e.radius + 10) {
                e.hp -= 100; m.active = false; // Ракета наносит 100 урона
                for(let k=0;k<10;k++) particles.push(new Particle(m.x, m.y, '#ffaa00')); // Взрыв
                if (e.hp <= 0) killEnemy(e, j);
                break;
            }
        }
    }

    // Обновление врагов
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i]; e.update(); e.draw();
        if (e.isBoss) {
            const pct = Math.max(0, e.hp / e.maxHp * 100);
            document.getElementById('bossHpBar').style.width = pct + '%';
        }
        if (Math.hypot(player.x - e.x, player.y - e.y) < player.radius + e.radius) {
            player.hp -= e.damage; updateUI();
            if (player.hp <= 0) {
                currentState = STATE.GAME_OVER;
                document.getElementById('ui').style.display = 'none';
                document.getElementById('gameOverScreen').style.display = 'flex';
                document.getElementById('finalScore').innerText = killScore;
            }
        }
    }

    // Обновление лута
    lootList.forEach(l => { l.update(); l.draw(); });
    lootList = lootList.filter(l => l.active);

    // Частицы
    particles.forEach(p => p.draw());
    particles = particles.filter(p => p.update());
    
    floatText.updateAndDraw();
}

function killEnemy(e, index) {
    enemies.splice(index, 1);
    killScore += e.isBoss ? 1000 : 100;
    
    // Дроп лута
    lootList.push(new Loot(e.x, e.y, e.isBoss ? 'boss_xp' : 'xp'));
    
    if (Math.random() < 0.05) lootList.push(new Loot(e.x + 10, e.y, 'medkit'));
    if (Math.random() < 0.60) lootList.push(new Loot(e.x - 10, e.y, 'star'));
    if (Math.random() < 0.15) lootList.push(new Loot(e.x + 5, e.y + 5, 'missile'));

    if (e.isBoss) {
        bossActive = false; document.getElementById('bossContainer').style.display = 'none';
        scoreTime = 0; // Сброс таймера до след босса
    }
}
