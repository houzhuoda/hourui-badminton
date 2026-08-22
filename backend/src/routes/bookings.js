// 约课路由（会员端 MBR-003/004）
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, uuid, now } from '../utils/helpers.js';
import { writeAudit, operatorFromReq } from '../services/audit.js';
import { BOOKING_STATUS, DEFAULTS, AUDIT_ACTIONS } from '../../../shared/constants.js';
import { BizError } from '../middleware/error.js';

const router = Router();

// 会员端：可约课次列表
router.get('/available', authRole(['member']), (req, res, next) => {
  try {
    const db = getDb();
    const { businessType, date } = req.query;
    const where = [`s.status = 'SCHEDULED'`, `s.booking_open = 1`, `s.date >= date('now')`];
    const params = [];
    if (businessType) { where.push('s.business_type = ?'); params.push(businessType); }
    if (date) { where.push('s.date = ?'); params.push(date); }
    const whereSql = where.join(' AND ');
    const list = db.prepare(`
      SELECT * FROM (
        SELECT s.*, c.name as course_name, co.name as coach_name, ct.name as court_name,
          (s.capacity - s.booked_count) as available_slots
        FROM sessions s
        LEFT JOIN courses c ON s.course_id = c.id
        LEFT JOIN coaches co ON s.coach_id = co.id
        LEFT JOIN courts ct ON s.court_id = ct.id
        WHERE ${whereSql}
      ) WHERE available_slots > 0
      ORDER BY date, start_time
    `).all(...params);
    res.json(success(list));
  } catch (e) { next(e); }
});

// 会员端：预约课次
router.post('/', authRole(['member']), (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) throw new BizError('sessionId 必填');
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) throw new BizError('课次不存在', 404);
    if (session.status !== 'SCHEDULED') throw new BizError('课次不可预约');
    if (!session.booking_open) throw new BizError('课次未开放约课');
    if (session.booked_count >= session.capacity) throw new BizError('课位已满');

    // 幂等：同一会员同一课次只能预约一次
    const exist = db.prepare("SELECT id FROM bookings WHERE session_id = ? AND member_id = ? AND status IN ('BOOKED', 'ATTENDED')").get(sessionId, req.user.memberId);
    if (exist) throw new BizError('已预约该课次', 409);

    db.transaction(() => {
      const id = uuid();
      db.prepare(`INSERT INTO bookings (id, session_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, 'BOOKED', ?, ?)`)
        .run(id, sessionId, req.user.memberId, now(), now());
      db.prepare('UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?').run(sessionId);
    })();
    writeAudit({ entity: 'booking', entityId: sessionId, action: AUDIT_ACTIONS.CREATE, operator: operatorFromReq(req), detail: { memberId: req.user.memberId } });
    res.status(201).json(success({ booked: true }));
  } catch (e) { next(e); }
});

// 会员端：取消预约（MBR-004）
router.delete('/:id', authRole(['member']), (req, res, next) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND member_id = ?').get(req.params.id, req.user.memberId);
    if (!booking) throw new BizError('预约不存在', 404);
    if (booking.status !== 'BOOKED') throw new BizError('预约状态不可取消');

    // 检查取消时限
    const session = db.prepare('SELECT date, start_time FROM sessions WHERE id = ?').get(booking.session_id);
    if (session) {
      const sessionTime = new Date(`${session.date}T${session.start_time}:00`);
      const hoursLeft = (sessionTime - new Date()) / 3600000;
      const config = db.prepare('SELECT booking_cancel_hours FROM member_end_config LIMIT 1').get();
      const cancelHours = config?.booking_cancel_hours || DEFAULTS.BOOKING_CANCEL_HOURS;
      if (hoursLeft < cancelHours) {
        throw new BizError(`开课前 ${cancelHours} 小时内不可取消`, 400);
      }
    }

    db.transaction(() => {
      db.prepare("UPDATE bookings SET status = 'CANCELLED', cancelled_at = ?, updated_at = ? WHERE id = ?").run(now(), now(), booking.id);
      db.prepare('UPDATE sessions SET booked_count = MAX(0, booked_count - 1) WHERE id = ?').run(booking.session_id);
    })();
    writeAudit({ entity: 'booking', entityId: booking.id, action: 'CANCEL', operator: operatorFromReq(req) });
    res.json(success({ cancelled: true }));
  } catch (e) { next(e); }
});

// 会员端：我的约课记录
router.get('/mine', authRole(['member']), (req, res, next) => {
  try {
    const db = getDb();
    const { status } = req.query;
    const where = [`b.member_id = ?`];
    const params = [req.user.memberId];
    if (status) { where.push('b.status = ?'); params.push(status); }
    const whereSql = where.join(' AND ');
    const list = db.prepare(`
      SELECT b.*, s.date, s.start_time, s.end_time, c.name as course_name, co.name as coach_name, ct.name as court_name
      FROM bookings b
      JOIN sessions s ON b.session_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN coaches co ON s.coach_id = co.id
      LEFT JOIN courts ct ON s.court_id = ct.id
      WHERE ${whereSql} ORDER BY s.date DESC, s.start_time DESC
    `).all(...params);
    res.json(success(list));
  } catch (e) { next(e); }
});

// 管理端/教练端：查看课次约课名单
router.get('/session/:sessionId', authRole(['admin', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    if (req.user.role === 'coach') {
      const s = db.prepare('SELECT coach_id FROM sessions WHERE id = ?').get(req.params.sessionId);
      if (!s || s.coach_id !== req.user.id) throw new BizError('无权查看', 403);
    }
    const list = db.prepare(`
      SELECT b.*, m.name as member_name
      FROM bookings b
      LEFT JOIN members m ON b.member_id = m.id
      WHERE b.session_id = ? ORDER BY b.created_at
    `).all(req.params.sessionId);
    res.json(success(list));
  } catch (e) { next(e); }
});

export default router;
