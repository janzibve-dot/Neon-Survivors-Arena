/* game.js */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const STATE = { MENU: 0, PLAYING: 1, LEVEL_UP: 2, GAME_OVER: 3, PAUSE: 4, LEVEL_COMPLETE: 5, HYPERSPACE: 6 };
let currentState = STATE.MENU;

const TOP_BOUND = 100;

// --- ЗАГРУЗКА СПРАЙТОВ ---
const sprites = { player: new Image(), boss: new Image() };
sprites.player.src = 'assets/images/player.png'; 
sprites.boss.src = 'assets/images/boss.png';

// --- ЛОКАЛИЗАЦИЯ ---
let currentLang = 'ru';
const TRANSLATIONS = {
    ru: {
        controls_title: ":: УПРАВЛЕНИЕ СИСТЕМОЙ ::",
        move: "Движение", aim: "Прицеливание", fire: "Огонь", rockets: "Ракеты", ult: "УЛЬТА (ЯРОСТЬ)", medkit: "Аптечка",
        start_btn: "ЗАПУСК СИСТЕМЫ",
        stage_label: "ЭТАП", boss_timer_label: "БОСС ЧЕРЕЗ",
        item_medkit: "АПТЕЧКА", item_stars: "ЗВЕЗДЫ", item_rockets: "РАКЕТЫ",
        shop_btn: "МАГАЗИН",
        boss_warning: "⚠️ ВНИМАНИЕ: ОМЕГА УГРОЗА ⚠️",
        boss_ninja: "⚠️ ОПАСНОСТЬ: НИНДЗЯ-БОСС ⚠️",
        boss_tank: "⚠️ ОПАСНОСТЬ: ТЯЖЕЛЫЙ ТАНК ⚠️",
        levelup_title: "СИСТЕМА ОБНОВЛЕНА",
        shop_title: "ОРУЖЕЙНАЯ", shop_desc: "Система улучшений временно недоступна...", close_btn: "ВЫХОД (ЗАКРЫТЬ)",
        pause_title: "ПАУЗА", resume_btn: "ПРОДОЛЖИТЬ",
        gameover_title: "КРИТИЧЕСКИЙ СБОЙ", score_text: "ИТОГОВЫЙ СЧЕТ:", restart_btn: "ПЕРЕЗАГРУЗКА",
        ach_sniper: "СНАЙПЕР", ach_sniper_desc: "50 убийств лазером",
        ach_survivor: "ВЫЖИВШИЙ", ach_survivor_desc: "Пережить Черную Дыру",
        weapon_gun: "ПУЛЕМЕТ", weapon_laser: "ЛАЗЕР", weapon_shotgun: "ДРОБОВИК",
        loot_stored: "В ЗАПАС", loot_healed: "ЛЕЧЕНИЕ", loot_rockets: "РАКЕТЫ!", loot_laser: "ЛАЗЕР!", loot_minigun: "ПУЛЕМЕТ!", loot_shotgun: "ДРОБОВИК!",
        loot_boss_core: "ЯДРО БОССА",
        level_complete: "УРОВЕНЬ ЗАЧИЩЕН", next_wave_ready: "ЯДРО БОССА ПОЛУЧЕНО. ГИПЕРПРЫЖОК ЗАВЕРШЕН.", next_level_btn: "СЛЕДУЮЩИЙ УРОВЕНЬ",
        rage_ready: "ЯРОСТЬ ГОТОВА [R]"
    },
    en: {
        controls_title: ":: SYSTEM CONTROLS ::",
        move: "Movement", aim: "Aiming", fire: "Fire", rockets: "Rockets", ult: "ULTIMATE (RAGE)", medkit: "Medkit",
        start_btn: "SYSTEM START",
        stage_label: "STAGE", boss_timer_label: "BOSS IN",
        item_medkit: "MEDKIT", item_stars: "STARS", item_rockets: "ROCKETS",
        shop_btn: "SHOP",
        boss_warning: "⚠️ WARNING: OMEGA THREAT ⚠️",
        boss_ninja: "⚠️ WARNING: NINJA BOSS ⚠️",
        boss_tank: "⚠️ WARNING: HEAVY TANK ⚠️",
        levelup_title: "SYSTEM UPGRADE",
        shop_title: "ARMORY", shop_desc: "Upgrade system offline...", close_btn: "CLOSE",
        pause_title: "PAUSE", resume_btn: "RESUME",
        gameover_title: "CRITICAL FAILURE", score_text: "FINAL SCORE:", restart_btn: "REBOOT",
        ach_sniper: "SNIPER", ach_sniper_desc: "50 Laser Kills",
        ach_survivor: "SURVIVOR", ach_survivor_desc: "Survive a Black Hole",
        weapon_gun: "MINIGUN", weapon_laser: "LASER", weapon_shotgun: "SHOTGUN",
        loot_stored: "STORED", loot_healed: "HEALED", loot_rockets: "ROCKETS!", loot_laser: "LASER!", loot_minigun: "MINIGUN!", loot_shotgun: "SHOTGUN!",
        loot_boss_core: "BOSS CORE",
        level_complete: "LEVEL CLEARED", next_wave_ready: "BOSS CORE ACQUIRED. HYPERSPACE JUMP COMPLETE.", next_level_btn: "NEXT LEVEL",
        rage_ready: "RAGE READY [R]"
    }
};

function t(key) { return TRANSLATIONS[currentLang][key] || key; }

function updateTexts() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if(TRANSLATIONS[currentLang][key]) el.innerText = TRANSLATIONS[currentLang][key];
    });
    document.getElementById('langBtn').innerText = currentLang.toUpperCase();
}

function toggleLanguage() {
    currentLang = currentLang === 'ru' ? 'en' : 'ru';
    updateTexts();
}

// Глобальные
let frameCount = 0;
let bossTimer = 0;
let bossDefeated = false; 
let score = 0;
let highScore = localStorage.getItem('neon_survivor_score') || 0;
let currentStage = 1; 
let spawnInterval = 90;
const MAX_ENEMIES = 50; 
let medkits = 0;
let stars = 0; 
let laserKills = 0;
let achievements = [];
let blackHoleTimer = 0; 
let hyperspaceTimer = 0; // Таймер анимации гиперпрыжка

const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let isMouseDown = false;
let isMusicPlaying = false; // Статус музыки

