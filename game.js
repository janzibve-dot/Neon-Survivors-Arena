
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
let medkits = 0;
let stars = 0;

// Ввод
const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let isMouseDown = false;

// --- ЗВУКИ ---
class SoundManager {
    constructor() { this.ctx = null; }
    init() {
        if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        if (this.ctx.state === 'suspended') { this.ctx.resume(); }
    }
    playTone(freq, type, dur, vol=0.1) {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + dur);
    }
    shoot() { this.playTone(400, 'square', 0.1, 0.05); }
    enemyShoot() { this.playTone(200, 'sawtooth', 0.1, 0.05); }
    hit() { this.playTone(100, 'sawtooth', 0.1, 0.1); }
    pickup() { this.playTone(600, 'sine', 0.1, 0.1); }
    powerup() { this.playTone(300, 'square', 0.3, 0.15); }
    explode() { this.playTone(50, 'sawtooth', 0.3, 0.2); }
    blackHoleCharge() { this.playTone(100, 'sine', 0.1, 0.05); }
    blackHoleBoom() { this.playTone(50, 'square', 1.0, 0.3); }
}
const sound = new SoundManager();

// --- ИНИЦИАЛИЗАЦИЯ ---
window.onload = function() {
    const startBtn = document.getElementById('startBtn');
    if(startBtn) {
        startBtn.onclick = () => { sound.init(); startGame(); };
    }
    document.getElementById('resumeBtn').onclick = togglePause;
    animate(); 
};

window.addEventListener('keydown', e => {
    keys[e.code] = true; keys[e.key] = true;
    if ((e.code === 'Escape' || e.code === 'KeyP') && currentState === STATE.PLAYING) togglePause();
    if (e.key === '1' && currentState === STATE.PLAYING) {
        if (medkits > 0 && player.hp < player.maxHp) {
            medkits--;
            player.hp = Math.min(player.hp + 30, player.maxHp);
            sound.pickup();
            floatText.show(player.x, player.y, "+30 HP", "#00ff00");
            updateUI();
        }
    }
});
window.addEventListener('keyup', e => { keys[e.code] = false; keys[e.key] = false; });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => {
    if (e.button === 0) isMouseDown = true;
    if (e.button === 2 && currentState === STATE.PLAYING) player.tryFireMissile();
});
window.addEventListener('mouseup', e => { if (e.button === 0) isMouseDown = false; });
window.addEventListener('contextmenu', e => e.preventDefault());


