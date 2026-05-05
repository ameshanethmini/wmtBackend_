const buckets = new Map();

const nowMs = () => Date.now();

function cleanupExpiredEntries(store, ttlMs) {
  const threshold = nowMs() - ttlMs;
  for (const [key, value] of store.entries()) {
    if (value.lastSeenAt < threshold) {
      store.delete(key);
    }
  }
}

function getClientIp(req) {
  return (
    String(req.ip || '').trim() ||
    String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    String(req.socket?.remoteAddress || '').trim() ||
    'unknown'
  );
}

export function createRateLimiter({
  windowMs,
  max,
  keyGenerator,
  message = 'Too many requests. Please try again shortly.',
}) {
  const ttlMs = Math.max(windowMs * 3, 10 * 60 * 1000);

  return (req, res, next) => {
    if (Math.random() < 0.01) cleanupExpiredEntries(buckets, ttlMs);

    const key = String(keyGenerator(req) || '').trim();
    const bucketKey = key || getClientIp(req);
    const current = nowMs();
    const entry = buckets.get(bucketKey);

    if (!entry || entry.resetAt <= current) {
      buckets.set(bucketKey, {
        count: 1,
        resetAt: current + windowMs,
        lastSeenAt: current,
      });
      return next();
    }

    entry.count += 1;
    entry.lastSeenAt = current;
    buckets.set(bucketKey, entry);

    if (entry.count > max) {
      const retryAfterSeconds = Math.max(Math.ceil((entry.resetAt - current) / 1000), 1);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: message });
    }

    return next();
  };
}

function normalizedAccountValue(value) {
  return String(value || '').trim().toLowerCase() || 'anonymous';
}

export function keyByIpAndEmail(source = 'body') {
  return (req) => {
    const ip = getClientIp(req);
    const target = source === 'query' ? req.query : req.body;
    const account = normalizedAccountValue(target?.email);
    return `${ip}|${account}`;
  };
}

export function keyByIpAndRequest(source = 'query') {
  return (req) => {
    const ip = getClientIp(req);
    const target = source === 'query' ? req.query : req.body;
    const email = normalizedAccountValue(target?.email);
    const requestId = String(target?.requestId || '').trim().toLowerCase() || 'none';
    return `${ip}|${email}|${requestId}`;
  };
}