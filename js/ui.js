/* ================================================
   TRẠM GỬI TÍN HIỆU - ui.js
   UI helpers: toast, points, panels, typewriter,
   healing quotes, panel toggles + NotifSystem
   + Void hold timer (bao quanh Hố Đen, 10s)
   ================================================ */

/* ============================================================
   NOTIFICATION / TRANSACTION HISTORY SYSTEM
   Lưu vào DB qua API + fallback localStorage
   ============================================================ */
const NotifSystem = (() => {
    const MAX_ITEMS = 50;

    let transactions = [];
    let unread = 0;

    let panel, bellBtn, badge, list, emptyEl,
        earnedEl, spentEl, balanceEl, clearBtn, closeBtn;

    /* ── Key localStorage riêng theo từng user ── */
    function _storageKey() {
        const nick = STATE.user?.nickname || STATE.user?.username || 'guest';
        return `tinh_tu_history__${nick}`;
    }

    /* ── Lưu localStorage (fallback offline) ── */
    function _saveLocal() {
        try { localStorage.setItem(_storageKey(), JSON.stringify(transactions)); } catch (e) { }
    }

    /* ── Load: ưu tiên API, fallback localStorage ── */
    async function _loadFromServer() {
        const token = STATE.user?.token;
        if (!token || token === 'local') { _loadLocal(); return; }

        try {
            const res = await fetch(`${CONFIG.API_BASE}/transactions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Server error');
            const data = await res.json();

            // Map server format → internal format
            transactions = data.map(tx => ({
                type: tx.type,
                amount: (tx.amount >= 0 ? '+' : '') + tx.amount,
                amountNum: tx.amount,
                desc: tx.desc,
                time: tx.time
            }));

            _saveLocal(); // sync về localStorage của đúng user
        } catch (e) {
            _loadLocal(); // fallback
        }
    }

    function _loadLocal() {
        try {
            const raw = localStorage.getItem(_storageKey());
            transactions = raw ? JSON.parse(raw) : [];
        } catch (e) { transactions = []; }
    }

    /* ── Xoá cache local của user hiện tại (gọi khi logout) ── */
    function clearLocalCache() {
        try { localStorage.removeItem(_storageKey()); } catch (e) { }
        transactions = [];
        unread = 0;
        _updateBadge();
    }

    /* ── Ghi lên server (best-effort, không block UI) ── */
    async function _saveToServer(type, amountNum, desc) {
        const token = STATE.user?.token;
        if (!token || token === 'local') return;

        try {
            await fetch(`${CONFIG.API_BASE}/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type,
                    amount: String(amountNum),
                    desc
                })
            });
        } catch (e) {
            // silent fail — localStorage đã có rồi
        }
    }

    /* ── Helpers ── */
    function _formatTime(iso) {
        const d = new Date(iso);
        const diffMin = Math.floor((Date.now() - d) / 60000);
        if (diffMin < 1) return 'Vừa xong';
        if (diffMin < 60) return `${diffMin} phút trước`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH} giờ trước`;
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return `${diffD} ngày trước`;
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    }

    function _typeIcon(type) {
        return { earn: '✨', spend: '🎁', bonus: '⭐' }[type] || '💫';
    }

    /* ── Render summary ── */
    function _renderSummary() {
        const earned = transactions
            .filter(t => t.type === 'earn' || t.type === 'bonus')
            .reduce((s, t) => s + Math.abs(t.amountNum), 0);
        const spent = transactions
            .filter(t => t.type === 'spend')
            .reduce((s, t) => s + Math.abs(t.amountNum), 0);
        const navPts = document.getElementById('user-points');
        const balance = navPts ? (parseInt(navPts.textContent) || 0) : (earned - spent);

        if (earnedEl) earnedEl.textContent = earned;
        if (spentEl) spentEl.textContent = spent;
        if (balanceEl) balanceEl.textContent = balance;
    }

    /* ── Render danh sách giao dịch ── */
    function _renderList() {
        if (!list) return;
        [...list.querySelectorAll('.notif-item')].forEach(el => el.remove());

        if (transactions.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        [...transactions].reverse().forEach(tx => {
            const item = document.createElement('div');
            item.className = `notif-item type-${tx.type}`;
            item.innerHTML = `
                <div class="notif-item-icon">${_typeIcon(tx.type)}</div>
                <div class="notif-item-body">
                    <div class="notif-item-desc" title="${tx.desc}">${tx.desc}</div>
                    <div class="notif-item-time">${_formatTime(tx.time)}</div>
                </div>
                <div class="notif-item-amount">${tx.amount} ✨</div>
            `;
            list.appendChild(item);
        });
    }

    /* ── Trạng thái loading cho panel ── */
    function _showLoading() {
        if (!list) return;
        [...list.querySelectorAll('.notif-item')].forEach(el => el.remove());
        if (emptyEl) emptyEl.classList.add('hidden');

        const loader = document.createElement('div');
        loader.id = 'notif-loader';
        loader.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px 0;
            gap: 10px;
            color: rgba(212,184,255,0.5);
            font-family: 'Quicksand', sans-serif;
            font-size: 0.82rem;
        `;
        loader.innerHTML = `
            <div style="
                width: 28px; height: 28px;
                border: 2px solid rgba(156,125,255,0.15);
                border-top-color: rgba(156,125,255,0.7);
                border-radius: 50%;
                animation: notifSpin 0.8s linear infinite;
            "></div>
            <span>Đang tải lịch sử...</span>
        `;

        // Inject keyframe nếu chưa có
        if (!document.getElementById('notif-spin-style')) {
            const s = document.createElement('style');
            s.id = 'notif-spin-style';
            s.textContent = `@keyframes notifSpin { to { transform: rotate(360deg); } }`;
            document.head.appendChild(s);
        }

        list.appendChild(loader);
    }

    function _hideLoading() {
        document.getElementById('notif-loader')?.remove();
    }

    /* ── Update badge ── */
    function _updateBadge() {
        if (!badge) return;
        if (unread > 0) {
            badge.textContent = unread > 99 ? '99+' : unread;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    /* ── Toggle panel (load từ server mỗi lần mở) ── */
    async function toggle() {
        if (!panel) return;
        const isHidden = panel.classList.contains('hidden');
        if (isHidden) {
            // Đóng các panel khác
            document.getElementById('missions-panel')?.classList.add('hidden');
            document.getElementById('store-panel')?.classList.add('hidden');
            document.getElementById('heal-panel')?.classList.add('hidden');

            panel.classList.remove('hidden');
            unread = 0;
            _updateBadge();

            // Hiển thị loading → load server → render
            _showLoading();
            await _loadFromServer();
            _hideLoading();
            _renderSummary();
            _renderList();
        } else {
            panel.classList.add('hidden');
        }
    }

    /* ── PUBLIC: add transaction ── */
    function add(type, amount, desc) {
        const amountNum = parseInt(String(amount).replace(/[^0-9-]/g, '')) || 0;
        const tx = {
            type,
            amount: String(amount),
            amountNum,
            desc,
            time: new Date().toISOString()
        };

        transactions.push(tx);
        if (transactions.length > MAX_ITEMS)
            transactions.splice(0, transactions.length - MAX_ITEMS);

        _saveLocal();                            // lưu local ngay lập tức
        _saveToServer(type, amountNum, desc);    // gửi server async (không block)

        unread++;
        _updateBadge();

        // Nếu panel đang mở → cập nhật luôn
        if (panel && !panel.classList.contains('hidden')) {
            _renderSummary();
            _renderList();
        }
    }

    /* ── Init ── */
    function init() {
        panel = document.getElementById('notif-panel');
        bellBtn = document.getElementById('nav-bell-btn');
        badge = document.getElementById('bell-badge');
        list = document.getElementById('notif-list');
        emptyEl = document.getElementById('notif-empty');
        earnedEl = document.getElementById('total-earned-display');
        spentEl = document.getElementById('total-spent-display');
        balanceEl = document.getElementById('balance-display');
        clearBtn = document.getElementById('notif-clear-btn');
        closeBtn = document.getElementById('close-notif');

        // Reset sạch trước — không dùng data của user khác còn sót
        transactions = [];
        unread = 0;

        // Load local của đúng user hiện tại (key theo nickname)
        _loadLocal();
        _updateBadge();

        bellBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
        closeBtn?.addEventListener('click', () => panel?.classList.add('hidden'));

        clearBtn?.addEventListener('click', () => {
            if (confirm('Xoá toàn bộ lịch sử giao dịch?')) {
                transactions = [];
                _saveLocal();
                _renderSummary();
                _renderList();
            }
        });

        document.addEventListener('click', (e) => {
            if (panel && !panel.contains(e.target) && e.target !== bellBtn) {
                panel.classList.add('hidden');
            }
        });
    }

    return { init, add, clearLocalCache };
})();


