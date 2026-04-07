/**
 * main.js
 * StringSync — Guitar Tuner
 * Entry point: wires together audio, pitch detection, UI, metronome, chords
 */

import { detectPitch, freqToNote, PitchSmoother, matchString } from './pitchDetector.js';
import {
    drawMeter, renderStringSelector, renderRefTones,
    drawChordSVG, updateNoteDisplay
} from './ui.js';

// ═══════════════════════════════════════════════════════
// INSTRUMENT PRESETS
// ═══════════════════════════════════════════════════════
const INSTRUMENTS = {
    guitar: {
        label: 'Guitar',
        tunings: {
            standard: [
                { name: '6', note: 'E2', freq: 82.41 },
                { name: '5', note: 'A2', freq: 110.00 },
                { name: '4', note: 'D3', freq: 146.83 },
                { name: '3', note: 'G3', freq: 196.00 },
                { name: '2', note: 'B3', freq: 246.94 },
                { name: '1', note: 'E4', freq: 329.63 },
            ],
            dropD: [
                { name: '6', note: 'D2', freq: 73.42 },
                { name: '5', note: 'A2', freq: 110.00 },
                { name: '4', note: 'D3', freq: 146.83 },
                { name: '3', note: 'G3', freq: 196.00 },
                { name: '2', note: 'B3', freq: 246.94 },
                { name: '1', note: 'E4', freq: 329.63 },
            ],
            openG: [
                { name: '6', note: 'D2', freq: 73.42 },
                { name: '5', note: 'G2', freq: 98.00 },
                { name: '4', note: 'D3', freq: 146.83 },
                { name: '3', note: 'G3', freq: 196.00 },
                { name: '2', note: 'B3', freq: 246.94 },
                { name: '1', note: 'D4', freq: 293.66 },
            ],
            halfDown: [
                { name: '6', note: 'Eb2', freq: 77.78 },
                { name: '5', note: 'Ab2', freq: 103.83 },
                { name: '4', note: 'Db3', freq: 138.59 },
                { name: '3', note: 'Gb3', freq: 185.00 },
                { name: '2', note: 'Bb3', freq: 233.08 },
                { name: '1', note: 'Eb4', freq: 311.13 },
            ],
        }
    },
    bass: {
        label: 'Bass',
        tunings: {
            standard: [
                { name: '4', note: 'E1', freq: 41.20 },
                { name: '3', note: 'A1', freq: 55.00 },
                { name: '2', note: 'D2', freq: 73.42 },
                { name: '1', note: 'G2', freq: 98.00 },
            ],
            dropD: [
                { name: '4', note: 'D1', freq: 36.71 },
                { name: '3', note: 'A1', freq: 55.00 },
                { name: '2', note: 'D2', freq: 73.42 },
                { name: '1', note: 'G2', freq: 98.00 },
            ],
        }
    },
    ukulele: {
        label: 'Ukulele',
        tunings: {
            standard: [
                { name: '4', note: 'G4', freq: 392.00 },
                { name: '3', note: 'C4', freq: 261.63 },
                { name: '2', note: 'E4', freq: 329.63 },
                { name: '1', note: 'A4', freq: 440.00 },
            ],
        }
    }
};

