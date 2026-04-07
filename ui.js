/**
 * ui.js
 * All UI rendering: needle meter, string buttons, chord diagrams, reference tones
 */

// ── METER CANVAS ─────────────────────────────────────────────────────────────
const NEEDLE_HISTORY = [];
const NEEDLE_SMOOTH = 0.18;
let _smoothNeedle = 0; // -1 (flat) to +1 (sharp)

/**
 * Draw the tuning needle meter on a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {number} cents - deviation in cents (-50 to +50)
 * @param {boolean} isDark
 */
export function drawMeter(canvas, cents, isDark = true) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 600;
    const H = canvas.clientHeight || 220;

    // Resize backing store once per size change
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H * 0.96;      // pivot below visible area
    const radius = H * 1.1;
    const arcStart = -Math.PI * 0.72;
    const arcEnd = Math.PI * 0.72;
    const arcRange = arcEnd - arcStart;

    const textColor = isDark ? 'rgba(200,200,210,0.8)' : 'rgba(40,40,60,0.8)';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
    const accentColor = '#00e5ff';
    const greenColor = '#00e676';
    const redColor = '#ff1744';
    const yellowColor = '#ffea00';

    // ── background arc (track) ──
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 10, arcStart, arcEnd);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.stroke();

    // ── colored zone arcs ──
    const drawArcZone = (from, to, color, width = 16) => {
        const a1 = arcStart + arcRange * ((from + 50) / 100);
        const a2 = arcStart + arcRange * ((to + 50) / 100);
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 10, a1, a2);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;
    };
    drawArcZone(-50, -5, yellowColor);
    drawArcZone(-5, 5, greenColor, 20);
    drawArcZone(5, 50, redColor);

    // ── tick marks + labels ──
    const ticks = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
    ticks.forEach(t => {
        const angle = arcStart + arcRange * ((t + 50) / 100);
        const isMajor = t % 10 === 0;
        const len = isMajor ? 14 : 7;
        const r1 = radius - 22;
        const r2 = radius - 22 - len;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
        ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
        ctx.strokeStyle = isMajor ? (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)') : gridColor;
        ctx.lineWidth = isMajor ? 2 : 1;
        ctx.stroke();

        if (isMajor) {
            const labelR = radius - 44;
            ctx.fillStyle = textColor;
            ctx.font = `400 ${H * 0.065}px 'DM Sans', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t === 0 ? '0' : (t > 0 ? `+${t}` : `${t}`),
                cx + Math.cos(angle) * labelR, cy + Math.sin(angle) * labelR);
        }
    });

    // ── FLAT / IN TUNE / SHARP labels ──
    const labelY = cy - radius * 0.4;
    ctx.font = `500 ${H * 0.07}px 'DM Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = yellowColor; ctx.globalAlpha = 0.7; ctx.textAlign = 'left';
    ctx.fillText('♭ FLAT', W * 0.04, labelY);
    ctx.fillStyle = redColor; ctx.textAlign = 'right';
    ctx.fillText('SHARP ♯', W * 0.96, labelY);
    ctx.fillStyle = greenColor; ctx.textAlign = 'center'; ctx.globalAlpha = 1;
    ctx.fillText('✦ IN TUNE', cx, labelY - H * 0.02);
    ctx.globalAlpha = 1;

    // ── needle smooth ──
    const target = Math.max(-50, Math.min(50, cents || 0)) / 50;
    _smoothNeedle += (target - _smoothNeedle) * NEEDLE_SMOOTH;

    const needleAngle = arcStart + arcRange * ((_smoothNeedle + 1) / 2);
    const needleLength = radius - 30;
    const nx = cx + Math.cos(needleAngle) * needleLength;
    const ny = cy + Math.sin(needleAngle) * needleLength;

    // Determine needle color
    const absCents = Math.abs(_smoothNeedle * 50);
    let needleColor;
    if (absCents <= 5) needleColor = greenColor;
    else if (_smoothNeedle < 0) needleColor = yellowColor;
    else needleColor = redColor;

    // Needle shadow glow
    ctx.shadowColor = needleColor;
    ctx.shadowBlur = 18;

    // Needle line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = needleColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Needle pivot
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = needleColor;
    ctx.fill();

    ctx.shadowBlur = 0;
}

// ── STRING SELECTOR ──────────────────────────────────────────────────────────
export function renderStringSelector(container, strings, selectedIndex, detectedIndex, onSelect, mode) {
    container.innerHTML = '';
    if (mode === 'chromatic') {
        container.innerHTML = `<span style="font-size:0.8rem;color:var(--text3);padding:0.5rem;">Chromatic mode — detecting all notes</span>`;
        return;
    }
    strings.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.className = 'string-btn';
        if (i === selectedIndex) btn.classList.add('active');
        if (i === detectedIndex && mode === 'auto') btn.classList.add('detected');
        btn.innerHTML = `
      <span class="s-name">${s.name}</span>
      <span class="s-note">${s.note}</span>
    `;
        btn.addEventListener('click', () => onSelect(i));
        container.appendChild(btn);
    });
}

// ── REFERENCE TONES ──────────────────────────────────────────────────────────
export function renderRefTones(container, strings, playingIndex, onPlay) {
    container.innerHTML = '';
    strings.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.className = 'ref-tone-btn' + (i === playingIndex ? ' playing' : '');
        btn.innerHTML = `
      <span class="rt-note">${s.note}</span>
      <span class="rt-freq">${s.freq.toFixed(1)} Hz</span>
    `;
        btn.addEventListener('click', () => onPlay(i));
        container.appendChild(btn);
    });
}

