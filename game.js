
// --- 1. НАСТРОЙКИ ---
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
let scoreTime = 0; // Общее время игры
let killScore = 0;
let highScore = localStorage.getItem('neonSurvivorsArenaHighScore') || 0;

// Уровни и сложность
let gameStage = 1;              
let difficultyMultiplier = 1.0; 
let timeUntilBoss = 60; // Время до босса в секундах (динамическое)

let spawnTimer = 0;
let spawnInterval = 90;
const MAX_ENEMIES_NORMAL = 50;
const MAX_ENEMIES_BOSS = 6;     

const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let isMouseDown = false;

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if ((e.code === 'Escape' || e.code === 'KeyP') && (currentState === STATE.PLAYING || currentState === STATE.PAUSE)) {
        togglePause();
    }
    // Чит для теста (B - Boss)
    if (e.code === 'KeyB' && currentState === STATE.PLAYING && !bossActive) {
        timeUntilBoss = 0;
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', () => { isMouseDown = true; });
window.addEventListener('mouseup', () => { isMouseDown = false; });

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('menuHighScore').innerText = highScore; 

// --- 2. ЗВУКИ ---
class SoundManager {
    constructor() { this.ctx = null; }
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    playTone(freq, type, duration, vol = 0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + duration);
    }
    shoot() { this.playTone(400 + Math.random()*200, 'square', 0.1, 0.03); }
    rocket() { this.playTone(150, 'sawtooth', 0.3, 0.1); } 
    enemyShoot() { this.playTone(200, 'triangle', 0.1, 0.02); }
    hit() { this.playTone(100, 'sawtooth', 0.1, 0.05); }
    enemyDeath() { this.playTone(50, 'sawtooth', 0.2, 0.1); }
    bossSpawn() { this.playTone(30, 'square', 2.0, 0.2); }
    bossDeath() { 
        this.playTone(40, 'square', 1.0, 0.3);
        setTimeout(() => this.playTone(30, 'sawtooth', 1.5, 0.3), 200);
    }
    levelUp() { 
        setTimeout(() => this.playTone(440, 'sine', 0.3, 0.1), 0);
        setTimeout(() => this.playTone(554, 'sine', 0.3, 0.1), 100);
        setTimeout(() => this.playTone(659, 'sine', 0.5, 0.1), 200);
    }
}
const sound = new SoundManager();

// --- 3. ЭФФЕКТЫ ---
class Background {
    constructor() {
        this.stars = [];
        for(let i=0; i<100; i++) this.stars.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            size: Math.random() * 3 + 1, speed: Math.random() * 1.5 + 0.5,
            color: Math.random() > 0.5 ? '#00f3ff' : '#39ff14' 
        });
    }
    update() {
        this.stars.forEach(s => {
            s.y += s.speed;
            if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
        });
    }
    draw() {
        this.stars.forEach(s => {
            ctx.fillStyle = s.color; ctx.globalAlpha = 0.3;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
        ctx.globalAlpha = 1.0;
    }
}
const bg = new Background();

class FloatingText {
    constructor() { this.pool = []; }
    show(x, y, text, color) { this.pool.push({x, y, text, color, life: 30}); }
    updateAndDraw() {
        ctx.font = "bold 18px 'Share Tech Mono', monospace";
        for (let i = this.pool.length - 1; i >= 0; i--) {
            let t = this.pool[i]; t.y -= 1; t.life--;
            ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
            if (t.life <= 0) this.pool.splice(i, 1);
        }
    }
}
const floatText = new FloatingText();

class ParticlePool {
    constructor(size) {
        this.pool = [];
        for(let i=0; i<size; i++) this.pool.push({active: false, x:0, y:0, vx:0, vy:0, life:0, color:'#fff'});
    }
    explode(x, y, color, count) {
        let spawned = 0;
        for(let p of this.pool) {
            if(!p.active) {
                p.active = true; p.x = x; p.y = y;
                const a = Math.random() * Math.PI * 2; const s = Math.random() * 5 + 2;
                p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
                p.life = 1.0; p.decay = 0.04; p.color = color;
                spawned++; if(spawned >= count) break;
            }
        }
    }
    updateAndDraw() {
        ctx.globalCompositeOperation = 'lighter';
        for(let p of this.pool) {
            if(p.active) {
                p.x += p.vx; p.y += p.vy; p.life -= p.decay;
                if(p.life <= 0) { p.active = false; continue; }
                ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 4, 4);
            }
        }
        ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
    }
}
const particlePool = new ParticlePool(1000); // Больше частиц для салюта

