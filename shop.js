/* shop.js - Логика магазина и апгрейдов */

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
        speed: 7, 
        color: '#ffaa00',
        desc: "Высокая скорость, слабая броня.",
        icon: '⚡'
    },
    {
        id: 'tank',
        name: 'TITAN (HEAVY)',
        price: 70,
        hp: 200, 
        speed: 3, 
        color: '#00ff00',
        desc: "Тяжелая броня, низкая скорость.",
        icon: '🛡️'
    }
];

const Shop = {
    getPurchased: function() {
        const stored = localStorage.getItem('ns_purchased_ships');
        return stored ? JSON.parse(stored) : ['standard'];
    },

    getEquipped: function() {
        return localStorage.getItem('ns_equipped_ship') || 'standard';
    },

    open: function() {
        if (typeof togglePause === 'function' && currentState === STATE.PLAYING) {
            togglePause(); 
        }
        document.getElementById('shopModal').style.display = 'flex';
        this.render();
    },

    render: function() {
        const grid = document.getElementById('shopGrid');
        const purchased = this.getPurchased();
        const equipped = this.getEquipped();
        
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

    buy: function(id) {
        const ship = SHIPS.find(s => s.id === id);
        if (stars >= ship.price) {
            stars -= ship.price;
            if(typeof updateUI === 'function') updateUI(); 
            
            const purchased = this.getPurchased();
            purchased.push(id);
            localStorage.setItem('ns_purchased_ships', JSON.stringify(purchased));
            
            this.equip(id);
        }
    },

    equip: function(id) {
        localStorage.setItem('ns_equipped_ship', id);
        this.render();
        if (typeof player !== 'undefined') {
            player.applyShipStats();
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