/* ============================================================
   VOID HOLD TIMER
   Bao quanh bên ngoài .void (110×110px)
   .void-timer = 130×130px (nhô ra 10px mỗi bên)
   SVG viewBox="0 0 130 130", circle r=62
   circumference = 2π × 62 ≈ 390
   ============================================================ */
const VoidTimer = (() => {
    const HOLD_DURATION = 10000; // 10 giây
    const CIRCUMFERENCE = 390;   // 2π × 62

    let holdTimer = null;
    let rafId = null;
    let startTime = null;
    let isHolding = false;
    let voidEl, timerWrap, progressEl, countEl;

    function _getEls() {
        voidEl = document.getElementById('void');
        timerWrap = document.getElementById('void-timer');
        progressEl = document.getElementById('timer-progress');
        countEl = document.getElementById('void-count');
    }

    function _showTimer() {
        timerWrap.classList.remove('hidden');
        progressEl.style.strokeDashoffset = CIRCUMFERENCE;
        countEl.textContent = '10';
    }

    function _hideTimer() {
        timerWrap.classList.add('hidden');
        progressEl.style.strokeDashoffset = CIRCUMFERENCE;
        countEl.textContent = '10';
    }

    function _tick() {
        const elapsed = Date.now() - startTime;
        const fraction = Math.min(elapsed / HOLD_DURATION, 1);

        progressEl.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);

        const remaining = Math.ceil((HOLD_DURATION - elapsed) / 1000);
        countEl.textContent = Math.max(remaining, 0);

        if (isHolding) rafId = requestAnimationFrame(_tick);
    }

    function _startHold(e) {
        if (e && e.type === 'touchstart') e.preventDefault();
        if (isHolding) return;
        isHolding = true;
        startTime = Date.now();

        _showTimer();
        rafId = requestAnimationFrame(_tick);
        holdTimer = setTimeout(_finishHold, HOLD_DURATION);
    }

    function _finishHold() {
        _stopHold();

        progressEl.style.strokeDashoffset = 0;
        countEl.textContent = '0';

        if (voidEl) {
            voidEl.style.animation = 'voidFlash 0.6s ease';
            setTimeout(() => { voidEl.style.animation = ''; }, 700);
        }

        document.dispatchEvent(new CustomEvent('void:released'));

        if (typeof UI !== 'undefined') {
            UI.showToast('🌑 Bạn đã buông bỏ thành công. Hãy thở sâu~', 4000);
        }

        setTimeout(_hideTimer, 900);
    }

    function _cancelHold() {
        if (!isHolding) return;
        _stopHold();
        _hideTimer();
    }

    function _stopHold() {
        isHolding = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    }

    function init() {
        _getEls();
        if (!voidEl) return;

        const newVoid = voidEl.cloneNode(true);
        voidEl.parentNode.replaceChild(newVoid, voidEl);
        voidEl = newVoid;

        timerWrap = document.getElementById('void-timer');
        progressEl = document.getElementById('timer-progress');
        countEl = document.getElementById('void-count');

        voidEl.addEventListener('mousedown', _startHold);
        window.addEventListener('mouseup', _cancelHold);

        voidEl.addEventListener('touchstart', _startHold, { passive: false });
        window.addEventListener('touchend', _cancelHold, { passive: true });
        window.addEventListener('touchcancel', _cancelHold, { passive: true });
    }

    return { init };
})();


