
// --- 1. НАСТРОЙКИ ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ВЫСОТА МЕНЮ (ДЛЯ СДВИГА)
const DASHBOARD_HEIGHT = 70;

function resize() {
    canvas.width = window.innerWidth;
    // Учитываем высоту меню
    canvas.height = window.innerHeight - DASHBOARD_HEIGHT;
}
resize();
window.addEventListener('resize', resize);

const STATE = { MENU: 0, PLAYING: 1, LEVEL_UP: 2, GAME_OVER: 3, PAUSE: 4 };
let currentState = STATE.MENU;

let frameCount = 0;
let scoreTime = 0;
let killScore = 0;
let highScore = localStorage.getItem('neonSurvivorsArenaHighScore') || 0;

// УРОВНИ
let gameStage = 1;              
let difficultyMultiplier = 1.0; 
let timeUntilBoss = 60; 

// ЗОНЫ И СПАВН
let zoneSpawnInterval = 10;
let zoneTimer = 0;

let spawnTimer = 0;
let spawnInterval = 90;
const MAX_ENEMIES_NORMAL = 50;
const MAX_ENEMIES_BOSS = 6;     

const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let isMouseDown = false;

window.addEventListener('contextmenu', event => event.preventDefault());

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if ((e.code === 'Escape' || e.code === 'KeyP') && (currentState === STATE.PLAYING || currentState === STATE.PAUSE)) {
        togglePause();
    }
    if (e.code === 'KeyB' && currentState === STATE.PLAYING && !bossActive) {
        timeUntilBoss = 0;
    }
    if (e.code === 'Space' && currentState === STATE.PLAYING) {
        player.activateShield();
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);

// ИСПРАВЛЕНИЕ КООРДИНАТ МЫШИ
window.addEventListener('mousemove', e => { 
    mouse.x = e.clientX; 
    mouse.y = e.clientY - DASHBOARD_HEIGHT; 
});

window.addEventListener('mousedown', (e) => {
    if (currentState !== STATE.PLAYING) return;
    if (e.button === 0) isMouseDown = true; 
    if (e.button === 2) player.fireMissile(); 
});
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
    shield() { this.playTone(600, 'sine', 0.5, 0.1); }
    enemyShoot() { this.playTone(200, 'triangle', 0.1, 0.02); }
    hit() { this.playTone(100, 'sawtooth', 0.1, 0.05); }
    pickup() { this.playTone(600, 'sine', 0.1, 0.1); setTimeout(()=>this.playTone(1200, 'square', 0.1, 0.1), 100); }
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
    danger() { 
        this.playTone(800, 'square', 0.1, 0.2);
        setTimeout(() => this.playTone(800, 'square', 0.1, 0.2), 150);
        setTimeout(() => this.playTone(800, 'square', 0.1, 0.2), 300);
    }
    hackSuccess() {
        this.playTone(200, 'square', 0.1, 0.2);
        setTimeout(() => this.playTone(400, 'square', 0.1, 0.2), 100);
        setTimeout(() => this.playTone(800, 'square', 0.3, 0.2), 200);
    }
}
const sound = new SoundManager();

