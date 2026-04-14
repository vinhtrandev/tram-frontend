/* ================================================
   TRẠM GỬI TÍN HIỆU - app.js  [OPTIMISED + POLLING]
   Main orchestrator: boot sequence, screen flow
   + Realtime polling sao mới từ người khác
   ================================================ */

const App = (() => {

    let _northSmallRaf = null;
    let _northLargeRaf = null;
    let _northSmallPaused = false;
    let _northLargePaused = false;

    function boot() {
        Canvas.initLanding();
        Auth.initAuthUI();

        if (Auth.loadSession()) {
            _showLanding(true);
        } else {
            _showLanding(false);
        }
    }

    function _showLanding(hasSession) {
        const landing = document.getElementById('landing-screen');
        landing.classList.add('active');
        landing.classList.remove('hidden');
        UI.initLandingText();

        document.getElementById('btn-enter').addEventListener('click', () => {
            if (hasSession) {
                _transitionToMain();
            } else {
                document.getElementById('auth-modal').classList.remove('hidden');
            }
        });
    }

    function enterMain() {
        _transitionToMain();
    }

    async function _transitionToMain() {
        const landing = document.getElementById('landing-screen');
        const main = document.getElementById('main-screen');

        landing.style.opacity = '0';
        landing.style.pointerEvents = 'none';

        await _sleep(800);

        Canvas.stopLanding();

        landing.classList.remove('active');
        landing.style.display = 'none';

        main.classList.remove('hidden');
        main.style.opacity = '0';
        await _sleep(50);
        main.style.transition = 'opacity 1.5s ease';
        main.style.opacity = '1';
        main.classList.add('active');

        _initMain();
    }

    async function _initMain() {
        await Auth.syncFromServer();

        Canvas.initMain();

        UI.updateHUD();
        UI.initPanels();
        UI.showWelcome();
        UI.startRandomQuotes();

        Missions.init();

        _injectPreviewCSS();
        _initStarTypeSelector();

        _hookSendSignal();
        _hookShootingStar();
        _hookVoid();
        _hookMeteorRain();

        await Stars.loadStars();
        Stars.initPopupClose();
        Stars.startShootingStarCycle();
        Stars.startMeteorRain();

        // ── Bắt đầu polling realtime sao mới ──
        Stars.startPolling(15000); // poll mỗi 15 giây

        Sound.initButtons();

        setTimeout(() => {
            UI.showToast('💫 ' + CONFIG.QUOTES[0], 5000);
        }, 30000);
    }

    /* ── Inject CSS cho preview popup ── */
    function _injectPreviewCSS() {
        if (document.getElementById('star-preview-style')) return;
        const style = document.createElement('style');
        style.id = 'star-preview-style';
        style.textContent = `
            .star-type-btn { position: relative; }

            .star-type-preview {
                position: absolute;
                bottom: 58px;
                left: 50%;
                transform: translateX(-50%) translateY(8px);
                background: rgba(10, 8, 28, 0.95);
                border: 1px solid rgba(156, 125, 255, 0.3);
                border-radius: 14px;
                padding: 10px 14px 8px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.22s ease, transform 0.22s ease;
                white-space: nowrap;
                z-index: 600;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.45);
            }

            .star-type-preview::after {
                content: '';
                position: absolute;
                bottom: -7px;
                left: 50%;
                transform: translateX(-50%);
                width: 0; height: 0;
                border-left: 7px solid transparent;
                border-right: 7px solid transparent;
                border-top: 7px solid rgba(156, 125, 255, 0.3);
            }

            .star-type-preview.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0px);
            }

            .star-type-preview canvas {
                pointer-events: none;
                display: block;
            }

            .star-type-preview .preview-label {
                font-size: 0.7rem;
                color: rgba(212, 184, 255, 0.95);
                font-family: 'Quicksand', sans-serif;
                font-weight: 600;
                letter-spacing: 0.05em;
                margin-top: 2px;
            }

            .star-type-preview .preview-ttl {
                font-size: 0.58rem;
                color: rgba(156, 125, 255, 0.7);
                font-family: 'Quicksand', sans-serif;
                letter-spacing: 0.04em;
            }

            .star-type-preview .preview-desc {
                font-size: 0.62rem;
                color: rgba(255, 255, 255, 0.38);
                font-family: 'Quicksand', sans-serif;
                text-align: center;
                max-width: 130px;
                line-height: 1.45;
            }

            .star-type-btn.selected-active {
                animation: starBtnPop 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }

            @keyframes starBtnPop {
                0%   { transform: scale(1); }
                35%  { transform: scale(1.28); }
                60%  { transform: scale(0.9); }
                80%  { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    /* ── Star type selector ── */
    function _initStarTypeSelector() {
        const container = document.getElementById('star-type-selector');
        if (!container) return;

        container.innerHTML = '';

        if (_northSmallRaf) { cancelAnimationFrame(_northSmallRaf); _northSmallRaf = null; }
        if (_northLargeRaf) { cancelAnimationFrame(_northLargeRaf); _northLargeRaf = null; }

        const PREVIEW_DESCS = {
            shooting: 'Bay vút nhanh lên trời\nTan biến sau 4 giờ',
            north: 'Bay chậm, sáng rực rỡ\nTồn tại vĩnh viễn',
            cluster: '3 cụm sao nối nhau\nTồn tại trong 24 giờ'
        };
        const TTL_LABELS = {
            shooting: '4 giờ',
            north: 'Vĩnh viễn',
            cluster: '24 giờ'
        };

        let northSmallCv = null;
        let northLargeCv = null;

        Object.values(CONFIG.STAR_TYPES).forEach(type => {
            const btn = document.createElement('button');
            btn.className = 'star-type-btn' + (type.id === STATE.activeStarType ? ' active' : '');
            btn.id = `star-type-btn-${type.id}`;
            btn.setAttribute('data-type', type.id);
            btn.setAttribute('title', type.label);
            btn.style.cssText = `
                position: relative;
                width: 44px; height: 44px;
                border-radius: 50%;
                border: 1.5px solid rgba(255,255,255,0.12);
                background: rgba(255,255,255,0.04);
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: border-color 0.2s, background 0.2s;
                overflow: visible;
                padding: 0;
            `;

            const cv = document.createElement('canvas');
            cv.width = 56; cv.height = 56;
            cv.style.cssText = 'width:28px;height:28px;pointer-events:none;display:block;';
            btn.appendChild(cv);

            const badge = document.createElement('span');
            badge.style.cssText = `
                position:absolute; top:-4px; right:-4px;
                background:rgba(26,27,46,0.92);
                border:1px solid rgba(255,255,255,0.1);
                color:rgba(156,125,255,0.9);
                font-size:0.48rem; padding:1px 4px;
                border-radius:10px; line-height:1.5;
                pointer-events:none; white-space:nowrap;
                font-family:'Quicksand',sans-serif;
            `;
            badge.textContent = type.ttl
                ? (type.id === 'shooting' ? '4h' : '24h')
                : '∞';
            btn.appendChild(badge);

            const preview = document.createElement('div');
            preview.className = 'star-type-preview';

            const previewCv = document.createElement('canvas');
            previewCv.width = 96; previewCv.height = 96;
            previewCv.style.cssText = 'width:48px;height:48px;pointer-events:none;display:block;';
            preview.appendChild(previewCv);

            const previewLabel = document.createElement('div');
            previewLabel.className = 'preview-label';
            previewLabel.textContent = type.label;
            preview.appendChild(previewLabel);

            const previewTtl = document.createElement('div');
            previewTtl.className = 'preview-ttl';
            previewTtl.textContent = TTL_LABELS[type.id] || '';
            preview.appendChild(previewTtl);

            const previewDesc = document.createElement('div');
            previewDesc.className = 'preview-desc';
            previewDesc.style.whiteSpace = 'pre-line';
            previewDesc.textContent = PREVIEW_DESCS[type.id] || '';
            preview.appendChild(previewDesc);

            btn.appendChild(preview);

            btn.addEventListener('click', () => _selectStarType(type.id));

            btn.addEventListener('mouseenter', () => {
                preview.classList.add('show');
                if (type.id === 'north') {
                    _northLargePaused = false;
                    if (!_northLargeRaf) _animateNorthIconLarge(northLargeCv);
                }
            });
            btn.addEventListener('mouseleave', () => {
                preview.classList.remove('show');
                if (type.id === 'north') _northLargePaused = true;
            });

            btn.addEventListener('touchstart', () => {
                preview.classList.add('show');
                if (type.id === 'north') {
                    _northLargePaused = false;
                    if (!_northLargeRaf) _animateNorthIconLarge(northLargeCv);
                }
                setTimeout(() => {
                    preview.classList.remove('show');
                    if (type.id === 'north') _northLargePaused = true;
                }, 1800);
            }, { passive: true });

            container.appendChild(btn);

            if (type.id !== 'north') {
                _drawStarIcon(cv.getContext('2d'), type.id);
                _drawStarIconLarge(previewCv.getContext('2d'), type.id);
            } else {
                northSmallCv = cv;
                northLargeCv = previewCv;
                _animateNorthIcon(northSmallCv);
            }
        });

        _applyActiveStyle(STATE.activeStarType);
    }

    function _drawStarIcon(ctx, typeId) {
        const w = 56, cy = 28;
        ctx.clearRect(0, 0, w, w);

        if (typeId === 'shooting') {
            const g = ctx.createLinearGradient(4, cy, w - 6, cy);
            g.addColorStop(0, 'rgba(168,216,255,0)');
            g.addColorStop(1, 'rgba(168,216,255,0.85)');
            ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(4, cy); ctx.lineTo(w - 8, cy); ctx.stroke();

            [[w * 0.3, cy - 2.5], [w * 0.5, cy + 2], [w * 0.65, cy - 1.5]].forEach(([x, y]) => {
                ctx.fillStyle = 'rgba(168,216,255,0.5)';
                ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
            });

            const rg = ctx.createRadialGradient(w - 8, cy, 0, w - 8, cy, 7);
            rg.addColorStop(0, '#ffffff');
            rg.addColorStop(0.5, '#a8d8ff');
            rg.addColorStop(1, 'rgba(168,216,255,0)');
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.arc(w - 8, cy, 7, 0, Math.PI * 2); ctx.fill();

        } else if (typeId === 'cluster') {
            const positions = [w * 0.2, w * 0.5, w * 0.8];
            const sizes = [3.5, 5, 3.5];
            ctx.strokeStyle = 'rgba(156,125,255,0.25)';
            ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
            ctx.beginPath(); ctx.moveTo(positions[0], cy); ctx.lineTo(positions[2], cy); ctx.stroke();
            ctx.setLineDash([]);

            positions.forEach((x, i) => {
                const r = sizes[i], alpha = i === 1 ? 0.95 : 0.65;
                const rg = ctx.createRadialGradient(x, cy, 0, x, cy, r * 2.5);
                rg.addColorStop(0, `rgba(212,184,255,${alpha})`);
                rg.addColorStop(1, 'rgba(156,125,255,0)');
                ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, cy, r * 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(212,184,255,${alpha})`;
                ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
            });
        }
    }

    function _drawStarIconLarge(ctx, typeId) {
        const w = 96, cy = 48;
        ctx.clearRect(0, 0, w, w);

        if (typeId === 'shooting') {
            const g = ctx.createLinearGradient(8, cy, w - 10, cy);
            g.addColorStop(0, 'rgba(168,216,255,0)');
            g.addColorStop(1, 'rgba(168,216,255,0.85)');
            ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(8, cy); ctx.lineTo(w - 14, cy); ctx.stroke();

            [[w * 0.28, cy - 4], [w * 0.48, cy + 3.5], [w * 0.64, cy - 2.5]].forEach(([x, y]) => {
                ctx.fillStyle = 'rgba(168,216,255,0.55)';
                ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
            });

            const rg = ctx.createRadialGradient(w - 14, cy, 0, w - 14, cy, 12);
            rg.addColorStop(0, '#ffffff');
            rg.addColorStop(0.5, '#a8d8ff');
            rg.addColorStop(1, 'rgba(168,216,255,0)');
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.arc(w - 14, cy, 12, 0, Math.PI * 2); ctx.fill();

        } else if (typeId === 'cluster') {
            const positions = [w * 0.2, w * 0.5, w * 0.8];
            const sizes = [6, 9, 6];
            ctx.strokeStyle = 'rgba(156,125,255,0.3)';
            ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
            ctx.beginPath(); ctx.moveTo(positions[0], cy); ctx.lineTo(positions[2], cy); ctx.stroke();
            ctx.setLineDash([]);

            positions.forEach((x, i) => {
                const r = sizes[i], alpha = i === 1 ? 0.95 : 0.65;
                const rg = ctx.createRadialGradient(x, cy, 0, x, cy, r * 2.5);
                rg.addColorStop(0, `rgba(212,184,255,${alpha})`);
                rg.addColorStop(1, 'rgba(156,125,255,0)');
                ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, cy, r * 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(212,184,255,${alpha})`;
                ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();

                for (let k = 0; k < 3; k++) {
                    const angle = (k / 3) * Math.PI * 2;
                    ctx.fillStyle = `rgba(212,184,255,${alpha * 0.4})`;
                    ctx.beginPath();
                    ctx.arc(x + r * 2 * Math.cos(angle), cy + r * 2 * Math.sin(angle), r * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }
    }

    function _animateNorthIcon(cv) {
        if (!cv) return;
        if (_northSmallRaf) cancelAnimationFrame(_northSmallRaf);
        let t = 0;

        function frame() {
            if (document.hidden) { _northSmallRaf = requestAnimationFrame(frame); return; }

            const ctx = cv.getContext('2d');
            const cx = 28, cy = 28;
            ctx.clearRect(0, 0, 56, 56);

            const pulse = 1 + 0.1 * Math.sin(t * 0.05);

            const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, 13 * pulse);
            og.addColorStop(0, 'rgba(255,248,194,0.5)');
            og.addColorStop(1, 'rgba(255,248,194,0)');
            ctx.fillStyle = og;
            ctx.beginPath(); ctx.arc(cx, cy, 13 * pulse, 0, Math.PI * 2); ctx.fill();

            const r1 = 9 * pulse, r2 = 3;
            ctx.fillStyle = '#fff8c2';
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = (i * Math.PI / 2) - Math.PI / 2;
                const a2 = a + Math.PI / 4;
                if (i === 0) ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
                else ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
                ctx.lineTo(cx + r2 * Math.cos(a2), cy + r2 * Math.sin(a2));
            }
            ctx.closePath(); ctx.fill();

            t++;
            _northSmallRaf = requestAnimationFrame(frame);
        }
        frame();
    }

    function _animateNorthIconLarge(cv) {
        if (!cv) return;
        if (_northLargeRaf) cancelAnimationFrame(_northLargeRaf);
        let t = 0;

        function frame() {
            if (_northLargePaused || document.hidden) {
                _northLargeRaf = null;
                return;
            }

            const ctx = cv.getContext('2d');
            const cx = 48, cy = 48;
            ctx.clearRect(0, 0, 96, 96);

            const pulse = 1 + 0.12 * Math.sin(t * 0.06);

            const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26 * pulse);
            og.addColorStop(0, 'rgba(255,248,194,0.4)');
            og.addColorStop(0.5, 'rgba(255,248,194,0.12)');
            og.addColorStop(1, 'rgba(255,248,194,0)');
            ctx.fillStyle = og;
            ctx.beginPath(); ctx.arc(cx, cy, 26 * pulse, 0, Math.PI * 2); ctx.fill();

            const ic = ctx.createRadialGradient(cx, cy, 0, cx, cy, 13 * pulse);
            ic.addColorStop(0, 'rgba(255,255,220,0.65)');
            ic.addColorStop(1, 'rgba(255,248,194,0)');
            ctx.fillStyle = ic;
            ctx.beginPath(); ctx.arc(cx, cy, 13 * pulse, 0, Math.PI * 2); ctx.fill();

            const r1 = 17 * pulse, r2 = 5;
            ctx.fillStyle = '#fff8c2';
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = (i * Math.PI / 2) - Math.PI / 2;
                const a2 = a + Math.PI / 4;
                if (i === 0) ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
                else ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
                ctx.lineTo(cx + r2 * Math.cos(a2), cy + r2 * Math.sin(a2));
            }
            ctx.closePath(); ctx.fill();

            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + t * 0.016;
                const dist = 21 * pulse;
                const alpha = 0.28 + 0.28 * Math.sin(t * 0.05 + i);
                ctx.fillStyle = `rgba(255,248,194,${alpha.toFixed(2)})`;
                ctx.beginPath();
                ctx.arc(cx + dist * Math.cos(angle), cy + dist * Math.sin(angle), 1.4, 0, Math.PI * 2);
                ctx.fill();
            }

            t++;
            _northLargeRaf = requestAnimationFrame(frame);
        }
        frame();
    }

    function _selectStarType(typeId) {
        STATE.activeStarType = typeId;
        _applyActiveStyle(typeId);

        const btn = document.getElementById(`star-type-btn-${typeId}`);
        if (btn) {
            btn.classList.remove('selected-active');
            void btn.offsetWidth;
            btn.classList.add('selected-active');
            setTimeout(() => btn.classList.remove('selected-active'), 400);

            const preview = btn.querySelector('.star-type-preview');
            if (preview) {
                preview.classList.remove('show');
                _northLargePaused = true;
            }
        }
    }

    function _applyActiveStyle(typeId) {
        document.querySelectorAll('.star-type-btn').forEach(b => {
            const isActive = b.dataset.type === typeId;
            b.style.borderColor = isActive
                ? 'rgba(156,125,255,0.85)'
                : 'rgba(255,255,255,0.12)';
            b.style.background = isActive
                ? 'rgba(156,125,255,0.18)'
                : 'rgba(255,255,255,0.04)';
            b.style.boxShadow = isActive
                ? '0 0 10px rgba(156,125,255,0.25)'
                : '';
        });
    }

    function _hookSendSignal() {
        const btn = document.getElementById('btn-send');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const text = document.getElementById('signal-text')?.value?.trim();
            if (!text) return;

            const typeId = STATE.activeStarType || 'shooting';
            const typeConf = CONFIG.STAR_TYPES[typeId];
            const typeLabel = typeConf ? typeConf.emoji : '💫';
            NotifSystem.add('earn', '+5', `Gửi tín hiệu ${typeLabel}`);

            Stars.sendSignal(text, typeId);

            const textarea = document.getElementById('signal-text');
            if (textarea) textarea.value = '';
            const counter = document.getElementById('char-count');
            if (counter) counter.textContent = '0';

            UI.addPoints(CONFIG.POINTS.SEND_SIGNAL);
            Missions.progress('send_signal', 1);
        }, false);
    }

    function _hookShootingStar() {
        document.addEventListener('shootingstar:caught', () => {
            NotifSystem.add('bonus', `+${CONFIG.POINTS.SHOOTING_STAR}`, 'Bắt được sao băng! 🌠');
        });
    }

    function _hookVoid() {
        document.addEventListener('void:released', () => {
            NotifSystem.add('earn', `+${CONFIG.POINTS.VOID_HOLD}`, 'Buông bỏ tại Hố Đen 🌑');
        });
    }

    function _hookMeteorRain() {
        document.addEventListener('meteorrain:bonus', () => {
            NotifSystem.add('bonus', '+30', 'Mưa sao băng may mắn! 🌠');
        });
    }

    function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    return { enterMain };
})();