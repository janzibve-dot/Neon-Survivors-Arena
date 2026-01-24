/* shop.js */

const SHIPS = [
    { id: 'standard', name: 'STRIKER (STD)', price: 0, hp: 100, speed: 5, color: '#00f3ff', desc: "Баланс скорости и брони.", icon: '🚀', type: 'ship' },
    { id: 'scout', name: 'SCOUT (MK-II)', price: 45, hp: 60, speed: 7, color: '#ffaa00', desc: "Высокая скорость, слабая броня.", icon: '⚡', type: 'ship' },
    { id: 'tank', name: 'TITAN (HEAVY)', price: 70, hp: 200, speed: 3, color: '#00ff00', desc: "Тяжелая броня, низкая скорость.", icon: '🛡️', type: 'ship' },
    { id: 'drone', name: 'LASER DRONE', price: 100, hp: 0, speed: 0, color: '#ffffff', desc: "Автоматический помощник.", icon: '🛸', type: 'upgrade' }
];

const Shop = {
    getPurchased: function() { const stored = localStorage.getItem('ns_purchased_ships'); return stored ? JSON.parse(stored) : ['standard']; },
    getEquipped: function() { return localStorage.getItem('ns_equipped_ship') || 'standard'; },
    
    // ОТКРЫТИЕ С ПАУЗОЙ
    open: function() { 
        if (typeof currentState !== 'undefined' && currentState === STATE.PLAYING) { 
            currentState = STATE.PAUSE; // Ставим игру на паузу
        } 
        document.getElementById('shopModal').style.display = 'flex'; 
        this.render(); 
    },
    
    // ЗАКРЫТИЕ И ВОЗВРАТ В ИГРУ
    close: function() { 
        document.getElementById('shopModal').style.display = 'none'; 
        if (typeof currentState !== 'undefined' && currentState === STATE.PAUSE) { 
            currentState = STATE.PLAYING; // Снимаем с паузы
        } 
    },

    render: function() {
        const grid = document.getElementById('shopGrid'); const purchased = this.getPurchased(); const equipped = this.getEquipped();
        document.getElementById('shopStars').innerText = stars; grid.innerHTML = '';
        SHIPS.forEach(item => {
            const isOwned = purchased.includes(item.id); const isEquipped = equipped === item.id;
            const card = document.createElement('div'); card.className = 'shop-card';
            let btnHtml = '';
            if (item.type === 'ship') {
                if (isEquipped) btnHtml = `<button class="card-btn btn-equipped">ВЫБРАНО</button>`;
                else if (isOwned) btnHtml = `<button class="card-btn btn-equip" onclick="Shop.equip('${item.id}')">ВЫБРАТЬ</button>`;
                else if (stars >= item.price) btnHtml = `<button class="card-btn btn-buy" onclick="Shop.buy('${item.id}')">КУПИТЬ (${item.price}★)</button>`;
                else btnHtml = `<button class="card-btn btn-locked">НЕТ СРЕДСТВ (${item.price}★)</button>`;
            } else {
                if (isOwned) btnHtml = `<button class="card-btn btn-equipped">КУПЛЕНО</button>`;
                else if (stars >= item.price) btnHtml = `<button class="card-btn btn-buy" onclick="Shop.buy('${item.id}')">КУПИТЬ (${item.price}★)</button>`;
                else btnHtml = `<button class="card-btn btn-locked">НЕТ СРЕДСТВ (${item.price}★)</button>`;
            }
            card.innerHTML = `<div class="card-icon" style="color:${item.color}">${item.icon}</div><div class="card-title" style="color:${item.color}">${item.name}</div><div class="card-stats">${item.type === 'ship' ? `HP: ${item.hp} | SPD: ${item.speed}` : 'PASSIVE'}</div><div class="card-stats" style="margin-bottom: 15px;">${item.desc}</div>${btnHtml}`;
            grid.appendChild(card);
        });
    },
    buy: function(id) {
        const item = SHIPS.find(s => s.id === id);
        if (stars >= item.price) {
            stars -= item.price; localStorage.setItem('neon_survivor_stars', stars);
            if(typeof updateUI === 'function') updateUI(); 
            const purchased = this.getPurchased(); purchased.push(id); localStorage.setItem('ns_purchased_ships', JSON.stringify(purchased));
            if (item.type === 'ship') this.equip(id);
            else { if (id === 'drone') localStorage.setItem('ns_has_drone', 'true'); this.render(); }
        }
    },
    equip: function(id) { localStorage.setItem('ns_equipped_ship', id); this.render(); if (typeof player !== 'undefined') { player.applyShipStats(); } },
    toggle: function() { const modal = document.getElementById('shopModal'); if (modal.style.display === 'none') this.open(); else this.close(); }
};
