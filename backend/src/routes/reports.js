// 统计报表路由（RPT-001~006）
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, formatDate, addDays } from '../utils/helpers.js';
import { BUSINESS_TYPES } from '../../../shared/constants.js';

const router = Router();

// 教练上课统计报表（RPT-001）
// 前端期望：按教练汇总，字段 coach_name, session_count, present_count, total_lesson_fee, total_share, sales_commission
router.get('/coach', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate, coachId, businessType } = req.query;
    const start = startDate || formatDate().slice(0, 8) + '01';
    const end = endDate || formatDate();
    const where = [`s.date >= ?`, `s.date <= ?`];
    const params = [start, end];
    if (coachId) { where.push('a.coach_id = ?'); params.push(coachId); }
    if (businessType) { where.push('s.business_type = ?'); params.push(businessType); }
    const whereSql = where.join(' AND ');

    // 按教练汇总
    const list = db.prepare(`
      SELECT co.id as coach_id, co.name as coach_name,
        COUNT(DISTINCT s.id) as session_count,
        SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count,
        COALESCE(SUM(a.lesson_fee), 0) as total_lesson_fee,
        COALESCE(SUM(a.share_amount), 0) as total_share
      FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      JOIN coaches co ON a.coach_id = co.id
      WHERE ${whereSql}
      GROUP BY co.id
      ORDER BY total_lesson_fee DESC
    `).all(...params);

    // 附带每个教练的销售提成（课后计提的 commission_records）
    for (const item of list) {
      const sc = db.prepare(`
        SELECT COALESCE(SUM(cr.amount), 0) as total
        FROM commission_records cr
        JOIN sessions s ON cr.session_id = s.id
        WHERE cr.beneficiary_type = 'sales' AND cr.status = 'ACTIVE' AND s.coach_id = ?
          AND s.date >= ? AND s.date <= ?
      `).get(item.coach_id, start, end);
      item.sales_commission = sc?.total || 0;
    }

    res.json(success({ list, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

// 销售业绩统计报表（RPT-002）
// 前端期望：按销售汇总，区分新客/续费，字段 sales_name, new_count, renew_count, new_amount, renew_amount, total_amount, total_commission
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

    // 按销售汇总，区分新客/续费
    const list = db.prepare(`
      SELECT o.sales_id, o.sales_name, o.sales_type,
        SUM(CASE WHEN o.commission_type = 'NEW' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN o.commission_type = 'RENEW' THEN 1 ELSE 0 END) as renew_count,
        COALESCE(SUM(CASE WHEN o.commission_type = 'NEW' THEN o.amount ELSE 0 END), 0) as new_amount,
        COALESCE(SUM(CASE WHEN o.commission_type = 'RENEW' THEN o.amount ELSE 0 END), 0) as renew_amount,
        COALESCE(SUM(o.amount), 0) as total_amount
      FROM orders o
      WHERE ${whereSql}
      GROUP BY o.sales_id
      ORDER BY total_amount DESC
    `).all(...params);

    // 实际提成从 commission_records 汇总（课后计提）
    for (const item of list) {
      const sc = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM commission_records
        WHERE beneficiary_id = ? AND beneficiary_type = 'sales' AND status = 'ACTIVE'
          AND created_at >= ? AND created_at <= ?
      `).get(item.sales_id, start + ' 00:00:00', end + ' 23:59:59');
      item.total_commission = sc?.total || 0;
    }

    res.json(success({ list, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

// 会员课消报表（RPT-003）
// 前端期望：byBusiness(按业务类型汇总) + trend(课消趋势) + list(会员明细)
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

    // 按业务类型汇总
    const byBusiness = db.prepare(`
      SELECT s.business_type,
        COUNT(*) as sessions,
        SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'PENDING_PAY' THEN 1 ELSE 0 END) as pending_count,
        COALESCE(SUM(a.lesson_fee + a.share_amount), 0) as amount
      FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      WHERE ${whereSql}
      GROUP BY s.business_type
      ORDER BY sessions DESC
    `).all(...params);

    // 课消趋势（按日聚合）
    const trend = db.prepare(`
      SELECT s.date,
        COUNT(*) as sessions,
        COALESCE(SUM(a.lesson_fee + a.share_amount), 0) as amount
      FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      WHERE ${whereSql}
      GROUP BY s.date
      ORDER BY s.date
    `).all(...params);

    // 会员明细列表
    const list = db.prepare(`
      SELECT a.member_id, m.name as member_name, s.business_type,
        COUNT(*) as consumed_sessions,
        SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'PENDING_PAY' THEN 1 ELSE 0 END) as pending_count,
        COALESCE(SUM(a.lesson_fee + a.share_amount), 0) as total_amount
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
    }

    res.json(success({ byBusiness, trend, list, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

// 渠道获客统计报表（RPT-006）
// 前端期望：firstLevel + secondLevel，字段 channel_name, member_count, total_income, percentage
router.get('/channel', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate } = req.query;
    const start = startDate || formatDate().slice(0, 8) + '01';
    const end = endDate || formatDate();

    // 一级渠道
    const channels = db.prepare("SELECT * FROM channels WHERE level = 1 ORDER BY sort_order").all();
    let totalAllIncome = 0;
    const firstLevel = [];
    for (const ch of channels) {
      // 直接查 members.channel_id
      const memberIds = db.prepare("SELECT id FROM members WHERE channel_id = ?").all(ch.id).map((r) => r.id);
      let memberCount = 0, totalIncome = 0, renewAmount = 0;
      if (memberIds.length > 0) {
        const placeholders = memberIds.map(() => '?').join(',');
        memberCount = db.prepare(`SELECT COUNT(*) as cnt FROM members WHERE id IN (${placeholders}) AND created_at >= ? AND created_at <= ?`).get(...memberIds, start + ' 00:00:00', end + ' 23:59:59').cnt;
        totalIncome = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE member_id IN (${placeholders}) AND status='PAID' AND created_at >= ? AND created_at <= ?`).get(...memberIds, start + ' 00:00:00', end + ' 23:59:59').total;
        renewAmount = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE member_id IN (${placeholders}) AND status='PAID' AND commission_type='RENEW' AND created_at >= ? AND created_at <= ?`).get(...memberIds, start + ' 00:00:00', end + ' 23:59:59').total;
      }
      totalAllIncome += totalIncome;
      firstLevel.push({ channel_id: ch.id, channel_name: ch.name, member_count: memberCount, total_income: totalIncome, renew_amount: renewAmount });
    }
    // 计算占比
    firstLevel.forEach((item) => {
      item.percentage = totalAllIncome > 0 ? Math.round(item.total_income * 100 / totalAllIncome) : 0;
    });

    // 二级渠道
    const secondLevel = [];
    for (const ch of channels) {
      const subs = db.prepare('SELECT * FROM channels WHERE parent_id = ? AND level = 2 ORDER BY sort_order').all(ch.id);
      for (const sub of subs) {
        const subMemberIds = db.prepare("SELECT id FROM members WHERE sub_channel_id = ?").all(sub.id).map((r) => r.id);
        let sCount = 0, sIncome = 0;
        if (subMemberIds.length > 0) {
          const p = subMemberIds.map(() => '?').join(',');
          sCount = db.prepare(`SELECT COUNT(*) as cnt FROM members WHERE id IN (${p}) AND created_at >= ? AND created_at <= ?`).get(...subMemberIds, start + ' 00:00:00', end + ' 23:59:59').cnt;
          sIncome = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE member_id IN (${p}) AND status='PAID' AND created_at >= ? AND created_at <= ?`).get(...subMemberIds, start + ' 00:00:00', end + ' 23:59:59').total;
        }
        secondLevel.push({ sub_channel_id: sub.id, channel_name: ch.name, sub_channel_name: sub.name, member_count: sCount, total_income: sIncome });
      }
    }

    res.json(success({ firstLevel, secondLevel, totalIncome: totalAllIncome, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

export default router;