// --- ЗВУКИ ---
class SoundManager {
    constructor() { this.ctx = null; this.masterGain = null; this.noiseBuffer = null; this.lastPlayTime = {}; this.heartbeatTimer = 0; this.musicInterval = null; }
    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain(); this.masterGain.gain.value = 0.3; this.masterGain.connect(this.ctx.destination);
            this.generateNoiseBuffer();
        }
        if (this.ctx.state === 'suspended') { this.ctx.resume(); }
    }
    generateNoiseBuffer() {
        const duration = 2.0; const bufferSize = this.ctx.sampleRate * duration;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) { const white = Math.random() * 2 - 1; data[i] = (lastOut + (0.02 * white)) / 1.02; lastOut = data[i]; data[i] *= 3.5; }
    }
    playTone(key, freq, type, duration, vol = 1.0, slideTo = null) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (this.lastPlayTime[key] && now - this.lastPlayTime[key] < 0.08) return;
        this.lastPlayTime[key] = now;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, now);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
        gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(vol, now + 0.02); gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain); gain.connect(this.masterGain); osc.start(); osc.stop(now + duration);
    }
    playNoise(duration, vol = 1.0) {
        if (!this.ctx || !this.noiseBuffer) return;
        const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer; const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 800; 
        gain.gain.setValueAtTime(vol, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        src.connect(filter); filter.connect(gain); gain.connect(this.masterGain); src.start(); src.stop(this.ctx.currentTime + duration);
    }
    
    // --- МУЗЫКА ---
    toggleMusic() {
        if (isMusicPlaying) { this.stopMusic(); } else { this.startMusic(); }
        isMusicPlaying = !isMusicPlaying;
        document.getElementById('musicBtn').innerText = isMusicPlaying ? "♫ ON" : "♫ OFF";
    }
    startMusic() {
        if (!this.ctx) this.init();
        let beat = 0;
        this.musicInterval = setInterval(() => {
            const time = this.ctx.currentTime;
            // Bassline (Dark Synth)
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            const freq = beat % 4 === 0 ? 65.41 : (beat % 4 === 2 ? 73.42 : 82.41); // C2 - D2 - E2
            osc.frequency.setValueAtTime(freq, time);
            osc.frequency.exponentialRampToValueAtTime(freq/2, time + 0.2);
            
            // Filter envelope
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, time);
            filter.frequency.exponentialRampToValueAtTime(100, time + 0.2);
            
            gain.gain.setValueAtTime(0.3, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
            
            osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
            osc.start(time); osc.stop(time + 0.25);
            
            beat++;
        }, 250); // 240 BPM (быстрый темп)
    }
    stopMusic() {
        if (this.musicInterval) clearInterval(this.musicInterval);
    }

    gameOverTone() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(400, this.ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1.5);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime); gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
        osc.connect(gain); gain.connect(this.masterGain); osc.start(); osc.stop(this.ctx.currentTime + 1.5);
    }
    shoot() { this.playTone('shoot', 600, 'triangle', 0.15, 0.1, 100); }
    machineGun() { this.playTone('machine', 200, 'triangle', 0.1, 0.08, 50); } 
    laser() { this.playTone('laser', 1200, 'sine', 0.2, 0.05, 100); }
    shotgun() { this.playTone('shotgun_t', 150, 'square', 0.2, 0.1, 50); this.playNoise(0.3, 0.2); }
    enemyShoot() { this.playTone('enemy', 100, 'triangle', 0.3, 0.1, 50); }
    hit() { this.playTone('hit', 80, 'sawtooth', 0.3, 0.2, 20); }
    pickup() { this.playTone('pick', 880, 'sine', 0.5, 0.15); } 
    heal() { 
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, this.ctx.currentTime); osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime); gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(this.masterGain); osc.start(); osc.stop(this.ctx.currentTime + 0.4);
    }
    powerup() { 
        this.playTone('p1', 440, 'sine', 0.5, 0.1); setTimeout(() => this.playTone('p2', 554, 'sine', 0.5, 0.1), 100); setTimeout(() => this.playTone('p3', 659, 'sine', 0.8, 0.1), 200);
    }
    explode() { this.playNoise(0.6, 0.5); }
    ult() { this.playTone('ult1', 100, 'sawtooth', 1.0, 0.5, 800); this.playNoise(1.0, 0.5); }
    siren() { this.playTone('siren', 600, 'sawtooth', 0.5, 0.2, 300); }
    
    checkHeartbeat(hp, maxHp) {
        if (!this.ctx) return;
        const pct = hp / maxHp;
        if (pct < 0.3 && hp > 0) {
            const interval = 1000 * (0.5 + pct);
            const now = Date.now();
            if (now - this.heartbeatTimer > interval) {
                this.heartbeatTimer = now;
                this.playTone('beat1', 150, 'triangle', 0.1, 0.5, 50);
                setTimeout(() => this.playTone('beat2', 120, 'triangle', 0.1, 0.3, 40), 150);
            }
            return true; 
        }
        return false;
    }
    blackHoleCharge() { this.playTone('void_c', 50, 'sine', 0.5, 0.1, 200); }
    blackHoleBoom() { this.playNoise(2.0, 0.8); }
}
const sound = new SoundManager();

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener("DOMContentLoaded", () => {
    updateTexts(); 
    const startBtn = document.getElementById('startBtn');
    if(startBtn) startBtn.addEventListener('click', () => { sound.init(); startGame(); });
    const resumeBtn = document.getElementById('resumeBtn');
    if(resumeBtn) resumeBtn.addEventListener('click', togglePause);
    const restartBtns = document.querySelectorAll('#gameOverScreen .restart-btn');
    restartBtns.forEach(btn => btn.addEventListener('click', () => {
        document.getElementById('gameOverScreen').style.display = 'none';
        startGame(); 
    }));
    const nextLevelBtn = document.getElementById('nextLevelBtn');
    if(nextLevelBtn) nextLevelBtn.addEventListener('click', startNextLevel);
    document.getElementById('langBtn').addEventListener('click', toggleLanguage);
    
    // КНОПКА МУЗЫКИ
    document.getElementById('musicBtn').addEventListener('click', () => sound.toggleMusic());

    const savedStars = localStorage.getItem('neon_survivor_stars');
    if(savedStars) stars = parseInt(savedStars);

    const saved = localStorage.getItem('neon_survivor_stage');
    if(saved) document.getElementById('savedStageText').innerText = `SAVED STAGE: ${saved}`;

    animate();
});

window.addEventListener('keydown', e => {
    keys[e.code] = true; keys[e.key] = true;
    if ((e.code === 'Escape' || e.code === 'KeyP') && currentState === STATE.PLAYING) togglePause();
    if (e.key === '1' && currentState === STATE.PLAYING) {
        if (medkits > 0 && player.hp < player.maxHp) {
            medkits--; player.heal(player.maxHp * 0.25); updateUI();
        }
    }
    if (e.code === 'KeyR' && currentState === STATE.PLAYING) { player.activateUltimate(); }
});
window.addEventListener('keyup', e => { keys[e.code] = false; keys[e.key] = false; });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => {
    if (e.button === 0) isMouseDown = true;
    if (e.button === 2 && currentState === STATE.PLAYING) player.tryFireMissile();
});
window.addEventListener('mouseup', e => { if (e.button === 0) isMouseDown = false; });
window.addEventListener('contextmenu', e => e.preventDefault());

function unlockAchievement(id, titleKey, descKey) {
    if(achievements.includes(id)) return;
    achievements.push(id);
    const container = document.getElementById('achievementContainer');
    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML = `<div class="ach-icon">🏆</div><div class="ach-text"><h4>${t(titleKey)}</h4><p>${t(descKey)}</p></div>`;
    container.appendChild(popup);
    sound.powerup();
    setTimeout(() => { popup.style.animation = 'fadeOut 0.5s forwards'; setTimeout(() => popup.remove(), 500); }, 4000);
}

