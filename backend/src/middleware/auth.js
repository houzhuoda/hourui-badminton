// JWT 鉴权中间件
import jwt from 'jsonwebtoken';
import { config } from '../utils/config.js';
import { fail } from '../utils/helpers.js';

// 生成 JWT
export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// 验证 JWT 并挂载 req.user
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json(fail('未登录', 401));
  }
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json(fail('登录已过期', 401));
  }
}

// 角色校验：requireRole('admin') 或 requireRole(['sales', 'coach'])
export function requireRole(roles) {
  const arr = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(fail('未登录', 401));
    }
    if (!arr.includes(req.user.role)) {
      return res.status(403).json(fail('无权限', 403));
    }
    next();
  };
}

// 组合：登录 + 角色
export function authRole(roles) {
  return [authMiddleware, requireRole(roles)];
}
