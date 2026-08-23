// 提成设置路由（COM-001~006）
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, uuid, now, formatDate } from '../utils/helpers.js';
import { writeAudit, operatorFromReq } from '../services/audit.js';
import { BUSINESS_TYPE_CODES, COMMISSION_TYPES, AUDIT_ACTIONS } from '../../../shared/constants.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 销售提成规则列表（业务类型 × 新客/续费 矩阵）
router.get('/rules', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const list = db.prepare('SELECT * FROM commission_rules ORDER BY business_type, commission_type').all();
    // 构建矩阵
    const matrix = {};
    for (const bt of BUSINESS_TYPE_CODES) {
      matrix[bt] = {};
      for (const ct of [COMMISSION_TYPES.NEW, COMMISSION_TYPES.RENEW]) {
        const r = list.find((x) => x.business_type === bt && x.commission_type === ct);
        matrix[bt][ct] = r ? r.rate : 0;
      }
    }
    res.json(success({ list, matrix }));
  } catch (e) { next(e); }
});

// 设置销售提成比例
router.put('/rules', authRole(['admin']), (req, res, next) => {
  try {
    const { rules } = req.body || {};
    if (!Array.isArray(rules)) throw new BizError('rules 必须为数组');
    const db = getDb();
    for (const r of rules) {
      if (!BUSINESS_TYPE_CODES.includes(r.businessType)) continue;
      if (![COMMISSION_TYPES.NEW, COMMISSION_TYPES.RENEW].includes(r.commissionType)) continue;
      db.prepare(`INSERT INTO commission_rules (id, business_type, commission_type, rate, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
        ON CONFLICT(business_type, commission_type) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at`)
        .run(uuid(), r.businessType, r.commissionType, r.rate || 0, now(), now());
    }
    writeAudit({ entity: 'commission', entityId: 'rules', action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: { rules } });
    res.json(success({ updated: true }));
  } catch (e) { next(e); }
});

