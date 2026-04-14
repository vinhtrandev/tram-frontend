/* ================================================
   TRẠM GỬI TÍN HIỆU - canvas.js  [OPTIMISED]
   Three-layer parallax star background + nebula

   Fixes:
   - shadowBlur chỉ dùng cho layer gần (layer 2), tắt cho layer 0+1
   - Landing RAF tự huỷ khi chuyển sang main screen
   - mousemove throttle 60fps (requestAnimationFrame)
   - Resize debounce 200ms
   - Main RAF ID được expose để destroy đúng cách
   ================================================ */

const Canvas = (() => {

    let landingCtx, mainCtx;
    let landingCanvas, mainCanvas;
    let W, H;
    let mouse = { x: 0, y: 0 };
    let _targetMouse = { x: 0, y: 0 };
    let _rafMain = null;
    let _rafLanding = null;
    let _resizeTimer = null;
    let _mousePending = false;

    /* ---------- Star layers ---------- */
    const layers = [
        // Layer 0: xa — nhỏ, chậm, KHÔNG shadow
        {
            stars: [], count: 120, sizeMin: 0.6, sizeMax: 1.8,
            speed: 0.3, baseOpacity: [0.2, 0.55], useShadow: false
        },
        // Layer 1: giữa — KHÔNG shadow
        {
            stars: [], count: 60, sizeMin: 1.8, sizeMax: 3.5,
            speed: 0.6, baseOpacity: [0.4, 0.8], useShadow: false
        },
        // Layer 2: gần — lớn, CÓ shadow (ít thôi)
        {
            stars: [], count: 22, sizeMin: 3.5, sizeMax: 7.0,
            speed: 1.2, baseOpacity: [0.18, 0.45], useShadow: true
        }
    ];

    const COLORS = ['#FFFDE7', '#E1F5FE', '#F8F8FF', '#CE93D8', '#F48FB1'];

    function _rand(a, b) { return a + Math.random() * (b - a); }

    /* ---------- Init layers ---------- */
    function _initLayers(w, h) {
        layers.forEach(layer => {
            layer.stars = Array.from({ length: layer.count }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                size: _rand(layer.sizeMin, layer.sizeMax),
                opacity: _rand(layer.baseOpacity[0], layer.baseOpacity[1]),
                twinkleSpeed: _rand(0.001, 0.006),
                twinklePhase: Math.random() * Math.PI * 2,
                color: COLORS[Math.floor(Math.random() * COLORS.length)]
            }));
        });
    }

    /* ---------- Draw one layer ---------- */
    function _drawLayer(ctx, layer, t, parallaxFactor) {
        const cx = W / 2, cy = H / 2;
        // Parallax mượt: lerp mouse
        const dx = (mouse.x - cx) * parallaxFactor * 0.035;
        const dy = (mouse.y - cy) * parallaxFactor * 0.035;

        layer.stars.forEach(s => {
            const tw = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed * 1000 + s.twinklePhase);
            const op = Math.min(s.opacity * (0.65 + 0.35 * tw), 1);

            ctx.globalAlpha = op;
            ctx.fillStyle = s.color;

            // shadowBlur chỉ cho layer gần và chỉ khi twinkle cao
            if (layer.useShadow && tw > 0.6) {
                ctx.shadowColor = s.color;
                ctx.shadowBlur = s.size * 2.5 * tw;
            }

            ctx.beginPath();
            ctx.arc(s.x + dx, s.y + dy, s.size * (0.92 + 0.08 * tw), 0, Math.PI * 2);
            ctx.fill();

            // Reset shadow sau mỗi sao (tránh leak)
            if (layer.useShadow) ctx.shadowBlur = 0;
        });

        ctx.globalAlpha = 1;
    }

    /* ---------- Nebula (đơn giản hơn, bỏ scale trick) ---------- */
    function _drawNebula(ctx, t) {
        const nebulas = [
            { x: W * 0.62, y: H * 0.22, r: 260, color: [26, 27, 46], drift: 0.3 },
            { x: W * 0.18, y: H * 0.72, r: 220, color: [20, 10, 40], drift: -0.2 },
            { x: W * 0.82, y: H * 0.58, r: 180, color: [30, 15, 50], drift: 0.15 }
        ];
        nebulas.forEach(n => {
            const off = Math.sin(t * 0.00018 + n.drift) * 18;
            const gx = n.x + off, gy = n.y + off;
            const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, n.r);
            gr.addColorStop(0, `rgba(${n.color},0.45)`);
            gr.addColorStop(1, `rgba(${n.color},0)`);
            ctx.fillStyle = gr;
            ctx.beginPath();
            ctx.arc(gx, gy, n.r, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /* ---------- Landing canvas ---------- */
    function initLanding() {
        landingCanvas = document.getElementById('landing-stars');
        if (!landingCanvas) return;
        landingCtx = landingCanvas.getContext('2d');
        _resize(landingCanvas);

        // 150 sao tĩnh (không shadow) — landing nhẹ
        const stars = Array.from({ length: 150 }, () => ({
            x: Math.random(), y: Math.random(),
            size: _rand(0.8, 3.5),
            opacity: _rand(0.2, 0.75),
            twinkleSpeed: _rand(0.0008, 0.004),
            twinklePhase: Math.random() * Math.PI * 2,
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        }));

        function draw(t) {
            // Huỷ nếu landing canvas đã bị remove khỏi DOM
            if (!landingCanvas.isConnected) { _rafLanding = null; return; }

            const { width: w, height: h } = landingCanvas;
            landingCtx.clearRect(0, 0, w, h);

            stars.forEach(s => {
                const tw = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed * 1000 + s.twinklePhase);
                landingCtx.globalAlpha = Math.min(s.opacity * (0.65 + 0.35 * tw), 1);
                landingCtx.fillStyle = s.color;
                // Không dùng shadowBlur trên landing
                landingCtx.beginPath();
                landingCtx.arc(s.x * w, s.y * h, s.size * (0.92 + 0.08 * tw), 0, Math.PI * 2);
                landingCtx.fill();
            });
            landingCtx.globalAlpha = 1;

            _rafLanding = requestAnimationFrame(draw);
        }
        _rafLanding = requestAnimationFrame(draw);
    }

    /* ---------- Stop landing (gọi khi chuyển màn) ---------- */
    function stopLanding() {
        if (_rafLanding) { cancelAnimationFrame(_rafLanding); _rafLanding = null; }
    }

    /* ---------- Main canvas ---------- */
    function initMain() {
        mainCanvas = document.getElementById('star-canvas');
        if (!mainCanvas) return;
        mainCtx = mainCanvas.getContext('2d');
        _resize(mainCanvas);
        W = mainCanvas.width;
        H = mainCanvas.height;

        _initLayers(W, H);

        // Throttle mousemove qua RAF — không xử lý từng pixel
        window.addEventListener('mousemove', e => {
            _targetMouse.x = e.clientX;
            _targetMouse.y = e.clientY;
            if (!_mousePending) {
                _mousePending = true;
                requestAnimationFrame(() => {
                    mouse.x = _targetMouse.x;
                    mouse.y = _targetMouse.y;
                    _mousePending = false;
                });
            }
        }, { passive: true });

        function draw(t) {
            mainCtx.clearRect(0, 0, W, H);
            _drawNebula(mainCtx, t);
            _drawLayer(mainCtx, layers[0], t, 0.15);
            _drawLayer(mainCtx, layers[1], t, 0.45);
            _drawLayer(mainCtx, layers[2], t, 0.9);
            _rafMain = requestAnimationFrame(draw);
        }
        _rafMain = requestAnimationFrame(draw);
    }

    /* ---------- Resize (debounce 200ms) ---------- */
    function _resize(canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        W = canvas.width;
        H = canvas.height;
    }

    window.addEventListener('resize', () => {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(() => {
            if (mainCanvas) {
                _resize(mainCanvas);
                _initLayers(mainCanvas.width, mainCanvas.height);
            }
            if (landingCanvas && landingCanvas.isConnected) {
                _resize(landingCanvas);
            }
        }, 200);
    }, { passive: true });

    function destroy() {
        if (_rafMain) { cancelAnimationFrame(_rafMain); _rafMain = null; }
        if (_rafLanding) { cancelAnimationFrame(_rafLanding); _rafLanding = null; }
    }

    return { initLanding, initMain, stopLanding, destroy };
})();