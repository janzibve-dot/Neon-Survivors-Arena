
/* game.js */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// === НАСТРОЙКИ ===
const GAME_SETTINGS = {
    playerSpeed: 5,
    bulletSpeed: 12,
    enemySpeed: 2,
    spawnRate: 60,
    lootLifetime: 600,
    starLifetime: 900,
    levelDuration: 60, // 60 секунд до босса
    medkitHeal: 30
};

// === СОСТОЯНИЕ ===
let gameState = {
    isRunning: true,
    isPaused: false,
    score: 0,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    frames: 0,
    stars: 0,
    medkits: 0,
    levelTime: GAME_SETTINGS.levelDuration,
    bossActive: false
};

// === ИГРОК ===
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 15, // Размер треугольника
    color: '#00ffcc', // Бирюзовый неон
    hp: 100,
    maxHp: 100,
    missiles: 3,
    shield: false,
    shieldTimer: 0,
    weaponLvl: 1,
    fireRate: 15,
    lastShot: 0,
    angle: 0 // Для вращения треугольника за мышкой
};

// === СПИСКИ ===
let bullets = [];
let enemies = [];
let loot = [];
let missiles = [];
let texts = [];
let boss = null;

// === УПРАВЛЕНИЕ ===
const keys = {};
const mouse = { x: 0, y: 0 };

window.addEventListener('keydown', e => {
    keys[e.code] = true; keys[e.key] = true;
    if(e.code === 'Space') activateShield();
    if(e.key === '1') useMedkit();
});
window.addEventListener('keyup', e => {
    keys[e.code] = false; keys[e.key] = false;
});
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
});
window.addEventListener('mousedown', e => {
    if(e.button === 2) fireMissile();
});
window.addEventListener('contextmenu', e => e.preventDefault());

// === ЛОГИКА ===
function useMedkit() {
    if (gameState.medkits > 0 && player.hp < player.maxHp) {
        gameState.medkits--;
        player.hp = Math.min(player.hp + GAME_SETTINGS.medkitHeal, player.maxHp);
        showText(player.x, player.y, `+${GAME_SETTINGS.medkitHeal} HP`, '#00ff00');
        updateUI();
    }
}

function activateShield() {
    if (!player.shield && gameState.isRunning) {
        player.shield = true;
        player.shieldTimer = 180;
        updateUI();
    }
}

function fireMissile() {
    if (player.missiles > 0 && gameState.isRunning) {
        player.missiles--;
        const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        missiles.push({
            x: player.x, y: player.y,
            vx: Math.cos(angle)*8, vy: Math.sin(angle)*8,
            damage: 100
        });
        updateUI();
    }
}

// === КЛАССЫ ===

class Enemy {
    constructor() {
        const edge = Math.floor(Math.random()*4);
        if(edge===0) { this.x = Math.random()*canvas.width; this.y = -30; }
        else if(edge===1) { this.x = canvas.width+30; this.y = Math.random()*canvas.height; }
        else if(edge===2) { this.x = Math.random()*canvas.width; this.y = canvas.height+30; }
        else { this.x = -30; this.y = Math.random()*canvas.height; }

        this.hp = 15 + (gameState.level * 5);
        this.maxHp = this.hp;
        this.speed = GAME_SETTINGS.enemySpeed + (gameState.level * 0.1);
        this.size = 25; // Размер квадрата
        this.color = '#ff0055'; // Неоновый розовый/красный
    }

    update() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }

    draw() {
        // РИСУЕМ КВАДРАТ (Строгая геометрия)
        ctx.fillStyle = this.color;
        // Отрисовка с центром в x,y
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        
        // Легкая обводка
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    }
}

class Boss {
    constructor() {
        this.x = canvas.width/2;
        this.y = -100;
        this.hp = 500 * gameState.level;
        this.maxHp = this.hp;
        this.size = 100; // Огромный квадрат
        this.speed = 1.0;
        this.angle = 0;
    }

    update() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
        this.angle += 0.02; // Медленное вращение