// --- НОВЫЙ КЛАСС: ЦИФРЫ УРОНА ---
class DamageNumber {
    constructor(x, y, dmg, isCrit) {
        this.x = x; this.y = y;
        this.text = "-" + Math.round(dmg);
        this.life = 60;
        this.isCrit = isCrit;
        this.vy = isCrit ? -2 : -1;
    }
    update() {
        this.y += this.vy;
        this.life--;
        return this.life > 0;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / 60;
        ctx.font = this.isCrit ? "bold 24px 'Orbitron'" : "bold 16px 'Share Tech Mono'";
        ctx.fillStyle = this.isCrit ? "#ff0000" : "#ffffff";
        ctx.shadowBlur = 5; ctx.shadowColor = "#000";
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}
let damageNumbers = [];

// --- ЭФФЕКТЫ ---
class Background {
    constructor() {
        this.stars = [];
        for(let i=0; i<60; i++) this.stars.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5, speed: Math.random() * 0.5 + 0.1,
            color: Math.random() > 0.8 ? '#00f3ff' : '#ffffff'
        });
    }
    draw(isHyperspace) {
        this.stars.forEach(s => {
            // Эффект гиперпрыжка
            if (isHyperspace) {
                s.y += s.speed * 50; // Очень быстро
                ctx.strokeStyle = s.color;
                ctx.lineWidth = s.size;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x, s.y - 100); // Длинный хвост
                ctx.stroke();
            } else {
                s.y += s.speed;
                ctx.fillStyle = s.color;
                ctx.globalAlpha = Math.random() * 0.5 + 0.3;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
            }
            if(s.y > canvas.height) s.y = 0;
        });
        ctx.globalAlpha = 1.0;
    }
}
const bg = new Background();

class FloatingText {
    constructor() { this.pool = []; }
    show(x, y, text, color) { if(this.pool.length > 20) this.pool.shift(); this.pool.push({x, y, text, color, life: 60}); }
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
    update() { this.x+=this.vx; this.y+=this.vy; this.life-=0.08; return this.life > 0; }
    draw() { ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, 3, 3); ctx.globalAlpha = 1.0; }
}
let particles = [];

// --- ЧЕРНАЯ ДЫРА ---
class BlackHole {
    constructor() {
        this.x = Math.random() * (canvas.width - 100) + 50;
        this.y = Math.random() * (canvas.height - TOP_BOUND - 100) + TOP_BOUND + 50;
        this.maxLife = 420; this.life = this.maxLife;
        this.active = true; this.radius = 60; this.charge = 0; this.maxCharge = 180; 
        this.survived = false;
    }
    update() {
        if (!this.active) return;
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < this.radius) {
            this.charge++; this.life = this.maxLife; 
            if (frameCount % 20 === 0) sound.blackHoleCharge();
            if(frameCount % 5 === 0) particles.push(new Particle(this.x + (Math.random()-0.5)*40, this.y + (Math.random()-0.5)*40, '#00ffff'));
            if (this.charge >= this.maxCharge) { this.survived = true; this.explode(); }
        } else {
            this.life--; if (this.charge > 0) this.charge = Math.max(0, this.charge - 2); 
            if (this.life <= 0) this.active = false;
        }
    }
    explode() {
        this.active = false; sound.blackHoleBoom();
        if(this.survived) unlockAchievement('survivor', 'ach_survivor', 'ach_survivor_desc');
        [...enemies].forEach((e, idx) => {
            if (e.type.includes('boss')) { e.hp -= 1000; floatText.show(e.x, e.y, "-1000", "#ff00ff"); } 
            else { e.hp = 0; if(Math.random() < 0.3) particles.push(new Particle(e.x, e.y, '#ff0000')); killEnemy(e, enemies.indexOf(e)); }
        });
        for(let i=0; i<30; i++) particles.push(new Particle(this.x, this.y, '#ffffff'));
        floatText.show(this.x, this.y, "VOID BURST!", "#ffffff");
    }
    draw() {
        if (!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y);
        const rot = frameCount * 0.1; ctx.rotate(rot);
        ctx.strokeStyle = '#990099'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = '#110011';
        ctx.beginPath(); ctx.arc(0, 0, this.radius - 5, 0, Math.PI*2); ctx.fill();
        const chargePct = this.charge / this.maxCharge;
        if(chargePct > 0) { ctx.fillStyle = '#00ffff'; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(0, 0, (this.radius - 5) * chargePct, 0, Math.PI*2); ctx.fill(); }
        ctx.restore();
        ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
        if (this.charge > 0) { ctx.fillStyle = '#00ffff'; ctx.fillText(((this.maxCharge - this.charge)/60).toFixed(1), this.x, this.y - this.radius - 10); } 
        else { ctx.fillStyle = '#ff0055'; ctx.fillText((this.life/60).toFixed(1), this.x, this.y - this.radius - 10); }
    }
}
let blackHoles = [];

// --- ДРОН ---
class Drone {
    constructor() {
        this.angle = 0; this.radius = 60; this.shootTimer = 0;
    }
    update() {
        this.angle += 0.05;
        this.x = player.x + Math.cos(this.angle) * this.radius;
        this.y = player.y + Math.sin(this.angle) * this.radius;
        this.shootTimer--;
        if(this.shootTimer <= 0) {
            const target = findNearestEnemy(this.x, this.y);
            if(target) {
                bullets.push(new Bullet(this.x, this.y, Math.atan2(target.y-this.y, target.x-this.x), 5, false, true));
                this.shootTimer = 60; 
            }
        }
    }
    draw() {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#00f3ff'; ctx.beginPath(); ctx.arc(this.x, this.y, 8, 0, Math.PI*2); ctx.stroke();
    }
}
let drone = null;

// --- ЛУТ ---
class Loot {
    constructor(x, y, type, duration = 600) { 
        this.x=x; this.y=y; this.type=type; 
        this.life = duration; 
        this.active=true; this.hoverOffset = 0; 
    }
    update() {
        if (this.life !== Infinity) this.life--;
        this.hoverOffset = Math.sin(frameCount * 0.1) * 3;
        
        if(Math.hypot(player.x - this.x, player.y - this.y) < 35) {
            this.active = false; 
            // ПОБЕДА (ГИПЕРПРЫЖОК)
            if (this.type === 'boss_core') {
                sound.powerup();
                // Запускаем анимацию гиперпрыжка
                currentState = STATE.HYPERSPACE;
                hyperspaceTimer = 120; // 2 секунды анимации
                return;
            }

            if(this.type === 'medkit') { 
                if (player.hp < player.maxHp - 0.5) { player.heal(player.maxHp * 0.25); floatText.show(this.x, this.y, "+25% " + t("item_medkit"), "#00ff00"); } 
                else { medkits++; sound.pickup(); floatText.show(this.x, this.y, t("loot_stored"), "#00ffff"); }
            }
            else if(this.type === 'mega_medkit') { player.heal(9999); sound.powerup(); floatText.show(this.x,this.y, t("loot_healed"),"#00ff00"); }
            else if(this.type === 'star') { 
                stars++; 
                localStorage.setItem('neon_survivor_stars', stars);
                sound.pickup(); floatText.show(this.x,this.y,"+1 " + t("item_stars"),"#ffea00"); 
            }
            else if(this.type === 'missile_pack') { 
                sound.powerup(); floatText.show(this.x,this.y, t("loot_rockets"), "#ffaa00");
                for(let i=0; i<5; i++) { const t = findNearestEnemy(player.x, player.y); if(t) missiles.push(new Missile(player.x, player.y, t)); }
            }
            else if(this.type === 'machine_gun') { player.activateWeapon('machine_gun'); sound.powerup(); floatText.show(this.x, this.y, t("loot_minigun"), "#00ffff"); }
            else if(this.type === 'laser_gun') { player.activateWeapon('laser_gun'); sound.powerup(); floatText.show(this.x, this.y, t("loot_laser"), "#00ff00"); }
            else if(this.type === 'shotgun') { player.activateWeapon('shotgun'); sound.powerup(); floatText.show(this.x, this.y, t("loot_shotgun"), "#ff00ff"); }
            else if(this.type === 'xp') { sound.pickup(); player.gainXp(10); }
            updateUI();
        }
        if(this.life <= 0) this.active = false;
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y + this.hoverOffset);
        