// ═══════════════════════════════════════════════════════
// CHORD LIBRARY
// ═══════════════════════════════════════════════════════
const CHORDS = [
    // MAJOR
    { name: 'C', type: 'major', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
    { name: 'D', type: 'major', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
    { name: 'E', type: 'major', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
    { name: 'F', type: 'major', frets: [1, 1, 2, 3, 3, 1], fingers: [1, 1, 2, 3, 4, 1], barre: { fret: 1, from: 0, to: 5 } },
    { name: 'G', type: 'major', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
    { name: 'A', type: 'major', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
    { name: 'B', type: 'major', frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 2, from: 1, to: 5 } },
    // MINOR
    { name: 'Am', type: 'minor', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
    { name: 'Bm', type: 'minor', frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, from: 1, to: 5 } },
    { name: 'Cm', type: 'minor', frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 3, from: 1, to: 5 } },
    { name: 'Dm', type: 'minor', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
    { name: 'Em', type: 'minor', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
    { name: 'Fm', type: 'minor', frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 1, from: 0, to: 5 } },
    { name: 'Gm', type: 'minor', frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 3, from: 0, to: 5 } },
    // DOM 7
    { name: 'A7', type: 'dom7', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
    { name: 'B7', type: 'dom7', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
    { name: 'C7', type: 'dom7', frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
    { name: 'D7', type: 'dom7', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
    { name: 'E7', type: 'dom7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
    { name: 'G7', type: 'dom7', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
    // MAJ 7
    { name: 'Amaj7', type: 'maj7', frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 3, 1, 4, 0] },
    { name: 'Cmaj7', type: 'maj7', frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
    { name: 'Dmaj7', type: 'maj7', frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 2, 3] },
    { name: 'Emaj7', type: 'maj7', frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
    { name: 'Fmaj7', type: 'maj7', frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 4, 3, 2, 1] },
    { name: 'Gmaj7', type: 'maj7', frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 4] },
    // SUS
    { name: 'Asus2', type: 'sus', frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
    { name: 'Asus4', type: 'sus', frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
    { name: 'Dsus2', type: 'sus', frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
    { name: 'Dsus4', type: 'sus', frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
    { name: 'Esus4', type: 'sus', frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
    { name: 'Gsus4', type: 'sus', frets: [3, 3, 0, 0, 1, 3], fingers: [2, 3, 0, 0, 1, 4] },
];

// ═══════════════════════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════════════════════
const state = {
    // Audio
    audioCtx: null,
    analyser: null,
    micStream: null,
    isListening: false,
    rafId: null,

    // Tuner
    instrument: 'guitar',
    tuning: 'standard',
    mode: 'auto',           // 'auto' | 'chromatic' | 'manual'
    selectedString: 0,
    detectedString: -1,
    currentNote: null,
    a4: 440,
    smoother: new PitchSmoother(0.28, 120),
    lastCents: 0,
    silenceCount: 0,

    // Reference tone
    oscNode: null,
    gainNode: null,
    playingRefIndex: -1,
    waveform: 'sine',
    toneVolume: 0.5,

    // Metronome
    metroRunning: false,
    bpm: 120,
    timeSig: 4,
    metroBeat: 0,
    nextBeatTime: 0,
    metroSchedulerId: null,
    tapTimes: [],

    // Chords
    chordFilter: 'major',

    // Settings
    isDark: true,
    customStrings: null,
};

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function getCurrentStrings() {
    if (state.customStrings) return state.customStrings;
    const inst = INSTRUMENTS[state.instrument];
    const tuning = inst.tunings[state.tuning] || inst.tunings['standard'];
    return tuning;
}

function saveSettings() {
    try {
        localStorage.setItem('ss_settings', JSON.stringify({
            instrument: state.instrument, tuning: state.tuning,
            mode: state.mode, a4: state.a4, bpm: state.bpm,
            timeSig: state.timeSig, waveform: state.waveform,
            toneVolume: state.toneVolume, isDark: state.isDark,
        }));
    } catch (e) { }
}

function loadSettings() {
    try {
        const raw = localStorage.getItem('ss_settings');
        if (!raw) return;
        const s = JSON.parse(raw);
        Object.assign(state, {
            instrument: s.instrument || 'guitar',
            tuning: s.tuning || 'standard',
            mode: s.mode || 'auto',
            a4: s.a4 || 440,
            bpm: s.bpm || 120,
            timeSig: s.timeSig || 4,
            waveform: s.waveform || 'sine',
            toneVolume: s.toneVolume ?? 0.5,
            isDark: s.isDark !== undefined ? s.isDark : true,
        });
    } catch (e) { }
}

// ═══════════════════════════════════════════════════════
// AUDIO ENGINE
// ═══════════════════════════════════════════════════════
async function startMic() {
    try {
        // Resume / create AudioContext
        if (!state.audioCtx) {
            state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (state.audioCtx.state === 'suspended') await state.audioCtx.resume();

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
        state.micStream = stream;

        const source = state.audioCtx.createMediaStreamSource(stream);
        const analyser = state.audioCtx.createAnalyser();
        analyser.fftSize = 4096;          // large for good low-freq resolution
        analyser.smoothingTimeConstant = 0.1;
        source.connect(analyser);
        state.analyser = analyser;
        state.isListening = true;
        state.smoother.reset();

        setMicUI(true);
        startRenderLoop();
    } catch (err) {
        console.error('Mic error:', err);
        const msg = err.name === 'NotAllowedError'
            ? 'Microphone permission denied. Please allow access.'
            : 'Could not access microphone: ' + err.message;
        setStatusText(msg, 'error');
        setMicUI(false, true);
    }
}

function stopMic() {
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    if (state.micStream) {
        state.micStream.getTracks().forEach(t => t.stop());
        state.micStream = null;
    }
    state.analyser = null;
    state.isListening = false;
    state.smoother.reset();
    setMicUI(false);
    clearTunerDisplay();
}

function startRenderLoop() {
    const buffer = new Float32Array(state.analyser.fftSize);
    const sampleRate = state.audioCtx.sampleRate;
    const canvas = document.getElementById('meterCanvas');

    // Determine frequency search range based on instrument
    let minFreq = 60, maxFreq = 1400;
    if (state.instrument === 'bass') { minFreq = 25; maxFreq = 400; }
    else if (state.instrument === 'ukulele') { minFreq = 200; maxFreq = 1200; }

    function tick() {
        state.rafId = requestAnimationFrame(tick);
        if (!state.analyser) return;

        state.analyser.getFloatTimeDomainData(buffer);

        // Compute RMS for signal bar
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
        rms = Math.sqrt(rms / buffer.length);
        updateSignalBar(rms);

        // Pitch detection
        const { frequency, clarity } = detectPitch(buffer, sampleRate, minFreq, maxFreq, 0.012);
        const smoothed = state.smoother.update(frequency);

        if (smoothed && clarity > 0.45) {
            state.silenceCount = 0;
            const noteInfo = freqToNote(smoothed, state.a4);
            if (noteInfo) {
                state.currentNote = { ...noteInfo, freq: smoothed };

                // String detection (auto mode)
                if (state.mode === 'auto') {
                    const strings = getCurrentStrings();
                    const match = matchString(smoothed, strings);
                    if (match && match.diff < 30) {
                        state.detectedString = match.index;
                    } else {
                        state.detectedString = -1;
                    }
                }

                updateTunerDisplay(state.currentNote);
                drawMeter(canvas, noteInfo.cents, state.isDark);
            }
        } else {
            state.silenceCount++;
            if (state.silenceCount > 15) {
                state.currentNote = null;
                state.detectedString = -1;
                clearTunerDisplay(canvas);
            }
        }

        // Refresh string selector to show detected string
        if (state.mode === 'auto') {
            const strings = getCurrentStrings();
            renderStringSelector(
                document.getElementById('stringSelector'),
                strings, state.selectedString, state.detectedString,
                onSelectString, state.mode
            );
        }
    }

    tick();
}

// ═══════════════════════════════════════════════════════
// REFERENCE TONE
// ═══════════════════════════════════════════════════════
function playRefTone(index) {
    if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();

    // Toggle off if same
    if (state.playingRefIndex === index) {
        stopRefTone();
        return;
    }
    stopRefTone();

    const strings = getCurrentStrings();
    const freq = strings[index]?.freq;
    if (!freq) return;

    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = state.waveform;
    osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);
    gain.gain.setValueAtTime(0, state.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(state.toneVolume * 0.4, state.audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    osc.start();

    state.oscNode = osc;
    state.gainNode = gain;
    state.playingRefIndex = index;

    renderRefTones(document.getElementById('refToneGrid'), strings, index, playRefTone);
}

function stopRefTone() {
    if (state.gainNode) {
        state.gainNode.gain.linearRampToValueAtTime(0, state.audioCtx.currentTime + 0.08);
    }
    setTimeout(() => {
        try { state.oscNode?.stop(); } catch (e) { }
        state.oscNode = null; state.gainNode = null;
    }, 100);
    state.playingRefIndex = -1;
    const strings = getCurrentStrings();
    renderRefTones(document.getElementById('refToneGrid'), strings, -1, playRefTone);
}

// ═══════════════════════════════════════════════════════
// METRONOME (Web Audio scheduled)
// ═══════════════════════════════════════════════════════
function startMetronome() {
    if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();

    state.metroBeat = 0;
    state.nextBeatTime = state.audioCtx.currentTime + 0.05;
    state.metroRunning = true;
    scheduleBeats();
    updateMetroUI(true);
}

function stopMetronome() {
    state.metroRunning = false;
    clearTimeout(state.metroSchedulerId);
    state.metroBeat = 0;
    updateMetroUI(false);
    resetBeatIndicators();
}

function scheduleBeats() {
    if (!state.metroRunning) return;
    const ctx = state.audioCtx;
    const lookAhead = 0.1;   // seconds
    const scheduleInterval = 25; // ms

    while (state.nextBeatTime < ctx.currentTime + lookAhead) {
        scheduleBeatSound(state.nextBeatTime, state.metroBeat === 0);
        const beatIndex = state.metroBeat;
        const beatTime = state.nextBeatTime;

        // Visual flash scheduled via setTimeout offset
        const delay = Math.max(0, (beatTime - ctx.currentTime) * 1000);
        setTimeout(() => flashBeat(beatIndex), delay);

        state.metroBeat = (state.metroBeat + 1) % state.timeSig;
        state.nextBeatTime += 60 / state.bpm;
    }

    state.metroSchedulerId = setTimeout(scheduleBeats, scheduleInterval);
}

function scheduleBeatSound(time, isAccent) {
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = isAccent ? 880 : 660;
    osc.type = 'sine';
    gain.gain.setValueAtTime(isAccent ? 0.5 : 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.1);
}

function flashBeat(beatIndex) {
    const dot = document.getElementById('beatDot');
    const indicators = document.querySelectorAll('.beat-ind');
    dot.classList.add(beatIndex === 0 ? 'flash' : 'flash');
    indicators.forEach((el, i) => {
        el.classList.remove('active', 'accent');
        if (i === beatIndex) el.classList.add(beatIndex === 0 ? 'accent' : 'active');
    });
    setTimeout(() => { dot.classList.remove('flash'); }, 80);
}

function resetBeatIndicators() {
    document.querySelectorAll('.beat-ind').forEach(el => el.classList.remove('active', 'accent'));
}

function buildBeatIndicators() {
    const container = document.getElementById('beatIndicators');
    container.innerHTML = '';
    for (let i = 0; i < state.timeSig; i++) {
        const d = document.createElement('div');
        d.className = 'beat-ind';
        container.appendChild(d);
    }
}

// ═══════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════
function setMicUI(on, error = false) {
    const btn = document.getElementById('micBtn');
    const dot = document.getElementById('statusDot');
    const label = document.getElementById('micLabel');
    const micOnIcon = document.getElementById('micOnIcon');
    const micOffIcon = document.getElementById('micOffIcon');

    btn.classList.toggle('active', on);
    dot.className = 'status-dot' + (on ? ' active' : error ? ' error' : '');
    label.textContent = on ? 'Stop' : 'Start Tuning';
    micOnIcon.classList.toggle('hidden', on);
    micOffIcon.classList.toggle('hidden', !on);

    if (!error) {
        setStatusText(on ? 'Listening...' : 'Microphone off');
    }
}

function setStatusText(text, type = '') {
    const el = document.getElementById('statusText');
    el.textContent = text;
    if (type === 'error') el.style.color = 'var(--red)';
    else el.style.color = '';
}

function updateSignalBar(rms) {
    const fill = document.getElementById('signalFill');
    const pct = Math.min(100, rms * 500);
    fill.style.width = pct + '%';
}

function updateTunerDisplay(noteInfo) {
    const els = {
        noteName: document.getElementById('noteName'),
        noteOctave: document.getElementById('noteOctave'),
        noteFreq: document.getElementById('noteFreq'),
        centsValue: document.getElementById('centsValue'),
        tuneStatus: document.getElementById('tuneStatus'),
        accuracyFill: document.getElementById('accuracyFill'),
        accuracyLabel: document.getElementById('accuracyLabel'),
    };
    updateNoteDisplay(els, noteInfo, true);
}

function clearTunerDisplay(canvas) {
    const els = {
        noteName: document.getElementById('noteName'),
        noteOctave: document.getElementById('noteOctave'),
        noteFreq: document.getElementById('noteFreq'),
        centsValue: document.getElementById('centsValue'),
        tuneStatus: document.getElementById('tuneStatus'),
        accuracyFill: document.getElementById('accuracyFill'),
        accuracyLabel: document.getElementById('accuracyLabel'),
    };
    updateNoteDisplay(els, null, false);
    if (canvas) drawMeter(canvas, 0, state.isDark);
}

function updateMetroUI(running) {
    const btn = document.getElementById('metroStartBtn');
    const play = document.getElementById('metroPlayIcon');
    const stop = document.getElementById('metroStopIcon');
    const label = document.getElementById('metroLabel');
    btn.classList.toggle('active', running);
    play.classList.toggle('hidden', running);
    stop.classList.toggle('hidden', !running);
    label.textContent = running ? 'Stop' : 'Start';
}

function onSelectString(index) {
    state.selectedString = index;
    if (state.mode === 'manual') state.mode = 'manual'; // keep manual
    const strings = getCurrentStrings();
    renderStringSelector(
        document.getElementById('stringSelector'),
        strings, state.selectedString, state.detectedString,
        onSelectString, state.mode
    );
}

function refreshAll() {
    const strings = getCurrentStrings();
    renderStringSelector(
        document.getElementById('stringSelector'),
        strings, state.selectedString, state.detectedString,
        onSelectString, state.mode
    );
    renderRefTones(document.getElementById('refToneGrid'), strings, state.playingRefIndex, playRefTone);
    stopRefTone();
    renderChords(state.chordFilter);
    drawMeter(document.getElementById('meterCanvas'), 0, state.isDark);
}

// ═══════════════════════════════════════════════════════
// CHORDS
// ═══════════════════════════════════════════════════════
function renderChords(filter, searchTerm = '') {
    const grid = document.getElementById('chordGrid');
    let list = CHORDS;
    if (searchTerm) {
        const q = searchTerm.trim().toLowerCase();
        list = CHORDS.filter(c => c.name.toLowerCase().includes(q));
    } else {
        list = CHORDS.filter(c => c.type === filter);
    }

    grid.innerHTML = '';
    list.forEach(chord => {
        const card = document.createElement('div');
        card.className = 'chord-card';
        card.innerHTML = `
      <span class="chord-name">${chord.name}</span>
      ${drawChordSVG(chord)}
    `;
        grid.appendChild(card);
    });
}

// ═══════════════════════════════════════════════════════
// EVENT WIRING
// ═══════════════════════════════════════════════════════
function wireEvents() {

    // ── Mic toggle ──
    document.getElementById('micBtn').addEventListener('click', async () => {
        if (state.isListening) stopMic();
        else await startMic();
    });

    // ── Tab nav ──
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active'); btn.setAttribute('aria-selected', 'true');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab === 'chords') renderChords(state.chordFilter);
        });
    });

    // ── Settings panel ──
    const panel = document.getElementById('settingsPanel');
    const overlay = document.getElementById('settingsOverlay');
    document.getElementById('settingsBtn').addEventListener('click', () => {
        panel.classList.add('open');
        overlay.classList.remove('hidden');
        panel.removeAttribute('aria-hidden');
    });
    const closePanel = () => {
        panel.classList.remove('open');
        overlay.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
        saveSettings();
    };
    document.getElementById('closeSettings').addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    // ── Theme toggle ──
    const themeIcon = document.getElementById('themeIcon');
    document.getElementById('themeToggle').addEventListener('click', () => {
        state.isDark = !state.isDark;
        document.documentElement.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
        themeIcon.innerHTML = state.isDark
            ? '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>'
            : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
        drawMeter(document.getElementById('meterCanvas'), state.lastCents, state.isDark);
        saveSettings();
    });

    // ── Instrument ──
    document.getElementById('instrumentGroup').addEventListener('click', e => {
        const btn = e.target.closest('[data-instrument]');
        if (!btn) return;
        document.querySelectorAll('#instrumentGroup .group-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.instrument = btn.dataset.instrument;
        state.tuning = 'standard';
        state.selectedString = 0;
        state.detectedString = -1;
        // Update tuning select options
        const tuningSelect = document.getElementById('tuningSelect');
        const inst = INSTRUMENTS[state.instrument];
        const availableTunings = Object.keys(inst.tunings);
        Array.from(tuningSelect.options).forEach(opt => {
            opt.disabled = !availableTunings.includes(opt.value) && opt.value !== 'custom';
        });
        tuningSelect.value = 'standard';
        refreshAll();
        saveSettings();
    });

    // ── Tuning select ──
    document.getElementById('tuningSelect').addEventListener('change', e => {
        if (e.target.value === 'custom') {
            document.getElementById('customTuningInputs').classList.remove('hidden');
        } else {
            document.getElementById('customTuningInputs').classList.add('hidden');
            state.tuning = e.target.value;
            state.customStrings = null;
            state.selectedString = 0;
            refreshAll();
            saveSettings();
        }
    });

    // ── Custom tuning apply ──
    document.getElementById('applyCustomTuning').addEventListener('click', () => {
        const val = document.getElementById('customTuningInput').value;
        try {
            const parts = val.split(',').map(p => p.trim());
            if (parts.length < 1) throw new Error('invalid');
            state.customStrings = parts.map((p, i) => {
                // Parse note + octave e.g. "E2", "A#3"
                const match = p.match(/^([A-G][#b]?)(\d)$/i);
                if (!match) throw new Error('bad note ' + p);
                const note = match[1].toUpperCase();
                const oct = parseInt(match[2]);
                // Compute freq from MIDI
                const noteMap = { C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5, 'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11 };
                const semitone = noteMap[note.toUpperCase()];
                if (semitone === undefined) throw new Error('unknown note');
                const midi = (oct + 1) * 12 + semitone;
                const freq = 440 * Math.pow(2, (midi - 69) / 12);
                return { name: String(parts.length - i), note: p, freq };
            });
            refreshAll();
        } catch (e) {
            alert('Invalid tuning format. Use e.g. E2,A2,D3,G3,B3,E4');
        }
    });

    // ── Mode ──
    document.getElementById('modeGroup').addEventListener('click', e => {
        const btn = e.target.closest('[data-mode]');
        if (!btn) return;
        document.querySelectorAll('#modeGroup .group-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
        refreshAll();
        saveSettings();
    });

    // ── A4 slider ──
    const a4Slider = document.getElementById('a4Slider');
    const a4Value = document.getElementById('a4Value');
    a4Slider.addEventListener('input', () => {
        state.a4 = parseInt(a4Slider.value);
        a4Value.textContent = state.a4 + ' Hz';
        refreshAll();
        saveSettings();
    });

    // ── Waveform ──
    document.getElementById('waveformGroup').addEventListener('click', e => {
        const btn = e.target.closest('[data-wave]');
        if (!btn) return;
        document.querySelectorAll('#waveformGroup .group-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.waveform = btn.dataset.wave;
        if (state.oscNode) { state.oscNode.type = state.waveform; }
        saveSettings();
    });

    // ── Tone volume ──
    document.getElementById('toneVolume').addEventListener('input', e => {
        state.toneVolume = parseFloat(e.target.value);
        if (state.gainNode) {
            state.gainNode.gain.setTargetAtTime(state.toneVolume * 0.4, state.audioCtx.currentTime, 0.01);
        }
        saveSettings();
    });

    // ── BPM slider ──
    const bpmSlider = document.getElementById('bpmSlider');
    const bpmDisplay = document.getElementById('bpmDisplay');
    const syncBpm = () => { bpmDisplay.textContent = state.bpm; bpmSlider.value = state.bpm; };
    bpmSlider.addEventListener('input', () => { state.bpm = parseInt(bpmSlider.value); syncBpm(); saveSettings(); });
    document.getElementById('bpmDown').addEventListener('click', () => { state.bpm = Math.max(30, state.bpm - 1); syncBpm(); saveSettings(); });
    document.getElementById('bpmUp').addEventListener('click', () => { state.bpm = Math.min(240, state.bpm + 1); syncBpm(); saveSettings(); });

    // ── Time sig ──
    document.getElementById('timeSigSelect').addEventListener('change', e => {
        state.timeSig = parseInt(e.target.value);
        if (state.metroRunning) { stopMetronome(); startMetronome(); }
        buildBeatIndicators();
        saveSettings();
    });

    // ── Tap tempo ──
    document.getElementById('tapBtn').addEventListener('click', () => {
        const now = Date.now();
        state.tapTimes.push(now);
        // keep last 8 taps
        if (state.tapTimes.length > 8) state.tapTimes.shift();
        if (state.tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < state.tapTimes.length; i++) {
                intervals.push(state.tapTimes[i] - state.tapTimes[i - 1]);
            }
            const avg = intervals.reduce((a, b) => a + b) / intervals.length;
            state.bpm = Math.max(30, Math.min(240, Math.round(60000 / avg)));
            syncBpm();
            saveSettings();
        }
        // Reset tap buffer after 2s gap
        clearTimeout(state._tapReset);
        state._tapReset = setTimeout(() => { state.tapTimes = []; }, 2000);
    });

    // ── Metro start/stop ──
    document.getElementById('metroStartBtn').addEventListener('click', () => {
        if (state.metroRunning) stopMetronome();
        else startMetronome();
    });

    // ── Chord filter ──
    document.getElementById('chordFilterGroup').addEventListener('click', e => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        document.querySelectorAll('#chordFilterGroup .group-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.chordFilter = btn.dataset.filter;
        const search = document.getElementById('chordSearch').value;
        renderChords(state.chordFilter, search);
    });

    document.getElementById('chordSearch').addEventListener('input', e => {
        renderChords(state.chordFilter, e.target.value);
    });

    // ── Window resize → redraw meter ──
    window.addEventListener('resize', () => {
        drawMeter(document.getElementById('meterCanvas'), state.lastCents || 0, state.isDark);
    });
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
function init() {
    loadSettings();

    // Apply saved theme
    document.documentElement.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
    document.getElementById('themeIcon').innerHTML = state.isDark
        ? '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>'
        : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';

    // Apply saved A4
    document.getElementById('a4Slider').value = state.a4;
    document.getElementById('a4Value').textContent = state.a4 + ' Hz';

    // Apply saved BPM
    document.getElementById('bpmSlider').value = state.bpm;
    document.getElementById('bpmDisplay').textContent = state.bpm;

    // Apply saved instrument
    document.querySelectorAll('#instrumentGroup .group-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.instrument === state.instrument);
    });

    // Apply saved mode
    document.querySelectorAll('#modeGroup .group-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === state.mode);
    });

    // Apply saved waveform
    document.querySelectorAll('#waveformGroup .group-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.wave === state.waveform);
    });

    // Apply saved volume
    document.getElementById('toneVolume').value = state.toneVolume;

    // Apply saved tuning
    try { document.getElementById('tuningSelect').value = state.tuning; } catch (e) { }

    // Apply time sig
    document.getElementById('timeSigSelect').value = state.timeSig;

    buildBeatIndicators();
    refreshAll();
    wireEvents();

    // Initial idle meter
    drawMeter(document.getElementById('meterCanvas'), 0, state.isDark);

    // Service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => { });
    }
}

document.addEventListener('DOMContentLoaded', init);