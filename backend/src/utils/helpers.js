// 工具函数集合
import crypto from 'crypto';
import { config } from './config.js';

// ============ 手机号加密/脱敏 ============
// 简单的对称加密（AES-256-CBC），用于手机号加密存储
const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.createHash('sha256').update(config.phoneEncryptKey).digest();
const IV_LENGTH = 16;

export function encryptPhone(phone) {
  if (!phone) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(phone, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptPhone(encrypted) {
  if (!encrypted || !encrypted.includes(':')) return encrypted;
  try {
    const [ivHex, data] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encrypted;
  }
}

// 手机号脱敏：138****1234
export function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

// 手机号 hash（用于唯一校验与查询，避免解密全表扫描）
export function hashPhone(phone) {
  return crypto.createHash('sha256').update(phone + config.phoneEncryptKey).digest('hex');
}

// ============ 通用工具 ============
// 生成 UUID（兼容 crypto.randomUUID）
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 生成订单号：ORD-YYYYMMDD-XXXX
export function generateOrderNo() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${date}-${rand}`;
}

// 日期格式化 YYYY-MM-DD
export function formatDate(date) {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().slice(0, 10);
}

// 当前时间 ISO
export function now() {
  return new Date().toISOString();
}

// 加 N 天
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 加 N 月（用于月卡到期）
export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// 当前月份 YYYY-MM
export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// 日期范围查询辅助
export function dateRangeStart(range) {
  const now = new Date();
  switch (range) {
    case 'today':
      return now.toISOString().slice(0, 10);
    case '7d':
      return new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    case '30d':
      return new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    case 'month':
      return now.toISOString().slice(0, 8) + '01';
    default:
      return null;
  }
}

// 分页参数解析
export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

// 统一响应
export function success(data, message = 'ok') {
  return { code: 0, data, message };
}

export function fail(message, code = 1) {
  return { code, data: null, message };
}

// 密码哈希（bcryptjs 同步接口）
import bcrypt from 'bcryptjs';
export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}
export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}
