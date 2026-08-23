// 教练管理路由
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, uuid, now, hashPassword } from '../utils/helpers.js';
import { writeAudit, operatorFromReq } from '../services/audit.js';
import { BUSINESS_TYPE_CODES, AUDIT_ACTIONS } from '../../../shared/constants.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 教练列表
router.get('/', authRole(['admin', 'sales', 'coach', 'member']), (req, res, next) => {
  try {
    const db = getDb();
    const { status } = req.query;
    const where = status ? 'WHERE status = ?' : "WHERE status = 'ACTIVE'";
    const params = status ? [status] : [];
    // 教练只能看本人
    if (req.user.role === 'coach') {
      where.replace('WHERE', 'WHERE id = ? AND');
    }
    const list = db.prepare(`SELECT id, name, phone, primary_business_type, sales_enabled, status, created_at FROM coaches ${where} ORDER BY created_at`).all(...params);
    // 附带费率
    const result = list.map((c) => ({
      ...c,
      rates: db.prepare('SELECT * FROM coach_rates WHERE coach_id = ?').all(c.id),
    }));
    res.json(success(result));
  } catch (e) { next(e); }
});

// 教练详情
router.get('/:id', authRole(['admin', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const c = db.prepare('SELECT id, name, phone, primary_business_type, sales_enabled, status, created_at FROM coaches WHERE id = ?').get(req.params.id);
    if (!c) throw new BizError('教练不存在', 404);
    if (req.user.role === 'coach' && req.user.id !== c.id) throw new BizError('无权查看', 403);
    c.rates = db.prepare('SELECT * FROM coach_rates WHERE coach_id = ?').all(c.id);
    res.json(success(c));
  } catch (e) { next(e); }
});

// 新增教练
router.post('/', authRole(['admin']), (req, res, next) => {
  try {
    const { name, phone, password, primaryBusinessTypes, salesEnabled, rates } = req.body || {};
    if (!name || !phone || !password) throw new BizError('姓名、手机号、密码必填');
    if (!/^\d{11}$/.test(phone)) throw new BizError('手机号格式错误');
    // 支持多选：数组转逗号分隔字符串
    const btValue = Array.isArray(primaryBusinessTypes) && primaryBusinessTypes.length > 0
      ? primaryBusinessTypes.filter((b) => BUSINESS_TYPE_CODES.includes(b)).join(',')
      : null;
    const db = getDb();
    const exist = db.prepare('SELECT id FROM coaches WHERE phone = ?').get(phone);
    if (exist) throw new BizError('手机号已存在', 409);
    const salesExist = db.prepare('SELECT id FROM sales WHERE phone = ?').get(phone);
    if (salesExist) throw new BizError('该手机号已是销售账号，一个人不能同时属于教练和销售两种身份', 409);
    const id = uuid();
    db.prepare(`INSERT INTO coaches (id, phone, password_hash, name, primary_business_type, sales_enabled, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
      .run(id, phone, hashPassword(password), name, btValue, salesEnabled ? 1 : 0, now(), now());
    // 初始化费率
    if (rates && Array.isArray(rates)) {
      for (const r of rates) {
        if (!BUSINESS_TYPE_CODES.includes(r.businessType)) continue;
        db.prepare(`INSERT OR IGNORE INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate, gift_commission, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(uuid(), id, r.businessType, r.lessonFee || 0, r.shareRate || 0, r.giftCommission ? 1 : 0, now(), now());
      }
    } else {
      // 默认费率
      for (const bt of BUSINESS_TYPE_CODES) {
        db.prepare(`INSERT OR IGNORE INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate, gift_commission, created_at, updated_at) VALUES (?, ?, ?, 0, 0, 0, ?, ?)`)
          .run(uuid(), id, bt, now(), now());
      }
    }
    writeAudit({ entity: 'coach', entityId: id, action: AUDIT_ACTIONS.CREATE, operator: operatorFromReq(req), detail: { name, phone, primaryBusinessTypes, salesEnabled } });
    res.status(201).json(success(db.prepare('SELECT id, name, phone, primary_business_type, sales_enabled, status FROM coaches WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

// 编辑教练
router.put('/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const c = db.prepare('SELECT * FROM coaches WHERE id = ?').get(req.params.id);
    if (!c) throw new BizError('教练不存在', 404);
    const { name, primaryBusinessTypes, salesEnabled, status, password } = req.body || {};
    const updates = {};
    if (name) updates.name = name;
    if (primaryBusinessTypes !== undefined) {
      updates.primary_business_type = Array.isArray(primaryBusinessTypes) && primaryBusinessTypes.length > 0
        ? primaryBusinessTypes.filter((b) => BUSINESS_TYPE_CODES.includes(b)).join(',')
        : null;
    }
    if (salesEnabled !== undefined) updates.sales_enabled = salesEnabled ? 1 : 0;
    if (status) updates.status = status;
    if (password) updates.password_hash = hashPassword(password);
    if (Object.keys(updates).length > 0) {
      const sets = Object.keys(updates).map((k) => `${k === 'salesEnabled' ? 'sales_enabled' : k === 'password' ? 'password_hash' : k} = ?`).join(', ');
      db.prepare(`UPDATE coaches SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(updates), now(), c.id);
      writeAudit({ entity: 'coach', entityId: c.id, action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: { ...updates, password: password ? '***' : undefined } });
    }
    res.json(success(db.prepare('SELECT id, name, phone, primary_business_type, sales_enabled, status FROM coaches WHERE id = ?').get(c.id)));
  } catch (e) { next(e); }
});

// 教练费率设置（按业务类型）
router.put('/:id/rates', authRole(['admin']), (req, res, next) => {
  try {
    const { rates } = req.body || {};
    if (!Array.isArray(rates)) throw new BizError('rates 必须为数组');
    const db = getDb();
    const c = db.prepare('SELECT id FROM coaches WHERE id = ?').get(req.params.id);
    if (!c) throw new BizError('教练不存在', 404);
    for (const r of rates) {
      if (!BUSINESS_TYPE_CODES.includes(r.businessType)) continue;
      db.prepare(`INSERT INTO coach_rates (id, coach_id, business_type, lesson_fee, share_rate, gift_commission, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(coach_id, business_type) DO UPDATE SET lesson_fee = excluded.lesson_fee, share_rate = excluded.share_rate, gift_commission = excluded.gift_commission, updated_at = excluded.updated_at`)
        .run(uuid(), c.id, r.businessType, r.lessonFee || 0, r.shareRate || 0, r.giftCommission ? 1 : 0, now(), now());
    }
    writeAudit({ entity: 'coach', entityId: c.id, action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: { rates } });
    res.json(success(db.prepare('SELECT * FROM coach_rates WHERE coach_id = ?').all(c.id)));
  } catch (e) { next(e); }
});

// 销售能力开关（SCH-004 / COA-009）
router.patch('/:id/sales-enabled', authRole(['admin']), (req, res, next) => {
  try {
    const { enabled } = req.body;
    const db = getDb();
    const c = db.prepare('SELECT id FROM coaches WHERE id = ?').get(req.params.id);
    if (!c) throw new BizError('教练不存在', 404);
    db.prepare('UPDATE coaches SET sales_enabled = ?, updated_at = ? WHERE id = ?').run(enabled ? 1 : 0, now(), c.id);
    writeAudit({ entity: 'coach', entityId: c.id, action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: { salesEnabled: !!enabled } });
    res.json(success({ salesEnabled: !!enabled }));
  } catch (e) { next(e); }
});

export default router;
