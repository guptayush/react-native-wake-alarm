/* global Buffer */
const fs = require('fs');
const path = require('path');
const rate = 22050,
  seconds = 3,
  freq = 880,
  n = rate * seconds;
const data = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) {
  const fade = Math.min(1, i / (rate * 0.05), (n - i) / (rate * 0.05));
  data.writeInt16LE(
    Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 0.6 * 32767 * fade),
    i * 2
  );
}
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
