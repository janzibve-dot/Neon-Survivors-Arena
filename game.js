
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

let frameCount = 0;
let scoreTime = 0;
let killScore = 0;
let spawnTimer = 0;
let spawnInterval = 90;
const MAX_ENEMIES = 50;

// Управление
const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let isMouseDown = false;

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if ((e.code === 'Escape' || e.code === 'KeyP') && (currentState === STATE.PLAYING || currentState === STATE.PAUSE)) {
        togglePause();
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

// БЕСКОНЕЧНАЯ СТРЕЛЬБА
window.addEventListener('mousedown', () => { isMouseDown = true; });
window.addEventListener('mouseup', () => { isMouseDown = false; });

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', togglePause);

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
    hit() { this.playTone(100, 'sawtooth', 0.1, 0.05); }
    enemyDeath() { this.playTone(50, 'sawtooth', 0.2, 0.1); }
    bossSpawn() { this.playTone(30, 'square', 2.0, 0.2); }
    levelUp() { 
        setTimeout(() => this.playTone(440, 'sine', 0.3, 0.1), 0);
        setTimeout(() => this.playTone(554, 'sine', 0.3, 0.1), 100);
        setTimeout(() => this.playTone(659, 'sine', 0.5, 0.1), 200);
    }
}
const sound = new SoundManager();

// --- 3. ВИЗУАЛ ---
class Background {
    constructor() {
        this.stars = [];
        for(let i=0; i<80; i++) this.stars.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            size: Math.random() * 2, speed: Math.random() * 0.5 + 0.1
        });
    }
    update() {
        this.stars.forEach(s => {
            s.y += s.speed;
            if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
        });
    }
    draw() {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        this.stars.forEach(s => { ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill(); });
    }
}
const bg = new Background();

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
                const a = Math.random() * Math.PI * 2; const s = Math.random() * 3 + 1;
                p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
                p.life = 1.0; p.decay = 0.03; p.color = color;
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
                ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI*2); ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
    }
}
const particlePool = new ParticlePool(500);

class BulletPool {
    constructor(size) {
        this.pool = [];
        for (let i = 0; i < size; i++) this.pool.push({active: false, x:0, y:0, vx:0, vy:0, life:0, trail:[]});
    }
    get(x, y, angle, speed, damage) {
        for (let b of this.pool) {
            if (!b.active) {
                b.active = true; b.x = x; b.y = y;
                b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
                b.life = 80; b.damage = damage; b.trail = [];
                sound.shoot();
                return;
            }
        }
    }
    updateAndDraw() {
        ctx.lineCap = 'round';
        for (let b of this.pool) {
            if (b.active) {
                b.trail.push({x: b.x, y: b.y}); if(b.trail.length > 5) b.trail.shift();
                b.x += b.vx; b.y += b.vy; b.life--;
                if (b.life <= 0 || b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) { b.active = false; continue; }
                
                ctx.strokeStyle = `rgba(0, 255, 204, 0.5)`; ctx.lineWidth = 2;
                ctx.beginPath();
                if(b.trail.length) { ctx.moveTo(b.trail[0].x, b.trail[0].y); for(let t of b.trail) ctx.lineTo(t.x, t.y); }
                ctx.stroke();
                
                ctx.shadowBlur = 10; ctx.shadowColor = '#00ffcc'; ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
            }
        }
    }
}
const bulletPool = new BulletPool(100);

