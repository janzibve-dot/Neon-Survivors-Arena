
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

// --- ЗВУКОВОЙ ДВИЖОК ---
class SoundManager {
    constructor() { this.ctx = null; }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
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
    hit() { this.playTone(100, 'sawtooth', 0.1, 0.1); }
    pickup() { this.playTone(600, 'sine', 0.1, 0.1); }
    powerup() { this.playTone(300, 'square', 0.3, 0.15); }
    explode() { this.playTone(50, 'sawtooth', 0.3, 0.2); }
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
    
    // Аптечка [1]
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


// --- ВИЗУАЛ ---
class Background {
    constructor() {
        this.stars = [];
        for(let i=0; i<60; i++) this.stars.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            size: Math.random() * 3, speed: Math.random() * 0.5 + 0.1
        });
    }
    draw() {
        ctx.fillStyle = "#fff";
        this.stars.forEach(s => {
            s.y += s.speed;
            if(s.y > canvas.height) s.y = 0;
            ctx.globalAlpha = 0.2;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
        ctx.globalAlpha = 1.0;
    }
}
const bg = new Background();

class FloatingText {
    constructor() { this.pool = []; }
    show(x, y, text, color) { this.pool.push({x, y, text, color, life: 50}); }
    updateAndDraw() {
        ctx.font = "bold 16px monospace";
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
        // 3D частица
        ctx.fillRect(this.x, this.y+2, 4, 4); // Тень
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, 4, 4);   // Свет
        ctx.globalAlpha = 1.0; 
    }
}
let particles = [];

// --- ЛУТ (3D ГЕОМЕТРИЯ) ---
class Loot {
    constructor(x, y, type) {
        this.x=x; this.y=y; this.type=type;
        this.life = (type==='star' || type==='mega_medkit') ? 900 : 600; 
        this.active=true; this.angle=0; this.magnet=false;
        this.zHeight = 5; // Высота "3D"
    }
    update() {
        this.life--; this.angle += 0.05;
        // Эффект парения
        this.zOffset = Math.sin(frameCount * 0.1) * 3; 

        if(Math.hypot(player.x - this.x, player.y - this.y) < 150) this.magnet = true;
        if(this.magnet) {
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(a)*8; this.y += Math.sin(a)*8;
        }
        if(Math.hypot(player.x - this.x, player.y - this.y) < 35) {
            this.active = false; sound.pickup();
            if(this.type === 'medkit') { medkits++; floatText.show(this.x,this.y,"MEDKIT","#ff0033"); }
            else if(this.type === 'mega_medkit') { 
                player.hp = player.maxHp; sound.powerup();
                floatText.show(this.x,this.y,"FULL RESTORE","#00ff00"); 
            }
            else if(this.type === 'star') { stars++; floatText.show(this.x,this.y,"STAR","#ffea00"); }
            else if(this.type === 'missile') { player.missiles++; floatText.show(this.x,this.y,"MISSILE","#ffaa00"); }
            else if(this.type === 'xp') player.gainXp(10);
            updateUI();
        }
        if(this.life<=0) this.active = false;
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y + this.zOffset); 
        
