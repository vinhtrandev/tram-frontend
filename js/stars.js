/* ================================================
   TRẠM GỬI TÍN HIỆU - stars.js
   DOM star dots, signal sending, star popup,
   shooting star event, meteor rain
   ================================================ */

const Stars = (() => {

    const container = () => document.getElementById('main-screen');
    let domStars = [];  // { el, data }
    let selectedType = 'normal';
    let shootingActive = false;
    let meteorTimer, shootingTimer;

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
      box-shadow:0 0 ${data.size * 2}px ${data.size}px ${CONFIG.STAR_TYPES[data.type].color}55;
      animation: twinkle ${3 + Math.random() * 4}s ease-in-out infinite;
      animation-delay:${Math.random() * 4}s;
    `;
        if (data.isNegative) el.classList.add('has-react');
        if (data.tailEffect) el.style.boxShadow += `, -${data.size * 8}px 0 ${data.size * 2}px ${CONFIG.STAR_TYPES[data.type].color}33`;

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
        document.getElementById('star-popup-text').textContent = data.text;

        // Position near star
        const rect = el.getBoundingClientRect();
        const pw = 280, ph = 180;
        let left = rect.left - pw / 2;
        let top = rect.top - ph - 16;
        left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
        top = Math.max(70, top);
        popup.style.cssText = `left:${left}px; top:${top}px; display:block;`;
        popup.classList.remove('hidden');

        // Reaction buttons
        popup.querySelectorAll('.react-btn').forEach(btn => {
            btn.onclick = () => {
                _sendReaction(data.id, btn.dataset.reaction, el);
                popup.classList.add('hidden');
                // Mission: light_hope
                if (data.isNegative) Missions.progress('light_hope', 1);
                UI.showToast('Đã gửi cảm xúc của bạn 💫');
            };
        });

        // Mission: read_stars
        STATE.starsRead = (STATE.starsRead || 0) + 1;
        Missions.progress('read_stars', STATE.starsRead);
    }

    async function _sendReaction(starId, type, el) {
        if (!starId) return;
        try {
            await fetch(`${CONFIG.API_BASE}/stars/${starId}/react`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.user?.token}` },
                body: JSON.stringify({ type })
            });
            // Animate star glow
            el.style.boxShadow = `0 0 30px 10px rgba(244,143,177,0.8)`;
            setTimeout(() => el.style.boxShadow = '', 1200);
        } catch { /* offline graceful */ }
    }

    /* ---- LOAD STARS FROM SERVER ---- */
    async function loadStars() {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/stars`, {
                headers: { 'Authorization': `Bearer ${STATE.user?.token}` }
            });
            const list = await res.json();
            list.forEach(s => {
                if (!s.x) { s.x = 5 + Math.random() * 88; s.y = 5 + Math.random() * 70; }
                if (!s.size) s.size = 3 + Math.random() * 5;
                if (!s.opacity) s.opacity = 0.5 + Math.random() * 0.5;
                const el = _createDomStar(s);
                domStars.push({ el, data: s });
            });
        } catch {
            // Demo stars for offline mode
            _addDemoStars();
        }
    }

    function _addDemoStars() {
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

        const x = 10 + Math.random() * 78;
        const y = 5 + Math.random() * 60;
        const size = CONFIG.STAR_TYPES[type].size;
        const starSize = size[0] + Math.random() * (size[1] - size[0]);
        const hasTrail = STATE.unlocked['trail_star'];
        const hasHalo = STATE.unlocked['halo_star'];

        // Animate: text box → particle → fly → land as star
        _animateSignalFly(x, y, () => {
            const data = {
                id: null, text, type, x, y, size: starSize, opacity: 0.85,
                isNegative: _isNegative(text), tailEffect: hasTrail, haloEffect: hasHalo
            };

            // API call
            _postStar(text, type, x, y).then(id => { if (id) data.id = id; });

            const el = _createDomStar(data);
            domStars.push({ el, data });

            UI.addPoints(CONFIG.POINTS.SEND_SIGNAL);
            UI.showToast('✨ Tín hiệu của bạn đã được vũ trụ tiếp nhận. Bạn không cô đơn.');
        });
    }

    function _animateSignalFly(targetX, targetY, onDone) {
        const panel = document.getElementById('input-panel');
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
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.user?.token}` },
                body: JSON.stringify({ text, type, x, y, nickname: STATE.user?.nickname })
            });
            const data = await res.json();
            return data.id;
        } catch { return null; }
    }

    /* ---- SHOOTING STAR EVENT ---- */
    function startShootingStarCycle() {
        // Immediate first one after 1 min
        shootingTimer = setTimeout(_launchShootingStar, 60000);
        // Then every 15 min
        setInterval(_launchShootingStar, CONFIG.SHOOTING_STAR_INTERVAL);
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
        document.getElementById('main-screen').appendChild(meteor);

        const hint = document.getElementById('shooting-hint');
        hint.classList.remove('hidden');

        let caught = false;
        meteor.addEventListener('click', () => {
            if (caught) return;
            caught = true;
            shootingActive = false;
            meteor.remove(); hint.classList.add('hidden');
            UI.addPoints(CONFIG.POINTS.SHOOTING_STAR);
            Missions.complete('shooting_star');
            UI.showToast(`🌠 Bạn đã bắt được sao băng! +${CONFIG.POINTS.SHOOTING_STAR} ✨`);
            Sound.playSinewave(880);
        });

        // Auto remove after 3s
        setTimeout(() => {
            if (!caught) {
                meteor.remove(); hint.classList.add('hidden');
                shootingActive = false;
            }
        }, 3000);
    }

    /* ---- METEOR RAIN (bonus event every 15 min) ---- */
    function startMeteorRain() {
        setInterval(_meteorRain, CONFIG.METEOR_RAIN_INTERVAL + 60000);
    }

    function _meteorRain() {
        UI.showToast('🌠 Mưa sao băng! Bạn nhận được +30 ✨ may mắn!');
        UI.addPoints(30);
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const m = document.createElement('div');
                m.className = 'meteor-line';
                m.style.cssText = `left:${10 + Math.random() * 80}vw; top:${Math.random() * 40}vh;`;
                document.getElementById('main-screen').appendChild(m);
                setTimeout(() => m.remove(), 1400);
            }, i * 120);
        }
    }

    /* ---- CLOSE POPUP ---- */
    function initPopupClose() {
        document.getElementById('popup-close').addEventListener('click', () => {
            document.getElementById('star-popup').classList.add('hidden');
        });
        document.getElementById('star-canvas').addEventListener('click', e => {
            if (!e.target.closest('.star-popup') && !e.target.classList.contains('star-dot')) {
                document.getElementById('star-popup').classList.add('hidden');
            }
        });
    }

    return { loadStars, sendSignal, startShootingStarCycle, startMeteorRain, initPopupClose };
})();