// --- 5. ИГРОК ---
class Player {
    constructor() { this.reset(); }
    reset() {
        this.x = canvas.width / 2; this.y = canvas.height / 2; this.radius = 15;
        this.color = '#00ffcc'; this.speed = 5; this.angle = 0;
        this.maxHp = 100; this.hp = 100;
        this.level = 1; this.xp = 0; this.nextLevelXp = 100;
        
        this.damage = 5; // Урон игрока
        this.fireRate = 10;
        this.cooldown = 0;
        this.weaponType = 'DEFAULT';
        this.hitTimer = 0; this.muzzleFlash = 0;
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

        // БЕСКОНЕЧНАЯ СТРЕЛЬБА
        if (isMouseDown) this.tryShoot();
    }
    tryShoot() {
        if (this.cooldown <= 0) {
            const gunLen = 25;
            const bx = this.x + Math.cos(this.angle) * gunLen;
            const by = this.y + Math.sin(this.angle) * gunLen;

            if (this.weaponType === 'SHOTGUN') {
                bulletPool.get(bx, by, this.angle, 15, this.damage);
                bulletPool.get(bx, by, this.angle - 0.2, 15, this.damage);
                bulletPool.get(bx, by, this.angle + 0.2, 15, this.damage);
                this.cooldown = 35;
            } else if (this.weaponType === 'RAPID') {
                bulletPool.get(bx, by, this.angle, 18, this.damage * 0.7);
                this.cooldown = 5;
            } else {
                bulletPool.get(bx, by, this.angle, 15, this.damage);
                this.cooldown = this.fireRate;
            }
            this.muzzleFlash = 3;
        }
    }
    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.xp -= this.nextLevelXp;
            this.level++;
            this.nextLevelXp = Math.floor(this.nextLevelXp * 1.2);
            isMouseDown = false;
            sound.levelUp();
            currentState = STATE.LEVEL_UP;
            showUpgradeScreen();
        }
        updateUI();
    }
    takeDamage(amount) {
        this.hp -= amount; this.hitTimer = 10;
        sound.hit();
        const overlay = document.getElementById('damageOverlay');
        overlay.style.opacity = '0.5'; setTimeout(() => overlay.style.opacity = '0', 100);
        if (this.hp <= 0) gameOver();
        updateUI();
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.shadowBlur = (this.hp < this.maxHp*0.3) ? 20 : 20; ctx.shadowColor = (this.hp < this.maxHp*0.3) ? 'red' : this.color;
        ctx.fillStyle = this.hitTimer > 0 ? '#fff' : this.color;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = this.hitTimer > 0 ? '#fff' : '#00bfa5'; ctx.fillRect(0, -5, 25, 10);
        if (this.muzzleFlash > 0) {
            ctx.shadowBlur = 30; ctx.shadowColor = '#fff'; ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(28, 0, 10, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}

// --- 6. ВРАГИ ---
let bossActive = false;

class Enemy {
    constructor(isBoss = false) {
        this.isBoss = isBoss;
        this.waitTimer = 60; this.hitFlash = 0;
        
        if (isBoss) {
            sound.bossSpawn();
            this.type = 'boss'; this.radius = 60; this.speed = 0.8;
            this.maxHp = 500 + (player.level * 50); this.hp = this.maxHp;
            this.damage = 50; this.xpReward = 500; this.color = '#ff0000';
            this.x = canvas.width / 2; this.y = -100;
            document.getElementById('bossContainer').style.display = 'block';
            bossActive = true;
        } else {
            const side = Math.floor(Math.random() * 4);
            const typeChance = Math.random();
            const offset = 50;
            if (side === 0) { this.x = Math.random() * canvas.width; this.y = -offset; }
            else if (side === 1) { this.x = canvas.width + offset; this.y = Math.random() * canvas.height; }
            else if (side === 2) { this.x = Math.random() * canvas.width; this.y = canvas.height + offset; }
            else { this.x = -offset; this.y = Math.random() * canvas.height; }

            if (typeChance < 0.2) { 
                this.type = 'tank'; this.radius = 25; this.speed = 1.2; 
                this.hp = 30; this.maxHp=30; 
                this.damage=30; this.xpReward=50; this.color='#bf00ff'; 
            } else if (typeChance < 0.5) { 
                this.type = 'runner'; this.radius = 10; this.speed = 4; 
                this.hp=5; this.maxHp=5; 
                this.damage=10; this.xpReward=15; this.color='#ffaa00'; 
            } else { 
                this.type = 'normal'; this.radius = 15; this.speed=2.0; 
                this.hp=10; this.maxHp=10; 
                this.damage=15; this.xpReward=20; this.color='#ff0055'; 
            }
        }
    }
    update(player) {
        if (this.hitFlash > 0) this.hitFlash--;
        if (this.waitTimer > 0) {
            this.waitTimer--;
            if (this.isBoss) { this.y += 1; return; }
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(a) * 0.5; this.y += Math.sin(a) * 0.5;
            return;
        }
        const dx = player.x - this.x; const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);
        this.x += Math.cos(angle) * this.speed; this.y += Math.sin(angle) * this.speed;
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = this.color;
        ctx.globalAlpha = this.waitTimer > 0 ? 0.3 : 1.0;
        ctx.fillStyle = this.hitFlash > 0 ? '#fff' : this.color;
        
        ctx.beginPath();
        if (this.isBoss) {
            for (let i = 0; i < 6; i++) {
                ctx.lineTo(this.x + this.radius * Math.cos(i * 2 * Math.PI / 6), this.y + this.radius * Math.sin(i * 2 * Math.PI / 6));
            }
        } else if (this.type === 'tank') { ctx.rect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2); }
        else if (this.type === 'runner') { 
            ctx.moveTo(this.x + Math.cos(0)*this.radius, this.y + Math.sin(0)*this.radius);
            ctx.lineTo(this.x + Math.cos(2.1)*this.radius, this.y + Math.sin(2.1)*this.radius);
            ctx.lineTo(this.x + Math.cos(4.2)*this.radius, this.y + Math.sin(4.2)*this.radius);
        }
        else { ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); }
        ctx.fill();

        // ПОЛОСКА ЗДОРОВЬЯ (ИСПРАВЛЕНА)
        if (!this.isBoss) {
            ctx.shadowBlur = 0; // Отключаем свечение для четкости бара
            
            // Красный фон (показывает, сколько жизни потеряно)
            ctx.fillStyle = '#550000';
            ctx.fillRect(this.x - 15, this.y - this.radius - 12, 30, 5);
            
            // Зеленая полоска (показывает, сколько жизни осталось)
            const hpPercent = Math.max(0, this.hp / this.maxHp);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 15, this.y - this.radius - 12, 30 * hpPercent, 5);
            
            // Тонкая рамка (опционально, для красоты)
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(this.x - 15, this.y - this.radius - 12, 30, 5);
        }
        ctx.restore();
    }
}

