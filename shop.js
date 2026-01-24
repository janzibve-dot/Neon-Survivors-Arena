/* shop.js - Логика магазина и апгрейдов */

// Список товаров
const SHIPS = [
    {
        id: 'standard',
        name: 'STRIKER (STD)',
        price: 0,
        hp: 100,
        speed: 5,
        color: '#00f3ff',
        desc: "Баланс скорости и брони.",
        icon: '🚀'
    },
    {
        id: 'scout',
        name: 'SCOUT (MK-II)',
        price: 45,
        hp: 60,
        speed: 7, // Быстрый
        color: '#ffaa00',
        desc: "Высокая скорость, слабая броня.",
        icon: '⚡'
    },
    {
        id: 'tank',
        name: 'TITAN (HEAVY)',
        price: 70,
        hp: 200, // Много HP
        speed: 3, // Медленный
        color: '#00ff00',
        desc: "Тяжелая броня, низкая скорость.",
        icon: '🛡️'
    }
];

const Shop = {
    // Получить купленные корабли (по умолчанию только standard)
    getPurchased: function() {
        const stored = localStorage.getItem('ns_purchased_ships');
        return stored ? JSON.parse(stored) : ['standard'];
    },

    // Получить текущий выбранный корабль
    getEquipped: function() {
        return localStorage.getItem('ns_equipped_ship') || 'standard';
    },

    // Открыть магазин
    open: function() {
        if (typeof togglePause === 'function' && currentState === STATE.PLAYING) {
            togglePause(); 
        }
        document.getElementById('shopModal').style.display = 'flex';
        this.render();
    },

    // Отрисовка товаров
    render: function() {
        const grid = document.getElementById('shopGrid');
        const purchased = this.getPurchased();
        const equipped = this.getEquipped();
        
        // Синхронизация звезд (берем из game.js переменной stars)
        // ВАЖНО: Мы отображаем звезды, накопленные в текущей сессии + сохраненные?
        // Для простоты будем считать stars глобальной валютой.
        // Но так как stars сбрасываются при смерти в Roguelike,
        // давай сделаем "Банк" звезд отдельным от run-currency.
        // Сейчас используем глобальную переменную stars из game.js.
        document.getElementById('shopStars').innerText = stars;

        grid.innerHTML = '';

        SHIPS.forEach(ship => {
            const isOwned = purchased.includes(ship.id);
            const isEquipped = equipped === ship.id;
            
            const card = document.createElement('div');
            card.className = 'shop-card';
            
            let btnHtml = '';
            if (isEquipped) {
                btnHtml = `<button class="card-btn btn-equipped">ВЫБРАНО</button>`;
            } else if (isOwned) {
                btnHtml = `<button class="card-btn btn-equip" onclick="Shop.equip('${ship.id}')">ВЫБРАТЬ</button>`;
            } else {
                if (stars >= ship.price) {
                    btnHtml = `<button class="card-btn btn-buy" onclick="Shop.buy('${ship.id}')">КУПИТЬ (${ship.price}★)</button>`;
                } else {
                    btnHtml = `<button class="card-btn btn-locked">НЕТ СРЕДСТВ (${ship.price}★)</button>`;
                }
            }

            card.innerHTML = `
                <div class="card-icon" style="color:${ship.color}">${ship.icon}</div>
                <div class="card-title" style="color:${ship.color}">${ship.name}</div>
                <div class="card-stats">HP: ${ship.hp} | SPD: ${ship.speed}</div>
                <div class="card-stats" style="margin-bottom: 15px;">${ship.desc}</div>
                ${btnHtml}
            `;
            grid.appendChild(card);
        });
    },

    // Покупка
    buy: function(id) {
        const ship = SHIPS.find(s => s.id === id);
        if (stars >= ship.price) {
            stars -= ship.price;
            // Обновляем UI в game.js
            if(typeof updateUI === 'function') updateUI(); 
            
            const purchased = this.getPurchased();
            purchased.push(id);
            localStorage.setItem('ns_purchased_ships', JSON.stringify(purchased));
            
            // Сразу экипируем
            this.equip(id);
        }
    },

    // Экипировка
    equip: function(id) {
        localStorage.setItem('ns_equipped_ship', id);
        this.render();
        // Если игра не идет, можно сразу обновить игрока
        // Но проще применить при следующем респауне/старте
        if (typeof player !== 'undefined') {
            player.applyShipStats(); // Метод добавим в game.js
        }
    },

    toggle: function() {
        const modal = document.getElementById('shopModal');
        if (modal.style.display === 'none') this.open();
        else {
            modal.style.display = 'none';
            if (typeof togglePause === 'function' && currentState === STATE.PAUSE) togglePause();
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById('closeShopBtn');
    if(closeBtn) closeBtn.onclick = () => Shop.toggle();
});
