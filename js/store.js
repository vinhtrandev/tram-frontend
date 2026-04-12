/* ================================================
   TRẠM GỬI TÍN HIỆU - store.js
   Star Store: three tabs, unlock items
   ================================================ */

const Store = (() => {

    let currentTab = 'experience';

    function init() {
        _renderTabs();
        _renderContent();
    }

    function _renderTabs() {
        document.querySelectorAll('.store-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.store-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                _renderContent();
            });
        });
    }

    function _renderContent() {
        const el = document.getElementById('store-content');
        if (!el) return;
        const items = CONFIG.STORE[currentTab] || [];
        el.innerHTML = '';

        if (currentTab === 'community') {
            const total = parseInt(localStorage.getItem('tram_trees') || '0');
            const cc = document.createElement('div');
            cc.className = 'community-counter';
            cc.innerHTML = `<span class="count">🌳 ${total}</span><span class="label">cây xanh cộng đồng đã trồng</span>`;
            el.appendChild(cc);
        }

        items.forEach(item => {
            const isUnlocked = !!STATE.unlocked[item.id];
            const canAfford = STATE.points >= item.price;
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
                ${isUnlocked ? 'disabled' : ''}
                data-id="${item.id}"
                data-price="${item.price}">
          ${isUnlocked ? '✓ Đã mở khóa' : 'Mở khóa bằng ✨'}
        </button>
      `;
            if (!isUnlocked && !canAfford) {
                const btn = div.querySelector('.btn-unlock');
                btn.style.opacity = '0.4';
                btn.title = 'Chưa đủ ✨ Tinh Tú';
            }
            el.appendChild(div);
        });

        el.querySelectorAll('.btn-unlock:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => _unlock(btn.dataset.id));
        });
    }

    async function _unlock(itemId) {
        // Offline / local mode fallback
        if (!STATE.user?.token || STATE.user.token === 'local') {
            UI.showToast('❌ Cần kết nối server để mở khóa!');
            return;
        }

        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/unlock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${STATE.user.token}`
                },
                body: JSON.stringify({ itemId })
            });

            if (!res.ok) {
                const err = await res.json();
                UI.showToast(`❌ ${err.message}`);
                return;
            }

            const data = await res.json();

            // ✅ Cập nhật state từ server
            STATE.points = data.points;
            const unlockedArr = data.unlockedItems
                ? data.unlockedItems.split(',').filter(Boolean)
                : [];
            STATE.unlocked = {};
            unlockedArr.forEach(id => STATE.unlocked[id] = true);
            Auth.saveState();

            if (itemId === 'plant_tree') {
                const t = parseInt(localStorage.getItem('tram_trees') || '0') + 1;
                localStorage.setItem('tram_trees', t);
            }

            const itemEl = document.getElementById(`store-item-${itemId}`);
            if (itemEl) itemEl.classList.add('just-unlocked');

            UI.showToast('🎉 Mở khóa thành công! Tận hưởng phần thưởng của bạn nhé.');
            UI.updateHUD();
            _renderContent();

        } catch {
            UI.showToast('❌ Lỗi kết nối, thử lại sau!');
        }
    }

    return { init };
})();