// --- 3. ФОН ---
class Background {
    constructor() {
        this.stars = [];
        this.comets = [];
        for(let i=0; i<300; i++) {
            this.stars.push({
                dist: Math.random() * canvas.width, 
                angle: Math.random() * Math.PI * 2,
                size: Math.random() * 2,
                color: Math.random() > 0.8 ? '#00f3ff' : '#ffffff'
            });
        }
    }
    update() {
        this.stars.forEach(s => {
            s.angle += 0.0005; 
            s.dist -= 0.1; 
            if(s.dist < 0) s.dist = canvas.width;
        });
        if (Math.random() < 0.01) { 
            this.comets.push({
                x: Math.random() * canvas.width, y: -10, 
                vx: (Math.random() - 0.5) * 2, vy: Math.random() * 5 + 2, life: 100
            });
        }
        for(let i = this.comets.length -1; i>=0; i--) {
            let c = this.comets[i]; c.x += c.vx; c.y += c.vy; c.life--;
            if (c.life <= 0) this.comets.splice(i, 1);
        }
    }
    draw() {
        const cx = canvas.width / 2; const cy = canvas.height / 2;
        this.stars.forEach(s => {
            const x = cx + Math.cos(s.angle) * s.dist;
            const y = cy + Math.sin(s.angle) * s.dist;
            if (x > 0 && x < canvas.width && y > 0 && y < canvas.height) {
                ctx.fillStyle = s.color; ctx.globalAlpha = Math.random() * 0.5 + 0.3;
                ctx.fillRect(x, y, s.size, s.size);
            }
        });
        ctx.globalAlpha = 0.8;
        this.comets.forEach(c => {
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x, c.y, 2, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x - c.vx*10, c.y - c.vy*10); ctx.stroke();
        });
        ctx.globalAlpha = 1.0;
    }
}
const bg = new Background();

class FloatingText {
    constructor() { this.pool = []; }
    show(x, y, text, color) { this.pool.push({x, y, text, color, life: 40}); }
    updateAndDraw() {
        ctx.font = "bold 18px 'Share Tech Mono', monospace";
        for (let i = this.pool.length - 1; i >= 0; i--) {
            let t = this.pool[i]; t.y -= 0.5; t.life--;
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
const particlePool = new ParticlePool(1000);

// --- 4. ЗОНА ВЗЛОМА ---
class HackingZone {
    constructor() {
        this.active = false;
        this.x = 0; this.y = 0;
        this.radius = 80;
        this.timer = 3.0; // Время захвата
        this.life = 7.0;  // Время жизни зоны (7 секунд)
    }
    spawn() {
        this.x = Math.random() * (canvas.width - 200) + 100;
        this.y = Math.random() * (canvas.height - 200) + 100;
        this.timer = 3.0;
        this.life = 7.0; 
        this.active = true;
        floatText.show(this.x, this.y, "HACK ZONE DETECTED", "#39ff14");
    }
    update(player) {
        if (!this.active) return;
        
        // Уменьшаем время жизни зоны
        this.life -= 1/60;
        if (this.life <= 0) {
            this.active = false; // Зона исчезла
            return;
        }

        const dist = Math.hypot(this.x - player.x, this.y - player.y);
        
        if (dist < this.radius) {
            this.timer -= 1/60;
            if (this.timer <= 0) {
                this.timer = 0;
                this.completeHack();
            }
        } else {
            this.timer = 3.0;
        }
    }
    draw() {
        if (!this.active) return;
        
        const isInside = this.timer < 3.0;
        const color = isInside ? '#39ff14' : '#00f3ff';
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.setLineDash([10, 10]);
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        
        if (isInside) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const percent = 1 - (this.timer / 3.0);
            ctx.arc(0, 0, this.radius, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * percent));
            ctx.fillStyle = 'rgba(57, 255, 20, 0.3)';
            ctx.fill();
        }
        
        ctx.fillStyle = '#fff';
        ctx.font = "bold 16px 'Share Tech Mono'";
        ctx.textAlign = "center";
        
        // Таймер взлома (Зеленый)
        ctx.fillStyle = '#39ff14';
        ctx.fillText("HACK: " + this.timer.toFixed(2) + "s", 0, 10);
        
        // Таймер жизни зоны (Красный)
        ctx.fillStyle = '#ff2a2a';
        ctx.fillText("ZONE: " + this.life.toFixed(1) + "s", 0, -this.radius - 10);
        
        ctx.restore();
    }
    
    completeHack() {
        this.active = false;
        sound.hackSuccess();
        document.getElementById('hackMessage').style.display = 'flex';
        setTimeout(() => document.getElementById('hackMessage').style.display = 'none', 3000);
        
        let killCount = 0;
        for (let i = enemies.length - 1; i >= 0; i--) {
            if (!enemies[i].isBoss) {
                particlePool.explode(enemies[i].x, enemies[i].y, enemies[i].color, 10);
                enemies.splice(i, 1);
                killScore++;
                killCount++;
            }
        }
        player.gainXp(killCount * 10);
        spawnLoot(this.x, this.y);
        spawnLoot(this.x + 30, this.y);
    }
}
const hackingZone = new HackingZone();

// --- 5. ЛУТ ---
class SupplyBox {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.size = 25;
        this.active = true;
        this.angle = 0;
        this.type = type; 
        this.life = 600; 
    }
    update() { 
        this.angle += 0.05; 
        this.life--;
        if (this.life <= 0) this.active = false;
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        if (this.life < 180) {
            if (Math.floor(Date.now() / 100) % 2 === 0) ctx.globalAlpha = 0.5;
        }

        if (this.type === 'MISSILE') {
            ctx.fillStyle = 'rgba(255, 0, 255, 0.3)'; ctx.strokeStyle = '#ff00ff';
        } else {
            ctx.fillStyle = 'rgba(0, 243, 255, 0.3)'; ctx.strokeStyle = '#00f3ff';
        }
        
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        
        ctx.fillStyle = '#fff'; ctx.font = "16px Arial"; ctx.textAlign = "center";
        ctx.fillText(this.type === 'MISSILE' ? "🚀" : "🛡️", 0, 6);
        ctx.restore();
        ctx.globalAlpha = 1.0;
    }
}
let lootPool = [];

