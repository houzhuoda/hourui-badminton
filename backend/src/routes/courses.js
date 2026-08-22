// 课程与定价管理路由
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, uuid, now } from '../utils/helpers.js';
import { writeAudit, operatorFromReq } from '../services/audit.js';
import { BUSINESS_TYPE_CODES, AUDIENCE_TYPES, AUDIT_ACTIONS } from '../../../shared/constants.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 课程列表
router.get('/', authRole(['admin', 'sales', 'coach', 'member']), (req, res, next) => {
  try {
    const db = getDb();
    const { businessType, status } = req.query;
    const where = [];
    const params = [];
    if (businessType) { where.push('business_type = ?'); params.push(businessType); }
    if (status) { where.push('status = ?'); params.push(status); }
    // 销售/教练/会员只看启用课程
    if (req.user.role !== 'admin') { where.push("status = 'ACTIVE'"); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const list = db.prepare(`SELECT * FROM courses ${whereSql} ORDER BY business_type, created_at`).all(...params);

    // 附带定价
    const result = list.map((c) => ({
      ...c,
      sessionPricing: db.prepare('SELECT * FROM course_session_pricing WHERE course_id = ? AND status = ? ORDER BY sort_order').all(c.id, 'ACTIVE'),
      monthlyPricing: db.prepare('SELECT * FROM course_monthly_pricing WHERE course_id = ? AND status = ? ORDER BY sort_order').all(c.id, 'ACTIVE'),
    }));
    res.json(success(result));
  } catch (e) { next(e); }
});

// 课程详情
router.get('/:id', authRole(['admin', 'sales', 'coach', 'member']), (req, res, next) => {
  try {
    const db = getDb();
    const c = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!c) throw new BizError('课程不存在', 404);
    c.sessionPricing = db.prepare('SELECT * FROM course_session_pricing WHERE course_id = ? ORDER BY sort_order').all(c.id);
    c.monthlyPricing = db.prepare('SELECT * FROM course_monthly_pricing WHERE course_id = ? ORDER BY sort_order').all(c.id);
    res.json(success(c));
  } catch (e) { next(e); }
});

// 新增课程
router.post('/', authRole(['admin']), (req, res, next) => {
  try {
    const { name, businessType, audience, durationMin, standardPrice } = req.body || {};
    if (!name || !businessType) throw new BizError('课程名称和业务类型必填');
    if (!BUSINESS_TYPE_CODES.includes(businessType)) throw new BizError('无效业务类型');
    if (audience && !AUDIENCE_TYPES.find((a) => a.code === audience)) throw new BizError('无效适用对象');
    const db = getDb();
    const id = uuid();
    db.prepare(`INSERT INTO courses (id, name, business_type, audience, duration_min, standard_price, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
      .run(id, name, businessType, audience || 'ANY', durationMin || 60, standardPrice || 0, now(), now());
    writeAudit({ entity: 'course', entityId: id, action: AUDIT_ACTIONS.CREATE, operator: operatorFromReq(req), detail: req.body });
    res.status(201).json(success(db.prepare('SELECT * FROM courses WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

// 编辑课程
router.put('/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const c = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!c) throw new BizError('课程不存在', 404);
    const { name, audience, durationMin, standardPrice, status } = req.body || {};
    const updates = {};
    if (name) updates.name = name;
    if (audience) updates.audience = audience;
    if (durationMin !== undefined) updates.duration_min = durationMin;
    if (standardPrice !== undefined) updates.standard_price = standardPrice;
    if (status) updates.status = status;
    if (Object.keys(updates).length === 0) return res.json(success(c));
    const sets = Object.keys(updates).map((k) => `${k === 'durationMin' ? 'duration_min' : k === 'standardPrice' ? 'standard_price' : k} = ?`).join(', ');
    db.prepare(`UPDATE courses SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(updates), now(), c.id);
    writeAudit({ entity: 'course', entityId: c.id, action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: updates });
    res.json(success(db.prepare('SELECT * FROM courses WHERE id = ?').get(c.id)));
  } catch (e) { next(e); }
});