// ── CHORD DIAGRAMS (SVG) ─────────────────────────────────────────────────────
/**
 * Draw a chord diagram as an SVG string.
 * @param {object} chord - { name, frets:[6 numbers], fingers:[6 numbers], barre, baseFret }
 * @returns {string} SVG markup
 */
export function drawChordSVG(chord) {
    const { frets, fingers = [], barre, baseFret = 1 } = chord;
    const STRINGS = 6, FRETS = 5;
    const W = 110, H = 130;
    const padL = 16, padT = 28;
    const strGap = (W - padL * 2) / (STRINGS - 1);
    const fretGap = (H - padT - 18) / FRETS;
    const dotR = 7;

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">`;

    // Nut or position marker
    if (baseFret === 1) {
        svg += `<line x1="${padL}" y1="${padT}" x2="${W - padL}" y2="${padT}" stroke="var(--text)" stroke-width="3" stroke-linecap="round"/>`;
    } else {
        svg += `<text x="${W - padL + 6}" y="${padT + fretGap * 0.6}" font-size="9" fill="var(--text2)" font-family="DM Sans,sans-serif">${baseFret}fr</text>`;
    }

    // Fret lines
    for (let f = 1; f <= FRETS; f++) {
        const y = padT + f * fretGap;
        svg += `<line x1="${padL}" y1="${y}" x2="${W - padL}" y2="${y}" stroke="var(--border2)" stroke-width="1"/>`;
    }

    // String lines + open/mute markers
    for (let s = 0; s < STRINGS; s++) {
        const x = padL + s * strGap;
        svg += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + FRETS * fretGap}" stroke="var(--border2)" stroke-width="1.2"/>`;

        const fret = frets[s];
        const topY = padT - 12;
        if (fret === -1) {
            // Muted
            svg += `<text x="${x}" y="${topY}" text-anchor="middle" font-size="10" fill="var(--red)" font-family="DM Sans">×</text>`;
        } else if (fret === 0) {
            // Open
            svg += `<circle cx="${x}" cy="${topY - 2}" r="4" fill="none" stroke="var(--text2)" stroke-width="1.5"/>`;
        }
    }

    // Barre
    if (barre) {
        const { fret: bf, from, to } = barre;
        const y = padT + (bf - 0.5) * fretGap;
        const x1 = padL + from * strGap;
        const x2 = padL + to * strGap;
        svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="var(--accent2)" stroke-width="${dotR * 1.8}" stroke-linecap="round" opacity="0.85"/>`;
    }

    // Finger dots
    frets.forEach((fret, s) => {
        if (fret <= 0) return;
        const x = padL + s * strGap;
        const y = padT + (fret - 0.5) * fretGap;
        svg += `<circle cx="${x}" cy="${y}" r="${dotR}" fill="var(--accent2)"/>`;
        if (fingers[s]) {
            svg += `<text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="7.5" fill="#fff" font-family="DM Sans">${fingers[s]}</text>`;
        }
    });

    svg += `</svg>`;
    return svg;
}

// ── NOTE DISPLAY UPDATE ──────────────────────────────────────────────────────
export function updateNoteDisplay({ noteName, noteOctave, noteFreq, centsValue, tuneStatus, accuracyFill, accuracyLabel }, noteInfo, isActive) {
    if (!isActive || !noteInfo) {
        noteName.textContent = '—';
        noteName.className = 'note-name';
        noteOctave.textContent = '';
        noteFreq.textContent = '— Hz';
        centsValue.textContent = '— ¢';
        tuneStatus.textContent = '—';
        accuracyFill.style.width = '0%';
        accuracyFill.style.background = 'var(--text3)';
        accuracyLabel.textContent = '—';
        return;
    }

    const { note, octave, freq, cents } = noteInfo;
    noteName.textContent = note;
    noteOctave.textContent = octave;
    noteFreq.textContent = `${freq.toFixed(1)} Hz`;
    centsValue.textContent = `${cents >= 0 ? '+' : ''}${cents.toFixed(1)} ¢`;

    const absCents = Math.abs(cents);
    // Accuracy bar: 100% = in tune (0¢), 0% = 50¢ off
    const accuracy = Math.max(0, 100 - absCents * 2);
    accuracyFill.style.width = `${accuracy}%`;

    // Color and status
    if (absCents <= 5) {
        noteName.className = 'note-name in-tune';
        tuneStatus.textContent = 'IN TUNE ✓';
        accuracyFill.style.background = 'var(--green)';
        accuracyLabel.textContent = `±${absCents.toFixed(0)}¢ — In tune`;
    } else if (cents < 0) {
        noteName.className = 'note-name flat';
        tuneStatus.textContent = 'FLAT';
        accuracyFill.style.background = 'var(--yellow)';
        accuracyLabel.textContent = `${cents.toFixed(0)}¢ — Tune up`;
    } else {
        noteName.className = 'note-name sharp';
        tuneStatus.textContent = 'SHARP';
        accuracyFill.style.background = 'var(--red)';
        accuracyLabel.textContent = `+${cents.toFixed(0)}¢ — Tune down`;
    }
}