        // Отрисовка ЯДРА БОССА
        if (this.type === 'boss_core') {
            const scale = 1 + Math.sin(frameCount * 0.1) * 0.1;
            ctx.scale(scale, scale);
            ctx.shadowBlur = 20; ctx.shadowColor = '#00ff00';
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(-15, -15, 30, 30);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(-15, -15, 30, 30);
            ctx.font = "bold 10px Arial"; ctx.fillStyle = '#000'; ctx.textAlign = "center"; 
            ctx.fillText("CORE", 0, 4);
        }
        else if (this.type === 'machine_gun') {
            ctx.shadowBlur=10; ctx.shadowColor='#00f3ff'; ctx.fillStyle = '#ccc'; ctx.fillRect(-8, -10, 16, 12);
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, -8, 2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-4, -4, 2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4, -4, 2, 0, Math.PI*2); ctx.fill();
            ctx.font = "bold 9px Arial"; ctx.fillStyle = '#00f3ff'; ctx.textAlign = "center"; ctx.fillText(t('weapon_gun'), 0, 12);
        }
        else if (this.type === 'laser_gun') {
            ctx.shadowBlur=10; ctx.shadowColor='#00ff00'; ctx.fillStyle = '#222'; ctx.fillRect(-6, -12, 12, 16); ctx.fillStyle = '#00ff00'; ctx.fillRect(-2, -12, 4, 16);
            ctx.font = "bold 9px Arial"; ctx.fillStyle = '#00ff00'; ctx.textAlign = "center"; ctx.fillText(t('weapon_laser'), 0, 14);
        }
        else if (this.type === 'shotgun') {
            ctx.shadowBlur=10; ctx.shadowColor='#ff00ff'; ctx.fillStyle = '#444'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-10,-15); ctx.lineTo(10,-15); ctx.fill();
            ctx.font = "bold 9px Arial"; ctx.fillStyle = '#ff00ff'; ctx.textAlign = "center"; ctx.fillText(t('weapon_shotgun'), 0, 12);
        }
        else if(this.type === 'medkit') {
            ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -14, 5, Math.PI, 0); ctx.stroke(); 
            ctx.fillStyle = '#990000'; ctx.beginPath(); ctx.roundRect(-12, -10, 24, 22, 5); ctx.fill(); 
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.roundRect(-12, -12, 24, 20, 5); ctx.fill(); 
            ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 4;
            ctx.beginPath(); ctx.rect(-3, -7, 6, 10); ctx.rect(-7, -5, 14, 6); ctx.fill(); ctx.shadowBlur = 0;
        } 
        else if(this.type === 'star') {
            const pulse = 1 + Math.sin(frameCount * 0.2) * 0.2; ctx.scale(pulse, pulse);
            ctx.shadowBlur = 10; ctx.shadowColor = '#ffd700'; ctx.fillStyle = '#ffd700';
            ctx.beginPath(); for(let i=0; i<5; i++) { ctx.lineTo(Math.cos((18 + i*72) / 180 * Math.PI) * 10, -Math.sin((18 + i*72) / 180 * Math.PI) * 10); ctx.lineTo(Math.cos((54 + i*72) / 180 * Math.PI) * 5, -Math.sin((54 + i*72) / 180 * Math.PI) * 5); } ctx.closePath(); ctx.fill();
        } 
        else if(this.type === 'missile_pack') {
            ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.font = "bold 14px Arial"; ctx.textAlign = "center"; ctx.fillText("x5", 0, 5);
        }
        else if (this.type === 'mega_medkit') {
            ctx.shadowBlur = 15; ctx.shadowColor = '#00ff00'; ctx.fillStyle = '#00ff00'; ctx.beginPath(); ctx.roundRect(-14, -14, 28, 28, 6); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = "bold 20px Arial"; ctx.textAlign = "center"; ctx.fillText("+", 0, 8);
        }
        else { ctx.shadowBlur = 5; ctx.shadowColor = '#00ff00'; ctx.fillStyle = '#00ff00'; ctx.fillRect(-5,-5,10,10); }
        ctx.restore();
    }
}
let lootList = [];

class Bullet {
    constructor(x, y, a, dmg, isEnemy=false, isLaser=false) { 
        this.x=x; this.y=y; this.isEnemy = isEnemy; this.isLaser = isLaser;
        const speed = isEnemy ? 5 : (isLaser ? 30 : 18);
        this.vx=Math.cos(a)*speed; this.vy=Math.sin(a)*speed; this.dmg=dmg; this.active=true; this.life = isLaser ? 20 : 100;
    }
    update() { this.x+=this.vx; this.y+=this.vy; this.life--; if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height || this.life <= 0) this.active=false; }
    draw() {
        ctx.shadowBlur = 10; 
        if (this.isEnemy) { ctx.shadowColor = '#ff0033'; ctx.fillStyle = '#ff0033'; ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI*2); ctx.fill(); } 
        else if (this.isLaser) { ctx.shadowColor = '#00ff00'; ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx, this.y - this.vy); ctx.stroke(); } 
        else { ctx.shadowColor = '#00f3ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x-this.vx*0.5, this.y-this.vy*0.5); ctx.stroke(); }
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
    draw() { ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle); ctx.fillStyle = '#888'; ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-4,4); ctx.lineTo(-4,-4); ctx.fill(); ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-8,3); ctx.lineTo(-8,-3); ctx.fill(); ctx.restore(); }
}
let missiles = [];