// --- ЭФФЕКТЫ ---
class Background {
    constructor() {
        this.stars = [];
        for(let i=0; i<80; i++) this.stars.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5, speed: Math.random() * 0.5 + 0.1,
            color: Math.random() > 0.8 ? '#00f3ff' : '#ffffff'
        });
    }
    draw() {
        ctx.fillStyle = "#fff";
        this.stars.forEach(s => {
            s.y += s.speed;
            if(s.y > canvas.height) s.y = 0;
            ctx.globalAlpha = Math.random() * 0.5 + 0.3;
            ctx.fillStyle = s.color;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }
}
const bg = new Background();

class FloatingText {
    constructor() { this.pool = []; }
    show(x, y, text, color) { this.pool.push({x, y, text, color, life: 60}); }
    updateAndDraw() {
        ctx.font = "bold 16px 'Share Tech Mono'";
        for (let i = this.pool.length - 1; i >= 0; i--) {
            let t = this.pool[i]; t.y -= 0.5; t.life--;
            ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
            if (t.life <= 0) this.pool.splice(i, 1);
        }
    }
}
const floatText = new FloatingText();

class Particle {
    constructor(x, y, color) {
        this.x=x; this.y=y; this.color=color;
        const a=Math.random()*Math.PI*2; const s=Math.random()*3;
        this.vx=Math.cos(a)*s; this.vy=Math.sin(a)*s; this.life=1.0;
    }
    update() { this.x+=this.vx; this.y+=this.vy; this.life-=0.05; return this.life > 0; }
    draw() { 
        ctx.globalAlpha = this.life; ctx.fillStyle = this.color; 
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.globalAlpha = 1.0; 
    }
}
let particles = [];

// --- ЧЕРНАЯ ДЫРА ---
class BlackHole {
    constructor() {
        this.x = Math.random() * (canvas.width - 100) + 50;
        this.y = Math.random() * (canvas.height - 100) + 50;
        this.life = 420; 
        this.active = true;
        this.radius = 50;
        this.charge = 0; 
        this.maxCharge = 180;
    }
    update() {
        this.life--;
        if (this.life <= 0) this.active = false;
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < this.radius) {
            this.charge++;
            if (frameCount % 10 === 0) sound.blackHoleCharge();
            particles.push(new Particle(this.x + (Math.random()-0.5)*40, this.y + (Math.random()-0.5)*40, '#00ffff'));
            if (this.charge >= this.maxCharge) this.explode();
        } else {
            if(this.charge > 0) this.charge--;
        }
    }
    explode() {
        this.active = false;
        sound.blackHoleBoom();
        enemies.forEach((e, idx) => {
            if (e.isBoss) {
                e.hp -= 500; floatText.show(e.x, e.y, "-500 DAMAGE", "#ff00ff");
            } else {
                e.hp = 0; particles.push(new Particle(e.x, e.y, '#ff0000')); killEnemy(e, idx);
            }
        });
        for(let i=0; i<50; i++) particles.push(new Particle(this.x, this.y, '#ffffff'));
        floatText.show(this.x, this.y, "GRAVITY COLLAPSE!", "#ffffff");
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y);
        const rot = frameCount * 0.1; ctx.rotate(rot);
        ctx.globalAlpha = this.life / 100;
        ctx.strokeStyle = '#330033'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = '#110011';
        ctx.beginPath(); ctx.arc(0, 0, this.radius - 5, 0, Math.PI*2); ctx.fill();
        const chargePct = this.charge / this.maxCharge;
        ctx.fillStyle = '#00f3ff';
        ctx.globalAlpha = 0.5 + (Math.sin(frameCount*0.5)*0.2);
        ctx.beginPath(); ctx.arc(0, 0, (this.radius - 10) * chargePct, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        if (this.active) {
            ctx.fillStyle = '#fff'; ctx.font = "12px monospace"; ctx.textAlign = "center";
            const secLeft = Math.ceil((this.maxCharge - this.charge) / 60);
            if (this.charge > 0) ctx.fillText(`HOLD: ${secLeft}s`, this.x, this.y - 60);
        }
    }
}
let blackHoles = [];


// --- ЛУТ ---
class Loot {
    constructor(x, y, type) {
        this.x=x; this.y=y; this.type=type;
        this.life = 600; 
        this.active=true; 
        this.hoverOffset = 0;
    }
    update() {
        this.life--; 
        this.hoverOffset = Math.sin(frameCount * 0.1) * 3;
        
        if(Math.hypot(player.x - this.x, player.y - this.y) < 30) {
            this.active = false; sound.pickup();
            if(this.type === 'medkit') { medkits++; floatText.show(this.x,this.y,"+1 MEDKIT","#ff0033"); }
            else if(this.type === 'mega_medkit') { player.hp = player.maxHp; sound.powerup(); floatText.show(this.x,this.y,"FULL HEAL","#00ff00"); }
            else if(this.type === 'star') { stars++; floatText.show(this.x,this.y,"+1 STAR","#ffea00"); }
            else if(this.type === 'missile') { player.missiles++; floatText.show(this.x,this.y,"+1 ROCKET","#ffaa00"); }
            else if(this.type === 'xp') player.gainXp(10);
            updateUI();
        }
        if(this.life<=0) this.active = false;
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y + this.hoverOffset);
        
