/* ================================================
   SOUND-TOGGLE.JS v6
   Mobile: nút 🎵 floating riêng, panel mở phía TRÊN không che form
   Desktop: không can thiệp, panel hiển thị bình thường
   ================================================ */
(function () {
    'use strict';

    function isMobileView() {
        return window.matchMedia('(max-width: 700px)').matches;
    }

    function init() {
        const panel = document.getElementById('sound-panel');
        if (!panel) return;

        if (!isMobileView()) return; /* Desktop: không can thiệp */

        /* -- Tạo nút floating 🎵 bên ngoài panel -- */
        let floatBtn = document.getElementById('sound-float-btn');
        if (!floatBtn) {
            floatBtn = document.createElement('button');
            floatBtn.id = 'sound-float-btn';
            floatBtn.className = 'sound-float-btn';
            floatBtn.innerHTML = '🎵';
            floatBtn.title = 'Âm thanh';
            document.body.appendChild(floatBtn);
        }

        /* -- Tạo nút đóng X bên trong panel (nếu chưa có) -- */
        let closeBtn = document.getElementById('sound-close-btn');
        if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.id = 'sound-close-btn';
            closeBtn.className = 'sound-close-btn';
            closeBtn.innerHTML = '✕';
            panel.appendChild(closeBtn);
        }

        function openPanel() {
            panel.classList.add('sp-open');
            panel.style.display = 'flex';
            floatBtn.style.display = 'none';
        }

        function closePanel() {
            panel.classList.remove('sp-open');
            panel.style.display = 'none';
            floatBtn.style.display = 'flex';
        }

        /* Expose để MOBILE-NAV có thể gọi khi đổi tab */
        window._closeSoundPanel = closePanel;

        floatBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openPanel();
        });

        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            closePanel();
        });

        document.addEventListener('click', function (e) {
            if (!panel.contains(e.target) && e.target !== floatBtn) {
                closePanel();
            }
        });

        /* Trạng thái ban đầu: ẩn panel, hiện nút floating */
        closePanel();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();