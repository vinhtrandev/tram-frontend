/* ================================================
   TRẠM GỬI TÍN HIỆU - auth.js  [v2 - optimised]
   ================================================ */

const Auth = (() => {

    const KEY_USER = 'tram_user';
    const KEY_POINTS = 'tram_points';
    const KEY_MISSIONS = 'tram_missions';
    const KEY_STREAK = 'tram_streak';
    const KEY_UNLOCKED = 'tram_unlocked';

    /* ── localStorage helpers ── */
    function _lsGet(key, fallback = null) {
        try { const v = localStorage.getItem(key); return v != null ? JSON.parse(v) : fallback; }
        catch { return fallback; }
    }
    function _lsSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
    }

    /* ── Session ── */
    function loadSession() {
        const user = _lsGet(KEY_USER);
        if (!user) return false;
        STATE.user = user;
        STATE.points = parseInt(_lsGet(KEY_POINTS) ?? 0, 10);
        STATE.dailyMissions = _lsGet(KEY_MISSIONS) || {};
        STATE.streak = _lsGet(KEY_STREAK) || [];
        STATE.unlocked = _lsGet(KEY_UNLOCKED) || {};
        return true;
    }

    function saveState() {
        if (!STATE.user) return;
        _lsSet(KEY_POINTS, STATE.points);
        _lsSet(KEY_MISSIONS, STATE.dailyMissions);
        _lsSet(KEY_STREAK, STATE.streak);
        _lsSet(KEY_UNLOCKED, STATE.unlocked);
    }

    /* ── Server sync (called once after login / boot) ── */
    async function syncFromServer() {
        const token = STATE.user?.token;
        if (!token || token === 'local') return;

        try {
            const res = await _apiFetch('/auth/me');
            if (!res.ok) return;
            const data = await res.json();
            STATE.points = data.points;
            _setUnlocked(data.unlockedItems);
            _lsSet(KEY_POINTS, STATE.points);
            _lsSet(KEY_UNLOCKED, STATE.unlocked);
            UI?.updateHUD?.();
        } catch { /* offline */ }
    }

    /* ── Shared fetch wrapper (handles token, timeout) ── */
    function _apiFetch(path, options = {}, timeoutMs = 8000) {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(`${CONFIG.API_BASE}${path}`, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(STATE.user?.token && STATE.user.token !== 'local'
                    ? { 'Authorization': `Bearer ${STATE.user.token}` }
                    : {}),
                ...options.headers,
            },
        }).finally(() => clearTimeout(tid));
    }

    /* ── Register / Login ── */
    async function register(nickname, password) {
        return _authRequest('/auth/register', nickname, password);
    }

    async function login(nickname, password) {
        return _authRequest('/auth/login', nickname, password);
    }

    async function _authRequest(path, nickname, password) {
        try {
            const res = await _apiFetch(path, {
                method: 'POST',
                body: JSON.stringify({ nickname, password }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Lỗi kết nối');
            }
            return _saveUser(await res.json());
        } catch (e) {
            if (e.name === 'AbortError' || e.name === 'TypeError') {
                return _localMode(nickname, password);
            }
            throw e;
        }
    }

    function _saveUser(data) {
        const user = { id: data.id, nickname: data.nickname, token: data.token };
        STATE.user = user;
        STATE.points = data.points || 0;
        _setUnlocked(data.unlockedItems);
        _lsSet(KEY_USER, user);
        _lsSet(KEY_POINTS, STATE.points);
        _lsSet(KEY_UNLOCKED, STATE.unlocked);
        return true;
    }

    function _setUnlocked(raw) {
        const arr = typeof raw === 'string'
            ? raw.split(',').filter(Boolean)
            : (Array.isArray(raw) ? raw : []);
        STATE.unlocked = Object.fromEntries(arr.map(id => [id, true]));
    }

    function _localMode(nickname, password) {
        const stored = _lsGet(KEY_USER);
        if (stored) {
            if (stored.nickname !== nickname) throw new Error('Sai mật danh hoặc chìa khóa');
            if (stored.pwHash !== _hash(password)) throw new Error('Sai mật danh hoặc chìa khóa');
        } else {
            _lsSet(KEY_USER, { id: Date.now(), nickname, pwHash: _hash(password), token: 'local' });
        }
        loadSession();
        return true;
    }

    function _hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        return h.toString(16);
    }

    /* ── Logout ── */
    function logout() {
        saveState();
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem(KEY_UNLOCKED);
        STATE.user = null;
        STATE.unlocked = {};
    }

    /* ── Auth UI ── */
    function initAuthUI() {
        const modal = document.getElementById('auth-modal');
        const tabs = document.querySelectorAll('.auth-tab');
        const btnSubmit = document.getElementById('btn-auth-submit');
        const errEl = document.getElementById('auth-error');
        let isRegister = false;

        tabs.forEach(tab => tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            isRegister = tab.dataset.tab === 'register';
            btnSubmit.textContent = isRegister ? 'Tạo danh tính' : 'Bước vào Trạm';
            errEl.classList.add('hidden');
        }));

        btnSubmit.addEventListener('click', _handleSubmit);
        document.getElementById('auth-password')
            .addEventListener('keydown', e => { if (e.key === 'Enter') btnSubmit.click(); });

        async function _handleSubmit() {
            const nick = document.getElementById('auth-username').value.trim();
            const pass = document.getElementById('auth-password').value;

            errEl.classList.add('hidden');
            if (!nick || !pass) return _showErr('Vui lòng điền đầy đủ thông tin');
            if (nick.length < 3) return _showErr('Mật danh cần ít nhất 3 ký tự');
            if (pass.length < 6) return _showErr('Chìa khóa cần ít nhất 6 ký tự');

            const label = btnSubmit.textContent;
            btnSubmit.textContent = '...';
            btnSubmit.disabled = true;
            try {
                await (isRegister ? register : login)(nick, pass);
                modal.classList.add('hidden');
                App.enterMain();
            } catch (e) {
                _showErr(e.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = label;
            }
        }

        function _showErr(msg) {
            errEl.textContent = msg;
            errEl.classList.remove('hidden');
        }
    }

    return { loadSession, saveState, login, register, logout, initAuthUI, syncFromServer };
})();