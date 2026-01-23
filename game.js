
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
    constructor() {
        this.ctx = null;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    playTone(freq, type, dur, vol=0.1) {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
    }
    shoot() { this.playTone(400, 'square', 0.1, 0.05); }
    hit() { this.playTone(100, 'sawtooth', 0.1, 0.1); }
    pickup() { this.playTone(600, 'sine', 0.1, 0.1); }
    explode() { this.playTone(50, 'sawtooth', 0.3, 0.2); }
}
const sound = new SoundManager();

// --- ИНИЦИАЛИЗАЦИЯ КНОПОК ---
window.onload = function() {
    const startBtn = document.getElementById('startBtn');
    if(startBtn) {
        startBtn.onclick = () => {
            sound.init(); // Включаем звук по клику
            startGame();
        };
    }
    document.getElementById('resumeBtn').onclick = togglePause;
    animate(); // Запускаем цикл отрисовки меню
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


// --- КЛАССЫ ВИЗУАЛА ---

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
    draw() { ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, 4, 4); ctx.globalAlpha = 1.0; }
}
let particles = [];

// --- ЛУТ (ГЕОМЕТРИЧЕСКИЕ ФИГУРЫ) ---
class Loot {
    constructor(x, y, type) {
        this.x=x; this.y=y; this.type=type;
        this.life = (type==='star') ? 900 : 600; 
        this.active=true; this.angle=0; this.magnet=false;
    }
    update() {
        this.life--; this.angle += 0.05;
        if(Math.hypot(player.x - this.x, player.y - this.y) < 150) this.magnet = true;
        if(this.magnet) {
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(a)*8; this.y += Math.sin(a)*8;
        }
        if(Math.hypot(player.x - this.x, player.y - this.y) < 30) {
            this.active = false; sound.pickup();
            if(this.type === 'medkit') { medkits++; floatText.show(this.x,this.y,"MEDKIT","#ff0033"); }
            else if(this.type === 'star') { stars++; floatText.show(this.x,this.y,"STAR","#ffea00"); }
            else if(this.type === 'missile') { player.missiles++; floatText.show(this.x,this.y,"MISSILE","#ffaa00"); }
            else if(this.type === 'xp') player.gainXp(10);
            updateUI();
        }
        if(this.life<=0) this.active = false;
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.shadowBlur = 15;
        // ОТРИСОВКА: ТОЛЬКО ГЕОМЕТРИЯ
        if(this.type === 'medkit') {
            ctx.shadowColor = '#ff0033'; ctx.fillStyle = '#ff0033'; 
            ctx.fillRect(-8,-8,16,16); // Квадрат
            ctx.fillStyle = '#fff'; ctx.fillRect(-2,-6,4,12); ctx.fillRect(-6,-2,12,4); // Крест
        } else if(this.type === 'star') {
            ctx.shadowColor = '#ffea00'; ctx.fillStyle = '#ffea00'; 
            ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(8,0); ctx.lineTo(0,10); ctx.lineTo(-8,0); ctx.fill(); // Ромб
        } else if(this.type === 'missile') {
            ctx.shadowColor = '#ffaa00'; ctx.fillStyle = '#ffaa00';
            ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(8,8); ctx.lineTo(-8,8); ctx.fill(); // Треугольник
        } else {
            ctx.shadowColor = '#00ff00'; ctx.fillStyle = '#00ff00'; ctx.fillRect(-4,-4,8,8); // Малый квадрат
        }
        ctx.restore();
    }
}
let lootList = [];

class Bullet {
    constructor(x, y, a, dmg) { this.x=x; this.y=y; this.vx=Math.cos(a)*15; this.vy=Math.sin(a)*15; this.dmg=dmg; this.active=true; }
    update() { this.x+=this.vx; this.y+=this.vy; if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height) this.active=false; }
    draw() {
        ctx.strokeStyle = '#00f3ff'; ctx.lineWidth = 3; 
        ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x-this.vx, this.y-this.vy); ctx.stroke();
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
        ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-5,5); ctx.lineTo(-5,-5); ctx.fill();
        ctx.restore();
    }
}
let missiles = [];

// --- ИГРОК ---
const player = {
    x: 0, y: 0, radius: 15, color: '#00f3ff', speed: 5, angle: 0,
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
        ctx.shadowBlur = 15; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
        // ТРЕУГОЛЬНИК
        ctx.beginPath(); ctx.moveTo(15,0); ctx.lineTo(-10,10); ctx.lineTo(-5,0); ctx.lineTo(-10,-10); ctx.fill();
        ctx.restore();
    }
};

class Enemy {
    constructor(boss=false) {
        this.boss = boss;
        if(boss) {
            this.x=canvas.width/2; this.y=-100; this.hp=600; this.maxHp=600; this.r=60; this.speed=1; this.color='#ff0033';
            document.getElementById('bossContainer').style.display='block';
        } else {
            const s = Math.floor(Math.random()*4);
            if(s==0){this.x=Math.random()*canvas.width;this.y=-30;}
            else if(s==1){this.x=canvas.width+30;this.y=Math.random()*canvas.height;}
            else if(s==2){this.x=Math.random()*canvas.width;this.y=canvas.height+30;}
            else{this.x=-30;this.y=Math.random()*canvas.height;}
            this.hp=20+player.level*5; this.maxHp=this.hp; this.r=15; this.speed=2+Math.random(); this.color='#ff00ff';
        }
    }
    update() {
        const a = Math.atan2(player.y-this.y, player.x-this.x);
        this.x += Math.cos(a)*this.speed; this.y += Math.sin(a)*this.speed;
    }
    draw() {
        ctx.save(); ctx.shadowBlur=10; ctx.shadowColor=this.color; ctx.fillStyle=this.color;
        // КВАДРАТ ИЛИ ШЕСТИУГОЛЬНИК (ГЕОМЕТРИЯ)
        if(this.boss) { 
            ctx.fillRect(this.x-this.r,this.y-this.r,this.r*2,this.r*2); // Босс - Квадрат
            ctx.strokeStyle='#fff'; ctx.strokeRect(this.x-this.r,this.y-this.r,this.r*2,this.r*2); 
        }
        else { 
            ctx.beginPath(); 
            for(let i=0;i<6;i++) ctx.lineTo(this.x+this.r*Math.cos(i*Math.PI/3), this.y+this.r*Math.sin(i*Math.PI/3)); 
            ctx.fill(); ctx.strokeStyle='#fff'; ctx.stroke(); 
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
        {n:"HP", d:"+20 MaxHP", f:()=>{player.maxHp+=20;player.hp+=20;}},
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
    lootList.push(new Loot(e.x,e.y,e.boss?'xp':'xp'));
    if(Math.random()<0.05) lootList.push(new Loot(e.x+10,e.y,'medkit'));
    if(Math.random()<0.60) lootList.push(new Loot(e.x-10,e.y,'star'));
    if(Math.random()<0.15) lootList.push(new Loot(e.x,e.y+10,'missile'));
    if(e.boss) { bossActive=false; document.getElementById('bossContainer').style.display='none'; scoreTime=0; }
}
