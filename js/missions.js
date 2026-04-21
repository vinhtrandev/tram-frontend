/* ================================================
   TRẠM GỬI TÍN HIỆU - missions.js  [v2 - optimised]
   ================================================ */

const Missions = (() => {

    let voidHoldTimer = null;
    let breathingCycle = 0;
    let astroInterval = null;

    /* ── Helpers ── */
    // Dùng TextFilter từ config.js — không duplicate logic toxic/mood ở đây
    const _isToxic = t => TextFilter.isToxic(t);
    const _hasMood = t => TextFilter.hasMood(t);
    // UTC date string "YYYY-MM-DD" (consistent with backend Instant.now() UTC)
    const _today = () => new Date().toISOString().slice(0, 10);

    /* ================================================================
       INIT
       ================================================================ */
    function init() {
        _resetDailyIfNeeded();
        _sanitizeStreak();
        _injectMissionStyles();
        _renderMissions();
        _renderStreak();
        _initVoid();
        _initInput();
        _initAstronautTimer();
    }

    function _injectMissionStyles() {
        if (document.getElementById('mission-extra-styles')) return;
        const s = document.createElement('style');
        s.id = 'mission-extra-styles';
        s.textContent = `
            .mission-progress-count {
                display:inline-block;
                font-size:.72rem;
                color:var(--accent-purple,#ce93d8);
                background:rgba(206,147,216,.15);
                border:1px solid rgba(206,147,216,.3);
                border-radius:20px;
                padding:1px 7px;
                margin-left:6px;
                vertical-align:middle;
                font-weight:600;
                letter-spacing:.03em;
            }
            .mission-item.done .mission-btn {
                background: rgba(100,200,100,.15) !important;
                border-color: rgba(100,200,100,.4) !important;
                color: rgba(150,255,150,.8) !important;
            }
            .mission-item .mission-btn[data-action] {
                cursor: pointer;
                opacity: 1 !important;
                background: rgba(100,60,180,.4);
                border: 1px solid rgba(150,100,255,.5);
                color: #d4b8ff;
                transition: background .2s, transform .1s;
            }
            .mission-item .mission-btn[data-action]:hover {
                background: rgba(120,70,200,.6);
                transform: scale(1.04);
            }
            .mission-item .mission-btn[data-action]:active {
                transform: scale(.97);
            }
        `;
        document.head.appendChild(s);
    }

    /* ── Daily reset ── */
    function _resetDailyIfNeeded() {
        const today = _today();
        if (!STATE.dailyMissions || STATE.dailyMissions._date !== today) {
            STATE.dailyMissions = { _date: today };
            Auth.saveState();
        }
    }

    function _sanitizeStreak() {
        if (!Array.isArray(STATE.streak)) { STATE.streak = []; Auth.saveState(); return; }
        const now = new Date();
        const dowUTC = now.getUTCDay();
        const monOff = dowUTC === 0 ? -6 : 1 - dowUTC;
        const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + monOff));
        const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + monOff + 6, 23, 59, 59, 999));
        const today = _today();
        const before = STATE.streak.length;
        STATE.streak = STATE.streak.filter(d => {
            if (!d || typeof d !== 'string' || d > today) return false;
            const dt = new Date(d + 'T00:00:00Z');
            return dt >= monday && dt <= sunday;
        });
        if (STATE.streak.length !== before) Auth.saveState();
    }

    function _getDateForDayIndex(i) {
        const now = new Date();
        const dowUTC = now.getUTCDay();
        const monOff = dowUTC === 0 ? -6 : 1 - dowUTC;
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + monOff + i))
            .toISOString().slice(0, 10);
    }

    /* ================================================================
       RENDER MISSIONS
       ================================================================ */
    function _renderMissions() {
        const el = document.getElementById('missions-list');
        if (!el) return;
        el.innerHTML = '';
        CONFIG.MISSIONS.forEach(m => {
            const done = _isDone(m.id);
            const prog = STATE.dailyMissions[m.id] || 0;
            const pct = m.max ? Math.min((prog / m.max) * 100, 100) : (done ? 100 : 0);

            // Label tiến trình (chỉ hiện khi có max > 1 và đang làm)
            const showProgress = m.max > 1 && prog > 0 && !done;
            const progressLabel = showProgress ? `<span class="mission-progress-count">${prog}/${m.max}</span>` : '';

            const item = document.createElement('div');
            item.className = `mission-item${done ? ' done' : ''}`;
            item.id = `mission-${m.id}`;
            item.innerHTML = `
                <div class="mission-star ${done ? 'done' : ''}">${m.icon}</div>
                <div class="mission-body">
                    <div class="mission-name">${m.name} ${progressLabel}</div>
                    <div class="mission-desc">${m.desc}</div>
                    <div class="mission-bar-track"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                    <span class="mission-reward">+${m.reward} ✨</span>
                    ${_getMissionBtn(m, done)}
                </div>`;
            el.appendChild(item);
            _bindMissionBtn(item, m);
        });
    }

    function _getMissionBtn(m, done) {
        if (done) return `<button class="mission-btn" disabled>✓ Xong</button>`;
        const map = {
            breathing: `<button class="mission-btn" data-action="breathing">🌬️ Bắt đầu thở</button>`,
            void_hold: `<button class="mission-btn" data-action="void_hold">🕳️ Vào Hố Đen</button>`,
            patient_astronaut: `<button class="mission-btn" data-action="astronaut">🧑‍🚀 Bắt đầu</button>`,
            shooting_star: `<button class="mission-btn" data-action="goto_universe">🌠 Ra bản đồ sao</button>`,
            read_stars: `<button class="mission-btn" data-action="goto_universe">👁️ Khám phá bản đồ</button>`,
            light_hope: `<button class="mission-btn" data-action="goto_universe">🕯️ Tìm ngôi sao buồn</button>`,
            light_candle: `<button class="mission-btn" data-action="goto_universe">🕯️ Thắp nến cho sao</button>`,
            void_negative: `<button class="mission-btn" data-action="void_negative">🌑 Viết & Buông bỏ</button>`,
            hug_meteor: `<button class="mission-btn" data-action="goto_universe">🌠 Tìm sao sắp tàn</button>`,
        };
        return map[m.id] || `<button class="mission-btn" disabled>Tự động</button>`;
    }

    function _bindMissionBtn(item, m) {
        item.querySelector('[data-action]')?.addEventListener('click', e => {
            const action = e.currentTarget.dataset.action;
            if (action === 'breathing') _startBreathing();
            if (action === 'void_hold') { document.getElementById('missions-panel')?.classList.add('hidden'); _startVoidHoldFromBtn(); }
            if (action === 'astronaut') _startAstronaut();
            if (action === 'void_negative') { document.getElementById('missions-panel')?.classList.add('hidden'); _startVoidNegative(); }
            if (action === 'goto_universe') _gotoUniverse(m.id);
        });
    }

    function _gotoUniverse(missionId) {
        // Đóng TẤT CẢ các panel
        ['missions-panel', 'store-panel', 'heal-panel', 'notif-panel'].forEach(id => {
            document.getElementById(id)?.classList.add('hidden');
        });

        // Đóng sound panel nếu đang mở (mobile)
        if (typeof window._closeSoundPanel === 'function') window._closeSoundPanel();

        // Sync active state trên bottom nav về Universe
        if (typeof window._switchToUniverseTab === 'function') {
            window._switchToUniverseTab();
        } else {
            // Fallback: set active trực tiếp
            document.querySelectorAll('.bottom-nav .bn-item').forEach(el => el.classList.remove('active'));
            const bnUniverse = document.getElementById('bn-universe');
            if (bnUniverse) bnUniverse.classList.add('active');
        }

        // Scroll về màn hình chính (universe)
        const mainScreen = document.getElementById('main-screen');
        if (mainScreen) {
            mainScreen.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Highlight hint tương ứng
        const hints = {
            shooting_star: '🌠 Chờ sao băng xuất hiện rồi bấm vào để bắt! Thường xuất hiện sau vài phút.',
            read_stars: '👁️ Bấm vào các ngôi sao trên bản đồ để đọc tâm tư của họ (cần đọc đủ 10 ngôi sao).',
            light_hope: '🕯️ Tìm ngôi sao có icon 💜 (tâm trạng buồn) rồi bấm nút 🕯️ Lắng nghe để thắp nến.',
            light_candle: '🕯️ Bấm vào bất kỳ ngôi sao nào → chọn 🕯️ Lắng nghe. Cần thắp cho 5 người lạ.',
            hug_meteor: '🌠 Tìm ngôi sao Sao Băng (💫) còn lại ít thời gian → bấm vào → chọn ❤️ Gửi ôm.',
        };

        const msg = hints[missionId];
        if (msg) {
            setTimeout(() => UI.showToast(msg, 5000), 300);
        }

        // Thêm pulse highlight vào void nếu là nhiệm vụ void
        if (missionId === 'void_hold') {
            _startVoidHoldFromBtn();
        }
    }

    let _voidStartHold = null;

    function _startVoidHoldFromBtn() {
        const voidEl = document.getElementById('void');
        if (!voidEl) return;
        voidEl.style.transition = 'box-shadow .3s ease';
        voidEl.style.boxShadow = '0 0 60px rgba(206,147,216,.8),0 0 120px rgba(150,50,255,.5)';
        setTimeout(() => { voidEl.style.boxShadow = ''; voidEl.style.transition = ''; }, 600);
        if (typeof _voidStartHold === 'function') _voidStartHold();
        else UI.showToast('🌑 Giữ ngón tay vào Hố Đen trong 10 giây để buông bỏ!', 4000);
    }

    /* ================================================================
       PROGRESS / COMPLETE
       ================================================================ */
    function progress(id, value) {
        const m = CONFIG.MISSIONS.find(m => m.id === id);
        if (!m || _isDone(id)) return;
        if (!STATE.dailyMissions) STATE.dailyMissions = { _date: _today() };
        STATE.dailyMissions[id] = value;
        if (m.max && value >= m.max) complete(id);
        else _updateBar(id, value, m.max);
        Auth.saveState();
    }

    async function complete(id) {
        if (_isDone(id)) return;
        const m = CONFIG.MISSIONS.find(m => m.id === id);
        if (!m) return;
        if (!STATE.dailyMissions) STATE.dailyMissions = { _date: _today() };
        STATE.dailyMissions[`${id}_done`] = true;
        STATE.dailyMissions[id] = m.max || 1;
        STATE.points = (STATE.points || 0) + m.reward;
        Auth.saveState();
        UI.updateHUD();
        UI.showToast(`✅ ${m.name} hoàn thành! +${m.reward} ✨`);
        setTimeout(() => UI.showHealingQuote(), 1200);
        _updateBar(id, m.max || 1, m.max || 1);
        NotifSystem.add('bonus', `+${m.reward}`, `Hoàn thành: ${m.name}`);

        const item = document.getElementById(`mission-${id}`);
        if (item) {
            item.classList.add('done', 'just-done');
            item.querySelector('.mission-star')?.classList.add('done');
            const btn = item.querySelector('.mission-btn');
            if (btn) { btn.textContent = '✓ Xong'; btn.disabled = true; }
        }

        Sound?.playSinewave?.(528);
        _spawnDustParticles();
        await _syncPoints(m.reward);
    }

    async function _syncPoints(amount) {
        if (!STATE.user?.token || STATE.user.token === 'local') return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.user.token}` },
                body: JSON.stringify({ amount }),
            });
            if (res.ok) {
                const data = await res.json();
                STATE.points = parseInt(data.points) || STATE.points;
                Auth.saveState(); UI.updateHUD();
            }
        } catch { console.warn('Offline: điểm đã lưu local.'); }
    }

    function _isDone(id) { return !!STATE.dailyMissions?.[`${id}_done`]; }

    function _updateBar(id, value, max) {
        const fill = document.querySelector(`#mission-${id} .mission-bar-fill`);
        if (fill) fill.style.width = `${Math.min((value / (max || 1)) * 100, 100)}%`;
    }

    /* ================================================================
       HỐ ĐEN — HEAL MESSAGES
       ================================================================ */
    const VOID_HEAL_MESSAGES = [
        'Bạn vừa buông bỏ điều gì đó. Cảm ơn bạn đã dũng cảm.',
        'Hố đen đã hút đi những gì nặng nề. Bạn nhẹ hơn rồi đó.',
        'Đôi khi buông bỏ là hành động mạnh mẽ nhất.',
        'Những gì bạn thả vào hư vô — chúng không còn là gánh nặng nữa.',
        'Vũ trụ đã nhận. Bạn được phép tiếp tục nhẹ nhàng hơn.',
        'Bóng tối không đáng sợ khi bạn biết mình có thể buông nó đi.',
        'Bạn không cần mang theo tất cả. Hố đen ở đây để giúp bạn.',
        'Một phần nặng nề vừa tan biến. Hít thở thật sâu nhé.',
        'Cảm xúc nặng nề không định nghĩa bạn. Bạn đã chứng minh điều đó.',
        'Giữa hư vô, bạn tìm lại được chính mình.',
    ];
    let _voidHealIdx = -1;

    function _getVoidHealMsg() {
        let idx;
        do { idx = Math.floor(Math.random() * VOID_HEAL_MESSAGES.length); }
        while (idx === _voidHealIdx && VOID_HEAL_MESSAGES.length > 1);
        _voidHealIdx = idx;
        return VOID_HEAL_MESSAGES[idx];
    }

    function _showVoidHealToast() {
        document.getElementById('heal-toast')?.remove();
        const el = document.createElement('div');
        el.id = 'heal-toast'; el.textContent = _getVoidHealMsg();
        document.body.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
        setTimeout(() => {
            el.classList.remove('visible'); el.classList.add('hiding');
            setTimeout(() => el.remove(), 550);
        }, 5000);
    }

    /* ================================================================
       HỐ ĐEN — RANDOM EFFECTS
       ================================================================ */
    const VOID_RANDOM_EFFECTS = [
        {
            id: 'stardust', label: '✦ Vũ trụ mở rộng', soundType: 'stardust',
            run(voidEl) {
                const r = voidEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                for (let i = 0; i < 3; i++) setTimeout(() => {
                    const ripple = document.createElement('div'); ripple.className = 'void-ripple-fx';
                    ripple.style.cssText = `position:fixed;width:${r.width}px;height:${r.height}px;
                        left:${cx - r.width / 2}px;top:${cy - r.height / 2}px;border-radius:50%;
                        border:2px solid rgba(180,100,255,${0.7 - i * 0.2});pointer-events:none;z-index:999;
                        animation:voidRippleOut 1.1s ease-out forwards;`;
                    document.body.appendChild(ripple); setTimeout(() => ripple.remove(), 1200);
                }, i * 180);
            },
        },
        {
            id: 'light', label: '✦ Ánh sáng giải phóng', soundType: 'light',
            run(voidEl) {
                const flash = document.createElement('div');
                flash.style.cssText = `position:fixed;inset:0;z-index:998;
                    background:radial-gradient(ellipse at center,rgba(255,240,255,.18) 0%,transparent 70%);
                    pointer-events:none;animation:voidLightFlash 1.2s ease-out forwards;`;
                document.body.appendChild(flash); setTimeout(() => flash.remove(), 1300);
                Object.assign(voidEl.style, { transition: 'box-shadow .25s ease', boxShadow: '0 0 120px rgba(255,220,255,.55),0 0 60px rgba(206,147,216,.6)' });
                setTimeout(() => { voidEl.style.boxShadow = ''; }, 900);
            },
        },
        {
            id: 'energy', label: '✦ Năng lượng tái sinh', soundType: 'energy',
            run(voidEl) {
                const r = voidEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                for (let i = 0; i < 20; i++) setTimeout(() => {
                    const p = document.createElement('div'); p.className = 'dust-particle';
                    const size = 3 + Math.random() * 5, angle = (Math.PI * 2 * i) / 20, dist = 50 + Math.random() * 80;
                    p.style.cssText = `width:${size}px;height:${size}px;left:${cx}px;top:${cy}px;
                        --dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist}px;
                        background:rgba(150,100,255,.85);box-shadow:0 0 4px rgba(180,120,255,.7);`;
                    document.body.appendChild(p); setTimeout(() => p.remove(), 1300);
                }, i * 30);
            },
        },
        {
            id: 'nebula', label: '✦ Tinh vân thức tỉnh', soundType: 'nebula',
            run(voidEl) {
                const r = voidEl.getBoundingClientRect();
                const el = document.createElement('div');
                el.style.cssText = `position:fixed;width:${r.width * 2.8}px;height:${r.height * 2.8}px;
                    left:${r.left + r.width / 2 - r.width * 1.4}px;top:${r.top + r.height / 2 - r.height * 1.4}px;
                    border-radius:50%;border:1.5px solid rgba(130,80,255,.5);
                    box-shadow:0 0 20px rgba(130,80,255,.3),inset 0 0 20px rgba(130,80,255,.15);
                    pointer-events:none;z-index:997;animation:voidNebulaRing 1.5s ease-out forwards;`;
                document.body.appendChild(el); setTimeout(() => el.remove(), 1600);
            },
        },
    ];
    let _lastEffectIdx = -1;

    function _triggerRandomEffect(voidEl) {
        let idx;
        do { idx = Math.floor(Math.random() * VOID_RANDOM_EFFECTS.length); }
        while (idx === _lastEffectIdx && VOID_RANDOM_EFFECTS.length > 1);
        _lastEffectIdx = idx;
        const effect = VOID_RANDOM_EFFECTS[idx];
        _showEffectBadge(effect.label);
        effect.run?.(voidEl);
        Sound?.playVoidEffect?.(effect.soundType);
    }

    function _showEffectBadge(label) {
        document.getElementById('void-effect-badge')?.remove();
        const el = document.createElement('div');
        el.id = 'void-effect-badge'; el.textContent = label;
        document.body.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
        setTimeout(() => {
            el.classList.remove('visible'); el.classList.add('hiding');
            setTimeout(() => el.remove(), 500);
        }, 2800);
    }

    /* ================================================================
       HỐ ĐEN — INIT & HOLD LOGIC
       ================================================================ */
    function _initVoid() {
        const voidEl = document.getElementById('void');
        const timerEl = document.getElementById('void-timer');
        const progressEl = document.getElementById('timer-progress');
        const countEl = document.getElementById('void-count');
        if (!voidEl || !timerEl || !progressEl || !countEl) return;

        const CIRC = 390;
        let startTime = null, isHolding = false;

        const startHold = (e) => {
            if (e?.preventDefault) e.preventDefault();
            if (_isDone('void_hold') || isHolding) return;
            isHolding = true;
            timerEl.classList.remove('hidden');
            startTime = Date.now();
            voidEl.style.cssText += ';transition:transform .5s ease,box-shadow .5s ease;transform:scale(1.15);box-shadow:0 0 80px rgba(206,147,216,.6),0 0 140px rgba(150,50,255,.3);';
            Sound?.startVoidWhoosh?.();

            voidHoldTimer = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                const remaining = Math.max(0, 10 - elapsed);
                countEl.textContent = Math.ceil(remaining);
                progressEl.style.strokeDashoffset = Math.max(0, CIRC * (1 - elapsed / 10));
                const scale = 1.15 + (elapsed / 10) * 0.3;
                voidEl.style.transform = `scale(${scale})`;
                const glow = Math.floor(80 + (elapsed / 10) * 80);
                voidEl.style.boxShadow = `0 0 ${glow}px rgba(206,147,216,.7),0 0 ${glow * 1.5}px rgba(150,50,255,.35)`;

                if (elapsed >= 10) {
                    clearInterval(voidHoldTimer); voidHoldTimer = null; isHolding = false;
                    timerEl.classList.add('hidden');
                    voidEl.style.transition = 'transform 1s ease,box-shadow 1s ease';
                    voidEl.style.transform = 'scale(1)'; voidEl.style.boxShadow = '';
                    Sound?.stopVoidWhoosh?.();
                    voidEl.style.animation = 'voidFlash .5s ease';
                    setTimeout(() => { voidEl.style.animation = ''; }, 600);
                    setTimeout(() => _triggerRandomEffect(voidEl), 200);
                    Sound?.playVoidRelease?.();
                    setTimeout(() => _showVoidHealToast(), 900);
                    document.dispatchEvent(new CustomEvent('void:released'));
                    complete('void_hold');
                    _spawnAbsorbText();
                }
            }, 100);
        };

        const stopHold = () => {
            if (!isHolding) return;
            isHolding = false;
            if (voidHoldTimer) { clearInterval(voidHoldTimer); voidHoldTimer = null; }
            Sound?.stopVoidWhoosh?.();
            timerEl.classList.add('hidden');
            progressEl.style.strokeDashoffset = CIRC;
            countEl.textContent = '10';
            voidEl.style.transition = 'transform .5s ease,box-shadow .5s ease';
            voidEl.style.transform = 'scale(1)'; voidEl.style.boxShadow = '';
        };

        _voidStartHold = startHold;
        voidEl.addEventListener('mousedown', startHold);
        voidEl.addEventListener('touchstart', startHold, { passive: false });
        voidEl.addEventListener('mouseup', stopHold);
        voidEl.addEventListener('mouseleave', stopHold);
        voidEl.addEventListener('touchend', stopHold);
        voidEl.addEventListener('touchcancel', stopHold);
    }

    function _spawnAbsorbText() {
        const container = document.getElementById('void-container');
        if (!container) return;
        ['Buông bỏ...', 'Tan biến...', 'Hư vô...'].forEach((t, i) => setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'void-absorb-text'; el.textContent = t;
            el.style.cssText = `left:${30 + Math.random() * 40}px;bottom:${80 + i * 20}px;--dx:${-20 + Math.random() * 40}px;--dy:${-40 - Math.random() * 30}px;`;
            container.appendChild(el); setTimeout(() => el.remove(), 1200);
        }, i * 300));
    }

    /* ================================================================
       BREATHING
       ================================================================ */
    function _startBreathing() {
        const overlay = document.getElementById('breathing-overlay');
        const circle = document.getElementById('breathing-circle');
        const text = document.getElementById('breathing-text');
        const info = document.getElementById('breathing-info');
        if (!overlay || !circle || !text || !info) return;
        overlay.classList.remove('hidden'); breathingCycle = 0;

        function runCycle() {
            if (breathingCycle >= 3) { overlay.classList.add('hidden'); complete('breathing'); return; }
            info.textContent = `Chu kỳ ${breathingCycle + 1}/3`; text.textContent = 'Hít vào';
            circle.style.cssText += ';transition:transform 4s ease-in-out,box-shadow 4s ease-in-out;transform:scale(1.5);box-shadow:0 0 80px rgba(206,147,216,.5);';
            setTimeout(() => { text.textContent = 'Giữ hơi'; circle.style.transition = 'transform 4s ease'; }, 4000);
            setTimeout(() => {
                text.textContent = 'Thở ra';
                circle.style.transition = 'transform 8s ease-in-out,box-shadow 8s ease-in-out';
                circle.style.transform = 'scale(.85)'; circle.style.boxShadow = '0 0 20px rgba(206,147,216,.1)';
            }, 8000);
            setTimeout(() => { breathingCycle++; runCycle(); }, 16000);
        }
        runCycle();
        document.getElementById('btn-skip-breathing')?.addEventListener('click', () => {
            overlay.classList.add('hidden'); breathingCycle = 0;
        }, { once: true });
    }

    /* ================================================================
       ASTRONAUT TIMER
       ================================================================ */
    function _initAstronautTimer() {
        const timerEl = document.getElementById('astronaut-timer');
        if (!timerEl) return;
        timerEl.classList.add('hidden');
        document.getElementById('astro-toggle-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            const collapsed = timerEl.classList.toggle('collapsed');
            e.currentTarget.title = collapsed ? 'Mở rộng timer' : 'Thu gọn timer';
        });
    }

    function _startAstronaut() {
        if (_isDone('patient_astronaut')) return;
        if (astroInterval) { clearInterval(astroInterval); astroInterval = null; }
        const timerEl = document.getElementById('astronaut-timer');
        const barEl = document.getElementById('astro-bar');
        const timeEl = document.getElementById('astro-time');
        if (!timerEl || !barEl || !timeEl) return;
        timerEl.classList.remove('hidden', 'collapsed', 'almost-done');

        const TOTAL = CONFIG.PATIENT_DURATION, start = Date.now();

        const _onTabSwitch = () => {
            if (!document.hidden) return;
            clearInterval(astroInterval); astroInterval = null;
            timerEl.classList.add('hidden'); timerEl.classList.remove('collapsed', 'almost-done');
            barEl.style.width = '0%'; timeEl.textContent = '30:00';
            document.removeEventListener('visibilitychange', _onTabSwitch);
            UI.showToast('🚀 Phi hành gia rời Trạm... Thử lại từ đầu nhé!');
        };
        document.addEventListener('visibilitychange', _onTabSwitch);

        astroInterval = setInterval(() => {
            const elapsed = Date.now() - start;
            const rem = Math.max(0, TOTAL - elapsed);
            const mins = Math.floor(rem / 60000);
            const secs = Math.floor((rem % 60000) / 1000);
            barEl.style.width = `${Math.min((elapsed / TOTAL) * 100, 100)}%`;
            timeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            if (rem < 5 * 60000) timerEl.classList.add('almost-done');
            if (elapsed >= TOTAL) {
                clearInterval(astroInterval); astroInterval = null;
                document.removeEventListener('visibilitychange', _onTabSwitch);
                complete('patient_astronaut');
                timerEl.classList.add('hidden'); timerEl.classList.remove('almost-done');
            }
        }, 1000);
    }

    /* ================================================================
       VOID NEGATIVE — Viết suy nghĩ tiêu cực & kéo vào hố đen
       Dùng input-panel chính, không tạo overlay riêng
       ================================================================ */
    function _startVoidNegative() {
        if (_isDone('void_negative')) return;

        const panel = document.getElementById('input-panel');
        const textarea = document.getElementById('signal-text');
        const btnSend = document.getElementById('btn-send');
        const toggleBtn = document.getElementById('btn-toggle-input');
        if (!panel || !textarea || !btnSend) return;

        // Mở input-panel
        panel.classList.remove('hidden');
        if (toggleBtn) toggleBtn.classList.add('is-hidden');

        // Hiện hint hướng dẫn bên trong panel
        let hint = document.getElementById('void-neg-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'void-neg-hint';
            hint.style.cssText = `
                background:rgba(80,20,160,.25);border:1px solid rgba(150,80,255,.35);
                border-radius:10px;padding:10px 14px;font-size:.82rem;line-height:1.55;
                color:rgba(206,147,216,.9);margin-bottom:8px;`;
            hint.innerHTML = `🌑 <strong>Giải phóng bóng tối</strong><br>
                <span style="opacity:.8">Viết ít nhất 3 dòng suy nghĩ tiêu cực, rồi gửi đi — sau đó kéo ngôi sao vào Hố Đen để buông bỏ.</span>`;
            const box = panel.querySelector('.center-input-box');
            if (box) box.insertBefore(hint, box.firstChild);
            else panel.insertBefore(hint, panel.firstChild);
        }

        // Validate: cần ≥ 3 dòng, ghi đè nút Gửi tạm thời
        const _onInput = () => {
            const lines = textarea.value.split('\n').filter(l => l.trim()).length;
            const enough = lines >= 3;
            btnSend.disabled = !enough;
            btnSend.style.opacity = enough ? '1' : '.5';
            const countEl = document.getElementById('void-neg-linecount');
            if (countEl) countEl.textContent = `${lines} / 3 dòng`;
        };

        // Line counter nhỏ bên dưới textarea
        let countEl = document.getElementById('void-neg-linecount');
        if (!countEl) {
            countEl = document.createElement('div');
            countEl.id = 'void-neg-linecount';
            countEl.style.cssText = `font-size:.75rem;color:rgba(206,147,216,.5);
                text-align:right;margin-top:2px;margin-bottom:4px;`;
            countEl.textContent = '0 / 3 dòng';
            textarea.insertAdjacentElement('afterend', countEl);
        }

        // Khởi tạo trạng thái nút
        btnSend.disabled = true;
        btnSend.style.opacity = '.5';

        textarea.addEventListener('input', _onInput);
        textarea.focus();

        // One-shot: sau khi gửi → spawn ngôi sao, dọn dẹp hook
        const _onSent = () => {
            document.removeEventListener('signal:sent', _onSent);
            textarea.removeEventListener('input', _onInput);
            btnSend.disabled = false;
            btnSend.style.opacity = '';
            hint?.remove();
            countEl?.remove();
            // Lấy text vừa gửi (textarea đã bị xoá bởi _close, dùng cache)
            _spawnDraggableNegStar(_lastNegText || '');
        };

        // Cache text trước khi panel đóng
        let _lastNegText = '';
        const _cacheText = () => { _lastNegText = textarea.value.trim(); };
        btnSend.addEventListener('click', _cacheText, { once: true });

        document.addEventListener('signal:sent', _onSent);
    }

    function _spawnDraggableNegStar(text) {
        const voidEl = document.getElementById('void');
        if (!voidEl) { complete('void_negative'); return; }

        const star = document.createElement('div');
        star.id = 'neg-drag-star';
        star.style.cssText = `
            position:fixed;z-index:1999;width:54px;height:54px;
            border-radius:50%;background:radial-gradient(circle,rgba(180,100,255,.9),rgba(80,20,160,.7));
            box-shadow:0 0 20px rgba(150,80,255,.8),0 0 40px rgba(100,40,200,.4);
            display:flex;align-items:center;justify-content:center;
            font-size:1.4rem;cursor:grab;user-select:none;touch-action:none;
            left:50%;top:55%;transform:translate(-50%,-50%);
            animation:negStarPulse 1.5s ease-in-out infinite;`;
        star.textContent = '💜';

        const hint = document.createElement('div');
        hint.style.cssText = `position:fixed;z-index:1998;left:50%;top:calc(55% + 40px);
            transform:translateX(-50%);color:rgba(206,147,216,.8);font-size:.82rem;
            text-align:center;pointer-events:none;white-space:nowrap;`;
        hint.textContent = '✦ Kéo ngôi sao vào Hố Đen để buông bỏ';

        document.body.appendChild(star);
        document.body.appendChild(hint);

        // Add animation keyframe if not exists
        if (!document.getElementById('neg-star-style')) {
            const s = document.createElement('style');
            s.id = 'neg-star-style';
            s.textContent = `@keyframes negStarPulse{0%,100%{box-shadow:0 0 20px rgba(150,80,255,.8),0 0 40px rgba(100,40,200,.4)}50%{box-shadow:0 0 35px rgba(180,100,255,1),0 0 70px rgba(130,50,255,.6)}}`;
            document.head.appendChild(s);
        }

        let dragging = false, startX, startY, origLeft, origTop;

        const getPos = e => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

        const onStart = e => {
            e.preventDefault();
            dragging = true;
            const { x, y } = getPos(e);
            const rect = star.getBoundingClientRect();
            startX = x - rect.left - rect.width / 2;
            startY = y - rect.top - rect.height / 2;
            star.style.cursor = 'grabbing';
            star.style.animation = 'none';
            hint.style.display = 'none';
        };

        const onMove = e => {
            if (!dragging) return;
            e.preventDefault();
            const { x, y } = getPos(e);
            star.style.left = `${x - startX - 27}px`;
            star.style.top = `${y - startY - 27}px`;
            star.style.transform = 'none';

            // Check overlap with void
            const sr = star.getBoundingClientRect();
            const vr = voidEl.getBoundingClientRect();
            const overVoid = sr.left < vr.right && sr.right > vr.left && sr.top < vr.bottom && sr.bottom > vr.top;
            voidEl.style.boxShadow = overVoid
                ? '0 0 80px rgba(206,147,216,.9),0 0 160px rgba(150,50,255,.7)'
                : '';
        };

        const onEnd = e => {
            if (!dragging) return;
            dragging = false;
            star.style.cursor = 'grab';
            voidEl.style.boxShadow = '';

            const sr = star.getBoundingClientRect();
            const vr = voidEl.getBoundingClientRect();
            const overVoid = sr.left < vr.right && sr.right > vr.left && sr.top < vr.bottom && sr.bottom > vr.top;

            if (overVoid) {
                // Absorb animation
                star.style.transition = 'transform .4s ease,opacity .4s ease';
                star.style.transform = `translate(${vr.left + vr.width / 2 - sr.left - 27}px,${vr.top + vr.height / 2 - sr.top - 27}px) scale(0)`;
                star.style.opacity = '0';
                hint.remove();
                setTimeout(() => {
                    star.remove();
                    _triggerRandomEffect(voidEl);
                    _showVoidHealToast();
                    complete('void_negative');
                }, 420);
            } else {
                // Snap back to center
                star.style.transition = 'left .3s ease,top .3s ease,transform .3s ease';
                star.style.left = '50%'; star.style.top = '55%';
                star.style.transform = 'translate(-50%,-50%)';
                star.style.animation = 'negStarPulse 1.5s ease-in-out infinite';
                hint.style.display = '';
                setTimeout(() => star.style.transition = '', 320);
            }
        };

        star.addEventListener('mousedown', onStart);
        star.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    }

    /* ================================================================
       LIGHT CANDLE — Thắp nến (gọi từ Stars module khi user react listen)
       ================================================================ */
    function onCandleLit() {
        if (_isDone('light_candle')) return;
        const cur = (STATE.dailyMissions['light_candle'] || 0) + 1;
        progress('light_candle', cur);
        _renderMissions(); // refresh để cập nhật badge tiến trình
    }

    /* ================================================================
       HUG METEOR — Gửi ôm cho sao sắp tan biến (gọi từ Stars module)
       ================================================================ */
    function onHugMeteor() {
        if (_isDone('hug_meteor')) return;
        complete('hug_meteor');
        setTimeout(() => _renderMissions(), 300);
    }


    function _getStreakReward(len) {
        if (len >= 7) return 200; if (len >= 4) return 50; if (len >= 2) return 20; return 10;
    }

    function _doCheckIn() {
        const today = _today();
        if (!Array.isArray(STATE.streak)) STATE.streak = [];
        if (STATE.streak.includes(today)) return;
        STATE.streak.push(today);
        if (STATE.streak.length > 7) STATE.streak = STATE.streak.slice(-7);
        const len = STATE.streak.length, reward = _getStreakReward(len);
        STATE.points = (STATE.points || 0) + reward;
        Auth.saveState(); UI.updateHUD();
        NotifSystem.add('bonus', `+${reward}`, `Điểm danh ngày ${len} ✅`);
        _spawnStreakStars(); Sound?.playSinewave?.(528);
        if (len === 7) UI.showToast(`🏅 7 ngày liên tiếp! +${reward} ✨ Danh hiệu "Người giữ lửa Trạm"!`, 5000);
        else if (len >= 4) UI.showToast(`🔥 Streak ${len} ngày! +${reward} ✨`, 4000);
        else UI.showToast(`⭐ Điểm danh ngày ${len}! +${reward} ✨`, 3500);
        _syncPoints(reward);
        _syncStreakToServer(STATE.streak);
        setTimeout(() => _renderStreak(), 50);
    }

    function _spawnStreakStars() {
        const el = document.getElementById('streak-mini');
        if (!el) { _spawnDustParticles(); return; }
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        for (let i = 0; i < 16; i++) setTimeout(() => {
            const p = document.createElement('div'); p.className = 'dust-particle';
            const sz = 3 + Math.random() * 5, angle = (Math.PI * 2 * i) / 16, dist = 40 + Math.random() * 60;
            p.style.cssText = `width:${sz}px;height:${sz}px;left:${cx}px;top:${cy}px;
                --dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist}px;background:var(--accent-gold);`;
            document.body.appendChild(p); setTimeout(() => p.remove(), 1300);
        }, i * 40);
    }

    function _renderStreak() {
        const el = document.getElementById('streak-mini');
        if (!el) return;
        const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        const dowUTC = new Date().getUTCDay();
        const todayIdx = dowUTC === 0 ? 6 : dowUTC - 1;
        const today = _today();
        if (!Array.isArray(STATE.streak)) STATE.streak = [];
        const checkedIn = STATE.streak.includes(today);
        el.innerHTML = '';
        days.forEach((d, i) => {
            const dateStr = _getDateForDayIndex(i), done = STATE.streak.includes(dateStr);
            const isToday = i === todayIdx, canCheckIn = isToday && !checkedIn;
            const div = document.createElement('div');
            div.className = ['streak-day', done ? 'done' : '', isToday ? 'today' : '', i === 6 ? 'special' : '', canCheckIn ? 'can-checkin' : ''].filter(Boolean).join(' ');
            if (canCheckIn) {
                div.innerHTML = `<span class="streak-day-label">${d}</span><span class="streak-checkin-icon">✦</span><span class="streak-checkin-hint">Tap!</span>`;
                div.title = 'Bấm để điểm danh hôm nay!'; div.setAttribute('role', 'button');
                div.onclick = e => { e.stopPropagation(); _doCheckIn(); };
            } else if (isToday && done) {
                div.innerHTML = `<span class="streak-day-label">${d}</span><span style="font-size:.85rem;color:rgba(206,147,216,.9)">✓</span>`;
                div.title = 'Đã điểm danh hôm nay ✓';
            } else {
                div.textContent = d;
                if (done) div.title = 'Đã điểm danh ✓';
            }
            el.appendChild(div);
        });
    }

    async function _syncStreakToServer(dates) {
        if (!STATE.user?.token || STATE.user.token === 'local') return;
        try {
            await fetch(`${CONFIG.API_BASE}/auth/streak`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.user.token}` },
                body: JSON.stringify({ dates }),
            });
        } catch { console.warn('Offline: streak lưu local.'); }
    }

    /* ── Dust particles ── */
    function _spawnDustParticles() {
        for (let i = 0; i < 12; i++) setTimeout(() => {
            const p = document.createElement('div'); p.className = 'dust-particle';
            const sz = 3 + Math.random() * 4;
            p.style.cssText = `width:${sz}px;height:${sz}px;
                left:${30 + Math.random() * 40}vw;top:${40 + Math.random() * 20}vh;
                --dx:${-80 + Math.random() * 160}px;--dy:${-100 - Math.random() * 100}px;`;
            document.body.appendChild(p); setTimeout(() => p.remove(), 1300);
        }, i * 80);
    }

    /* ================================================================
       INPUT PANEL — toggle, mood hint, send, +5 điểm
       ================================================================ */
    function _initInput() {
        const panel = document.getElementById('input-panel');
        const textarea = document.getElementById('signal-text');
        const charCount = document.getElementById('char-count');
        const btnSend = document.getElementById('btn-send');
        if (!panel || !textarea || !charCount || !btnSend) return;

        panel.classList.add('hidden');

        /* Toggle button */
        let toggleBtn = document.getElementById('btn-toggle-input');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'btn-toggle-input'; toggleBtn.className = 'btn-toggle-input';
            toggleBtn.innerHTML = `<span class="btn-toggle-icon">🔭</span><span>Gửi tín hiệu</span>`;
            document.body.appendChild(toggleBtn);
        }
        toggleBtn.addEventListener('click', () => {
            panel.classList.remove('hidden');
            toggleBtn.classList.add('is-hidden');
            textarea.focus();
        });

        /* Send icon */
        if (!btnSend.querySelector('.btn-send-icon'))
            btnSend.innerHTML = `<span class="btn-send-icon">🔭</span><span>Gửi tín hiệu</span>`;

        /* Cancel button */
        let btnCancel = document.getElementById('btn-cancel-signal');
        if (!btnCancel) {
            btnCancel = document.createElement('button');
            btnCancel.id = 'btn-cancel-signal'; btnCancel.className = 'btn-cancel-signal';
            btnCancel.textContent = 'Hủy';
        }

        const footer = panel.querySelector('.center-input-footer');
        if (footer) {
            let actionsDiv = footer.querySelector('.input-actions');
            if (!actionsDiv) {
                actionsDiv = document.createElement('div');
                actionsDiv.className = 'input-actions';
                actionsDiv.append(btnCancel, btnSend);
                footer.appendChild(actionsDiv);
            }
        } else {
            btnSend.parentNode?.insertBefore(btnCancel, btnSend);
        }

        const _close = () => {
            panel.classList.add('hidden');
            toggleBtn.classList.remove('is-hidden');
            textarea.value = ''; charCount.textContent = '0';
            _hideMoodHint();
        };

        btnCancel.addEventListener('click', _close);

        textarea.addEventListener('input', () => {
            charCount.textContent = textarea.value.length;
            _hasMood(textarea.value) ? _showMoodHint() : _hideMoodHint();
        });

        document.querySelectorAll('.star-type').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.star-type').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                STATE.activeStarType = btn.dataset.type;
            });
        });

        btnSend.addEventListener('click', () => {
            const text = textarea.value.trim();
            if (!text) { UI.showToast('✏️ Hãy viết gì đó trước khi gửi nhé~', 3000); textarea.focus(); return; }
            if (_isToxic(text)) { UI.showToast('🌙 Tín hiệu chứa nội dung không phù hợp. Hãy thử lại nhé~', 4000); return; }

            Stars.sendSignal(text, STATE.activeStarType || 'shooting', true, _hasMood(text));

            STATE.points = (STATE.points || 0) + 5;
            Auth.saveState(); UI.updateHUD();
            NotifSystem.add('earn', '+5', 'Gửi tín hiệu lên trời ✨');
            _spawnSendPointLabel(btnSend);
            document.dispatchEvent(new CustomEvent('signal:sent', { detail: { text } }));
            _close();
            UI.showSendBlessing();
        });
    }

    function _spawnSendPointLabel(anchor) {
        const el = document.createElement('div');
        el.className = 'send-points-label'; el.textContent = '+5 ✨';
        if (anchor) {
            const r = anchor.getBoundingClientRect();
            el.style.cssText = `left:${r.left + r.width / 2 - 18}px;top:${r.top - 4}px;`;
        } else {
            el.style.cssText = 'left:50%;top:60%;transform:translateX(-50%);';
        }
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1200);
    }

    function _showMoodHint() {
        let hint = document.getElementById('mood-hint-bar');
        if (hint) { hint.classList.add('visible'); return; }
        hint = document.createElement('div');
        hint.id = 'mood-hint-bar'; hint.className = 'mood-hint-bar';
        hint.innerHTML = `<span class="mood-hint-icon">💜</span>
            <span>Mình thấy bạn đang không ổn. Hãy để tâm sự này bay lên và được lắng nghe.</span>`;
        const panel = document.getElementById('input-panel');
        const box = panel?.querySelector('.center-input-box');
        const footer = panel?.querySelector('.center-input-footer');
        if (box && footer) box.insertBefore(hint, footer); else panel?.appendChild(hint);
        requestAnimationFrame(() => requestAnimationFrame(() => hint.classList.add('visible')));
    }

    function _hideMoodHint() {
        const hint = document.getElementById('mood-hint-bar');
        if (!hint) return;
        hint.classList.remove('visible');
        setTimeout(() => hint.remove(), 350);
    }

    return { init, progress, complete, onCandleLit, onHugMeteor };
})();