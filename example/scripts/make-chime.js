/* global Buffer */
const fs = require('fs');
const path = require('path');

// A two-note bell chime (E5 then C5) with harmonics and a decaying envelope,
// looping cleanly every three seconds. Generated so the repo carries no licensed audio.
const rate = 22050;
const seconds = 3;
const n = rate * seconds;
const notes = [
  { start: 0.0, freq: 659.25 },
  { start: 0.55, freq: 523.25 },
];
const partials = [
  { ratio: 1, gain: 1.0 },
  { ratio: 2.0, gain: 0.45 },
  { ratio: 3.01, gain: 0.2 },
  { ratio: 4.2, gain: 0.08 },
];

const samples = new Float64Array(n);
for (const note of notes) {
  const from = Math.floor(note.start * rate);
  for (let i = from; i < n; i++) {
    const t = (i - from) / rate;
    const envelope = Math.min(1, t / 0.008) * Math.exp(-t * 2.6);
    let v = 0;
    for (const p of partials) {
      v +=
        p.gain *
        Math.sin(2 * Math.PI * note.freq * p.ratio * t) *
        Math.exp(-t * p.ratio * 0.9);
    }
    samples[i] += v * envelope;
  }
}
// Fade the tail so the loop point is silent, then normalise to 70% of full scale.
for (let i = n - rate * 0.1; i < n; i++) samples[i] *= (n - i) / (rate * 0.1);
let peak = 0;
for (const s of samples) peak = Math.max(peak, Math.abs(s));
const scale = (0.7 * 32767) / peak;

const data = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++)
  data.writeInt16LE(Math.round(samples[i] * scale), i * 2);

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

for (const out of process.argv.slice(2)) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.concat([header, data]));
}
