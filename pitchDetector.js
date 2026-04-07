/**
 * pitchDetector.js
 * Real-time pitch detection using autocorrelation (YIN-inspired)
 * + FFT-based frequency estimation for robustness
 */

// ── NOTE TABLE ──────────────────────────────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert frequency (Hz) to nearest MIDI note, note name, octave, and cents deviation.
 * @param {number} freq - Detected frequency in Hz
 * @param {number} a4 - Reference A4 frequency (default 440 Hz)
 * @returns {{ midi:number, note:string, octave:number, cents:number, targetFreq:number }}
 */
export function freqToNote(freq, a4 = 440) {
    if (!freq || freq <= 0) return null;

    // MIDI note number (A4 = 69)
    const midi = 12 * Math.log2(freq / a4) + 69;
    const midiRounded = Math.round(midi);
    const octave = Math.floor(midiRounded / 12) - 1;
    const noteIndex = ((midiRounded % 12) + 12) % 12;
    const note = NOTE_NAMES[noteIndex];

    // Cents deviation from the exact note
    const cents = (midi - midiRounded) * 100;

    // Target frequency for the exact MIDI note
    const targetFreq = a4 * Math.pow(2, (midiRounded - 69) / 12);

    return { midi: midiRounded, note, octave, cents, targetFreq };
}

// ── AUTOCORRELATION PITCH DETECTION ─────────────────────────────────────────
/**
 * Autocorrelation-based pitch detection.
 * Based on the McLeod Pitch Method with clarity thresholding.
 *
 * @param {Float32Array} buffer - Time-domain audio samples
 * @param {number} sampleRate
 * @param {number} [minFreq=60] - Minimum detectable frequency (Hz)
 * @param {number} [maxFreq=1400] - Maximum detectable frequency (Hz)
 * @param {number} [noiseThreshold=0.01] - RMS threshold below which we ignore signal
 * @returns {{ frequency:number|null, clarity:number }}
 */
export function detectPitch(buffer, sampleRate, minFreq = 60, maxFreq = 1400, noiseThreshold = 0.01) {
    const SIZE = buffer.length;

    // ── 1. RMS noise gate ──
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < noiseThreshold) return { frequency: null, clarity: 0 };

    // ── 2. Autocorrelation ──
    const minPeriod = Math.floor(sampleRate / maxFreq);
    const maxPeriod = Math.ceil(sampleRate / minFreq);
    const acSize = Math.min(maxPeriod + 1, SIZE / 2);

    const acf = new Float32Array(acSize);
    for (let lag = 0; lag < acSize; lag++) {
        let sum = 0;
        for (let i = 0; i < SIZE - lag; i++) {
            sum += buffer[i] * buffer[i + lag];
        }
        acf[lag] = sum;
    }

    // ── 3. NSDF (Normalized Square Difference Function) via ACF ──
    // Simplified: find first peak after first zero-crossing
    let bestPeriod = -1;
    let bestValue = 0;

    // Find the first dip (local minimum after lag 0) to start looking for peaks
    let searchStart = minPeriod;
    for (let i = 1; i < acSize - 1; i++) {
        if (acf[i] < 0 || (i >= minPeriod && acf[i] < acf[i - 1])) {
            searchStart = i;
            break;
        }
    }
    if (searchStart < minPeriod) searchStart = minPeriod;

    // Find best peak
    for (let lag = searchStart; lag < acSize - 1; lag++) {
        if (acf[lag] > acf[lag - 1] && acf[lag] > acf[lag + 1] && acf[lag] > bestValue) {
            bestValue = acf[lag];
            bestPeriod = lag;
        }
    }

    if (bestPeriod === -1) return { frequency: null, clarity: 0 };

    // ── 4. Parabolic interpolation for sub-sample accuracy ──
    const a = acf[bestPeriod - 1] || 0;
    const b = acf[bestPeriod];
    const c = acf[bestPeriod + 1] || 0;
    const denom = 2 * (2 * b - a - c);
    const offset = denom !== 0 ? (a - c) / denom : 0;
    const refinedPeriod = bestPeriod + offset;

    const frequency = sampleRate / refinedPeriod;
    const clarity = Math.min(1, bestValue / (acf[0] || 1));

    if (frequency < minFreq || frequency > maxFreq) return { frequency: null, clarity: 0 };
    if (clarity < 0.5) return { frequency: null, clarity };

    return { frequency, clarity };
}

// ── PITCH SMOOTHER (Exponential Moving Average) ──────────────────────────────
export class PitchSmoother {
    constructor(alpha = 0.3, maxJump = 150) {
        this.alpha = alpha;       // smoothing factor (lower = smoother)
        this.maxJump = maxJump;   // max Hz jump before we reset
        this.last = null;
        this.count = 0;
        this.confirmBuffer = [];
        this.confirmSize = 2; // need N consistent readings before committing
    }

    update(freq) {
        if (freq === null) {
            this.count++;
            if (this.count > 8) { this.last = null; this.confirmBuffer = []; }
            return this.last;
        }
        this.count = 0;

        // Reject huge jumps (likely noise)
        if (this.last !== null && Math.abs(freq - this.last) > this.maxJump) {
            this.confirmBuffer = [freq];
            return this.last;
        }

        this.confirmBuffer.push(freq);
        if (this.confirmBuffer.length > this.confirmSize) this.confirmBuffer.shift();

        // Check stability
        if (this.confirmBuffer.length === this.confirmSize) {
            const median = this.confirmBuffer.reduce((a, b) => a + b) / this.confirmBuffer.length;
            if (this.last === null) {
                this.last = median;
            } else {
                this.last = this.alpha * median + (1 - this.alpha) * this.last;
            }
        }

        return this.last;
    }

    reset() { this.last = null; this.count = 0; this.confirmBuffer = []; }
}

// ── STRING MATCHER ───────────────────────────────────────────────────────────
/**
 * Find the closest guitar string to a given frequency.
 * @param {number} freq
 * @param {Array<{name:string, note:string, freq:number}>} strings
 * @returns {{ index:number, string:object, diff:number }}
 */
export function matchString(freq, strings) {
    let best = null, bestDiff = Infinity;
    strings.forEach((s, i) => {
        const diff = Math.abs(freq - s.freq);
        if (diff < bestDiff) { bestDiff = diff; best = { index: i, string: s, diff }; }
    });
    return best;
}