        if(this.type === 'medkit') {
            ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, -14, 5, Math.PI, 0); ctx.stroke(); 
            ctx.fillStyle = '#990000'; ctx.beginPath(); ctx.roundRect(-12, -10, 24, 22, 5); ctx.fill(); 
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.roundRect(-12, -12, 24, 20, 5); ctx.fill(); 
            ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 4;
            ctx.beginPath(); ctx.rect(-3, -7, 6, 10); ctx.rect(-7, -5, 14, 6); ctx.fill(); 
            ctx.shadowBlur = 0;
            ctx.font = "bold 10px sans-serif"; ctx.fillStyle = '#fff'; ctx.textAlign = "center"; ctx.fillText("HP", 0, -22);
        } 
        else if (this.type === 'mega_medkit') {
            ctx.shadowBlur = 15; ctx.shadowColor = '#00ff00';
            ctx.fillStyle = '#00ff00'; ctx.beginPath(); ctx.roundRect(-14, -14, 28, 28, 6); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = "bold 20px Arial"; ctx.textAlign = "center"; ctx.fillText("+", 0, 8);
            ctx.font = "bold 10px sans-serif"; ctx.fillStyle = '#00ff00'; ctx.fillText("FULL", 0, -20);
        }
        else if(this.type === 'star') {
            ctx.shadowBlur = 10; ctx.shadowColor = '#ffea00';
            ctx.fillStyle = '#ffea00'; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
            ctx.font = "bold 10px sans-serif"; ctx.fillStyle = '#ffea00'; ctx.textAlign = "center"; ctx.fillText("BONUS", 0, -15);
        } 
        else if(this.type === 'missile') {
            ctx.rotate(-Math.PI/4);
            ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(4,4); ctx.lineTo(-4,4); ctx.fill();
            ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(6,10); ctx.lineTo(-6,10); ctx.fill();
            ctx.rotate(Math.PI/4);
            ctx.font = "bold 10px sans-serif"; ctx.fillStyle = '#ffaa00'; ctx.textAlign = "center"; ctx.fillText("ROCKET", 0, -15);
        } else {
            ctx.shadowBlur = 5; ctx.shadowColor = '#00ff00';
            ctx.fillStyle = '#00ff00'; ctx.fillRect(-5,-5,10,10);
            ctx.font = "bold 10px sans-serif"; ctx.fillStyle = '#00ff00'; ctx.textAlign = "center"; ctx.fillText("XP", 0, -10);
        }
        ctx.restore();
    }
}
let lootList = [];

class Bullet {
    constructor(x, y, a, dmg, isEnemy=false) { 
        this.x=x; this.y=y; this.vx=Math.cos(a)*(isEnemy?5:18); this.vy=Math.sin(a)*(isEnemy?5:18); 
        this.dmg=dmg; this.active=true; this.isEnemy=isEnemy; 
    }
    update() { this.x+=this.vx; this.y+=this.vy; if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height) this.active=false; }
    draw() {
        ctx.shadowBlur = 10; 
        if (this.isEnemy) {
            ctx.shadowColor = '#ff0033'; ctx.fillStyle = '#ff0033'; 
            ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.shadowColor = '#00f3ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; 
            ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x-this.vx*0.5, this.y-this.vy*0.5); ctx.stroke();
        }
        ctx.shadowBlur = 0;
    }
}
let bullets = [];
let enemyBullets = [];

class Missile {
    constructor(x, y, target) {
        this.x=x; this.y=y; this.target=target; this.active=true; this.angle=-Math.PI/2; this.speed=4; this.life=150;
    }
    update() {
        this.life--; if(this.life<=0) this.active=false;
        if(this.target && this.target.hp > 0) {
            const desired = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            let diff = desired - this.angle;
            while(diff < -Math.PI) diff+=Math.PI*2; while(diff > Math.PI) diff-=Math.PI*2;
            this.angle += diff*0.1; this.speed += 0.3;
        } else { this.target = findNearestEnemy(this.x, this.y); }
        this.x += Math.cos(this.angle)*this.speed; this.y += Math.sin(this.angle)*this.speed;
        if(frameCount%2===0) particles.push(new Particle(this.x,this.y,'#ff5500'));
    }
    draw() {
        ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);
        ctx.fillStyle = '#888'; ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-4,4); ctx.lineTo(-4,-4); ctx.fill();
        ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-8,3); ctx.lineTo(-8,-3); ctx.fill();
        ctx.restore();
    }
}
let missiles = [];