// 提成记录查询
router.get('/records', authRole(['admin', 'sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate, beneficiaryId, beneficiaryType, status } = req.query;
    const where = [];
    const params = [];
    if (startDate) { where.push('cr.created_at >= ?'); params.push(startDate + ' 00:00:00'); }
    if (endDate) { where.push('cr.created_at <= ?'); params.push(endDate + ' 23:59:59'); }
    if (beneficiaryId) { where.push('cr.beneficiary_id = ?'); params.push(beneficiaryId); }
    if (beneficiaryType) { where.push('cr.beneficiary_type = ?'); params.push(beneficiaryType); }
    if (status) { where.push('cr.status = ?'); params.push(status); }
    // 销售/教练只看本人
    if (req.user.role === 'sales' || req.user.role === 'coach') {
      where.push('cr.beneficiary_id = ?');
      params.push(req.user.id);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const list = db.prepare(`
      SELECT cr.*, o.order_no, o.member_id, m.name as member_name, o.business_type, o.amount as order_amount
      FROM commission_records cr
      LEFT JOIN orders o ON cr.order_id = o.id
      LEFT JOIN members m ON o.member_id = m.id
      ${whereSql} ORDER BY cr.created_at DESC
    `).all(...params);
    const total = list.reduce((s, r) => s + (r.status === 'ACTIVE' ? r.amount : 0), 0);
    res.json(success({ list, total }));
  } catch (e) { next(e); }
});

// 我的提成（销售/教练）
router.get('/mine', authRole(['sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate } = req.query;
    const start = startDate || formatDate().slice(0, 8) + '01';
    const end = endDate || formatDate();
    const list = db.prepare(`
      SELECT cr.*, o.order_no, m.name as member_name, o.business_type, o.amount as order_amount
      FROM commission_records cr
      LEFT JOIN orders o ON cr.order_id = o.id
      LEFT JOIN members m ON o.member_id = m.id
      WHERE cr.beneficiary_id = ? AND cr.status = 'ACTIVE' AND cr.created_at >= ? AND cr.created_at <= ?
      ORDER BY cr.created_at DESC
    `).all(req.user.id, start + ' 00:00:00', end + ' 23:59:59');
    const salesCommissionTotal = list.reduce((s, r) => s + r.amount, 0);
    const orderCount = list.length;
    const orderAmount = list.reduce((s, r) => s + r.order_amount, 0);

    // 教练还需统计课时费 + 分成（按时间范围过滤）
    let lessonFeeTotal = 0;
    let shareTotal = 0;
    let sessionCount = 0;
    if (req.user.role === 'coach') {
      const attStats = db.prepare(`
        SELECT COALESCE(SUM(a.lesson_fee),0) as lesson_fee, COALESCE(SUM(a.share_amount),0) as share_amount, COUNT(*) as cnt
        FROM attendance a
        JOIN sessions s ON a.session_id = s.id
        WHERE a.coach_id = ? AND a.status = 'PRESENT' AND s.date >= ? AND s.date <= ?
      `).get(req.user.id, start, end);
      lessonFeeTotal = attStats.lesson_fee;
      shareTotal = attStats.share_amount;
      sessionCount = attStats.cnt;
    }

    const earned = salesCommissionTotal + lessonFeeTotal + shareTotal;

    // 已发放金额
    const paidOut = db.prepare(`
      SELECT COALESCE(SUM(amount),0) as total FROM commission_payouts
      WHERE beneficiary_id = ? AND status = 'PAID'
    `).get(req.user.id).total;

    // 发放记录
    const payouts = db.prepare(`
      SELECT * FROM commission_payouts WHERE beneficiary_id = ? AND status = 'PAID' ORDER BY created_at DESC LIMIT 50
    `).all(req.user.id);

    res.json(success({
      list, total: earned, orderCount, orderAmount,
      salesCommission: salesCommissionTotal,
      lessonFee: lessonFeeTotal,
      shareAmount: shareTotal,
      sessionCount,
      paidOut, payable: earned - paidOut, payouts,
      startDate: start, endDate: end,
    }));
  } catch (e) { next(e); }
});

// ============ 提成发放（管理员） ============

// 提成发放统计（按人汇总）— 支持 sales / coach
router.get('/payout-summary', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { type } = req.query; // sales / coach
    if (type === 'sales') {
      // 销售提成：来自 commission_records
      const rows = db.prepare(`
        SELECT s.id, s.name, s.phone, s.status,
          COALESCE(cr.earned, 0) as earned,
          COALESCE(cp.paid, 0) as paid,
          COALESCE(cr.earned, 0) - COALESCE(cp.paid, 0) as payable,
          COALESCE(cr.record_count, 0) as record_count
        FROM sales s
        LEFT JOIN (SELECT beneficiary_id, SUM(amount) as earned, COUNT(*) as record_count
          FROM commission_records WHERE status='ACTIVE' AND beneficiary_type='sales' GROUP BY beneficiary_id) cr
          ON cr.beneficiary_id = s.id
        LEFT JOIN (SELECT beneficiary_id, SUM(amount) as paid
          FROM commission_payouts WHERE status='PAID' AND beneficiary_type='sales' GROUP BY beneficiary_id) cp
          ON cp.beneficiary_id = s.id
        ORDER BY payable DESC
      `).all();
      res.json(success({ list: rows }));
    } else if (type === 'coach') {
      // 教练提成：来自 attendance 的 lesson_fee + share_amount + commission_records（销售提成如果教练也是销售）
      const rows = db.prepare(`
        SELECT c.id, c.name, c.phone, c.status,
          COALESCE(att.lesson_total, 0) + COALESCE(att.share_total, 0) + COALESCE(cr.earned, 0) as earned,
          COALESCE(cp.paid, 0) as paid,
          COALESCE(att.lesson_total, 0) + COALESCE(att.share_total, 0) + COALESCE(cr.earned, 0) - COALESCE(cp.paid, 0) as payable,
          COALESCE(att.session_count, 0) as session_count,
          COALESCE(att.lesson_total, 0) as lesson_total,
          COALESCE(att.share_total, 0) as share_total,
          COALESCE(cr.earned, 0) as sales_commission
        FROM coaches c
        LEFT JOIN (SELECT coach_id, SUM(lesson_fee) as lesson_total, SUM(share_amount) as share_total, COUNT(*) as session_count
          FROM attendance WHERE status='PRESENT' GROUP BY coach_id) att
          ON att.coach_id = c.id
        LEFT JOIN (SELECT beneficiary_id, SUM(amount) as earned
          FROM commission_records WHERE status='ACTIVE' AND beneficiary_type='coach' GROUP BY beneficiary_id) cr
          ON cr.beneficiary_id = c.id
        LEFT JOIN (SELECT beneficiary_id, SUM(amount) as paid
          FROM commission_payouts WHERE status='PAID' AND beneficiary_type='coach' GROUP BY beneficiary_id) cp
          ON cp.beneficiary_id = c.id
        ORDER BY payable DESC
      `).all();
      res.json(success({ list: rows }));
    } else {
      throw new BizError('type 参数必须为 sales 或 coach');
    }
  } catch (e) { next(e); }
});