// --- 4. ОРУЖИЕ ---
class BulletPool {
    constructor(size) {
        this.pool = [];
        for (let i = 0; i < size; i++) {
            this.pool.push({active: false, x:0, y:0, vx:0, vy:0, life:0, damage: 10, radius: 5});
        }
    }
    get(x, y, angle, speed, damage) {
        for (let b of this.pool) {
            if (!b.active) {
                b.active = true; b.x = x; b.y = y;
                b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
                b.life = 80; b.damage = damage || 10; b.radius = 5;
                sound.shoot(); return;
            }
        }
    }
    updateAndDraw() {
        ctx.shadowBlur = 15; ctx.shadowColor = '#00f3ff';
        for (let b of this.pool) {
            if (b.active) {
                b.x += b.vx; b.y += b.vy; b.life--;
                if (b.life <= 0 || b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) { b.active = false; continue; }
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#00f3ff'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(b.x, b.y);
                ctx.lineTo(b.x - b.vx*2, b.y - b.vy*2); ctx.stroke();
            }
        }
        ctx.shadowBlur = 0;
    }
}
const bulletPool = new BulletPool(150);

class RocketPool {
    constructor(size) {
        this.pool = [];
        for (let i = 0; i < size; i++) this.pool.push({active: false, x:0, y:0, vx:0, vy:0, life:0, damage: 50, radius: 8});
    }
    get(x, y, angle) {
        for (let r of this.pool) {
            if (!r.active) {
                r.active = true; r.x = x; r.y = y;
                r.vx = Math.cos(angle) * 8; r.vy = Math.sin(angle) * 8; 
                r.life = 100; r.damage = 50; r.radius = 10;
                sound.rocket(); return;
            }
        }
    }
    updateAndDraw() {
        ctx.shadowBlur = 20; ctx.shadowColor = '#ffea00';
        for (let r of this.pool) {
            if (r.active) {
                r.x += r.vx; r.y += r.vy; r.life--;
                if (r.life <= 0 || r.x < 0 || r.x > canvas.width || r.y < 0 || r.y > canvas.height) { r.active = false; continue; }
                
                ctx.save();
                ctx.translate(r.x, r.y);
                ctx.rotate(Math.atan2(r.vy, r.vx));
                ctx.fillStyle = '#ffea00';
                ctx.fillRect(-10, -4, 20, 8); 
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(-10, -4, 5, 8); 
                ctx.restore();
            }
        }
        ctx.shadowBlur = 0;
    }
}
const rocketPool = new RocketPool(50);

class EnemyBulletPool {
    constructor(size) {
        this.pool = [];
        for (let i = 0; i < size; i++) this.pool.push({active: false, x:0, y:0, vx:0, vy:0, life:0});
    }
    get(x, y, angle) {
        for (let b of this.pool) {
            if (!b.active) {
                b.active = true; b.x = x; b.y = y;
                b.vx = Math.cos(angle) * 4; b.vy = Math.sin(angle) * 4;
                b.life = 100; sound.enemyShoot(); return;
            }
        }
    }
    updateAndDraw(player) {
        ctx.shadowBlur = 10; ctx.shadowColor = '#ff2a2a';
        for (let b of this.pool) {
            if (b.active) {
                b.x += b.vx; b.y += b.vy; b.life--;
                if (b.life <= 0 || b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) { b.active = false; continue; }
                ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill();
                const dist = Math.hypot(b.x - player.x, b.y - player.y);
                if (dist < player.radius + 4) {
                    player.takeDamage(5); b.active = false;
                    particlePool.explode(player.x, player.y, '#ff2a2a', 5);
                }
            }
        }
        ctx.shadowBlur = 0;
    }
}
const enemyBulletPool = new EnemyBulletPool(50);