        // UI
        const fill = document.getElementById('boss-hp-fill');
        const text = document.getElementById('boss-hp-text');
        const pct = Math.max(0, (this.hp / this.maxHp) * 100);
        fill.style.width = pct + '%';
        text.textContent = Math.ceil(this.hp) + '/' + this.maxHp;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // РИСУЕМ БОССА: Большой квадрат/Ромб
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 4;
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
        
        ctx.fillStyle = 'rgba(255, 0, 85, 0.2)'; // Полупрозрачная заливка
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

        // Внутренний квадрат
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(-15, -15, 30, 30); // "Ядро" босса

        ctx.restore();
    }
}

class LootItem {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.life = (type === 'star') ? GAME_SETTINGS.starLifetime : GAME_SETTINGS.lootLifetime;
        this.magnet = false;
    }
    
    update() {
        this.life--;
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < 150 || this.magnet) {
            this.magnet = true;
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(a)*7; this.y += Math.sin(a)*7;
        }
        if (dist < 20) {
            collectLoot(this);
            return true;
        }
        return this.life <= 0;
    }

    draw() {
        if(this.type === 'xp') {
            ctx.fillStyle = '#00ff00'; 
            ctx.fillRect(this.x-2, this.y-2, 4, 4); // Маленькие квадратики опыта
        } else if(this.type === 'medkit') { 
            // Крестик
            ctx.fillStyle = 'red'; 
            ctx.fillRect(this.x-6, this.y-2, 12, 4);
            ctx.fillRect(this.x-2, this.y-6, 4, 12);
        } else if(this.type === 'star') { 
            // Ромбик вместо эмодзи звезды для геометрии
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y-8);
            ctx.lineTo(this.x+8, this.y);
            ctx.lineTo(this.x, this.y+8);
            ctx.lineTo(this.x-8, this.y);
            ctx.fill();
        } else if(this.type === 'missile') {
            ctx.fillStyle = 'orange';
            ctx.fillRect(this.x-3, this.y-3, 6, 6);
        }
    }
}

// === СИСТЕМА ===

function collectLoot(item) {
    if(item.type==='xp') { gameState.xp+=10; checkLvlUp(); }
    else if(item.type==='medkit') { gameState.medkits++; showText(player.x,player.y,'MEDKIT','red'); }
    else if(item.type==='star') { gameState.stars++; showText(player.x,player.y,'STAR','yellow'); }
    else if(item.type==='missile') { player.missiles++; showText(player.x,player.y,'MISSILE','orange'); }
    updateUI();
}

function checkLvlUp() {
    if(gameState.xp >= gameState.xpToNextLevel) {
        gameState.xp -= gameState.xpToNextLevel;
        gameState.level++;
        gameState.xpToNextLevel = Math.floor(gameState.xpToNextLevel * 1.2);
        gameState.isPaused = true;
        document.getElementById('level-up-screen').classList.remove('hidden');
        generateUpgrades();
    }
    updateUI();
}

