// 提成设置路由（COM-001~006）
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, uuid, now } from '../utils/helpers.js';
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
    const start = startDate || new Date().toISOString().slice(0, 8) + '01';
    const end = endDate || new Date().toISOString().slice(0, 10);
    const list = db.prepare(`
      SELECT cr.*, o.order_no, m.name as member_name, o.business_type, o.amount as order_amount
      FROM commission_records cr
      LEFT JOIN orders o ON cr.order_id = o.id
      LEFT JOIN members m ON o.member_id = m.id
      WHERE cr.beneficiary_id = ? AND cr.status = 'ACTIVE' AND cr.created_at >= ? AND cr.created_at <= ?
      ORDER BY cr.created_at DESC
    `).all(req.user.id, start + ' 00:00:00', end + ' 23:59:59');
    const total = list.reduce((s, r) => s + r.amount, 0);
    const orderCount = list.length;
    const orderAmount = list.reduce((s, r) => s + r.order_amount, 0);
    res.json(success({ list, total, orderCount, orderAmount, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

export default router;
