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
        const notes = [523, 659, 784, 880, 1047]; // C5 E5 G5 A5 C6
        const merger = c.createChannelMerger(1);
        const src = { start: () => { }, stop: () => { } }; // dummy

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

    /* ---------- SINEWAVE (star click / reward) ---------- */
    function playSinewave(freq = 528) {
        try {
            const c = _getCtx();
            const osc = c.createOscillator();
            const env = c.createGain();
            const rev = c.createConvolver();

            osc.type = 'sine'; osc.frequency.value = freq;

            // Reverb
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

    /* ---------- INIT SOUND BUTTONS ---------- */
    function initButtons() {
        document.querySelectorAll('.sound-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sound-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.dataset.sound;
                STATE.currentSound = type;
                playAmbient(type);
            });
        });
        // Start default
        playAmbient(STATE.currentSound);
    }

    return { playAmbient, stop, playSinewave, initButtons };
})();