// 次卡定价档位 CRUD
router.post('/:id/session-pricing', authRole(['admin']), (req, res, next) => {
  try {
    const { sessions, price, giftSessions, sortOrder } = req.body || {};
    if (!sessions || price === undefined) throw new BizError('节数和价格必填');
    const db = getDb();
    const id = uuid();
    db.prepare(`INSERT INTO course_session_pricing (id, course_id, sessions, price, gift_sessions, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
      .run(id, req.params.id, sessions, price, giftSessions || 0, sortOrder || 0, now(), now());
    res.status(201).json(success(db.prepare('SELECT * FROM course_session_pricing WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

router.put('/:id/session-pricing/:pid', authRole(['admin']), (req, res, next) => {
  try {
    const { sessions, price, giftSessions, sortOrder, status } = req.body || {};
    const db = getDb();
    const p = db.prepare('SELECT * FROM course_session_pricing WHERE id = ? AND course_id = ?').get(req.params.pid, req.params.id);
    if (!p) throw new BizError('定价档位不存在', 404);
    const updates = {};
    if (sessions !== undefined) updates.sessions = sessions;
    if (price !== undefined) updates.price = price;
    if (giftSessions !== undefined) updates.gift_sessions = giftSessions;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (status) updates.status = status;
    if (Object.keys(updates).length === 0) return res.json(success(p));
    const sets = Object.keys(updates).map((k) => `${k === 'giftSessions' ? 'gift_sessions' : k === 'sortOrder' ? 'sort_order' : k} = ?`).join(', ');
    db.prepare(`UPDATE course_session_pricing SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(updates), now(), p.id);
    res.json(success(db.prepare('SELECT * FROM course_session_pricing WHERE id = ?').get(p.id)));
  } catch (e) { next(e); }
});

router.delete('/:id/session-pricing/:pid', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE course_session_pricing SET status = ? WHERE id = ?').run('DISABLED', req.params.pid);
    res.json(success({ deleted: true }));
  } catch (e) { next(e); }
});

// 月卡定价 CRUD
router.post('/:id/monthly-pricing', authRole(['admin']), (req, res, next) => {
  try {
    const { monthlyFee, weeklyFrequency, monthlyQuota, sortOrder } = req.body || {};
    if (monthlyFee === undefined || !weeklyFrequency || !monthlyQuota) throw new BizError('月费、周频次、月额度必填');
    const db = getDb();
    const id = uuid();
    db.prepare(`INSERT INTO course_monthly_pricing (id, course_id, monthly_fee, weekly_frequency, monthly_quota, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
      .run(id, req.params.id, monthlyFee, weeklyFrequency, monthlyQuota, sortOrder || 0, now(), now());
    res.status(201).json(success(db.prepare('SELECT * FROM course_monthly_pricing WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

router.put('/:id/monthly-pricing/:pid', authRole(['admin']), (req, res, next) => {
  try {
    const { monthlyFee, weeklyFrequency, monthlyQuota, sortOrder, status } = req.body || {};
    const db = getDb();
    const p = db.prepare('SELECT * FROM course_monthly_pricing WHERE id = ? AND course_id = ?').get(req.params.pid, req.params.id);
    if (!p) throw new BizError('月卡定价不存在', 404);
    const updates = {};
    if (monthlyFee !== undefined) updates.monthly_fee = monthlyFee;
    if (weeklyFrequency !== undefined) updates.weekly_frequency = weeklyFrequency;
    if (monthlyQuota !== undefined) updates.monthly_quota = monthlyQuota;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (status) updates.status = status;
    if (Object.keys(updates).length === 0) return res.json(success(p));
    const sets = Object.keys(updates).map((k) => `${k === 'monthlyFee' ? 'monthly_fee' : k === 'weeklyFrequency' ? 'weekly_frequency' : k === 'monthlyQuota' ? 'monthly_quota' : k === 'sortOrder' ? 'sort_order' : k} = ?`).join(', ');
    db.prepare(`UPDATE course_monthly_pricing SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(updates), now(), p.id);
    res.json(success(db.prepare('SELECT * FROM course_monthly_pricing WHERE id = ?').get(p.id)));
  } catch (e) { next(e); }
});

router.delete('/:id/monthly-pricing/:pid', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE course_monthly_pricing SET status = ? WHERE id = ?').run('DISABLED', req.params.pid);
    res.json(success({ deleted: true }));
  } catch (e) { next(e); }
});

// ============ 预存赠送规则 ============
router.get('/prepaid-rules/list', authRole(['admin', 'sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const list = db.prepare("SELECT * FROM prepaid_rules WHERE status = 'ACTIVE' ORDER BY deposit_amount").all();
    res.json(success(list));
  } catch (e) { next(e); }
});