// --- 5. ИГРОК ---
class Player {
    constructor() { this.reset(); }
    reset() {
        this.x = canvas.width / 2; this.y = canvas.height / 2; this.radius = 15;
        this.color = '#00f3ff';
        this.speed = 5; this.angle = 0;
        this.maxHp = 100; this.hp = 100;
        this.level = 1; this.xp = 0; 
        this.nextLevelXp = 400; 
        this.damage = 10; this.fireRate = 10; this.cooldown = 0;
        this.weaponType = 'DEFAULT'; this.hitTimer = 0;
        this.isFrozen = false; this.ultTimer = 0;
    }
    
    activateUlt() {
        this.isFrozen = true;
        this.ultTimer = 360; // 6 секунд
        document.getElementById('ultOverlay').style.display = 'block';
    }

    update() {
        if (!this.isFrozen) {
            if (keys['KeyW'] || keys['ArrowUp']) this.y -= this.speed;
            if (keys['KeyS'] || keys['ArrowDown']) this.y += this.speed;
            if (keys['KeyA'] || keys['ArrowLeft']) this.x -= this.speed;
            if (keys['KeyD'] || keys['ArrowRight']) this.x += this.speed;
        } else {
            this.ultTimer--;
            if (this.ultTimer <= 0) {
                this.isFrozen = false;
                document.getElementById('ultOverlay').style.display = 'none';
            }
        }
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        
        if (this.hitTimer > 0) this.hitTimer--;
        if (this.cooldown > 0) this.cooldown--;
        if (isMouseDown) this.tryShoot();
    }

    tryShoot() {
        if (this.cooldown <= 0) {
            const bx = this.x + Math.cos(this.angle) * 25; const by = this.y + Math.sin(this.angle) * 25;
            
            if (this.isFrozen) {
                rocketPool.get(bx, by, this.angle);
                this.cooldown = 20; return;
            }

            if (this.weaponType === 'SHOTGUN') {
                const shotgunDamage = this.damage * 2; 
                bulletPool.get(bx, by, this.angle, 15, shotgunDamage);
                bulletPool.get(bx, by, this.angle - 0.2, 15, shotgunDamage);
                bulletPool.get(bx, by, this.angle + 0.2, 15, shotgunDamage);
                this.cooldown = 35;
            } else if (this.weaponType === 'RAPID') {
                bulletPool.get(bx, by, this.angle, 18, 10); this.cooldown = 5;
            } else {
                bulletPool.get(bx, by, this.angle, 15, this.damage); this.cooldown = this.fireRate;
            }
        }
    }
    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.xp -= this.nextLevelXp; this.level++;
            this.nextLevelXp = Math.floor(this.nextLevelXp * 1.2);
            isMouseDown = false; sound.levelUp();
            currentState = STATE.LEVEL_UP; showUpgradeScreen();
        }
        updateUI();
    }
    takeDamage(amount) {
        this.hp -= amount; this.hitTimer = 10; sound.hit();
        const overlay = document.getElementById('damageOverlay');
        overlay.style.opacity = '0.8'; setTimeout(() => overlay.style.opacity = '0', 150);
        if (this.hp <= 0) gameOver();
        updateUI();
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.shadowBlur = 25; ctx.shadowColor = this.hitTimer > 0 ? '#ff0000' : this.color;
        ctx.fillStyle = this.hitTimer > 0 ? '#ffffff' : this.color;
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-10, 15); ctx.lineTo(-5, 0); ctx.lineTo(-10, -15); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = this.hitTimer > 0 ? '#ffffff' : '#009999';
        ctx.fillRect(10, -4, 15, 8);
        ctx.restore();
    }
}