// --- 6. ОРУЖИЕ ---
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
                ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(Math.atan2(r.vy, r.vx));
                ctx.fillStyle = '#ffea00'; ctx.fillRect(-10, -4, 20, 8); 
                ctx.fillStyle = '#ff0000'; ctx.fillRect(-10, -4, 5, 8); 
                ctx.restore();
            }
        }
        ctx.shadowBlur = 0;
    }
}
const rocketPool = new RocketPool(50);

class HomingMissilePool {
    constructor(size) {
        this.pool = [];
        for (let i = 0; i < size; i++) this.pool.push({active: false, x:0, y:0, vx:0, vy:0, life:0, damage: 0, target: null});
    }
    
    get(x, y, target, damage) {
        for (let m of this.pool) {
            if (!m.active) {
                m.active = true; m.x = x; m.y = y;
                const randomAngle = Math.random() * Math.PI * 2;
                m.vx = Math.cos(randomAngle) * 5; 
                m.vy = Math.sin(randomAngle) * 5;
                m.life = 200; m.damage = damage; m.target = target;
                m.speed = 10; m.angle = randomAngle;
                sound.rocket();
                return;
            }
        }
    }

    updateAndDraw() {
        ctx.shadowBlur = 20; ctx.shadowColor = '#ff00ff';
        for (let m of this.pool) {
            if (m.active) {
                if (m.target && m.target.hp <= 0) { m.target = enemies.length > 0 ? enemies[0] : null; }

                if (m.target) {
                    const angleToTarget = Math.atan2(m.target.y - m.y, m.target.x - m.x);
                    let diff = angleToTarget - m.angle;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    m.angle += diff * 0.1; 
                    const wobble = Math.sin(m.life * 0.2) * 0.5;
                    m.vx = Math.cos(m.angle + wobble) * m.speed;
                    m.vy = Math.sin(m.angle + wobble) * m.speed;
                }

                m.x += m.vx; m.y += m.vy; m.life--;
                if (m.life <= 0) { m.active = false; continue; }

                ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.angle);
                ctx.fillStyle = '#ff00ff'; ctx.fillRect(-10, -5, 20, 10);
                ctx.restore();
                particlePool.explode(m.x, m.y, '#ff00ff', 1);
            }
        }
        ctx.shadowBlur = 0;
    }
}
const homingPool = new HomingMissilePool(50);

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