router.post('/prepaid-rules', authRole(['admin']), (req, res, next) => {
  try {
    const { depositAmount, giftAmount, sortOrder } = req.body || {};
    if (!depositAmount || giftAmount === undefined) throw new BizError('预存金额和赠送金额必填');
    const db = getDb();
    const id = uuid();
    db.prepare(`INSERT INTO prepaid_rules (id, deposit_amount, gift_amount, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`)
      .run(id, depositAmount, giftAmount, sortOrder || 0, now(), now());
    res.status(201).json(success(db.prepare('SELECT * FROM prepaid_rules WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

router.put('/prepaid-rules/:id', authRole(['admin']), (req, res, next) => {
  try {
    const { depositAmount, giftAmount, sortOrder, status } = req.body || {};
    const db = getDb();
    const r = db.prepare('SELECT * FROM prepaid_rules WHERE id = ?').get(req.params.id);
    if (!r) throw new BizError('规则不存在', 404);
    const updates = {};
    if (depositAmount !== undefined) updates.deposit_amount = depositAmount;
    if (giftAmount !== undefined) updates.gift_amount = giftAmount;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (status) updates.status = status;
    if (Object.keys(updates).length === 0) return res.json(success(r));
    const sets = Object.keys(updates).map((k) => `${k === 'depositAmount' ? 'deposit_amount' : k === 'giftAmount' ? 'gift_amount' : k === 'sortOrder' ? 'sort_order' : k} = ?`).join(', ');
    db.prepare(`UPDATE prepaid_rules SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(updates), now(), r.id);
    res.json(success(db.prepare('SELECT * FROM prepaid_rules WHERE id = ?').get(r.id)));
  } catch (e) { next(e); }
});

router.delete('/prepaid-rules/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE prepaid_rules SET status = ? WHERE id = ?').run('DISABLED', req.params.id);
    res.json(success({ deleted: true }));
  } catch (e) { next(e); }
});

// ============ 折扣规则 ============
router.get('/discount-rules/list', authRole(['admin', 'sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const list = db.prepare("SELECT * FROM discount_rules WHERE status = 'ACTIVE' ORDER BY created_at DESC").all();
    res.json(success(list));
  } catch (e) { next(e); }
});

router.post('/discount-rules', authRole(['admin']), (req, res, next) => {
  try {
    const { name, businessType, courseId, discountType, discountValue, target, startDate, endDate } = req.body || {};
    if (!name || !discountType || discountValue === undefined) throw new BizError('名称、折扣类型、折扣值必填');
    if (!['RATE', 'FIXED'].includes(discountType)) throw new BizError('无效折扣类型');
    const db = getDb();
    const id = uuid();
    db.prepare(`INSERT INTO discount_rules (id, name, business_type, course_id, discount_type, discount_value, target, start_date, end_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
      .run(id, name, businessType || null, courseId || null, discountType, discountValue, target || 'ALL', startDate || null, endDate || null, now(), now());
    res.status(201).json(success(db.prepare('SELECT * FROM discount_rules WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

router.put('/discount-rules/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const r = db.prepare('SELECT * FROM discount_rules WHERE id = ?').get(req.params.id);
    if (!r) throw new BizError('折扣规则不存在', 404);
    const { name, businessType, courseId, discountType, discountValue, target, startDate, endDate, status } = req.body || {};
    const updates = {};
    if (name) updates.name = name;
    if (businessType !== undefined) updates.business_type = businessType;
    if (courseId !== undefined) updates.course_id = courseId;
    if (discountType) updates.discount_type = discountType;
    if (discountValue !== undefined) updates.discount_value = discountValue;
    if (target) updates.target = target;
    if (startDate !== undefined) updates.start_date = startDate;
    if (endDate !== undefined) updates.end_date = endDate;
    if (status) updates.status = status;
    if (Object.keys(updates).length === 0) return res.json(success(r));
    const sets = Object.keys(updates).map((k) => `${k === 'businessType' ? 'business_type' : k === 'courseId' ? 'course_id' : k === 'discountType' ? 'discount_type' : k === 'discountValue' ? 'discount_value' : k === 'startDate' ? 'start_date' : k === 'endDate' ? 'end_date' : k} = ?`).join(', ');
    db.prepare(`UPDATE discount_rules SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(updates), now(), r.id);
    res.json(success(db.prepare('SELECT * FROM discount_rules WHERE id = ?').get(r.id)));
  } catch (e) { next(e); }
});

router.delete('/discount-rules/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE discount_rules SET status = ? WHERE id = ?').run('DISABLED', req.params.id);
    res.json(success({ deleted: true }));
  } catch (e) { next(e); }
});

export default router;