// --- ИГРОК ---
const player = {
    x: 0, y: 0, radius: 25, color: '#00f3ff', 
    hp: 100, maxHp: 100, level: 1, xp: 0, nextXp: 100,
    baseDmg: 10, dmg: 10, baseFireRate: 10, fireRate: 10, 
    cooldown: 0, missiles: 3, missileCd: 0, hitTimer: 0, invulnTimer: 0,
    weaponTimer: 0, currentWeapon: 'normal',
    rage: 0, maxRage: 100,
    shipType: 'standard', 
    
    applyShipStats() {
        const id = localStorage.getItem('ns_equipped_ship') || 'standard';
        this.shipType = id;
        const ship = SHIPS.find(s => s.id === id);
        if (ship) {
            const stage = isNaN(currentStage) ? 1 : currentStage;
            this.maxHp = ship.hp + (stage * 10); 
            this.hp = this.maxHp;
            this.baseSpeed = ship.speed; 
            this.color = ship.color;
        }
        if (localStorage.getItem('ns_has_drone') === 'true') {
            drone = new Drone();
        }
    },

    reset() {
        this.x = canvas.width/2; this.y = canvas.height/2;
        this.applyShipStats();
        if (currentStage === 1) {
            this.level = 1; this.xp = 0; this.nextXp = 100;
            this.baseDmg = 10; this.baseFireRate = 10;
        } else {
            this.level = currentStage;
            this.baseDmg = 10 + (currentStage * 2);
        }
        this.dmg = this.baseDmg; this.fireRate = this.baseFireRate;
        this.missiles = 3; this.hitTimer = 0; this.invulnTimer = 0; this.weaponTimer = 0;
        this.currentWeapon = 'normal'; laserKills = 0; score = 0; this.rage = 0;
    },
    update() {
        const moveSpeed = this.baseSpeed || 5;
        if(keys['KeyW'] || keys['ArrowUp']) this.y -= moveSpeed;
        if(keys['KeyS'] || keys['ArrowDown']) this.y += moveSpeed;
        if(keys['KeyA'] || keys['ArrowLeft']) this.x -= moveSpeed;
        if(keys['KeyD'] || keys['ArrowRight']) this.x += moveSpeed;
        this.x = Math.max(30, Math.min(canvas.width-30, this.x));
        this.y = Math.max(TOP_BOUND + 30, Math.min(canvas.height-30, this.y));
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        
        if(this.cooldown>0) this.cooldown--;
        if(this.missileCd>0) this.missileCd--;
        if(this.hitTimer>0) this.hitTimer--;
        if(this.invulnTimer>0) this.invulnTimer--;
        
        if(this.weaponTimer > 0) {
            this.weaponTimer--;
            if(this.weaponTimer <= 0) {
                this.currentWeapon = 'normal'; this.fireRate = this.baseFireRate; this.dmg = this.baseDmg;
                document.getElementById('machineGunSlot').style.display = 'none';
            } else { document.getElementById('gunTimer').innerText = Math.ceil(this.weaponTimer/60) + 's'; }
        }
        if(isMouseDown) this.shoot();
    },
    activateWeapon(type) {
        this.currentWeapon = type; this.weaponTimer = 600; 
        const slot = document.getElementById('machineGunSlot'); const name = slot.querySelector('.res-name'); slot.style.display = 'flex';
        if (type === 'machine_gun') { this.fireRate = 4; this.dmg = 15; name.innerText = t("weapon_gun"); } 
        else if (type === 'laser_gun') { this.fireRate = 15; this.dmg = 30; name.innerText = t("weapon_laser"); } 
        else if (type === 'shotgun') { this.fireRate = 40; this.dmg = 12; name.innerText = t("weapon_shotgun"); }
    },
    shoot() {
        if(this.cooldown<=0) {
            if (this.currentWeapon === 'shotgun') { for(let i=-2; i<=2; i++) bullets.push(new Bullet(this.x, this.y, this.angle + i*0.15, this.dmg)); sound.shotgun(); } 
            else if (this.currentWeapon === 'laser_gun') { bullets.push(new Bullet(this.x, this.y, this.angle, this.dmg, false, true)); sound.laser(); }
            else { bullets.push(new Bullet(this.x, this.y, this.angle, this.dmg)); if (this.currentWeapon === 'machine_gun') sound.machineGun(); else sound.shoot(); }
            this.cooldown = this.fireRate;
        }
    },
    tryFireMissile() {
        if(this.missiles > 0 && this.missileCd <= 0) {
            const t = findNearestEnemy(this.x, this.y);
            if(t) { missiles.push(new Missile(this.x, this.y, t)); this.missiles--; this.missileCd = 30; updateUI(); sound.shoot(); }
        }
    },
    gainXp(amount) {
        this.xp += amount;
        if(this.xp >= this.nextXp) { this.xp -= this.nextXp; this.level++; this.nextXp *= 1.2; currentState = STATE.LEVEL_UP; showUpgrades(); }
        updateUI();
    },
    heal(amount) { this.hp += amount; if(this.hp > this.maxHp) this.hp = this.maxHp; sound.heal(); updateUI(); },
    takeDamage(dmg) {
        if(this.invulnTimer > 0) return; 
        
        // Защита от NaN (Бессмертия)
        if (isNaN(dmg)) dmg = 10;
        
        this.hp -= dmg; this.hitTimer = 10; this.invulnTimer = 30; 
        if (this.hp <= 0) { this.hp = 0; updateUI(); for(let i=0; i<30; i++) particles.push(new Particle(this.x, this.y, '#ff0000')); sound.explode(); gameOver(); return; }
        updateUI(); sound.hit();
    },
    addRage(amount) {
        this.rage = Math.min(this.maxRage, this.rage + amount);
        if (this.rage >= this.maxRage) { floatText.show(this.x, this.y - 40, t("rage_ready"), "#9d00ff"); }
        updateUI();
    },
    activateUltimate() {
        if (this.rage < this.maxRage) return;
        this.rage = 0; sound.ult();
        for(let i=0; i<60; i++) {
            const angle = (i / 60) * Math.PI * 2; const p = new Particle(this.x, this.y, '#9d00ff');
            p.vx = Math.cos(angle) * 10; p.vy = Math.sin(angle) * 10; particles.push(p);
        }
        enemies.forEach(e => {
            const angle = Math.atan2(e.y - this.y, e.x - this.x);
            e.x += Math.cos(angle) * 150; e.y += Math.sin(angle) * 150;
            e.hp -= 200; if (e.hp <= 0) killEnemy(e, enemies.indexOf(e));
        });
        enemyBullets = [];
        updateUI();
    },
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        
        // РИСУЕМ КАРТИНКУ, ЕСЛИ ОНА ЗАГРУЖЕНА
        if (sprites.player && sprites.player.complete && sprites.player.naturalWidth > 0) {
            ctx.drawImage(sprites.player, -32, -32, 64, 64);
        } else {
            if(this.invulnTimer > 0 && Math.floor(frameCount / 4) % 2 === 0) ctx.globalAlpha = 0.5;
            let strokeCol = this.color; let fillCol = '#050505';
            if (this.hitTimer > 0) { strokeCol = '#ff0000'; fillCol = '#550000'; ctx.shadowBlur = 30; ctx.shadowColor = '#ff0000'; }
            else { ctx.shadowBlur = 15; ctx.shadowColor = this.color; }
            if (this.hitTimer <= 0) {
                const flicker = Math.random() * 3; ctx.fillStyle = strokeCol;
                ctx.fillRect(-25 - flicker, -8, 10 + flicker, 2); ctx.fillRect(-25 - flicker, 6, 10 + flicker, 2);
            }
            ctx.fillStyle = fillCol; ctx.strokeStyle = strokeCol; ctx.lineWidth = 2;
            
            if (this.shipType === 'tank') {
                ctx.beginPath(); ctx.moveTo(20, -20); ctx.lineTo(20, 20); ctx.lineTo(-20, 20); ctx.lineTo(-20, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.fillRect(10, -25, 15, 5); ctx.fillRect(10, 20, 15, 5);
            } else if (this.shipType === 'scout') {
                ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-15, 15); ctx.lineTo(-10, 0); ctx.lineTo(-15, -15); ctx.closePath(); ctx.fill(); ctx.stroke();
            } else {
                ctx.beginPath(); ctx.moveTo(10, -25); ctx.lineTo(-20, -25); ctx.lineTo(-25, -10); ctx.lineTo(0, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(10, 25); ctx.lineTo(-20, 25); ctx.lineTo(-25, 10); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.fillRect(-5, -15, 6, 30); ctx.strokeRect(-5, -15, 6, 30);
                ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-5, 6); ctx.lineTo(-10, 0); ctx.lineTo(-5, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
            }
        }

        ctx.restore();
    }
};

