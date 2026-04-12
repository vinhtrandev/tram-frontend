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

    /* ---- NEGATIVE KEYWORD CHECK ---- */
    function _isNegative(text) {
        const lower = text.toLowerCase();
        return CONFIG.NEGATIVE_KEYWORDS.some(k => lower.includes(k));
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

        // Mission: read_stars
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
        } catch { /* offline graceful */ }
    }

    /* ---- LOAD STARS FROM SERVER ---- */
    async function loadStars() {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/stars`, {
                headers: { 'Authorization': `Bearer ${STATE.user?.token}` }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const list = await res.json();

            // FIX: Xóa sao cũ trước khi render lại tránh duplicate
            domStars.forEach(s => { if (s.el && s.el.parentNode) s.el.remove(); });
            domStars = [];

            list.forEach(s => {
                // FIX: Dùng == null thay vì !s.x để tránh lỗi khi x = 0
                if (s.x == null || s.x === undefined) s.x = 5 + Math.random() * 88;
                if (s.y == null || s.y === undefined) s.y = 5 + Math.random() * 70;
                if (!s.size) s.size = 3 + Math.random() * 5;
                if (!s.opacity) s.opacity = 0.5 + Math.random() * 0.5;
                // FIX: Đảm bảo type hợp lệ
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
        // FIX: Xóa sao cũ trước khi thêm demo
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

    /* ---- SEND SIGNAL ---- */
    async function sendSignal(text, type) {
        if (!text.trim()) return;

        // FIX: Validate type
        const validType = CONFIG.STAR_TYPES[type] ? type : 'normal';

        const x = 10 + Math.random() * 78;
        const y = 5 + Math.random() * 60;
        const sizeRange = CONFIG.STAR_TYPES[validType].size;
        const starSize = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
        const hasTrail = STATE.unlocked && !!STATE.unlocked['trail_star'];
        const hasHalo = STATE.unlocked && !!STATE.unlocked['halo_star'];

        _animateSignalFly(x, y, async () => {
            const data = {
                id: null, text, type: validType, x, y, size: starSize, opacity: 0.85,
                isNegative: _isNegative(text), tailEffect: hasTrail, haloEffect: hasHalo
            };

            // FIX: Await post và gắn id vào data trước khi push
            const id = await _postStar(text, validType, x, y);
            if (id) data.id = id;

            const el = _createDomStar(data);
            domStars.push({ el, data });

            UI.addPoints(CONFIG.POINTS.SEND_SIGNAL);
            UI.showToast('✨ Tín hiệu của bạn đã được vũ trụ tiếp nhận. Bạn không cô đơn.');
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

        setTimeout(() => {
            particle.remove();
            onDone && onDone();
        }, 1500);
    }

    async function _postStar(text, type, x, y) {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/stars`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${STATE.user?.token}`
                },
                body: JSON.stringify({
                    text, type, x, y,
                    nickname: STATE.user?.nickname || 'Ẩn danh'
                })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return data.id || null;
        } catch (err) {
            console.warn('postStar lỗi (offline mode):', err);
            return null;
        }
    }

    /* ---- SHOOTING STAR EVENT ---- */
    function startShootingStarCycle() {
        // Lần đầu sau 1 phút
        shootingTimer = setTimeout(() => {
            _launchShootingStar();
            // Sau đó mỗi 15 phút
            setInterval(_launchShootingStar, CONFIG.SHOOTING_STAR_INTERVAL);
        }, 60000);
    }

    function _launchShootingStar() {
        if (shootingActive) return;
        shootingActive = true;

        const meteor = document.createElement('div');
        meteor.className = 'meteor-line clickable';
        const startX = 20 + Math.random() * 60;
        meteor.style.cssText = `
      left:${startX}vw; top:${10 + Math.random() * 30}vh;
      transform:rotate(-45deg);
    `;
        const screen = document.getElementById('main-screen');
        if (!screen) { shootingActive = false; return; }
        screen.appendChild(meteor);

        const hint = document.getElementById('shooting-hint');
        if (hint) hint.classList.remove('hidden');

        let caught = false;

        meteor.addEventListener('click', () => {
            if (caught) return;
            caught = true;
            shootingActive = false;
            meteor.remove();
            if (hint) hint.classList.add('hidden');
            UI.addPoints(CONFIG.POINTS.SHOOTING_STAR);
            Missions.complete('shooting_star');
            UI.showToast(`🌠 Bạn đã bắt được sao băng! +${CONFIG.POINTS.SHOOTING_STAR} ✨`);
            if (typeof Sound !== 'undefined') Sound.playSinewave(880);
            UI.updateHUD();
        });

        setTimeout(() => {
            if (!caught) {
                if (meteor.parentNode) meteor.remove();
                if (hint) hint.classList.add('hidden');
                shootingActive = false;
            }
        }, 3000);
    }

    /* ---- METEOR RAIN ---- */
    function startMeteorRain() {
        meteorTimer = setInterval(_meteorRain, CONFIG.METEOR_RAIN_INTERVAL + 60000);
    }

    function _meteorRain() {
        UI.showToast('🌠 Mưa sao băng! Bạn nhận được +30 ✨ may mắn!');
        UI.addPoints(30);
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