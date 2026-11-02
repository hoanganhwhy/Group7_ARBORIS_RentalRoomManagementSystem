import jwt from 'jsonwebtoken';
import { queryOne } from '../../db.js';
import { JWT_SECRET } from '../config.js';

const isCurrentSession = (user, payload) => (
  Boolean(user)
  && !user.is_locked
  && (payload.role !== 'TENANT' || Boolean(user.username))
  && Number(user.token_version || 0) === Number(payload.token_version || 0)
);

const loadSessionUser = (payload) => (
  payload.role === 'TENANT'
    ? queryOne('SELECT id, username, is_locked, token_version FROM khach_thue WHERE id = ?', [payload.id])
    : queryOne('SELECT id, is_locked, token_version FROM users WHERE id = ?', [payload.id])
);

export const authenticateToken = async (req, res, next) => {
  const token = req.cookies?.token || (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!isCurrentSession(await loadSessionUser(payload), payload)) {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc bị vô hiệu hóa' });
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
