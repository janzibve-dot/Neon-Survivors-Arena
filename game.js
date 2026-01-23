
/* game.js */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// === НАСТРОЙКИ ИГРЫ ===
const GAME_SETTINGS = {
    playerSpeed: 5,
    bulletSpeed: 12,
    enemySpeed: 2,
    spawnRate: 60,
    lootLifetime: 600, // 10 сек
    starLifetime: 900, // 15 сек
    levelDuration: 60, // Длительность раунда в секундах до босса
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
    levelTime: GAME_SETTINGS.levelDuration, // Таймер обратного отсчета
    bossActive: false // Идет ли битва с боссом
};

// === ИГРОК ===
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 20,
    color: '#00ffcc',
    hp: 100,
    maxHp: 100,
    missiles: 3,
    shield: false,
    shieldTimer: 0,
    weaponLvl: 1,
    fireRate: 15,
    lastShot: 0
};

// === ОБЪЕКТЫ ===
let bullets = [];
let enemies = [];
let loot = [];
let missiles = [];
let texts = [];
let boss = null; // Объект босса

// === УПРАВЛЕНИЕ ===
const keys = {};
const mouse = { x: 0, y: 0 };

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    keys[e.key] = true;
    if (e.code === 'Space') activateShield();
    if (e.key === '1') useMedkit();
});
window.addEventListener('keyup', e => {
    keys[e.code] = false;
    keys[e.key] = false;
});
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mousedown', e => {
    if (e.button === 2) fireMissile();
});
window.addEventListener('contextmenu', e => e.preventDefault());

// === ЛОГИКА ИГРОКА ===
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
        player.shieldTimer = 180; // 3 секунды
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
        // Спавн за краем экрана
        const edge = Math.floor(Math.random()*4);
        if(edge===0) { this.x = Math.random()*canvas.width; this.y = -40; }
        else if(edge===1) { this.x = canvas.width+40; this.y = Math.random()*canvas.height; }
        else if(edge===2) { this.x = Math.random()*canvas.width; this.y = canvas.height+40; }
        else { this.x = -40; this.y = Math.random()*canvas.height; }

        this.hp = 15 + (gameState.level * 5);
        this.maxHp = this.hp;
        this.speed = GAME_SETTINGS.enemySpeed + (gameState.level * 0.1);
        this.radius = 15;
        this.color = '#ff0055';
    }

    update() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.stroke();
    }
}

class Boss {
    constructor() {
        this.x = canvas.width/2;
        this.y = -150;
        this.hp = 500 * gameState.level;
        this.maxHp = this.hp;
        this.radius = 70;
        this.speed = 1.5;
        this.angle = 0;
    }

    update() {
        // Движение к игроку
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
        
        // Вращение для эффекта
        this.angle += 0.05;

        // Обновление HTML шкалы
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
        
        // Тело босса
        ctx.beginPath();
        ctx.rect(-50, -50, 100, 100);
        ctx.fillStyle = '#aa00cc';
        ctx.fill();
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.restore();
        
        // Череп в центре (не вращается)
        ctx.fillStyle = 'white';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠️', this.x, this.y);
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
        
        // Магнит
        if (dist < 150 || this.magnet) {
            this.magnet = true;
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(a)*6;
            this.y += Math.sin(a)*6;
        }

        if (dist < player.radius + 10) {
            collectLoot(this);
            return true; // Удалить
        }
        return this.life <= 0;
    }

    draw() {
        ctx.beginPath();
        if(this.type === 'xp') { ctx.fillStyle = '#00ff00'; ctx.arc(this.x,this.y,5,0,Math.PI*2); }
        else if(this.type === 'medkit') { 
            ctx.fillStyle = 'red'; ctx.fillRect(this.x-6,this.y-6,12,12);
            ctx.fillStyle='white'; ctx.fillRect(this.x-2,this.y-5,4,10); ctx.fillRect(this.x-5,this.y-2,10,4);
            return;
        }
        else if(this.type === 'star') { 
            ctx.fillStyle = 'yellow'; ctx.font='20px Arial'; ctx.fillText('⭐',this.x-8,this.y+8); return;
        }
        else if(this.type === 'missile') { ctx.fillStyle='orange'; ctx.arc(this.x,this.y,6,0,Math.PI*2); }
        ctx.fill();
    }
}

// === СИСТЕМА ИГРЫ ===