// --- ВРАГИ ---
class Enemy {
    constructor(boss=false, bossParent=null) {
        this.boss = boss; this.bossParent = bossParent; this.isDefender = !!bossParent; this.shootTimer = Math.random() * 120;
        const diff = Math.pow(1.04, currentStage - 1); 

        if(boss) {
            this.x=canvas.width/2; this.y=-100; 
            if (currentStage % 10 === 0) {
                this.type = 'tank_boss'; this.hp = (3000 + currentStage*500)*diff; this.maxHp = this.hp;
                this.r = 100; this.speed = 0.3; this.color = '#00ff00';
                document.getElementById('bossNameLabel').innerText = t('boss_tank');
            } else if (currentStage % 5 === 0) {
                this.type = 'ninja_boss'; this.hp = (800 + currentStage*150)*diff; this.maxHp = this.hp;
                this.r = 50; this.speed = 2.0; this.color = '#9d00ff';
                document.getElementById('bossNameLabel').innerText = t('boss_ninja');
            } else {
                this.type = 'boss'; this.hp=(1000 + currentStage*200)*diff; this.maxHp=this.hp; 
                this.r=70; this.speed=0.8; this.color='#ff0033';
                document.getElementById('bossNameLabel').innerText = t('boss_warning');
            }
            this.rotation=0;
            document.getElementById('bossContainer').style.display='block';
        } 
        else if (this.isDefender) {
            this.x = bossParent.x; this.y = bossParent.y; this.hp = 60*diff; this.maxHp = this.hp; this.r = 15; this.speed = 0;
            this.color = '#ff0033'; this.type = 'defender'; this.angleOffset = Math.random() * Math.PI * 2; this.orbitRadius = 100; this.damage = 15*diff;
        }
        else {
            const rand = Math.random(); const edge = Math.floor(Math.random()*4);
            if(edge==0){this.x=Math.random()*canvas.width;this.y=TOP_BOUND-30;}
            else if(edge==1){this.x=canvas.width+30;this.y=Math.random()*canvas.height;}
            else if(edge==2){this.x=Math.random()*canvas.width;this.y=canvas.height+30;}
            else{this.x=-30;this.y=Math.random()*canvas.height;}
            if (this.y < TOP_BOUND) this.y = TOP_BOUND - 30;

            if(rand < 0.15) { this.type = 'kamikaze'; this.hp = 10*diff; this.maxHp = this.hp; this.speed = 4.0; this.r = 15; this.color = '#ff4400'; } 
            else if(rand < 0.3) { this.type = 'tank'; this.hp = 50*diff; this.maxHp = this.hp; this.speed = 1.0; this.r = 25; this.color = '#ff00ff'; } 
            else if (rand < 0.6) { this.type = 'runner'; this.hp = 15*diff; this.maxHp = this.hp; this.speed = 3.5; this.r = 12; this.color = '#ffea00'; } 
            else { this.type = 'normal'; this.hp = 30*diff; this.maxHp = this.hp; this.speed = 2.0; this.r = 18; this.color = '#00ff00'; }
            this.damage = 10*diff;
        }
    }
    update() {
        if(this.type.includes('boss')) {
            const a = Math.atan2(player.y-this.y, player.x-this.x);
            if (this.type === 'ninja_boss') {
                if (frameCount % 60 < 30) { this.x += Math.cos(a)*this.speed*3; this.y += Math.sin(a)*this.speed*3; }
            } else {
                this.x += Math.cos(a)*this.speed; this.y += Math.sin(a)*this.speed;
            }
            if(this.y < TOP_BOUND + 70) this.y = TOP_BOUND + 70;
            this.angle = a; this.shootTimer--;
            if(this.shootTimer <= 0) {
                this.shootTimer = this.type === 'ninja_boss' ? 30 : (this.type === 'tank_boss' ? 90 : 45); 
                sound.enemyShoot();
                if (this.type === 'ninja_boss') { for(let i=-2; i<=2; i++) enemyBullets.push(new Bullet(this.x, this.y, a + i*0.2, 15, true)); } 
                else if (this.type === 'tank_boss') { enemyBullets.push(new Bullet(this.x, this.y, a, 50, true)); } 
                else { enemyBullets.push(new Bullet(this.x + Math.cos(a+0.5)*40, this.y + Math.sin(a+0.5)*40, a, 20, true)); enemyBullets.push(new Bullet(this.x + Math.cos(a-0.5)*40, this.y + Math.sin(a-0.5)*40, a, 20, true)); }
            }
        }
        else if (this.type === 'defender') {
            if(!this.bossParent || this.bossParent.hp <= 0) { this.hp = 0; } 
            else {
                this.angleOffset += 0.02;
                this.x = this.bossParent.x + Math.cos(this.angleOffset) * this.orbitRadius;
                this.y = this.bossParent.y + Math.sin(this.angleOffset) * this.orbitRadius;
                this.shootTimer--;
                if(this.shootTimer <= 0) { this.shootTimer = 120; const a = Math.atan2(player.y-this.y, player.x-this.x); enemyBullets.push(new Bullet(this.x, this.y, a, 10, true)); }
            }
        }
        else {
            const a = Math.atan2(player.y-this.y, player.x-this.x);
            this.x += Math.cos(a)*this.speed; this.y += Math.sin(a)*this.speed;
            if(this.y < TOP_BOUND + this.r) this.y = TOP_BOUND + this.r;
            this.angle = a;
        }
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y);