        // 3D ЭФФЕКТ: Рисуем "толщину" затемненным цветом, затем "крышку"
        if(this.type === 'medkit') {
            // Тень (Бок)
            ctx.fillStyle = '#990000';
            ctx.fillRect(-8, -8 + this.zHeight, 16, 16);
            // Верх
            ctx.shadowColor = '#ff0033'; ctx.shadowBlur = 10;
            ctx.fillStyle = '#ff0033'; 
            ctx.fillRect(-8, -8, 16, 16);
            // Крест
            ctx.fillStyle = '#fff'; ctx.fillRect(-2,-6,4,12); ctx.fillRect(-6,-2,12,4); 
        } 
        else if (this.type === 'mega_medkit') {
            // Тень
            ctx.fillStyle = '#005500';
            ctx.fillRect(-12, -4 + this.zHeight, 24, 8);
            ctx.fillRect(-4, -12 + this.zHeight, 8, 24);
            // Верх
            ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 15;
            ctx.fillStyle = '#00ff00'; 
            ctx.fillRect(-12,-4,24,8); ctx.fillRect(-4,-12,8,24);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.strokeRect(-12,-4,24,8); ctx.strokeRect(-4,-12,8,24);
        }
        else if(this.type === 'star') {
            ctx.rotate(this.angle);
            // Тень
            ctx.fillStyle = '#aa8800';
            this.drawStarPath(this.zHeight);
            // Верх
            ctx.shadowColor = '#ffea00'; ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffea00'; 
            this.drawStarPath(0);
        } 
        else if(this.type === 'missile') {
            ctx.rotate(this.angle);
            // Тень
            ctx.fillStyle = '#aa6600';
            this.drawTrianglePath(this.zHeight);
            // Верх
            ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffaa00';
            this.drawTrianglePath(0);
        } else {
            // XP
            ctx.fillStyle = '#005500'; ctx.fillRect(-4, -4+4, 8, 8);
            ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 5;
            ctx.fillStyle = '#00ff00'; ctx.fillRect(-4,-4,8,8);
        }
        ctx.restore();
    }
    
    drawStarPath(offsetY) {
        ctx.beginPath(); ctx.moveTo(0,-10+offsetY); ctx.lineTo(8,0+offsetY); ctx.lineTo(0,10+offsetY); ctx.lineTo(-8,0+offsetY); ctx.fill();
    }
    drawTrianglePath(offsetY) {
        ctx.beginPath(); ctx.moveTo(0,-10+offsetY); ctx.lineTo(8,8+offsetY); ctx.lineTo(-8,8+offsetY); ctx.fill();
    }
}
let lootList = [];

class Bullet {
    constructor(x, y, a, dmg) { this.x=x; this.y=y; this.vx=Math.cos(a)*15; this.vy=Math.sin(a)*15; this.dmg=dmg; this.active=true; }
    update() { this.x+=this.vx; this.y+=this.vy; if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height) this.active=false; }
    draw() {
        ctx.shadowBlur = 5; ctx.shadowColor = '#00f3ff';
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    }
}
let bullets = [];

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
            this.angle += diff*0.1; this.speed += 0.2;
        } else { this.target = findNearestEnemy(this.x, this.y); }
        this.x += Math.cos(this.angle)*this.speed; this.y += Math.sin(this.angle)*this.speed;
        if(frameCount%3===0) particles.push(new Particle(this.x,this.y,'#ffaa00'));
    }
    draw() {
        ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);
        // 3D Ракета
        ctx.fillStyle = '#884400'; // Тень
        ctx.beginPath(); ctx.moveTo(10,3); ctx.lineTo(-5,8); ctx.lineTo(-5,-2); ctx.fill();
        
        ctx.shadowColor='#ffaa00'; ctx.shadowBlur=10;
        ctx.fillStyle = '#ffaa00'; // Корпус
        ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-5,5); ctx.lineTo(-5,-5); ctx.fill();
        ctx.restore();
    }
}
let missiles = [];

// --- ИГРОК (3D) ---
const player = {
    x: 0, y: 0, radius: 15, color: '#00f3ff', darkColor: '#008b8b', speed: 5, angle: 0,
    hp: 100, maxHp: 100, level: 1, xp: 0, nextXp: 100,
    dmg: 10, fireRate: 10, cooldown: 0, missiles: 3, missileCd: 0,
    reset() {
        this.x = canvas.width/2; this.y = canvas.height/2;
        this.hp = 100; this.maxHp = 100; this.level = 1; this.xp = 0; this.nextXp = 100;
        this.dmg = 10; this.fireRate = 10; this.missiles = 3;
    },
    update() {
        if(keys['KeyW'] || keys['ArrowUp']) this.y -= this.speed;
        if(keys['KeyS'] || keys['ArrowDown']) this.y += this.speed;
        if(keys['KeyA'] || keys['ArrowLeft']) this.x -= this.speed;
        if(keys['KeyD'] || keys['ArrowRight']) this.x += this.speed;
        this.x = Math.max(15, Math.min(canvas.width-15, this.x));
        this.y = Math.max(15, Math.min(canvas.height-15, this.y));
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        
        if(this.cooldown>0) this.cooldown--;
        if(this.missileCd>0) this.missileCd--;
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
                this.missiles--; this.missileCd = 30; updateUI();
                sound.shoot();
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
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        
        // Тень/Бок (3D эффект)
        ctx.fillStyle = this.darkColor;
        ctx.beginPath(); ctx.moveTo(15, 5); ctx.lineTo(-10, 15); ctx.lineTo(-5, 5); ctx.lineTo(-10, -7); ctx.fill();

        // Верх (Свечение)
        ctx.shadowBlur = 15; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.moveTo(15,0); ctx.lineTo(-10,10); ctx.lineTo(-5,0); ctx.lineTo(-10,-10); ctx.fill();
        
        ctx.restore();
    }
};

