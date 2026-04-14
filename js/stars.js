/* ================================================
   TRẠM GỬI TÍN HIỆU - stars.js  [OPTIMISED + POLLING v3]
   + Realtime polling: tự động hiện sao người khác gửi
   + Hiện tên mình / Ẩn danh cho người khác
   + Lưu createdAt đúng lúc gửi → hiện giờ gửi
   + v2: Hiệu ứng star-new (< 30s) — ripple, pulse, badge vàng
   + v3: Fly animation cho sao polling + nổi bật hơn
   + v4: Lọc toxic / crisis keywords
   + v5: Fix toxic block hoàn chỉnh — null-safe guards,
         TOXIC_PHRASES support, return false khi bị chặn
   ================================================ */

const Stars = (() => {

    const container = () => document.getElementById('main-screen');
    let domStars = [];
    let shootingActive = false;
    let _shootingInterval = null;
    let _meteorInterval = null;
    let _pollingInterval = null;

    const METEOR_DURATION = 8000;
    const NEW_STAR_MS = 30_000;

    /* ================================================================
       KEYWORD CHECKS
       ================================================================ */

    function _isNegative(text) {
        if (!CONFIG.NEGATIVE_KEYWORDS?.length) return false;
        const lower = text.toLowerCase();
        return CONFIG.NEGATIVE_KEYWORDS.some(k => lower.includes(k));
    }

    function _isCrisis(text) {
        if (!CONFIG.CRISIS_KEYWORDS?.length) return false;
        const lower = text.toLowerCase();
        return CONFIG.CRISIS_KEYWORDS.some(k => lower.includes(k));
    }

    function _isToxic(text) {
        if (!text) return false;
        const lower = text.toLowerCase();

        // Check từ đơn tuyệt đối
        if (CONFIG.TOXIC_KEYWORDS?.length) {
            if (CONFIG.TOXIC_KEYWORDS.some(k => lower.includes(k))) return true;
        }

        // Check cụm từ (tránh chặn sai 'mày'/'tao' đứng một mình)
        if (CONFIG.TOXIC_PHRASES?.length) {
            if (CONFIG.TOXIC_PHRASES.some(p => lower.includes(p))) return true;
        }

        return false;
    }

    /* ================================================================
       SYNC / PUSH POINTS
       ================================================================ */

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
        if (data.isOwn) el.classList.add('star-own');

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

        // ── HIỆU ỨNG SAO MỚI (< 30 giây) ──────────────────────────────
        const ageMs = data.createdAt
            ? Date.now() - new Date(data.createdAt).getTime()
            : NEW_STAR_MS + 1;

        if (ageMs < NEW_STAR_MS) {
            const remaining = NEW_STAR_MS - ageMs;
            el.classList.add('star-new');
            if (ageMs < 5000) {
                el.classList.add('star-badge');
                setTimeout(() => el.classList.remove('star-badge'), 5000 - ageMs);
            }
            setTimeout(() => el.classList.remove('star-new'), remaining);
        }
        // ────────────────────────────────────────────────────────────────

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

    /* ================================================================
       REACT BADGE
       ================================================================ */
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

    /* ================================================================
       LABEL
       ================================================================ */
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

    /* ================================================================
       FORMAT THỜI GIAN
       ================================================================ */
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

    /* ================================================================
       POLLING REALTIME
       ================================================================ */
    function startPolling(intervalMs = 15000) {
        if (_pollingInterval) clearInterval(_pollingInterval);

        _pollingInterval = setInterval(async () => {
            if (!STATE.user?.token || STATE.user.token === 'local') return;
            if (document.hidden) return;

            try {
                const res = await fetch(`${CONFIG.API_BASE}/stars`, {
                    headers: { 'Authorization': `Bearer ${STATE.user.token}` }
                });
                if (!res.ok) return;
                const list = await res.json();

                let newFromOthers = 0;
                const myId = STATE.user?.id;

                list.forEach(s => {
                    const exists = domStars.find(d => d.data.id && s.id && String(d.data.id) === String(s.id));
                    if (exists) return;

                    if (s.x == null) s.x = 5 + Math.random() * 88;
                    if (s.y == null) s.y = 5 + Math.random() * 70;
                    if (!s.size) s.size = 3 + Math.random() * 5;
                    if (!s.opacity) s.opacity = 0.5 + Math.random() * 0.5;
                    if (!CONFIG.STAR_TYPES[s.type]) s.type = 'shooting';
                    s.reactions = { listen: s.listenCount || 0, hug: s.hugCount || 0, strong: s.strongCount || 0 };
                    s.isMoodPost = s.isMoodPost || false;

                    // Giữ slot ngay để polling sau không tạo trùng
                    domStars.push({ el: null, data: s });
                    const entry = domStars[domStars.length - 1];

                    // Tính tọa độ đích thực tế (px)
                    const mainScreen = document.getElementById('main-screen');
                    const mainRect = mainScreen?.getBoundingClientRect() || { left: 0, top: 0 };
                    const screenW = mainScreen?.offsetWidth || window.innerWidth;
                    const screenH = mainScreen?.offsetHeight || window.innerHeight;
                    const destX = mainRect.left + (s.x / 100) * screenW;
                    const destY = mainRect.top + (s.y / 100) * screenH;

                    // Điểm xuất phát — rìa màn hình ngẫu nhiên
                    const W2 = window.innerWidth, H2 = window.innerHeight;
                    const edge = Math.floor(Math.random() * 4);
                    const startX = edge === 0 ? Math.random() * W2
                        : edge === 1 ? W2
                            : edge === 2 ? Math.random() * W2
                                : 0;
                    const startY = edge === 0 ? 0
                        : edge === 1 ? Math.random() * H2
                            : edge === 2 ? H2
                                : Math.random() * H2;

                    const flyFn = s.type === 'north' ? _flyNorthStar
                        : s.type === 'cluster' ? _flyClusterStar
                            : _flyShootingStar;

                    flyFn(startX, startY, destX, destY, () => {
                        const el = _createDomStar(s);
                        entry.el = el;
                        el.style.opacity = '0';
                        el.style.transition = 'opacity 0.5s ease';
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            el.style.opacity = '1';
                        }));
                    });

                    if (s.userId && String(s.userId) !== String(myId)) {
                        newFromOthers++;
                    }
                });

                if (newFromOthers > 0) {
                    UI.showToast(`✨ ${newFromOthers} tín hiệu mới vừa đến vũ trụ`, 3000);
                }

            } catch { /* offline */ }
        }, intervalMs);
    }

    function stopPolling() {
        if (_pollingInterval) {
            clearInterval(_pollingInterval);
            _pollingInterval = null;
        }
    }

    /* ================================================================
       DEMO STARS (fallback offline)
       ================================================================ */
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
            { id: 99, text: 'Tín hiệu vừa gửi lên vũ trụ... 🌟', type: 'shooting', isNegative: false, isMoodPost: false, reactions: {}, createdAt: new Date(Date.now() - 3000).toISOString() },
        ];
        demos.forEach(d => {
            const s = { ...d, x: 5 + Math.random() * 88, y: 5 + Math.random() * 65, size: 3 + Math.random() * 5, opacity: 0.6 + Math.random() * 0.4 };
            const el = _createDomStar(s);
            domStars.push({ el, data: s });
        });
    }

    /* ================================================================
       FLY ANIMATIONS — v3
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

    /* Shockwave tại điểm đích */
    function _shockwave(ctx, W, H, tx, ty, color1, color2) {
        let r = 0, alpha = 1;
        (function ring() {
            ctx.clearRect(0, 0, W, H);
            r += 6;
            alpha -= 0.045;
            if (alpha <= 0) { ctx.clearRect(0, 0, W, H); return; }
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color1;
            ctx.lineWidth = 3 - r * 0.02;
            ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.stroke();
            if (r > 15) {
                ctx.strokeStyle = color2;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = alpha * 0.5;
                ctx.beginPath(); ctx.arc(tx, ty, r * 0.6, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            requestAnimationFrame(ring);
        })();
    }

    /* Spark tóe ra tại điểm đích */
    function _sparks(tx, ty, color, count = 14) {
        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            const angle = (i / count) * Math.PI * 2;
            const speed = 40 + Math.random() * 60;
            const size = 2 + Math.random() * 3;
            el.style.cssText = `
                position: fixed;
                left: ${tx}px; top: ${ty}px;
                width: ${size}px; height: ${size}px;
                border-radius: 50%;
                background: ${color};
                pointer-events: none;
                z-index: 600;
                box-shadow: 0 0 ${size * 2}px ${color};
                transition: transform 0.6s cubic-bezier(0.2,0,0.8,1), opacity 0.6s ease;
                transform: translate(-50%,-50%);
                opacity: 1;
            `;
            document.body.appendChild(el);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.transform = `translate(calc(-50% + ${Math.cos(angle) * speed}px), calc(-50% + ${Math.sin(angle) * speed}px))`;
                el.style.opacity = '0';
            }));
            setTimeout(() => el.remove(), 700);
        }
    }

    function _flyShootingStar(sx, sy, tx, ty, onDone) {
        const { ctx, W, H } = _getFlyCanvas();
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(dist / 5);
        let step = 0;
        const trail = [];

        function frame() {
            ctx.clearRect(0, 0, W, H);
            const progress = step / steps;
            const x = sx + dx * progress, y = sy + dy * progress;

            trail.push({ x, y });
            if (trail.length > 50) trail.shift();

            trail.forEach((pt, i) => {
                const t = i / trail.length;
                ctx.globalAlpha = t * 0.8;
                ctx.fillStyle = 'rgba(180,225,255,1)';
                ctx.beginPath(); ctx.arc(pt.x, pt.y, 1 + t * 3.5, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;

            for (let k = 0; k < 5; k++) {
                const t = Math.random();
                ctx.globalAlpha = Math.random() * 0.5;
                ctx.fillStyle = '#c8eeff';
                ctx.beginPath();
                ctx.arc(
                    sx + dx * t * progress + (Math.random() - 0.5) * 14,
                    sy + dy * t * progress + (Math.random() - 0.5) * 10,
                    Math.random() * 2, 0, Math.PI * 2
                );
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            const headGlow = ctx.createRadialGradient(x, y, 0, x, y, 28);
            headGlow.addColorStop(0, '#ffffff');
            headGlow.addColorStop(0.25, '#a8d8ff');
            headGlow.addColorStop(0.6, 'rgba(100,180,255,0.4)');
            headGlow.addColorStop(1, 'rgba(100,180,255,0)');
            ctx.fillStyle = headGlow;
            ctx.beginPath(); ctx.arc(x, y, 28, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();

            step++;
            if (step <= steps) { requestAnimationFrame(frame); return; }

            _sparks(tx, ty, '#a8d8ff', 16);
            _shockwave(ctx, W, H, tx, ty, 'rgba(168,216,255,0.9)', 'rgba(255,255,255,0.6)');
            setTimeout(() => { ctx.clearRect(0, 0, W, H); onDone?.(); }, 700);
        }
        requestAnimationFrame(frame);
    }

    function _flyNorthStar(sx, sy, tx, ty, onDone) {
        const { ctx, W, H } = _getFlyCanvas();
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(dist / 3.5);
        let step = 0, t = 0;

        function frame() {
            ctx.clearRect(0, 0, W, H);
            const progress = step / steps;
            const x = sx + dx * progress, y = sy + dy * progress;
            const pulse = 1 + 0.18 * Math.sin(t * 0.12);
            t++;

            const aura = ctx.createRadialGradient(x, y, 0, x, y, 42 * pulse);
            aura.addColorStop(0, 'rgba(255,248,194,0.65)');
            aura.addColorStop(0.5, 'rgba(255,220,100,0.2)');
            aura.addColorStop(1, 'rgba(255,248,194,0)');
            ctx.fillStyle = aura;
            ctx.beginPath(); ctx.arc(x, y, 42 * pulse, 0, Math.PI * 2); ctx.fill();

            const r1 = 18 * pulse, r2 = 5;
            ctx.fillStyle = '#fff8c2';
            ctx.shadowColor = '#ffe066';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = (i * Math.PI / 2) - Math.PI / 2;
                const a2 = a + Math.PI / 4;
                if (i === 0) ctx.moveTo(x + r1 * Math.cos(a), y + r1 * Math.sin(a));
                else ctx.lineTo(x + r1 * Math.cos(a), y + r1 * Math.sin(a));
                ctx.lineTo(x + r2 * Math.cos(a2), y + r2 * Math.sin(a2));
            }
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = 'rgba(255,248,194,0.35)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const a = (i * Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(a) * r1 * 1.6, y + Math.sin(a) * r1 * 1.6);
                ctx.stroke();
            }

            step++;
            if (step <= steps) { requestAnimationFrame(frame); return; }

            _sparks(tx, ty, '#ffe066', 20);
            _shockwave(ctx, W, H, tx, ty, 'rgba(255,220,80,0.95)', 'rgba(255,255,200,0.5)');
            setTimeout(() => { ctx.clearRect(0, 0, W, H); onDone?.(); }, 700);
        }
        requestAnimationFrame(frame);
    }

    function _flyClusterStar(sx, sy, tx, ty, onDone) {
        const { ctx, W, H } = _getFlyCanvas();
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(dist / 4);
        let step = 0;

        const baseAngle = Math.atan2(dy, dx);
        const FAN = [
            { offAngle: -0.18, lag: 0, size: 8, alpha: 1.0 },
            { offAngle: 0, lag: 8, size: 6, alpha: 0.85 },
            { offAngle: 0.18, lag: 16, size: 5, alpha: 0.65 },
        ];

        function frame() {
            ctx.clearRect(0, 0, W, H);

            FAN.forEach(({ offAngle, lag, size, alpha }) => {
                const s = Math.max(0, step - lag);
                const progress = Math.min(s / steps, 1);
                const angle = baseAngle + offAngle;
                const px = sx + Math.cos(angle) * dist * progress;
                const py = sy + Math.sin(angle) * dist * progress;

                const rg = ctx.createRadialGradient(px, py, 0, px, py, size * 4);
                rg.addColorStop(0, `rgba(212,184,255,${alpha})`);
                rg.addColorStop(1, 'rgba(156,125,255,0)');
                ctx.fillStyle = rg;
                ctx.beginPath(); ctx.arc(px, py, size * 4, 0, Math.PI * 2); ctx.fill();

                ctx.fillStyle = `rgba(230,210,255,${alpha})`;
                ctx.shadowColor = '#d4b8ff';
                ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;

                for (let k = 1; k <= 4; k++) {
                    const tp = Math.max(0, (s - k * 3) / steps);
                    const tx2 = sx + Math.cos(angle) * dist * tp;
                    const ty2 = sy + Math.sin(angle) * dist * tp;
                    ctx.globalAlpha = alpha * (1 - k / 5) * 0.6;
                    ctx.fillStyle = '#c8a8ff';
                    ctx.beginPath(); ctx.arc(tx2, ty2, size * (1 - k * 0.18), 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = 1;
            });

            step++;
            if (step <= steps + 16) { requestAnimationFrame(frame); return; }

            _sparks(tx, ty, '#d4b8ff', 18);
            _shockwave(ctx, W, H, tx, ty, 'rgba(200,160,255,0.9)', 'rgba(180,130,255,0.5)');
            setTimeout(() => { ctx.clearRect(0, 0, W, H); onDone?.(); }, 700);
        }
        requestAnimationFrame(frame);
    }

    /* ================================================================
       SEND SIGNAL
       ================================================================ */
    async function sendSignal(text, type, showHeal = true, isMoodPost = false) {
        if (!text?.trim()) return false;

        // ── CHẶN TOXIC — dừng hoàn toàn, không bay, không cộng điểm ──
        if (_isToxic(text)) {
            UI.showToast('💫 Trạm là không gian bình yên — hãy gửi điều nhẹ nhàng hơn nhé', 4000);
            return false;
        }

        // ── CẢNH BÁO CRISIS — vẫn cho gửi, chỉ hiện hotline ──
        if (_isCrisis(text)) {
            UI.showToast('💙 Bạn không đơn độc. Đường dây hỗ trợ miễn phí: 1800 599 920', 7000);
        }

        // ── TỪ ĐÂY XUỐNG: CHỈ CHẠY KHI TEXT HỢP LỆ ──
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
        const baseSize = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
        const starSize = baseSize * 2.2;

        const sendBtn = document.getElementById('btn-send');
        const btnRect = sendBtn?.getBoundingClientRect();
        const startX = btnRect ? btnRect.left + btnRect.width / 2 : W / 2;
        const startY = btnRect ? btnRect.top : H * 0.65;

        const flyFn = validType === 'north' ? _flyNorthStar
            : validType === 'cluster' ? _flyClusterStar
                : _flyShootingStar;

        const sentAt = new Date().toISOString();

        // SAO CHỈ BAY → TẠO → POST → CỘNG ĐIỂM SAU KHI FLY XONG
        flyFn(startX, startY, flyTargetX, flyTargetY, async () => {
            const data = {
                id: null, text, type: validType, x: xPct, y: yPct,
                size: starSize, opacity: 0.95,
                isNegative: _isNegative(text), isMoodPost,
                createdAt: sentAt,
                reactions: { listen: 0, hug: 0, strong: 0 },
                nickname: STATE.user?.nickname || STATE.user?.username || '',
                userId: STATE.user?.id || null,
                isOwn: true
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

        return true;
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
       SHOOTING STAR
       ================================================================ */
    function _isShootingStarDone() {
        return !!(STATE.dailyMissions?.['shooting_star_done']);
    }

    function startShootingStarCycle() {
        if (_shootingInterval) { clearInterval(_shootingInterval); _shootingInterval = null; }
        if (_isShootingStarDone()) return;

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

    /* ================================================================
       METEOR RAIN
       ================================================================ */
    function startMeteorRain() {
        if (_meteorInterval) clearInterval(_meteorInterval);
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

    /* ================================================================
       CLOSE POPUP
       ================================================================ */
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

    /* ================================================================
       PUBLIC API
       ================================================================ */
    return {
        loadStars,
        sendSignal,
        startShootingStarCycle,
        startMeteorRain,
        initPopupClose,
        startPolling,
        stopPolling,
        _clearDomStars: () => { domStars = []; }
    };

})();