// 销售管理路由
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, uuid, now, hashPassword } from '../utils/helpers.js';
import { writeAudit, operatorFromReq } from '../services/audit.js';
import { AUDIT_ACTIONS } from '../../../shared/constants.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 销售列表（管理员）
router.get('/', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { status } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND status = ?'; params.push(status); }
    const list = db.prepare(`SELECT id, name, phone, status, created_at FROM sales ${where} ORDER BY created_at DESC`).all(...params);
    res.json(success({ list, total: list.length }));
  } catch (e) { next(e); }
});

// 销售详情
router.get('/:id', authRole(['admin', 'sales']), (req, res, next) => {
  try {
    const db = getDb();
    const s = db.prepare('SELECT id, name, phone, status, created_at FROM sales WHERE id = ?').get(req.params.id);
    if (!s) throw new BizError('销售不存在', 404);
    if (req.user.role === 'sales' && req.user.id !== s.id) throw new BizError('无权查看', 403);
    res.json(success(s));
  } catch (e) { next(e); }
});

// 新增销售
router.post('/', authRole(['admin']), (req, res, next) => {
  try {
    const { name, phone, password } = req.body || {};
    if (!name || !phone || !password) throw new BizError('姓名、手机号、密码必填');
    if (!/^\d{11}$/.test(phone)) throw new BizError('手机号格式错误');
    const db = getDb();
    const exist = db.prepare('SELECT id FROM sales WHERE phone = ?').get(phone);
    if (exist) throw new BizError('手机号已存在', 409);
    const coachExist = db.prepare('SELECT id FROM coaches WHERE phone = ?').get(phone);
    if (coachExist) throw new BizError('该手机号已是教练账号，一个人不能同时属于销售和教练两种身份', 409);
    const id = uuid();
    db.prepare(`INSERT INTO sales (id, phone, password_hash, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`)
      .run(id, phone, hashPassword(password), name, now(), now());
    writeAudit({ entity: 'sales', entityId: id, action: AUDIT_ACTIONS.CREATE, operator: operatorFromReq(req), detail: { name, phone } });
    res.status(201).json(success(db.prepare('SELECT id, name, phone, status FROM sales WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

// 编辑销售
router.put('/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const s = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!s) throw new BizError('销售不存在', 404);
    const { name, phone, password } = req.body || {};
    const updates = [];
    const params = [];
    if (name) { updates.push('name = ?'); params.push(name); }
    if (phone) {
      if (!/^\d{11}$/.test(phone)) throw new BizError('手机号格式错误');
      const exist = db.prepare('SELECT id FROM sales WHERE phone = ? AND id != ?').get(phone, req.params.id);
      if (exist) throw new BizError('手机号已存在', 409);
      const coachExist = db.prepare('SELECT id FROM coaches WHERE phone = ?').get(phone);
      if (coachExist) throw new BizError('该手机号已是教练账号，一个人不能同时属于销售和教练两种身份', 409);
      updates.push('phone = ?'); params.push(phone);
    }
    if (password) { updates.push('password_hash = ?'); params.push(hashPassword(password)); }
    if (updates.length === 0) throw new BizError('无更新内容');
    params.push(now(), req.params.id);
    db.prepare(`UPDATE sales SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...params);
    writeAudit({ entity: 'sales', entityId: req.params.id, action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: { name, phone } });
    res.json(success(db.prepare('SELECT id, name, phone, status FROM sales WHERE id = ?').get(req.params.id)));
  } catch (e) { next(e); }
});

// 启用/停用销售
router.patch('/:id/status', authRole(['admin']), (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['ACTIVE', 'DISABLED'].includes(status)) throw new BizError('无效状态');
    const db = getDb();
    const s = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!s) throw new BizError('销售不存在', 404);
    db.prepare('UPDATE sales SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), req.params.id);
    writeAudit({ entity: 'sales', entityId: req.params.id, action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: { status } });
    res.json(success({ id: req.params.id, status }));
  } catch (e) { next(e); }
});

// 重置密码
router.patch('/:id/reset-password', authRole(['admin']), (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password) throw new BizError('新密码必填');
    const db = getDb();
    const s = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!s) throw new BizError('销售不存在', 404);
    db.prepare('UPDATE sales SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(password), now(), req.params.id);
    res.json(success({ id: req.params.id, reset: true }));
  } catch (e) { next(e); }
});

export default router;
