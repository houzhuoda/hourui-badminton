// 销售端聚合路由（工作台、业绩摘要）
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, formatDate } from '../utils/helpers.js';

const router = Router();

// 工作台摘要（今日开单数、开单金额、实际提成）
router.get('/dashboard', authRole(['sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const today = formatDate();
    const todayStats = db.prepare(`
      SELECT COUNT(*) as order_count, COALESCE(SUM(amount),0) as total_amount
      FROM orders WHERE sales_id = ? AND status = 'PAID' AND date(created_at) = ?
    `).get(req.user.id, today);
    // 实际提成从 commission_records 取（课后计提）
    const todayCommission = db.prepare(`
      SELECT COALESCE(SUM(amount),0) as commission
      FROM commission_records WHERE beneficiary_id = ? AND status = 'ACTIVE' AND date(created_at) = ?
    `).get(req.user.id, today).commission;
    todayStats.commission = todayCommission;

    const monthStart = today.slice(0, 8) + '01';
    const monthStats = db.prepare(`
      SELECT COUNT(*) as order_count, COALESCE(SUM(amount),0) as total_amount
      FROM orders WHERE sales_id = ? AND status = 'PAID' AND created_at >= ?
    `).get(req.user.id, monthStart + ' 00:00:00');
    const monthCommission = db.prepare(`
      SELECT COALESCE(SUM(amount),0) as commission
      FROM commission_records WHERE beneficiary_id = ? AND status = 'ACTIVE' AND created_at >= ?
    `).get(req.user.id, monthStart + ' 00:00:00').commission;
    monthStats.commission = monthCommission;

    res.json(success({ today: todayStats, month: monthStats }));
  } catch (e) { next(e); }
});

// 我的业绩明细（SAL-009 / COA-011）
router.get('/performance', authRole(['sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate } = req.query;
    const start = startDate || formatDate().slice(0, 8) + '01';
    const end = endDate || formatDate();
    const list = db.prepare(`
      SELECT o.id, o.order_no, o.business_type, o.charge_mode, o.amount, o.commission_amount as estimated_commission, o.commission_type, o.created_at,
        m.name as member_name, c.name as course_name,
        (SELECT COALESCE(SUM(cr.amount),0) FROM commission_records cr WHERE cr.order_id = o.id AND cr.status = 'ACTIVE') as actual_commission
      FROM orders o
      LEFT JOIN members m ON o.member_id = m.id
      LEFT JOIN courses c ON o.course_id = c.id
      WHERE o.sales_id = ? AND o.status = 'PAID' AND o.created_at >= ? AND o.created_at <= ?
      ORDER BY o.created_at DESC
    `).all(req.user.id, start + ' 00:00:00', end + ' 23:59:59');
    const summary = {
      orderCount: list.length,
      totalAmount: list.reduce((s, o) => s + o.amount, 0),
      estimatedCommission: list.reduce((s, o) => s + (o.estimated_commission || 0), 0),
      actualCommission: list.reduce((s, o) => s + (o.actual_commission || 0), 0),
      totalCommission: list.reduce((s, o) => s + (o.actual_commission || 0), 0),
      newCount: list.filter((o) => o.commission_type === 'NEW').length,
      renewCount: list.filter((o) => o.commission_type === 'RENEW').length,
    };
    res.json(success({ summary, list, startDate: start, endDate: end }));
  } catch (e) { next(e); }
});

// 教练端：我的课表摘要（今日/本周/本月）
router.get('/coach/schedule-summary', authRole(['coach']), (req, res, next) => {
  try {
    const db = getDb();
    const today = formatDate();
    const todayCount = db.prepare("SELECT COUNT(*) as cnt FROM sessions WHERE coach_id = ? AND date = ? AND status IN ('SCHEDULED', 'COMPLETED')").get(req.user.id, today).cnt;
    // 今日课时费
    const todayFee = db.prepare(`
      SELECT COALESCE(SUM(a.lesson_fee),0) as fee FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      WHERE a.coach_id = ? AND s.date = ? AND a.status = 'PRESENT'
    `).get(req.user.id, today).fee;
    // 本周
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekCount = db.prepare("SELECT COUNT(*) as cnt FROM sessions WHERE coach_id = ? AND date >= ? AND date <= ? AND status IN ('SCHEDULED', 'COMPLETED')").get(req.user.id, weekStartStr, today).cnt;
    res.json(success({ todayCount, todayFee, weekCount, today }));
  } catch (e) { next(e); }
});

export default router;
