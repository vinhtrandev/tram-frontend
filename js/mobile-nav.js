/* ================================================
   MOBILE-NAV.JS v3
   Đóng sound panel khi bấm bất kỳ tab bottom nav
   ================================================ */
(function () {
    'use strict';

    function init() {
        const bnUniverse = document.getElementById('bn-universe');
        const bnMissions = document.getElementById('bn-missions');
        const bnSendBtn = document.getElementById('bn-send-btn');
        const bnStore = document.getElementById('bn-store');
        const bnHeal = document.getElementById('bn-heal');

        const deskMissions = document.getElementById('btn-missions');
        const deskStore = document.getElementById('btn-store');
        const deskHeal = document.getElementById('btn-heal');

        if (bnUniverse) bnUniverse.addEventListener('click', function () {
            setActive('universe');
            closeAllPanels();
        });

        if (bnMissions) bnMissions.addEventListener('click', function () {
            setActive('missions');
            closeAllPanels();
            if (deskMissions) deskMissions.click();
        });

        if (bnSendBtn) bnSendBtn.addEventListener('click', function () {
            setActive('universe');
            closeAllPanels();
            const toggleBtn = document.getElementById('btn-toggle-input');
            if (toggleBtn) toggleBtn.click();
        });

        if (bnStore) bnStore.addEventListener('click', function () {
            setActive('store');
            closeAllPanels();
            if (deskStore) deskStore.click();
        });

        if (bnHeal) bnHeal.addEventListener('click', function () {
            setActive('heal');
            closeAllPanels();
            if (deskHeal) deskHeal.click();
        });

        /* Sync badge thông báo */
        syncBadge();
        const bellBadge = document.getElementById('bell-badge');
        if (bellBadge) {
            new MutationObserver(syncBadge).observe(bellBadge, {
                childList: true, characterData: true, subtree: true, attributes: true
            });
        }
    }

    function setActive(section) {
        const map = {
            universe: 'bn-universe',
            missions: 'bn-missions',
            store: 'bn-store',
            heal: 'bn-heal'
        };
        document.querySelectorAll('.bottom-nav .bn-item').forEach(el => el.classList.remove('active'));
        if (map[section]) {
            const el = document.getElementById(map[section]);
            if (el) el.classList.add('active');
        }
    }

    function closeAllPanels() {
        /* Đóng các side panel */
        ['missions-panel', 'store-panel', 'heal-panel', 'notif-panel'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        /* Đóng sound panel nếu đang mở */
        if (typeof window._closeSoundPanel === 'function') {
            window._closeSoundPanel();
        }
    }

    function syncBadge() {
        const bellBadge = document.getElementById('bell-badge');
        const bnBadge = document.getElementById('bn-missions-badge');
        if (!bellBadge || !bnBadge) return;
        const hidden = bellBadge.classList.contains('hidden');
        const count = (bellBadge.textContent || '').trim();
        if (hidden || !count || count === '0') {
            bnBadge.classList.add('hidden');
        } else {
            bnBadge.textContent = count;
            bnBadge.classList.remove('hidden');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();