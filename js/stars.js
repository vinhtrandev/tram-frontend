/* ================================================
   TRẠM GỬI TÍN HIỆU - stars.js (FIXED & HOÀN CHỈNH)
   DOM star dots, signal sending, star popup,
   shooting star event, meteor rain
   ================================================ */

const Stars = (() => {

    const container = () => document.getElementById('main-screen');
    let domStars = [];
    let shootingActive = false;
    let shootingTimer, meteorTimer;

    const METEOR_DURATION = 8000;

    /* ---- NEGATIVE KEYWORD CHECK ---- */
    function _isNegative(text) {
        const lower = text.toLowerCase();
        return CONFIG.NEGATIVE_KEYWORDS.some(k => lower.includes(k));
    }

    /* ---- SYNC ĐIỂM TỪ SERVER ---- */
    async function _syncPointsFromServer() {
        if (!STATE.user?.token || STATE.user.token === 'local') return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${STATE.user.token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            STATE.points = data.points;
            STATE.user.points = data.points;
            localStorage.setItem('tram_points', STATE.points);
        } catch { }
    }

    /* ---- GỬI ĐIỂM LÊN SERVER ---- */
    async function _pushPointsToServer(amount) {
        if (!STATE.user?.token || STATE.user.token === 'local') return;
        try {
            await fetch(`${CONFIG.API_BASE}/auth/points`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${STATE.user.token}`
                },
                body: JSON.stringify({ amount })
            });
        } catch { }
    }

    /* ---- CREATE DOM STAR ---- */
    function _createDomStar(data) {
        const el = document.createElement('div');
        el.className = `star-dot type-${data.type}`;
        el.style.cssText = `
      left:${data.x}%; top:${data.y}%;
      width:${data.size}px; height:${data.size}px;
      opacity:${data.opacity};
      box-shadow:0 0 ${data.size * 2}px ${data.size}px ${CONFIG.STAR_TYPES[data.type]?.color || '#fff'}55;
      animation: twinkle ${3 + Math.random() * 4}s ease-in-out infinite;
      animation-delay:${Math.random() * 4}s;
    `;
        if (data.isNegative) el.classList.add('has-react');
        if (data.tailEffect) el.style.boxShadow += `, -${data.size * 8}px 0 ${data.size * 2}px ${CONFIG.STAR_TYPES[data.type]?.color || '#fff'}33`;

        el.addEventListener('click', () => _showPopup(el, data));
        el.addEventListener('mouseenter', () => _showLabel(el, data));
        el.addEventListener('mouseleave', _hideLabel);

        container().appendChild(el);
        return el;
    }

    /* ---- LABEL ---- */
    let labelEl = null;
    function _showLabel(el, data) {
        _hideLabel();
        labelEl = document.createElement('div');
        labelEl.className = 'star-label';
        labelEl.textContent = data.text.substring(0, 40) + (data.text.length > 40 ? '…' : '');
        const rect = el.getBoundingClientRect();
        labelEl.style.cssText = `left:${rect.left + rect.width / 2}px; top:${rect.top - 28}px; position:fixed; z-index:200;`;
        document.body.appendChild(labelEl);
    }

    function _hideLabel() {
        if (labelEl) { labelEl.remove(); labelEl = null; }
    }

    /* ---- POPUP ---- */
    function _showPopup(el, data) {
        const popup = document.getElementById('star-popup');
        if (!popup) return;
        document.getElementById('star-popup-text').textContent = data.text;

        const rect = el.getBoundingClientRect();
        const pw = 280, ph = 180;
        let left = rect.left - pw / 2;
        let top = rect.top - ph - 16;
        left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
        top = Math.max(70, top);
        popup.style.cssText = `left:${left}px; top:${top}px; display:block;`;
        popup.classList.remove('hidden');

        popup.querySelectorAll('.react-btn').forEach(btn => {
            btn.onclick = () => {
                _sendReaction(data.id, btn.dataset.reaction, el);
                popup.classList.add('hidden');
                if (data.isNegative) Missions.progress('light_hope', 1);
                UI.showToast('Đã gửi cảm xúc của bạn 💫');
            };
        });

        STATE.starsRead = (parseInt(STATE.starsRead) || 0) + 1;
        Missions.progress('read_stars', STATE.starsRead);
    }

    async function _sendReaction(starId, type, el) {
        if (!starId) return;
        try {
            await fetch(`${CONFIG.API_BASE}/stars/${starId}/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${STATE.user?.token}`
                },
                body: JSON.stringify({ type })
            });
            el.style.boxShadow = `0 0 30px 10px rgba(244,143,177,0.8)`;
            setTimeout(() => { el.style.boxShadow = ''; }, 1200);
            await _syncPointsFromServer();
            UI.updateHUD();
        } catch { }
    }

    /* ---- LOAD STARS FROM SERVER ---- */
    async function loadStars() {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/stars`, {
                headers: { 'Authorization': `Bearer ${STATE.user?.token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const list = await res.json();

            domStars.forEach(s => { if (s.el && s.el.parentNode) s.el.remove(); });
            domStars = [];

            list.forEach(s => {
                if (s.x == null) s.x = 5 + Math.random() * 88;
                if (s.y == null) s.y = 5 + Math.random() * 70;
                if (!s.size) s.size = 3 + Math.random() * 5;
                if (!s.opacity) s.opacity = 0.5 + Math.random() * 0.5;
                if (!CONFIG.STAR_TYPES[s.type]) s.type = 'normal';
                const el = _createDomStar(s);
                domStars.push({ el, data: s });
            });
        } catch (err) {
            console.warn('loadStars error, dùng demo stars:', err);
            _addDemoStars();
        }
    }

    function _addDemoStars() {
        domStars.forEach(s => { if (s.el && s.el.parentNode) s.el.remove(); });
        domStars = [];
        const demos = [
            { id: 1, text: 'Hôm nay mình mệt quá, ước gì có ai đó hiểu mình...', type: 'normal', isNegative: true },
            { id: 2, text: 'Vừa đậu đại học! Nhưng cảm thấy áp lực quá 😅', type: 'bright', isNegative: false },
            { id: 3, text: 'Tiếng mưa buổi sáng thật bình yên 🌧️', type: 'shooting', isNegative: false },
            { id: 4, text: 'Muốn được ngủ đủ giấc một lần thôi...', type: 'normal', isNegative: true },
            { id: 5, text: 'Bầu trời đêm nay đẹp không ai ơi 🌙', type: 'bright', isNegative: false },
            { id: 6, text: 'Nhớ nhà quá, xa nhà được 3 tháng rồi', type: 'normal', isNegative: true },
            { id: 7, text: 'Cuối cùng cũng hoàn thành project ✨', type: 'shooting', isNegative: false },
            { id: 8, text: 'Không biết tương lai sẽ như thế nào...', type: 'normal', isNegative: true },
            { id: 9, text: 'Vừa ăn bát bún bò ngon nhất đời 😋', type: 'bright', isNegative: false },
            { id: 10, text: 'Gửi đến những ai đang cô đơn: bạn không một mình đâu 💙', type: 'normal', isNegative: false },
        ];
        demos.forEach(d => {
            const x = 5 + Math.random() * 88;
            const y = 5 + Math.random() * 65;
            const size = 3 + Math.random() * 5;
            const s = { ...d, x, y, size, opacity: 0.6 + Math.random() * 0.4 };
            const el = _createDomStar(s);
            domStars.push({ el, data: s });
        });
    }

    /* ================================================================
       SEND SIGNAL
       ① Tiếng chuông crystal bowl ngay khi nhấn gửi
       ② Câu an ủi pill top-center
       ③ Particle bay lên + tạo ngôi sao
       ================================================================ */
    async function sendSignal(text, type) {
        if (!text.trim()) return;

        // ① Tiếng chuông - phát ngay lập tức
        if (typeof Sound !== 'undefined') Sound.playBell();

        // ② Câu an ủi pill top-center
        if (typeof HealToast !== 'undefined') HealToast.show();

        const validType = CONFIG.STAR_TYPES[type] ? type : 'normal';
        const x = 10 + Math.random() * 78;
        const y = 5 + Math.random() * 60;
        const sizeRange = CONFIG.STAR_TYPES[validType].size;
        const starSize = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
        const hasTrail = STATE.unlocked && !!STATE.unlocked['trail_star'];
        const hasHalo = STATE.unlocked && !!STATE.unlocked['halo_star'];

        // ③ Particle bay lên rồi đặt sao
        _animateSignalFly(x, y, async () => {
            const data = {
                id: null, text, type: validType, x, y, size: starSize, opacity: 0.85,
                isNegative: _isNegative(text), tailEffect: hasTrail, haloEffect: hasHalo
            };
            const id = await _postStar(text, validType, x, y);
            if (id) data.id = id;
            const el = _createDomStar(data);
            domStars.push({ el, data });
            await _syncPointsFromServer();
            UI.updateHUD();
        });
    }

    function _animateSignalFly(targetX, targetY, onDone) {
        const panel = document.getElementById('input-panel');
        if (!panel) { onDone && onDone(); return; }
        const rect = panel.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const particle = document.createElement('div');
        particle.className = 'signal-particle';
        particle.style.cssText = `left:${cx - 4}px; top:${cy - 4}px;`;
        document.body.appendChild(particle);
        setTimeout(() => { particle.remove(); onDone && onDone(); }, 1500);
    }

    async function _postStar(text, type, x, y) {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/stars`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${STATE.user?.token}`
                },
                body: JSON.stringify({ text, type, x, y, nickname: STATE.user?.nickname || 'Ẩn danh' })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return data.id || null;
        } catch (err) {
            console.warn('postStar lỗi (offline mode):', err);
            return null;
        }
    }

    /* ================================================================
       SHOOTING STAR - cố định 60 giây / lần
       ================================================================ */
    function _isShootingStarDone() {
        return !!(STATE.dailyMissions && STATE.dailyMissions['shooting_star_done']);
    }

    function startShootingStarCycle() {
        if (_isShootingStarDone()) return;
        shootingTimer = setTimeout(() => {
            _launchShootingStar();
            shootingTimer = setInterval(() => {
                if (!_isShootingStarDone()) _launchShootingStar();
            }, 60000);
        }, 5000);
    }

    function _launchShootingStar() {
        if (shootingActive || _isShootingStarDone()) return;
        shootingActive = true;

        const screen = document.getElementById('main-screen');
        if (!screen) { shootingActive = false; return; }

        const startTop = 5 + Math.random() * 20;
        const startLeft = 65 + Math.random() * 25;

        const wrapper = document.createElement('div');
        wrapper.className = 'shooting-star-wrapper';
        wrapper.style.cssText = `
            position: fixed;
            top: ${startTop}vh;
            left: ${startLeft}vw;
            width: 0; height: 0;
            pointer-events: none;
            z-index: 500;
            animation: shootingMeteor ${METEOR_DURATION}ms cubic-bezier(0.18, 0.05, 0.42, 1) forwards;
        `;

        const tail = document.createElement('div');
        tail.className = 'shooting-star-tail';

        const glow = document.createElement('div');
        glow.className = 'shooting-star-glow';

        const head = document.createElement('div');
        head.className = 'shooting-star-head';
        head.style.pointerEvents = 'all';
        head.style.cursor = 'pointer';

        wrapper.appendChild(tail);
        wrapper.appendChild(glow);
        wrapper.appendChild(head);
        screen.appendChild(wrapper);

        const hint = document.getElementById('shooting-hint');
        if (hint) hint.classList.remove('hidden');

        let caught = false;

        const catchMeteor = async (e) => {
            e.stopPropagation();
            if (caught) return;
            caught = true;
            shootingActive = false;

            const computed = window.getComputedStyle(wrapper);
            const matrix = new DOMMatrix(computed.transform);
            wrapper.style.animation = 'none';
            wrapper.style.transform = `translate(${matrix.m41}px, ${matrix.m42}px) rotate(-35deg)`;

            if (hint) hint.classList.add('hidden');
            _spawnCatchEffect(wrapper);
            setTimeout(() => wrapper.remove(), 600);

            UI.addPoints(CONFIG.POINTS.SHOOTING_STAR);
            await _pushPointsToServer(CONFIG.POINTS.SHOOTING_STAR);
            Missions.complete('shooting_star');
            UI.showToast(`🌠 Bạn đã bắt được sao băng! +${CONFIG.POINTS.SHOOTING_STAR} ✨`);
            if (typeof Sound !== 'undefined') Sound.playSinewave(880);
            UI.updateHUD();
        };

        head.addEventListener('click', catchMeteor);
        head.addEventListener('touchstart', catchMeteor, { passive: false });

        setTimeout(() => {
            if (!caught) {
                if (wrapper.parentNode) wrapper.remove();
                if (hint) hint.classList.add('hidden');
                shootingActive = false;
            }
        }, METEOR_DURATION + 200);
    }

    function _spawnCatchEffect(wrapper) {
        const rect = wrapper.getBoundingClientRect();
        const cx = rect.left;
        const cy = rect.top;

        const ring = document.createElement('div');
        ring.className = 'points-ring';
        ring.style.cssText = `left:${cx}px; top:${cy}px; transform: translate(-50%,-50%);`;
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 800);

        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const p = document.createElement('div');
                p.className = 'dust-particle';
                const size = 2 + Math.random() * 5;
                const colors = ['#fff', 'var(--accent-gold)', '#c8dcff', '#e8d5ff'];
                p.style.cssText = `
                    width:${size}px; height:${size}px;
                    left:${cx + (-40 + Math.random() * 80)}px;
                    top:${cy + (-20 + Math.random() * 40)}px;
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    --dx:${-120 + Math.random() * 240}px;
                    --dy:${-140 - Math.random() * 100}px;
                `;
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 1400);
            }, i * 40);
        }
    }

    /* ---- METEOR RAIN ---- */
    function startMeteorRain() {
        meteorTimer = setInterval(_meteorRain, CONFIG.METEOR_RAIN_INTERVAL + 60000);
    }

    async function _meteorRain() {
        UI.showToast('🌠 Mưa sao băng! Bạn nhận được +30 ✨ may mắn!');
        UI.addPoints(30);
        await _pushPointsToServer(30);
        UI.updateHUD();

        const screen = document.getElementById('main-screen');
        if (!screen) return;
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const m = document.createElement('div');
                m.className = 'meteor-line';
                m.style.cssText = `left:${10 + Math.random() * 80}vw; top:${Math.random() * 40}vh;`;
                screen.appendChild(m);
                setTimeout(() => { if (m.parentNode) m.remove(); }, 1400);
            }, i * 120);
        }
    }

    /* ---- CLOSE POPUP ---- */
    function initPopupClose() {
        const closeBtn = document.getElementById('popup-close');
        const canvas = document.getElementById('star-canvas');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('star-popup').classList.add('hidden');
            });
        }
        if (canvas) {
            canvas.addEventListener('click', e => {
                if (!e.target.closest('.star-popup') && !e.target.classList.contains('star-dot')) {
                    document.getElementById('star-popup').classList.add('hidden');
                }
            });
        }
    }

    return { loadStars, sendSignal, startShootingStarCycle, startMeteorRain, initPopupClose };
})();