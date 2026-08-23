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

// 删除课程（软删除：置为 INACTIVE，会员端自动不显示，历史数据保留）
router.delete('/:id', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const c = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!c) throw new BizError('课程不存在', 404);
    // 检查是否有关联有效课包且有剩余课时（有会员持有未消完的课包时不允许删除）
    const packCount = db.prepare("SELECT COUNT(*) as cnt FROM packs WHERE course_id = ? AND status = 'ACTIVE' AND valid_until >= date('now') AND remaining_sessions > 0").get(c.id).cnt;
    if (packCount > 0) throw new BizError(`该课程有 ${packCount} 个有效课包未消完，无法删除，请等会员消完后再操作`);
    // 软删除课程
    db.prepare("UPDATE courses SET status = 'INACTIVE', updated_at = ? WHERE id = ?").run(now(), c.id);
    // 定价档位也置为停用
    db.prepare("UPDATE course_session_pricing SET status = 'INACTIVE', updated_at = ? WHERE course_id = ? AND status = 'ACTIVE'").run(now(), c.id);
    db.prepare("UPDATE course_monthly_pricing SET status = 'INACTIVE', updated_at = ? WHERE course_id = ? AND status = 'ACTIVE'").run(now(), c.id);
    // 关联的未开始课次也取消
    db.prepare("UPDATE sessions SET status = 'CANCELLED', updated_at = ? WHERE course_id = ? AND status = 'SCHEDULED'").run(now(), c.id);
    writeAudit({ entity: 'course', entityId: c.id, action: AUDIT_ACTIONS.DELETE, operator: operatorFromReq(req), detail: { name: c.name, action: 'soft-delete' } });
    res.json(success({ deleted: true }));
  } catch (e) { next(e); }
});

// 停课（置为 INACTIVE，不检查课包，已有课包和排课保留，会员端不再显示该课程）
router.put('/:id/suspend', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const c = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!c) throw new BizError('课程不存在', 404);
    if (c.status === 'INACTIVE') throw new BizError('课程已停用');
    db.prepare("UPDATE courses SET status = 'INACTIVE', updated_at = ? WHERE id = ?").run(now(), c.id);
    db.prepare("UPDATE course_session_pricing SET status = 'INACTIVE', updated_at = ? WHERE course_id = ? AND status = 'ACTIVE'").run(now(), c.id);
    db.prepare("UPDATE course_monthly_pricing SET status = 'INACTIVE', updated_at = ? WHERE course_id = ? AND status = 'ACTIVE'").run(now(), c.id);
    writeAudit({ entity: 'course', entityId: c.id, action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: { action: 'suspend' } });
    res.json(success(db.prepare('SELECT * FROM courses WHERE id = ?').get(c.id)));
  } catch (e) { next(e); }
});

// 恢复课程（从 INACTIVE 恢复为 ACTIVE）
router.put('/:id/restore', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const c = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!c) throw new BizError('课程不存在', 404);
    db.prepare("UPDATE courses SET status = 'ACTIVE', updated_at = ? WHERE id = ?").run(now(), c.id);
    db.prepare("UPDATE course_session_pricing SET status = 'ACTIVE', updated_at = ? WHERE course_id = ? AND status = 'INACTIVE'").run(now(), c.id);
    db.prepare("UPDATE course_monthly_pricing SET status = 'ACTIVE', updated_at = ? WHERE course_id = ? AND status = 'INACTIVE'").run(now(), c.id);
    writeAudit({ entity: 'course', entityId: c.id, action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: { action: 'restore' } });
    res.json(success(db.prepare('SELECT * FROM courses WHERE id = ?').get(c.id)));
  } catch (e) { next(e); }
});