        if(this.type.includes('boss')) {
            // ИСПРАВЛЕНИЕ: ПОВОРОТ БОССА (Если картинка смотрит ВНИЗ, то -90 градусов)
            ctx.rotate(this.angle - Math.PI / 2);

            if (sprites.boss && sprites.boss.complete && sprites.boss.naturalWidth > 0) {
                // НЕОНОВОЕ СВЕЧЕНИЕ ДЛЯ БОССА
                ctx.shadowBlur = 30;
                ctx.shadowColor = this.type === 'tank_boss' ? '#00ff00' : (this.type === 'ninja_boss' ? '#9d00ff' : '#ff0033');
                
                const size = this.r * 2.5; 
                ctx.drawImage(sprites.boss, -size/2, -size/2, size, size);
                ctx.shadowBlur = 0;
            } else {
                // ФОЛБЭК ЕСЛИ КАРТИНКА НЕ ГРУЗИТСЯ
                ctx.shadowBlur=15; ctx.shadowColor=this.color; ctx.lineWidth = 2; ctx.strokeStyle = this.color; ctx.fillStyle = '#050505';
                if (this.type === 'tank_boss') {
                    ctx.fillStyle = '#003300';
                    ctx.fillRect(-60, -60, 120, 120); ctx.strokeRect(-60, -60, 120, 120);
                    ctx.beginPath(); ctx.arc(0,0,40,0,Math.PI*2); ctx.stroke();
                } else if (this.type === 'ninja_boss') {
                    ctx.fillStyle = '#220033';
                    ctx.beginPath(); ctx.moveTo(40,0); ctx.lineTo(-30, 30); ctx.lineTo(-30, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(10, 30); ctx.lineTo(-30, 30); ctx.lineTo(-40, 0); ctx.lineTo(-30, -30); ctx.lineTo(10, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = '#330000'; ctx.beginPath(); ctx.arc(0,0,25,0,Math.PI*2); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = '#550000'; ctx.fillRect(5, -45, 30, 20); ctx.strokeRect(5, -45, 30, 20); ctx.fillRect(5, 25, 30, 20); ctx.strokeRect(5, 25, 30, 20);
                }
            }
        }
        else {
            ctx.rotate(this.angle); // Обычные враги поворачиваются стандартно
            ctx.shadowBlur=15; ctx.shadowColor=this.color; ctx.lineWidth = 2; ctx.strokeStyle = this.color; ctx.fillStyle = '#050505';
            
            if(this.type === 'kamikaze') {
                ctx.rotate(frameCount * 0.2); ctx.fillStyle = '#550000'; ctx.beginPath(); for(let i=0; i<8; i++) { ctx.lineTo(this.r*Math.cos(i*Math.PI/4), this.r*Math.sin(i*Math.PI/4)); ctx.lineTo((this.r+5)*Math.cos((i+0.5)*Math.PI/4), (this.r+5)*Math.sin((i+0.5)*Math.PI/4)); } ctx.closePath(); ctx.fill(); ctx.stroke();
            }
            else if(this.type === 'defender') { ctx.rotate(this.angleOffset); ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(0,10); ctx.lineTo(-10,0); ctx.lineTo(0,-10); ctx.closePath(); ctx.fill(); ctx.stroke(); }
            else if(this.type === 'tank') { ctx.rotate(this.angle); ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(5, 15); ctx.lineTo(-15, 15); ctx.lineTo(-15, -15); ctx.lineTo(5, -15); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeRect(-10, -8, 10, 16); }
            else if(this.type === 'runner') { ctx.rotate(this.angle); ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 8); ctx.lineTo(-5, 0); ctx.lineTo(-10, -8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
            else { ctx.rotate(this.angle); ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, 10); ctx.lineTo(-5, -10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(-15, 15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-15, -15); ctx.stroke(); }
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
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('levelCompleteScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    
    // Загрузка сохраненного этапа
    const saved = localStorage.getItem('neon_survivor_stage');
    currentStage = saved ? parseInt(saved) : 1;
    if (isNaN(currentStage)) currentStage = 1;

    player.reset(); 
    enemies=[]; bullets=[]; enemyBullets=[]; lootList=[]; missiles=[]; particles=[]; blackHoles=[];
    medkits=0; scoreTime=0; killScore=0; bossActive=false; spawnInterval=90;
    bossDefeated = false; // Сброс флага
    
    // Таймер до босса (60 + 10 за каждый этап)
    bossTimer = (60 + (currentStage - 1) * 10) * 60; 

    document.getElementById('machineGunSlot').style.display='none';
    document.getElementById('damageOverlay').className = ''; 
    document.getElementById('bossWarningOverlay').classList.remove('boss-warning-active');
    document.getElementById('bestScore').innerText = 'HI: ' + highScore;
    
    currentState = STATE.PLAYING;
    updateUI();
}

function startNextLevel() {
    document.getElementById('levelCompleteScreen').style.display = 'none';
    // ПРИНУДИТЕЛЬНО СКРЫВАЕМ ПОЛОСКУ БОССА
    document.getElementById('bossContainer').style.display = 'none';
    
    medkits = 0; 
    enemies = []; bullets = []; enemyBullets = []; lootList = [];
    bossActive = false;
    bossDefeated = false; // Сброс флага
    
    currentStage++;
    localStorage.setItem('neon_survivor_stage', currentStage); 
    
    bossTimer = (60 + (currentStage - 1) * 10) * 60; 
    
    currentState = STATE.PLAYING;
    updateUI();
}

function togglePause() {
    if(currentState===STATE.PLAYING) { currentState=STATE.PAUSE; document.getElementById('pauseScreen').style.display='flex'; }
    else { currentState=STATE.PLAYING; document.getElementById('pauseScreen').style.display='none'; }
}

function gameOver() {
    currentState = STATE.GAME_OVER;
    sound.gameOverTone();
    document.getElementById('ui').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'flex';
    document.getElementById('finalScore').innerText = killScore;
    document.getElementById('damageOverlay').className = '';
    document.getElementById('bossWarningOverlay').classList.remove('boss-warning-active');
    if (killScore > highScore) { highScore = killScore; localStorage.setItem('neon_survivor_score', highScore); }
}

function showUpgrades() {
    document.getElementById('levelUpScreen').style.display='flex';
    const c = document.getElementById('upgradeContainer'); c.innerHTML='';
    const opts = [
        {n:"УРОН", d:"+10 Dmg", f:()=>{player.baseDmg+=10; player.dmg = player.baseDmg;}},
        {n:"СКОРОСТЬ", d:"Fire Rate", f:()=>{player.baseFireRate=Math.max(5,player.baseFireRate-2); player.fireRate = player.baseFireRate;}},
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
    const hp = Math.ceil(Math.max(0, player.hp));
    document.getElementById('hpBar').style.width=(hp/player.maxHp*100)+'%';
    document.getElementById('rageBar').style.width=(player.rage/player.maxRage*100)+'%';
    document.getElementById('hpText').innerText=hp+'/'+player.maxHp;
    document.getElementById('xpBar').style.width=(player.xp/player.nextXp*100)+'%';
    document.getElementById('stageValue').innerText=currentStage;
    
    const showTime = bossActive ? 0 : Math.ceil(bossTimer/60);
    document.getElementById('levelTimer').innerText=showTime;
    document.getElementById('currentScore').innerText=killScore;
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
    if(currentState===STATE.GAME_OVER) return;
    if(currentState===STATE.LEVEL_COMPLETE || currentState===STATE.HYPERSPACE) {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        
        // РИСУЕМ ФОН
        if (currentState === STATE.HYPERSPACE) {
            bg.draw(true); // Рисуем звезды как линии
            if (hyperspaceTimer > 0) hyperspaceTimer--;
            else {
                currentState = STATE.LEVEL_COMPLETE;
                document.getElementById('levelCompleteScreen').style.display = 'flex';
            }
        } else {
            bg.draw(false);
        }

        // Разрешаем рисовать игрока и лут на фоне победы
        player.draw();
        lootList.forEach(l=>{l.update(); l.draw();}); 
        lootList=lootList.filter(l=>l.active);
        particles.forEach(p=>{p.draw();}); particles=particles.filter(p=>p.update());
        floatText.updateAndDraw();
        return;
    }
    if(currentState!==STATE.PLAYING) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    bg.draw();

    frameCount++;
    if (blackHoleTimer > 0) blackHoleTimer--;

    // ПРАВКА: Если босс побежден (bossDefeated), таймер не идет
    if (!bossActive && !bossDefeated) {
        bossTimer--;
        
        if (bossTimer <= 300 && bossTimer > 0) {
            document.getElementById('bossWarningOverlay').classList.add('boss-warning-active');
            if (bossTimer % 60 === 0) sound.siren();
        } else {
            document.getElementById('bossWarningOverlay').classList.remove('boss-warning-active');
        }

        if (bossTimer <= 0) {
            bossActive = true; enemies = []; 
            const boss = new Enemy(true); enemies.push(boss);
            // СПАВН ЗАЩИТНИКОВ БОССА
            for(let i=0; i<5; i++) enemies.push(new Enemy(false, boss));
        }
    }
    updateUI();

    if(frameCount%60===0 && !bossActive && !bossDefeated) {
        if(blackHoleTimer <= 0 && Math.random() < 0.1) {
            blackHoles.push(new BlackHole());
            blackHoleTimer = 1200; 
        }
        scoreTime++;
    }
    // Спавн обычных врагов только если босс не активен и не побежден
    if(!bossActive && !bossDefeated && frameCount%spawnInterval===0 && enemies.length<MAX_ENEMIES) enemies.push(new Enemy());

    const isLow = sound.checkHeartbeat(player.hp, player.maxHp);
    const overlay = document.getElementById('damageOverlay');
    if (isLow && !overlay.classList.contains('critical-health')) overlay.classList.add('critical-health'); 
    else if (!isLow && overlay.classList.contains('critical-health')) overlay.classList.remove('critical-health');

    player.update(); player.draw();
    if(drone) { drone.update(); drone.draw(); }

    blackHoles.forEach((bh, i) => { bh.update(); bh.draw(); if(!bh.active) blackHoles.splice(i, 1); });

    bullets.forEach((b,i)=>{
        b.update(); b.draw();
        if(!b.active){bullets.splice(i,1); return;}
        for(let j=enemies.length-1; j>=0; j--) {
            let e=enemies[j];
            if(Math.hypot(e.x-b.x, e.y-b.y) < e.r+5) {
                if(!b.isLaser) b.active=false;
                e.hp-=b.dmg; 
                damageNumbers.push(new DamageNumber(e.x, e.y, b.dmg, false)); // ЦИФРЫ
                particles.push(new Particle(e.x,e.y,'#fff')); sound.hit();
                if(e.hp<=0) killEnemy(e,j, b.isLaser);
                if(!b.isLaser) break;
            }
        }
    });

    enemyBullets.forEach((b,i)=>{
        b.update(); b.draw();
        if(!b.active){enemyBullets.splice(i,1); return;}
        if(Math.hypot(player.x-b.x, player.y-b.y) < player.radius) { player.takeDamage(b.dmg); b.active=false; }
    });

    missiles.forEach((m,i)=>{
        m.update(); m.draw();
        if(!m.active){missiles.splice(i,1); return;}
        for(let j=enemies.length-1; j>=0; j--) {
            let e=enemies[j];
            if(Math.hypot(e.x-m.x, e.y-m.y) < e.r+10) {
                e.hp-=100; m.active=false; sound.explode();
                damageNumbers.push(new DamageNumber(e.x, e.y, 100, true)); // ЦИФРЫ КРИТ
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
            if (e.type === 'kamikaze') killEnemy(e, enemies.indexOf(e));
            else player.takeDamage(e.damage);
        }
    });

    lootList.forEach(l=>{l.update(); l.draw();}); lootList=lootList.filter(l=>l.active);
    particles.forEach(p=>{p.draw();}); particles=particles.filter(p=>p.update());
    damageNumbers.forEach((d,i) => { if(!d.update()) damageNumbers.splice(i,1); else d.draw(); }); // Рисуем цифры
    floatText.updateAndDraw();
}

function killEnemy(e, idx, isLaserKill = false) {
    player.addRage(5);
    if (isLaserKill) { laserKills++; if (laserKills >= 50) unlockAchievement('sniper', 'ach_sniper', 'ach_sniper_desc'); }

    if(e.type === 'kamikaze') {
        sound.explode();
        floatText.show(e.x, e.y, "BOOM!", "#ff0000");
        for(let k=0; k<20; k++) particles.push(new Particle(e.x, e.y, '#ff4400'));
        if(Math.hypot(player.x-e.x, player.y-e.y) < 150) player.takeDamage(30);
        enemies.forEach(other => { if(other !== e && Math.hypot(other.x-e.x, other.y-e.y) < 150) other.hp -= 100; });
    }

    enemies.splice(idx,1); killScore+=e.boss?1000:100;
    
    // ЛУТ ДЛЯ ОБЫЧНЫХ ВРАГОВ
    if(!e.boss && !e.isDefender) {
        lootList.push(new Loot(e.x,e.y,'xp'));
        const r = Math.random();
        if(r < 0.27) lootList.push(new Loot(e.x+10,e.y,'medkit')); 
        else if(r < 0.42) lootList.push(new Loot(e.x-10,e.y,'star')); 
        else if(r < 0.67) lootList.push(new Loot(e.x,e.y+10,'machine_gun')); 
        else if(r < 0.82) lootList.push(new Loot(e.x,e.y-10,'missile_pack'));
        else if(r < 0.87) lootList.push(new Loot(e.x,e.y,'laser_gun'));
        else if(r < 0.92) lootList.push(new Loot(e.x,e.y,'shotgun'));
    } 
    // ЛУТ ДЛЯ БОССА
    else if(e.boss) {
        lootList.push(new Loot(e.x,e.y,'boss_core', Infinity)); // ЯДРО БОССА (Вечное)
        lootList.push(new Loot(e.x,e.y,'mega_medkit', Infinity)); 
        lootList.push(new Loot(e.x+20,e.y+20,'missile_pack', Infinity));
        lootList.push(new Loot(e.x-20,e.y+20,'machine_gun', Infinity));
        
        for(let k=0;k<5;k++) lootList.push(new Loot(e.x+(Math.random()*60-30),e.y+(Math.random()*60-30),'star', Infinity));
        
        bossActive=false; 
        bossDefeated = true; // ПРАВКА: Блокируем спавн босса
        
        // ПРИНУДИТЕЛЬНОЕ СКРЫТИЕ ПОЛОСКИ ЗДОРОВЬЯ БОССА
        document.getElementById('bossContainer').style.display='none';
        
        sound.powerup(); 
        // Игра ПРОДОЛЖАЕТСЯ, пока не подберешь ЯДРО
    }
}
