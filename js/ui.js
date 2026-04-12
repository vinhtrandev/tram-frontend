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

    /* ---------- HEALING QUOTES (định kỳ) ---------- */
    function startRandomQuotes() {
        setInterval(() => {
            const q = CONFIG.QUOTES[Math.floor(Math.random() * CONFIG.QUOTES.length)];
            showToast(`💫 ${q}`, 5000);
        }, 8 * 60 * 1000);
    }

    function showHealingQuote() {
        const q = CONFIG.QUOTES[Math.floor(Math.random() * CONFIG.QUOTES.length)];
        showToast(`💜 ${q}`, 6000);
    }

    /* ---------- SEND BLESSINGS ---------- */
    const BLESSINGS = [
        '🌟 Tín hiệu của bạn đã bay vào vũ trụ!',
        '💫 Vũ trụ đã nhận được tâm tư của bạn~',
        '🚀 Lời bạn đã vượt qua dải Ngân Hà rồi đó!',
        '✨ Một ngôi sao mới vừa được thắp lên!',
        '🌙 Tín hiệu đang lướt qua những vì sao đêm nay...',
        '🌌 Bầu trời ghi nhớ từng lời bạn gửi đi~',
        '💜 Mong điều bạn gửi sẽ trở thành ánh sáng!',
        '🛸 Phi thuyền đã nhận tín hiệu. Chúc bạn bình yên!',
        '⭐ Cảm xúc của bạn xứng đáng được lắng nghe~',
        '🌠 Sao băng mang lời bạn đến tận chân trời!'
    ];

    function showSendBlessing() {
        const msg = BLESSINGS[Math.floor(Math.random() * BLESSINGS.length)];
        showToast(msg, 4000);
    }

    /* ---------- HEAL PANEL ---------- */
    let _healIndex = Math.floor(Math.random() * (CONFIG?.QUOTES?.length || 1));

    function _renderHealPanel() {
        const panel = document.getElementById('heal-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-header">
                <h3>💜 Chữa Lành</h3>
                <button class="panel-close" id="close-heal">✕</button>
            </div>
            <div class="heal-body">
                <div class="heal-quote-card">
                    <span class="heal-quote-icon">🌸</span>
                    <p class="heal-quote-text" id="heal-quote-text"></p>
                </div>
                <button class="btn-new-quote" id="btn-new-quote">
                    <span class="btn-new-quote-icon">✨</span>
                    <span>Câu khác</span>
                </button>
            </div>
        `;

        _showHealQuote(false);

        document.getElementById('close-heal')?.addEventListener('click', () => {
            panel.classList.add('hidden');
        });

        document.getElementById('btn-new-quote')?.addEventListener('click', () => {
            // Chọn câu khác, không trùng câu hiện tại
            let next;
            do { next = Math.floor(Math.random() * CONFIG.QUOTES.length); }
            while (next === _healIndex && CONFIG.QUOTES.length > 1);
            _healIndex = next;
            _showHealQuote(true);
        });
    }

    function _showHealQuote(animate) {
        const el = document.getElementById('heal-quote-text');
        if (!el) return;
        if (animate) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px)';
            setTimeout(() => {
                el.textContent = CONFIG.QUOTES[_healIndex];
                el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 150);
        } else {
            el.textContent = CONFIG.QUOTES[_healIndex];
        }
    }

    /* ---------- PANELS ---------- */
    function initPanels() {
        const btnMissions = document.getElementById('btn-missions');
        const closeMissions = document.getElementById('close-missions');
        const btnStore = document.getElementById('btn-store');
        const closeStore = document.getElementById('close-store');
        const btnHeal = document.getElementById('btn-heal');
        const btnLogout = document.getElementById('btn-logout');

        if (btnMissions) {
            btnMissions.addEventListener('click', () => {
                togglePanel('missions-panel');
                document.getElementById('store-panel')?.classList.add('hidden');
                document.getElementById('heal-panel')?.classList.add('hidden');
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
                document.getElementById('heal-panel')?.classList.add('hidden');
                Store?.init?.();
            });
        }

        if (closeStore) {
            closeStore.addEventListener('click', () => {
                document.getElementById('store-panel')?.classList.add('hidden');
            });
        }

        // ✅ Handler Chữa Lành
        if (btnHeal) {
            btnHeal.addEventListener('click', () => {
                document.getElementById('missions-panel')?.classList.add('hidden');
                document.getElementById('store-panel')?.classList.add('hidden');
                const panel = document.getElementById('heal-panel');
                if (panel) {
                    panel.classList.toggle('hidden');
                    if (!panel.classList.contains('hidden')) _renderHealPanel();
                }
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

    return {
        showToast,
        addPoints,
        typewriter,
        initLandingText,
        startRandomQuotes,
        initPanels,
        showWelcome,
        updateHUD,
        showSendBlessing,
        showHealingQuote
    };
})();