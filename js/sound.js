/* ================================================
   TRẠM GỬI TÍN HIỆU - sound.js
   Web Audio API: ambient sounds + sinewave tones
   ================================================ */

const Sound = (() => {

    let ctx = null;
    let currentNode = null;
    let gainNode = null;

    function _getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    /* ---------- AMBIENT GENERATOR ---------- */
    function _createRainNoise() {
        const c = _getCtx();
        const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource();
        src.buffer = buf; src.loop = true;
        const filter = c.createBiquadFilter();
        filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5;
        src.connect(filter);
        return { src, output: filter };
    }

    function _createWaveNoise() {
        const c = _getCtx();
        const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource();
        src.buffer = buf; src.loop = true;
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 400;
        const lfo = c.createOscillator();
        const lfoGain = c.createGain();
        lfo.frequency.value = 0.12; lfoGain.gain.value = 200;
        lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
        lfo.start();
        src.connect(filter);
        return { src, output: filter, extra: [lfo] };
    }

    function _createWindChime() {
        const c = _getCtx();
        const notes = [523, 659, 784, 880, 1047];
        const merger = c.createChannelMerger(1);
        const src = { start: () => { }, stop: () => { } };

        function ring() {
            if (!ctx) return;
            const freq = notes[Math.floor(Math.random() * notes.length)];
            const osc = c.createOscillator();
            const env = c.createGain();
            osc.type = 'sine'; osc.frequency.value = freq;
            env.gain.setValueAtTime(0, c.currentTime);
            env.gain.linearRampToValueAtTime(0.15, c.currentTime + 0.05);
            env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 2);
            osc.connect(env); env.connect(gainNode);
            osc.start(); osc.stop(c.currentTime + 2.5);
            setTimeout(ring, 800 + Math.random() * 3000);
        }
        setTimeout(ring, 500);
        return { src: { start: () => { }, stop: () => clearTimeout(ring) }, output: merger };
    }

    /* ---------- PLAY AMBIENT ---------- */
    function playAmbient(type) {
        stop();
        if (type === 'off') return;
        const c = _getCtx();
        gainNode = c.createGain();
        gainNode.gain.value = 0.15;
        gainNode.connect(c.destination);

        let node;
        try {
            if (type === 'rain') node = _createRainNoise();
            if (type === 'wave') node = _createWaveNoise();
            if (type === 'wind') { _createWindChime(); return; }
            if (node) {
                node.output.connect(gainNode);
                node.src.start();
                currentNode = node;
            }
        } catch { /* AudioContext not supported */ }
    }

    function stop() {
        try {
            if (currentNode?.src) currentNode.src.stop();
            if (currentNode?.extra) currentNode.extra.forEach(n => n.stop());
            if (gainNode) gainNode.disconnect();
        } catch { }
        currentNode = null; gainNode = null;
    }

    /* ---------- BELL - tiếng chuông crystal bowl khi gửi tín hiệu ---------- */
    function playBell() {
        try {
            const c = _getCtx();
            const now = c.currentTime;

            // Reverb ngắn để âm ngân trong không gian
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

            // 3 lớp sine chồng nhau → âm crystal bowl ấm
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

                osc.connect(env);
                env.connect(pan);
                pan.connect(c.destination);
                pan.connect(rev);

                osc.start(now);
                osc.stop(now + decay + 0.1);
            });

            // Sub-bass nhẹ → độ sâu ấm
            const sub = c.createOscillator();
            const subG = c.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(132, now);
            subG.gain.setValueAtTime(0, now);
            subG.gain.linearRampToValueAtTime(0.05, now + 0.02);
            subG.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
            sub.connect(subG);
            subG.connect(c.destination);
            sub.start(now);
            sub.stop(now + 0.8);

        } catch (e) {
            console.warn('Sound.playBell error:', e);
        }
    }

    /* ---------- SINEWAVE (star click / reward) ---------- */
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

            osc.connect(env);
            env.connect(rev);
            rev.connect(c.destination);
            env.connect(c.destination);

            osc.start(); osc.stop(c.currentTime + 3);
        } catch { }
    }

    /* ---------- SOUND → ITEM ID MAP ---------- */
    const SOUND_ITEM_MAP = {
        'rain': 'sound_rain',
        'wave': 'sound_wave',
        'wind': 'sound_wind'
    };

    /* ---------- CHECK UNLOCK ---------- */
    function _isUnlocked(type) {
        if (type === 'off') return true;
        const itemId = SOUND_ITEM_MAP[type];
        if (!itemId) return true;
        return !!STATE.unlocked[itemId];
    }

    /* ---------- INIT SOUND BUTTONS ---------- */
    function initButtons() {
        document.querySelectorAll('.sound-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.sound;

                if (!_isUnlocked(type)) {
                    UI.showToast('🔒 Mở khóa âm thanh này trong Star Store!');
                    return;
                }

                document.querySelectorAll('.sound-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                STATE.currentSound = type;
                playAmbient(type);
            });
        });

        if (_isUnlocked(STATE.currentSound)) {
            playAmbient(STATE.currentSound);
        } else {
            STATE.currentSound = 'off';
            document.querySelectorAll('.sound-btn').forEach(b => {
                if (b.dataset.sound === 'off') b.classList.add('active');
                else b.classList.remove('active');
            });
        }
    }

    return { playAmbient, stop, playSinewave, playBell, initButtons };
})();