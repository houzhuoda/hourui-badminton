// 经营看板路由
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, formatDate, addDays, dateRangeStart } from '../utils/helpers.js';
import { BUSINESS_TYPES } from '../../../shared/constants.js';

const router = Router();

// 看板汇总（DB-001/002）
router.get('/', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { range, startDate, endDate } = req.query;
    let start, end;
    if (range === 'today') {
      start = formatDate(); end = formatDate();
    } else if (range === '7d') {
      start = addDays(new Date(), -7); end = formatDate();
    } else if (range === '30d') {
      start = addDays(new Date(), -30); end = formatDate();
    } else if (range === 'month') {
      start = formatDate().slice(0, 8) + '01'; end = formatDate();
    } else if (startDate && endDate) {
      start = startDate; end = endDate;
    } else {
      // 默认本月
      start = formatDate().slice(0, 8) + '01'; end = formatDate();
    }

    // 今日收入
    const todayIncome = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE status = 'PAID' AND date(created_at) = date('now')").get().total;
    // 本月收入
    const monthStart = formatDate().slice(0, 8) + '01';
    const monthIncome = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE status = 'PAID' AND created_at >= ?").get(monthStart + ' 00:00:00').total;
    // 本月课消节数
    const monthConsumption = db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE status = 'PRESENT' AND date(created_at) >= ?").get(monthStart).cnt;
    // 在籍会员数（状态正常且有有效资产）
    const activeMembers = db.prepare(`
      SELECT COUNT(DISTINCT m.id) as cnt FROM members m
      WHERE m.status = 'ACTIVE' AND (
        EXISTS (SELECT 1 FROM prepaid_accounts pa WHERE pa.member_id = m.id AND pa.total_balance > 0)
        OR EXISTS (SELECT 1 FROM packs p WHERE p.member_id = m.id AND p.status = 'ACTIVE' AND p.valid_until >= date('now'))
      )
    `).get().cnt;
    // 本月新增会员
    const newMembers = db.prepare("SELECT COUNT(*) as cnt FROM members WHERE created_at >= ?").get(monthStart + ' 00:00:00').cnt;
    // 本月到期会员
    const expiringMembers = db.prepare(`
      SELECT COUNT(DISTINCT p.member_id) as cnt FROM packs p
      WHERE p.status = 'ACTIVE' AND p.valid_until >= date('now') AND p.valid_until <= date('now', '+7 days')
    `).get().cnt;
    // 活跃教练（当月至少完成 1 节出勤核销）
    const activeCoaches = db.prepare("SELECT COUNT(DISTINCT coach_id) as cnt FROM attendance WHERE status = 'PRESENT' AND date(created_at) >= ?").get(monthStart).cnt;

    // 收入趋势（近 30 天，按日聚合，区分新增购课与续费）DB-003
    const trend = db.prepare(`
      SELECT date(created_at) as date,
        SUM(CASE WHEN commission_type = 'NEW' THEN amount ELSE 0 END) as new_income,
        SUM(CASE WHEN commission_type = 'RENEW' THEN amount ELSE 0 END) as renew_income,
        SUM(amount) as total_income
      FROM orders WHERE status = 'PAID' AND created_at >= ?
      GROUP BY date(created_at) ORDER BY date
    `).all(addDays(new Date(), -30) + ' 00:00:00');

    // 业务类型收入构成（DB-004）
    const businessIncome = BUSINESS_TYPES.map((b) => {
      const total = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE status = 'PAID' AND business_type = ? AND created_at >= ?").get(b.code, monthStart + ' 00:00:00').total;
      return { businessType: b.code, name: b.name, income: total };
    });
    const totalBusinessIncome = businessIncome.reduce((s, b) => s + b.income, 0);
    businessIncome.forEach((b) => { b.percentage = totalBusinessIncome > 0 ? Math.round(b.income * 100 / totalBusinessIncome) : 0; });

    // 到期会员列表（未来 7 天）DB-005
    const expiringList = db.prepare(`
      SELECT p.id as pack_id, p.member_id, m.name as member_name, m.phone as phone_encrypted,
        p.course_id, c.name as course_name, p.valid_until, p.remaining_sessions, p.pack_type,
        pa.total_balance
      FROM packs p
      LEFT JOIN members m ON p.member_id = m.id
      LEFT JOIN courses c ON p.course_id = c.id
      LEFT JOIN prepaid_accounts pa ON pa.member_id = m.id
      WHERE p.status = 'ACTIVE' AND p.valid_until >= date('now') AND p.valid_until <= date('now', '+7 days')
      ORDER BY p.valid_until
    `).all();

    res.json(success({
      metrics: {
        todayIncome, monthIncome, monthConsumption, activeMembers,
        newMembers, expiringMembers, activeCoaches,
      },
      trend,
      businessIncome,
      expiringList,
      range: { start, end },
    }));
  } catch (e) { next(e); }
});

export default router;
