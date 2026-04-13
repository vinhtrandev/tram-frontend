/* ================================================
   TRẠM GỬI TÍN HIỆU - app.js
   Main orchestrator: boot sequence, screen flow
   + NotifSystem hooks cho tất cả sự kiện điểm
   ================================================ */

const App = (() => {

    function boot() {
        Canvas.initLanding();
        Auth.initAuthUI();

        if (Auth.loadSession()) {
            _showLanding(true);
        } else {
            _showLanding(false);
        }
    }

    function _showLanding(hasSession) {
        const landing = document.getElementById('landing-screen');
        landing.classList.add('active');
        landing.classList.remove('hidden');
        UI.initLandingText();

        document.getElementById('btn-enter').addEventListener('click', () => {
            if (hasSession) {
                _transitionToMain();
            } else {
                document.getElementById('auth-modal').classList.remove('hidden');
            }
        });
    }

    function enterMain() {
        _transitionToMain();
    }

    async function _transitionToMain() {
        const landing = document.getElementById('landing-screen');
        const main = document.getElementById('main-screen');

        landing.style.opacity = '0';
        landing.style.pointerEvents = 'none';

        await _sleep(800);
        landing.classList.remove('active');
        landing.style.display = 'none';

        main.classList.remove('hidden');
        main.style.opacity = '0';
        await _sleep(50);
        main.style.transition = 'opacity 1.5s ease';
        main.style.opacity = '1';
        main.classList.add('active');

        _initMain();
    }

    async function _initMain() {
        // Sync data từ server trước khi render UI
        await Auth.syncFromServer();

        // Canvas
        Canvas.initMain();

        // UI (bao gồm NotifSystem.init() bên trong initPanels)
        UI.updateHUD();
        UI.initPanels();
        UI.showWelcome();
        UI.startRandomQuotes();

        // Missions
        Missions.init();

        // Gắn hooks ghi nhận giao dịch
        _hookSendSignal();
        _hookShootingStar();
        _hookVoid();
        _hookMeteorRain();

        // Stars
        Stars.loadStars();
        Stars.initPopupClose();
        Stars.startShootingStarCycle();
        Stars.startMeteorRain();

        // Sound
        Sound.initButtons();

        // First healing quote after 30s
        setTimeout(() => {
            UI.showToast('💫 ' + CONFIG.QUOTES[0], 5000);
        }, 30000);
    }

    /* ── Hook: Gửi tín hiệu → ghi +5 ✨ vào lịch sử ── */
    function _hookSendSignal() {
        const btn = document.getElementById('btn-send');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const text = document.getElementById('signal-text')?.value?.trim();
            if (!text) return; // bị chặn bởi validation rồi

            const activeType = document.querySelector('.star-type.active')?.dataset?.type || 'normal';
            const typeLabel = { normal: '⭐', shooting: '💫', bright: '🌟' }[activeType] || '⭐';
            NotifSystem.add('earn', '+5', `Gửi tín hiệu ${typeLabel}`);
        }, false);
    }

    /* ── Hook: Bắt sao băng → +50 ✨ ── */
    function _hookShootingStar() {
        document.addEventListener('shootingstar:caught', () => {
            NotifSystem.add('bonus', `+${CONFIG.POINTS.SHOOTING_STAR}`, 'Bắt được sao băng! 🌠');
        });
    }

    /* ── Hook: Hố đen hoàn thành → +10 ✨ ── */
    function _hookVoid() {
        document.addEventListener('void:released', () => {
            NotifSystem.add('earn', `+${CONFIG.POINTS.VOID_HOLD}`, 'Buông bỏ tại Hố Đen 🌑');
        });
    }

    /* ── Hook: Mưa sao băng → +30 ✨ ── */
    function _hookMeteorRain() {
        document.addEventListener('meteorrain:bonus', () => {
            NotifSystem.add('bonus', '+30', 'Mưa sao băng may mắn! 🌠');
        });
    }

    function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    return { enterMain };
})();