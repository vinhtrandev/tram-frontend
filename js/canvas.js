/* ================================================
   TRẠM GỬI TÍN HIỆU - canvas.js
   Nebula background only (đã xóa star layers)
================================================ */

const Canvas = (() => {

    let landingCtx, mainCtx;
    let landingCanvas, mainCanvas;
    let W, H;
    let _rafMain = null;
    let _rafLanding = null;
    let _resizeTimer = null;

    /* ---------- Nebula ---------- */
    function _drawNebula(ctx, t) {
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;

        // Lớp 1: Tinh vân lớn chính
        const nebulas = [
            { x: W * 0.78, y: H * 0.14, rx: 0.38, ry: 0.28, color: [72, 14, 140], alpha: 0.18, drift: 0.28, speed: 0.00016 },
            { x: W * 0.14, y: H * 0.78, rx: 0.32, ry: 0.38, color: [10, 45, 120], alpha: 0.20, drift: -0.18, speed: 0.00012 },
            { x: W * 0.88, y: H * 0.55, rx: 0.28, ry: 0.22, color: [110, 18, 70], alpha: 0.13, drift: 0.14, speed: 0.00020 },
            { x: W * 0.08, y: H * 0.22, rx: 0.25, ry: 0.20, color: [8, 55, 90], alpha: 0.16, drift: -0.22, speed: 0.00018 },
            { x: W * 0.48, y: H * 0.65, rx: 0.22, ry: 0.18, color: [130, 25, 85], alpha: 0.10, drift: 0.10, speed: 0.00014 },
        ];

        nebulas.forEach(n => {
            const phase = t * n.speed + n.drift;
            const ox = Math.sin(phase) * W * 0.025;
            const oy = Math.cos(phase * 0.7) * H * 0.018;
            const gx = n.x + ox;
            const gy = n.y + oy;
            const rw = W * n.rx;
            const rh = H * n.ry;

            ctx.save();
            ctx.beginPath();
            ctx.ellipse(gx, gy, rw, rh, Math.sin(phase * 0.3) * 0.3, 0, Math.PI * 2);
            const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(rw, rh));
            gr.addColorStop(0, `rgba(${n.color},${n.alpha})`);
            gr.addColorStop(0.4, `rgba(${n.color},${(n.alpha * 0.5).toFixed(3)})`);
            gr.addColorStop(1, `rgba(${n.color},0)`);
            ctx.fillStyle = gr;
            ctx.fill();
            ctx.restore();
        });

        // Lớp 2: Micro-nebula nhỏ — tạo chiều sâu
        const microNebulas = [
            { x: W * 0.55, y: H * 0.10, r: W * 0.12, color: [200, 140, 255], alpha: 0.06, drift: 0.5 },
            { x: W * 0.32, y: H * 0.45, r: W * 0.10, color: [100, 160, 255], alpha: 0.05, drift: -0.4 },
            { x: W * 0.70, y: H * 0.82, r: W * 0.11, color: [80, 200, 200], alpha: 0.04, drift: 0.3 },
            { x: W * 0.22, y: H * 0.62, r: W * 0.09, color: [240, 120, 160], alpha: 0.04, drift: -0.6 },
        ];

        microNebulas.forEach(n => {
            const off = Math.sin(t * 0.00025 + n.drift) * 14;
            const gx = n.x + off;
            const gy = n.y + Math.cos(t * 0.00020 + n.drift) * 10;
            const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, n.r);
            gr.addColorStop(0, `rgba(${n.color},${n.alpha})`);
            gr.addColorStop(1, `rgba(${n.color},0)`);
            ctx.fillStyle = gr;
            ctx.beginPath();
            ctx.arc(gx, gy, n.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // Lớp 3: Tia sáng rất mờ (God rays)
        const rayOpacity = (Math.sin(t * 0.00008) * 0.5 + 0.5) * 0.04;
        if (rayOpacity > 0.005) {
            const rays = [
                { ox: W * 0.78, oy: 0, angle: Math.PI * 0.55, len: H * 0.9 },
                { ox: W * 0.20, oy: 0, angle: Math.PI * 0.48, len: H * 0.7 },
            ];
            rays.forEach(r => {
                const ex = r.ox + Math.cos(r.angle) * r.len;
                const ey = r.oy + Math.sin(r.angle) * r.len;
                const gr = ctx.createLinearGradient(r.ox, r.oy, ex, ey);
                gr.addColorStop(0, `rgba(180,120,255,${rayOpacity})`);
                gr.addColorStop(0.5, `rgba(120, 80,200,${rayOpacity * 0.4})`);
                gr.addColorStop(1, `rgba(80, 40,160,0)`);
                ctx.save();
                ctx.globalAlpha = 1;
                ctx.fillStyle = gr;
                ctx.beginPath();
                ctx.moveTo(r.ox - 40, r.oy);
                ctx.lineTo(r.ox + 40, r.oy);
                ctx.lineTo(ex + 80, ey);
                ctx.lineTo(ex - 80, ey);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            });
        }
    }

    /* ---------- Landing canvas ---------- */
    function initLanding() {
        landingCanvas = document.getElementById('landing-stars');
        if (!landingCanvas) return;
        landingCtx = landingCanvas.getContext('2d');
        _resize(landingCanvas);

        function draw(t) {
            if (!landingCanvas.isConnected) { _rafLanding = null; return; }
            const { width: w, height: h } = landingCanvas;
            landingCtx.clearRect(0, 0, w, h);
            _rafLanding = requestAnimationFrame(draw);
        }
        _rafLanding = requestAnimationFrame(draw);
    }

    /* ---------- Stop landing ---------- */
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

        function draw(t) {
            W = mainCanvas.width;
            H = mainCanvas.height;
            mainCtx.clearRect(0, 0, W, H);
            _drawNebula(mainCtx, t);
            _rafMain = requestAnimationFrame(draw);
        }
        _rafMain = requestAnimationFrame(draw);
    }

    /* ---------- Resize ---------- */
    function _resize(canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        W = canvas.width;
        H = canvas.height;
    }

    window.addEventListener('resize', () => {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(() => {
            if (mainCanvas) _resize(mainCanvas);
            if (landingCanvas && landingCanvas.isConnected) _resize(landingCanvas);
        }, 200);
    }, { passive: true });

    function destroy() {
        if (_rafMain) { cancelAnimationFrame(_rafMain); _rafMain = null; }
        if (_rafLanding) { cancelAnimationFrame(_rafLanding); _rafLanding = null; }
    }

    return { initLanding, initMain, stopLanding, destroy };
})();