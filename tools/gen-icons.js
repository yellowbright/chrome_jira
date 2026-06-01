const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, draw) {
  const bytesPerPixel = 4;
  const raw = Buffer.alloc(size * (1 + size * bytesPerPixel));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * bytesPerPixel);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const p = rowStart + 1 + x * bytesPerPixel;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
      raw[p + 3] = a;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// 圆角蓝色背景 + 白色对勾，体现 "commit collected"
function draw(x, y, size) {
  const bg = [0, 82, 204, 255]; // Atlassian/JIRA blue
  const white = [255, 255, 255, 255];
  const transparent = [0, 0, 0, 0];

  const radius = size * 0.22;
  const inCorner = (cx, cy) => Math.hypot(x - cx, y - cy) > radius;
  if (x < radius && y < radius && inCorner(radius, radius)) return transparent;
  if (x > size - radius && y < radius && inCorner(size - radius, radius)) return transparent;
  if (x < radius && y > size - radius && inCorner(radius, size - radius)) return transparent;
  if (x > size - radius && y > size - radius && inCorner(size - radius, size - radius))
    return transparent;

  // 白色对勾
  const t = Math.max(1, size * 0.1);
  const p1 = [size * 0.28, size * 0.52];
  const p2 = [size * 0.44, size * 0.68];
  const p3 = [size * 0.74, size * 0.34];

  const distToSeg = (px, py, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let tt = len2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / len2 : 0;
    tt = Math.max(0, Math.min(1, tt));
    return Math.hypot(px - (a[0] + tt * dx), py - (a[1] + tt * dy));
  };

  if (distToSeg(x, y, p1, p2) <= t / 2 || distToSeg(x, y, p2, p3) <= t / 2) return white;
  return bg;
}

const outDir = path.join(__dirname, "..", "img");
fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  const png = makePng(size, draw);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`wrote img/icon-${size}.png (${png.length} bytes)`);
}