// --- 7. ЛОГИКА ---
const player = new Player();
let enemies = [];
const upgradesList = [
    { title: "УРОН +20%", desc: "Усилитель плазмы", apply: () => player.damage = Math.floor(player.damage * 1.2) + 2 },
    { title: "СКОРОСТЬ +15%", desc: "Охлаждение ствола", apply: () => player.fireRate = Math.max(5, player.fireRate - 2) },
    { title: "ЛЕЧЕНИЕ", desc: "Ремонт корпуса", apply: () => player.hp = player.maxHp },
    { title: "ДРОБОВИК", desc: "Тройной выстрел", apply: () => player.weaponType = 'SHOTGUN' },
    { title: "АВТОМАТ", desc: "Скорострельный режим", apply: () => player.weaponType = 'RAPID' }
];

function startGame() {
    sound.init();
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('gameOverScreen').style.display = 'none';
    
    player.reset();
    enemies = [];
    bossActive = false;
    document.getElementById('bossContainer').style.display = 'none';
    
    bulletPool.pool.forEach(b => b.active = false);
    particlePool.pool.forEach(p => p.active = false);
    
    scoreTime = 0; killScore = 0; spawnInterval = 90; frameCount = 0;
    currentState = STATE.PLAYING;
    updateUI();
    animate();
}

function togglePause() {
    if (currentState === STATE.PLAYING) {
        currentState = STATE.PAUSE;
        document.getElementById('pauseScreen').style.display = 'flex';
    } else if (currentState === STATE.PAUSE) {
        currentState = STATE.PLAYING;
        document.getElementById('pauseScreen').style.display = 'none';
    }
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
    const shuffled = upgradesList.sort(() => 0.5 - Math.random());
    for (let i = 0; i < 3; i++) {
        const u = shuffled[i];
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `<div class="upgrade-title">${u.title}</div><div class="upgrade-desc">${u.desc}</div>`;
        card.onclick = () => {
            u.apply();
            document.getElementById('levelUpScreen').style.display = 'none';
            currentState = STATE.PLAYING;
            updateUI();
        };
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
}

function drawCursor() {
    ctx.shadowBlur = 10; ctx.shadowColor = '#00ffcc'; ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 2, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowBlur = 0;
}

function animate() {
    if (currentState === STATE.GAME_OVER || currentState === STATE.MENU) return;
    requestAnimationFrame(animate);
    if (currentState === STATE.PAUSE || currentState === STATE.LEVEL_UP) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bg.update(); bg.draw();

    frameCount++;
    if (frameCount % 60 === 0) {
        scoreTime++;
        document.getElementById('timer').innerText = scoreTime;
        if (scoreTime % 60 === 0 && !bossActive && scoreTime > 0) {
            enemies.push(new Enemy(true));
        }
        if (scoreTime % 10 === 0 && spawnInterval > 20) spawnInterval -= 5;
    }

    spawnTimer++;
    if (spawnTimer >= spawnInterval && enemies.length < MAX_ENEMIES && !bossActive) {
        enemies.push(new Enemy());
        spawnTimer = 0;
    }

    particlePool.updateAndDraw();
    player.update();
    player.draw();
    bulletPool.updateAndDraw();

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(player);
        enemy.draw();

        if (enemy.isBoss) {
            const bossP = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
            document.getElementById('bossHpBar').style.width = bossP + '%';
        }

        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer < player.radius + enemy.radius) {
            player.takeDamage(enemy.damage);
            particlePool.explode(enemy.x, enemy.y, enemy.color, 5);
            if (!enemy.isBoss) enemies.splice(i, 1);
            continue;
        }

        for (let b of bulletPool.pool) {
            if (!b.active) continue;
            const dist = Math.hypot(b.x - enemy.x, b.y - enemy.y);
            // Увеличили радиус попадания (чтобы легче попадать)
            if (dist < enemy.radius + b.radius + 10) {
                b.active = false; 
                enemy.hp -= b.damage; 
                enemy.hitFlash = 3;
                particlePool.explode(b.x, b.y, '#fff', 2);

                if (enemy.hp <= 0) {
                    enemies.splice(i, 1);
                    killScore++; player.gainXp(enemy.xpReward);
                    sound.enemyDeath();
                    particlePool.explode(enemy.x, enemy.y, enemy.color, 20);
                    if (enemy.isBoss) {
                        bossActive = false;
                        document.getElementById('bossContainer').style.display = 'none';
                    }
                }
                break;
            }
        }
    }
    drawCursor();
}
