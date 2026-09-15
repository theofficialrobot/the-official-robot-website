const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { uploadsRoot } = require('./db');
const { seed } = require('./seed');
const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const robotRoutes = require('./routes/robots');
const orderRoutes = require('./routes/orders');
const uploadRoutes = require('./routes/uploads');
const adminRoutes = require('./routes/admin');
const kycRoutes = require('./routes/kyc').router;
const mfrRoutes = require('./routes/mfr');

seed();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({ origin: true, credentials: true }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '1mb' }));

app.use(
  '/imagine_images',
  express.static(path.join(__dirname, '..', 'imagine_images'), {
    maxAge: '1d',
    setHeaders(res) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  })
);

app.use(
  '/uploads',
  (req, res, next) => {
    let decoded = req.path;
    try { decoded = decodeURIComponent(req.path); } catch { /* keep raw */ }
    if (decoded.includes('..') || decoded.includes('\0') || decoded.includes('\\')) {
      return res.status(400).json({ error: 'Invalid path.' });
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  },
  express.static(uploadsRoot, {
    dotfiles: 'deny',
    index: false,
    fallthrough: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
    }
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'The Official Robot marketplace' });
});

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/mfr', mfrRoutes);
app.use('/api/robots', robotRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON.' });
  }
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'Payload too large.' });
  }
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 4MB).' });
    }
    return res.status(400).json({ error: 'Upload failed.' });
  }
  const status = Number(err && err.status) || 500;
  if (status >= 500) console.error(err);
  const payload = { error: status >= 500 ? 'Server error.' : (err.message || 'Request failed.') };
  if (err && err.code && status < 500) payload.code = err.code;
  res.status(status).json(payload);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Official Robot API on http://127.0.0.1:' + PORT);
});
