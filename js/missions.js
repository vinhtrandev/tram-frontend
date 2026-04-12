/* ================================================
   TRẠM GỬI TÍN HIỆU - missions.js (FIXED & HOÀN CHỈNH)
   Mission system: daily missions + weekly streak
   ================================================ */

const Missions = (() => {

    let voidHoldTimer = null;
    let breathingCycle = 0;
    let astroInterval = null;
    let astroElapsed = 0;

    /* ---------- INIT ---------- */
    function init() {
        _resetDailyIfNeeded();
        _renderMissions();
        _renderStreak();
        _initVoid();
        _initInput();
        _initAstronautTimer();
        _checkStreakToday();
    }

    /* ---------- DAILY RESET ---------- */
    function _resetDailyIfNeeded() {
        const today = _today();
        // Đảm bảo STATE.dailyMissions tồn tại
        if (!STATE.dailyMissions || STATE.dailyMissions._date !== today) {
            STATE.dailyMissions = { _date: today };
            Auth.saveState();
        }
    }

    function _today() {
        return new Date().toISOString().slice(0, 10);
    }

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
        </div>
      `;
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

        // Đảm bảo STATE.dailyMissions tồn tại
        if (!STATE.dailyMissions) STATE.dailyMissions = { _date: _today() };

        STATE.dailyMissions[id] = value;
        if (m.max && value >= m.max) {
            complete(id);
        } else {
            _updateBar(id, value, m.max);
        }
        Auth.saveState();
    }

    function complete(id) {
        if (_isDone(id)) return;
        const m = CONFIG.MISSIONS.find(m => m.id === id);
        if (!m) return;

        // Đảm bảo STATE.dailyMissions tồn tại
        if (!STATE.dailyMissions) STATE.dailyMissions = { _date: _today() };

        STATE.dailyMissions[id + '_done'] = true;
        STATE.dailyMissions[id] = m.max || 1;

        // FIX: Đảm bảo points là số hợp lệ trước khi cộng
        UI.addPoints(m.reward);

        UI.showToast(`✅ ${m.name} hoàn thành! +${m.reward} ✨`);
        _updateBar(id, m.max || 1, m.max || 1);

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

        // FIX: Lưu state và cập nhật HUD sau khi hoàn thành
        Auth.saveState();
        UI.updateHUD();
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

    /* ---------- VOID HOLD ---------- */
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
            voidEl.style.boxShadow = '0 0 80px rgba(206,147,216,0.6)';

            voidHoldTimer = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                const remaining = Math.max(0, 10 - elapsed);
                countEl.textContent = Math.ceil(remaining);
                const offset = CIRC * (1 - elapsed / 10);
                progressEl.style.strokeDashoffset = Math.max(0, offset);

                if (elapsed >= 10) {
                    clearInterval(voidHoldTimer);
                    voidHoldTimer = null;
                    isHolding = false;
                    timerEl.classList.add('hidden');
                    voidEl.style.animation = 'voidFlash 0.5s ease';
                    setTimeout(() => { voidEl.style.animation = ''; }, 600);
                    complete('void_hold');
                    _spawnAbsorbText();
                }
            }, 100);
        };

        const stopHold = () => {
            if (!isHolding) return;
            isHolding = false;
            if (voidHoldTimer) { clearInterval(voidHoldTimer); voidHoldTimer = null; }
            timerEl.classList.add('hidden');
            progressEl.style.strokeDashoffset = CIRC;
            countEl.textContent = '10';
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
            if (breathingCycle >= 3) {
                overlay.classList.add('hidden');
                complete('breathing');
                return;
            }
            info.textContent = `Chu kỳ ${breathingCycle + 1}/3`;

            text.textContent = 'Hít vào';
            circle.style.transition = 'transform 4s ease-in-out, box-shadow 4s ease-in-out';
            circle.style.transform = 'scale(1.5)';
            circle.style.boxShadow = '0 0 80px rgba(206,147,216,0.5)';

            setTimeout(() => {
                text.textContent = 'Giữ hơi';
                circle.style.transition = 'transform 4s ease';
            }, 4000);

            setTimeout(() => {
                text.textContent = 'Thở ra';
                circle.style.transition = 'transform 8s ease-in-out, box-shadow 8s ease-in-out';
                circle.style.transform = 'scale(0.85)';
                circle.style.boxShadow = '0 0 20px rgba(206,147,216,0.1)';
            }, 8000);

            setTimeout(() => {
                breathingCycle++;
                runCycle();
            }, 16000);
        }

        runCycle();

        const skipBtn = document.getElementById('btn-skip-breathing');
        if (skipBtn) {
            skipBtn.onclick = () => {
                overlay.classList.add('hidden');
                breathingCycle = 0;
            };
        }
    }

    /* ---------- INIT ASTRONAUT TIMER UI ---------- */
    function _initAstronautTimer() {
        const timerEl = document.getElementById('astronaut-timer');
        if (timerEl) timerEl.classList.add('hidden');
    }

    /* ---------- PATIENT ASTRONAUT ---------- */
    function _startAstronaut() {
        if (_isDone('patient_astronaut')) return;

        // FIX: Dừng interval cũ nếu có
        if (astroInterval) { clearInterval(astroInterval); astroInterval = null; }

        const timerEl = document.getElementById('astronaut-timer');
        const barEl = document.getElementById('astro-bar');
        const timeEl = document.getElementById('astro-time');
        if (!timerEl || !barEl || !timeEl) return;

        timerEl.classList.remove('hidden');

        const TOTAL_MS = CONFIG.PATIENT_DURATION;
        const start = Date.now();
        astroElapsed = 0;

        function _onTabSwitch() {
            if (document.hidden) {
                clearInterval(astroInterval);
                astroInterval = null;
                astroElapsed = 0;
                barEl.style.width = '0%';
                timeEl.textContent = '30:00';
                timerEl.classList.add('hidden');
                document.removeEventListener('visibilitychange', _onTabSwitch);
                UI.showToast('🚀 Phi hành gia rời Trạm... Thử lại từ đầu nhé!');
            }
        }

        document.addEventListener('visibilitychange', _onTabSwitch);

        astroInterval = setInterval(() => {
            astroElapsed = Date.now() - start;
            const pct = Math.min((astroElapsed / TOTAL_MS) * 100, 100);
            const rem = Math.max(0, TOTAL_MS - astroElapsed);
            const mins = Math.floor(rem / 60000);
            const secs = Math.floor((rem % 60000) / 1000);
            barEl.style.width = `${pct}%`;
            timeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            if (astroElapsed >= TOTAL_MS) {
                clearInterval(astroInterval);
                astroInterval = null;
                document.removeEventListener('visibilitychange', _onTabSwitch);
                complete('patient_astronaut');
                timerEl.classList.add('hidden');
            }
        }, 1000);
    }

    /* ---------- STREAK ---------- */
    function _checkStreakToday() {
        const today = _today();

        // FIX: Đảm bảo STATE.streak là array
        if (!Array.isArray(STATE.streak)) STATE.streak = [];

        if (!STATE.streak.includes(today)) {
            STATE.streak.push(today);
            // Giữ chỉ 7 ngày gần nhất
            if (STATE.streak.length > 7) STATE.streak = STATE.streak.slice(-7);
            _grantStreakReward();
            Auth.saveState();
        }
        _renderStreak();
    }

    function _grantStreakReward() {
        const len = STATE.streak.length;
        if (len === 7) {
            UI.addPoints(CONFIG.POINTS.STREAK_7);
            UI.showToast('🏅 7 ngày liên tiếp! +200 ✨ & danh hiệu "Người giữ lửa Trạm"!');
        } else if (len >= 4) {
            UI.addPoints(CONFIG.POINTS.STREAK_4_6);
        } else {
            UI.addPoints(CONFIG.POINTS.STREAK_1_3);
        }
    }

    function _renderStreak() {
        const el = document.getElementById('streak-mini');
        if (!el) return;
        const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        const todayIdx = (new Date().getDay() + 6) % 7;

        // FIX: Đảm bảo STATE.streak là array
        if (!Array.isArray(STATE.streak)) STATE.streak = [];

        el.innerHTML = '';
        days.forEach((d, i) => {
            const dateStr = _getDateForDayIndex(i);
            const done = STATE.streak.includes(dateStr);
            const isToday = i === todayIdx;
            const special = i === 6;
            const div = document.createElement('div');
            div.className = `streak-day${done ? ' done' : ''}${isToday ? ' today' : ''}${special ? ' special' : ''}`;
            div.textContent = d;
            el.appendChild(div);
        });
    }

    function _getDateForDayIndex(i) {
        const now = new Date();
        const day = now.getDay();
        const mondayOffset = (day === 0 ? -6 : 1 - day);
        const target = new Date(now);
        target.setDate(now.getDate() + mondayOffset + i);
        return target.toISOString().slice(0, 10);
    }

    /* ---------- DUST PARTICLES ---------- */
    function _spawnDustParticles() {
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const p = document.createElement('div');
                p.className = 'dust-particle';
                const size = 3 + Math.random() * 4;
                p.style.cssText = `
          width:${size}px; height:${size}px;
          left:${30 + Math.random() * 40}vw;
          top:${40 + Math.random() * 20}vh;
          --dx:${-80 + Math.random() * 160}px;
          --dy:${-100 - Math.random() * 100}px;
        `;
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 1300);
            }, i * 80);
        }
    }

    /* ---------- INIT INPUT PANEL TOGGLE ---------- */
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

        textarea.addEventListener('input', () => {
            charCount.textContent = textarea.value.length;
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
            if (!text) return;
            Stars.sendSignal(text, STATE.activeStarType || 'normal');
            textarea.value = '';
            charCount.textContent = '0';
            panel.classList.add('hidden');
        });
    }

    return { init, progress, complete };
})();