// 认证路由：四端登录
import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/index.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { success, fail, verifyPassword, uuid, now, maskPhone, encryptPhone, decryptPhone, hashPassword } from '../utils/helpers.js';
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
  let member = db.prepare('SELECT * FROM members WHERE phone_hash = ? AND status = ?').get(phoneH, 'ACTIVE');

  // 销售/教练也可使用手机号进入会员系统。首次进入时自动建立关联会员档案，之后复用同一档案。
  if (!member) {
    const staff = db.prepare(`
      SELECT id, name, phone, 'sales' AS staff_type FROM sales WHERE phone = ? AND status = 'ACTIVE'
      UNION ALL
      SELECT id, name, phone, 'coach' AS staff_type FROM coaches WHERE phone = ? AND status = 'ACTIVE'
      LIMIT 1
    `).get(phone, phone);
    if (staff) {
      const existing = db.prepare('SELECT * FROM members WHERE phone_hash = ?').get(phoneH);
      if (existing && existing.status !== 'ACTIVE') return res.status(403).json(fail('该手机号对应的会员档案已停用', 403));
      member = existing || {
        id: uuid(), name: staff.name, phone, phone_hash: phoneH, gender: 'U',
        status: 'ACTIVE', creator_id: staff.id, creator_type: staff.staff_type,
        creator_name: staff.name, birth_date: null, channel_id: null, sub_channel_id: null,
      };
      if (!existing) {
        db.prepare(`INSERT INTO members (id, name, phone, phone_hash, gender, status, creator_id, creator_type, creator_name, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'U', 'ACTIVE', ?, ?, ?, ?, ?)`).run(
          member.id, member.name, encryptPhone(phone), phoneH, staff.id, staff.staff_type, staff.name, now(), now(),
        );
      }
    }
  }
  if (!member) return res.status(404).json(fail('未找到会员档案，请联系场馆工作人员建档', 404));
  const token = signToken({ id: member.id, role: 'member', name: member.name, memberId: member.id });
  res.json(success({ token, user: { id: member.id, name: member.name, role: 'member', memberId: member.id, phone: maskPhone(phone) } }));
});

// 模拟发送验证码（本期固定返回 1234）
router.post('/member/send-code', (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json(fail('手机号必填'));
  res.json(success({ sent: true, demoCode: '1234' }, '验证码已发送（模拟，验证码为 1234）'));
});

// 会员注册（手机号 + 验证码 + 密码 + 隐私协议同意）
router.post('/member/register', (req, res) => {
  const { phone, code, password, name, agreedPrivacy } = req.body || {};
  if (!phone || !code || !password) return res.status(400).json(fail('手机号、验证码、密码必填'));
  if (!/^\d{11}$/.test(phone)) return res.status(400).json(fail('手机号格式错误'));
  if (!/^\d{4,6}$/.test(code)) return res.status(400).json(fail('验证码格式错误'));
  if (password.length < 6) return res.status(400).json(fail('密码至少6位'));
  if (!agreedPrivacy) return res.status(400).json(fail('请先同意用户隐私协议和场馆锻炼安全免责说明'));
  const db = getDb();
  const phoneH = hashPhone(phone);
  const exist = db.prepare('SELECT id, status FROM members WHERE phone_hash = ?').get(phoneH);
  if (exist) {
    if (exist.status === 'ACTIVE') return res.status(409).json(fail('该手机号已注册，请直接登录', 409));
    return res.status(409).json(fail('该手机号已注册但已停用，请联系场馆工作人员', 409));
  }
  const id = uuid();
  const memberName = name || `会员${phone.slice(-4)}`;
  db.prepare(`INSERT INTO members (id, name, phone, phone_hash, gender, status, password_hash, creator_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'U', 'ACTIVE', ?, 'SELF', ?, ?)`).run(
    id, memberName, encryptPhone(phone), phoneH, hashPassword(password), now(), now(),
  );
  const token = signToken({ id, role: 'member', name: memberName, memberId: id });
  res.status(201).json(success({ token, user: { id, name: memberName, role: 'member', memberId: id, phone: maskPhone(phone) } }, '注册成功'));
});

// 会员密码登录（手机号 + 密码）
router.post('/member/password-login', (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json(fail('手机号和密码必填'));
  const db = getDb();
  const phoneH = hashPhone(phone);
  const member = db.prepare('SELECT * FROM members WHERE phone_hash = ? AND status = ?').get(phoneH, 'ACTIVE');
  if (!member) return res.status(404).json(fail('未找到会员档案，请先注册或联系场馆工作人员建档', 404));
  if (!member.password_hash) return res.status(400).json(fail('该账号未设置密码，请使用验证码登录或联系工作人员', 400));
  if (!verifyPassword(password, member.password_hash)) return res.status(401).json(fail('手机号或密码错误', 401));
  const token = signToken({ id: member.id, role: 'member', name: member.name, memberId: member.id });
  res.json(success({ token, user: { id: member.id, name: member.name, role: 'member', memberId: member.id, phone: maskPhone(phone) } }));
});

