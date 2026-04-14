/* ================================================
   TRẠM GỬI TÍN HIỆU - stars.js  [OPTIMISED]
   + Hiện tên mình / Ẩn danh cho người khác
   + Lưu createdAt đúng lúc gửi → hiện giờ gửi

   Fixes:
   - startShootingStarCycle: bỏ setTimeout lồng setInterval
     → dùng setInterval thuần, clear đúng cách
   - Fly canvas: tạo 1 lần, reuse, không leak
   - _showLabel throttle: dùng requestAnimationFrame
   - _meteorRain: không tạo canvas mới, dùng DOM div
   - domStars cleanup đúng khi remove
   ================================================ */

const Stars = (() => {

    const container = () => document.getElementById('main-screen');
    let domStars = [];
    let shootingActive = false;
    let _shootingInterval = null;
    let _meteorInterval = null;

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

    /* ================================================================
       CREATE DOM STAR
       ================================================================ */
    function _createDomStar(data) {
        const wrapper = document.createElement('div');
        wrapper.className = 'star-wrapper';
        wrapper.style.cssText = `
            position: absolute;
            left: ${data.x}%;
            top: ${data.y}%;
            width: 0; height: 0;
            overflow: visible;
        `;

        const el = document.createElement('div');
        el.className = `star-dot type-${data.type}`;

        if (data.type === 'north') {
            const s = data.size || 7;
            el.style.cssText = `
                position: absolute;
                transform: translate(-50%, -50%);
                width: ${s}px; height: ${s}px;
                opacity: ${data.opacity || 0.9};
                background: #fff8c2;
                clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%,
                                   50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
                box-shadow: 0 0 ${s * 3}px ${s}px rgba(255,248,194,0.7);
                animation: twinkle ${2 + Math.random() * 3}s ease-in-out infinite,
                           northPulse 3s ease-in-out infinite;
                animation-delay: ${Math.random() * 4}s;
            `;
        } else if (data.type === 'cluster') {
            el.style.cssText = `
                position: absolute;
                transform: translate(-50%, -50%);
                width: 24px; height: 8px;
                opacity: ${data.opacity || 0.85};
                background: transparent;
                animation: twinkle ${3 + Math.random() * 3}s ease-in-out infinite;
                animation-delay: ${Math.random() * 4}s;
            `;
            [-8, 0, 8].forEach((offset, i) => {
                const sub = document.createElement('span');
                const subSize = i === 1 ? 5 : 3.5;
                sub.style.cssText = `
                    position: absolute;
                    width: ${subSize}px; height: ${subSize}px;
                    border-radius: 50%;
                    background: rgba(212,184,255,${i === 1 ? 0.95 : 0.65});
                    box-shadow: 0 0 6px rgba(156,125,255,0.6);
                    top: 50%; left: 50%;
                    transform: translate(calc(-50% + ${offset}px), -50%);
                `;
                el.appendChild(sub);
            });
        } else {
            const s = data.size || 4;
            el.style.cssText = `
                position: absolute;
                transform: translate(-50%, -50%);
                width: ${s}px; height: ${s}px;
                border-radius: 50%;
                opacity: ${data.opacity || 0.85};
                background: #a8d8ff;
                box-shadow: 0 0 ${s * 2}px ${s}px rgba(168,216,255,0.55),
                            -${s * 6}px 0 ${s * 2}px rgba(168,216,255,0.25);
                animation: twinkle ${3 + Math.random() * 4}s ease-in-out infinite;
                animation-delay: ${Math.random() * 4}s;
            `;
        }

        if (data.isNegative) el.classList.add('has-react');

        const badge = document.createElement('div');
        badge.className = 'star-react-badge';
        badge.style.display = 'none';

        wrapper.appendChild(el);
        wrapper.appendChild(badge);

        el.addEventListener('click', () => _showPopup(el, data, badge));
        el.addEventListener('mouseenter', () => _scheduleLabel(el, data));
        el.addEventListener('mouseleave', _cancelLabel);

        container().appendChild(wrapper);
        data._badge = badge;
        data._el = el;

        // TTL auto-remove
        const typeConf = CONFIG.STAR_TYPES[data.type];
        if (typeConf?.ttl && !typeConf.permanent) {
            setTimeout(() => {
                wrapper.style.transition = 'opacity 1.5s ease';
                wrapper.style.opacity = '0';
                setTimeout(() => {
                    wrapper.remove();
                    const idx = domStars.findIndex(s => s.el === wrapper);
                    if (idx !== -1) domStars.splice(idx, 1);
                }, 1500);
            }, typeConf.ttl);
        }

        return wrapper;
    }

    /* ---- REACT BADGE ---- */
    function _formatReactBadge(data) {
        const r = data.reactions || {};
        const parts = [];
        if (r.listen) parts.push(`🕯️ ${r.listen}`);
        if (r.hug) parts.push(`❤️ ${r.hug}`);
        if (r.strong) parts.push(`⚡ ${r.strong}`);
        return parts.join('  ');
    }

    function _updateBadge(data) {
        if (!data._badge) return;
        const total = Object.values(data.reactions || {}).reduce((s, v) => s + v, 0);
        if (total > 0) {
            data._badge.textContent = _formatReactBadge(data);
            data._badge.style.opacity = '1';
        } else {
            data._badge.style.opacity = '0';
        }
    }

    /* ---- LABEL (throttle RAF) ---- */
    let labelEl = null;
    let _labelRaf = null;
    let _labelTarget = null;

    function _scheduleLabel(el, data) {
        _labelTarget = { el, data };
        if (_labelRaf) return;
        _labelRaf = requestAnimationFrame(() => {
            _labelRaf = null;
            if (!_labelTarget) return;
            _showLabel(_labelTarget.el, _labelTarget.data);
        });
    }

    function _cancelLabel() {
        _labelTarget = null;
        if (_labelRaf) { cancelAnimationFrame(_labelRaf); _labelRaf = null; }
        _hideLabel();
    }

    function _showLabel(el, data) {
        _hideLabel();
        labelEl = document.createElement('div');
        labelEl.className = 'star-label';
        labelEl.textContent = data.text.substring(0, 40) + (data.text.length > 40 ? '…' : '');
        const rect = el.getBoundingClientRect();
        labelEl.style.cssText = `
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top - 28}px;
            position: fixed; z-index: 200;
        `;
        document.body.appendChild(labelEl);
    }

    function _hideLabel() {
        if (labelEl) { labelEl.remove(); labelEl = null; }
    }

    /* ---- FORMAT THỜI GIAN ---- */
    function _formatTime(isoString) {
        if (!isoString) return null;
        const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
        if (diff < 60) return 'Vừa xong';
        if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
        return `${Math.floor(diff / 86400)} ngày trước`;
    }

    /* ================================================================
       POPUP
       ================================================================ */
    function _showPopup(el, data, badge) {
        const popup = document.getElementById('star-popup');
        const textEl = document.getElementById('star-popup-text');
        const userEl = document.getElementById('popup-username');
        const timeEl = document.getElementById('popup-time');
        const moodTag = document.getElementById('popup-mood-tag');
        const cntListen = document.getElementById('count-listen');
        const cntHug = document.getElementById('count-hug');
        const cntStrong = document.getElementById('count-strong');
        if (!popup || !textEl) return;

        textEl.textContent = data.text || '';

        if (userEl) {
            const myNickname = STATE.user?.nickname || STATE.user?.username;
            const myId = STATE.user?.id;
            const isOwn =
                (myId && data.userId && String(data.userId) === String(myId)) ||
                (myNickname && data.nickname && data.nickname !== 'Ẩn danh'
                    && data.nickname === myNickname);
            userEl.textContent = isOwn ? `${myNickname} ✦` : 'Ẩn danh ✦';
        }

        if (timeEl) {
            const timeStr = _formatTime(data.createdAt || data.timestamp);
            timeEl.textContent = timeStr || '';
            timeEl.style.display = timeStr ? '' : 'none';
        }

        if (moodTag) moodTag.classList.toggle('hidden', !data.isMoodPost);

        const r = data.reactions || {};
        if (cntListen) { cntListen.textContent = `🕯️ ${r.listen || 0}`; cntListen.classList.toggle('has-reacts', (r.listen || 0) > 0); }
        if (cntHug) { cntHug.textContent = `❤️ ${r.hug || 0}`; cntHug.classList.toggle('has-reacts', (r.hug || 0) > 0); }
        if (cntStrong) { cntStrong.textContent = `⚡ ${r.strong || 0}`; cntStrong.classList.toggle('has-reacts', (r.strong || 0) > 0); }

        popup.querySelectorAll('.react-btn').forEach(btn => btn.classList.remove('reacted', 'just-reacted'));

        _positionPopup(popup, el);
        popup.classList.remove('hidden');

        popup._currentStar = data;
        popup._currentEl = el;

        _bindReactButtons(popup);

        STATE.starsRead = (parseInt(STATE.starsRead) || 0) + 1;
        Missions.progress('read_stars', STATE.starsRead);
    }

    function _positionPopup(popup, triggerEl) {
        popup.style.left = '-9999px';
        popup.style.top = '-9999px';
        popup.classList.remove('hidden');

        const rect = triggerEl.getBoundingClientRect();
        const pw = popup.offsetWidth || 300;
        const ph = popup.offsetHeight || 280;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 16;

        let left = rect.left + rect.width / 2 - pw / 2;
        let top = rect.top - ph - 16;
        if (top < 70) top = rect.bottom + 12;
        left = Math.max(margin, Math.min(left, vw - pw - margin));
        top = Math.min(top, vh - ph - margin);

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.classList.add('hidden');
    }

    function _bindReactButtons(popup) {
        popup.querySelectorAll('.react-btn').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', async () => {
                const data = popup._currentStar;
                const el = popup._currentEl;
                if (!data) return;

                const reaction = newBtn.dataset.reaction;
                const wasReacted = newBtn.classList.contains('reacted');
                newBtn.classList.toggle('reacted', !wasReacted);
                newBtn.classList.add('just-reacted');
                setTimeout(() => newBtn.classList.remove('just-reacted'), 450);

                if (!data.reactions) data.reactions = {};
                const delta = wasReacted ? -1 : 1;
                data.reactions[reaction] = Math.max(0, (data.reactions[reaction] || 0) + delta);

                const emojiMap = { listen: '🕯️', hug: '❤️', strong: '⚡' };
                const countIdMap = { listen: 'count-listen', hug: 'count-hug', strong: 'count-strong' };
                const countEl = document.getElementById(countIdMap[reaction]);
                if (countEl) {
                    countEl.textContent = `${emojiMap[reaction]} ${data.reactions[reaction]}`;
                    countEl.classList.toggle('has-reacts', data.reactions[reaction] > 0);
                }

                _updateBadge(data);

                if (el) {
                    el.style.boxShadow = '0 0 30px 10px rgba(244,143,177,0.8)';
                    setTimeout(() => { el.style.boxShadow = ''; }, 1200);
                }

                await _sendReaction(data.id, reaction);

                if (data.isNegative) Missions.progress('light_hope', 1);

                const labels = { listen: 'Lắng nghe 🕯️', hug: 'Cái ôm ❤️', strong: 'Mạnh mẽ ⚡' };
                UI.showToast(`Đã gửi: ${labels[reaction] || '💫'}`);

                setTimeout(() => popup.classList.add('hidden'), 800);
            });
        });
    }

    async function _sendReaction(starId, type) {
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
            await _syncPointsFromServer();
            UI.updateHUD();
        } catch { }
    }

    /* ================================================================
       LOAD STARS FROM SERVER
       ================================================================ */
    async function loadStars() {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/stars`, {
                headers: { 'Authorization': `Bearer ${STATE.user?.token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const list = await res.json();

            // Dọn DOM cũ
            domStars.forEach(s => { if (s.el?.parentNode) s.el.remove(); });
            domStars = [];

            list.forEach(s => {
                if (s.x == null) s.x = 5 + Math.random() * 88;
                if (s.y == null) s.y = 5 + Math.random() * 70;
                if (!s.size) s.size = 3 + Math.random() * 5;
                if (!s.opacity) s.opacity = 0.5 + Math.random() * 0.5;
                if (!CONFIG.STAR_TYPES[s.type]) s.type = 'shooting';
                s.reactions = { listen: s.listenCount || 0, hug: s.hugCount || 0, strong: s.strongCount || 0 };
                s.isMoodPost = s.isMoodPost || false;
                const el = _createDomStar(s);
                domStars.push({ el, data: s });
            });
        } catch (err) {
            console.warn('loadStars error, dùng demo stars:', err);
            if (domStars.length === 0) _addDemoStars();
        }
    }

    function _addDemoStars() {
        domStars.forEach(s => { if (s.el?.parentNode) s.el.remove(); });
        domStars = [];
        const demos = [
            { id: 1, text: 'Hôm nay mình mệt quá, ước gì có ai đó hiểu mình...', type: 'shooting', isNegative: true, isMoodPost: true, reactions: { listen: 3, hug: 1, strong: 0 }, createdAt: new Date(Date.now() - 3600000).toISOString() },
            { id: 2, text: 'Vừa đậu đại học! Nhưng cảm thấy áp lực quá 😅', type: 'north', isNegative: false, isMoodPost: false, reactions: { listen: 0, hug: 0, strong: 2 }, createdAt: new Date(Date.now() - 7200000).toISOString() },
            { id: 3, text: 'Tiếng mưa buổi sáng thật bình yên 🌧️', type: 'cluster', isNegative: false, isMoodPost: false, reactions: {}, createdAt: new Date(Date.now() - 600000).toISOString() },
            { id: 4, text: 'Muốn được ngủ đủ giấc một lần thôi...', type: 'shooting', isNegative: true, isMoodPost: true, reactions: { listen: 0, hug: 5, strong: 0 }, createdAt: new Date(Date.now() - 86400000).toISOString() },
            { id: 5, text: 'Bầu trời đêm nay đẹp không ai ơi 🌙', type: 'north', isNegative: false, isMoodPost: false, reactions: {}, createdAt: new Date(Date.now() - 1800000).toISOString() },
            { id: 6, text: 'Nhớ nhà quá, xa nhà được 3 tháng rồi', type: 'cluster', isNegative: true, isMoodPost: true, reactions: { listen: 2, hug: 4, strong: 0 }, createdAt: new Date(Date.now() - 43200000).toISOString() },
            { id: 7, text: 'Cuối cùng cũng hoàn thành project ✨', type: 'shooting', isNegative: false, isMoodPost: false, reactions: { listen: 0, hug: 0, strong: 7 }, createdAt: new Date(Date.now() - 900000).toISOString() },
            { id: 8, text: 'Không biết tương lai sẽ như thế nào...', type: 'cluster', isNegative: true, isMoodPost: true, reactions: { listen: 1, hug: 0, strong: 0 }, createdAt: new Date(Date.now() - 120000).toISOString() },
            { id: 9, text: 'Vừa ăn bát bún bò ngon nhất đời 😋', type: 'north', isNegative: false, isMoodPost: false, reactions: {}, createdAt: new Date(Date.now() - 300000).toISOString() },
            { id: 10, text: 'Gửi đến những ai đang cô đơn: bạn không một mình đâu 💙', type: 'north', isNegative: false, isMoodPost: false, reactions: { listen: 3, hug: 12, strong: 0 }, createdAt: new Date(Date.now() - 172800000).toISOString() },
        ];
        demos.forEach(d => {
            const s = {
                ...d, x: 5 + Math.random() * 88, y: 5 + Math.random() * 65,
                size: 3 + Math.random() * 5, opacity: 0.6 + Math.random() * 0.4
            };
            const el = _createDomStar(s);
            domStars.push({ el, data: s });
        });
    }

    /* ================================================================
       FLY ANIMATIONS — dùng 1 canvas cố định, không tạo mới mỗi lần
       ================================================================ */
    let _flyCanvas = null;
    let _flyCtx = null;

    function _getFlyCanvas() {
        if (!_flyCanvas) {
            _flyCanvas = document.createElement('canvas');
            _flyCanvas.style.cssText = `
                position: fixed; top: 0; left: 0;
                width: 100%; height: 100%;
                pointer-events: none; z-index: 500;
            `;
            document.body.appendChild(_flyCanvas);
        }
        const W = window.innerWidth, H = window.innerHeight;
        _flyCanvas.width = W;
        _flyCanvas.height = H;
        _flyCtx = _flyCanvas.getContext('2d');
        _flyCtx.clearRect(0, 0, W, H);
        return { cv: _flyCanvas, ctx: _flyCtx, W, H };
    }

    function _flyShootingStar(sx, sy, tx, ty, onDone) {
        const { ctx, W, H } = _getFlyCanvas();
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(dist / 3.8);
        let step = 0;
        const trail = [];

        function frame() {
            ctx.clearRect(0, 0, W, H);
            const progress = step / steps;
            const x = sx + dx * progress, y = sy + dy * progress;

            trail.push({ x, y });
            if (trail.length > 28) trail.shift();

            trail.forEach((pt, i) => {
                ctx.fillStyle = `rgba(168,216,255,${(i / trail.length) * 0.65})`;
                ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2); ctx.fill();
            });

            for (let k = 0; k < 3; k++) {
                ctx.fillStyle = 'rgba(168,216,255,0.4)';
                ctx.beginPath();
                ctx.arc(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 8,
                    Math.random() * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            const rg = ctx.createRadialGradient(x, y, 0, x, y, 9);
            rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.5, '#a8d8ff'); rg.addColorStop(1, 'rgba(168,216,255,0)');
            ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();

            step++;
            if (step <= steps) { requestAnimationFrame(frame); return; }

            let alpha = 1;
            (function fade() {
                ctx.clearRect(0, 0, W, H);
                alpha -= 0.08;
                ctx.globalAlpha = Math.max(0, alpha);
                const rg2 = ctx.createRadialGradient(tx, ty, 0, tx, ty, 14);
                rg2.addColorStop(0, '#fff'); rg2.addColorStop(1, 'rgba(168,216,255,0)');
                ctx.fillStyle = rg2; ctx.beginPath(); ctx.arc(tx, ty, 14, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                if (alpha > 0) requestAnimationFrame(fade);
                else { ctx.clearRect(0, 0, W, H); onDone?.(); }
            })();
        }
        requestAnimationFrame(frame);
    }

    function _flyNorthStar(sx, sy, tx, ty, onDone) {
        const { ctx, W, H } = _getFlyCanvas();
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(dist / 1.1);
        let step = 0, t = 0;

        function frame() {
            ctx.clearRect(0, 0, W, H);
            const progress = step / steps;
            const x = sx + dx * progress, y = sy + dy * progress;
            const pulse = 1 + 0.12 * Math.sin(t * 0.08);
            t++;

            const og = ctx.createRadialGradient(x, y, 0, x, y, 22 * pulse);
            og.addColorStop(0, 'rgba(255,248,194,0.5)'); og.addColorStop(1, 'rgba(255,248,194,0)');
            ctx.fillStyle = og; ctx.beginPath(); ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2); ctx.fill();

            const r1 = 11 * pulse, r2 = 3.5;
            ctx.fillStyle = '#fff8c2';
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = (i * Math.PI / 2) - Math.PI / 2;
                const a2 = a + Math.PI / 4;
                if (i === 0) ctx.moveTo(x + r1 * Math.cos(a), y + r1 * Math.sin(a));
                else ctx.lineTo(x + r1 * Math.cos(a), y + r1 * Math.sin(a));
                ctx.lineTo(x + r2 * Math.cos(a2), y + r2 * Math.sin(a2));
            }
            ctx.closePath(); ctx.fill();

            step++;
            if (step <= steps) { requestAnimationFrame(frame); return; }

            let alpha = 1.2;
            (function burst() {
                ctx.clearRect(0, 0, W, H);
                alpha -= 0.055;
                if (alpha <= 0) { ctx.clearRect(0, 0, W, H); onDone?.(); return; }
                ctx.globalAlpha = Math.min(1, alpha);
                const spread = (1.2 - alpha) * 28;
                const gr = ctx.createRadialGradient(tx, ty, 0, tx, ty, spread);
                gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, 'rgba(255,248,194,0.7)'); gr.addColorStop(1, 'rgba(255,248,194,0)');
                ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(tx, ty, spread, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                requestAnimationFrame(burst);
            })();
        }
        requestAnimationFrame(frame);
    }

    function _flyClusterStar(sx, sy, tx, ty, onDone) {
        const { ctx, W, H } = _getFlyCanvas();
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(dist / 2.2);
        let step = 0;

        const OFFSETS = [0, -22, -44];
        const SIZES = [6, 4.5, 3.5];
        const ALPHAS = [0.95, 0.7, 0.5];

        function frame() {
            ctx.clearRect(0, 0, W, H);
            const progress = step / steps;
            const baseX = sx + dx * progress, baseY = sy + dy * progress;
            const len = dist || 1;
            const ux = dx / len, uy = dy / len;

            OFFSETS.forEach((off, i) => {
                const px = baseX + ux * off, py = baseY + uy * off;
                const r = SIZES[i], alpha = ALPHAS[i];

                const rg = ctx.createRadialGradient(px, py, 0, px, py, r * 2.8);
                rg.addColorStop(0, `rgba(212,184,255,${alpha})`); rg.addColorStop(1, 'rgba(156,125,255,0)');
                ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, r * 2.8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(212,184,255,${alpha})`;
                ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();

                for (let k = 0; k < 3; k++) {
                    const angle = (k / 3) * Math.PI * 2 + step * 0.04;
                    ctx.fillStyle = `rgba(212,184,255,${alpha * 0.45})`;
                    ctx.beginPath();
                    ctx.arc(px + r * 1.8 * Math.cos(angle), py + r * 1.8 * Math.sin(angle),
                        r * 0.35, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            ctx.strokeStyle = 'rgba(156,125,255,0.25)';
            ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.lineTo(baseX + ux * OFFSETS[2], baseY + uy * OFFSETS[2]);
            ctx.stroke(); ctx.setLineDash([]);

            step++;
            if (step <= steps) { requestAnimationFrame(frame); return; }

            let alpha2 = 1;
            (function disperse() {
                ctx.clearRect(0, 0, W, H);
                alpha2 -= 0.065;
                if (alpha2 <= 0) { ctx.clearRect(0, 0, W, H); onDone?.(); return; }
                ctx.globalAlpha = alpha2;
                const spread = (1 - alpha2) * 20;
                [[0, -spread], [-spread, spread * 0.8], [spread, spread * 0.8]].forEach(([ox, oy]) => {
                    const rg2 = ctx.createRadialGradient(tx + ox, ty + oy, 0, tx + ox, ty + oy, 10);
                    rg2.addColorStop(0, 'rgba(212,184,255,0.8)'); rg2.addColorStop(1, 'rgba(156,125,255,0)');
                    ctx.fillStyle = rg2; ctx.beginPath(); ctx.arc(tx + ox, ty + oy, 10, 0, Math.PI * 2); ctx.fill();
                });
                ctx.globalAlpha = 1;
                requestAnimationFrame(disperse);
            })();
        }
        requestAnimationFrame(frame);
    }

    /* ================================================================
       SEND SIGNAL
       ================================================================ */
    async function sendSignal(text, type, showHeal = true, isMoodPost = false) {
        if (!text?.trim()) return;

        if (typeof Sound !== 'undefined') Sound.playBell();
        if (showHeal && typeof HealToast !== 'undefined') HealToast.show();

        const validType = CONFIG.STAR_TYPES[type] ? type : 'shooting';

        const W = window.innerWidth;
        const H = window.innerHeight;
        const SAFE_TOP = 74;
        const SAFE_BOTTOM = H * 0.5 - 120;
        const SAFE_LEFT = W * 0.05;
        const SAFE_RIGHT = W * 0.94;

        const flyTargetX = SAFE_LEFT + Math.random() * (SAFE_RIGHT - SAFE_LEFT);
        const flyTargetY = SAFE_TOP + Math.random() * (SAFE_BOTTOM - SAFE_TOP);

        const mainScreen = document.getElementById('main-screen');
        const screenW = mainScreen?.offsetWidth || W;
        const screenH = mainScreen?.offsetHeight || H;
        const mainRect = mainScreen?.getBoundingClientRect() || { left: 0, top: 0 };

        const xPct = ((flyTargetX - mainRect.left) / screenW) * 100;
        const yPct = ((flyTargetY - mainRect.top) / screenH) * 100;

        const sizeRange = CONFIG.STAR_TYPES[validType].size;
        const starSize = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);

        const sendBtn = document.getElementById('btn-send');
        const btnRect = sendBtn?.getBoundingClientRect();
        const startX = btnRect ? btnRect.left + btnRect.width / 2 : W / 2;
        const startY = btnRect ? btnRect.top : H * 0.65;

        const flyFn = validType === 'north' ? _flyNorthStar
            : validType === 'cluster' ? _flyClusterStar
                : _flyShootingStar;

        const sentAt = new Date().toISOString();

        flyFn(startX, startY, flyTargetX, flyTargetY, async () => {
            const data = {
                id: null, text, type: validType, x: xPct, y: yPct,
                size: starSize, opacity: 0.85,
                isNegative: _isNegative(text), isMoodPost,
                createdAt: sentAt,
                reactions: { listen: 0, hug: 0, strong: 0 },
                nickname: STATE.user?.nickname || STATE.user?.username || '',
                userId: STATE.user?.id || null
            };

            const el = _createDomStar(data);
            domStars.push({ el, data });

            el.style.opacity = '0';
            el.style.transition = 'opacity 0.6s ease';
            requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));

            const id = await _postStar(text, validType, xPct, yPct, isMoodPost, sentAt);
            if (id) data.id = id;

            await _syncPointsFromServer();
            UI.updateHUD();
        });
    }

    async function _postStar(text, type, x, y, isMoodPost = false, createdAt = null) {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/stars`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${STATE.user?.token}`
                },
                body: JSON.stringify({
                    text, type, x, y, isMoodPost,
                    createdAt: createdAt || new Date().toISOString(),
                    nickname: STATE.user?.nickname || STATE.user?.username || 'Ẩn danh'
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

    /* ================================================================
       SHOOTING STAR — dùng setInterval thuần, không lồng setTimeout
       ================================================================ */
    function _isShootingStarDone() {
        return !!(STATE.dailyMissions?.['shooting_star_done']);
    }

    function startShootingStarCycle() {
        if (_shootingInterval) { clearInterval(_shootingInterval); _shootingInterval = null; }
        if (_isShootingStarDone()) return;

        // Bắn lần đầu sau 5s, sau đó mỗi 60s
        let firstShot = setTimeout(() => {
            if (!_isShootingStarDone()) _launchShootingStar();
            _shootingInterval = setInterval(() => {
                if (_isShootingStarDone()) {
                    clearInterval(_shootingInterval);
                    _shootingInterval = null;
                } else {
                    _launchShootingStar();
                }
            }, 60000);
        }, 5000);

        // Cleanup nếu done trước khi firstShot
        const _checkDone = setInterval(() => {
            if (_isShootingStarDone()) {
                clearTimeout(firstShot);
                clearInterval(_checkDone);
            }
        }, 1000);
    }

    function _launchShootingStar() {
        if (shootingActive) return;
        shootingActive = true;

        const screen = document.getElementById('main-screen');
        if (!screen) { shootingActive = false; return; }

        const startTop = 5 + Math.random() * 20;
        const startLeft = 65 + Math.random() * 25;

        const wrapper = document.createElement('div');
        wrapper.className = 'shooting-star-wrapper';
        wrapper.style.cssText = `
            position: fixed;
            top: ${startTop}vh; left: ${startLeft}vw;
            width: 0; height: 0;
            pointer-events: none; z-index: 500;
            animation: shootingMeteor ${METEOR_DURATION}ms cubic-bezier(0.18, 0.05, 0.42, 1) forwards;
        `;

        const tail = document.createElement('div'); tail.className = 'shooting-star-tail';
        const glow = document.createElement('div'); glow.className = 'shooting-star-glow';
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

            const matrix = new DOMMatrix(window.getComputedStyle(wrapper).transform);
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
            document.dispatchEvent(new CustomEvent('shootingstar:caught'));
        };

        head.addEventListener('click', catchMeteor);
        head.addEventListener('touchstart', catchMeteor, { passive: false });

        setTimeout(() => {
            if (!caught) {
                wrapper.remove();
                if (hint) hint.classList.add('hidden');
                shootingActive = false;
            }
        }, METEOR_DURATION + 200);
    }

    function _spawnCatchEffect(wrapper) {
        const rect = wrapper.getBoundingClientRect();
        const cx = rect.left, cy = rect.top;

        const ring = document.createElement('div');
        ring.className = 'points-ring';
        ring.style.cssText = `left:${cx}px; top:${cy}px; transform:translate(-50%,-50%);`;
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
                    background:${colors[Math.floor(Math.random() * colors.length)]};
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
        if (_meteorInterval) clearInterval(_meteorInterval);
        // Offset khác shooting star để không trùng
        _meteorInterval = setInterval(_meteorRain, CONFIG.METEOR_RAIN_INTERVAL + 60000);
    }

    async function _meteorRain() {
        UI.showToast('🌠 Mưa sao băng! Bạn nhận được +30 ✨ may mắn!');
        UI.addPoints(30);
        await _pushPointsToServer(30);
        UI.updateHUD();
        document.dispatchEvent(new CustomEvent('meteorrain:bonus'));

        const screen = document.getElementById('main-screen');
        if (!screen) return;

        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const m = document.createElement('div');
                m.className = 'meteor-line';
                m.style.cssText = `left:${10 + Math.random() * 80}vw; top:${Math.random() * 40}vh;`;
                screen.appendChild(m);
                setTimeout(() => m.remove(), 1400);
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

    return {
        loadStars, sendSignal, startShootingStarCycle,
        startMeteorRain, initPopupClose,
        _clearDomStars: () => { domStars = []; }
    };
})();