/* ================================================
   TRẠM GỬI TÍN HIỆU - auth.js
   Authentication (Stealth Auth) logic
   ================================================ */

const Auth = (() => {

    const KEY_USER = 'tram_user';
    const KEY_POINTS = 'tram_points';
    const KEY_MISSIONS = 'tram_missions';
    const KEY_STREAK = 'tram_streak';
    const KEY_UNLOCKED = 'tram_unlocked';

    function loadSession() {
        const raw = localStorage.getItem(KEY_USER);
        if (!raw) return false;
        try {
            const user = JSON.parse(raw);
            STATE.user = user;
            STATE.points = parseInt(localStorage.getItem(KEY_POINTS) || '0', 10);
            STATE.dailyMissions = JSON.parse(localStorage.getItem(KEY_MISSIONS) || '{}');
            STATE.streak = JSON.parse(localStorage.getItem(KEY_STREAK) || '[]');
            STATE.unlocked = JSON.parse(localStorage.getItem(KEY_UNLOCKED) || '{}');
            return true;
        } catch { return false; }
    }

    // ✅ Sync points và unlocked từ server
    async function syncFromServer() {
        if (!STATE.user?.token || STATE.user.token === 'local') return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${STATE.user.token}` }
            });
            if (!res.ok) return;
            const data = await res.json();

            STATE.points = data.points;
            const unlockedArr = data.unlockedItems
                ? data.unlockedItems.split(',').filter(Boolean)
                : [];
            STATE.unlocked = {};
            unlockedArr.forEach(id => STATE.unlocked[id] = true);

            localStorage.setItem(KEY_POINTS, STATE.points);
            localStorage.setItem(KEY_UNLOCKED, JSON.stringify(STATE.unlocked));
        } catch { /* offline, dùng localStorage */ }
    }

    function saveState() {
        if (!STATE.user) return;
        localStorage.setItem(KEY_POINTS, STATE.points);
        localStorage.setItem(KEY_MISSIONS, JSON.stringify(STATE.dailyMissions));
        localStorage.setItem(KEY_STREAK, JSON.stringify(STATE.streak));
        localStorage.setItem(KEY_UNLOCKED, JSON.stringify(STATE.unlocked));
    }

    async function register(nickname, password) {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname, password })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Đăng ký thất bại');
            }
            const data = await res.json();
            return _saveUser(data);
        } catch (e) {
            if (e.name === 'TypeError') return _localMode(nickname, password);
            throw e;
        }
    }

    async function login(nickname, password) {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname, password })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Sai mật danh hoặc chìa khóa');
            }
            const data = await res.json();
            return _saveUser(data);
        } catch (e) {
            if (e.name === 'TypeError') return _localMode(nickname, password);
            throw e;
        }
    }

    function _saveUser(data) {
        const user = { id: data.id, nickname: data.nickname, token: data.token };
        STATE.user = user;
        STATE.points = data.points || 0;

        // ✅ Load unlocked từ server
        const unlockedArr = data.unlockedItems
            ? data.unlockedItems.split(',').filter(Boolean)
            : [];
        STATE.unlocked = {};
        unlockedArr.forEach(id => STATE.unlocked[id] = true);

        localStorage.setItem(KEY_USER, JSON.stringify(user));
        localStorage.setItem(KEY_POINTS, STATE.points);
        localStorage.setItem(KEY_UNLOCKED, JSON.stringify(STATE.unlocked));
        return true;
    }

    function _localMode(nickname, password) {
        const stored = localStorage.getItem(KEY_USER);
        if (stored) {
            const u = JSON.parse(stored);
            if (u.nickname !== nickname) throw new Error('Sai mật danh hoặc chìa khóa');
            if (u.pwHash !== _hash(password)) throw new Error('Sai mật danh hoặc chìa khóa');
        } else {
            const u = { id: Date.now(), nickname, pwHash: _hash(password), token: 'local' };
            localStorage.setItem(KEY_USER, JSON.stringify(u));
        }
        loadSession();
        return true;
    }

    function _hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        return h.toString(16);
    }

    function logout() {
        saveState();
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem(KEY_UNLOCKED);
        STATE.user = null;
        STATE.unlocked = {};
    }

    function initAuthUI() {
        const modal = document.getElementById('auth-modal');
        const tabs = document.querySelectorAll('.auth-tab');
        const btnSubmit = document.getElementById('btn-auth-submit');
        const errEl = document.getElementById('auth-error');
        let isRegister = false;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                isRegister = tab.dataset.tab === 'register';
                btnSubmit.textContent = isRegister ? 'Tạo danh tính' : 'Bước vào Trạm';
                errEl.classList.add('hidden');
            });
        });

        btnSubmit.addEventListener('click', async () => {
            const nick = document.getElementById('auth-username').value.trim();
            const pass = document.getElementById('auth-password').value;
            if (!nick || !pass) { showError('Vui lòng điền đầy đủ thông tin'); return; }
            if (nick.length < 3) { showError('Mật danh cần ít nhất 3 ký tự'); return; }
            if (pass.length < 6) { showError('Chìa khóa cần ít nhất 6 ký tự'); return; }

            btnSubmit.textContent = '...';
            btnSubmit.disabled = true;

            try {
                const fn = isRegister ? register : login;
                await fn(nick, pass);
                modal.classList.add('hidden');
                App.enterMain();
            } catch (e) {
                showError(e.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = isRegister ? 'Tạo danh tính' : 'Bước vào Trạm';
            }
        });

        document.getElementById('auth-password').addEventListener('keydown', e => {
            if (e.key === 'Enter') btnSubmit.click();
        });

        function showError(msg) {
            errEl.textContent = msg;
            errEl.classList.remove('hidden');
        }
    }

    return { loadSession, saveState, login, register, logout, initAuthUI, syncFromServer };
})();