function collectLoot(item) {
    if(item.type==='xp') { gameState.xp+=10; checkLvlUp(); }
    else if(item.type==='medkit') { gameState.medkits++; showText(player.x,player.y,'+1 MEDKIT','red'); }
    else if(item.type==='star') { gameState.stars++; showText(player.x,player.y,'+1 STAR','yellow'); }
    else if(item.type==='missile') { player.missiles++; showText(player.x,player.y,'+1 MISSILE','orange'); }
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
        {name: "Twin Shot", desc: "Shoot more bullets", func: ()=>{player.weaponLvl++;}},
        {name: "Speed Boost", desc: "Move Faster", func: ()=>{GAME_SETTINGS.playerSpeed+=1;}},
        {name: "Max HP +20", desc: "Increase health", func: ()=>{player.maxHp+=20; player.hp+=20;}},
        {name: "Rapid Fire", desc: "Shoot faster", func: ()=>{player.fireRate = Math.max(5, player.fireRate-2);}},
        {name: "Missile Pack", desc: "+3 Missiles", func: ()=>{player.missiles+=3;}}
    ];
    
    // Перемешать и взять 3
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
    // Очищаем обычных врагов, чтобы не мешали
    enemies = [];
    showText(canvas.width/2, canvas.height/2, "BOSS FIGHT!", "red");
}

function bossDefeated() {
    gameState.bossActive = false;
    boss = null;
    document.getElementById('boss-container').classList.add('hidden');
    
    // Награда
    for(let i=0; i<10; i++) loot.push(new LootItem(player.x + (Math.random()*100-50), player.y + (Math.random()*100-50), 'star'));
    loot.push(new LootItem(player.x, player.y, 'xp'));
    
    // Сброс таймера для следующего раунда
    gameState.levelTime = GAME_SETTINGS.levelDuration; 
    
    showText(canvas.width/2, canvas.height/2, "VICTORY!", "gold");
}

function showText(x, y, txt, col) {
    texts.push({x, y, txt, col, life: 60});
}

function updateUI() {
    document.getElementById('hp-text').innerText = Math.ceil(player.hp)+'/'+player.maxHp;
    document.getElementById('hp-bar-fill').style.width = (player.hp/player.maxHp*100)+'%';
    document.getElementById('xp-bar-fill').style.width = (gameState.xp/gameState.xpToNextLevel*100)+'%';
    document.getElementById('lvl-text').innerText = gameState.level;
    
    // Таймер
    const t = document.getElementById('timer-text');
    if(gameState.bossActive) {
        t.innerText = "BOSS";
        t.style.color = "red";
    } else {
        t.innerText = Math.ceil(gameState.levelTime);
        t.style.color = "#ffcc00";
    }

    document.getElementById('star-count').innerText = gameState.stars;
    document.getElementById('medkit-count').innerText = gameState.medkits;
    document.getElementById('missile-count').innerText = player.missiles;
    
    const shi = document.getElementById('shield-indicator');
    if(player.shield) { shi.className='shield-on'; shi.innerText='ACTIVE'; }
    else { shi.className='shield-off'; shi.innerText='READY'; }
}

