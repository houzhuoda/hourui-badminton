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
    // 待消课节数 = 次卡剩余节数 + 月卡剩余次数（有效课包）
    const pendingConsumption = db.prepare(`
      SELECT COALESCE(SUM(
        CASE WHEN pack_type = 'SESSION_PACK' THEN remaining_sessions
             WHEN pack_type = 'MONTHLY' THEN monthly_remaining
             ELSE 0 END
      ), 0) as total
      FROM packs WHERE status = 'ACTIVE' AND valid_until >= date('now')
    `).get().total;
    // 待消课金额 = 次卡剩余节数×单价 + 月卡剩余次数×(月费/月额度)
    const pendingAmount = db.prepare(`
      SELECT COALESCE(SUM(
        CASE WHEN pack_type = 'SESSION_PACK' THEN remaining_sessions * unit_price
             WHEN pack_type = 'MONTHLY' THEN monthly_remaining * ROUND(
               (SELECT o.amount FROM orders o WHERE o.id = p.order_id) * 1.0 /
               NULLIF((SELECT monthly_quota FROM course_monthly_pricing mp WHERE mp.course_id = p.course_id ORDER BY created_at LIMIT 1), 0)
             )
             ELSE 0 END
      ), 0) as total
      FROM packs p WHERE p.status = 'ACTIVE' AND p.valid_until >= date('now')
    `).get().total;
    // 本月已消课金额（教练课时费+分成）
    const consumedAmount = db.prepare(`
      SELECT COALESCE(SUM(lesson_fee + share_amount), 0) as total FROM attendance
      WHERE status = 'PRESENT' AND date(created_at) >= ?
    `).get(monthStart).total;
    // 在籍会员数（状态正常且有有效资产）
    const activeMembers = db.prepare(`
      SELECT COUNT(DISTINCT m.id) as cnt FROM members m
      WHERE m.status = 'ACTIVE' AND (
        EXISTS (SELECT 1 FROM packs p WHERE p.member_id = m.id AND p.status = 'ACTIVE' AND p.valid_until >= date('now'))
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
        p.course_id, c.name as course_name, p.valid_until, p.remaining_sessions, p.pack_type
      FROM packs p
      LEFT JOIN members m ON p.member_id = m.id
      LEFT JOIN courses c ON p.course_id = c.id
      WHERE p.status = 'ACTIVE' AND p.valid_until >= date('now') AND p.valid_until <= date('now', '+7 days')
      ORDER BY p.valid_until
    `).all();

    res.json(success({
      metrics: {
        todayIncome, monthIncome, monthConsumption,
        pendingConsumption, pendingAmount, consumedAmount,
        activeMembers,
        newMembers, expiringMembers, activeCoaches,
      },
      trend,
      businessIncome,
      expiringList,
      range: { start, end },
    }));
  } catch (e) { next(e); }
});

