/* ================================================
   TRẠM GỬI TÍN HIỆU - blackhole.js
   Nút hố đen v4:
   + Style gravitational lensing đẹp hơn
   + Giữ 10s → hút tất cả ngôi sao vào
   + Kéo ngôi sao thả vào hố đen → xóa 1 ngôi sao
   + Hiệu ứng suck-in + âm thanh
   ================================================ */

const BlackHole = (() => {

    let holdTimer = null;
    let holdInterval = null;
    let isHolding = false;
    let holdStart = 0;
    const HOLD_DURATION = 10000; // 10 giây

    // Drag state
    let _dragStar = null;       // { wrapper, data, origLeft, origTop }
    let _dragClone = null;      // element đang kéo theo con trỏ
    let _isDragging = false;
    let _dragOffX = 0;
    let _dragOffY = 0;

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
       HÚT MỘT NGÔI SAO ĐƠN (drag-drop)
       ================================================================ */
    function _suckOneStar(wrapper, data, fromX, fromY) {
        const { x: cx, y: cy } = _getVoidCenter();

        // Lấy màu
        const starDot = wrapper.querySelector('.star-dot');
        let color = 'rgba(168,216,255,0.9)';
        if (starDot) {
            if (starDot.classList.contains('type-north')) color = 'rgba(255,248,194,0.9)';
            if (starDot.classList.contains('type-cluster')) color = 'rgba(212,184,255,0.9)';
        }

        // Particles
        const trailCount = 6 + Math.floor(Math.random() * 4);
        for (let t = 0; t < trailCount; t++) {
            const jx = fromX + (Math.random() - 0.5) * 20;
            const jy = fromY + (Math.random() - 0.5) * 20;
            _spawnSuckParticle(jx, jy, cx, cy, color, t * 25);
        }

        // Di chuyển wrapper vào tâm
        wrapper.classList.add('void-sucking');
        const dur = 380 + Math.sqrt((fromX - cx) ** 2 + (fromY - cy) ** 2) * 0.45;

        wrapper.style.position = 'fixed';
        wrapper.style.left = `${fromX}px`;
        wrapper.style.top = `${fromY}px`;
        wrapper.style.transform = 'translate(-50%,-50%) scale(1.3)';
        wrapper.style.transition = 'none';

        setTimeout(() => {
            wrapper.style.transition = `
                left     ${dur}ms cubic-bezier(0.55,0,1,0.45),
                top      ${dur}ms cubic-bezier(0.55,0,1,0.45),
                opacity  ${dur * 0.35}ms ease ${dur * 0.65}ms,
                transform ${dur}ms ease
            `;
            wrapper.style.left = `${cx}px`;
            wrapper.style.top = `${cy}px`;
            wrapper.style.opacity = '0';
            wrapper.style.transform = 'translate(-50%,-50%) scale(0.05)';
        }, 16);

        setTimeout(() => {
            wrapper.remove();
            _spawnImpactFlash(cx, cy);
            _spawnGravityWave(cx, cy);

            // toast nhẹ
            if (typeof UI !== 'undefined') {
                UI.showToast('🌑 Tín hiệu đã được buông bỏ...');
            }

            // Xóa khỏi domStars
            if (typeof Stars !== 'undefined' && Stars._removeDomStar) {
                Stars._removeDomStar(data);
            }

            // Âm thanh
            if (typeof Sound !== 'undefined') Sound.playVoidRelease?.();

        }, dur + 80);
    }

    /* ================================================================
       HÚT TẤT CẢ NGÔI SAO
       ================================================================ */
    function _suckAllStars() {
        const voidEl = document.querySelector('.void');
        const { x: cx, y: cy } = _getVoidCenter();

        const starEls = document.querySelectorAll('.star-wrapper');
        const count = starEls.length;
        if (count === 0) return;

        if (typeof Sound !== 'undefined') Sound.startVoidWhoosh();

        let absorbed = 0;

        starEls.forEach((wrapper, idx) => {
            const rect = wrapper.getBoundingClientRect();
            const fromX = rect.left + rect.width / 2;
            const fromY = rect.top + rect.height / 2;
            const delay = idx * 55;

            const starDot = wrapper.querySelector('.star-dot');
            let color = 'rgba(168,216,255,0.9)';
            if (starDot) {
                if (starDot.classList.contains('type-north')) color = 'rgba(255,248,194,0.9)';
                if (starDot.classList.contains('type-cluster')) color = 'rgba(212,184,255,0.9)';
            }

            const trailCount = 4 + Math.floor(Math.random() * 4);
            for (let t = 0; t < trailCount; t++) {
                const jx = fromX + (Math.random() - 0.5) * 20;
                const jy = fromY + (Math.random() - 0.5) * 20;
                _spawnSuckParticle(jx, jy, cx, cy, color, delay + t * 30);
            }

            setTimeout(() => {
                wrapper.classList.add('void-sucking');
                const dur = 350 + Math.sqrt((fromX - cx) ** 2 + (fromY - cy) ** 2) * 0.5;

                wrapper.style.transition = `
                    left     ${dur}ms cubic-bezier(0.55,0,1,0.45),
                    top      ${dur}ms cubic-bezier(0.55,0,1,0.45),
                    opacity  ${dur * 0.35}ms ease ${dur * 0.65}ms,
                    transform ${dur}ms ease
                `;
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

                    if (absorbed % 3 === 0) {
                        _spawnImpactFlash(cx, cy);
                        _spawnGravityWave(cx, cy);
                    }

                    if (absorbed === count) {
                        _onAllAbsorbed(cx, cy, count);
                    }
                }, dur + delay + 80);

            }, delay);
        });

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
        if (typeof Sound !== 'undefined') Sound.playVoidRelease();
        _spawnReleaseBurst(cx, cy);
        _spawnGravityWave(cx, cy, 0);
        _spawnGravityWave(cx, cy, 200);
        _spawnGravityWave(cx, cy, 420);
        _spawnAbsorbCount(cx, cy, count);

        if (typeof Stars !== 'undefined' && Stars._clearDomStars) {
            Stars._clearDomStars();
        }
        if (typeof UI !== 'undefined') {
            UI.showToast(`🌑 Hố đen đã nuốt ${count} tín hiệu...`);
        }
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

        const progressEl = document.querySelector('.timer-progress');
        const countEl = document.getElementById('void-count');
        const totalDash = 415;

        holdInterval = setInterval(() => {
            const elapsed = Date.now() - holdStart;
            const progress = Math.min(elapsed / HOLD_DURATION, 1);
            const remaining = Math.ceil((HOLD_DURATION - elapsed) / 1000);

            if (progressEl) progressEl.style.strokeDashoffset = totalDash * (1 - progress);
            if (countEl) countEl.textContent = remaining > 0 ? remaining : '';

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
       DRAG-TO-VOID — kéo ngôi sao thả vào hố đen
       ================================================================ */

    /* Kiểm tra con trỏ có nằm trên hố đen không */
    function _isOverVoid(clientX, clientY) {
        const voidEl = document.querySelector('.void');
        if (!voidEl) return false;
        const rect = voidEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const r = rect.width / 2 + 18; // thêm 18px buffer zone
        const dx = clientX - cx;
        const dy = clientY - cy;
        return dx * dx + dy * dy <= r * r;
    }

    /* Highlight hố đen khi kéo ngôi sao qua */
    function _setVoidHighlight(active) {
        const voidEl = document.querySelector('.void');
        if (!voidEl) return;
        if (active) voidEl.classList.add('void-drag-target');
        else voidEl.classList.remove('void-drag-target');
    }

    /* Tạo clone theo con trỏ khi kéo */
    function _createDragClone(starDot, clientX, clientY) {
        const clone = starDot.cloneNode(true);
        clone.style.cssText += `
            position: fixed;
            pointer-events: none;
            z-index: 999;
            left: ${clientX}px;
            top:  ${clientY}px;
            transform: translate(-50%, -50%) scale(1.6);
            transition: none;
            opacity: 0.9;
            filter: drop-shadow(0 0 12px rgba(168,216,255,0.9));
        `;
        document.body.appendChild(clone);
        return clone;
    }

    /* Gắn drag events lên tất cả .star-dot khi một ngôi sao được tạo mới */
    function _bindDragOnStar(wrapper, data) {
        const starDot = wrapper.querySelector('.star-dot');
        if (!starDot) return;

        /* Mouse */
        starDot.addEventListener('mousedown', (e) => {
            // Chỉ drag khi giữ Alt hoặc kéo lâu hơn 200ms (tránh nhầm với click)
            _startDrag(e.clientX, e.clientY, wrapper, data, starDot);
            e.preventDefault();
        });

        /* Touch */
        starDot.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            _startDrag(t.clientX, t.clientY, wrapper, data, starDot);
        }, { passive: true });
    }

    let _dragStartTimeout = null;
    let _dragStartPos = null;

    function _startDrag(clientX, clientY, wrapper, data, starDot) {
        _dragStartPos = { x: clientX, y: clientY };

        // Chờ 180ms xem người dùng có kéo không (tránh nhầm với click popup)
        _dragStartTimeout = setTimeout(() => {
            _isDragging = true;
            _dragStar = { wrapper, data };
            _dragClone = _createDragClone(starDot, clientX, clientY);
            wrapper.style.opacity = '0.35';
            wrapper.style.pointerEvents = 'none';

            // Hint nhỏ
            if (typeof UI !== 'undefined') {
                UI.showToast('🌑 Thả vào hố đen để buông bỏ', 2000);
            }
        }, 180);
    }

    function _onDragMove(clientX, clientY) {
        if (!_isDragging || !_dragClone) return;

        _dragClone.style.left = `${clientX}px`;
        _dragClone.style.top = `${clientY}px`;

        _setVoidHighlight(_isOverVoid(clientX, clientY));
    }

    function _onDragEnd(clientX, clientY) {
        clearTimeout(_dragStartTimeout);
        _dragStartTimeout = null;

        if (!_isDragging) return;
        _isDragging = false;

        _setVoidHighlight(false);

        if (_dragClone) { _dragClone.remove(); _dragClone = null; }

        if (_dragStar) {
            const { wrapper, data } = _dragStar;
            _dragStar = null;

            if (_isOverVoid(clientX, clientY)) {
                // Hút vào hố đen!
                _suckOneStar(wrapper, data, clientX, clientY);
            } else {
                // Thả ra ngoài → hoàn về chỗ cũ
                wrapper.style.opacity = '1';
                wrapper.style.pointerEvents = '';
            }
        }
    }

    /* Global mouse/touch listeners cho drag */
    function _initDragListeners() {
        // Mouse
        window.addEventListener('mousemove', (e) => {
            if (_isDragging) _onDragMove(e.clientX, e.clientY);
        });
        window.addEventListener('mouseup', (e) => {
            if (_dragStartTimeout) { clearTimeout(_dragStartTimeout); _dragStartTimeout = null; }
            _onDragEnd(e.clientX, e.clientY);
        });

        // Touch
        window.addEventListener('touchmove', (e) => {
            if (_isDragging && e.touches[0]) _onDragMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        window.addEventListener('touchend', (e) => {
            if (_dragStartTimeout) { clearTimeout(_dragStartTimeout); _dragStartTimeout = null; }
            const t = e.changedTouches[0];
            if (t) _onDragEnd(t.clientX, t.clientY);
        });
    }

    /* ================================================================
       INIT
       ================================================================ */
    function init() {
        const voidEl = document.querySelector('.void');
        if (!voidEl) return;

        _injectTimerGradient();
        _initDragListeners();

        // Hold events
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

    /* Public — bindDragOnStar được Stars.js gọi sau khi tạo DOM star */
    return { init, bindDragOnStar: _bindDragOnStar };
})();