// === ГЛАВНЫЙ ЦИКЛ ===
function loop() {
    requestAnimationFrame(loop);
    if(gameState.isPaused || !gameState.isRunning) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);

    // 1. Таймер уровня
    if (!gameState.bossActive) {
        gameState.levelTime -= 1/60;
        if (gameState.levelTime <= 0) {
            gameState.levelTime = 0;
            spawnBoss();
        }
        if (gameState.frames % 60 === 0) updateUI(); // Обновляем цифру таймера раз в секунду
    }

    // 2. Игрок
    if(keys['KeyW'] || keys['ArrowUp']) player.y -= GAME_SETTINGS.playerSpeed;
    if(keys['KeyS'] || keys['ArrowDown']) player.y += GAME_SETTINGS.playerSpeed;
    if(keys['KeyA'] || keys['ArrowLeft']) player.x -= GAME_SETTINGS.playerSpeed;
    if(keys['KeyD'] || keys['ArrowRight']) player.x += GAME_SETTINGS.playerSpeed;
    
    player.x = Math.max(20, Math.min(canvas.width-20, player.x));
    player.y = Math.max(20, Math.min(canvas.height-20, player.y));

    // Выстрел
    if(mouse.x !== 0 && gameState.frames - player.lastShot > player.fireRate) {
        const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        for(let i=0; i<player.weaponLvl; i++) {
            const spread = (i - (player.weaponLvl-1)/2)*0.1;
            bullets.push({x:player.x, y:player.y, vx:Math.cos(angle+spread)*12, vy:Math.sin(angle+spread)*12});
        }
        player.lastShot = gameState.frames;
    }

    // Щит
    if(player.shield) {
        player.shieldTimer--;
        if(player.shieldTimer<=0) { player.shield=false; updateUI(); }
        ctx.beginPath(); ctx.arc(player.x,player.y,30,0,Math.PI*2); 
        ctx.strokeStyle='#00ffff'; ctx.stroke();
    }

    // Рисуем игрока
    ctx.beginPath(); ctx.arc(player.x,player.y,20,0,Math.PI*2);
    ctx.fillStyle=player.color; ctx.fill();

    // 3. Пули
    bullets.forEach((b,i) => {
        b.x+=b.vx; b.y+=b.vy;
        ctx.fillStyle='#ffcc00'; ctx.fillRect(b.x-2,b.y-2,4,4);
        if(b.x<0||b.x>canvas.width||b.y<0||b.y>canvas.height) bullets.splice(i,1);
    });

    // 4. Ракеты
    missiles.forEach((m,i) => {
        m.x+=m.vx; m.y+=m.vy;
        ctx.beginPath(); ctx.arc(m.x,m.y,8,0,Math.PI*2); ctx.fillStyle='orange'; ctx.fill();
        
        // Попадание ракеты в босса
        if (boss) {
            const dist = Math.hypot(boss.x - m.x, boss.y - m.y);
            if (dist < boss.radius + 8) {
                boss.hp -= m.damage;
                showText(boss.x, boss.y, "BOOM!", "orange");
                missiles.splice(i, 1);
                if (boss.hp <= 0) bossDefeated();
                return;
            }
        }
        
        // Попадание ракеты в мобов
        enemies.forEach((e, ei) => {
             if (Math.hypot(e.x - m.x, e.y - m.y) < e.radius + 8) {
                 e.hp -= m.damage;
                 missiles.splice(i, 1);
             }
        });
        
        if(m.x<0||m.x>canvas.width||m.y<0||m.y>canvas.height) missiles.splice(i,1);
    });

    // 5. Враги (Спавн только если нет босса)
    if (!gameState.bossActive && gameState.frames % GAME_SETTINGS.spawnRate === 0) {
        enemies.push(new Enemy());
    }

    enemies.forEach((e, i) => {
        e.update();
        e.draw();
        
        // Урон игроку
        if(Math.hypot(player.x-e.x, player.y-e.y) < 35 && !player.shield) {
            player.hp-=1; updateUI();
            if(player.hp<=0) { gameState.isRunning=false; document.getElementById('game-over-screen').classList.remove('hidden'); document.getElementById('final-score').innerText = gameState.score;}
        }

        // Урон от пуль
        bullets.forEach((b, bi) => {
            if(Math.hypot(b.x-e.x, b.y-e.y) < e.radius) {
                e.hp-=10; bullets.splice(bi,1);
                if(e.hp<=0) {
                    enemies.splice(i,1);
                    gameState.score+=100;
                    // Дроп
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

    // 6. БОСС
    if (boss) {
        boss.update();
        boss.draw();
        
        // Урон игроку от босса
        if(Math.hypot(player.x-boss.x, player.y-boss.y) < boss.radius + 20 && !player.shield) {
             player.hp-=2; updateUI(); // Босс бьет больнее
             if(player.hp<=0) { gameState.isRunning=false; document.getElementById('game-over-screen').classList.remove('hidden'); }
        }

        // Урон боссу от пуль
        bullets.forEach((b, bi) => {
            if(Math.hypot(b.x-boss.x, b.y-boss.y) < boss.radius) {
                boss.hp -= 5; // Пуля бьет слабо
                bullets.splice(bi,1);
                if(boss.hp <= 0) bossDefeated();
            }
        });
    }

    // 7. Лут
    loot.forEach((l, i) => {
        if(l.update()) loot.splice(i,1);
        else l.draw();
    });

    // 8. Текст
    texts.forEach((t, i) => {
        t.y-=1; t.life--;
        ctx.fillStyle=t.col; ctx.fillText(t.txt, t.x, t.y);
        if(t.life<=0) texts.splice(i,1);
    });

    gameState.frames++;
}

loop();