// --- 6. ВРАГИ ---
let bossActive = false;

class Enemy {
    constructor(isBoss = false) {
        this.isBoss = isBoss; this.waitTimer = 60; this.hitFlash = 0;
        const hpMult = difficultyMultiplier;

        if (isBoss) {
            sound.bossSpawn();
            this.type = 'boss'; this.radius = 60; 
            this.speed = 1.3 * hpMult;
            this.maxHp = Math.floor((800 + (player.level * 100)) * hpMult); 
            this.hp = this.maxHp;
            this.damage = 50 * hpMult; this.xpReward = 500 * hpMult; 
            this.color = '#ff2a2a'; 
            this.x = canvas.width / 2; this.y = -100;
            document.getElementById('bossContainer').style.display = 'block';
            document.getElementById('bossLvl').innerText = gameStage; 
            bossActive = true;
        } else {
            const side = Math.floor(Math.random() * 4); const typeChance = Math.random(); const offset = 50;
            if (side === 0) { this.x = Math.random() * canvas.width; this.y = -offset; }
            else if (side === 1) { this.x = canvas.width + offset; this.y = Math.random() * canvas.height; }
            else if (side === 2) { this.x = Math.random() * canvas.width; this.y = canvas.height + offset; }
            else { this.x = -offset; this.y = Math.random() * canvas.height; }

            if (bossActive) {
                this.type = 'drone'; this.radius = 12; this.speed = 3.5; 
                this.hp = 10 * hpMult; this.maxHp = this.hp;
                this.damage = 5 * hpMult; this.xpReward = 10;
                this.color = '#ffea00';
                this.canShoot = true; 
                this.shootCooldown = Math.random() * 200 + 100;
            } else if (typeChance < 0.2) { 
                this.type = 'tank'; this.radius = 25; this.speed = 1.2; 
                this.hp = 30 * hpMult; this.maxHp = this.hp; 
                this.damage=30 * hpMult; this.xpReward=50 * hpMult; this.color='#ff00ff'; 
            } else if (typeChance < 0.5) { 
                this.type = 'runner'; this.radius = 10; this.speed = 4; 
                this.hp = 10 * hpMult; this.maxHp = this.hp; 
                this.damage=10 * hpMult; this.xpReward=15 * hpMult; this.color='#ffea00'; 
            } else { 
                this.type = 'normal'; this.radius = 15; this.speed=2.0; 
                this.hp = 20 * hpMult; this.maxHp = this.hp; 
                this.damage=15 * hpMult; this.xpReward=20 * hpMult; this.color='#39ff14'; 
            }
        }
    }
    
    update(player) {
        if (this.hitFlash > 0) this.hitFlash--;
        if (this.waitTimer > 0) {
            this.waitTimer--; if (this.isBoss) { this.y += 1; return; }
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(a) * 0.5; this.y += Math.sin(a) * 0.5; return;
        }

        if (this.canShoot && !this.isBoss) {
            this.shootCooldown--;
            if (this.shootCooldown <= 0) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                enemyBulletPool.get(this.x, this.y, angle);
                this.shootCooldown = Math.random() * 300 + 100;
            }
        }

