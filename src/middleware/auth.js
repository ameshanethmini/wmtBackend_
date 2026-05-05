import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = req.cookies?.auth_token || null;
  const token = headerToken || cookieToken;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    User.findById(decoded.userId)
      .then((user) => {
        if (!user || !user.isActive) {
          return res.status(401).json({ error: 'Invalid or inactive user' });
        }

        const normalizedPath = String(req.path || '').toLowerCase();
        const isPasswordChangeRoute = normalizedPath === '/password' && req.method === 'PUT';
        const isAuthMeRoute = normalizedPath === '/me';
        const isLogoutRoute = normalizedPath === '/logout';

        if (user.mustChangePassword && !isPasswordChangeRoute && !isAuthMeRoute && !isLogoutRoute) {
          return res.status(403).json({
            error: 'Password change required before continuing',
            code: 'PASSWORD_CHANGE_REQUIRED',
          });
        }

        req.user = user;
        next();
      })
      .catch(() => res.status(401).json({ error: 'Invalid token' }));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const userRole = req.user.role;
    if (roles.includes(userRole)) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}
