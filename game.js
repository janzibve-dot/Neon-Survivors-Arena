
// --- НАСТРОЙКИ ИГРЫ ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Растягиваем canvas на весь экран
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Обработка изменения размера окна
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Состояние игры
let isGameOver = false;
let score = 0;
let startTime = Date.now();
let frameCount = 0; // Для отсчета времени спавна

// --- УПРАВЛЕНИЕ ---
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
};

window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);

// --- КЛАССЫ ИГРОВЫХ ОБЪЕКТОВ ---

// 1. Игрок
class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 20;
        this.color = '#3498db'; // Синий
        this.speed = 5;
        // Настройки атаки
        this.attackCooldown = 0;
        this.attackSpeed = 20; // Задержка между выстрелами (в кадрах)
    }

    update() {
        // Движение (WASD или Стрелки)
        if (keys['w'] || keys['W'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['s'] || keys['S'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['a'] || keys['A'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['d'] || keys['D'] || keys['ArrowRight']) this.x += this.speed;

        // Ограничение, чтобы не уходил за экран
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Автоматическая стрельба
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        } else {
            this.shoot();
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    shoot() {
        // Ищем ближайшего врага
        let nearestEnemy = null;
        let minDistance = Infinity;

        enemies.forEach(enemy => {
            const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (dist < minDistance) {
                minDistance = dist;
                nearestEnemy = enemy;
            }
        });

        // Если есть враг, стреляем в его сторону
        if (nearestEnemy) {
            const angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
            bullets.push(new Bullet(this.x, this.y, angle));
            this.attackCooldown = this.attackSpeed; // Перезарядка
        }
    }
}

// 2. Пуля
class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.color = '#f1c40f'; // Желтый
        this.speed = 10;
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// 3. Враг
class Enemy {
    constructor() {
        // Спавн за пределами экрана (случайная сторона)
        const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
        this.radius = 15;
        
        if (side === 0) { this.x = Math.random() * canvas.width; this.y = -this.radius; }
        if (side === 1) { this.x = canvas.width + this.radius; this.y = Math.random() * canvas.height; }
        if (side === 2) { this.x = Math.random() * canvas.width; this.y = canvas.height + this.radius; }
        if (side === 3) { this.x = -this.radius; this.y = Math.random() * canvas.height; }

        this.color = '#e74c3c'; // Красный
        // Скорость немного варьируется
        this.speed = 2 + Math.random(); 
    }

    update(player) {
        // Движение к игроку
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }

    draw() {
        ctx.beginPath();
        // Рисуем квадрат для разнообразия
        ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// --- ИНИЦИАЛИЗАЦИЯ ---
const player = new Player();
const bullets = [];
const enemies = [];
let spawnRate = 60; // Каждые 60 кадров (1 секунда) спавнится враг

// --- ГЛАВНЫЙ ЦИКЛ ИГРЫ ---
function animate() {
    if (isGameOver) return;

    requestAnimationFrame(animate); // Запрос следующего кадра (60 FPS)
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Очистка экрана

    // Обновление таймера
    const currentTime = ((Date.now() - startTime) / 1000).toFixed(1);
    document.getElementById('timer').innerText = currentTime;

    // Логика спавна врагов
    frameCount++;
    // Усложнение: спавним чаще каждые 10 секунд
    if (frameCount % spawnRate === 0) {
        enemies.push(new Enemy());
        if (spawnRate > 20 && frameCount % 600 === 0) spawnRate -= 5;
    }

    // Обновление и отрисовка игрока
    player.update();
    player.draw();

    // Обновление пуль
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.update();
        bullet.draw();

        // Удаление пуль за пределами экрана
        if (bullet.x < 0 || bullet.x > canvas.width || 
            bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(i, 1);
        }
    }

    // Обновление врагов
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(player);
        enemy.draw();

        // Проверка столкновения Враг - Пуля
        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            
            // Если попали (сумма радиусов)
            if (dist < enemy.radius + bullet.radius) {
                enemies.splice(i, 1);
                bullets.splice(j, 1);
                score++;
                document.getElementById('score').innerText = score;
                break; // Выход из цикла пуль, так как враг мертв
            }
        }

        // Проверка столкновения Враг - Игрок
        const distPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distPlayer < player.radius + enemy.radius) {
            endGame(currentTime);
        }
    }
}

function endGame(finalTime) {
    isGameOver = true;
    document.getElementById('gameOverScreen').style.display = 'block';
    document.getElementById('finalTime').innerText = finalTime;
}

// Запуск
animate();