// 发放提成
router.post('/payouts', authRole(['admin']), (req, res, next) => {
  try {
    const { beneficiaryId, beneficiaryType, amount, note } = req.body || {};
    if (!beneficiaryId || !beneficiaryType) throw new BizError('受益人必填');
    if (!amount || amount <= 0) throw new BizError('发放金额必须大于0');
    if (!['sales', 'coach'].includes(beneficiaryType)) throw new BizError('受益人类型无效');

    const db = getDb();
    // 查受益人姓名
    let name = '';
    if (beneficiaryType === 'sales') {
      const s = db.prepare('SELECT name FROM sales WHERE id = ?').get(beneficiaryId);
      if (!s) throw new BizError('销售不存在', 404);
      name = s.name;
    } else {
      const c = db.prepare('SELECT name FROM coaches WHERE id = ?').get(beneficiaryId);
      if (!c) throw new BizError('教练不存在', 404);
      name = c.name;
    }

    // 查可发放余额
    let earned = 0;
    if (beneficiaryType === 'sales') {
      earned = db.prepare("SELECT COALESCE(SUM(amount),0) as v FROM commission_records WHERE beneficiary_id=? AND status='ACTIVE' AND beneficiary_type='sales'").get(beneficiaryId).v;
    } else {
      const att = db.prepare("SELECT COALESCE(SUM(lesson_fee),0)+COALESCE(SUM(share_amount),0) as v FROM attendance WHERE coach_id=? AND status='PRESENT'").get(beneficiaryId);
      const cr = db.prepare("SELECT COALESCE(SUM(amount),0) as v FROM commission_records WHERE beneficiary_id=? AND status='ACTIVE' AND beneficiary_type='coach'").get(beneficiaryId);
      earned = att.v + cr.v;
    }
    const paid = db.prepare("SELECT COALESCE(SUM(amount),0) as v FROM commission_payouts WHERE beneficiary_id=? AND status='PAID' AND beneficiary_type=?").get(beneficiaryId, beneficiaryType).v;
    const payable = earned - paid;
    if (amount > payable) throw new BizError(`发放金额超过可发放余额（可发放: ￥${payable}）`);

    const id = uuid();
    const operator = operatorFromReq(req);
    db.prepare(`INSERT INTO commission_payouts (id, beneficiary_id, beneficiary_type, beneficiary_name, amount, note, operator_id, operator_name, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?)`)
      .run(id, beneficiaryId, beneficiaryType, name, amount, note || null, operator.id, operator.name, now());

    writeAudit({ entity: 'commission_payout', entityId: id, action: AUDIT_ACTIONS.CREATE, operator, detail: { beneficiaryId, beneficiaryType, amount, note } });
    res.status(201).json(success({ id, beneficiaryId, beneficiaryType, beneficiaryName: name, amount, payable: payable - amount }, '发放成功'));
  } catch (e) { next(e); }
});

// 发放记录查询
router.get('/payouts', authRole(['admin', 'sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const { beneficiaryId, beneficiaryType, startDate, endDate } = req.query;
    const where = [];
    const params = [];
    if (beneficiaryId) { where.push('p.beneficiary_id = ?'); params.push(beneficiaryId); }
    if (beneficiaryType) { where.push('p.beneficiary_type = ?'); params.push(beneficiaryType); }
    if (startDate) { where.push('p.created_at >= ?'); params.push(startDate + ' 00:00:00'); }
    if (endDate) { where.push('p.created_at <= ?'); params.push(endDate + ' 23:59:59'); }
    // 销售/教练只看本人
    if (req.user.role === 'sales' || req.user.role === 'coach') {
      where.push('p.beneficiary_id = ?');
      params.push(req.user.id);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const list = db.prepare(`
      SELECT p.* FROM commission_payouts p ${whereSql} ORDER BY p.created_at DESC
    `).all(...params);
    const total = list.reduce((s, r) => s + r.amount, 0);
    res.json(success({ list, total }));
  } catch (e) { next(e); }
});

export default router;
