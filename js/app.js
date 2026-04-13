/* ================================================
   TRẠM GỬI TÍN HIỆU - app.js
   Main orchestrator: boot sequence, screen flow
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
        // ✅ Sync data từ server trước khi render UI
        await Auth.syncFromServer();

        // Canvas
        Canvas.initMain();

        // UI
        UI.updateHUD();
        UI.initPanels();
        UI.showWelcome();
        UI.startRandomQuotes();

        // Missions (đã bao gồm _initInput với toxic check đầy đủ)
        Missions.init();

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

    function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    return { enterMain };
})();