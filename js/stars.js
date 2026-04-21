/* ================================================
   TRẠM GỬI TÍN HIỆU - stars.js  [v2 - optimised]
   ================================================ */

const Stars = (() => {

    const container = () => document.getElementById('main-screen');
    let domStars = [];       // { el: wrapper, data: {...} }
    let shootingActive = false;
    let _shootingInterval = null;
    let _meteorInterval = null;
    let _pollingController = null;   // AbortController for polling

    const METEOR_DURATION = 8_000;
    const NEW_STAR_MS = 30_000;

    /* ================================================================
       API HELPERS — shared timeout + token
       ================================================================ */
    function _fetch(path, opts = {}, ms = 8000) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), ms);
        return fetch(`${CONFIG.API_BASE}${path}`, {
            ...opts,
            signal: ctrl.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(STATE.user?.token && STATE.user.token !== 'local'
                    ? { 'Authorization': `Bearer ${STATE.user.token}` }
                    : {}),
                ...opts.headers,
            },
        }).finally(() => clearTimeout(tid));
    }

    /* ================================================================
       REACT TRACKING — localStorage, 1 react / user / star / type
       ================================================================ */
    const _uid = () => STATE.user?.id || 'anon';
    const _reactKey = (id, type) => `react_${_uid()}_${id}_${type}`;
    const _hasReacted = (id, type) => id && localStorage.getItem(_reactKey(id, type)) === '1';
    const _markReacted = (id, type) => id && localStorage.setItem(_reactKey(id, type), '1');
    const _unmarkReacted = (id, type) => id && localStorage.removeItem(_reactKey(id, type));

    // Track các star buồn đã được thắp sáng trong session này (để đếm đúng cho mission)
    const _litHopeStars = new Set();

    /* ================================================================
       POINTS SYNC
       ================================================================ */
    async function _syncPointsFromServer() {
        if (!STATE.user?.token || STATE.user.token === 'local') return;
        try {
            const res = await _fetch('/auth/me', {}, 5000);
            if (!res.ok) return;
            const { points } = await res.json();
            STATE.points = points;
            localStorage.setItem('tram_points', points);
        } catch { }
    }

    async function _pushPoints(amount) {
        if (!STATE.user?.token || STATE.user.token === 'local') return;
        try {
            await _fetch('/auth/points', {
                method: 'POST',
                body: JSON.stringify({ amount }),
            });
        } catch { }
    }

    /* ================================================================
       NORMALISE SERVER STAR
       ================================================================ */
    function _normalise(s) {
        if (s.x == null) s.x = 5 + Math.random() * 88;
        if (s.y == null) s.y = 5 + Math.random() * 70;
        if (!s.size) s.size = 3 + Math.random() * 5;
        if (!s.opacity) s.opacity = 0.5 + Math.random() * 0.5;
        if (!s.type || typeof s.type !== 'string' || !CONFIG.STAR_TYPES[s.type]) s.type = 'shooting';
        if (!s.text) s.text = '';

        // FIX: map negative → isNegative (server trả về "negative", code dùng "isNegative")
        if (s.isNegative == null) s.isNegative = s.negative || false;

        // FIX: map moodPost → isMoodPost
        s.isMoodPost = s.isMoodPost || s.moodPost || false;

        s.reactions = {
            listen: s.listenCount || 0,
            hug: s.hugCount || 0,
            strong: s.strongCount || 0,
            treasure: s.treasureCount || 0,
            feel: s.feelCount || 0,
            thanks: s.thanksCount || 0,
        };
        return s;
    }

    /* ================================================================
       CREATE DOM STAR
       ================================================================ */
    function _createDomStar(data) {
        const wrapper = document.createElement('div');
        wrapper.className = 'star-wrapper';
        wrapper.style.cssText = `position:absolute;left:${data.x}%;top:${data.y}%;width:0;height:0;overflow:visible;`;

        const el = document.createElement('div');
        // FIX: đảm bảo type luôn là string hợp lệ khi gán className
        const safeType = (data.type && typeof data.type === 'string' && CONFIG.STAR_TYPES[data.type])
            ? data.type : 'shooting';
        el.className = `star-dot type-${safeType}`;
        if (data.isOwn) el.classList.add('star-own');

        if (safeType === 'north') {
            const s = data.size || 7;
            el.style.cssText = `position:absolute;transform:translate(-50%,-50%);width:${s}px;height:${s}px;
                opacity:${data.opacity || 0.9};background:#fff8c2;
                clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);
                box-shadow:0 0 ${s * 3}px ${s}px rgba(255,248,194,.7);
                animation:twinkle ${2 + Math.random() * 3}s ease-in-out infinite,northPulse 3s ease-in-out infinite;
                animation-delay:${Math.random() * 4}s;`;
        } else if (safeType === 'cluster') {
            el.style.cssText = `position:absolute;transform:translate(-50%,-50%);width:24px;height:8px;
                opacity:${data.opacity || 0.85};background:transparent;
                animation:twinkle ${3 + Math.random() * 3}s ease-in-out infinite;animation-delay:${Math.random() * 4}s;`;
            [-8, 0, 8].forEach((offset, i) => {
                const sub = document.createElement('span');
                const sz = i === 1 ? 5 : 3.5;
                sub.style.cssText = `position:absolute;width:${sz}px;height:${sz}px;border-radius:50%;
                    background:rgba(212,184,255,${i === 1 ? 0.95 : 0.65});box-shadow:0 0 6px rgba(156,125,255,.6);
                    top:50%;left:50%;transform:translate(calc(-50% + ${offset}px),-50%);`;
                el.appendChild(sub);
            });
        } else {
            const s = data.size || 4;
            el.style.cssText = `position:absolute;transform:translate(-50%,-50%);width:${s}px;height:${s}px;
                border-radius:50%;opacity:${data.opacity || 0.85};background:#a8d8ff;
                box-shadow:0 0 ${s * 2}px ${s}px rgba(168,216,255,.55),-${s * 6}px 0 ${s * 2}px rgba(168,216,255,.25);
                animation:twinkle ${3 + Math.random() * 4}s ease-in-out infinite;animation-delay:${Math.random() * 4}s;`;
        }

        if (data.isNegative) el.classList.add('has-react');

        // New-star highlight
        const ageMs = data.createdAt ? Date.now() - new Date(data.createdAt).getTime() : NEW_STAR_MS + 1;
        if (ageMs < NEW_STAR_MS) {
            el.classList.add('star-new');
            if (ageMs < 5000) {
                el.classList.add('star-badge');
                setTimeout(() => el.classList.remove('star-badge'), 5000 - ageMs);
            }
            setTimeout(() => el.classList.remove('star-new'), NEW_STAR_MS - ageMs);
        }

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

        if (typeof BlackHole !== 'undefined' && BlackHole.bindDragOnStar) {
            BlackHole.bindDragOnStar(wrapper, data);
        }

        const typeConf = CONFIG.STAR_TYPES[safeType];
        if (typeConf?.ttl && !typeConf.permanent) {
            const _normalizeIso = iso => /Z$|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
            const _ageMs = data.createdAt ? Date.now() - new Date(_normalizeIso(data.createdAt)).getTime() : 0;
            const _remainMs = typeConf.ttl - _ageMs;

            const _doFade = () => {
                wrapper.style.transition = 'opacity 1.5s ease';
                wrapper.style.opacity = '0';
                setTimeout(() => {
                    wrapper.remove();
                    const idx = domStars.findIndex(s => s.data === data);
                    if (idx !== -1) domStars.splice(idx, 1);
                    if (data.id && STATE.user?.token && STATE.user.token !== 'local') {
                        _fetch(`/stars/${data.id}`, { method: 'DELETE' })
                            .catch(() => { });
                    }
                }, 1500);
            };

            if (_remainMs <= 0) {
                if (data.id && STATE.user?.token && STATE.user.token !== 'local') {
                    _fetch(`/stars/${data.id}`, { method: 'DELETE' }).catch(() => { });
                }
                requestAnimationFrame(_doFade);
            } else {
                setTimeout(_doFade, _remainMs);
            }
        }

        return wrapper;
    }

    /* ── Badge helpers ── */
    function _formatBadge(data) {
        const r = data.reactions || {};
        const parts = [];
        if (r.listen) parts.push(`🕯️ ${r.listen}`);
        if (r.hug) parts.push(`❤️ ${r.hug}`);
        if (r.strong) parts.push(`⚡ ${r.strong}`);
        if (r.treasure) parts.push(`🌟 ${r.treasure}`);
        if (r.feel) parts.push(`😢 ${r.feel}`);
        if (r.thanks) parts.push(`🙏 ${r.thanks}`);
        return parts.join('  ');
    }

    function _updateBadge(data) {
        if (!data._badge) return;
        const total = Object.values(data.reactions || {}).reduce((s, v) => s + v, 0);
        data._badge.textContent = _formatBadge(data);
        data._badge.style.opacity = total > 0 ? '1' : '0';
    }

    /* ── Hover label ── */
    let _labelEl = null;
    let _labelRaf = null;
    let _labelTarget = null;

    function _scheduleLabel(el, data) {
        _labelTarget = { el, data };
        if (_labelRaf) return;
        _labelRaf = requestAnimationFrame(() => {
            _labelRaf = null;
            if (_labelTarget) _showLabel(_labelTarget.el, _labelTarget.data);
        });
    }

    function _cancelLabel() {
        _labelTarget = null;
        if (_labelRaf) { cancelAnimationFrame(_labelRaf); _labelRaf = null; }
        if (_labelEl) { _labelEl.remove(); _labelEl = null; }
    }

    function _showLabel(el, data) {
        if (_labelEl) { _labelEl.remove(); _labelEl = null; }
        _labelEl = document.createElement('div');
        _labelEl.className = 'star-label';
        const text = data.text || '';
        _labelEl.textContent = text.length > 40 ? text.slice(0, 40) + '…' : text;
        const rect = el.getBoundingClientRect();
        _labelEl.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top - 28}px;position:fixed;z-index:200;`;
        document.body.appendChild(_labelEl);
    }

    /* ── Time format ── */
    function _fmtTime(iso) {
        if (!iso) return null;
        const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
        const d = new Date(normalized);
        if (isNaN(d.getTime())) return null;
        const diff = Math.floor((Date.now() - d.getTime()) / 1000);
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
        const cntTreasure = document.getElementById('count-treasure');
        const cntFeel = document.getElementById('count-feel');
        const cntThanks = document.getElementById('count-thanks');
        if (!popup || !textEl) return;

        textEl.textContent = data.text || '';

        if (userEl) {
            const myId = STATE.user?.id;
            const myNick = STATE.user?.nickname || STATE.user?.username;
            const isOwn = (myId && data.userId && String(data.userId) === String(myId))
                || (myNick && data.nickname && data.nickname !== 'Ẩn danh' && data.nickname === myNick);
            userEl.textContent = isOwn ? `${myNick} ✦` : 'Ẩn danh ✦';
        }

        if (timeEl) {
            const ts = _fmtTime(data.createdAt || data.timestamp);
            timeEl.textContent = ts || '';
            timeEl.style.display = ts ? '' : 'none';
        }

        if (moodTag) moodTag.classList.toggle('hidden', !data.isMoodPost);

        const r = data.reactions || {};
        const _setCount = (el2, emoji, val) => {
            if (!el2) return;
            el2.textContent = `${emoji} ${val}`;
            el2.classList.toggle('has-reacts', val > 0);
        };
        _setCount(cntListen, '🕯️', r.listen || 0);
        _setCount(cntHug, '❤️', r.hug || 0);
        _setCount(cntStrong, '⚡', r.strong || 0);
        _setCount(cntTreasure, '🌟', r.treasure || 0);
        _setCount(cntFeel, '😢', r.feel || 0);
        _setCount(cntThanks, '🙏', r.thanks || 0);

        popup.querySelectorAll('.react-btn').forEach(b => b.classList.remove('reacted', 'just-reacted'));
        _positionPopup(popup, el);
        popup.classList.remove('hidden');

        popup._currentStar = data;
        popup._currentEl = el;

        _bindReactButtons(popup);

        STATE.starsRead = (STATE.starsRead || 0) + 1;
        Missions.progress('read_stars', STATE.starsRead);
    }

    function _positionPopup(popup, triggerEl) {
        popup.style.cssText = 'left:-9999px;top:-9999px;';
        popup.classList.remove('hidden');
        const rect = triggerEl.getBoundingClientRect();
        const pw = popup.offsetWidth || 300;
        const ph = popup.offsetHeight || 280;
        const margin = 16;
        let left = rect.left + rect.width / 2 - pw / 2;
        let top = rect.top - ph - 16;
        if (top < 70) top = rect.bottom + 12;
        left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
        top = Math.min(top, window.innerHeight - ph - margin);
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.classList.add('hidden');
    }

    /* ── React buttons ── */
    function _bindReactButtons(popup) {
        const data = popup._currentStar;
        const emojiMap = { listen: '🕯️', hug: '❤️', strong: '⚡', treasure: '🌟', feel: '😢', thanks: '🙏' };
        const countIdMap = {
            listen: 'count-listen', hug: 'count-hug', strong: 'count-strong',
            treasure: 'count-treasure', feel: 'count-feel', thanks: 'count-thanks',
        };
        const labelMap = {
            listen: 'Lắng nghe 🕯️', hug: 'Cái ôm ❤️', strong: 'Mạnh mẽ ⚡',
            treasure: 'Trân trọng 🌟', feel: 'Thấu hiểu 😢', thanks: 'Cảm ơn 🙏',
        };

        popup.querySelectorAll('.react-btn').forEach(btn => {
            const fresh = btn.cloneNode(true);
            btn.parentNode.replaceChild(fresh, btn);
            const reaction = fresh.dataset.reaction;

            const reactedOnServer = Array.isArray(data.myReactions)
                ? data.myReactions.includes(reaction)
                : (data.myReactions instanceof Set ? data.myReactions.has(reaction) : false);

            // Dong bo server -> localStorage (chi set, khong xoa -
            // tranh ghi de truong hop user vua un-react nhung server chua cap nhat kip)
            if (reactedOnServer && data?.id) _markReacted(data.id, reaction);

            const alreadyLocal = data?.id ? _hasReacted(data.id, reaction) : false;
            if (reactedOnServer || alreadyLocal) {
                fresh.classList.add('reacted');
            }

            fresh.addEventListener('click', async () => {
                if (!data) return;

                const alreadyReacted = _hasReacted(data.id, reaction);
                const countEl = document.getElementById(countIdMap[reaction]);

                if (!data.reactions) data.reactions = {};

                if (alreadyReacted) {
                    fresh.classList.remove('reacted');
                    fresh.classList.add('just-reacted');
                    setTimeout(() => fresh.classList.remove('just-reacted'), 350);
                    data.reactions[reaction] = Math.max(0, (data.reactions[reaction] || 0) - 1);
                    _unmarkReacted(data.id, reaction);
                } else {
                    fresh.classList.add('reacted', 'just-reacted');
                    setTimeout(() => fresh.classList.remove('just-reacted'), 450);
                    data.reactions[reaction] = (data.reactions[reaction] || 0) + 1;
                    _markReacted(data.id, reaction);

                    const starEl = popup._currentEl;
                    if (starEl) {
                        starEl.style.boxShadow = '0 0 30px 10px rgba(244,143,177,.8)';
                        setTimeout(() => starEl.style.boxShadow = '', 1200);
                    }
                }

                if (countEl) {
                    countEl.textContent = `${emojiMap[reaction]} ${data.reactions[reaction]}`;
                    countEl.classList.toggle('has-reacts', data.reactions[reaction] > 0);
                }
                _updateBadge(data);

                if (!data.id) {
                    if (!alreadyReacted && (data.isNegative || data.isMoodPost)) {
                        // Dùng text làm key vì không có id
                        const hopeKey = `hope_noid_${data.text}`;
                        if (!_litHopeStars.has(hopeKey)) {
                            _litHopeStars.add(hopeKey);
                            const cur = (STATE.dailyMissions?.['light_hope'] || 0) + 1;
                            Missions.progress('light_hope', cur);
                        }
                    }
                    if (!alreadyReacted) UI.showToast(`Đã gửi: ${labelMap[reaction] || '💫'}`);
                    else UI.showToast('↩️ Đã hủy cảm xúc', 1800);
                    return;
                }

                const ok = await (alreadyReacted
                    ? _removeReaction(data.id, reaction)
                    : _sendReaction(data.id, reaction));

                if (ok === false) {
                    if (alreadyReacted) {
                        fresh.classList.add('reacted');
                        data.reactions[reaction] = (data.reactions[reaction] || 0) + 1;
                        _markReacted(data.id, reaction);
                    } else {
                        fresh.classList.remove('reacted');
                        data.reactions[reaction] = Math.max(0, (data.reactions[reaction] || 0) - 1);
                        _unmarkReacted(data.id, reaction);
                    }
                    if (countEl) {
                        countEl.textContent = `${emojiMap[reaction]} ${data.reactions[reaction]}`;
                        countEl.classList.toggle('has-reacts', data.reactions[reaction] > 0);
                    }
                    _updateBadge(data);
                    UI.showToast('⚠️ Không thể gửi, thử lại sau', 2000);
                    return;
                }

                if (!alreadyReacted) {
                    if (data.isNegative || data.isMoodPost) {
                        const hopeKey = `hope_${data.id}`;
                        if (!_litHopeStars.has(hopeKey)) {
                            _litHopeStars.add(hopeKey);
                            const cur = (STATE.dailyMissions?.['light_hope'] || 0) + 1;
                            Missions.progress('light_hope', cur);
                        }
                    }
                    if (reaction === 'listen' && !data.isOwn) Missions.onCandleLit?.();
                    if (reaction === 'hug' && data.type === 'shooting' && !data.isOwn) {
                        const ageMs = data.createdAt ? Date.now() - new Date(data.createdAt).getTime() : 0;
                        const ttl = CONFIG.STAR_TYPES.shooting?.ttl || (4 * 60 * 60 * 1000);
                        if (ageMs > ttl * 0.75) {
                            Missions.onHugMeteor?.();
                            UI.showToast('🌠 Bạn đã ôm một ngôi sao sắp tan biến! +5 phút tỏa sáng ✨', 3500);
                        }
                    }
                    UI.showToast(`Đã gửi: ${labelMap[reaction] || '💫'}`);
                } else {
                    UI.showToast('↩️ Đã hủy cảm xúc', 1800);
                }
            });
        });
    }

    async function _sendReaction(starId, type) {
        if (!starId) return false;
        if (!STATE.user?.token || STATE.user.token === 'local') {
            _markReacted(starId, type);
            return true;
        }
        try {
            const res = await _fetch(`/stars/${starId}/react`, {
                method: 'POST',
                body: JSON.stringify({ type }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn('sendReaction error:', res.status, err);
                return false;
            }
            const updated = await res.json().catch(() => null);
            if (updated) _applyServerReactions(starId, updated);
            await _syncPointsFromServer();
            UI.updateHUD();
            setTimeout(_pollOnce, 300);
            return true;
        } catch (e) {
            console.warn('sendReaction fetch error:', e);
            return false;
        }
    }

    async function _removeReaction(starId, type) {
        if (!starId) return false;
        if (!STATE.user?.token || STATE.user.token === 'local') {
            _unmarkReacted(starId, type);
            return true;
        }
        try {
            const res = await _fetch(`/stars/${starId}/react`, {
                method: 'DELETE',
                body: JSON.stringify({ type }),
            });
            if (res.status === 404 || res.status === 405) return true;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn('removeReaction error:', res.status, err);
                return false;
            }
            const updated = await res.json().catch(() => null);
            if (updated) _applyServerReactions(starId, updated);
            await _syncPointsFromServer();
            UI.updateHUD();
            setTimeout(_pollOnce, 300);
            return true;
        } catch (e) {
            console.warn('removeReaction fetch error:', e);
            return false;
        }
    }

    function _applyServerReactions(starId, serverStar) {
        const sid = String(starId);
        const newR = {
            listen: serverStar.listenCount || 0,
            hug: serverStar.hugCount || 0,
            strong: serverStar.strongCount || 0,
            treasure: serverStar.treasureCount || 0,
            feel: serverStar.feelCount || 0,
            thanks: serverStar.thanksCount || 0,
        };
        const entry = domStars.find(d => d.data.id && String(d.data.id) === sid);
        if (entry) {
            entry.data.reactions = newR;
            _updateBadge(entry.data);
            if (serverStar.myReactions) entry.data.myReactions = serverStar.myReactions;
        }

        const popup = document.getElementById('star-popup');
        if (popup && !popup.classList.contains('hidden') &&
            String(popup._currentStar?.id) === sid) {
            popup._currentStar.reactions = newR;
            const emojiMap = { listen: '🕯️', hug: '❤️', strong: '⚡', treasure: '🌟', feel: '😢', thanks: '🙏' };
            const countIdMap = {
                listen: 'count-listen', hug: 'count-hug', strong: 'count-strong',
                treasure: 'count-treasure', feel: 'count-feel', thanks: 'count-thanks',
            };
            ['listen', 'hug', 'strong', 'treasure', 'feel', 'thanks'].forEach(t => {
                const el2 = document.getElementById(countIdMap[t]);
                if (el2) {
                    el2.textContent = `${emojiMap[t]} ${newR[t]}`;
                    el2.classList.toggle('has-reacts', newR[t] > 0);
                }
            });
        }
    }

    /* ================================================================
       LOADING OVERLAY
       ================================================================ */
    function _showLoadingOverlay() {
        if (document.getElementById('stars-loading-overlay')) return;
        const el = document.createElement('div');
        el.id = 'stars-loading-overlay';
        el.style.cssText = `
            position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;
            justify-content:center;gap:16px;z-index:900;pointer-events:none;
            background:rgba(5,4,18,0.55);backdrop-filter:blur(2px);
            opacity:0;transition:opacity 0.35s ease;
        `;
        el.innerHTML = `
            <div style="width:38px;height:38px;border:2px solid rgba(156,125,255,0.18);
                border-top:2px solid rgba(156,125,255,0.85);border-radius:50%;
                animation:starsLoadSpin 0.9s linear infinite;"></div>
            <span style="font-family:'Quicksand',sans-serif;font-size:0.82rem;
                color:rgba(212,184,255,0.75);letter-spacing:0.06em;">
                Đang tải tín hiệu từ vũ trụ…
            </span>
        `;
        if (!document.getElementById('stars-load-spin-style')) {
            const s = document.createElement('style');
            s.id = 'stars-load-spin-style';
            s.textContent = `
                @keyframes starsLoadSpin{to{transform:rotate(360deg)}}
                @keyframes reactCountPop{
                    0%{transform:scale(1);color:inherit}
                    40%{transform:scale(1.45);color:#f4a9d0}
                    100%{transform:scale(1);color:inherit}
                }
                .react-count-flash{
                    animation:reactCountPop 0.6s cubic-bezier(.36,.07,.19,.97) both;
                }
            `;
            document.head.appendChild(s);
        }
        document.body.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));
    }

    function _hideLoadingOverlay() {
        const el = document.getElementById('stars-loading-overlay');
        if (!el) return;
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
    }

    /* ================================================================
       OFFLINE / DEMO BANNER
       ================================================================ */
    function _showOfflineBanner() {
        if (document.getElementById('stars-offline-banner')) return;
        const el = document.createElement('div');
        el.id = 'stars-offline-banner';
        el.style.cssText = `
            position:fixed;top:64px;left:50%;transform:translateX(-50%);
            display:flex;align-items:center;gap:10px;
            background:rgba(10,8,28,0.88);border:1px solid rgba(156,125,255,0.28);
            border-radius:40px;padding:8px 18px 8px 14px;
            font-family:'Quicksand',sans-serif;font-size:0.78rem;
            color:rgba(212,184,255,0.82);letter-spacing:0.04em;
            z-index:800;box-shadow:0 4px 24px rgba(0,0,0,0.4);
            opacity:0;transition:opacity 0.4s ease;pointer-events:auto;
            white-space:nowrap;
        `;
        el.innerHTML = `
            <span style="font-size:1rem;">📡</span>
            <span>Đang hiển thị dữ liệu mẫu — chưa kết nối được máy chủ</span>
            <button id="stars-offline-retry" style="
                margin-left:6px;background:rgba(156,125,255,0.18);
                border:1px solid rgba(156,125,255,0.35);border-radius:20px;
                color:rgba(212,184,255,0.9);font-family:'Quicksand',sans-serif;
                font-size:0.72rem;padding:3px 12px;cursor:pointer;letter-spacing:0.04em;
                transition:background 0.2s;
            ">Thử lại</button>
        `;
        document.body.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));

        document.getElementById('stars-offline-retry')?.addEventListener('click', async () => {
            _hideOfflineBanner();
            await loadStars();
        });
    }

    function _hideOfflineBanner() {
        const el = document.getElementById('stars-offline-banner');
        if (!el) return;
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
    }

    /* ================================================================
       LOAD STARS FROM SERVER
       ================================================================ */
    async function loadStars() {
        _showLoadingOverlay();
        try {
            const res = await _fetch('/stars', {}, 10_000);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const list = await res.json();

            _hideLoadingOverlay();
            _hideOfflineBanner();

            _loadGeneration++;
            container()?.querySelectorAll('.star-wrapper').forEach(el => el.remove());
            domStars = [];

            list.forEach(s => {
                const normalized = _normalise(s);
                const el = _createDomStar(normalized);
                domStars.push({ el, data: normalized });
            });
        } catch (err) {
            console.warn('loadStars error, dùng demo stars:', err);
            _hideLoadingOverlay();
            if (domStars.length === 0) {
                _addDemoStars();
                _showOfflineBanner();
            }
        }
    }

    let _loadGeneration = 0;

    /* ================================================================
       POLLING REALTIME
       ================================================================ */
    function startPolling(intervalMs = 5_000) {
        stopPolling();
        _pollingController = setInterval(_pollOnce, intervalMs);
    }

    function stopPolling() {
        if (_pollingController) { clearInterval(_pollingController); _pollingController = null; }
    }

    async function _pollOnce() {
        if (!STATE.user?.token || STATE.user.token === 'local') return;
        if (document.hidden) return;

        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/stars`, {
                headers: { 'Authorization': `Bearer ${STATE.user.token}` },
                signal: ctrl.signal,
            });
            clearTimeout(tid);
            if (!res.ok) return;
            const list = await res.json();

            _hideOfflineBanner();
            let newFromOthers = 0;
            const myId = STATE.user?.id;

            const serverIds = new Set(list.map(s => String(s.id)));

            const toRemove = domStars.filter(d => {
                if (!d.data.id) return false;
                if (d.data.isOwn) {
                    const ageMs = d.data.createdAt
                        ? Date.now() - new Date((/Z$|[+-]\d{2}:\d{2}$/.test(d.data.createdAt)
                            ? d.data.createdAt : d.data.createdAt + 'Z')).getTime()
                        : 0;
                    if (ageMs < 30_000) return false;
                }
                return !serverIds.has(String(d.data.id));
            });
            toRemove.forEach(d => {
                if (d.el) {
                    d.el.style.transition = 'opacity 1.5s ease';
                    d.el.style.opacity = '0';
                    setTimeout(() => d.el?.parentNode?.removeChild(d.el), 1500);
                }
                const idx = domStars.indexOf(d);
                if (idx !== -1) domStars.splice(idx, 1);
            });

            for (const s of list) {
                const sid = String(s.id);
                const entry = domStars.find(d => d.data.id && String(d.data.id) === sid);
                if (entry) {
                    const newR = {
                        listen: s.listenCount || 0,
                        hug: s.hugCount || 0,
                        strong: s.strongCount || 0,
                        treasure: s.treasureCount || 0,
                        feel: s.feelCount || 0,
                        thanks: s.thanksCount || 0,
                    };
                    const oldR = entry.data.reactions || {};
                    // Luôn sync myReactions từ server, không phụ thuộc count thay đổi
                    if (s.myReactions) entry.data.myReactions = s.myReactions;

                    if (oldR.listen !== newR.listen || oldR.hug !== newR.hug ||
                        oldR.strong !== newR.strong || oldR.treasure !== newR.treasure ||
                        oldR.feel !== newR.feel || oldR.thanks !== newR.thanks) {
                        entry.data.reactions = newR;
                        _updateBadge(entry.data);

                        const popup = document.getElementById('star-popup');
                        if (popup && !popup.classList.contains('hidden') &&
                            String(popup._currentStar?.id) === sid) {
                            const emojiMap = { listen: '🕯️', hug: '❤️', strong: '⚡', treasure: '🌟', feel: '😢', thanks: '🙏' };
                            const countIdMap = {
                                listen: 'count-listen', hug: 'count-hug', strong: 'count-strong',
                                treasure: 'count-treasure', feel: 'count-feel', thanks: 'count-thanks',
                            };
                            ['listen', 'hug', 'strong', 'treasure', 'feel', 'thanks'].forEach(t => {
                                const el2 = document.getElementById(countIdMap[t]);
                                if (el2) {
                                    const prevVal = parseInt(el2.textContent.replace(/\D/g, '')) || 0;
                                    el2.textContent = `${emojiMap[t]} ${newR[t]}`;
                                    el2.classList.toggle('has-reacts', newR[t] > 0);
                                    if (newR[t] !== prevVal) {
                                        el2.classList.add('react-count-flash');
                                        setTimeout(() => el2.classList.remove('react-count-flash'), 700);
                                    }
                                }
                                const reactBtn = popup.querySelector(`.react-btn[data-reaction="${t}"]`);
                                if (reactBtn && !reactBtn.disabled) {
                                    if (_hasReacted(sid, t)) reactBtn.classList.add('reacted');
                                    else reactBtn.classList.remove('reacted');
                                }
                            });
                            popup._currentStar.reactions = newR;
                        }
                    }
                    continue;
                }

                _normalise(s);
                const slot = { el: null, data: s };
                domStars.push(slot);

                const gen = _loadGeneration;
                const { destX, destY } = _getDestCoords(s);
                const { startX, startY } = _getRandEdge();
                const flyFn = s.type === 'north' ? _flyNorthStar
                    : s.type === 'cluster' ? _flyClusterStar
                        : _flyShootingStar;

                flyFn(startX, startY, destX, destY, () => {
                    if (gen !== _loadGeneration || !domStars.includes(slot)) return;
                    const el = _createDomStar(s);
                    slot.el = el;
                    el.style.opacity = '0';
                    el.style.transition = 'opacity .5s ease';
                    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));
                });

                if (myId && s.userId && String(s.userId) !== String(myId)) newFromOthers++;
            }

            if (newFromOthers > 0) UI.showToast(`✨ ${newFromOthers} tín hiệu mới vừa đến vũ trụ`, 3000);
        } catch (e) {
            if (e.name !== 'AbortError') console.warn('poll error:', e);
            clearTimeout(tid);
        }
    }

    function _getDestCoords(s) {
        const mainScreen = document.getElementById('main-screen');
        const mainRect = mainScreen?.getBoundingClientRect() || { left: 0, top: 0 };
        const screenW = mainScreen?.offsetWidth || window.innerWidth;
        const screenH = mainScreen?.offsetHeight || window.innerHeight;
        return {
            destX: mainRect.left + (s.x / 100) * screenW,
            destY: mainRect.top + (s.y / 100) * screenH,
        };
    }

    function _getRandEdge() {
        const W = window.innerWidth, H = window.innerHeight;
        const edge = Math.floor(Math.random() * 4);
        return {
            startX: edge === 0 ? Math.random() * W : edge === 1 ? W : edge === 2 ? Math.random() * W : 0,
            startY: edge === 0 ? 0 : edge === 1 ? Math.random() * H : edge === 2 ? H : Math.random() * H,
        };
    }

    /* ================================================================
       DEMO STARS — offline fallback
       ================================================================ */
    function _addDemoStars() {
        container()?.querySelectorAll('.star-wrapper').forEach(el => el.remove());
        _loadGeneration++;
        domStars = [];
        const now = Date.now();
        const demos = [
            { id: 1, text: 'Hôm nay mình mệt quá, ước gì có ai đó hiểu mình...', type: 'shooting', isNegative: true, isMoodPost: true, reactions: { listen: 3, hug: 1, strong: 0 }, createdAt: new Date(now - 3600000).toISOString() },
            { id: 2, text: 'Vừa đậu đại học! Nhưng cảm thấy áp lực quá 😅', type: 'north', isNegative: false, isMoodPost: false, reactions: { listen: 0, hug: 0, strong: 2 }, createdAt: new Date(now - 7200000).toISOString() },
            { id: 3, text: 'Tiếng mưa buổi sáng thật bình yên 🌧️', type: 'cluster', isNegative: false, isMoodPost: false, reactions: {}, createdAt: new Date(now - 600000).toISOString() },
            { id: 4, text: 'Muốn được ngủ đủ giấc một lần thôi...', type: 'shooting', isNegative: true, isMoodPost: true, reactions: { listen: 0, hug: 5, strong: 0 }, createdAt: new Date(now - 86400000).toISOString() },
            { id: 5, text: 'Bầu trời đêm nay đẹp không ai ơi 🌙', type: 'north', isNegative: false, isMoodPost: false, reactions: {}, createdAt: new Date(now - 1800000).toISOString() },
            { id: 6, text: 'Nhớ nhà quá, xa nhà được 3 tháng rồi', type: 'cluster', isNegative: true, isMoodPost: true, reactions: { listen: 2, hug: 4, strong: 0 }, createdAt: new Date(now - 43200000).toISOString() },
            { id: 7, text: 'Cuối cùng cũng hoàn thành project ✨', type: 'shooting', isNegative: false, isMoodPost: false, reactions: { listen: 0, hug: 0, strong: 7 }, createdAt: new Date(now - 900000).toISOString() },
            { id: 8, text: 'Không biết tương lai sẽ như thế nào...', type: 'cluster', isNegative: true, isMoodPost: true, reactions: { listen: 1, hug: 0, strong: 0 }, createdAt: new Date(now - 120000).toISOString() },
            { id: 9, text: 'Vừa ăn bát bún bò ngon nhất đời 😋', type: 'north', isNegative: false, isMoodPost: false, reactions: {}, createdAt: new Date(now - 300000).toISOString() },
            { id: 10, text: 'Gửi đến những ai đang cô đơn: bạn không một mình đâu 💙', type: 'north', isNegative: false, isMoodPost: false, reactions: { listen: 3, hug: 12, strong: 0 }, createdAt: new Date(now - 172800000).toISOString() },
        ];
        demos.forEach(d => {
            const s = { ...d, x: 5 + Math.random() * 88, y: 5 + Math.random() * 65, size: 3 + Math.random() * 5, opacity: 0.6 + Math.random() * 0.4 };
            domStars.push({ el: _createDomStar(s), data: s });
        });
    }

    /* ================================================================
       FLY ANIMATIONS
       ================================================================ */
    let _flyCanvas = null;
    let _flyCtx = null;

    function _getFlyCtx() {
        if (!_flyCanvas) {
            _flyCanvas = document.createElement('canvas');
            _flyCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:500;';
            document.body.appendChild(_flyCanvas);
        }
        _flyCanvas.width = window.innerWidth;
        _flyCanvas.height = window.innerHeight;
        _flyCtx = _flyCanvas.getContext('2d');
        _flyCtx.clearRect(0, 0, _flyCanvas.width, _flyCanvas.height);
        return { ctx: _flyCtx, W: _flyCanvas.width, H: _flyCanvas.height };
    }

    function _shockwave(ctx, W, H, tx, ty, c1, c2) {
        let r = 0, alpha = 1;
        (function ring() {
            ctx.clearRect(0, 0, W, H);
            r += 6; alpha -= 0.045;
            if (alpha <= 0) { ctx.clearRect(0, 0, W, H); return; }
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = c1; ctx.lineWidth = 3 - r * 0.02;
            ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.stroke();
            if (r > 15) {
                ctx.strokeStyle = c2; ctx.lineWidth = 1.5; ctx.globalAlpha = alpha * 0.5;
                ctx.beginPath(); ctx.arc(tx, ty, r * 0.6, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            requestAnimationFrame(ring);
        })();
    }

    function _sparks(tx, ty, color, count = 14) {
        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            const ang = (i / count) * Math.PI * 2;
            const spd = 40 + Math.random() * 60;
            const sz = 2 + Math.random() * 3;
            el.style.cssText = `position:fixed;left:${tx}px;top:${ty}px;width:${sz}px;height:${sz}px;
                border-radius:50%;background:${color};pointer-events:none;z-index:600;
                box-shadow:0 0 ${sz * 2}px ${color};
                transition:transform .6s cubic-bezier(.2,0,.8,1),opacity .6s ease;
                transform:translate(-50%,-50%);opacity:1;`;
            document.body.appendChild(el);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.transform = `translate(calc(-50% + ${Math.cos(ang) * spd}px),calc(-50% + ${Math.sin(ang) * spd}px))`;
                el.style.opacity = '0';
            }));
            setTimeout(() => el.remove(), 700);
        }
    }

    function _flyShootingStar(sx, sy, tx, ty, onDone) {
        const { ctx, W, H } = _getFlyCtx();
        const dx = tx - sx, dy = ty - sy, dist = Math.hypot(dx, dy);
        const steps = Math.ceil(dist / 5);
        let step = 0;
        const trail = [];
        (function frame() {
            ctx.clearRect(0, 0, W, H);
            const p = step / steps;
            const x = sx + dx * p, y = sy + dy * p;
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
                ctx.beginPath(); ctx.arc(sx + dx * t * p + (Math.random() - .5) * 14, sy + dy * t * p + (Math.random() - .5) * 10, Math.random() * 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            const hg = ctx.createRadialGradient(x, y, 0, x, y, 28);
            hg.addColorStop(0, '#fff'); hg.addColorStop(.25, '#a8d8ff');
            hg.addColorStop(.6, 'rgba(100,180,255,.4)'); hg.addColorStop(1, 'rgba(100,180,255,0)');
            ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, 28, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
            step++;
            if (step <= steps) { requestAnimationFrame(frame); return; }
            _sparks(tx, ty, '#a8d8ff', 16);
            _shockwave(ctx, W, H, tx, ty, 'rgba(168,216,255,.9)', 'rgba(255,255,255,.6)');
            setTimeout(() => { ctx.clearRect(0, 0, W, H); onDone?.(); }, 700);
        })();
    }

    function _flyNorthStar(sx, sy, tx, ty, onDone) {
        const { ctx, W, H } = _getFlyCtx();
        const dx = tx - sx, dy = ty - sy, dist = Math.hypot(dx, dy);
        const steps = Math.ceil(dist / 3.5);
        let step = 0, t = 0;
        (function frame() {
            ctx.clearRect(0, 0, W, H);
            const p = step / steps;
            const x = sx + dx * p, y = sy + dy * p;
            const pulse = 1 + 0.18 * Math.sin(t * 0.12); t++;
            const aura = ctx.createRadialGradient(x, y, 0, x, y, 42 * pulse);
            aura.addColorStop(0, 'rgba(255,248,194,.65)'); aura.addColorStop(.5, 'rgba(255,220,100,.2)'); aura.addColorStop(1, 'rgba(255,248,194,0)');
            ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(x, y, 42 * pulse, 0, Math.PI * 2); ctx.fill();
            const r1 = 18 * pulse, r2 = 5;
            ctx.fillStyle = '#fff8c2'; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 18;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2 - Math.PI / 2, a2 = a + Math.PI / 4;
                if (i === 0) ctx.moveTo(x + r1 * Math.cos(a), y + r1 * Math.sin(a));
                else ctx.lineTo(x + r1 * Math.cos(a), y + r1 * Math.sin(a));
                ctx.lineTo(x + r2 * Math.cos(a2), y + r2 * Math.sin(a2));
            }
            ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
            step++;
            if (step <= steps) { requestAnimationFrame(frame); return; }
            _sparks(tx, ty, '#ffe066', 20);
            _shockwave(ctx, W, H, tx, ty, 'rgba(255,220,80,.95)', 'rgba(255,255,200,.5)');
            setTimeout(() => { ctx.clearRect(0, 0, W, H); onDone?.(); }, 700);
        })();
    }

    function _flyClusterStar(sx, sy, tx, ty, onDone) {
        const { ctx, W, H } = _getFlyCtx();
        const dx = tx - sx, dy = ty - sy, dist = Math.hypot(dx, dy);
        const steps = Math.ceil(dist / 4);
        let step = 0;
        const baseAngle = Math.atan2(dy, dx);
        const FAN = [
            { offAngle: -0.18, lag: 0, size: 8, alpha: 1.0 },
            { offAngle: 0, lag: 8, size: 6, alpha: 0.85 },
            { offAngle: 0.18, lag: 16, size: 5, alpha: 0.65 },
        ];
        (function frame() {
            ctx.clearRect(0, 0, W, H);
            FAN.forEach(({ offAngle, lag, size, alpha }) => {
                const s = Math.max(0, step - lag);
                const p = Math.min(s / steps, 1);
                const ang = baseAngle + offAngle;
                const px = sx + Math.cos(ang) * dist * p;
                const py = sy + Math.sin(ang) * dist * p;
                const rg = ctx.createRadialGradient(px, py, 0, px, py, size * 4);
                rg.addColorStop(0, `rgba(212,184,255,${alpha})`); rg.addColorStop(1, 'rgba(156,125,255,0)');
                ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, size * 4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(230,210,255,${alpha})`;
                ctx.shadowColor = '#d4b8ff'; ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            });
            step++;
            if (step <= steps + 16) { requestAnimationFrame(frame); return; }
            _sparks(tx, ty, '#d4b8ff', 18);
            _shockwave(ctx, W, H, tx, ty, 'rgba(200,160,255,.9)', 'rgba(180,130,255,.5)');
            setTimeout(() => { ctx.clearRect(0, 0, W, H); onDone?.(); }, 700);
        })();
    }

    /* ================================================================
       SEND SIGNAL
       ================================================================ */
    async function sendSignal(text, type, showHeal = true, isMoodPost = false) {
        if (!text?.trim()) return false;
        if (TextFilter.isToxic(text)) {
            UI.showToast('💫 Trạm là không gian bình yên — hãy gửi điều nhẹ nhàng hơn nhé', 4000);
            return false;
        }
        if (TextFilter.isCrisis(text)) {
            UI.showToast('💙 Bạn không đơn độc. Đường dây hỗ trợ miễn phí: 1800 599 920', 7000);
        }

        Sound?.playBell?.();

        const validType = CONFIG.STAR_TYPES[type] ? type : 'shooting';
        const W = window.innerWidth, H = window.innerHeight;
        const SAFE_TOP = 74, SAFE_BOT = H * 0.5 - 120;
        const flyX = W * 0.05 + Math.random() * (W * 0.89);
        const flyY = SAFE_TOP + Math.random() * (SAFE_BOT - SAFE_TOP);
        const ms = document.getElementById('main-screen');
        const msR = ms?.getBoundingClientRect() || { left: 0, top: 0 };
        const msW = ms?.offsetWidth || W;
        const msH = ms?.offsetHeight || H;
        const xPct = ((flyX - msR.left) / msW) * 100;
        const yPct = ((flyY - msR.top) / msH) * 100;
        const [s0, s1] = CONFIG.STAR_TYPES[validType].size;
        const starSize = (s0 + Math.random() * (s1 - s0)) * 2.2;
        const sendBtn = document.getElementById('btn-send');
        const btnR = sendBtn?.getBoundingClientRect();
        const startX = btnR ? btnR.left + btnR.width / 2 : W / 2;
        const startY = btnR ? btnR.top : H * 0.65;
        const sentAt = new Date().toISOString();
        const flyFn = validType === 'north' ? _flyNorthStar
            : validType === 'cluster' ? _flyClusterStar
                : _flyShootingStar;

        flyFn(startX, startY, flyX, flyY, async () => {
            const data = {
                id: null, text, type: validType, x: xPct, y: yPct, size: starSize,
                opacity: 0.95, isNegative: TextFilter.isNegative(text), isMoodPost,
                createdAt: sentAt,
                reactions: { listen: 0, hug: 0, strong: 0, treasure: 0, feel: 0, thanks: 0 },
                nickname: STATE.user?.nickname || STATE.user?.username || '',
                userId: STATE.user?.id || null, isOwn: true,
                myReactions: [],
            };
            const el = _createDomStar(data);
            domStars.push({ el, data });
            el.style.opacity = '0';
            el.style.transition = 'opacity .6s ease';
            requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));

            const id = await _postStar(text, validType, xPct, yPct, isMoodPost);
            if (id) data.id = id;

            await _syncPointsFromServer();
            UI.updateHUD();
        });
        return true;
    }

    async function _postStar(text, type, x, y, isMoodPost) {
        try {
            const res = await _fetch('/stars', {
                method: 'POST',
                body: JSON.stringify({
                    text,
                    type: type || 'shooting',   // FIX: đảm bảo không bao giờ undefined
                    x,
                    y,
                    moodPost: isMoodPost ?? false,
                    nickname: STATE.user?.nickname || STATE.user?.username || 'Ẩn danh',
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return data.id || null;
        } catch (err) {
            console.warn('postStar offline:', err);
            return null;
        }
    }

    /* ================================================================
       SHOOTING STAR
       ================================================================ */
    function _isDone(id) { return !!STATE.dailyMissions?.[`${id}_done`]; }

    function startShootingStarCycle() {
        if (_shootingInterval) { clearInterval(_shootingInterval); _shootingInterval = null; }
        if (_isDone('shooting_star')) return;
        const first = setTimeout(() => {
            if (!_isDone('shooting_star')) _launchShootingStar();
            _shootingInterval = setInterval(() => {
                if (_isDone('shooting_star')) { clearInterval(_shootingInterval); _shootingInterval = null; }
                else _launchShootingStar();
            }, 60_000);
        }, 5_000);
        const check = setInterval(() => { if (_isDone('shooting_star')) { clearTimeout(first); clearInterval(check); } }, 1000);
    }

    function _launchShootingStar() {
        if (shootingActive) return;
        shootingActive = true;
        const screen = document.getElementById('main-screen');
        if (!screen) { shootingActive = false; return; }

        const wrapper = document.createElement('div');
        wrapper.className = 'shooting-star-wrapper';
        wrapper.style.cssText = `position:fixed;top:${5 + Math.random() * 20}vh;left:${65 + Math.random() * 25}vw;
            width:0;height:0;pointer-events:none;z-index:500;
            animation:shootingMeteor ${METEOR_DURATION}ms cubic-bezier(.18,.05,.42,1) forwards;`;

        const tail = document.createElement('div'); tail.className = 'shooting-star-tail';
        const glow = document.createElement('div'); glow.className = 'shooting-star-glow';
        const head = document.createElement('div'); head.className = 'shooting-star-head';
        head.style.cssText = 'pointer-events:all;cursor:pointer;';
        wrapper.append(tail, glow, head);
        screen.appendChild(wrapper);

        const hint = document.getElementById('shooting-hint');
        if (hint) hint.classList.remove('hidden');
        let caught = false;

        const catchMeteor = async (e) => {
            e.stopPropagation();
            if (caught) return;
            caught = true;
            shootingActive = false;
            const mat = new DOMMatrix(getComputedStyle(wrapper).transform);
            wrapper.style.animation = 'none';
            wrapper.style.transform = `translate(${mat.m41}px,${mat.m42}px) rotate(-35deg)`;
            if (hint) hint.classList.add('hidden');
            _spawnCatchEffect(wrapper);
            setTimeout(() => wrapper.remove(), 600);
            UI.addPoints(CONFIG.POINTS.SHOOTING_STAR);
            await _pushPoints(CONFIG.POINTS.SHOOTING_STAR);
            Missions.complete('shooting_star');
            UI.showToast(`🌠 Bạn đã bắt được sao băng! +${CONFIG.POINTS.SHOOTING_STAR} ✨`);
            Sound?.playSinewave?.(880);
            UI.updateHUD();
            document.dispatchEvent(new CustomEvent('shootingstar:caught'));
        };

        head.addEventListener('click', catchMeteor);
        head.addEventListener('touchstart', catchMeteor, { passive: false });
        setTimeout(() => {
            if (!caught) { wrapper.remove(); if (hint) hint.classList.add('hidden'); shootingActive = false; }
        }, METEOR_DURATION + 200);
    }

    function _spawnCatchEffect(wrapper) {
        const rect = wrapper.getBoundingClientRect();
        const cx = rect.left, cy = rect.top;
        const ring = document.createElement('div');
        ring.className = 'points-ring';
        ring.style.cssText = `left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);`;
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 800);
        const colors = ['#fff', 'var(--accent-gold)', '#c8dcff', '#e8d5ff'];
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const p = document.createElement('div'); p.className = 'dust-particle';
                const sz = 2 + Math.random() * 5;
                p.style.cssText = `width:${sz}px;height:${sz}px;
                    left:${cx + (-40 + Math.random() * 80)}px;top:${cy + (-20 + Math.random() * 40)}px;
                    background:${colors[Math.floor(Math.random() * colors.length)]};
                    --dx:${-120 + Math.random() * 240}px;--dy:${-140 - Math.random() * 100}px;`;
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
        _meteorInterval = setInterval(_meteorRain, CONFIG.METEOR_RAIN_INTERVAL + 60_000);
    }

    async function _meteorRain() {
        UI.showToast('🌠 Mưa sao băng! Bạn nhận được +30 ✨ may mắn!');
        UI.addPoints(30);
        await _pushPoints(30);
        UI.updateHUD();
        document.dispatchEvent(new CustomEvent('meteorrain:bonus'));
        const screen = document.getElementById('main-screen');
        if (!screen) return;
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const m = document.createElement('div'); m.className = 'meteor-line';
                m.style.cssText = `left:${10 + Math.random() * 80}vw;top:${Math.random() * 40}vh;`;
                screen.appendChild(m);
                setTimeout(() => m.remove(), 1400);
            }, i * 120);
        }
    }

    /* ================================================================
       POPUP CLOSE
       ================================================================ */
    function initPopupClose() {
        document.getElementById('popup-close')?.addEventListener('click', () => {
            document.getElementById('star-popup').classList.add('hidden');
        });
        document.getElementById('star-canvas')?.addEventListener('click', e => {
            if (!e.target.closest('.star-popup') && !e.target.classList.contains('star-dot')) {
                document.getElementById('star-popup').classList.add('hidden');
            }
        });
    }

    /* ── Public API ── */
    return {
        loadStars, sendSignal, startShootingStarCycle, startMeteorRain,
        initPopupClose, startPolling, stopPolling,
        _clearDomStars: () => { domStars = []; },
        _removeDomStar: (data) => {
            const idx = domStars.findIndex(s => s.data === data);
            if (idx !== -1) domStars.splice(idx, 1);
        },
    };
})();