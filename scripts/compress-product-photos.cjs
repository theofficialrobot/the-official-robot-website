'use strict';

const fs = require('fs');
const path = require('path');

function loadSharp() {
  const candidates = [
    path.join(__dirname, 'node_modules', 'sharp'),
    path.join(__dirname, '..', 'node_modules', 'sharp'),
  ];
  for (const dir of candidates) {
    try {
      return require(dir);
    } catch (_) {
      /* try next */
    }
  }
  throw new Error('sharp is not installed. From repo root: npm.cmd install sharp');
}

const sharp = loadSharp();
const imgDir = path.join(__dirname, '..', 'imagine_images');
const MIN_BYTES = 700000;
const MAX_EDGE = 1400;
const QUALITY = 78;
const QUALITY_FLOOR = 75;
const TARGET_BYTES = 500 * 1024;

const SKIP_RE = /official_robot_mark|\[The_Official_Robot\]|^splash_popup_|jSL8y/i;

async function encodeWebp(input, quality) {
  return sharp(input, { failOn: 'none' })
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality,
      alphaQuality: Math.min(90, quality + 4),
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer();
}

async function compressOne(file) {
  const src = path.join(imgDir, file);
  const orig = fs.readFileSync(src);
  const origSize = orig.length;

  let buf = await encodeWebp(orig, QUALITY);
  if (buf.length > TARGET_BYTES && QUALITY > QUALITY_FLOOR) {
    const retry = await encodeWebp(orig, QUALITY_FLOOR);
    if (retry.length < buf.length) buf = retry;
  }

  const meta = await sharp(buf).metadata();
  if (meta.format !== 'webp' || !meta.width || !meta.height) {
    return { file, origSize, newSize: origSize, status: 'invalid-encode' };
  }

  if (buf.length >= origSize) {
    return { file, origSize, newSize: origSize, status: 'kept-original', w: meta.width, h: meta.height };
  }

  const tmp = src + '.tmp-compress.webp';
  fs.writeFileSync(tmp, buf);
  fs.copyFileSync(tmp, src);
  fs.unlinkSync(tmp);
  return { file, origSize, newSize: buf.length, status: 'compressed', w: meta.width, h: meta.height, alpha: !!meta.hasAlpha };
}

async function main() {
  const names = fs.readdirSync(imgDir).filter((f) => {
    if (!f.toLowerCase().endsWith('.webp')) return false;
    if (SKIP_RE.test(f)) return false;
    const st = fs.statSync(path.join(imgDir, f));
    return st.isFile() && st.size >= MIN_BYTES;
  });

  const results = [];
  for (const file of names) {
    try {
      results.push(await compressOne(file));
    } catch (err) {
      results.push({ file, status: 'failed', error: err.message });
    }
  }

  for (const r of results) {
    if (r.status === 'compressed') {
      console.log(
        r.status,
        r.origSize + '->' + r.newSize,
        r.w + 'x' + r.h,
        r.file
      );
    } else if (r.status === 'failed') {
      console.log('FAILED', r.file, r.error);
    } else {
      console.log(r.status, r.file, r.origSize || '', r.error || '');
    }
  }
  const compressed = results.filter((r) => r.status === 'compressed');
  const failed = results.filter((r) => r.status === 'failed' || r.status === 'invalid-encode');
  console.log('COUNT_COMPRESSED=' + compressed.length);
  console.log('COUNT_FAILED=' + failed.length);
  console.log('COUNT_CANDIDATES=' + results.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
