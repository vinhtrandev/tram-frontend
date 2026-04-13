/* ================================================
   TRẠM GỬI TÍN HIỆU - blackhole.js
   Nút hố đen v3:
   + Style gravitational lensing đẹp hơn
   + Giữ 10s → hút tất cả ngôi sao vào
   + Hiệu ứng suck-in + âm thanh
   ================================================ */

const BlackHole = (() => {

    let holdTimer = null;
    let holdInterval = null;
    let isHolding = false;
    let holdStart = 0;
    const HOLD_DURATION = 10000; // 10 giây

    /* ── Tìm vị trí tâm hố đen trên màn hình ── */
    function _getVoidCenter() {
        const voidEl = document.querySelector('.void');
        if (!voidEl) return { x: 80, y: window.innerHeight - 140 };
        const rect = voidEl.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    }

    /* ── Tạo vệt particle bay vào hố đen ── */
    function _spawnSuckParticle(fromX, fromY, toX, toY, color, delay) {
        const p = document.createElement('div');
        p.className = 'void-particle';

        const size = 2 + Math.random() * 4;
        p.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${fromX}px;
            top:  ${fromY}px;
            background: ${color};
            box-shadow: 0 0 ${size * 2}px ${color};
            opacity: 1;
            transition: none;
        `;
        document.body.appendChild(p);

        // Dùng requestAnimationFrame + transition để animate mượt
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const duration = 300 + dist * 0.6 + delay;

        setTimeout(() => {
            p.style.transition = `left ${duration}ms cubic-bezier(0.55,0,1,0.45),
                                   top  ${duration}ms cubic-bezier(0.55,0,1,0.45),
                                   opacity ${duration * 0.4}ms ease ${duration * 0.6}ms,
                                   transform ${duration}ms ease`;
            p.style.left = `${toX}px`;
            p.style.top = `${toY}px`;
            p.style.opacity = '0';
            p.style.transform = 'scale(0.1)';
            setTimeout(() => p.remove(), duration + 50);
        }, 16 + delay);
    }

    /* ── Impact flash tại tâm hố đen ── */
    function _spawnImpactFlash(cx, cy) {
        const f = document.createElement('div');
        f.className = 'void-impact-flash';
        f.style.cssText = `left:${cx}px; top:${cy}px; width:60px; height:60px;`;
        document.body.appendChild(f);
        setTimeout(() => f.remove(), 700);
    }

    /* ── Gravity wave ripple ── */
    function _spawnGravityWave(cx, cy, delay = 0) {
        setTimeout(() => {
            const w = document.createElement('div');
            w.className = 'void-gravity-wave';
            const size = 60 + Math.random() * 30;
            w.style.cssText = `left:${cx}px; top:${cy}px; width:${size}px; height:${size}px;`;
            document.body.appendChild(w);
            setTimeout(() => w.remove(), 1100);
        }, delay);
    }

    /* ── Số ngôi sao đã hút ── */
    function _spawnAbsorbCount(cx, cy, count) {
        const el = document.createElement('div');
        el.className = 'void-absorb-count';
        el.textContent = `✦ ${count} tín hiệu đã buông bỏ`;
        el.style.cssText = `left:${cx - 80}px; top:${cy - 50}px;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1800);
    }

    /* ── Release burst khi nhả ra ── */
    function _spawnReleaseBurst(cx, cy) {
        const b = document.createElement('div');
        b.className = 'void-release-burst';
        b.style.cssText = `left:${cx}px; top:${cy}px; width:80px; height:80px;`;
        document.body.appendChild(b);
        setTimeout(() => b.remove(), 1300);

        // Vài ngôi sao nhỏ bắn ra
        for (let i = 0; i < 14; i++) {
            const s = document.createElement('div');
            s.className = 'void-ejected-star';
            const size = 2 + Math.random() * 4;
            const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
            const speed = 80 + Math.random() * 140;
            const ex = cx + Math.cos(angle) * speed;
            const ey = cy + Math.sin(angle) * speed;
            const dur = 600 + Math.random() * 400;

            s.style.cssText = `
                width:${size}px; height:${size}px;
                left:${cx}px; top:${cy}px;
                opacity: 1;
            `;
            document.body.appendChild(s);

            setTimeout(() => {
                s.style.transition = `left ${dur}ms ease-out,
                                      top  ${dur}ms ease-out,
                                      opacity ${dur * 0.4}ms ease ${dur * 0.55}ms`;
                s.style.left = `${ex}px`;
                s.style.top = `${ey}px`;
                s.style.opacity = '0';
                setTimeout(() => s.remove(), dur + 80);
            }, 16);
        }
    }

    /* ================================================================
       HÚT TẤT CẢ NGÔI SAO
       ================================================================ */
    function _suckAllStars() {
        const voidEl = document.querySelector('.void');
        const { x: cx, y: cy } = _getVoidCenter();

        // Lấy tất cả star-wrapper đang trên màn hình
        const starEls = document.querySelectorAll('.star-wrapper');
        const count = starEls.length;
        if (count === 0) return;

        // Bắt đầu âm thanh whoosh tổng
        if (typeof Sound !== 'undefined') Sound.startVoidWhoosh();

        let absorbed = 0;

        starEls.forEach((wrapper, idx) => {
            const rect = wrapper.getBoundingClientRect();
            const fromX = rect.left + rect.width / 2;
            const fromY = rect.top + rect.height / 2;
            const delay = idx * 55; // stagger

            // Lấy màu ngôi sao
            const starDot = wrapper.querySelector('.star-dot');
            let color = 'rgba(168,216,255,0.9)';
            if (starDot) {
                if (starDot.classList.contains('type-north')) color = 'rgba(255,248,194,0.9)';
                if (starDot.classList.contains('type-cluster')) color = 'rgba(212,184,255,0.9)';
            }

            // Particles vệt sáng
            const trailCount = 4 + Math.floor(Math.random() * 4);
            for (let t = 0; t < trailCount; t++) {
                const jx = fromX + (Math.random() - 0.5) * 20;
                const jy = fromY + (Math.random() - 0.5) * 20;
                _spawnSuckParticle(jx, jy, cx, cy, color, delay + t * 30);
            }

            // Di chuyển wrapper vào tâm rồi xóa
            setTimeout(() => {
                wrapper.classList.add('void-sucking');
                const dur = 350 + Math.sqrt((fromX - cx) ** 2 + (fromY - cy) ** 2) * 0.5;

                wrapper.style.transition = `
                    left     ${dur}ms cubic-bezier(0.55,0,1,0.45),
                    top      ${dur}ms cubic-bezier(0.55,0,1,0.45),
                    opacity  ${dur * 0.35}ms ease ${dur * 0.65}ms,
                    transform ${dur}ms ease
                `;
                // Convert % → px absolute để animate
                const mainRect = document.getElementById('main-screen')?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
                wrapper.style.position = 'fixed';
                wrapper.style.left = `${fromX}px`;
                wrapper.style.top = `${fromY}px`;
                wrapper.style.transform = 'translate(-50%,-50%) scale(1.4)';

                setTimeout(() => {
                    wrapper.style.left = `${cx}px`;
                    wrapper.style.top = `${cy}px`;
                    wrapper.style.opacity = '0';
                    wrapper.style.transform = 'translate(-50%,-50%) scale(0.05)';
                }, 16);

                setTimeout(() => {
                    wrapper.remove();
                    absorbed++;

                    // Impact + wave mỗi 3 sao
                    if (absorbed % 3 === 0) {
                        _spawnImpactFlash(cx, cy);
                        _spawnGravityWave(cx, cy);
                    }

                    // Khi xong tất cả
                    if (absorbed === count) {
                        _onAllAbsorbed(cx, cy, count);
                    }
                }, dur + delay + 80);

            }, delay);
        });

        // Void flicker
        if (voidEl) {
            setTimeout(() => {
                voidEl.style.animation += ', voidFlash 0.4s ease';
                setTimeout(() => {
                    voidEl.style.animation = voidEl.style.animation.replace(', voidFlash 0.4s ease', '');
                }, 450);
            }, count * 55 * 0.4);
        }
    }

    function _onAllAbsorbed(cx, cy, count) {
        // Âm thanh release
        if (typeof Sound !== 'undefined') Sound.playVoidRelease();

        // Burst visual
        _spawnReleaseBurst(cx, cy);
        _spawnGravityWave(cx, cy, 0);
        _spawnGravityWave(cx, cy, 200);
        _spawnGravityWave(cx, cy, 420);
        _spawnAbsorbCount(cx, cy, count);

        // Xóa Stars internal state
        if (typeof Stars !== 'undefined' && Stars._clearDomStars) {
            Stars._clearDomStars();
        }

        // Toast
        if (typeof UI !== 'undefined') {
            UI.showToast(`🌑 Hố đen đã nuốt ${count} tín hiệu...`);
        }

        // Điểm thưởng
        if (count > 0 && typeof UI !== 'undefined') {
            const bonus = count * 2;
            UI.addPoints(bonus);
            UI.showToast(`✨ +${bonus} điểm vũ trụ`);
        }
    }

    /* ================================================================
       HOLD TIMER UI
       ================================================================ */
    function _startHoldTimer(voidEl) {
        if (isHolding) return;
        isHolding = true;
        holdStart = Date.now();

        voidEl.classList.add('holding');
        if (typeof Sound !== 'undefined') Sound.startVoidWhoosh();

        // Lấy SVG progress
        const progressEl = document.querySelector('.timer-progress');
        const countEl = document.getElementById('void-count');
        const totalDash = 415;

        holdInterval = setInterval(() => {
            const elapsed = Date.now() - holdStart;
            const progress = Math.min(elapsed / HOLD_DURATION, 1);
            const remaining = Math.ceil((HOLD_DURATION - elapsed) / 1000);

            if (progressEl) progressEl.style.strokeDashoffset = totalDash * (1 - progress);
            if (countEl) countEl.textContent = remaining > 0 ? remaining : '';

            // Gravity wave nhỏ mỗi 2s
            if (elapsed > 0 && elapsed % 2000 < 100) {
                const { x, y } = _getVoidCenter();
                _spawnGravityWave(x, y);
            }
        }, 80);

        holdTimer = setTimeout(() => {
            _triggerVoid(voidEl);
        }, HOLD_DURATION);
    }

    function _cancelHoldTimer(voidEl) {
        if (!isHolding) return;
        isHolding = false;
        clearTimeout(holdTimer);
        clearInterval(holdInterval);
        holdTimer = null;
        holdInterval = null;

        voidEl.classList.remove('holding');
        if (typeof Sound !== 'undefined') Sound.stopVoidWhoosh();

        const progressEl = document.querySelector('.timer-progress');
        const countEl = document.getElementById('void-count');
        if (progressEl) {
            progressEl.style.transition = 'stroke-dashoffset 0.5s ease';
            progressEl.style.strokeDashoffset = 415;
            setTimeout(() => { progressEl.style.transition = 'stroke-dashoffset 0.1s linear'; }, 550);
        }
        if (countEl) countEl.textContent = '';
    }

    function _triggerVoid(voidEl) {
        isHolding = false;
        clearInterval(holdInterval);
        holdInterval = null;
        holdTimer = null;

        voidEl.classList.remove('holding');

        const progressEl = document.querySelector('.timer-progress');
        const countEl = document.getElementById('void-count');
        if (progressEl) progressEl.style.strokeDashoffset = 0;
        if (countEl) countEl.textContent = '';

        // Reset progress sau burst
        setTimeout(() => {
            if (progressEl) {
                progressEl.style.transition = 'stroke-dashoffset 1s ease';
                progressEl.style.strokeDashoffset = 415;
                setTimeout(() => { progressEl.style.transition = 'stroke-dashoffset 0.1s linear'; }, 1100);
            }
        }, 1200);

        _suckAllStars();
    }

    /* ================================================================
       INIT
       ================================================================ */
    function init() {
        const voidEl = document.querySelector('.void');
        if (!voidEl) return;

        // Thêm SVG gradient cho timer
        _injectTimerGradient();

        // Mouse / Touch events
        voidEl.addEventListener('mousedown', () => _startHoldTimer(voidEl));
        voidEl.addEventListener('touchstart', (e) => { e.preventDefault(); _startHoldTimer(voidEl); }, { passive: false });

        voidEl.addEventListener('mouseup', () => _cancelHoldTimer(voidEl));
        voidEl.addEventListener('mouseleave', () => _cancelHoldTimer(voidEl));
        voidEl.addEventListener('touchend', () => _cancelHoldTimer(voidEl));
        voidEl.addEventListener('touchcancel', () => _cancelHoldTimer(voidEl));
    }

    function _injectTimerGradient() {
        const svgEl = document.querySelector('.void-timer svg');
        if (!svgEl) return;

        // Thêm defs gradient nếu chưa có
        if (!svgEl.querySelector('defs')) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = `
                <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stop-color="rgba(255,200,255,0.95)"/>
                    <stop offset="40%"  stop-color="rgba(200,140,255,0.92)"/>
                    <stop offset="100%" stop-color="rgba(120,60,220,0.85)"/>
                </linearGradient>
            `;
            svgEl.insertBefore(defs, svgEl.firstChild);
        }
    }

    return { init };
})();