        const dx = player.x - this.x; const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);
        this.x += Math.cos(angle) * this.speed; this.y += Math.sin(angle) * this.speed;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 20; ctx.shadowColor = this.color;
        ctx.globalAlpha = this.waitTimer > 0 ? 0.3 : 1.0;
        ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
        
        ctx.beginPath();
        if (this.isBoss) {
            for (let i = 0; i < 8; i++) ctx.lineTo(this.x + this.radius * Math.cos(i * 2 * Math.PI / 8), this.y + this.radius * Math.sin(i * 2 * Math.PI / 8));
            ctx.closePath();
        } else if (this.type === 'tank') { 
            ctx.moveTo(this.x, this.y - this.radius); ctx.lineTo(this.x + this.radius, this.y);
            ctx.lineTo(this.x, this.y + this.radius); ctx.lineTo(this.x - this.radius, this.y); ctx.closePath();
        } else if (this.type === 'runner' || this.type === 'drone') { 
             ctx.moveTo(this.x + this.radius, this.y); ctx.lineTo(this.x - this.radius, this.y - this.radius/1.5);
             ctx.lineTo(this.x - this.radius, this.y + this.radius/1.5); ctx.closePath();
        } else { 
            for (let i = 0; i < 6; i++) ctx.lineTo(this.x + this.radius * Math.cos(i * 2 * Math.PI / 6), this.y + this.radius * Math.sin(i * 2 * Math.PI / 6));
            ctx.closePath();
        }
        ctx.fill();

        ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();

        if (!this.isBoss) {
            ctx.shadowBlur = 0; 
            const barWidth = 40; const barHeight = 4;
            ctx.fillStyle = '#000'; ctx.fillRect(this.x - barWidth/2, this.y + this.radius + 10, barWidth, barHeight);
            const hpPercent = Math.max(0, this.hp / this.maxHp);
            ctx.fillStyle = this.color; 
            ctx.fillRect(this.x - barWidth/2, this.y + this.radius + 10, barWidth * hpPercent, barHeight);
        }
        ctx.restore();
    }
}

// --- 7. ГЛАВНЫЙ ЦИКЛ ---
const player = new Player();
let enemies = [];
const upgradesList = [
    { title: "УРОН +", desc: "МОЩНОСТЬ ПЛАЗМЫ", apply: () => player.damage += 10 },
    { title: "СКОРОСТЬ +", desc: "ЦИКЛ ПЕРЕЗАРЯДКИ", apply: () => player.fireRate = Math.max(5, player.fireRate - 2) },
    { title: "ЛЕЧЕНИЕ", desc: "РЕМОНТ КОРПУСА", apply: () => player.hp = player.maxHp },
    { title: "ДРОБОВИК", desc: "ТРОЙНОЙ ЗАЛП", apply: () => player.weaponType = 'SHOTGUN' },
    { title: "АВТОМАТ", desc: "РЕЖИМ ТУРЕЛИ", apply: () => player.weaponType = 'RAPID' }
];

function startGame() {
    sound.init();
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('stageAnnouncement').style.display = 'none';
    
    player.reset(); enemies = []; bossActive = false;
    document.getElementById('bossContainer').style.display = 'none';
    
    gameStage = 1;
    difficultyMultiplier = 1.0;
    timeUntilBoss = 60; // Старт с 60 сек
    
    bulletPool.pool.forEach(b => b.active = false);
    rocketPool.pool.forEach(r => r.active = false);
    enemyBulletPool.pool.forEach(b => b.active = false);
    particlePool.pool.forEach(p => p.active = false);
    scoreTime = 0; killScore = 0; spawnInterval = 100; // Чуть медленнее спавн для начала
    frameCount = 0;
    currentState = STATE.PLAYING; updateUI(); animate();
}

function launchFireworks() {
    // Салют в разных точках
    for(let i=0; i<5; i++) {
        setTimeout(() => {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const color = ['#ff00ff', '#00f3ff', '#ffea00'][Math.floor(Math.random()*3)];
            particlePool.explode(x, y, color, 50);
            sound.rocket(); 
        }, i * 300);
    }
}

function togglePause() {
    if (currentState === STATE.PLAYING) { currentState = STATE.PAUSE; document.getElementById('pauseScreen').style.display = 'flex'; } 
    else if (currentState === STATE.PAUSE) { currentState = STATE.PLAYING; document.getElementById('pauseScreen').style.display = 'none'; }
}

