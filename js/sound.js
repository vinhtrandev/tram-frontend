/* ================================================
   TRẠM GỬI TÍN HIỆU - sound.js (FULL v3 - FIXED)
   Web Audio API: ambient sounds + sinewave tones
   + Background Music từ file MP3
   + playVoidEffect(type) — âm thanh riêng cho từng hiệu ứng ngẫu nhiên

   Logic âm thanh:
   - Mặc định: nhạc nền MP3 tự chạy khi vào game
   - Bấm ASMR (mưa/sóng/chuông): tắt nhạc nền, bật ASMR
   - Bấm 🔇 hoặc tắt ASMR: tắt ASMR, bật lại nhạc nền
   ================================================ */

const Sound = (() => {

    let ctx = null;
    let currentNode = null;
    let gainNode = null;

    /* --- BGM state --- */
    let bgmAudio = null;
    let bgmActive = false;

    /* --- Void whoosh state --- */
    let _voidWhooshNode = null;
    let _voidWhooshGain = null;

    function _getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    /* ✅ FIX: Resume AudioContext trước khi play — tránh bị suspend lần đầu */
    async function _resumeCtx() {
        const c = _getCtx();
        if (c.state === 'suspended') {
            await c.resume();
        }
        return c;
    }

    /* ============================================================
       AUDIO FILE URLs — ĐỔI LINK CỦA BẠN VÀO ĐÂY
    ============================================================ */
    const AUDIO_URLS = {
        // Nhạc nền chính — đổi thành link file nhạc nền của bạn
        bgm: 'nhacnen.mp3',

        // 3 âm thanh ASMR quy đổi sao — đổi thành link drive của bạn
        rain: 'mua.mp3',
        wave: 'song.mp3',
        wind: 'chuong.mp3',
    };

    /*
     * HƯỚNG DẪN LẤY LINK GOOGLE DRIVE:
     * 1. Upload file lên Drive → chuột phải → "Chia sẻ" → "Bất kỳ ai có đường liên kết"
     * 2. Lấy ID từ URL:  https://drive.google.com/file/d/  <<<ID>>>  /view
     * 3. Dán vào đây theo dạng:
     *    'https://drive.google.com/uc?export=download&id=<<<ID>>>'
     *
     * Ví dụ:
     *    bgm:  'https://drive.google.com/uc?export=download&id=1A2B3C4D5E6F7G8H'
     *    rain: 'https://drive.google.com/uc?export=download&id=9I8H7G6F5E4D3C2B'
     */

    /* ============================================================
       BACKGROUND MUSIC — file MP3/OGG
    ============================================================ */

    function startBGM() {
        if (bgmActive) return;

        if (!bgmAudio) {
            bgmAudio = new Audio(AUDIO_URLS.bgm);
            bgmAudio.loop = true;
            bgmAudio.volume = 0;
            bgmAudio.crossOrigin = 'anonymous';
            bgmAudio.preload = 'auto';
        }

        /* ✅ FIX: Resume context trước, rồi mới play — không cần retry nữa */
        _resumeCtx().then(() => {
            return bgmAudio.play();
        }).then(() => {
            bgmActive = true;
            _fadeVolume(bgmAudio, 0, 0.3, 1500);
            _updateBGMBtn(true);
        }).catch(() => {
            /* Autoplay vẫn bị chặn (chưa có interaction) — thử lại lần đầu click/key */
            const retry = () => {
                if (bgmActive) return;
                _resumeCtx().then(() => bgmAudio.play()).then(() => {
                    bgmActive = true;
                    _fadeVolume(bgmAudio, 0, 0.3, 1500);
                    _updateBGMBtn(true);
                }).catch(() => { });
                document.removeEventListener('click', retry);
                document.removeEventListener('keydown', retry);
                document.removeEventListener('touchstart', retry);
            };
            document.addEventListener('click', retry);
            document.addEventListener('keydown', retry);
            document.addEventListener('touchstart', retry);
        });
    }

    function stopBGM(onDone) {
        if (!bgmActive || !bgmAudio) {
            if (onDone) onDone();
            return;
        }
        bgmActive = false;
        _fadeVolume(bgmAudio, bgmAudio.volume, 0, 150, () => {
            bgmAudio.pause();
            bgmAudio.currentTime = 0;
            _updateBGMBtn(false);
            if (onDone) onDone();
        });
    }

    function _updateBGMBtn(on) {
        const btn = document.getElementById('bgm-toggle-btn');
        if (!btn) return;
        btn.classList.toggle('active', on);
        btn.title = on ? 'Tắt nhạc nền' : 'Bật nhạc nền';
    }

    function _fadeVolume(audio, from, to, duration, onDone) {
        const steps = 30;
        const interval = duration / steps;
        const delta = (to - from) / steps;
        let current = from;
        let count = 0;
        audio.volume = Math.max(0, Math.min(1, from));
        const timer = setInterval(() => {
            count++;
            current += delta;
            audio.volume = Math.max(0, Math.min(1, current));
            if (count >= steps) {
                clearInterval(timer);
                audio.volume = Math.max(0, Math.min(1, to));
                if (onDone) onDone();
            }
        }, interval);
    }

    /* ============================================================
       HỐ ĐEN — VOID SOUNDS
    ============================================================ */

    function startVoidWhoosh() {
        try {
            const c = _getCtx();
            stopVoidWhoosh();

            const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

            const src = c.createBufferSource();
            src.buffer = buf;
            src.loop = true;

            const filter = c.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 120;
            filter.Q.value = 0.8;

            const lfo = c.createOscillator();
            const lfoGain = c.createGain();
            lfo.frequency.value = 0.8;
            lfoGain.gain.value = 80;
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            lfo.start();

            _voidWhooshGain = c.createGain();
            _voidWhooshGain.gain.setValueAtTime(0, c.currentTime);
            _voidWhooshGain.gain.linearRampToValueAtTime(0.35, c.currentTime + 10);

            src.connect(filter);
            filter.connect(_voidWhooshGain);
            _voidWhooshGain.connect(c.destination);
            src.start();

            _voidWhooshNode = { src, lfo };
        } catch (e) { console.warn('startVoidWhoosh error:', e); }
    }

    function stopVoidWhoosh() {
        try {
            if (_voidWhooshNode?.src) _voidWhooshNode.src.stop();
            if (_voidWhooshNode?.lfo) _voidWhooshNode.lfo.stop();
            if (_voidWhooshGain) _voidWhooshGain.disconnect();
        } catch { }
        _voidWhooshNode = null;
        _voidWhooshGain = null;
    }

    function playVoidRelease() {
        stopVoidWhoosh();
        try {
            const c = _getCtx();
            const now = c.currentTime;

            const rvBuf = c.createBuffer(2, c.sampleRate * 4, c.sampleRate);
            [0, 1].forEach(ch => {
                const d = rvBuf.getChannelData(ch);
                for (let i = 0; i < d.length; i++)
                    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.2);
            });
            const rev = c.createConvolver();
            rev.buffer = rvBuf;
            const revGain = c.createGain();
            revGain.gain.value = 0.5;
            rev.connect(revGain);
            revGain.connect(c.destination);

            const layers = [
                { freq: 174, gain: 0.12, decay: 4.5, delay: 0 },
                { freq: 396, gain: 0.20, decay: 3.8, delay: 0.1 },
                { freq: 528, gain: 0.15, decay: 3.2, delay: 0.3 },
            ];

            layers.forEach(({ freq, gain, decay, delay }) => {
                const osc = c.createOscillator();
                const env = c.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                env.gain.setValueAtTime(0, now + delay);
                env.gain.linearRampToValueAtTime(gain, now + delay + 0.15);
                env.gain.exponentialRampToValueAtTime(0.0001, now + delay + decay);
                osc.connect(env);
                env.connect(c.destination);
                env.connect(rev);
                osc.start(now + delay);
                osc.stop(now + delay + decay + 0.2);
            });

            const noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
            const nd = noiseBuf.getChannelData(0);
            for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
            const nSrc = c.createBufferSource();
            nSrc.buffer = noiseBuf;
            const nFilter = c.createBiquadFilter();
            nFilter.type = 'lowpass';
            nFilter.frequency.setValueAtTime(800, now);
            nFilter.frequency.exponentialRampToValueAtTime(80, now + 1.5);
            const nGain = c.createGain();
            nGain.gain.setValueAtTime(0.25, now);
            nGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
            nSrc.connect(nFilter);
            nFilter.connect(nGain);
            nGain.connect(c.destination);
            nSrc.start(now);
            nSrc.stop(now + 1.6);

        } catch (e) { console.warn('playVoidRelease error:', e); }
    }

    /* ============================================================
       playVoidEffect(type)
    ============================================================ */
    function playVoidEffect(type) {
        try {
            const c = _getCtx();
            const now = c.currentTime;

            const rvBuf = c.createBuffer(2, c.sampleRate * 2.5, c.sampleRate);
            [0, 1].forEach(ch => {
                const d = rvBuf.getChannelData(ch);
                for (let i = 0; i < d.length; i++)
                    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
            });
            const rev = c.createConvolver();
            rev.buffer = rvBuf;
            const revGain = c.createGain();
            revGain.gain.value = 0.25;
            rev.connect(revGain);
            revGain.connect(c.destination);

            const presets = {
                stardust: [
                    { freq: 741, gain: 0.10, decay: 2.2, delay: 0, type: 'sine' },
                    { freq: 852, gain: 0.07, decay: 1.8, delay: 0.15, type: 'sine' },
                    { freq: 1480, gain: 0.03, decay: 1.2, delay: 0.3, type: 'sine' },
                ],
                light: [
                    { freq: 528, gain: 0.13, decay: 1.5, delay: 0, type: 'sine' },
                    { freq: 660, gain: 0.10, decay: 1.3, delay: 0.08, type: 'sine' },
                    { freq: 792, gain: 0.08, decay: 1.1, delay: 0.16, type: 'sine' },
                    { freq: 1056, gain: 0.05, decay: 0.9, delay: 0.24, type: 'sine' },
                ],
                energy: [
                    { freq: 285, gain: 0.15, decay: 3.0, delay: 0, type: 'sine' },
                    { freq: 417, gain: 0.10, decay: 2.5, delay: 0.2, type: 'sine' },
                    { freq: 570, gain: 0.06, decay: 2.0, delay: 0.4, type: 'sine' },
                ],
                nebula: [
                    { freq: 111, gain: 0.14, decay: 4.0, delay: 0, type: 'sine' },
                    { freq: 222, gain: 0.08, decay: 3.5, delay: 0.1, type: 'sine' },
                    { freq: 333, gain: 0.05, decay: 3.0, delay: 0.2, type: 'sine' },
                    { freq: 444, gain: 0.03, decay: 2.5, delay: 0.3, type: 'sine' },
                ],
            };

            const layers = presets[type] || presets.stardust;

            layers.forEach(({ freq, gain, decay, delay, type: waveType }) => {
                const osc = c.createOscillator();
                const env = c.createGain();
                osc.type = waveType || 'sine';
                osc.frequency.value = freq;
                env.gain.setValueAtTime(0, now + delay);
                env.gain.linearRampToValueAtTime(gain, now + delay + 0.1);
                env.gain.exponentialRampToValueAtTime(0.0001, now + delay + decay);
                osc.connect(env);
                env.connect(c.destination);
                env.connect(rev);
                osc.start(now + delay);
                osc.stop(now + delay + decay + 0.15);
            });

            if (type === 'stardust' || type === 'light') {
                const ping = c.createOscillator();
                const pingEnv = c.createGain();
                ping.type = 'sine';
                ping.frequency.setValueAtTime(type === 'light' ? 1320 : 1110, now);
                ping.frequency.exponentialRampToValueAtTime(type === 'light' ? 660 : 555, now + 0.4);
                pingEnv.gain.setValueAtTime(0, now);
                pingEnv.gain.linearRampToValueAtTime(0.08, now + 0.02);
                pingEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
                ping.connect(pingEnv);
                pingEnv.connect(c.destination);
                pingEnv.connect(rev);
                ping.start(now);
                ping.stop(now + 0.6);
            }

        } catch (e) { console.warn('playVoidEffect error:', e); }
    }

    /* ============================================================
       AMBIENT — dùng file thực (không generate bằng Web Audio)
    ============================================================ */

    let _ambientAudio = null;   // HTMLAudioElement hiện tại

    function _startAmbient(type) {
        const url = AUDIO_URLS[type];
        if (!url || url.startsWith('LINK_')) {
            console.warn(`[Sound] Chưa có link file cho "${type}". Điền vào AUDIO_URLS.`);
            UI?.showToast?.('⚠️ Chưa có file âm thanh, vui lòng cấu hình link!', 3000);
            return;
        }

        /* ✅ FIX: Dừng ambient cũ XONG rồi mới start cái mới */
        _stopAmbient(() => {
            _ambientAudio = new Audio(url);
            _ambientAudio.loop = true;
            _ambientAudio.volume = 0;
            _ambientAudio.crossOrigin = 'anonymous';
            _ambientAudio.preload = 'auto';

            _resumeCtx().then(() => {
                return _ambientAudio.play();
            }).then(() => {
                _fadeVolume(_ambientAudio, 0, 0.45, 1200);
            }).catch(err => console.warn('[Sound] ambient play error:', err));
        });
    }

    function _stopAmbient(onDone) {
        if (!_ambientAudio) { if (onDone) onDone(); return; }
        _fadeVolume(_ambientAudio, _ambientAudio.volume, 0, 400, () => {
            _ambientAudio.pause();
            _ambientAudio.src = '';
            _ambientAudio = null;
            if (onDone) onDone();
        });
    }

    function stop() { _stopAmbient(); }

    /* ---------- PLAY AMBIENT ---------- */
    function playAmbient(type) {
        if (type === 'off') {
            _stopAmbient();
            stopBGM();
            STATE.currentSound = 'off';
            return;
        }

        /* ✅ FIX: Dừng BGM + ambient cũ trước, rồi mới start — tránh phải click 2 lần */
        if (bgmActive) {
            stopBGM(() => _startAmbient(type));
        } else {
            _startAmbient(type); // _startAmbient đã tự gọi _stopAmbient có callback bên trong
        }
    }

    /* ---------- BELL ---------- */
    function playBell() {
        try {
            const c = _getCtx();
            const now = c.currentTime;

            const rvBuf = c.createBuffer(2, c.sampleRate * 2, c.sampleRate);
            [0, 1].forEach(ch => {
                const d = rvBuf.getChannelData(ch);
                for (let i = 0; i < d.length; i++)
                    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.8);
            });
            const rev = c.createConvolver();
            rev.buffer = rvBuf;
            const revGain = c.createGain();
            revGain.gain.value = 0.22;
            rev.connect(revGain);
            revGain.connect(c.destination);

            const layers = [
                { freq: 528, gain: 0.18, decay: 2.6 },
                { freq: 1056, gain: 0.09, decay: 1.8 },
                { freq: 1584, gain: 0.04, decay: 1.1 },
            ];
            layers.forEach(({ freq, gain, decay }, i) => {
                const osc = c.createOscillator();
                const env = c.createGain();
                const pan = c.createStereoPanner();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                osc.frequency.exponentialRampToValueAtTime(freq * 1.004, now + 0.1);
                env.gain.setValueAtTime(0, now);
                env.gain.linearRampToValueAtTime(gain, now + 0.012);
                env.gain.exponentialRampToValueAtTime(0.0001, now + decay);
                pan.pan.value = (i - 1) * 0.12;
                osc.connect(env); env.connect(pan);
                pan.connect(c.destination); pan.connect(rev);
                osc.start(now); osc.stop(now + decay + 0.1);
            });

            const sub = c.createOscillator();
            const subG = c.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(132, now);
            subG.gain.setValueAtTime(0, now);
            subG.gain.linearRampToValueAtTime(0.05, now + 0.02);
            subG.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
            sub.connect(subG); subG.connect(c.destination);
            sub.start(now); sub.stop(now + 0.8);

        } catch (e) { console.warn('Sound.playBell error:', e); }
    }

    /* ---------- SINEWAVE ---------- */
    function playSinewave(freq = 528) {
        try {
            const c = _getCtx();
            const osc = c.createOscillator();
            const env = c.createGain();
            const rev = c.createConvolver();
            osc.type = 'sine'; osc.frequency.value = freq;
            const rvBuf = c.createBuffer(2, c.sampleRate * 3, c.sampleRate);
            [0, 1].forEach(ch => {
                const d = rvBuf.getChannelData(ch);
                for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
            });
            rev.buffer = rvBuf;
            env.gain.setValueAtTime(0, c.currentTime);
            env.gain.linearRampToValueAtTime(0.3, c.currentTime + 0.05);
            env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 2.5);
            osc.connect(env); env.connect(rev); rev.connect(c.destination); env.connect(c.destination);
            osc.start(); osc.stop(c.currentTime + 3);
        } catch { }
    }

    /* ---------- SOUND → ITEM ID MAP ---------- */
    const SOUND_ITEM_MAP = {
        'rain': 'sound_rain',
        'wave': 'sound_wave',
        'wind': 'sound_wind'
    };

    function _isUnlocked(type) {
        if (type === 'off') return true;
        const itemId = SOUND_ITEM_MAP[type];
        if (!itemId) return true;
        return !!STATE.unlocked[itemId];
    }

    /* ---------- INIT ---------- */
    function initButtons() {
        document.querySelectorAll('.sound-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                /* ✅ FIX: Resume AudioContext ngay khi click — trước mọi thứ khác */
                _resumeCtx();

                const type = btn.dataset.sound;

                if (!_isUnlocked(type)) {
                    UI.showToast('🔒 Mở khóa âm thanh này trong Star Store!');
                    return;
                }

                document.querySelectorAll('.sound-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                STATE.currentSound = type;

                playAmbient(type);

                if (type !== 'off') {
                    UI.showToast(
                        type === 'rain' ? '🌧 Tiếng mưa Đà Lạt' :
                            type === 'wave' ? '🌊 Sóng biển đêm' :
                                '🔔 Chuông gió ngân xa', 2000
                    );
                } else {
                    UI.showToast('🔇 Đã tắt âm thanh', 2000);
                }
            });
        });

        STATE.currentSound = 'off';
        document.querySelectorAll('.sound-btn').forEach(b => b.classList.remove('active'));
        startBGM();

        const bgmBtn = document.getElementById('bgm-toggle-btn');
        if (bgmBtn) {
            bgmBtn.addEventListener('click', () => {
                /* ✅ FIX: Resume AudioContext ngay khi click */
                _resumeCtx();

                if (bgmActive) {
                    stopBGM();
                    UI.showToast('🔇 Nhạc nền đã tắt', 2000);
                } else {
                    _stopAmbient();
                    document.querySelectorAll('.sound-btn').forEach(b => b.classList.remove('active'));
                    STATE.currentSound = 'off';
                    startBGM();
                    UI.showToast('🎵 Nhạc nền đang phát', 2000);
                }
            });
        }
    }

    return {
        playAmbient, stop, playSinewave, playBell,
        initButtons, startBGM, stopBGM,
        startVoidWhoosh, stopVoidWhoosh, playVoidRelease,
        playVoidEffect,
    };
})();