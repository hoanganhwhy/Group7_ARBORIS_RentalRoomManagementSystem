import jwt from 'jsonwebtoken';
import { queryOne } from '../../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hostelmate-super-secret-key-2024';

export const authenticateToken = async (req, res, next) => {
  const token = req.cookies?.token || (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    const user = await queryOne('SELECT token_version FROM users WHERE id = ?', [payload.id]);
    if (!user || user.token_version !== payload.token_version) {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc bị vô hiệu hóa' });
    }
    
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuthToken = async (req, res, next) => {
  const token = req.cookies?.token || (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null);
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    const user = await queryOne('SELECT token_version FROM users WHERE id = ?', [payload.id]);
    if (user && user.token_version === payload.token_version) {
      req.user = payload;
    }
    next();
  } catch (err) {
    // If token is invalid, just proceed as guest
    next();
  }
};
