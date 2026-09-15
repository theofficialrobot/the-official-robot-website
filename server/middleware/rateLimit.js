function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimit({ windowMs = 10 * 60 * 1000, max = 20 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const ip = clientIp(req);
    const now = Date.now();
    let bucket = buckets.get(ip);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    if (buckets.size > 5000) {
      for (const [key, value] of buckets) {
        if (now - value.start > windowMs) buckets.delete(key);
      }
    }
    next();
  };
}

module.exports = { rateLimit, clientIp };