// 微信登录（本期模拟：通过 openid 或临时 code 自动创建/关联会员档案）
router.post('/member/wechat-login', (req, res) => {
  const { code, nickname } = req.body || {};
  if (!code) return res.status(400).json(fail('微信授权码必填'));
  // 模拟：用 code 生成稳定的 openid 作为唯一标识
  const openid = 'wx_' + crypto.createHash('sha256').update(String(code)).digest('hex').slice(0, 24);
  const db = getDb();
  // 用 openid 作为伪手机号存储（前缀 wx_），便于复用 members 表
  const phoneH = hashPhone(openid);
  let member = db.prepare('SELECT * FROM members WHERE phone_hash = ? AND status = ?').get(phoneH, 'ACTIVE');
  if (!member) {
    const id = uuid();
    const memberName = nickname || '微信用户';
    db.prepare(`INSERT INTO members (id, name, phone, phone_hash, gender, status, creator_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'U', 'ACTIVE', 'WECHAT', ?, ?)`).run(
      id, memberName, encryptPhone(openid), phoneH, now(), now(),
    );
    member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  }
  const token = signToken({ id: member.id, role: 'member', name: member.name, memberId: member.id });
  res.json(success({ token, user: { id: member.id, name: member.name, role: 'member', memberId: member.id, phone: maskPhone(openid) } }));
});

// 修改密码（管理员）
router.post('/admin/change-password', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json(fail('无权限', 403));
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return res.status(400).json(fail('旧密码和新密码必填'));
    if (newPassword.length < 6) return res.status(400).json(fail('新密码至少6位'));
    const db = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE id = ? AND status = ?').get(req.user.id, 'ACTIVE');
    if (!admin || !verifyPassword(oldPassword, admin.password_hash)) {
      return res.status(403).json(fail('旧密码错误', 403));
    }
    db.prepare('UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(newPassword), now(), admin.id);
    res.json(success({ ok: true }, '密码修改成功'));
  } catch (e) { res.status(500).json(fail(e.message || '服务器错误')); }
});

// 修改管理员信息（姓名）
router.post('/admin/update-profile', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json(fail('无权限', 403));
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json(fail('姓名不能为空'));
    const db = getDb();
    db.prepare('UPDATE admins SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), now(), req.user.id);
    const token = signToken({ id: req.user.id, role: 'admin', name: name.trim(), username: req.user.username });
    res.json(success({ token, user: { id: req.user.id, name: name.trim(), role: 'admin', username: req.user.username } }, '信息修改成功'));
  } catch (e) { res.status(500).json(fail(e.message || '服务器错误')); }
});

// 切换身份：会员可直接切换到同手机号对应的销售/教练身份，无需再次登录
router.post('/switch-identity', authMiddleware, (req, res) => {
  const { targetRole } = req.body || {};
  if (!targetRole || !['member', 'sales', 'coach'].includes(targetRole)) {
    return res.status(400).json(fail('目标身份无效，仅支持 member / sales / coach'));
  }
  const db = getDb();
  if (targetRole === 'member' && (req.user.role === 'sales' || req.user.role === 'coach')) {
    const phone = req.user.phone;
    const member = db.prepare('SELECT * FROM members WHERE phone = ? AND status = ?').get(phone, 'ACTIVE');
    if (!member) return res.status(404).json(fail('未找到对应会员档案', 404));
    const token = signToken({ id: member.id, role: 'member', name: member.name, memberId: member.id });
    return res.json(success({ token, user: { id: member.id, name: member.name, role: 'member', memberId: member.id, phone: maskPhone(phone) } }));
  }
  if (req.user.role !== 'member') {
    return res.status(403).json(fail('仅会员身份可使用切换身份功能'));
  }
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.user.memberId || req.user.id);
  if (!member) return res.status(404).json(fail('会员档案不存在'));
  const phone = decryptPhone(member.phone);
  if (!phone || phone.length < 11) return res.status(400).json(fail('无法解析会员手机号'));

  if (targetRole === 'sales') {
    const sales = db.prepare('SELECT * FROM sales WHERE phone = ? AND status = ?').get(phone, 'ACTIVE');
    if (!sales) return res.status(404).json(fail('该手机号未绑定销售账号', 404));
    db.prepare('UPDATE sales SET last_login_at = ? WHERE id = ?').run(now(), sales.id);
    const token = signToken({ id: sales.id, role: 'sales', name: sales.name, phone: sales.phone });
    return res.json(success({ token, user: { id: sales.id, name: sales.name, role: 'sales', phone: sales.phone } }));
  }
  const coach = db.prepare('SELECT * FROM coaches WHERE phone = ? AND status = ?').get(phone, 'ACTIVE');
  if (!coach) return res.status(404).json(fail('该手机号未绑定教练账号', 404));
  db.prepare('UPDATE coaches SET last_login_at = ? WHERE id = ?').run(now(), coach.id);
  const token = signToken({ id: coach.id, role: 'coach', name: coach.name, phone: coach.phone, salesEnabled: !!coach.sales_enabled });
  return res.json(success({ token, user: { id: coach.id, name: coach.name, role: 'coach', phone: coach.phone, salesEnabled: !!coach.sales_enabled } }));
});

// 查询当前会员可切换的身份列表（用于前端展示可用身份）
router.get('/switchable-roles', authMiddleware, (req, res) => {
  if (req.user.role !== 'member') return res.json(success({ roles: [] }));
  const db = getDb();
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.user.memberId || req.user.id);
  if (!member) return res.json(success({ roles: [] }));
  const phone = decryptPhone(member.phone);
  if (!phone || phone.length < 11) return res.json(success({ roles: [] }));
  const roles = [];
  const sales = db.prepare('SELECT id, name FROM sales WHERE phone = ? AND status = ?').get(phone, 'ACTIVE');
  if (sales) roles.push({ role: 'sales', name: sales.name });
  const coach = db.prepare('SELECT id, name, sales_enabled FROM coaches WHERE phone = ? AND status = ?').get(phone, 'ACTIVE');
  if (coach) roles.push({ role: 'coach', name: coach.name, salesEnabled: !!coach.sales_enabled });
  res.json(success({ roles }));
});

export default router;