function generateUpgrades() {
    const box = document.getElementById('upgrade-options');
    box.innerHTML = '';
    const upgrades = [
        {name: "TWIN SHOT", desc: "Fire +1 bullet", func: ()=>{player.weaponLvl++;}},
        {name: "SPEED UP", desc: "Move faster", func: ()=>{GAME_SETTINGS.playerSpeed+=1;}},
        {name: "HULL UP", desc: "Max HP +20", func: ()=>{player.maxHp+=20; player.hp+=20;}},
        {name: "RAPID FIRE", desc: "Shoot faster", func: ()=>{player.fireRate = Math.max(5, player.fireRate-2);}},
        {name: "ROCKETS", desc: "+3 Missiles", func: ()=>{player.missiles+=3;}}
    ];
    upgrades.sort(()=>Math.random()-0.5).slice(0,3).forEach(u => {
        const div = document.createElement('div');
        div.className = 'upgrade-card';
        div.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p>`;
        div.onclick = () => {
            u.func();
            document.getElementById('level-up-screen').classList.add('hidden');
            gameState.isPaused = false;
            updateUI();
        };
        box.appendChild(div);
    });
}

function spawnBoss() {
    gameState.bossActive = true;
    boss = new Boss();
    document.getElementById('boss-container').classList.remove('hidden');
    enemies = [];
    showText(canvas.width/2, canvas.height/2, "BOSS INCOMING", "red");
}

function bossDefeated() {
    gameState.bossActive = false;
    boss = null;
    document.getElementById('boss-container').classList.add('hidden');
    // Награда: рассыпать звезды
    for(let i=0; i<10; i++) {
        loot.push(new LootItem(player.x + (Math.random()*100-50), player.y + (Math.random()*100-50), 'star'));
    }
    loot.push(new LootItem(player.x, player.y, 'xp'));
    gameState.levelTime = GAME_SETTINGS.levelDuration;
    showText(canvas.width/2, canvas.height/2, "STAGE CLEARED", "#00ffcc");
}

function showText(x, y, txt, col) {
    texts.push({x, y, txt, col, life: 60});
}

function updateUI() {
    document.getElementById('hp-text').innerText = Math.ceil(player.hp)+'/'+player.maxHp;
    document.getElementById('hp-bar-fill').style.width = (player.hp/player.maxHp*100)+'%';
    document.getElementById('xp-bar-fill').style.width = (gameState.xp/gameState.xpToNextLevel*100)+'%';
    document.getElementById('lvl-text').innerText = gameState.level;
    
    const t = document.getElementById('timer-text');
    if(gameState.bossActive) {
        t.innerText = "BOSS"; t.style.color = "red";
    } else {
        t.innerText = Math.ceil(gameState.levelTime); t.style.color = "#ffcc00";
    }

    document.getElementById('star-count').innerText = gameState.stars;
    document.getElementById('medkit-count').innerText = gameState.medkits;
    document.getElementById('missile-count').innerText = player.missiles;
    
    const shi = document.getElementById('shield-indicator');
    if(player.shield) { shi.className='shield-on'; shi.innerText='ON'; }
    else { shi.className='shield-off'; shi.innerText='OFF'; }
}

// === ЦИКЛ ===
function loop() {
    requestAnimationFrame(loop);
    if(gameState.isPaused || !gameState.isRunning) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Логика
    if (!gameState.bossActive) {
        gameState.levelTime -= 1/60;
        if (gameState.levelTime <= 0) { gameState.levelTime = 0; spawnBoss(); }
        if (gameState.frames % 60 === 0) updateUI();
    }

    // Поворот игрока за мышью
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    // Движение игрока
    if(keys['KeyW'] || keys['ArrowUp']) player.y -= GAME_SETTINGS.playerSpeed;
    if(keys['KeyS'] || keys['ArrowDown']) player.y += GAME_SETTINGS.playerSpeed;
    if(keys['KeyA'] || keys['ArrowLeft']) player.x -= GAME_SETTINGS.playerSpeed;
    if(keys['KeyD'] || keys['ArrowRight']) player.x += GAME_SETTINGS.playerSpeed;
    
    player.x = Math.max(10, Math.min(canvas.width-10, player.x));
    player.y = Math.max(10, Math.min(canvas.height-10, player.y));

    // Стрельба
    if(mouse.x !== 0 && gameState.frames - player.lastShot > player.fireRate) {
        for(let i=0; i<player.weaponLvl; i++) {
            const spread = (i - (player.weaponLvl-1)/2)*0.1;
            bullets.push({
                x:player.x, y:player.y, 
                vx:Math.cos(player.angle+spread)*GAME_SETTINGS.bulletSpeed, 
                vy:Math.sin(player.angle+spread)*GAME_SETTINGS.bulletSpeed
            });
        }
        player.lastShot = gameState.frames;
    }

    // РИСУЕМ ИГРОКА (ТРЕУГОЛЬНИК)
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.beginPath();
    ctx.moveTo(15, 0);   // Нос
    ctx.lineTo(-10, 10); // Левое крыло
    ctx.lineTo(-5, 0);   // Вырез сзади
    ctx.lineTo(-10, -10);// Правое крыло
    ctx.closePath();
    ctx.fillStyle = player.color;
    ctx.fill();
    // Щит
    if(player.shield) {
        player.shieldTimer--;
        if(player.shieldTimer<=0) { player.shield=false; updateUI(); }
        ctx.beginPath(); ctx.arc(0,0,25,0,Math.PI*2); 
        ctx.strokeStyle='#00ffff'; ctx.lineWidth=2; ctx.stroke();
    }
    ctx.restore();

    // Пули
    bullets.forEach((b,i) => {
        b.x+=b.vx; b.y+=b.vy;
        ctx.fillStyle='#ffff00'; 
        ctx.fillRect(b.x-2, b.y-2, 4, 4); // Квадратные пули
        if(b.x<0||b.x>canvas.width||b.y<0||b.y>canvas.height) bullets.splice(i,1);
    });

    // Ракеты (Треугольники)
    missiles.forEach((m,i) => {
        m.x+=m.vx; m.y+=m.vy;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(Math.atan2(m.vy, m.vx));
        ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-5,4); ctx.lineTo(-5,-4); ctx.fill();
        ctx.restore();
        
        // Урон ракетой
        if (boss && Math.hypot(boss.x - m.x, boss.y - m.y) < boss.size/2 + 10) {
            boss.hp -= m.damage; missiles.splice(i, 1);
            showText(boss.x, boss.y, "CRITICAL", "orange");
            if (boss.hp <= 0) bossDefeated();
            return;
        }
        enemies.forEach((e) => {
             if (Math.hypot(e.x - m.x, e.y - m.y) < e.size) { e.hp -= m.damage; missiles.splice(i, 1); }
        });
        if(m.x<0||m.x>canvas.width||m.y<0||m.y>canvas.height) missiles.splice(i,1);
    });

    // Спавн
    if (!gameState.bossActive && gameState.frames % GAME_SETTINGS.spawnRate === 0) enemies.push(new Enemy());

    // Враги
    enemies.forEach((e, i) => {
        e.update();
        e.draw();
        
        // Столкновение
        if(Math.hypot(player.x-e.x, player.y-e.y) < e.size && !player.shield) {
            player.hp-=1; updateUI();
            if(player.hp<=0) { gameState.isRunning=false; document.getElementById('game-over-screen').classList.remove('hidden'); document.getElementById('final-score').innerText = gameState.score;}
        }

        bullets.forEach((b, bi) => {
            if(b.x > e.x - e.size/2 && b.x < e.x + e.size/2 && b.y > e.y - e.size/2 && b.y < e.y + e.size/2) {
                e.hp-=10; bullets.splice(bi,1);
                if(e.hp<=0) {
                    enemies.splice(i,1);
                    gameState.score+=100;
                    const rnd = Math.random();
                    if(rnd<0.6) loot.push(new LootItem(e.x,e.y,'star'));
                    if(rnd<0.05) loot.push(new LootItem(e.x,e.y,'medkit'));
                    if(rnd>0.9) loot.push(new LootItem(e.x,e.y,'missile'));
                    loot.push(new LootItem(e.x,e.y,'xp'));
                    updateUI();
                }
            }
        });
    });

    // Босс
    if (boss) {
        boss.update();
        boss.draw();
        if(Math.abs(player.x - boss.x) < boss.size/2 + 15 && Math.abs(player.y - boss.y) < boss.size/2 + 15 && !player.shield) {
             player.hp-=2; updateUI();
             if(player.hp<=0) { gameState.isRunning=false; document.getElementById('game-over-screen').classList.remove('hidden'); }
        }
        bullets.forEach((b, bi) => {
            if(Math.abs(b.x - boss.x) < boss.size/2 && Math.abs(b.y - boss.y) < boss.size/2) {
                boss.hp -= 5; bullets.splice(bi,1);
                if(boss.hp <= 0) bossDefeated();
            }
        });
    }

    // Лут
    loot.forEach((l, i) => { if(l.update()) loot.splice(i,1); else l.draw(); });

    // Текст
    texts.forEach((t, i) => {
        t.y-=1; t.life--;
        ctx.fillStyle=t.col; ctx.font="12px Courier New"; ctx.fillText(t.txt, t.x, t.y);
        if(t.life<=0) texts.splice(i,1);
    });

    gameState.frames++;
}

loop();