// --- ИГРОК ---
const player = {
    x: 0, y: 0, radius: 25, color: '#00f3ff', 
    hp: 100, maxHp: 100, level: 1, xp: 0, nextXp: 100,
    dmg: 10, fireRate: 10, cooldown: 0, missiles: 3, missileCd: 0, hitTimer: 0,
    invulnTimer: 0, // ТАЙМЕР НЕУЯЗВИМОСТИ
    reset() {
        this.x = canvas.width/2; this.y = canvas.height/2;
        this.hp = 100; this.maxHp = 100; this.level = 1; this.xp = 0; this.nextXp = 100;
        this.dmg = 10; this.fireRate = 10; this.missiles = 3; this.hitTimer = 0; this.invulnTimer = 0;
    },
    update() {
        if(keys['KeyW'] || keys['ArrowUp']) this.y -= 5;
        if(keys['KeyS'] || keys['ArrowDown']) this.y += 5;
        if(keys['KeyA'] || keys['ArrowLeft']) this.x -= 5;
        if(keys['KeyD'] || keys['ArrowRight']) this.x += 5;
        this.x = Math.max(30, Math.min(canvas.width-30, this.x));
        this.y = Math.max(30, Math.min(canvas.height-30, this.y));
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        
        if(this.cooldown>0) this.cooldown--;
        if(this.missileCd>0) this.missileCd--;
        if(this.hitTimer>0) this.hitTimer--;
        if(this.invulnTimer>0) this.invulnTimer--;
        if(isMouseDown) this.shoot();
    },
    shoot() {
        if(this.cooldown<=0) {
            bullets.push(new Bullet(this.x, this.y, this.angle, this.dmg));
            this.cooldown = this.fireRate;
            sound.shoot();
        }
    },
    tryFireMissile() {
        if(this.missiles > 0 && this.missileCd <= 0) {
            const t = findNearestEnemy(this.x, this.y);
            if(t) {
                missiles.push(new Missile(this.x, this.y, t));
                this.missiles--; this.missileCd = 30; updateUI(); sound.shoot();
            }
        }
    },
    gainXp(amount) {
        this.xp += amount;
        if(this.xp >= this.nextXp) {
            this.xp -= this.nextXp; this.level++; this.nextXp *= 1.2;
            currentState = STATE.LEVEL_UP; showUpgrades();
        }
        updateUI();
    },
    takeDamage(dmg) {
        if(this.invulnTimer > 0) return; // Если есть неуязвимость - игнорируем урон
        
        this.hp -= dmg;
        this.hitTimer = 10; 
        this.invulnTimer = 30; // 0.5 секунды неуязвимости
        
        if (this.hp < 0) this.hp = 0; // Защита от минуса
        updateUI();
        sound.hit();
        
        if(this.hp <= 0) gameOver();
    },
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        
        // Мигание при неуязвимости
        if(this.invulnTimer > 0 && Math.floor(frameCount / 4) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        let strokeCol = this.color; let fillCol = '#050505';
        if (this.hitTimer > 0) { strokeCol = '#ff0000'; fillCol = '#550000'; ctx.shadowBlur = 30; ctx.shadowColor = '#ff0000'; }
        else { ctx.shadowBlur = 15; ctx.shadowColor = this.color; }

        if (this.hitTimer <= 0) {
            const flicker = Math.random() * 3; ctx.fillStyle = strokeCol;
            ctx.fillRect(-25 - flicker, -8, 10 + flicker, 2); ctx.fillRect(-25 - flicker, 6, 10 + flicker, 2);
        }
        ctx.fillStyle = fillCol; ctx.strokeStyle = strokeCol; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(10, -25); ctx.lineTo(-20, -25); ctx.lineTo(-25, -10); ctx.lineTo(0, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10, 25); ctx.lineTo(-20, 25); ctx.lineTo(-25, 10); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillRect(-5, -15, 6, 30); ctx.strokeRect(-5, -15, 6, 30);
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-5, 6); ctx.lineTo(-10, 0); ctx.lineTo(-5, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (this.hitTimer <= 0) {
            ctx.shadowBlur = 5; ctx.shadowColor = '#ffffff'; ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
};

// --- ВРАГИ ---
class Enemy {
    constructor(boss=false, bossParent=null) {
        this.boss = boss;
        this.bossParent = bossParent;
        this.isDefender = !!bossParent;
        this.shootTimer = Math.random() * 120;

        if(boss) {
            this.x=canvas.width/2; this.y=-100; this.hp=1000 + player.level*200; this.maxHp=this.hp; this.r=70; this.speed=0.5; 
            this.color='#ff0033'; this.type='boss'; this.rotation=0;
            document.getElementById('bossContainer').style.display='block';
        } 
        else if (this.isDefender) {
            this.x = bossParent.x; this.y = bossParent.y;
            this.hp = 60 + player.level*10; this.maxHp = this.hp; this.r = 15; this.speed = 0;
            this.color = '#ff0033'; this.type = 'defender'; this.angleOffset = Math.random() * Math.PI * 2;
            this.orbitRadius = 100;
            this.damage = 15;
        }
        else {
            const rand = Math.random(); const edge = Math.floor(Math.random()*4);
            if(edge==0){this.x=Math.random()*canvas.width;this.y=-30;}
            else if(edge==1){this.x=canvas.width+30;this.y=Math.random()*canvas.height;}
            else if(edge==2){this.x=Math.random()*canvas.width;this.y=canvas.height+30;}
            else{this.x=-30;this.y=Math.random()*canvas.height;}

            if(rand < 0.2) { 
                this.type = 'tank'; this.hp = 50 + player.level*8; this.maxHp = this.hp;
                this.speed = 1.0; this.r = 25; this.color = '#ff00ff';
            } else if (rand < 0.5) {
                this.type = 'runner'; this.hp = 15 + player.level*3; this.maxHp = this.hp;
                this.speed = 3.5; this.r = 12; this.color = '#ffea00';
            } else {
                this.type = 'normal'; this.hp = 30 + player.level*5; this.maxHp = this.hp;
                this.speed = 2.0; this.r = 18; this.color = '#00ff00';
            }
            this.damage = 10;
        }
    }
    update() {
        if(this.type === 'boss') {
            const a = Math.atan2(player.y-this.y, player.x-this.x);
            this.x += Math.cos(a)*this.speed; this.y += Math.sin(a)*this.speed;
            this.angle = a; 
            this.shootTimer--;
            if(this.shootTimer <= 0) {
                this.shootTimer = 60; 
                sound.enemyShoot();
                enemyBullets.push(new Bullet(this.x + Math.cos(a+0.5)*40, this.y + Math.sin(a+0.5)*40, a, 20, true));
                enemyBullets.push(new Bullet(this.x + Math.cos(a-0.5)*40, this.y + Math.sin(a-0.5)*40, a, 20, true));
            }
        }
        else if (this.type === 'defender') {
            if(!this.bossParent || this.bossParent.hp <= 0) {
                this.hp = 0; 
            } else {
                this.angleOffset += 0.02;
                this.x = this.bossParent.x + Math.cos(this.angleOffset) * this.orbitRadius;
                this.y = this.bossParent.y + Math.sin(this.angleOffset) * this.orbitRadius;
                this.shootTimer--;
                if(this.shootTimer <= 0) {
                    this.shootTimer = 120;
                    const a = Math.atan2(player.y-this.y, player.x-this.x);
                    enemyBullets.push(new Bullet(this.x, this.y, a, 10, true));
                }
            }
        }
        else {
            const a = Math.atan2(player.y-this.y, player.x-this.x);
            this.x += Math.cos(a)*this.speed; this.y += Math.sin(a)*this.speed;
            this.angle = a;
        }
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.shadowBlur=15; ctx.shadowColor=this.color;
        ctx.lineWidth = 2; ctx.strokeStyle = this.color; ctx.fillStyle = '#050505';

        if(this.boss) { 
            ctx.rotate(this.angle);
            ctx.beginPath();
            ctx.moveTo(30, 0); ctx.lineTo(10, 30); ctx.lineTo(-30, 30); ctx.lineTo(-40, 0); ctx.lineTo(-30, -30); ctx.lineTo(10, -30);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#330000'; ctx.beginPath(); ctx.arc(0,0,25,0,Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#550000';
            ctx.fillRect(5, -45, 30, 20); ctx.strokeRect(5, -45, 30, 20);
            ctx.fillRect(5, 25, 30, 20); ctx.strokeRect(5, 25, 30, 20);
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(35, -35, 5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(35, 35, 5, 0, Math.PI*2); ctx.fill();
        }
        else if(this.type === 'defender') {
            ctx.rotate(this.angleOffset);
            ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(0,10); ctx.lineTo(-10,0); ctx.lineTo(0,-10); ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        else if(this.type === 'tank') {
            ctx.rotate(this.angle);
            ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(5, 15); ctx.lineTo(-15, 15); ctx.lineTo(-15, -15); ctx.lineTo(5, -15);
            ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeRect(-10, -8, 10, 16);
        }
        else if(this.type === 'runner') {
            ctx.rotate(this.angle);
            ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 8); ctx.lineTo(-5, 0); ctx.lineTo(-10, -8);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        else { 
            ctx.rotate(this.angle);
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, 10); ctx.lineTo(-5, -10); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(-15, 15); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-15, -15); ctx.stroke();
        }
        ctx.restore();
    }
}
let enemies = [];
let bossActive = false;

function findNearestEnemy(x,y) {
    let t=null, d=Infinity;
    for(let e of enemies) { let dist=Math.hypot(e.x-x,e.y-y); if(dist<d){d=dist;t=e;} }
    return t;
}

function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    player.reset(); enemies=[]; bullets=[]; enemyBullets=[]; lootList=[]; missiles=[]; particles=[]; blackHoles=[];
    medkits=0; stars=0; scoreTime=0; killScore=0; bossActive=false;
    currentState = STATE.PLAYING;
    updateUI();
}

function togglePause() {
    if(currentState===STATE.PLAYING) { currentState=STATE.PAUSE; document.getElementById('pauseScreen').style.display='flex'; }
    else { currentState=STATE.PLAYING; document.getElementById('pauseScreen').style.display='none'; }
}

function showUpgrades() {
    document.getElementById('levelUpScreen').style.display='flex';
    const c = document.getElementById('upgradeContainer'); c.innerHTML='';
    const opts = [
        {n:"УРОН", d:"+10 Dmg", f:()=>{player.dmg+=10;}},
        {n:"СКОРОСТЬ", d:"Fire Rate", f:()=>{player.fireRate=Math.max(5,player.fireRate-2);}},
        {n:"HP BOOST", d:"+20 HP & Heal", f:()=>{ player.maxHp+=20; player.hp = player.maxHp; }},
        {n:"РАКЕТЫ", d:"+3 Ammo", f:()=>{player.missiles+=3;}}
    ];
    opts.sort(()=>Math.random()-0.5).slice(0,3).forEach(u=>{
        const b=document.createElement('div'); b.className='upgrade-card';
        b.innerHTML=`<h3 style='color:#ffea00'>${u.n}</h3><p>${u.d}</p>`;
        b.onclick=()=>{ u.f(); document.getElementById('levelUpScreen').style.display='none'; currentState=STATE.PLAYING; updateUI(); };
        c.appendChild(b);
    });
}

function updateUI() {
    const hp = Math.max(0, player.hp); // Фикс минуса для UI
    document.getElementById('hpBar').style.width=(hp/player.maxHp*100)+'%';
    document.getElementById('hpText').innerText=Math.floor(hp)+'/'+player.maxHp;
    document.getElementById('xpBar').style.width=(player.xp/player.nextXp*100)+'%';
    document.getElementById('levelValue').innerText=player.level;
    document.getElementById('timer').innerText=scoreTime;
    document.getElementById('medkitVal').innerText=medkits;
    document.getElementById('starVal').innerText=stars;
    document.getElementById('missileVal').innerText=player.missiles;
}

function animate() {
    requestAnimationFrame(animate);
    if(currentState===STATE.MENU) {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        bg.draw(); return;
    }
    if(currentState!==STATE.PLAYING) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    bg.draw();

    frameCount++;
    if(frameCount%60===0 && !bossActive) {
        scoreTime++; updateUI();
        if(scoreTime>0 && scoreTime%60===0) { 
            bossActive=true; enemies=[]; 
            const boss = new Enemy(true);
            enemies.push(boss);
            // 5 Защитников
            for(let i=0; i<5; i++) enemies.push(new Enemy(false, boss));
        }
        if(Math.random() < 0.03) blackHoles.push(new BlackHole());
    }
    if(!bossActive && frameCount%spawnInterval===0 && enemies.length<MAX_ENEMIES) enemies.push(new Enemy());

    player.update(); player.draw();

    blackHoles.forEach((bh, i) => {
        bh.update(); bh.draw();
        if(!bh.active) blackHoles.splice(i, 1);
    });

    // Пули игрока
    bullets.forEach((b,i)=>{
        b.update(); b.draw();
        if(!b.active){bullets.splice(i,1); return;}
        for(let j=enemies.length-1; j>=0; j--) {
            let e=enemies[j];
            if(Math.hypot(e.x-b.x, e.y-b.y) < e.r+5) {
                e.hp-=b.dmg; b.active=false; particles.push(new Particle(e.x,e.y,'#fff'));
                sound.hit();
                if(e.hp<=0) killEnemy(e,j);
                break;
            }
        }
    });

    // Пули врагов
    enemyBullets.forEach((b,i)=>{
        b.update(); b.draw();
        if(!b.active){enemyBullets.splice(i,1); return;}
        if(Math.hypot(player.x-b.x, player.y-b.y) < player.radius) {
            player.takeDamage(b.dmg); b.active=false;
        }
    });

    missiles.forEach((m,i)=>{
        m.update(); m.draw();
        if(!m.active){missiles.splice(i,1); return;}
        for(let j=enemies.length-1; j>=0; j--) {
            let e=enemies[j];
            if(Math.hypot(e.x-m.x, e.y-m.y) < e.r+10) {
                e.hp-=100; m.active=false;
                sound.explode();
                for(let k=0;k<10;k++) particles.push(new Particle(m.x,m.y,'#ffaa00'));
                if(e.hp<=0) killEnemy(e,j);
                break;
            }
        }
    });

    enemies.forEach(e=>{
        e.update(); e.draw();
        if(e.boss) document.getElementById('bossHpBar').style.width=(e.hp/e.maxHp*100)+'%';
        if(Math.hypot(player.x-e.x, player.y-e.y) < player.radius+e.r) {
            player.takeDamage(e.damage);
        }
    });

    lootList.forEach(l=>{l.update(); l.draw();}); lootList=lootList.filter(l=>l.active);
    particles.forEach(p=>{p.draw();}); particles=particles.filter(p=>p.update());
    floatText.updateAndDraw();
}

function killEnemy(e, idx) {
    enemies.splice(idx,1); killScore+=e.boss?1000:100;
    
    // ЛУТ
    if(!e.boss && !e.isDefender) {
        lootList.push(new Loot(e.x,e.y,'xp'));
        if(Math.random()<0.05) lootList.push(new Loot(e.x+10,e.y,'medkit'));
        if(Math.random()<0.60) lootList.push(new Loot(e.x-10,e.y,'star'));
        if(Math.random()<0.15) lootList.push(new Loot(e.x,e.y+10,'missile'));
    } 
    else if(e.boss) {
        lootList.push(new Loot(e.x,e.y,'mega_medkit')); 
        for(let k=0;k<5;k++) lootList.push(new Loot(e.x+(Math.random()*40-20),e.y+(Math.random()*40-20),'star'));
        for(let k=0;k<3;k++) lootList.push(new Loot(e.x+(Math.random()*40-20),e.y+(Math.random()*40-20),'missile'));
        bossActive=false; 
        document.getElementById('bossContainer').style.display='none'; 
        scoreTime=0; 
    }
}
