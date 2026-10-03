const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const ROOT = path.join(__dirname, '..', 'uploads');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Magic-byte signatures — never trust the client-declared mimetype alone.
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP',
};

function makeUploader(subdir) {
  const dir = path.join(ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXT[file.mimetype] || '.bin'}`),
    }),
    limits: { fileSize: env.uploadMaxMb * 1024 * 1024, files: 16 },
    fileFilter: (req, file, cb) => {
      if (!EXT[file.mimetype]) return cb(new AppError('Only JPG, PNG or WebP images are allowed.', 415));
      cb(null, true);
    },
  });
}

const removeFiles = (files) => files.forEach((f) => fs.unlink(f.path, () => {}));

/** Collects every uploaded file (works for .single, .array and .fields) */
const collect = (req) => {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files || {}).flat();
};

/** Run AFTER multer: verifies file signatures and deletes anything that doesn't match. */
const verifyImages = (req, res, next) => {
  const files = collect(req);
  try {
    for (const f of files) {
      const fd = fs.openSync(f.path, 'r');
      const buf = Buffer.alloc(16);
      fs.readSync(fd, buf, 0, 16, 0);
      fs.closeSync(fd);
      if (!SIGNATURES[f.mimetype](buf)) throw new AppError(`"${f.originalname}" is not a valid image file.`, 415);
    }
    next();
  } catch (err) {
    removeFiles(files);
    next(err);
  }
};

module.exports = { makeUploader, verifyImages, removeFiles, collect, UPLOAD_ROOT: ROOT };
