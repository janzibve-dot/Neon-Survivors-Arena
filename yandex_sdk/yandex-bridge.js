/* YANDEX BRIDGE
   Этот файл отвечает за связь игры с платформой Яндекс.Игры.
   Сейчас он настроен, но не подключен к index.html.
*/

let ysdk = null;       // Здесь будет храниться сам "инструмент" Яндекса
let player = null;     // Здесь будет профиль игрока для сохранений в облаке
let lb = null;         // Лидерборды (таблица рекордов)

// 1. Инициализация (Запуск) Яндекса
// Эту функцию мы вызовем в самом начале игры, когда подключим SDK
function initYandexSDK() {
    console.log("--- YANDEX SDK: Попытка подключения... ---");
    
    // Проверка: существует ли вообще SDK (подключен ли скрипт в HTML)
    if (window.YaGames) {
        YaGames.init()
            .then(_ysdk => {
                ysdk = _ysdk;
                console.log("--- YANDEX SDK: УСПЕШНО ИНИЦИАЛИЗИРОВАН ---");
                // После успеха можно сразу попытаться получить данные игрока
                initPlayer();
            })
            .catch(err => {
                console.error("--- YANDEX SDK: Ошибка инициализации ---", err);
            });
    } else {
        console.log("--- YANDEX SDK: Скрипт не найден (Локальный режим) ---");
    }
}

// 2. Получение данных игрока (для облачных сохранений)
function initPlayer() {
    if (!ysdk) return;

    ysdk.getPlayer().then(_player => {
        player = _player;
        console.log("--- YANDEX SDK: Игрок авторизован ---");
        // Здесь мы потом загрузим сохранения из облака
    }).catch(err => {
        console.error("--- YANDEX SDK: Ошибка получения игрока ---", err);
    });
}

// 3. Показ рекламы (Interstitial - реклама на весь экран)
// Мы будем вызывать это между уровнями или при Game Over
function showFullscreenAd() {
    if (ysdk) {
        ysdk.adv.showFullscreenAdv({
            callbacks: {
                onClose: function(wasShown) {
                    // Действие после закрытия рекламы (например, продолжить игру)
                    console.log("--- YANDEX AD: Реклама закрыта ---");
                    if (typeof togglePause === 'function' && currentState === STATE.PAUSE) {
                        togglePause(); // Снимаем с паузы, если игра была на паузе
                    }
                },
                onError: function(error) {
                    console.error("--- YANDEX AD: Ошибка рекламы ---", error);
                }
            }
        });
    } else {
        console.log("--- YANDEX AD: Реклама не показана (SDK не активен) ---");
    }
}

// 4. Показ рекламы за вознаграждение (Rewarded Video)
// Например, за "Воскрешение" или "Доп. монеты"
function showRewardedAd(id) {
    if (ysdk) {
        ysdk.adv.showRewardedVideo({
            callbacks: {
                onOpen: () => {
                    console.log('--- YANDEX AD: Видео открыто ---');
                    // Тут можно поставить игру на паузу и выключить звук
                },
                onRewarded: () => {
                    console.log('--- YANDEX AD: Награда получена! ---');
                    // ТУТ ВЫДАЕМ НАГРАДУ ИГРОКУ (вызываем функцию из game.js)
                },
                onClose: () => {
                    console.log('--- YANDEX AD: Видео закрыто ---');
                    // Снимаем с паузы
                }, 
                onError: (e) => {
                    console.error('--- YANDEX AD: Ошибка ---', e);
                }
            }
        });
    } else {
        console.log("--- YANDEX AD: Rewarded Video не работает без SDK ---");
    }
}

// 5. Сохранение прогресса в облако
function saveToCloud(data) {
    if (player) {
        player.setData(data).then(() => {
            console.log('--- YANDEX SAVE: Данные сохранены в облако ---');
        });
    }
}