function gameOver() {
    currentState = STATE.GAME_OVER; document.getElementById('ui').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'flex';
    document.getElementById('finalScore').innerText = killScore;
    document.getElementById('finalStage').innerText = gameStage;

    if (killScore > highScore) {
        highScore = killScore;
        localStorage.setItem('neonSurvivorsArenaHighScore', highScore);
        document.getElementById('menuHighScore').innerText = highScore;
    }
}

function showUpgradeScreen() {
    const container = document.getElementById('upgradeContainer'); container.innerHTML = '';
    document.getElementById('levelUpScreen').style.display = 'flex';
    const shuffled = upgradesList.sort(() => 0.5 - Math.random());
    for (let i = 0; i < 3; i++) {
        const u = shuffled[i]; const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `<div class="upgrade-title">${u.title}</div><div class="upgrade-desc">${u.desc}</div>`;
        card.onclick = () => { u.apply(); document.getElementById('levelUpScreen').style.display = 'none'; currentState = STATE.PLAYING; updateUI(); };
        container.appendChild(card);
    }
}

function updateUI() {
    const hpP = Math.max(0, (player.hp / player.maxHp) * 100);
    document.getElementById('hpBar').style.width = hpP + '%';
    document.getElementById('hpText').innerText = `${Math.floor(player.hp)}/${player.maxHp}`;
    const xpP = Math.min(100, (player.xp / player.nextLevelXp) * 100);
    document.getElementById('xpBar').style.width = xpP + '%';
    document.getElementById('levelValue').innerText = player.level;
    document.getElementById('scoreValue').innerText = killScore;
    document.getElementById('bestScoreValue').innerText = highScore;
    document.getElementById('stageValue').innerText = gameStage;
}

function drawCursor() {
    ctx.shadowBlur = 15; ctx.shadowColor = '#00f3ff'; ctx.strokeStyle = '#00f3ff'; ctx.lineWidth = 2;
    ctx.beginPath(); 
    ctx.moveTo(mouse.x - 15, mouse.y); ctx.lineTo(mouse.x - 5, mouse.y);
    ctx.moveTo(mouse.x + 15, mouse.y); ctx.lineTo(mouse.x + 5, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 15); ctx.lineTo(mouse.x, mouse.y - 5);
    ctx.moveTo(mouse.x, mouse.y + 15); ctx.lineTo(mouse.x, mouse.y + 5);
    ctx.stroke();
    ctx.strokeRect(mouse.x - 8, mouse.y - 8, 16, 16);
    ctx.shadowBlur = 0;
}

