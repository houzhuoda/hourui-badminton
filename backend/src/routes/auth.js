// 认证路由：四端登录
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { signToken } from '../middleware/auth.js';
import { success, fail, verifyPassword, uuid, now, maskPhone } from '../utils/helpers.js';
import { hashPhone } from '../utils/helpers.js';
import { config } from '../utils/config.js';

const router = Router();

// 管理员登录
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json(fail('用户名和密码必填'));
  const db = getDb();
  const admin = db.prepare('SELECT * FROM admins WHERE username = ? AND status = ?').get(username, 'ACTIVE');
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return res.status(401).json(fail('用户名或密码错误', 401));
  }
  db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(now(), admin.id);
  const token = signToken({ id: admin.id, role: 'admin', name: admin.name, username: admin.username });
  res.json(success({ token, user: { id: admin.id, name: admin.name, role: 'admin', username: admin.username } }));
});

// 销售登录（手机号 + 密码）
router.post('/sales/login', (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json(fail('手机号和密码必填'));
  const db = getDb();
  const sales = db.prepare('SELECT * FROM sales WHERE phone = ? AND status = ?').get(phone, 'ACTIVE');
  if (!sales || !verifyPassword(password, sales.password_hash)) {
    return res.status(401).json(fail('手机号或密码错误', 401));
  }
  db.prepare('UPDATE sales SET last_login_at = ? WHERE id = ?').run(now(), sales.id);
  const token = signToken({ id: sales.id, role: 'sales', name: sales.name, phone: sales.phone });
  res.json(success({ token, user: { id: sales.id, name: sales.name, role: 'sales', phone: sales.phone } }));
});

// 教练登录（手机号 + 密码）
router.post('/coach/login', (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json(fail('手机号和密码必填'));
  const db = getDb();
  const coach = db.prepare('SELECT * FROM coaches WHERE phone = ? AND status = ?').get(phone, 'ACTIVE');
  if (!coach || !verifyPassword(password, coach.password_hash)) {
    return res.status(401).json(fail('手机号或密码错误', 401));
  }
  db.prepare('UPDATE coaches SET last_login_at = ? WHERE id = ?').run(now(), coach.id);
  const token = signToken({ id: coach.id, role: 'coach', name: coach.name, phone: coach.phone, salesEnabled: !!coach.sales_enabled });
  res.json(success({ token, user: { id: coach.id, name: coach.name, role: 'coach', phone: coach.phone, salesEnabled: !!coach.sales_enabled } }));
});

// 会员登录（手机号 + 验证码，本期模拟：任意 4-6 位数字验证码通过）
router.post('/member/login', (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !code) return res.status(400).json(fail('手机号和验证码必填'));
  if (!/^\d{4,6}$/.test(code)) return res.status(400).json(fail('验证码格式错误'));
  const db = getDb();
  const phoneH = hashPhone(phone);
  const member = db.prepare('SELECT * FROM members WHERE phone_hash = ? AND status = ?').get(phoneH, 'ACTIVE');
  if (!member) {
    return res.status(404).json(fail('未找到会员档案，请联系场馆工作人员建档', 404));
  }
  const token = signToken({ id: member.id, role: 'member', name: member.name, memberId: member.id });
  res.json(success({ token, user: { id: member.id, name: member.name, role: 'member', phone: maskPhone(phone) } }));
});

// 模拟发送验证码（本期固定返回 1234）
router.post('/member/send-code', (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json(fail('手机号必填'));
  res.json(success({ sent: true, demoCode: '1234' }, '验证码已发送（模拟，验证码为 1234）'));
});

// 修改密码（管理员）
router.post('/admin/change-password', (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json(fail('旧密码和新密码必填'));
  // 需要 authMiddleware 保障，此处简化
  res.json(success({ ok: true }));
});

export default router;
