/* ================================================
   TRẠM GỬI TÍN HIỆU - ui.js
   UI helpers: toast, points, panels, typewriter,
   healing quotes, panel toggles
   ================================================ */

const UI = (() => {

    /* ---------- TOAST ---------- */
    function showToast(msg, duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    /* ---------- POINTS ---------- */
    function addPoints(amount) {
        STATE.points = Math.max(0, STATE.points + amount);
        document.getElementById('user-points').textContent = STATE.points;

        if (amount > 0) {
            _showPointGain(amount);
            Auth.saveState();
        } else {
            Auth.saveState();
        }
    }

    function _showPointGain(amount) {
        const el = document.createElement('div');
        el.className = 'point-gain-label';
        el.textContent = `+${amount} ✨`;
        const ptEl = document.getElementById('user-points');
        const rect = ptEl.getBoundingClientRect();
        el.style.cssText = `left:${rect.left}px; top:${rect.top}px;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1300);

        // Ring effect
        const ring = document.createElement('div');
        ring.className = 'points-ring';
        ring.style.cssText = `left:${rect.left - 5}px; top:${rect.top - 5}px;`;
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 800);
    }

    /* ---------- TYPEWRITER ---------- */
    function typewriter(el, text, speed = 55, done) {
        let i = 0;
        el.textContent = '';
        const interval = setInterval(() => {
            el.textContent += text[i++];
            if (i >= text.length) { clearInterval(interval); done && done(); }
        }, speed);
    }

    /* ---------- LANDING TYPEWRITER ---------- */
    function initLandingText() {
        const el = document.getElementById('landing-text');
        const msg = 'Bạn đang bước vào vùng tĩnh lặng.\nMọi lo âu dừng lại tại đây.';
        typewriter(el, msg, 60);
    }

    /* ---------- HEALING QUOTES ---------- */
    function startRandomQuotes() {
        setInterval(() => {
            const q = CONFIG.QUOTES[Math.floor(Math.random() * CONFIG.QUOTES.length)];
            showToast(`💫 ${q}`, 5000);
        }, 8 * 60 * 1000); // every 8 minutes
    }

    /* ---------- PANELS ---------- */
    function initPanels() {
        const btnMissions = document.getElementById('btn-missions');
        const closeMissions = document.getElementById('close-missions');
        const btnStore = document.getElementById('btn-store');
        const closeStore = document.getElementById('close-store');
        const btnLogout = document.getElementById('btn-logout');

        if (btnMissions) {
            btnMissions.addEventListener('click', () => {
                togglePanel('missions-panel');
                document.getElementById('store-panel')?.classList.add('hidden');
            });
        }

        if (closeMissions) {
            closeMissions.addEventListener('click', () => {
                document.getElementById('missions-panel')?.classList.add('hidden');
            });
        }

        if (btnStore) {
            btnStore.addEventListener('click', () => {
                togglePanel('store-panel');
                document.getElementById('missions-panel')?.classList.add('hidden');
                Store?.init?.();
            });
        }

        if (closeStore) {
            closeStore.addEventListener('click', () => {
                document.getElementById('store-panel')?.classList.add('hidden');
            });
        }

        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                if (confirm('Rời Trạm? Tiến trình đã được lưu.')) {
                    Auth.logout();
                    location.reload();
                }
            });
        }
    }

    function togglePanel(id) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden');
    }

    /* ---------- WELCOME QUOTE ---------- */
    function showWelcome() {
        const greets = [
            `Chào mừng trở lại, ${STATE.user?.nickname || 'người lữ hành'} ✦`,
            `Bầu trời đang chờ bạn, ${STATE.user?.nickname || 'phi hành gia'} ✦`,
            `Thật vui khi bạn quay lại Trạm 🌙`
        ];
        setTimeout(() => showToast(greets[Math.floor(Math.random() * greets.length)], 4000), 1200);
    }

    /* ---------- UPDATE HUD ---------- */
    function updateHUD() {
        const el = document.getElementById('user-nickname');
        if (el) el.textContent = STATE.user?.nickname || 'STAR_??';
        document.getElementById('user-points').textContent = STATE.points;
    }

    return { showToast, addPoints, typewriter, initLandingText, startRandomQuotes, initPanels, showWelcome, updateHUD };
})();