// --- 7. ИГРОК ---
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
        
        this.missiles = 3; 
        this.shields = 1; 
        this.invincibleTimer = 0; 
    }
    
    activateShield() {
        if (this.shields > 0 && this.invincibleTimer <= 0) {
            this.shields--;
            this.invincibleTimer = 300; 
            sound.shield();
            floatText.show(this.x, this.y - 40, "SHIELD ACTIVE", "#00f3ff");
            updateUI();
        }
    }
    
    fireMissile() {
        if (this.missiles > 0) {
            let target = null;
            let minDist = 9999;
            for (let e of enemies) {
                const d = Math.hypot(e.x - this.x, e.y - this.y);
                if (d < minDist) { minDist = d; target = e; }
            }
            this.missiles--;
            homingPool.get(this.x, this.y, target, 50); 
            updateUI();
        } 
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
        if (this.invincibleTimer > 0) this.invincibleTimer--;
        
        if (isMouseDown) this.tryShoot();
    }

    tryShoot() {
        if (this.cooldown <= 0) {
            const bx = this.x + Math.cos(this.angle) * 25; const by = this.y + Math.sin(this.angle) * 25;
            
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
        if (this.invincibleTimer > 0) return; 
        this.hp -= amount; this.hitTimer = 10; sound.hit();
        const overlay = document.getElementById('damageOverlay');
        overlay.style.opacity = '0.8'; setTimeout(() => overlay.style.opacity = '0', 150);
        if (this.hp <= 0) gameOver();
        updateUI();
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        
        let glowColor = this.invincibleTimer > 0 ? '#ffffff' : '#00f3ff';
        if (this.hitTimer > 0) glowColor = '#ff0000';
        
        ctx.shadowBlur = 25; ctx.shadowColor = glowColor;
        ctx.fillStyle = this.hitTimer > 0 ? '#ffffff' : this.color;
        
        if (this.invincibleTimer > 0) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-10, 15); ctx.lineTo(-5, 0); ctx.lineTo(-10, -15); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = this.hitTimer > 0 ? '#ffffff' : '#009999';
        ctx.fillRect(10, -4, 15, 8);
        ctx.restore();
    }
}

// --- 8. ВРАГИ ---
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

// --- 9. ГЛАВНЫЙ ЦИКЛ ---
const player = new Player();
let enemies = [];
const upgradesList = [
    { title: "УРОН +", desc: "МОЩНОСТЬ ПЛАЗМЫ", apply: () => player.damage += 10 },
    { title: "СКОРОСТЬ +", desc: "ЦИКЛ ПЕРЕЗАРЯДКИ", apply: () => player.fireRate = Math.max(5, player.fireRate - 2) },
    { title: "ЛЕЧЕНИЕ", desc: "РЕМОНТ КОРПУСА", apply: () => player.hp = player.maxHp },
    { title: "ДРОБОВИК", desc: "ТРОЙНОЙ ЗАЛП", apply: () => player.weaponType = 'SHOTGUN' },
    { title: "АВТОМАТ", desc: "РЕЖИМ ТУРЕЛИ", apply: () => player.weaponType = 'RAPID' }
];

function spawnBoss() {
    const boss = new Enemy(true);
    enemies.push(boss);
    sound.danger(); 
}

function spawnLoot(x, y) {
    const rand = Math.random();
    let type = null;
    if (rand < 0.4) type = 'MISSILE';
    else if (rand < 0.5) type = 'SHIELD';
    
    if (type) lootPool.push(new SupplyBox(x, y, type));
}

function spawnHackingZone() {
    // Новая логика: Зона появляется каждые 10 сек (увеличивается с уровнем)
    if (!hackingZone.active) {
        zoneTimer += 1/60;
        if (zoneTimer >= zoneSpawnInterval) {
            hackingZone.spawn();
            zoneTimer = 0;
        }
    }
}

