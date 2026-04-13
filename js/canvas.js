/* ================================================
   TRẠM GỬI TÍN HIỆU - canvas.js
   Three-layer parallax star background + nebula
   ================================================ */

const Canvas = (() => {

    let landingCtx, mainCtx;
    let landingCanvas, mainCanvas;
    let W, H;
    let mouse = { x: 0, y: 0 };
    let raf;

    /* ---------- Star layers ---------- */
    const layers = [
        // Layer 0: far (tiny, slow)
        { stars: [], count: 160, sizeMin: 0.8, sizeMax: 2.2, speed: 0.3, baseOpacity: [0.25, 0.6] },
        // Layer 1: mid
        { stars: [], count: 80, sizeMin: 2.2, sizeMax: 4.5, speed: 0.6, baseOpacity: [0.45, 0.85] },
        // Layer 2: near (large, blurry, fast parallax)
        { stars: [], count: 30, sizeMin: 4.5, sizeMax: 8.0, speed: 1.2, baseOpacity: [0.2, 0.5] }
    ];

    const COLORS = ['#FFFDE7', '#E1F5FE', '#F8F8FF', '#CE93D8', '#F48FB1'];

    function _rand(a, b) { return a + Math.random() * (b - a); }

    /* ---------- Init layers ---------- */
    function _initLayers(w, h) {
        layers.forEach(layer => {
            layer.stars = Array.from({ length: layer.count }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                ox: 0, oy: 0,
                size: _rand(layer.sizeMin, layer.sizeMax),
                opacity: _rand(layer.baseOpacity[0], layer.baseOpacity[1]),
                twinkleSpeed: _rand(0.002, 0.008),
                twinklePhase: Math.random() * Math.PI * 2,
                color: COLORS[Math.floor(Math.random() * COLORS.length)]
            }));
        });
    }

    /* ---------- Draw one layer ---------- */
    function _drawLayer(ctx, layer, t, parallaxFactor) {
        const cx = W / 2, cy = H / 2;
        const dx = (mouse.x - cx) * parallaxFactor * 0.04;
        const dy = (mouse.y - cy) * parallaxFactor * 0.04;

        layer.stars.forEach(s => {
            const tw = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed * 1000 + s.twinklePhase);
            const op = s.opacity * (0.6 + 0.4 * tw);

            ctx.save();
            ctx.globalAlpha = Math.min(op, 1);
            ctx.fillStyle = s.color;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = s.size * 3 * tw;

            ctx.beginPath();
            ctx.arc(s.x + dx, s.y + dy, s.size * (0.9 + 0.1 * tw), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    /* ---------- Nebula ---------- */
    function _drawNebula(ctx, t) {
        const nebulas = [
            { x: W * 0.6, y: H * 0.2, rx: 300, ry: 200, color: 'rgba(26,27,46,', drift: 0.3 },
            { x: W * 0.2, y: H * 0.7, rx: 200, ry: 280, color: 'rgba(20,10,40,', drift: -0.2 },
            { x: W * 0.8, y: H * 0.6, rx: 180, ry: 150, color: 'rgba(30,15,50,', drift: 0.15 }
        ];
        nebulas.forEach(n => {
            const off = Math.sin(t * 0.0002 + n.drift) * 20;
            const grad = ctx.createRadialGradient(n.x + off, n.y + off, 0, n.x + off, n.y + off, Math.max(n.rx, n.ry));
            grad.addColorStop(0, n.color + '0.5)');
            grad.addColorStop(1, n.color + '0)');
            ctx.save();
            ctx.scale(n.rx / Math.max(n.rx, n.ry), n.ry / Math.max(n.rx, n.ry));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc((n.x + off) / (n.rx / Math.max(n.rx, n.ry)), (n.y + off) / (n.ry / Math.max(n.rx, n.ry)), Math.max(n.rx, n.ry), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    /* ---------- Landing canvas ---------- */
    function initLanding() {
        landingCanvas = document.getElementById('landing-stars');
        landingCtx = landingCanvas.getContext('2d');
        _resize(landingCanvas);

        const stars = Array.from({ length: 200 }, () => ({
            x: Math.random(), y: Math.random(),
            size: _rand(1.2, 4.5),
            opacity: _rand(0.25, 0.85),
            twinkleSpeed: _rand(0.001, 0.006),
            twinklePhase: Math.random() * Math.PI * 2,
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        }));

        function draw(t) {
            const { width: w, height: h } = landingCanvas;
            landingCtx.clearRect(0, 0, w, h);

            stars.forEach(s => {
                const tw = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed * 1000 + s.twinklePhase);
                const op = s.opacity * (0.6 + 0.4 * tw);
                landingCtx.save();
                landingCtx.globalAlpha = op;
                landingCtx.fillStyle = s.color;
                landingCtx.shadowColor = s.color;
                landingCtx.shadowBlur = s.size * 4 * tw;
                landingCtx.beginPath();
                landingCtx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
                landingCtx.fill();
                landingCtx.restore();
            });

            requestAnimationFrame(draw);
        }
        requestAnimationFrame(draw);
    }

    /* ---------- Main canvas ---------- */
    function initMain() {
        mainCanvas = document.getElementById('star-canvas');
        mainCtx = mainCanvas.getContext('2d');
        _resize(mainCanvas);
        W = mainCanvas.width;
        H = mainCanvas.height;

        _initLayers(W, H);

        window.addEventListener('mousemove', e => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        function draw(t) {
            mainCtx.clearRect(0, 0, W, H);
            _drawNebula(mainCtx, t);
            _drawLayer(mainCtx, layers[0], t, 0.2);
            _drawLayer(mainCtx, layers[1], t, 0.5);
            _drawLayer(mainCtx, layers[2], t, 1.0);
            raf = requestAnimationFrame(draw);
        }
        raf = requestAnimationFrame(draw);
    }

    function _resize(canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        W = canvas.width;
        H = canvas.height;
    }

    function destroy() {
        if (raf) cancelAnimationFrame(raf);
    }

    window.addEventListener('resize', () => {
        if (mainCanvas) { _resize(mainCanvas); _initLayers(mainCanvas.width, mainCanvas.height); }
    });

    return { initLanding, initMain, destroy };
})();