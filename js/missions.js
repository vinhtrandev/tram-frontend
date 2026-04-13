/* ================================================
   TRẠM GỬI TÍN HIỆU - missions.js (FULL v3)
   + NotifSystem: ghi lịch sử khi hoàn thành nhiệm vụ,
     điểm danh streak, và void release
   ================================================ */

const Missions = (() => {

    let voidHoldTimer = null;
    let breathingCycle = 0;
    let astroInterval = null;
    let astroElapsed = 0;

    const TOXIC_WORDS = [
        'chết', 'giết', 'địt', 'đụ', 'fuck', 'shit',
        'ngu', 'óc chó', 'dm', 'dcm', 'vl', 'cl',
        'đéo', 'mẹ mày', 'con chó', 'thằng chó', 'đồ chó',
        'cút', 'xéo', 'rape', 'kill', 'die', 'hate'
    ];

    function _normalize(str) { return str.toLowerCase().normalize('NFC'); }
    function _isToxic(text) {
        const n = _normalize(text);
        return TOXIC_WORDS.some(w => n.includes(_normalize(w)));
    }

    /* ---------- INIT ---------- */
    function init() {
        _resetDailyIfNeeded();
        _sanitizeStreak();
        _renderMissions();
        _renderStreak();
        _initVoid();
        _initInput();
        _initAstronautTimer();
    }

    /* ---------- DAILY RESET ---------- */
    function _resetDailyIfNeeded() {
        const today = _today();
        if (!STATE.dailyMissions || STATE.dailyMissions._date !== today) {
            STATE.dailyMissions = { _date: today };
            Auth.saveState();
        }
    }

    function _sanitizeStreak() {
        if (!Array.isArray(STATE.streak)) { STATE.streak = []; Auth.saveState(); return; }
        const today = _today();
        const now = new Date();
        const dow = now.getDay();
        const mondayOffset = dow === 0 ? -6 : 1 - dow;
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        const before = STATE.streak.length;
        STATE.streak = STATE.streak.filter(dateStr => {
            if (!dateStr || typeof dateStr !== 'string') return false;
            if (dateStr > today) return false;
            const d = new Date(dateStr);
            return d >= monday && d <= sunday;
        });
        if (STATE.streak.length !== before) Auth.saveState();
    }

    function _today() { return new Date().toISOString().slice(0, 10); }

    /* ---------- RENDER MISSIONS ---------- */
    function _renderMissions() {
        const el = document.getElementById('missions-list');
        if (!el) return;
        el.innerHTML = '';
        CONFIG.MISSIONS.forEach(m => {
            const done = _isDone(m.id);
            const prog = STATE.dailyMissions[m.id] || 0;
            const pct = m.max ? Math.min((prog / m.max) * 100, 100) : (done ? 100 : 0);
            const item = document.createElement('div');
            item.className = 'mission-item' + (done ? ' done' : '');
            item.id = `mission-${m.id}`;
            item.innerHTML = `
        <div class="mission-star ${done ? 'done' : ''}">${m.icon}</div>
        <div class="mission-body">
          <div class="mission-name">${m.name}</div>
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
        if (m.id === 'breathing') return `<button class="mission-btn" data-action="breathing">Bắt đầu</button>`;
        if (m.id === 'void_hold') return `<button class="mission-btn" data-action="void_hold">Vào Hố Đen</button>`;
        if (m.id === 'patient_astronaut') return `<button class="mission-btn" data-action="astronaut">Bắt đầu</button>`;
        if (m.id === 'shooting_star') return `<button class="mission-btn" disabled>Chờ sao băng</button>`;
        return `<button class="mission-btn" disabled>Tự động</button>`;
    }

    function _bindMissionBtn(item, m) {
        const btn = item.querySelector('[data-action]');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (btn.dataset.action === 'breathing') _startBreathing();
            if (btn.dataset.action === 'void_hold') {
                const voidEl = document.getElementById('void');
                if (voidEl) voidEl.dispatchEvent(new MouseEvent('mousedown'));
            }
            if (btn.dataset.action === 'astronaut') _startAstronaut();
        });
    }

    /* ---------- PROGRESS / COMPLETE ---------- */
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
        STATE.dailyMissions[id + '_done'] = true;
        STATE.dailyMissions[id] = m.max || 1;
        STATE.points = (parseInt(STATE.points) || 0) + m.reward;
        Auth.saveState();
        UI.updateHUD();
        UI.showToast(`✅ ${m.name} hoàn thành! +${m.reward} ✨`);
        setTimeout(() => UI.showHealingQuote(), 1200);
        _updateBar(id, m.max || 1, m.max || 1);

        // Ghi nhận vào lịch sử Tinh Tú
        NotifSystem.add('bonus', `+${m.reward}`, `Hoàn thành: ${m.name}`);

        const item = document.getElementById(`mission-${id}`);
        if (item) {
            item.classList.add('done', 'just-done');
            const starEl = item.querySelector('.mission-star');
            if (starEl) starEl.classList.add('done');
            const btn = item.querySelector('.mission-btn');
            if (btn) { btn.textContent = '✓ Xong'; btn.disabled = true; }
        }
        if (typeof Sound !== 'undefined') Sound.playSinewave(528);
        _spawnDustParticles();
        await _syncPointsToServer(m.reward);
    }

    async function _syncPointsToServer(amount) {
        if (!STATE.user?.token || STATE.user.token === 'local') return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.user.token}` },
                body: JSON.stringify({ amount })
            });
            if (res.ok) {
                const data = await res.json();
                STATE.points = parseInt(data.points) || STATE.points;
                Auth.saveState(); UI.updateHUD();
            }
        } catch { console.warn('Offline: điểm đã lưu local.'); }
    }

    function _isDone(id) {
        if (!STATE.dailyMissions) return false;
        return !!STATE.dailyMissions[id + '_done'];
    }

    function _updateBar(id, value, max) {
        const item = document.getElementById(`mission-${id}`);
        if (!item) return;
        const fill = item.querySelector('.mission-bar-fill');
        if (fill) fill.style.width = `${Math.min((value / (max || 1)) * 100, 100)}%`;
    }

    /* ================================================
       HỐ ĐEN — VOID HEAL MESSAGES
       ================================================ */

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
        const old = document.getElementById('heal-toast');
        if (old) old.remove();
        const el = document.createElement('div');
        el.id = 'heal-toast';
        el.textContent = _getVoidHealMsg();
        document.body.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
        setTimeout(() => {
            el.classList.remove('visible');
            el.classList.add('hiding');
            setTimeout(() => { if (el.parentNode) el.remove(); }, 550);
        }, 5000);
    }

    /* ================================================
       HỐ ĐEN — RANDOM EFFECTS
       ================================================ */

    const VOID_RANDOM_EFFECTS = [
        {
            id: 'stardust',
            label: '✦ Vũ trụ mở rộng',
            soundType: 'stardust',
            run(voidEl) {
                const r = voidEl.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        const ripple = document.createElement('div');
                        ripple.className = 'void-ripple-fx';
                        ripple.style.cssText = `
                            position:fixed;
                            width:${r.width}px; height:${r.height}px;
                            left:${cx - r.width / 2}px; top:${cy - r.height / 2}px;
                            border-radius:50%;
                            border:2px solid rgba(180,100,255,${0.7 - i * 0.2});
                            pointer-events:none; z-index:999;
                            animation: voidRippleOut 1.1s ease-out forwards;
                        `;
                        document.body.appendChild(ripple);
                        setTimeout(() => ripple.remove(), 1200);
                    }, i * 180);
                }
            }
        },
        {
            id: 'light',
            label: '✦ Ánh sáng giải phóng',
            soundType: 'light',
            run(voidEl) {
                const flash = document.createElement('div');
                flash.style.cssText = `
                    position:fixed; inset:0; z-index:998;
                    background:radial-gradient(ellipse at center,
                        rgba(255,240,255,0.18) 0%, transparent 70%);
                    pointer-events:none;
                    animation: voidLightFlash 1.2s ease-out forwards;
                `;
                document.body.appendChild(flash);
                setTimeout(() => flash.remove(), 1300);

                voidEl.style.transition = 'box-shadow 0.25s ease';
                voidEl.style.boxShadow = '0 0 120px rgba(255,220,255,0.55), 0 0 60px rgba(206,147,216,0.6)';
                setTimeout(() => { voidEl.style.boxShadow = ''; }, 900);
            }
        },
        {
            id: 'energy',
            label: '✦ Năng lượng tái sinh',
            soundType: 'energy',
            run(voidEl) {
                const r = voidEl.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                for (let i = 0; i < 20; i++) {
                    setTimeout(() => {
                        const p = document.createElement('div');
                        p.className = 'dust-particle';
                        const size = 3 + Math.random() * 5;
                        const angle = (Math.PI * 2 * i) / 20;
                        const dist = 50 + Math.random() * 80;
                        p.style.cssText = `
                            width:${size}px; height:${size}px;
                            left:${cx}px; top:${cy}px;
                            --dx:${Math.cos(angle) * dist}px;
                            --dy:${Math.sin(angle) * dist}px;
                            background:rgba(150,100,255,0.85);
                            box-shadow:0 0 4px rgba(180,120,255,0.7);
                        `;
                        document.body.appendChild(p);
                        setTimeout(() => p.remove(), 1300);
                    }, i * 30);
                }
            }
        },
        {
            id: 'nebula',
            label: '✦ Tinh vân thức tỉnh',
            soundType: 'nebula',
            run(voidEl) {
                const r = voidEl.getBoundingClientRect();
                const el = document.createElement('div');
                el.style.cssText = `
                    position:fixed;
                    width:${r.width * 2.8}px; height:${r.height * 2.8}px;
                    left:${r.left + r.width / 2 - r.width * 1.4}px;
                    top:${r.top + r.height / 2 - r.height * 1.4}px;
                    border-radius:50%;
                    border:1.5px solid rgba(130,80,255,0.5);
                    box-shadow:0 0 20px rgba(130,80,255,0.3), inset 0 0 20px rgba(130,80,255,0.15);
                    pointer-events:none; z-index:997;
                    animation: voidNebulaRing 1.5s ease-out forwards;
                `;
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 1600);

                for (let i = 0; i < 12; i++) {
                    setTimeout(() => {
                        const p = document.createElement('div');
                        p.className = 'dust-particle';
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const angle = (Math.PI * 2 * i) / 12;
                        const rad = r.width * 1.3;
                        const size = 2 + Math.random() * 3;
                        p.style.cssText = `
                            width:${size}px; height:${size}px;
                            left:${cx + Math.cos(angle) * rad}px;
                            top:${cy + Math.sin(angle) * rad}px;
                            --dx:${Math.cos(angle) * 30}px;
                            --dy:${Math.sin(angle) * 30}px;
                            background:rgba(200,160,255,0.9);
                        `;
                        document.body.appendChild(p);
                        setTimeout(() => p.remove(), 1300);
                    }, i * 50);
                }
            }
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
        if (effect.run) effect.run(voidEl);
        if (typeof Sound !== 'undefined' && Sound.playVoidEffect) {
            Sound.playVoidEffect(effect.soundType);
        }
    }

    function _showEffectBadge(label) {
        const old = document.getElementById('void-effect-badge');
        if (old) old.remove();
        const el = document.createElement('div');
        el.id = 'void-effect-badge';
        el.textContent = label;
        document.body.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
        setTimeout(() => {
            el.classList.remove('visible');
            el.classList.add('hiding');
            setTimeout(() => { if (el.parentNode) el.remove(); }, 500);
        }, 2800);
    }

    /* ================================================
       HỐ ĐEN — HÚT SAO TỐI
       ================================================ */

    function _voidSuckStars(voidEl, onDone) {
        const stars = Array.from(document.querySelectorAll('.star-dot.has-react'));
        const vr = voidEl.getBoundingClientRect();
        const cx = vr.left + vr.width / 2;
        const cy = vr.top + vr.height / 2;

        const nearby = stars.map(s => {
            const r = s.getBoundingClientRect();
            const dx = (r.left + r.width / 2) - cx;
            const dy = (r.top + r.height / 2) - cy;
            return { el: s, r, dist: Math.sqrt(dx * dx + dy * dy) };
        }).sort((a, b) => a.dist - b.dist).slice(0, 6);

        if (!nearby.length) { onDone && onDone(); return; }

        nearby.forEach(({ r }, i) => {
            const clone = document.createElement('div');
            clone.style.cssText = `
                position:fixed; border-radius:50%; pointer-events:none; z-index:999;
                width:${r.width}px; height:${r.height}px;
                left:${r.left + r.width / 2 - r.width / 2}px;
                top:${r.top + r.height / 2 - r.height / 2}px;
                background:rgba(180,100,255,0.85);
                box-shadow:0 0 10px rgba(180,100,255,0.7);
                transition: left ${0.55 + i * 0.07}s cubic-bezier(0.4,0,1,1),
                            top ${0.55 + i * 0.07}s cubic-bezier(0.4,0,1,1),
                            opacity ${0.55 + i * 0.07}s ease-in,
                            transform ${0.55 + i * 0.07}s ease-in;
            `;
            document.body.appendChild(clone);
            setTimeout(() => {
                clone.style.left = `${cx - r.width / 4}px`;
                clone.style.top = `${cy - r.height / 4}px`;
                clone.style.transform = 'scale(0)';
                clone.style.opacity = '0';
            }, 40 + i * 70);
            setTimeout(() => clone.remove(), 700 + i * 70);
        });

        setTimeout(() => onDone && onDone(), 800 + nearby.length * 70);
    }

    /* ================================================
       HỐ ĐEN — INIT & HOLD LOGIC
       ================================================ */

    function _initVoid() {
        const voidEl = document.getElementById('void');
        const timerEl = document.getElementById('void-timer');
        const progressEl = document.getElementById('timer-progress');
        const countEl = document.getElementById('void-count');
        if (!voidEl || !timerEl || !progressEl || !countEl) return;

        const CIRC = 163;
        let startTime = null;
        let isHolding = false;

        const startHold = (e) => {
            e.preventDefault();
            if (_isDone('void_hold') || isHolding) return;
            isHolding = true;
            timerEl.classList.remove('hidden');
            startTime = Date.now();

            voidEl.style.transition = 'transform 0.5s ease, box-shadow 0.5s ease';
            voidEl.style.transform = 'scale(1.15)';
            voidEl.style.boxShadow = '0 0 80px rgba(206,147,216,0.6), 0 0 140px rgba(150,50,255,0.3)';

            if (typeof Sound !== 'undefined') Sound.startVoidWhoosh();

            voidHoldTimer = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                const remaining = Math.max(0, 10 - elapsed);
                countEl.textContent = Math.ceil(remaining);
                progressEl.style.strokeDashoffset = Math.max(0, CIRC * (1 - elapsed / 10));

                const scale = 1.15 + (elapsed / 10) * 0.3;
                voidEl.style.transform = `scale(${scale})`;
                const glow = Math.floor(80 + (elapsed / 10) * 80);
                voidEl.style.boxShadow = `0 0 ${glow}px rgba(206,147,216,0.7), 0 0 ${glow * 1.5}px rgba(150,50,255,0.35)`;

                if (elapsed >= 10) {
                    clearInterval(voidHoldTimer);
                    voidHoldTimer = null;
                    isHolding = false;
                    timerEl.classList.add('hidden');

                    _voidSuckStars(voidEl, () => {
                        voidEl.style.transition = 'transform 1s ease, box-shadow 1s ease';
                        voidEl.style.transform = 'scale(1)';
                        voidEl.style.boxShadow = '';

                        if (typeof Sound !== 'undefined') Sound.stopVoidWhoosh();

                        voidEl.style.animation = 'voidFlash 0.5s ease';
                        setTimeout(() => { voidEl.style.animation = ''; }, 600);

                        setTimeout(() => _triggerRandomEffect(voidEl), 200);

                        if (typeof Sound !== 'undefined') Sound.playVoidRelease();

                        setTimeout(() => _showVoidHealToast(), 900);

                        // Dispatch event để app.js hook bắt và ghi NotifSystem
                        document.dispatchEvent(new CustomEvent('void:released'));

                        complete('void_hold');
                        _spawnAbsorbText();
                    });
                }
            }, 100);
        };

        const stopHold = () => {
            if (!isHolding) return;
            isHolding = false;
            if (voidHoldTimer) { clearInterval(voidHoldTimer); voidHoldTimer = null; }
            if (typeof Sound !== 'undefined') Sound.stopVoidWhoosh();
            timerEl.classList.add('hidden');
            progressEl.style.strokeDashoffset = CIRC;
            countEl.textContent = '10';
            voidEl.style.transition = 'transform 0.5s ease, box-shadow 0.5s ease';
            voidEl.style.transform = 'scale(1)';
            voidEl.style.boxShadow = '';
        };

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
        const texts = ['Buông bỏ...', 'Tan biến...', 'Hư vô...'];
        texts.forEach((t, i) => {
            setTimeout(() => {
                const el = document.createElement('div');
                el.className = 'void-absorb-text';
                el.textContent = t;
                el.style.cssText = `left:${30 + Math.random() * 40}px; bottom:${80 + i * 20}px;
                    --dx:${-20 + Math.random() * 40}px; --dy:${-40 - Math.random() * 30}px;`;
                container.appendChild(el);
                setTimeout(() => el.remove(), 1200);
            }, i * 300);
        });
    }

    /* ---------- BREATHING ---------- */
    function _startBreathing() {
        const overlay = document.getElementById('breathing-overlay');
        const circle = document.getElementById('breathing-circle');
        const text = document.getElementById('breathing-text');
        const info = document.getElementById('breathing-info');
        if (!overlay || !circle || !text || !info) return;

        overlay.classList.remove('hidden');
        breathingCycle = 0;

        function runCycle() {
            if (breathingCycle >= 3) { overlay.classList.add('hidden'); complete('breathing'); return; }
            info.textContent = `Chu kỳ ${breathingCycle + 1}/3`;
            text.textContent = 'Hít vào';
            circle.style.transition = 'transform 4s ease-in-out, box-shadow 4s ease-in-out';
            circle.style.transform = 'scale(1.5)';
            circle.style.boxShadow = '0 0 80px rgba(206,147,216,0.5)';
            setTimeout(() => { text.textContent = 'Giữ hơi'; circle.style.transition = 'transform 4s ease'; }, 4000);
            setTimeout(() => {
                text.textContent = 'Thở ra';
                circle.style.transition = 'transform 8s ease-in-out, box-shadow 8s ease-in-out';
                circle.style.transform = 'scale(0.85)';
                circle.style.boxShadow = '0 0 20px rgba(206,147,216,0.1)';
            }, 8000);
            setTimeout(() => { breathingCycle++; runCycle(); }, 16000);
        }
        runCycle();

        const skipBtn = document.getElementById('btn-skip-breathing');
        if (skipBtn) { skipBtn.onclick = () => { overlay.classList.add('hidden'); breathingCycle = 0; }; }
    }

    /* ---------- ASTRONAUT TIMER ---------- */
    function _initAstronautTimer() {
        const timerEl = document.getElementById('astronaut-timer');
        if (timerEl) timerEl.classList.add('hidden');
    }

    function _startAstronaut() {
        if (_isDone('patient_astronaut')) return;
        if (astroInterval) { clearInterval(astroInterval); astroInterval = null; }
        const timerEl = document.getElementById('astronaut-timer');
        const barEl = document.getElementById('astro-bar');
        const timeEl = document.getElementById('astro-time');
        if (!timerEl || !barEl || !timeEl) return;

        timerEl.classList.remove('hidden');
        const TOTAL_MS = CONFIG.PATIENT_DURATION;
        const start = Date.now();

        function _onTabSwitch() {
            if (document.hidden) {
                clearInterval(astroInterval); astroInterval = null;
                barEl.style.width = '0%'; timeEl.textContent = '30:00';
                timerEl.classList.add('hidden');
                document.removeEventListener('visibilitychange', _onTabSwitch);
                UI.showToast('🚀 Phi hành gia rời Trạm... Thử lại từ đầu nhé!');
            }
        }
        document.addEventListener('visibilitychange', _onTabSwitch);

        astroInterval = setInterval(() => {
            const elapsed = Date.now() - start;
            const pct = Math.min((elapsed / TOTAL_MS) * 100, 100);
            const rem = Math.max(0, TOTAL_MS - elapsed);
            const mins = Math.floor(rem / 60000);
            const secs = Math.floor((rem % 60000) / 1000);
            barEl.style.width = `${pct}%`;
            timeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            if (elapsed >= TOTAL_MS) {
                clearInterval(astroInterval); astroInterval = null;
                document.removeEventListener('visibilitychange', _onTabSwitch);
                complete('patient_astronaut');
                timerEl.classList.add('hidden');
            }
        }, 1000);
    }

    /* ================================================
       STREAK
       ================================================ */
    function _getStreakReward(len) {
        if (len >= 7) return 200; if (len >= 4) return 50;
        if (len >= 2) return 20; return 10;
    }

    function _doCheckIn() {
        const today = _today();
        if (!Array.isArray(STATE.streak)) STATE.streak = [];
        if (STATE.streak.includes(today)) return;
        STATE.streak.push(today);
        if (STATE.streak.length > 7) STATE.streak = STATE.streak.slice(-7);
        const len = STATE.streak.length;
        const reward = _getStreakReward(len);
        STATE.points = (parseInt(STATE.points) || 0) + reward;
        Auth.saveState(); UI.updateHUD();

        // Ghi nhận vào lịch sử Tinh Tú
        NotifSystem.add('bonus', `+${reward}`, `Điểm danh ngày ${len} ✅`);

        _spawnStreakStars();
        if (typeof Sound !== 'undefined') Sound.playSinewave(528);

        if (len === 7) UI.showToast(`🏅 7 ngày liên tiếp! +${reward} ✨ Danh hiệu "Người giữ lửa Trạm"!`, 5000);
        else if (len >= 4) UI.showToast(`🔥 Streak ${len} ngày! +${reward} ✨`, 4000);
        else UI.showToast(`⭐ Điểm danh ngày ${len}! +${reward} ✨`, 3500);

        _syncPointsToServer(reward);
        _syncStreakToServer(STATE.streak);
        setTimeout(() => _renderStreak(), 50);
    }

    function _spawnStreakStars() {
        const el = document.getElementById('streak-mini');
        if (!el) { _spawnDustParticles(); return; }
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        for (let i = 0; i < 16; i++) {
            setTimeout(() => {
                const p = document.createElement('div');
                p.className = 'dust-particle';
                const size = 3 + Math.random() * 5;
                const angle = (Math.PI * 2 * i) / 16;
                const dist = 40 + Math.random() * 60;
                p.style.cssText = `width:${size}px;height:${size}px;left:${cx}px;top:${cy}px;
                    --dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist}px;background:var(--accent-gold);`;
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 1300);
            }, i * 40);
        }
    }

    function _renderStreak() {
        const el = document.getElementById('streak-mini');
        if (!el) return;
        const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        const todayIdx = (new Date().getDay() + 6) % 7;
        const today = _today();
        if (!Array.isArray(STATE.streak)) STATE.streak = [];
        const checkedIn = STATE.streak.includes(today);
        el.innerHTML = '';
        days.forEach((d, i) => {
            const dateStr = _getDateForDayIndex(i);
            const done = STATE.streak.includes(dateStr);
            const isToday = i === todayIdx;
            const canCheckIn = isToday && !checkedIn;
            const div = document.createElement('div');
            div.className = ['streak-day', done ? 'done' : '', isToday ? 'today' : '',
                i === 6 ? 'special' : '', canCheckIn ? 'can-checkin' : ''].filter(Boolean).join(' ');
            if (canCheckIn) {
                div.innerHTML = `<span class="streak-day-label">${d}</span><span class="streak-checkin-icon">✦</span><span class="streak-checkin-hint">Tap!</span>`;
                div.title = 'Bấm để điểm danh hôm nay!';
                div.setAttribute('role', 'button');
                div.onclick = (e) => { e.stopPropagation(); _doCheckIn(); };
            } else if (isToday && done) {
                div.innerHTML = `<span class="streak-day-label">${d}</span><span style="font-size:0.85rem;line-height:1;color:rgba(206,147,216,0.9)">✓</span>`;
                div.title = 'Đã điểm danh hôm nay ✓';
            } else {
                div.textContent = d;
                if (done) div.title = 'Đã điểm danh ✓';
            }
            el.appendChild(div);
        });
    }

    function _getDateForDayIndex(i) {
        const now = new Date();
        const mondayOffset = (now.getDay() === 0 ? -6 : 1 - now.getDay());
        const target = new Date(now);
        target.setDate(now.getDate() + mondayOffset + i);
        return target.toISOString().slice(0, 10);
    }

    async function _syncStreakToServer(dates) {
        if (!STATE.user?.token || STATE.user.token === 'local') return;
        try {
            await fetch(`${CONFIG.API_BASE}/auth/streak`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.user.token}` },
                body: JSON.stringify({ dates })
            });
        } catch { console.warn('Offline: streak lưu local.'); }
    }

    /* ---------- DUST PARTICLES ---------- */
    function _spawnDustParticles() {
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const p = document.createElement('div');
                p.className = 'dust-particle';
                const size = 3 + Math.random() * 4;
                p.style.cssText = `width:${size}px;height:${size}px;
                    left:${30 + Math.random() * 40}vw;top:${40 + Math.random() * 20}vh;
                    --dx:${-80 + Math.random() * 160}px;--dy:${-100 - Math.random() * 100}px;`;
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 1300);
            }, i * 80);
        }
    }

    /* ---------- INIT INPUT ---------- */
    function _initInput() {
        const icon = document.getElementById('telescope-icon');
        const panel = document.getElementById('input-panel');
        const textarea = document.getElementById('signal-text');
        const charCount = document.getElementById('char-count');
        const btnSend = document.getElementById('btn-send');
        if (!icon || !panel || !textarea || !charCount || !btnSend) return;

        icon.addEventListener('click', () => {
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) textarea.focus();
        });

        textarea.addEventListener('input', () => { charCount.textContent = textarea.value.length; });

        document.querySelectorAll('.star-type').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.star-type').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                STATE.activeStarType = btn.dataset.type;
            });
        });

        btnSend.addEventListener('click', () => {
            const text = textarea.value.trim();
            if (!text) {
                UI.showToast('✏️ Hãy viết gì đó trước khi gửi nhé~', 3000);
                textarea.focus();
                return;
            }
            if (_isToxic(text)) {
                UI.showToast('🌙 Tín hiệu chứa nội dung không phù hợp. Hãy thử lại nhé~', 4000);
                return;
            }
            Stars.sendSignal(text, STATE.activeStarType || 'normal', true);
            textarea.value = '';
            charCount.textContent = '0';
            panel.classList.add('hidden');
            UI.showSendBlessing();
        });
    }

    return { init, progress, complete };
})();