function startGame() {
    sound.init();
    if (sound.ctx.state === 'suspended') sound.ctx.resume(); // ПРИНУДИТЕЛЬНЫЙ ЗАПУСК ЗВУКА

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('dashboard').style.display = 'flex'; 
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('stageAnnouncement').style.display = 'none';
    document.getElementById('hackMessage').style.display = 'none';
    
    player.reset(); enemies = []; lootPool = []; bossActive = false; 
    document.getElementById('bossContainer').style.display = 'none';
    hackingZone.active = false;
    
    gameStage = 1;
    difficultyMultiplier = 1.0;
    timeUntilBoss = 60; 
    zoneSpawnInterval = 10;
    zoneTimer = 0;
    
    bulletPool.pool.forEach(b => b.active = false);
    rocketPool.pool.forEach(r => r.active = false);
    homingPool.pool.forEach(m => m.active = false);
    enemyBulletPool.pool.forEach(b => b.active = false);
    particlePool.pool.forEach(p => p.active = false);
    scoreTime = 0; killScore = 0; spawnInterval = 100; 
    frameCount = 0;
    currentState = STATE.PLAYING; updateUI(); animate();
}

function launchFireworks() {
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
    document.getElementById('dashboard').style.display = 'none';
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
    
    document.getElementById('levelValue').innerText = player.level;
    document.getElementById('scoreValue').innerText = killScore;
    
    document.getElementById('ammoValue').innerText = player.missiles;
    document.getElementById('shieldValue').innerText = player.shields;
    
    if (player.invincibleTimer > 0) {
        const shieldP = (player.invincibleTimer / 300) * 100;
        document.getElementById('shieldActiveBar').style.width = shieldP + '%';
    } else {
        document.getElementById('shieldActiveBar').style.width = '0%';
    }
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
    
    if (!bossActive) {
        timeUntilBoss -= 1/60; 
        if (timeUntilBoss <= 0) { timeUntilBoss = 0; spawnBoss(); }
        document.getElementById('bossTimer').innerText = Math.ceil(timeUntilBoss);
        
        spawnHackingZone();
    } else {
        document.getElementById('bossTimer').innerText = "!!!";
    }

    if (frameCount % 60 === 0) {
        scoreTime++;
        if (scoreTime % 10 === 0 && spawnInterval > 20) spawnInterval -= 5;
    }

    spawnTimer++;
    let limit = (gameStage === 1) ? 30 : MAX_ENEMIES_NORMAL;
    if (bossActive) limit = MAX_ENEMIES_BOSS;

    if (spawnTimer >= spawnInterval && enemies.length < limit) { 
        enemies.push(new Enemy()); spawnTimer = 0; 
    }

    if (player.invincibleTimer > 0) updateUI();

    hackingZone.update(player);
    hackingZone.draw();

    particlePool.updateAndDraw();
    floatText.updateAndDraw();
    
    for (let i = lootPool.length - 1; i >= 0; i--) {
        let box = lootPool[i];
        box.update(); box.draw();
        
        // Удаление старого лута
        if (!box.active) {
            lootPool.splice(i, 1);
            continue;
        }

        const d = Math.hypot(player.x - box.x, player.y - box.y);
        if (d < player.radius + box.size) {
            lootPool.splice(i, 1);
            if (box.type === 'MISSILE') {
                player.missiles += 3;
                floatText.show(player.x, player.y - 30, "+3 ROCKETS", "#ff00ff");
            } else if (box.type === 'SHIELD') {
                player.shields += 1;
                floatText.show(player.x, player.y - 30, "+1 SHIELD", "#00f3ff");
            }
            sound.pickup();
            updateUI();
        }
    }

    player.update(); player.draw();
    bulletPool.updateAndDraw();
    rocketPool.updateAndDraw();
    homingPool.updateAndDraw(); 
    enemyBulletPool.updateAndDraw(player);

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i]; enemy.update(player); enemy.draw();
        if (enemy.isBoss) { const bossP = Math.max(0, (enemy.hp / enemy.maxHp) * 100); document.getElementById('bossHpBar').style.width = bossP + '%'; }

        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer < player.radius + enemy.radius) {
            player.takeDamage(enemy.damage); particlePool.explode(enemy.x, enemy.y, enemy.color, 10);
            if (!enemy.isBoss) enemies.splice(i, 1); continue;
        }

        for (let b of bulletPool.pool) {
            if (!b.active) continue;
            const dist = Math.hypot(b.x - enemy.x, b.y - enemy.y);
            const bulletRadius = b.radius || 5;
            if (dist < enemy.radius + bulletRadius + 15) {
                b.active = false; enemy.hp -= b.damage; enemy.hitFlash = 3;
                particlePool.explode(b.x, b.y, '#fff', 5);
                floatText.show(enemy.x, enemy.y - 30, "HIT", "#00f3ff");

                if (enemy.hp <= 0) {
                    enemies.splice(i, 1); killScore++; player.gainXp(enemy.xpReward);
                    sound.enemyDeath(); particlePool.explode(enemy.x, enemy.y, enemy.color, 30);
                    floatText.show(enemy.x, enemy.y - 30, "+EXP", "#ffea00");
                    if (Math.random() < 0.5) spawnLoot(enemy.x, enemy.y);

                    if (enemy.isBoss) { 
                        bossActive = false; document.getElementById('bossContainer').style.display = 'none'; 
                        
                        gameStage++; 
                        difficultyMultiplier *= 1.05; 
                        
                        // Увеличение интервала зоны на 10%
                        zoneSpawnInterval *= 1.1; 
                        
                        let nextBossTime = 60 * Math.pow(1.05, gameStage - 1);
                        timeUntilBoss = nextBossTime;
                        
                        launchFireworks(); sound.bossDeath();
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

        for (let r of rocketPool.pool) {
            if (!r.active) continue;
            const dist = Math.hypot(r.x - enemy.x, r.y - enemy.y);
            if (dist < enemy.radius + r.radius + 20) {
                r.active = false; enemy.hp -= r.damage; enemy.hitFlash = 3;
                particlePool.explode(r.x, r.y, '#ffea00', 10); 
                floatText.show(enemy.x, enemy.y - 30, "BOOM!", "#ffea00");
                if (enemy.hp <= 0) {
                    enemies.splice(i, 1); killScore++; player.gainXp(enemy.xpReward);
                    sound.enemyDeath(); particlePool.explode(enemy.x, enemy.y, enemy.color, 30);
                    if (Math.random() < 0.5) spawnLoot(enemy.x, enemy.y);
                    if (enemy.isBoss) { 
                        bossActive = false; document.getElementById('bossContainer').style.display = 'none'; 
                        gameStage++; difficultyMultiplier *= 1.05; 
                        zoneSpawnInterval *= 1.1;
                        let nextBossTime = 60 * Math.pow(1.05, gameStage - 1);
                        timeUntilBoss = nextBossTime;
                        launchFireworks(); sound.bossDeath();
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

        for (let m of homingPool.pool) {
            if (!m.active) continue;
            const dist = Math.hypot(m.x - enemy.x, m.y - enemy.y);
            if (dist < enemy.radius + 15) {
                m.active = false; enemy.hp -= m.damage; enemy.hitFlash = 3;
                particlePool.explode(m.x, m.y, '#ff00ff', 20); 
                floatText.show(enemy.x, enemy.y - 30, "CRIT!", "#ff00ff");
                if (enemy.hp <= 0) {
                    enemies.splice(i, 1); killScore++; player.gainXp(enemy.xpReward);
                    sound.enemyDeath(); particlePool.explode(enemy.x, enemy.y, enemy.color, 30);
                    if (Math.random() < 0.5) spawnLoot(enemy.x, enemy.y);
                    if (enemy.isBoss) { 
                        bossActive = false; document.getElementById('bossContainer').style.display = 'none'; 
                        gameStage++; difficultyMultiplier *= 1.05; 
                        zoneSpawnInterval *= 1.1;
                        let nextBossTime = 60 * Math.pow(1.05, gameStage - 1);
                        timeUntilBoss = nextBossTime;
                        sound.bossDeath(); particlePool.explode(enemy.x, enemy.y, '#ff0000', 100); 
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
