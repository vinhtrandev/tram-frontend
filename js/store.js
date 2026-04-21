/* ================================================
   TRẠM GỬI TÍN HIỆU - store.js  [v2 - optimised]
   ================================================ */

const Store = (() => {
    let currentTab = 'experience';

    function init() { _renderTabs(); _renderContent(); }

    function _renderTabs() {
        document.querySelectorAll('.store-tab').forEach(tab =>
            tab.addEventListener('click', () => {
                document.querySelectorAll('.store-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                _renderContent();
            })
        );
    }

    function _renderContent() {
        const el = document.getElementById('store-content');
        if (!el) return;
        if (!STATE.unlocked) STATE.unlocked = {};
        const items = CONFIG.STORE[currentTab] || [];
        el.innerHTML = '';

        if (currentTab === 'community') {
            const total = parseInt(localStorage.getItem('tram_trees') || '0');
            const cc = document.createElement('div');
            cc.className = 'community-counter';
            cc.innerHTML = `<span class="count">🌳 ${total}</span><span class="label">cây xanh cộng đồng đã trồng</span>`;
            el.appendChild(cc);
        }

        const pts = parseInt(STATE.points) || 0;
        items.forEach(item => {
            const isUnlocked = !!STATE.unlocked[item.id];
            const canAfford = pts >= item.price;
            const div = document.createElement('div');
            div.className = 'store-item';
            div.id = `store-item-${item.id}`;
            div.innerHTML = `
                <div class="store-item-header">
                    <span class="store-item-name">${item.icon} ${item.name}</span>
                    <span class="store-item-price">${item.price} ✨</span>
                </div>
                <p class="store-item-desc">${item.desc}</p>
                <button class="btn-unlock ${isUnlocked ? 'unlocked' : ''}"
                    ${isUnlocked || !canAfford ? 'disabled' : ''}
                    data-id="${item.id}" data-price="${item.price}" data-name="${item.name}"
                    ${!isUnlocked && !canAfford ? 'title="Chưa đủ ✨ Tinh Tú"' : ''}>
                    ${isUnlocked ? '✓ Đã mở khóa' : 'Mở khóa bằng ✨'}
                </button>`;
            if (!isUnlocked && !canAfford) div.querySelector('.btn-unlock').style.opacity = '0.4';
            el.appendChild(div);
        });

        el.querySelectorAll('.btn-unlock:not([disabled])').forEach(btn =>
            btn.addEventListener('click', () =>
                _unlock(btn.dataset.id, parseInt(btn.dataset.price), btn.dataset.name))
        );
    }

    async function _unlock(itemId, price, itemName) {
        const pts = parseInt(STATE.points) || 0;
        if (pts < price) { UI.showToast('❌ Không đủ ✨ Tinh Tú!'); return; }

        const isLocal = !STATE.user?.token || STATE.user.token === 'local';

        if (isLocal) {
            STATE.points = pts - price;
            STATE.unlocked = STATE.unlocked || {};
            STATE.unlocked[itemId] = true;
            Auth.saveState();
            if (itemId === 'plant_tree') _incrementTrees();
            NotifSystem.add('spend', `-${price}`, `Quy đổi: ${itemName || itemId}`);
            document.getElementById(`store-item-${itemId}`)?.classList.add('just-unlocked');
            UI.showToast('🎉 Mở khóa thành công!');
            UI.updateHUD(); _renderContent();
            return;
        }

        const btn = document.querySelector(`#store-item-${itemId} .btn-unlock`);
        if (btn) { btn.disabled = true; btn.textContent = 'Đang xử lý...'; }

        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.user.token}` },
                body: JSON.stringify({ itemId }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Lỗi không xác định' }));
                UI.showToast(`❌ ${err.message}`);
                if (btn) { btn.disabled = false; btn.textContent = 'Mở khóa bằng ✨'; }
                return;
            }
            const data = await res.json();
            STATE.points = parseInt(data.points) || 0;
            const arr = Array.isArray(data.unlockedItems) ? data.unlockedItems
                : typeof data.unlockedItems === 'string' ? data.unlockedItems.split(',').filter(Boolean)
                    : [];
            STATE.unlocked = Object.fromEntries(arr.map(id => [id, true]));
            Auth.saveState();
            if (itemId === 'plant_tree') _incrementTrees();
            NotifSystem.add('spend', `-${price}`, `Quy đổi: ${itemName || itemId}`);
            document.getElementById(`store-item-${itemId}`)?.classList.add('just-unlocked');
            UI.showToast('🎉 Mở khóa thành công! Tận hưởng phần thưởng của bạn nhé.');
            UI.updateHUD(); _renderContent();
        } catch (err) {
            console.error('unlock error:', err);
            UI.showToast('❌ Lỗi kết nối, thử lại sau!');
            if (btn) { btn.disabled = false; btn.textContent = 'Mở khóa bằng ✨'; }
        }
    }

    function _incrementTrees() {
        localStorage.setItem('tram_trees', parseInt(localStorage.getItem('tram_trees') || '0') + 1);
    }

    return { init };
})();