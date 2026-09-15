const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const express = require('express');
const { uploadsRoot } = require('../db');
const { requireVerified } = require('../middleware/auth');
const { safe } = require('../util');

const router = express.Router();

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

const IMAGE_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

const KYC_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

const MAIN_ALPHA_ERROR = 'Main photo must be PNG or WebP with a transparent background.';

function destKind(req) {
  const kind = String((req.query && req.query.kind) || '');
  if (kind === 'reviews') return 'reviews';
  if (kind === 'kyc') return 'kyc';
  return 'listings';
}

function fileKindLabel(kind) {
  if (kind === 'reviews') return 'review';
  return 'listing';
}

function sniffKind(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.slice(0, 4).toString('ascii') === '%PDF') return 'pdf';
  const gif = buf.slice(0, 6).toString('ascii');
  if (gif === 'GIF87a' || gif === 'GIF89a') return 'gif';
  return null;
}

// PNG: IHDR color type 4/6 or tRNS. WebP: VP8X alpha flag, ALPH chunk, or VP8L alpha bit.
function pngHasAlpha(buf) {
  if (!buf || buf.length < 26) return false;
  const colorType = buf[25];
  if (colorType === 4 || colorType === 6) return true;
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'tRNS') return true;
    if (type === 'IEND' || type === 'IDAT') break;
    if (!Number.isFinite(len) || len < 0 || offset + 12 + len > buf.length) break;
    offset += 12 + len;
  }
  return false;
}

function webpHasAlpha(buf) {
  if (!buf || buf.length < 16) return false;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const fourcc = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (fourcc === 'VP8X' && payload < buf.length && (buf[payload] & 0x10)) return true;
    if (fourcc === 'ALPH') return true;
    if (fourcc === 'VP8L' && payload + 5 <= buf.length) {
      const bits = buf.readUInt32LE(payload + 1);
      if (bits & (1 << 28)) return true;
    }
    offset += 8 + size + (size & 1);
  }
  return false;
}

function headerHasAlpha(buf, sniffed) {
  if (sniffed === 'png') return pngHasAlpha(buf);
  if (sniffed === 'webp') return webpHasAlpha(buf);
  return false;
}

async function hasTransparentBackground(buf, sniffed, filePath) {
  if (sniffed !== 'png' && sniffed !== 'webp') return false;
  if (sharp) {
    try {
      const meta = await sharp(filePath).metadata();
      if (!meta.hasAlpha) return false;
      const stats = await sharp(filePath).stats();
      if (stats.isOpaque) return false;
      return true;
    } catch {
      return headerHasAlpha(buf, sniffed);
    }
  }
  return headerHasAlpha(buf, sniffed);
}

function webpFilename(kind) {
  const unix = Math.floor(Date.now() / 1000);
  const rand = crypto.randomBytes(2).toString('hex');
  return fileKindLabel(kind) + '-' + unix + '-' + rand + '.webp';
}

function unlinkQuiet(filePath) {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

function uploadMiddleware(req, res, next) {
  const kind = destKind(req);
  const isKyc = kind === 'kyc';
  const extMap = isKyc ? KYC_EXT : IMAGE_EXT;
  const allowed = new Set(Object.keys(extMap));
  const upload = multer({
    storage: multer.diskStorage({
      destination(_req, _file, cb) {
        cb(null, path.join(uploadsRoot, kind));
      },
      filename(_req, file, cb) {
        const ext = extMap[file.mimetype] || '.bin';
        cb(null, crypto.randomBytes(16).toString('hex') + ext);
      }
    }),
    limits: { fileSize: (isKyc ? 6 : 4) * 1024 * 1024, files: 1 },
    fileFilter(_req, file, cb) {
      if (!allowed.has(file.mimetype)) {
        const err = new Error(isKyc ? 'KYC file must be jpeg, png, webp, or pdf.' : 'File must be jpeg, png, webp, or gif.');
        err.status = 400;
        return cb(err);
      }
      cb(null, true);
    }
  }).single('file');

  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: isKyc ? 'File too large (max 6MB).' : 'File too large (max 4MB).' });
      }
      return res.status(err.status || 400).json({ error: err.message || 'Upload failed.' });
    }
    next();
  });
}

router.post('/', requireVerified, uploadMiddleware, safe(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A file is required.' });
  const kind = destKind(req);
  const isKyc = kind === 'kyc';
  const isMain = String((req.query && req.query.main) || '') === '1';
  const buf = fs.readFileSync(req.file.path);
  const sniffed = sniffKind(buf);
  const allowed = isKyc ? new Set(['jpeg', 'png', 'webp', 'pdf']) : new Set(['jpeg', 'png', 'webp', 'gif']);
  if (!sniffed || !allowed.has(sniffed)) {
    unlinkQuiet(req.file.path);
    return res.status(400).json({
      error: isKyc ? 'KYC file must be jpeg, png, webp, or pdf.' : 'File must be jpeg, png, webp, or gif.'
    });
  }

  if (isKyc) {
    const filename = path.basename(req.file.filename);
    return res.status(201).json({ url: '/uploads/' + kind + '/' + filename, filename });
  }

  if (isMain) {
    if (sniffed === 'jpeg' || sniffed === 'gif' || !(await hasTransparentBackground(buf, sniffed, req.file.path))) {
      unlinkQuiet(req.file.path);
      return res.status(400).json({ error: MAIN_ALPHA_ERROR });
    }
  }

  if (sharp) {
    const filename = webpFilename(kind);
    const dest = path.join(uploadsRoot, kind, filename);
    try {
      await sharp(req.file.path)
        .rotate()
        .webp({ quality: 82, alphaQuality: 100 })
        .toFile(dest);
    } catch {
      unlinkQuiet(req.file.path);
      unlinkQuiet(dest);
      return res.status(400).json({ error: sniffed === 'jpeg' ? 'Unable to convert JPEG to WebP.' : 'Unable to convert image to WebP.' });
    }
    unlinkQuiet(req.file.path);
    return res.status(201).json({ url: '/uploads/' + kind + '/' + filename, filename });
  }

  if (sniffed === 'jpeg' || sniffed === 'gif') {
    unlinkQuiet(req.file.path);
    return res.status(400).json({ error: 'Unable to convert JPEG to WebP. Upload a PNG or WebP image.' });
  }

  const ext = sniffed === 'png' ? '.png' : '.webp';
  const filename = fileKindLabel(kind) + '-' + Math.floor(Date.now() / 1000) + '-' + crypto.randomBytes(2).toString('hex') + ext;
  const dest = path.join(uploadsRoot, kind, filename);
  fs.renameSync(req.file.path, dest);
  res.status(201).json({ url: '/uploads/' + kind + '/' + filename, filename });
}));

module.exports = router;