function animate() {
    if (currentState === STATE.GAME_OVER || currentState === STATE.MENU) return;
    requestAnimationFrame(animate);
    if (currentState === STATE.PAUSE || currentState === STATE.LEVEL_UP) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bg.update(); bg.draw();

    frameCount++;
    
    // ТАЙМЕР БОССА
    if (!bossActive) {
        timeUntilBoss -= 1/60; // Отнимаем секунду (при 60 FPS)
        if (timeUntilBoss <= 0) {
            timeUntilBoss = 0;
            enemies.push(new Enemy(true));
            player.activateUlt();
        }
        document.getElementById('bossCountdown').innerText = Math.ceil(timeUntilBoss);
    } else {
        document.getElementById('bossCountdown').innerText = "!!!";
    }

    if (frameCount % 60 === 0) {
        scoreTime++;
        if (scoreTime % 10 === 0 && spawnInterval > 20) spawnInterval -= 5;
    }

    spawnTimer++;
    // На 1 уровне врагов меньше (30), дальше 50
    let limit = (gameStage === 1) ? 30 : MAX_ENEMIES_NORMAL;
    if (bossActive) limit = MAX_ENEMIES_BOSS;

    if (spawnTimer >= spawnInterval && enemies.length < limit) { 
        enemies.push(new Enemy()); 
        spawnTimer = 0; 
    }

    particlePool.updateAndDraw();
    floatText.updateAndDraw();
    player.update(); player.draw();
    bulletPool.updateAndDraw();
    rocketPool.updateAndDraw();
    enemyBulletPool.updateAndDraw(player);

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i]; enemy.update(player); enemy.draw();
        if (enemy.isBoss) { const bossP = Math.max(0, (enemy.hp / enemy.maxHp) * 100); document.getElementById('bossHpBar').style.width = bossP + '%'; }

        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer < player.radius + enemy.radius) {
            player.takeDamage(enemy.damage); particlePool.explode(enemy.x, enemy.y, enemy.color, 10);
            if (!enemy.isBoss) enemies.splice(i, 1); continue;
        }

        // ПУЛИ
        for (let b of bulletPool.pool) {
            if (!b.active) continue;
            const dx = b.x - enemy.x; const dy = b.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const bulletRadius = b.radius || 5;
            
            if (dist < enemy.radius + bulletRadius + 15) {
                b.active = false; 
                enemy.hp -= b.damage; 
                enemy.hitFlash = 3;
                particlePool.explode(b.x, b.y, '#fff', 5);
                floatText.show(enemy.x, enemy.y - 30, "HIT", "#00f3ff");

                if (enemy.hp <= 0) {
                    enemies.splice(i, 1); killScore++; player.gainXp(enemy.xpReward);
                    sound.enemyDeath(); particlePool.explode(enemy.x, enemy.y, enemy.color, 30);
                    floatText.show(enemy.x, enemy.y - 30, "+EXP", "#ffea00");
                    if (enemy.isBoss) { 
                        bossActive = false; document.getElementById('bossContainer').style.display = 'none'; 
                        
                        // ПЕРЕХОД УРОВНЯ
                        gameStage++;
                        difficultyMultiplier *= 1.05; 
                        
                        // Увеличиваем время следующего босса на 5%
                        let nextBossTime = 60 * Math.pow(1.05, gameStage - 1);
                        timeUntilBoss = nextBossTime;

                        launchFireworks(); // САЛЮТ
                        sound.bossDeath();
                        particlePool.explode(enemy.x, enemy.y, '#ff0000', 100); 
                        
                        // Показываем окно уровня
                        document.getElementById('announcementStage').innerText = gameStage;
                        document.getElementById('stageAnnouncement').style.display = 'flex';
                        setTimeout(() => document.getElementById('stageAnnouncement').style.display = 'none', 3000);

                        updateUI();
                    }
                }
                break;
            }
        }

        // РАКЕТЫ
        for (let r of rocketPool.pool) {
            if (!r.active) continue;
            const dx = r.x - enemy.x; const dy = r.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < enemy.radius + r.radius + 20) {
                r.active = false; 
                enemy.hp -= r.damage; 
                enemy.hitFlash = 3;
                particlePool.explode(r.x, r.y, '#ffea00', 10); 
                floatText.show(enemy.x, enemy.y - 30, "BOOM!", "#ffea00");

                if (enemy.hp <= 0) {
                    enemies.splice(i, 1); killScore++; player.gainXp(enemy.xpReward);
                    sound.enemyDeath(); particlePool.explode(enemy.x, enemy.y, enemy.color, 30);
                    floatText.show(enemy.x, enemy.y - 30, "+EXP", "#ffea00");
                    if (enemy.isBoss) { 
                        bossActive = false; document.getElementById('bossContainer').style.display = 'none'; 
                        
                        gameStage++;
                        difficultyMultiplier *= 1.05; 
                        let nextBossTime = 60 * Math.pow(1.05, gameStage - 1);
                        timeUntilBoss = nextBossTime;

                        launchFireworks(); 
                        sound.bossDeath();
                        particlePool.explode(enemy.x, enemy.y, '#ff0000', 100); 
                        
                        document.getElementById('announcementStage').innerText = gameStage;
                        document.getElementById('stageAnnouncement').style.display = 'flex';
                        setTimeout(() => document.getElementById('stageAnnouncement').style.display = 'none', 3000);

                        updateUI();
                    }
                }
                break;
            }
        }
    }
    drawCursor();
}
