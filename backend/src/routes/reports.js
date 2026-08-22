// 统计报表路由（RPT-001~006）
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, formatDate } from '../utils/helpers.js';
import { BUSINESS_TYPES } from '../../../shared/constants.js';

const router = Router();

// 教练上课统计报表（RPT-001）
router.get('/coach', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate, coachId, businessType } = req.query;
    const start = startDate || formatDate().slice(0, 8) + '01';
    const end = endDate || formatDate();
    const where = [`s.date >= ?`, `s.date <= ?`, `a.status = 'PRESENT'`];
    const params = [start, end];
    if (coachId) { where.push('a.coach_id = ?'); params.push(coachId); }
    if (businessType) { where.push('s.business_type = ?'); params.push(businessType); }
    const whereSql = where.join(' AND ');
    const list = db.prepare(`
      SELECT co.id as coach_id, co.name as coach_name, s.business_type,
        COUNT(*) as sessions, SUM(a.lesson_fee) as lesson_fee, SUM(a.share_amount) as share_amount
      FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      JOIN coaches co ON a.coach_id = co.id
      WHERE ${whereSql}
      GROUP BY co.id, s.business_type
      ORDER BY co.name, s.business_type
    `).all(...params);
    res.json(success({ list, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

// 销售业绩统计报表（RPT-002）
router.get('/sales', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate, salesId, businessType } = req.query;
    const start = startDate || formatDate().slice(0, 8) + '01';
    const end = endDate || formatDate();
    const where = [`o.created_at >= ?`, `o.created_at <= ?`, `o.status = 'PAID'`];
    const params = [start + ' 00:00:00', end + ' 23:59:59'];
    if (salesId) { where.push('o.sales_id = ?'); params.push(salesId); }
    if (businessType) { where.push('o.business_type = ?'); params.push(businessType); }
    const whereSql = where.join(' AND ');
    const list = db.prepare(`
      SELECT o.sales_id, o.sales_name, o.sales_type, o.business_type,
        COUNT(*) as order_count, SUM(o.amount) as total_amount, SUM(o.commission_amount) as commission
      FROM orders o
      WHERE ${whereSql}
      GROUP BY o.sales_id, o.business_type
      ORDER BY o.sales_name, o.business_type
    `).all(...params);
    res.json(success({ list, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

// 会员课消报表（RPT-003）
router.get('/consumption', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate, memberId, businessType } = req.query;
    const start = startDate || formatDate().slice(0, 8) + '01';
    const end = endDate || formatDate();
    const where = [`s.date >= ?`, `s.date <= ?`, `a.status IN ('PRESENT', 'PENDING_PAY')`];
    const params = [start, end];
    if (memberId) { where.push('a.member_id = ?'); params.push(memberId); }
    if (businessType) { where.push('s.business_type = ?'); params.push(businessType); }
    const whereSql = where.join(' AND ');
    const list = db.prepare(`
      SELECT a.member_id, m.name as member_name, s.business_type,
        COUNT(*) as consumed_sessions,
        SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'PENDING_PAY' THEN 1 ELSE 0 END) as pending_count
      FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      LEFT JOIN members m ON a.member_id = m.id
      WHERE ${whereSql}
      GROUP BY a.member_id, s.business_type
      ORDER BY m.name
    `).all(...params);
    // 附带剩余资产
    for (const item of list) {
      item.remainingPacks = db.prepare("SELECT id, pack_type, remaining_sessions, monthly_remaining, valid_until, status FROM packs WHERE member_id = ? AND status = 'ACTIVE'").all(item.member_id);
      const prepaid = db.prepare('SELECT total_balance, principal_balance, gift_balance FROM prepaid_accounts WHERE member_id = ?').get(item.member_id);
      item.prepaid = prepaid || { total_balance: 0, principal_balance: 0, gift_balance: 0 };
    }
    res.json(success({ list, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

// 渠道获客统计报表（RPT-006）
router.get('/channel', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate } = req.query;
    const start = startDate || formatDate().slice(0, 8) + '01';
    const end = endDate || formatDate();
    const channels = db.prepare("SELECT * FROM channels WHERE level = 1 ORDER BY sort_order").all();
    const result = [];
    for (const ch of channels) {
      // 通过审计日志关联会员
      const memberIds = db.prepare(`SELECT DISTINCT entity_id FROM audit_logs WHERE entity='member' AND action='CHANNEL_ASSIGN' AND json_extract(detail, '$.channelId') = ?`).all(ch.id).map((r) => r.entity_id);
      let newMembers = 0, orderAmount = 0, renewAmount = 0;
      if (memberIds.length > 0) {
        const placeholders = memberIds.map(() => '?').join(',');
        newMembers = db.prepare(`SELECT COUNT(*) as cnt FROM members WHERE id IN (${placeholders}) AND created_at >= ? AND created_at <= ?`).get(...memberIds, start + ' 00:00:00', end + ' 23:59:59').cnt;
        orderAmount = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE member_id IN (${placeholders}) AND status='PAID' AND created_at >= ? AND created_at <= ?`).get(...memberIds, start + ' 00:00:00', end + ' 23:59:59').total;
        renewAmount = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE member_id IN (${placeholders}) AND status='PAID' AND commission_type='RENEW' AND created_at >= ? AND created_at <= ?`).get(...memberIds, start + ' 00:00:00', end + ' 23:59:59').total;
      }
      // 二级下钻
      const subs = db.prepare('SELECT * FROM channels WHERE parent_id = ? AND level = 2 ORDER BY sort_order').all(ch.id);
      const subResult = subs.map((sub) => {
        const subMemberIds = db.prepare(`SELECT DISTINCT entity_id FROM audit_logs WHERE entity='member' AND action='CHANNEL_ASSIGN' AND json_extract(detail, '$.subChannelId') = ?`).all(sub.id).map((r) => r.entity_id);
        let sNew = 0, sOrder = 0, sRenew = 0;
        if (subMemberIds.length > 0) {
          const p = subMemberIds.map(() => '?').join(',');
          sNew = db.prepare(`SELECT COUNT(*) as cnt FROM members WHERE id IN (${p}) AND created_at >= ? AND created_at <= ?`).get(...subMemberIds, start + ' 00:00:00', end + ' 23:59:59').cnt;
          sOrder = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE member_id IN (${p}) AND status='PAID' AND created_at >= ? AND created_at <= ?`).get(...subMemberIds, start + ' 00:00:00', end + ' 23:59:59').total;
          sRenew = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE member_id IN (${p}) AND status='PAID' AND commission_type='RENEW' AND created_at >= ? AND created_at <= ?`).get(...subMemberIds, start + ' 00:00:00', end + ' 23:59:59').total;
        }
        return { ...sub, newMembers: sNew, orderAmount: sOrder, renewAmount: sRenew };
      });
      result.push({ ...ch, newMembers, orderAmount, renewAmount, subChannels: subResult });
    }
    res.json(success({ list: result, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

export default router;
