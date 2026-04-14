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