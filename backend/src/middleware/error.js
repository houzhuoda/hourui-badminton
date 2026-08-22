// 错误处理中间件
import { fail } from '../utils/helpers.js';

// 404
export function notFound(req, res) {
  res.status(404).json(fail('接口不存在', 404));
}

// 统一错误处理
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  const message = err.message || '服务器内部错误';
  // 业务错误（status < 500）不打印堆栈
  if (status >= 500) {
    console.error('[ERROR]', err);
  }
  res.status(status).json(fail(message, status));
}

// 业务错误类
export class BizError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
