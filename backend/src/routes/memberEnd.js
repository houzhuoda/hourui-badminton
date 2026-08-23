// 会员端配置路由（MBR-007）
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, uuid, now, resolveMemberId } from '../utils/helpers.js';
import { writeAudit, operatorFromReq } from '../services/audit.js';
import { AUDIT_ACTIONS } from '../../../shared/constants.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 获取配置
router.get('/config', authRole(['admin', 'member', 'sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    let config = db.prepare('SELECT * FROM member_end_config LIMIT 1').get();
    if (!config) {
      config = { id: uuid(), booking_cancel_hours: 2, noshow_action: 'RECORD_ONLY', booking_open_default: 0, expiry_remind_days: 7 };
      db.prepare(`INSERT INTO member_end_config (id, booking_cancel_hours, noshow_action, booking_open_default, expiry_remind_days, updated_at) VALUES (?, 2, 'RECORD_ONLY', 0, 7, ?)`)
        .run(config.id, now());
    }
    res.json(success(config));
  } catch (e) { next(e); }
});

// 更新配置
router.put('/config', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    let config = db.prepare('SELECT * FROM member_end_config LIMIT 1').get();
    if (!config) {
      config = { id: uuid() };
      db.prepare(`INSERT INTO member_end_config (id, booking_cancel_hours, noshow_action, booking_open_default, expiry_remind_days, updated_at) VALUES (?, 2, 'RECORD_ONLY', 0, 7, ?)`)
        .run(config.id, now());
    }
    const body = req.body || {};
    const bookingCancelHours = body.bookingCancelHours ?? body.booking_cancel_hours;
    const noshowAction = body.noshowAction ?? body.noshow_action;
    const bookingOpenDefault = body.bookingOpenDefault ?? body.booking_open_default;
    const expiryRemindDays = body.expiryRemindDays ?? body.expiry_remind_days;
    const serviceWechat = body.serviceWechat ?? body.service_wechat;
    const serviceWechatQr = body.serviceWechatQr ?? body.service_wechat_qr;
    const servicePhone = body.servicePhone ?? body.service_phone;
    const updates = {};
    if (bookingCancelHours !== undefined) updates.booking_cancel_hours = bookingCancelHours;
    if (noshowAction) updates.noshow_action = noshowAction;
    if (bookingOpenDefault !== undefined) updates.booking_open_default = bookingOpenDefault;
    if (expiryRemindDays !== undefined) updates.expiry_remind_days = expiryRemindDays;
    if (serviceWechat !== undefined) updates.service_wechat = serviceWechat;
    if (serviceWechatQr !== undefined) updates.service_wechat_qr = serviceWechatQr;
    if (servicePhone !== undefined) updates.service_phone = servicePhone;
    if (Object.keys(updates).length > 0) {
      updates.updated_at = now();
      const sets = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      db.prepare(`UPDATE member_end_config SET ${sets} WHERE id = ?`).run(...Object.values(updates), config.id);
      writeAudit({ entity: 'member_end_config', entityId: config.id, action: AUDIT_ACTIONS.UPDATE, operator: operatorFromReq(req), detail: req.body });
    }
    res.json(success(db.prepare('SELECT * FROM member_end_config WHERE id = ?').get(config.id)));
  } catch (e) { next(e); }
});

// 会员端：我的资产（MBR-002）
router.get('/my-assets', authRole(['member', 'sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const memberId = resolveMemberId(req, db);
    if (!memberId) return res.json(success({ packs: [] }));
    const packs = db.prepare(`
      SELECT p.*, c.name as course_name
      FROM packs p LEFT JOIN courses c ON p.course_id = c.id
      WHERE p.member_id = ? AND p.status IN ('ACTIVE', 'EXPIRED')
      ORDER BY p.created_at DESC
    `).all(memberId);
    // 月卡当月额度刷新
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    for (const p of packs) {
      if (p.pack_type === 'MONTHLY' && p.monthly_period !== currentMonthStr && p.status === 'ACTIVE') {
        p.monthly_remaining = p.monthly_quota;
        p.monthly_used = 0;
        p.monthly_period = currentMonthStr;
      }
    }
    res.json(success({
      packs,
    }));
  } catch (e) { next(e); }
});

// 会员端：我的消费记录（MBR-005）
router.get('/my-consumption', authRole(['member', 'sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const memberId = resolveMemberId(req, db);
    if (!memberId) return res.json(success({ orders: [], consumptions: [] }));
    const orders = db.prepare(`
      SELECT o.id, o.order_no, o.business_type, o.charge_mode, o.amount, o.status, o.created_at, c.name as course_name
      FROM orders o LEFT JOIN courses c ON o.course_id = c.id
      WHERE o.member_id = ? ORDER BY o.created_at DESC LIMIT 100
    `).all(memberId);
    const consumptions = db.prepare(`
      SELECT pc.id, pc.pack_id, pc.sessions_used, pc.amount, pc.principal_part, pc.gift_part, pc.charge_mode, pc.created_at,
        s.date, s.start_time, c.name as course_name, co.name as coach_name
      FROM pack_consumptions pc
      LEFT JOIN sessions s ON pc.session_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN coaches co ON s.coach_id = co.id
      WHERE pc.member_id = ? ORDER BY pc.created_at DESC LIMIT 100
    `).all(memberId);
    res.json(success({ orders, consumptions }));
  } catch (e) { next(e); }
});

// 会员端：我的出勤记录
router.get('/my-attendance', authRole(['member', 'sales', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const memberId = resolveMemberId(req, db);
    if (!memberId) return res.json(success([]));
    const list = db.prepare(`
      SELECT a.id, a.status, a.note, a.created_at,
        s.date, s.start_time, s.end_time, c.name as course_name, co.name as coach_name, ct.name as court_name
      FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN coaches co ON a.coach_id = co.id
      LEFT JOIN courts ct ON s.court_id = ct.id
      WHERE a.member_id = ? ORDER BY a.created_at DESC LIMIT 100
    `).all(memberId);
    res.json(success(list));
  } catch (e) { next(e); }
});

export default router;