// 看板指标明细（点击下钻）
router.get('/detail', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { type } = req.query;
    const today = formatDate();
    const monthStart = formatDate().slice(0, 8) + '01';
    let rows = [];
    let columns = [];

    if (type === 'todayIncome') {
      rows = db.prepare(`
        SELECT o.id, o.order_no, m.name as member_name, o.business_type, o.amount, o.status, o.created_at
        FROM orders o LEFT JOIN members m ON o.member_id = m.id
        WHERE o.status = 'PAID' AND date(o.created_at) = date('now')
        ORDER BY o.created_at DESC
      `).all();
      columns = [
        { title: '订单号', dataIndex: 'order_no', key: 'order_no' },
        { title: '会员', dataIndex: 'member_name', key: 'member_name' },
        { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => BUSINESS_TYPES.find(b=>b.code===v)?.name || v },
        { title: '金额', dataIndex: 'amount', key: 'amount', render: (v) => `￥${v}` },
        { title: '时间', dataIndex: 'created_at', key: 'created_at' },
      ];
    } else if (type === 'monthIncome') {
      rows = db.prepare(`
        SELECT o.id, o.order_no, m.name as member_name, o.business_type, o.amount, o.status, o.created_at
        FROM orders o LEFT JOIN members m ON o.member_id = m.id
        WHERE o.status = 'PAID' AND o.created_at >= ?
        ORDER BY o.created_at DESC
      `).all(monthStart + ' 00:00:00');
      columns = [
        { title: '订单号', dataIndex: 'order_no', key: 'order_no' },
        { title: '会员', dataIndex: 'member_name', key: 'member_name' },
        { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: (v) => BUSINESS_TYPES.find(b=>b.code===v)?.name || v },
        { title: '金额', dataIndex: 'amount', key: 'amount', render: (v) => `￥${v}` },
        { title: '时间', dataIndex: 'created_at', key: 'created_at' },
      ];
    } else if (type === 'monthConsumption') {
      rows = db.prepare(`
        SELECT a.id, m.name as member_name, c.name as course_name, co.name as coach_name,
               a.lesson_fee, a.share_amount, a.status, a.created_at
        FROM attendance a
        LEFT JOIN members m ON a.member_id = m.id
        LEFT JOIN sessions s ON a.session_id = s.id
        LEFT JOIN courses c ON s.course_id = c.id
        LEFT JOIN coaches co ON a.coach_id = co.id
        WHERE a.status = 'PRESENT' AND date(a.created_at) >= ?
        ORDER BY a.created_at DESC
      `).all(monthStart);
      columns = [
        { title: '会员', dataIndex: 'member_name', key: 'member_name' },
        { title: '课程', dataIndex: 'course_name', key: 'course_name' },
        { title: '教练', dataIndex: 'coach_name', key: 'coach_name' },
        { title: '课时费', dataIndex: 'lesson_fee', key: 'lesson_fee', render: (v) => v ? `￥${v}` : '-' },
        { title: '分成', dataIndex: 'share_amount', key: 'share_amount', render: (v) => v ? `￥${v}` : '-' },
        { title: '时间', dataIndex: 'created_at', key: 'created_at' },
      ];
    } else if (type === 'consumedAmount') {
      rows = db.prepare(`
        SELECT a.id, m.name as member_name, c.name as course_name, co.name as coach_name,
               a.lesson_fee, a.share_amount, (a.lesson_fee + a.share_amount) as total, a.created_at
        FROM attendance a
        LEFT JOIN members m ON a.member_id = m.id
        LEFT JOIN sessions s ON a.session_id = s.id
        LEFT JOIN courses c ON s.course_id = c.id
        LEFT JOIN coaches co ON a.coach_id = co.id
        WHERE a.status = 'PRESENT' AND date(a.created_at) >= ?
        ORDER BY a.created_at DESC
      `).all(monthStart);
      columns = [
        { title: '会员', dataIndex: 'member_name', key: 'member_name' },
        { title: '课程', dataIndex: 'course_name', key: 'course_name' },
        { title: '教练', dataIndex: 'coach_name', key: 'coach_name' },
        { title: '课时费', dataIndex: 'lesson_fee', key: 'lesson_fee', render: (v) => v ? `￥${v}` : '-' },
        { title: '分成', dataIndex: 'share_amount', key: 'share_amount', render: (v) => v ? `￥${v}` : '-' },
        { title: '合计', dataIndex: 'total', key: 'total', render: (v) => `￥${v}` },
        { title: '时间', dataIndex: 'created_at', key: 'created_at' },
      ];
    } else if (type === 'pendingConsumption' || type === 'pendingAmount') {
      rows = db.prepare(`
        SELECT p.id as pack_id, m.name as member_name, c.name as course_name,
               p.pack_type, p.business_type,
               p.total_sessions, p.remaining_sessions, p.gift_sessions, p.unit_price,
               p.monthly_quota, p.monthly_remaining,
               p.valid_until,
               CASE WHEN p.pack_type = 'SESSION_PACK' THEN p.remaining_sessions * p.unit_price
                    WHEN p.pack_type = 'MONTHLY' THEN p.monthly_remaining * ROUND(
                      (SELECT o.amount FROM orders o WHERE o.id = p.order_id) * 1.0 /
                      NULLIF(p.monthly_quota, 0)
                    )
                    ELSE 0 END as pending_amount
        FROM packs p
        LEFT JOIN members m ON p.member_id = m.id
        LEFT JOIN courses c ON p.course_id = c.id
        WHERE p.status = 'ACTIVE' AND p.valid_until >= date('now')
          AND (
            (p.pack_type = 'SESSION_PACK' AND p.remaining_sessions > 0)
            OR (p.pack_type = 'MONTHLY' AND p.monthly_remaining > 0)
          )
        ORDER BY m.name, p.valid_until
      `).all();
      columns = [
        { title: '会员', dataIndex: 'member_name', key: 'member_name' },
        { title: '课程', dataIndex: 'course_name', key: 'course_name' },
        { title: '类型', dataIndex: 'pack_type', key: 'pack_type', render: (v) => v === 'SESSION_PACK' ? '次卡' : v === 'MONTHLY' ? '月卡' : v },
        { title: '剩余', key: 'remaining', render: (_, r) => r.pack_type === 'SESSION_PACK' ? `${r.remaining_sessions}节` : `${r.monthly_remaining}次` },
        { title: '待消金额', dataIndex: 'pending_amount', key: 'pending_amount', render: (v) => `￥${v || 0}` },
        { title: '到期日', dataIndex: 'valid_until', key: 'valid_until' },
      ];
    } else if (type === 'activeMembers') {
      rows = db.prepare(`
        SELECT DISTINCT m.id, m.name, m.phone, m.status, m.created_at,
          (SELECT GROUP_CONCAT(p.pack_type) FROM packs p WHERE p.member_id = m.id AND p.status = 'ACTIVE' AND p.valid_until >= date('now')) as active_packs
        FROM members m
        WHERE m.status = 'ACTIVE' AND (
          EXISTS (SELECT 1 FROM packs p WHERE p.member_id = m.id AND p.status = 'ACTIVE' AND p.valid_until >= date('now'))
        )
        ORDER BY m.created_at DESC
      `).all();
      columns = [
        { title: '会员', dataIndex: 'name', key: 'name' },
        { title: '有效课包', dataIndex: 'active_packs', key: 'active_packs', render: (v) => v || '-' },
        { title: '建档时间', dataIndex: 'created_at', key: 'created_at' },
      ];
    } else if (type === 'newMembers') {
      rows = db.prepare(`
        SELECT m.id, m.name, m.phone, m.status, m.created_at,
               u.name as creator_name, u.type as creator_type
        FROM members m
        LEFT JOIN (SELECT id, name, 'sales' as type FROM sales UNION SELECT id, name, 'coach' as type FROM coaches) u ON m.creator_id = u.id
        WHERE m.created_at >= ?
        ORDER BY m.created_at DESC
      `).all(monthStart + ' 00:00:00');
      columns = [
        { title: '会员', dataIndex: 'name', key: 'name' },
        { title: '建档人', dataIndex: 'creator_name', key: 'creator_name', render: (v, r) => v ? `${v}(${r.creator_type})` : '系统' },
        { title: '建档时间', dataIndex: 'created_at', key: 'created_at' },
      ];
    } else if (type === 'expiringMembers') {
      rows = db.prepare(`
        SELECT p.id as pack_id, m.name as member_name, c.name as course_name,
               p.valid_until, p.remaining_sessions, p.pack_type, p.monthly_remaining
        FROM packs p
        LEFT JOIN members m ON p.member_id = m.id
        LEFT JOIN courses c ON p.course_id = c.id
        WHERE p.status = 'ACTIVE' AND p.valid_until >= date('now') AND p.valid_until <= date('now', '+7 days')
        ORDER BY p.valid_until
      `).all();
      columns = [
        { title: '会员', dataIndex: 'member_name', key: 'member_name' },
        { title: '课程', dataIndex: 'course_name', key: 'course_name' },
        { title: '到期日', dataIndex: 'valid_until', key: 'valid_until' },
        { title: '剩余', key: 'remaining', render: (_, r) => r.pack_type === 'SESSION_PACK' ? `${r.remaining_sessions}节` : `${r.monthly_remaining}次` },
      ];
    } else if (type === 'activeCoaches') {
      rows = db.prepare(`
        SELECT co.id, co.name, co.phone,
               COUNT(DISTINCT a.session_id) as session_count,
               SUM(a.lesson_fee) as total_lesson_fee,
               SUM(a.share_amount) as total_share
        FROM coaches co
        JOIN attendance a ON a.coach_id = co.id
        WHERE a.status = 'PRESENT' AND date(a.created_at) >= ?
        GROUP BY co.id
        ORDER BY total_lesson_fee DESC
      `).all(monthStart);
      columns = [
        { title: '教练', dataIndex: 'name', key: 'name' },
        { title: '上课节数', dataIndex: 'session_count', key: 'session_count' },
        { title: '课时费合计', dataIndex: 'total_lesson_fee', key: 'total_lesson_fee', render: (v) => v ? `￥${v}` : '-' },
        { title: '分成合计', dataIndex: 'total_share', key: 'total_share', render: (v) => v ? `￥${v}` : '-' },
      ];
    }

    res.json(success({ rows, columns }));
  } catch (e) { next(e); }
});

export default router;
