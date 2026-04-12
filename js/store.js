/* ================================================
   TRẠM GỬI TÍN HIỆU - store.js (FIXED & HOÀN CHỈNH)
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

        // FIX: Đảm bảo STATE.unlocked tồn tại
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

        // FIX: Đảm bảo STATE.points là số hợp lệ
        const currentPoints = parseInt(STATE.points) || 0;

        items.forEach(item => {
            const isUnlocked = !!STATE.unlocked[item.id];
            const canAfford = currentPoints >= item.price;
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
                btn.disabled = true; // FIX: Disable hẳn nếu không đủ điểm
            }

            el.appendChild(div);
        });

        // FIX: Chỉ bind event cho nút chưa disabled
        el.querySelectorAll('.btn-unlock:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => _unlock(btn.dataset.id, parseInt(btn.dataset.price)));
        });
    }

    // FIX: Thêm param price để kiểm tra client-side trước khi gọi API
    async function _unlock(itemId, price) {
        // FIX: Kiểm tra điểm client-side trước
        const currentPoints = parseInt(STATE.points) || 0;
        if (currentPoints < price) {
            UI.showToast('❌ Không đủ ✨ Tinh Tú!');
            return;
        }

        // Offline / local mode fallback
        if (!STATE.user?.token || STATE.user.token === 'local') {
            // FIX: Cho phép mở khóa offline bằng cách trừ điểm local
            STATE.points = currentPoints - price;
            if (!STATE.unlocked) STATE.unlocked = {};
            STATE.unlocked[itemId] = true;
            Auth.saveState();

            if (itemId === 'plant_tree') {
                const t = parseInt(localStorage.getItem('tram_trees') || '0') + 1;
                localStorage.setItem('tram_trees', t);
            }

            const itemEl = document.getElementById(`store-item-${itemId}`);
            if (itemEl) itemEl.classList.add('just-unlocked');

            UI.showToast('🎉 Mở khóa thành công!');
            UI.updateHUD();
            _renderContent();
            return;
        }

        // Online mode
        try {
            // FIX: Disable nút trong khi đang xử lý để tránh double click
            const btn = document.querySelector(`#store-item-${itemId} .btn-unlock`);
            if (btn) { btn.disabled = true; btn.textContent = 'Đang xử lý...'; }

            const res = await fetch(`${CONFIG.API_BASE}/auth/unlock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${STATE.user.token}`
                },
                body: JSON.stringify({ itemId })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Lỗi không xác định' }));
                UI.showToast(`❌ ${err.message}`);
                // FIX: Re-enable nút nếu thất bại
                if (btn) { btn.disabled = false; btn.textContent = 'Mở khóa bằng ✨'; }
                return;
            }

            const data = await res.json();

            // FIX: Cập nhật STATE từ server response
            STATE.points = parseInt(data.points) || 0;

            // FIX: Xử lý unlockedItems dù là array hay string
            if (Array.isArray(data.unlockedItems)) {
                STATE.unlocked = {};
                data.unlockedItems.forEach(id => { STATE.unlocked[id] = true; });
            } else if (typeof data.unlockedItems === 'string') {
                const unlockedArr = data.unlockedItems.split(',').filter(Boolean);
                STATE.unlocked = {};
                unlockedArr.forEach(id => { STATE.unlocked[id] = true; });
            }

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

        } catch (err) {
            console.error('unlock error:', err);
            UI.showToast('❌ Lỗi kết nối, thử lại sau!');
            // FIX: Re-enable nút nếu lỗi mạng
            const btn = document.querySelector(`#store-item-${itemId} .btn-unlock`);
            if (btn) { btn.disabled = false; btn.textContent = 'Mở khóa bằng ✨'; }
        }
    }

    return { init };
})();