// --- ВРАГИ (3 ТИПА + БОСС, ВСЕ В 3D) ---
class Enemy {
    constructor(boss=false) {
        this.boss = boss;
        this.zHeight = 8; // Высота врага

        if(boss) {
            this.x=canvas.width/2; this.y=-100; this.hp=600; this.maxHp=600; this.r=60; this.speed=1; 
            this.color='#ff0033'; this.darkColor='#880000';
            this.type = 'boss';
            document.getElementById('bossContainer').style.display='block';
        } else {
            // ГЕНЕРАЦИЯ ТИПА ВРАГА
            const rand = Math.random();
            const edge = Math.floor(Math.random()*4);
            
            // Позиция спавна
            if(edge==0){this.x=Math.random()*canvas.width;this.y=-30;}
            else if(edge==1){this.x=canvas.width+30;this.y=Math.random()*canvas.height;}
            else if(edge==2){this.x=Math.random()*canvas.width;this.y=canvas.height+30;}
            else{this.x=-30;this.y=Math.random()*canvas.height;}

            // Типы
            if(rand < 0.2) { 
                // ТАНК (Медленный, жирный, Квадрат)
                this.type = 'tank'; this.hp = 40 + player.level*8; this.maxHp = this.hp;
                this.speed = 1.0; this.r = 20; 
                this.color = '#ff00ff'; this.darkColor = '#880088'; // Фиолетовый
            } else if (rand < 0.5) {
                // БЕГУН (Быстрый, слабый, Треугольник)
                this.type = 'runner'; this.hp = 10 + player.level*3; this.maxHp = this.hp;
                this.speed = 3.5; this.r = 12;
                this.color = '#ffea00'; this.darkColor = '#aa8800'; // Желтый
            } else {
                // ОБЫЧНЫЙ (Средний, Шестиугольник)
                this.type = 'normal'; this.hp = 20 + player.level*5; this.maxHp = this.hp;
                this.speed = 2.0; this.r = 15;
                this.color = '#00ff00'; this.darkColor = '#005500'; // Зеленый
            }
            this.damage = 10;
        }
    }
    update() {
        const a = Math.atan2(player.y-this.y, player.x-this.x);
        this.x += Math.cos(a)*this.speed; this.y += Math.sin(a)*this.speed;
        
        // Поворот для бегунов (чтобы смотрели на игрока)
        if(this.type === 'runner') this.angle = a;
    }
    draw() {
        ctx.save(); 
        ctx.shadowBlur=10; ctx.shadowColor=this.color;
        
        if(this.boss) { 
            // Босс (3D Куб)
            ctx.fillStyle = this.darkColor; 
            ctx.fillRect(this.x-this.r, this.y-this.r + 10, this.r*2, this.r*2); // Тень
            
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x-this.r, this.y-this.r, this.r*2, this.r*2); // Лицо
            ctx.strokeStyle='#fff'; ctx.lineWidth=3;
            ctx.strokeRect(this.x-this.r,this.y-this.r,this.r*2,this.r*2); 
        }
        else if(this.type === 'tank') {
            // Танк (Ромб)
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.PI/4); // Поворот на 45 град
            ctx.fillStyle = this.darkColor;
            ctx.fillRect(-this.r, -this.r + 5, this.r*2, this.r*2);
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.r, -this.r, this.r*2, this.r*2);
        }
        else if(this.type === 'runner') {
            // Бегун (Треугольник)
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.fillStyle = this.darkColor;
            ctx.beginPath(); ctx.moveTo(this.r, 3); ctx.lineTo(-this.r, this.r+3); ctx.lineTo(-this.r, -this.r+3); ctx.fill();
            ctx.fillStyle = this.color;
            ctx.beginPath(); ctx.moveTo(this.r, 0); ctx.lineTo(-this.r, this.r); ctx.lineTo(-this.r, -this.r); ctx.fill();
        }
        else { 
            // Обычный (Шестиугольник)
            ctx.fillStyle = this.darkColor;
            this.drawHex(this.x, this.y + 5);
            ctx.fillStyle = this.color;
            this.drawHex(this.x, this.y);
        }
        ctx.restore();
    }
    
    drawHex(x, y) {
        ctx.beginPath(); 
        for(let i=0;i<6;i++) ctx.lineTo(x+this.r*Math.cos(i*Math.PI/3), y+this.r*Math.sin(i*Math.PI/3)); 
        ctx.fill(); 
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
    player.reset(); enemies=[]; bullets=[]; lootList=[]; missiles=[]; particles=[];
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
        {
            n:"HP BOOST", 
            d:"+20 MaxHP & FULL HEAL", 
            f:()=>{ 
                player.maxHp+=20; 
                player.hp = player.maxHp; 
            }
        },
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
    document.getElementById('hpBar').style.width=(player.hp/player.maxHp*100)+'%';
    document.getElementById('hpText').innerText=Math.floor(player.hp)+'/'+player.maxHp;
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
        bg.draw(); 
        return;
    }
    if(currentState!==STATE.PLAYING) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    bg.draw();

    frameCount++;
    if(frameCount%60===0 && !bossActive) {
        scoreTime++; updateUI();
        if(scoreTime>0 && scoreTime%60===0) { bossActive=true; enemies=[]; enemies.push(new Enemy(true)); }
    }
    if(!bossActive && frameCount%spawnInterval===0 && enemies.length<MAX_ENEMIES) enemies.push(new Enemy());

    player.update(); player.draw();

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
            player.hp-=1; updateUI();
            if(player.hp<=0) {
                currentState=STATE.GAME_OVER;
                document.getElementById('ui').style.display='none';
                document.getElementById('gameOverScreen').style.display='flex';
                document.getElementById('finalScore').innerText=killScore;
            }
        }
    });

    lootList.forEach(l=>{l.update(); l.draw();}); lootList=lootList.filter(l=>l.active);
    particles.forEach(p=>{p.draw();}); particles=particles.filter(p=>p.update());
    floatText.updateAndDraw();
}

function killEnemy(e, idx) {
    enemies.splice(idx,1); killScore+=e.boss?1000:100;
    
    // ЛУТ
    if(!e.boss) {
        lootList.push(new Loot(e.x,e.y,'xp'));
        if(Math.random()<0.05) lootList.push(new Loot(e.x+10,e.y,'medkit'));
        if(Math.random()<0.60) lootList.push(new Loot(e.x-10,e.y,'star'));
        if(Math.random()<0.15) lootList.push(new Loot(e.x,e.y+10,'missile'));
    } 
    else {
        lootList.push(new Loot(e.x,e.y,'mega_medkit')); 
        for(let k=0;k<5;k++) lootList.push(new Loot(e.x+(Math.random()*40-20),e.y+(Math.random()*40-20),'star'));
        for(let k=0;k<3;k++) lootList.push(new Loot(e.x+(Math.random()*40-20),e.y+(Math.random()*40-20),'missile'));
        bossActive=false; 
        document.getElementById('bossContainer').style.display='none'; 
        scoreTime=0; 
    }
}