/* ============================================================
   UI MODULE
   ============================================================ */
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
    function addPoints(amount, desc) {
        STATE.points = Math.max(0, STATE.points + amount);
        document.getElementById('user-points').textContent = STATE.points;

        if (amount > 0) {
            _showPointGain(amount);
            if (desc) NotifSystem.add('earn', `+${amount}`, desc);
        } else if (amount < 0) {
            if (desc) NotifSystem.add('spend', `${amount}`, desc);
        }
        Auth.saveState();
    }

    function addBonus(amount, desc) {
        STATE.points = Math.max(0, STATE.points + amount);
        document.getElementById('user-points').textContent = STATE.points;
        _showPointGain(amount);
        if (desc) NotifSystem.add('bonus', `+${amount}`, desc);
        Auth.saveState();
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

    /* ---------- HEALING QUOTES ---------- */
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

    function _nextHealQuote() {
        let next;
        do { next = Math.floor(Math.random() * CONFIG.QUOTES.length); }
        while (next === _healIndex && CONFIG.QUOTES.length > 1);
        _healIndex = next;
    }

    function _renderHealPanel() {
        const panel = document.getElementById('heal-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-header">
                <h3>💜 Chữa Lành</h3>
                <button class="panel-close" id="close-heal">✕</button>
            </div>
            <div class="heal-body">
                <div class="heal-quote-card" id="heal-quote-card" title="Chạm để đổi câu">
                    <span class="heal-quote-icon">🌸</span>
                    <p class="heal-quote-text" id="heal-quote-text"></p>
                    <span class="heal-tap-hint">Chạm để đổi câu ✨</span>
                </div>
            </div>
        `;

        if (!document.getElementById('heal-card-style')) {
            const s = document.createElement('style');
            s.id = 'heal-card-style';
            s.textContent = `
                #heal-quote-card {
                    cursor: pointer;
                    user-select: none;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                    position: relative;
                    overflow: hidden;
                }
                #heal-quote-card:hover {
                    transform: scale(1.02);
                    box-shadow: 0 0 20px rgba(156,125,255,0.2);
                }
                #heal-quote-card:active { transform: scale(0.97); }
                .heal-tap-hint {
                    display: block;
                    text-align: center;
                    font-size: 0.65rem;
                    color: rgba(156,125,255,0.45);
                    font-family: 'Quicksand', sans-serif;
                    margin-top: 10px;
                    letter-spacing: 0.04em;
                    pointer-events: none;
                }
                .heal-ripple {
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(156,125,255,0.18);
                    transform: scale(0);
                    animation: healRippleAnim 0.5s ease-out forwards;
                    pointer-events: none;
                }
                @keyframes healRippleAnim { to { transform: scale(4); opacity: 0; } }
            `;
            document.head.appendChild(s);
        }

        _showHealQuote(false);

        document.getElementById('close-heal')?.addEventListener('click', () => {
            panel.classList.add('hidden');
        });

        document.getElementById('heal-quote-card')?.addEventListener('click', (e) => {
            const card = e.currentTarget;
            const rect = card.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const ripple = document.createElement('span');
            ripple.className = 'heal-ripple';
            ripple.style.cssText = `
                width:${size}px; height:${size}px;
                left:${e.clientX - rect.left - size / 2}px;
                top:${e.clientY - rect.top - size / 2}px;
            `;
            card.appendChild(ripple);
            setTimeout(() => ripple.remove(), 500);

            _nextHealQuote();
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

    /* ---------- LOGOUT MODAL ---------- */
    function _showLogoutModal() {
        const modal = document.getElementById('logout-modal');
        if (!modal) {
            if (confirm('Rời Trạm? Tiến trình đã được lưu.')) {
                Auth.logout();
                location.reload();
            }
            return;
        }

        modal.classList.remove('hidden');

        const cancelBtn = document.getElementById('logout-cancel');
        const confirmBtn = document.getElementById('logout-confirm');

        const newCancel = cancelBtn.cloneNode(true);
        const newConfirm = confirmBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

        newCancel.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        newConfirm.addEventListener('click', () => {
            modal.classList.add('hidden');
            NotifSystem.clearLocalCache(); // xoá cache lịch sử của user hiện tại
            _animateRocketExit(() => {
                Auth.logout();
                location.reload();
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        }, { once: true });
    }

    function _animateRocketExit(cb) {
        const rocket = document.createElement('div');
        rocket.textContent = '🚀';
        rocket.style.cssText = `
            position: fixed;
            bottom: 40%;
            left: 50%;
            transform: translateX(-50%);
            font-size: 2.5rem;
            z-index: 2000;
            pointer-events: none;
            transition: transform 0.9s cubic-bezier(0.4, 0, 0.2, 1),
                        opacity 0.9s ease;
        `;
        document.body.appendChild(rocket);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                rocket.style.transform = 'translateX(-50%) translateY(-120vh) rotate(-15deg)';
                rocket.style.opacity = '0';
            });
        });

        setTimeout(() => {
            rocket.remove();
            cb && cb();
        }, 900);
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
                document.getElementById('notif-panel')?.classList.add('hidden');
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
                document.getElementById('notif-panel')?.classList.add('hidden');
                Store?.init?.();
            });
        }

        if (closeStore) {
            closeStore.addEventListener('click', () => {
                document.getElementById('store-panel')?.classList.add('hidden');
            });
        }

        if (btnHeal) {
            btnHeal.addEventListener('click', () => {
                document.getElementById('missions-panel')?.classList.add('hidden');
                document.getElementById('store-panel')?.classList.add('hidden');
                document.getElementById('notif-panel')?.classList.add('hidden');
                const panel = document.getElementById('heal-panel');
                if (panel) {
                    panel.classList.toggle('hidden');
                    if (!panel.classList.contains('hidden')) _renderHealPanel();
                }
            });
        }

        if (btnLogout) {
            btnLogout.addEventListener('click', () => _showLogoutModal());
        }

        NotifSystem.init();

        // ── Khởi tạo Void Hold Timer ──
        setTimeout(() => VoidTimer.init(), 200);
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
        addBonus,
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