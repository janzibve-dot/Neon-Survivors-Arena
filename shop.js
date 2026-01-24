/* shop.js - Логика магазина и апгрейдов */

const Shop = {
    isOpen: false,
    
    // Открыть/Закрыть магазин
    toggle: function() {
        this.isOpen = !this.isOpen;
        const modal = document.getElementById('shopModal');
        
        if (this.isOpen) {
            modal.style.display = 'flex';
            // Ставим игру на паузу, если она запущена
            if (typeof togglePause === 'function' && currentState === STATE.PLAYING) {
                togglePause(); 
            }
        } else {
            modal.style.display = 'none';
            // Снимаем с паузы
            if (typeof togglePause === 'function' && currentState === STATE.PAUSE) {
                togglePause();
            }
        }
    },

    // Функция покупки (заглушка на будущее)
    buyUpgrade: function(type) {
        console.log("Попытка купить: " + type);
        // Сюда мы потом добавим логику траты звезд
    }
};

// Вешаем событие на кнопку закрытия магазина
document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById('closeShopBtn');
    if(closeBtn) closeBtn.onclick = () => Shop.toggle();
});