// 次卡定价档位 CRUD
router.post('/:id/session-pricing', authRole(['admin']), (req, res, next) => {
  try {
    const { sessions, price, giftSessions, extraGiftBusinessType, extraGiftSessions, sortOrder } = req.body || {};
    if (!sessions || price === undefined) throw new BizError('节数和价格必填');
    if (extraGiftBusinessType && !BUSINESS_TYPE_CODES.includes(extraGiftBusinessType)) throw new BizError('无效额外赠送业务类型');
    const db = getDb();
    const id = uuid();
    db.prepare(`INSERT INTO course_session_pricing (id, course_id, sessions, price, gift_sessions, extra_gift_business_type, extra_gift_sessions, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
      .run(id, req.params.id, sessions, price, giftSessions || 0, extraGiftBusinessType || null, extraGiftSessions || 0, sortOrder || 0, now(), now());
    res.status(201).json(success(db.prepare('SELECT * FROM course_session_pricing WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

router.put('/:id/session-pricing/:pid', authRole(['admin']), (req, res, next) => {
  try {
    const { sessions, price, giftSessions, extraGiftBusinessType, extraGiftSessions, sortOrder, status } = req.body || {};
    const db = getDb();
    const p = db.prepare('SELECT * FROM course_session_pricing WHERE id = ? AND course_id = ?').get(req.params.pid, req.params.id);
    if (!p) throw new BizError('定价档位不存在', 404);
    if (extraGiftBusinessType && !BUSINESS_TYPE_CODES.includes(extraGiftBusinessType)) throw new BizError('无效额外赠送业务类型');
    const updates = {};
    if (sessions !== undefined) updates.sessions = sessions;
    if (price !== undefined) updates.price = price;
    if (giftSessions !== undefined) updates.gift_sessions = giftSessions;
    if (extraGiftBusinessType !== undefined) updates.extra_gift_business_type = extraGiftBusinessType || null;
    if (extraGiftSessions !== undefined) updates.extra_gift_sessions = extraGiftSessions || 0;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (status) updates.status = status;
    if (Object.keys(updates).length === 0) return res.json(success(p));
    const colMap = { giftSessions: 'gift_sessions', sortOrder: 'sort_order', extraGiftBusinessType: 'extra_gift_business_type', extraGiftSessions: 'extra_gift_sessions' };
    const sets = Object.keys(updates).map((k) => `${colMap[k] || k} = ?`).join(', ');
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
    const { monthlyFee, weeklyFrequency, monthlyQuota, extraGiftBusinessType, extraGiftSessions, sortOrder } = req.body || {};
    if (monthlyFee === undefined || !weeklyFrequency || !monthlyQuota) throw new BizError('月费、周频次、月额度必填');
    if (extraGiftBusinessType && !BUSINESS_TYPE_CODES.includes(extraGiftBusinessType)) throw new BizError('无效额外赠送业务类型');
    const db = getDb();
    const id = uuid();
    db.prepare(`INSERT INTO course_monthly_pricing (id, course_id, monthly_fee, weekly_frequency, monthly_quota, extra_gift_business_type, extra_gift_sessions, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`)
      .run(id, req.params.id, monthlyFee, weeklyFrequency, monthlyQuota, extraGiftBusinessType || null, extraGiftSessions || 0, sortOrder || 0, now(), now());
    res.status(201).json(success(db.prepare('SELECT * FROM course_monthly_pricing WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

router.put('/:id/monthly-pricing/:pid', authRole(['admin']), (req, res, next) => {
  try {
    const { monthlyFee, weeklyFrequency, monthlyQuota, extraGiftBusinessType, extraGiftSessions, sortOrder, status } = req.body || {};
    const db = getDb();
    const p = db.prepare('SELECT * FROM course_monthly_pricing WHERE id = ? AND course_id = ?').get(req.params.pid, req.params.id);
    if (!p) throw new BizError('月卡定价不存在', 404);
    if (extraGiftBusinessType && !BUSINESS_TYPE_CODES.includes(extraGiftBusinessType)) throw new BizError('无效额外赠送业务类型');
    const updates = {};
    if (monthlyFee !== undefined) updates.monthly_fee = monthlyFee;
    if (weeklyFrequency !== undefined) updates.weekly_frequency = weeklyFrequency;
    if (monthlyQuota !== undefined) updates.monthly_quota = monthlyQuota;
    if (extraGiftBusinessType !== undefined) updates.extra_gift_business_type = extraGiftBusinessType || null;
    if (extraGiftSessions !== undefined) updates.extra_gift_sessions = extraGiftSessions || 0;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (status) updates.status = status;
    if (Object.keys(updates).length === 0) return res.json(success(p));
    const colMap = { monthlyFee: 'monthly_fee', weeklyFrequency: 'weekly_frequency', monthlyQuota: 'monthly_quota', sortOrder: 'sort_order', extraGiftBusinessType: 'extra_gift_business_type', extraGiftSessions: 'extra_gift_sessions' };
    const sets = Object.keys(updates).map((k) => `${colMap[k] || k} = ?`).join(', ');
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
