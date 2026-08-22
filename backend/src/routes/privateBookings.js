// 私教/陪练预约路由
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRole } from '../middleware/auth.js';
import { success, uuid, now } from '../utils/helpers.js';
import { writeAudit, operatorFromReq } from '../services/audit.js';
import { BizError } from '../middleware/error.js';

const router = Router();

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// ============ 教练可用时间模板 CRUD ============

// 获取教练可用时间模板
router.get('/:coachId/availability', authRole(['admin', 'coach', 'member']), (req, res, next) => {
  try {
    const db = getDb();
    const templates = db.prepare('SELECT * FROM coach_availability_templates WHERE coach_id = ? AND status = ? ORDER BY day_of_week, start_hour')
      .all(req.params.coachId, 'ACTIVE');
    res.json(success(templates));
  } catch (e) { next(e); }
});

// 设置教练可用时间模板（整体替换）
router.put('/:coachId/availability', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { templates } = req.body || {};
    if (!Array.isArray(templates)) throw new BizError('templates 必须为数组');

    const coachId = req.params.coachId;
    const coach = db.prepare('SELECT id FROM coaches WHERE id = ?').get(coachId);
    if (!coach) throw new BizError('教练不存在', 404);

    // 先删除旧模板
    db.prepare('DELETE FROM coach_availability_templates WHERE coach_id = ?').run(coachId);

    // 插入新模板
    const insert = db.prepare(`INSERT INTO coach_availability_templates (id, coach_id, day_of_week, start_hour, end_hour, business_types, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`);
    for (const t of templates) {
      if (t.dayOfWeek < 1 || t.dayOfWeek > 7) continue;
      if (t.startHour < 0 || t.endHour > 24 || t.startHour >= t.endHour) continue;
      insert.run(uuid(), coachId, t.dayOfWeek, t.startHour, t.endHour, t.businessTypes || 'PRIVATE,PRACTICE', now(), now());
    }

    writeAudit({ entity: 'coach_availability', entityId: coachId, action: 'UPDATE', operator: operatorFromReq(req), detail: { templates } });
    const result = db.prepare('SELECT * FROM coach_availability_templates WHERE coach_id = ? ORDER BY day_of_week, start_hour').all(coachId);
    res.json(success(result));
  } catch (e) { next(e); }
});

// ============ 教练请假 ============

// 获取教练请假记录
router.get('/:coachId/time-off', authRole(['admin', 'coach']), (req, res, next) => {
  try {
    const db = getDb();
    const { startDate, endDate } = req.query;
    let where = 'WHERE coach_id = ?';
    const params = [req.params.coachId];
    if (startDate) { where += ' AND date >= ?'; params.push(startDate); }
    if (endDate) { where += ' AND date <= ?'; params.push(endDate); }
    const list = db.prepare(`SELECT * FROM coach_time_off ${where} ORDER BY date, start_time`).all(...params);
    res.json(success(list));
  } catch (e) { next(e); }
});

// 添加请假
router.post('/:coachId/time-off', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const { date, startTime, endTime, reason } = req.body || {};
    if (!date || !startTime || !endTime) throw new BizError('日期和时间段必填');
    const id = uuid();
    db.prepare('INSERT INTO coach_time_off (id, coach_id, date, start_time, end_time, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.coachId, date, startTime, endTime, reason || '', now());
    writeAudit({ entity: 'coach_time_off', entityId: id, action: 'CREATE', operator: operatorFromReq(req), detail: { date, startTime, endTime, reason } });
    res.status(201).json(success(db.prepare('SELECT * FROM coach_time_off WHERE id = ?').get(id)));
  } catch (e) { next(e); }
});

// 删除请假
router.delete('/:coachId/time-off/:offId', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM coach_time_off WHERE id = ? AND coach_id = ?').run(req.params.offId, req.params.coachId);
    writeAudit({ entity: 'coach_time_off', entityId: req.params.offId, action: 'DELETE', operator: operatorFromReq(req), detail: {} });
    res.json(success({ deleted: true }));
  } catch (e) { next(e); }
});

// ============ 可约时段查询 ============

// 获取教练某天可约时段（私教/陪练）
router.get('/:coachId/available-slots', authRole(['admin', 'coach', 'member']), (req, res, next) => {
  try {
    const db = getDb();
    const coachId = req.params.coachId;
    const { date, businessType } = req.query;
    if (!date) throw new BizError('date 参数必填');

    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay(); // 1=周一...7=周日

    // 1. 取教练该周几的可用时间模板
    const templates = db.prepare('SELECT * FROM coach_availability_templates WHERE coach_id = ? AND day_of_week = ? AND status = ?')
      .all(coachId, dayOfWeek, 'ACTIVE');
    if (templates.length === 0) { res.json(success([])); return; }

    // 生成小时段列表
    const slots = [];
    for (const t of templates) {
      // 检查业务类型是否匹配
      if (businessType && t.business_types && !t.business_types.split(',').includes(businessType)) continue;
      for (let h = t.start_hour; h < t.end_hour; h++) {
        slots.push({
          start_time: `${String(h).padStart(2, '0')}:00`,
          end_time: `${String(h + 1).padStart(2, '0')}:00`,
        });
      }
    }

    // 2. 排除教练请假时段
    const timeOffs = db.prepare('SELECT * FROM coach_time_off WHERE coach_id = ? AND date = ?').all(coachId, date);
    const filtered1 = slots.filter((s) => {
      return !timeOffs.some((off) => {
        return !(s.end_time <= off.start_time || s.start_time >= off.end_time);
      });
    });

    // 3. 排除教练已有排课冲突（sessions 表中该教练该日期的课次）
    const sessions = db.prepare(`SELECT start_time, end_time FROM sessions WHERE coach_id = ? AND date = ? AND status = 'SCHEDULED'`)
      .all(coachId, date);
    const filtered2 = filtered1.filter((s) => {
      return !sessions.some((sess) => {
        return !(s.end_time <= sess.start_time || s.start_time >= sess.end_time);
      });
    });

    // 4. 排除已被其他会员预约的私教/陪练时段
    const privateBookings = db.prepare(`SELECT start_time, end_time FROM private_bookings WHERE coach_id = ? AND date = ? AND status = 'BOOKED'`)
      .all(coachId, date);
    const filtered3 = filtered2.filter((s) => {
      return !privateBookings.some((pb) => {
        return !(s.end_time <= pb.start_time || s.start_time >= pb.end_time);
      });
    });

    // 5. 排除过去时间
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const nowHour = today.getHours();
    const filtered4 = date === todayStr
      ? filtered3.filter((s) => parseInt(s.start_time.split(':')[0]) > nowHour)
      : filtered3;

    // 标记是否可约
    const result = filtered4.map((s) => ({ ...s, available: true }));
    res.json(success(result));
  } catch (e) { next(e); }
});

// ============ 私教/陪练预约 ============

// 创建私教/陪练预约
router.post('/private', authRole(['member']), (req, res, next) => {
  try {
    const db = getDb();
    const { coachId, businessType, date, startTime, endTime } = req.body || {};
    if (!coachId || !businessType || !date || !startTime || !endTime) {
      throw new BizError('教练、业务类型、日期、时间段必填');
    }
    if (businessType !== 'PRIVATE' && businessType !== 'PRACTICE') {
      throw new BizError('仅支持私教或陪练预约');
    }

    const memberId = req.user.memberId;

    // 检查教练是否存在且在职
    const coach = db.prepare("SELECT id, name FROM coaches WHERE id = ? AND status = 'ACTIVE'").get(coachId);
    if (!coach) throw new BizError('教练不存在或已离职', 404);

    // 检查该时段是否可约（复用上面的逻辑）
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay();
    const templates = db.prepare('SELECT * FROM coach_availability_templates WHERE coach_id = ? AND day_of_week = ? AND status = ?')
      .all(coachId, dayOfWeek, 'ACTIVE');
    const inTemplate = templates.some((t) => {
      if (businessType && t.business_types && !t.business_types.split(',').includes(businessType)) return false;
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      return startHour >= t.start_hour && endHour <= t.end_hour;
    });
    if (!inTemplate) throw new BizError('该时段不在教练可用时间范围内', 400);

    // 检查请假冲突
    const timeOffConflict = db.prepare(`SELECT 1 FROM coach_time_off WHERE coach_id = ? AND date = ? AND start_time < ? AND end_time > ?`)
      .get(coachId, date, endTime, startTime);
    if (timeOffConflict) throw new BizError('教练该时段请假', 400);

    // 检查排课冲突
    const sessionConflict = db.prepare(`SELECT 1 FROM sessions WHERE coach_id = ? AND date = ? AND status = 'SCHEDULED' AND start_time < ? AND end_time > ?`)
      .get(coachId, date, endTime, startTime);
    if (sessionConflict) throw new BizError('教练该时段有其他课程', 400);

    // 检查是否已被预约
    const bookingConflict = db.prepare(`SELECT 1 FROM private_bookings WHERE coach_id = ? AND date = ? AND start_time = ? AND status = 'BOOKED'`)
      .get(coachId, date, startTime);
    if (bookingConflict) throw new BizError('该时段已被预约', 409);

    // 检查会员是否已约同一时段
    const memberConflict = db.prepare(`SELECT 1 FROM private_bookings WHERE member_id = ? AND date = ? AND start_time = ? AND status = 'BOOKED'`)
      .get(memberId, date, startTime);
    if (memberConflict) throw new BizError('您该时段已有预约', 409);

    const id = uuid();
    db.prepare(`INSERT INTO private_bookings (id, coach_id, member_id, business_type, date, start_time, end_time, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'BOOKED', ?, ?)`)
      .run(id, coachId, memberId, businessType, date, startTime, endTime, now(), now());

    const booking = db.prepare(`
      SELECT pb.*, c.name as coach_name, m.name as member_name
      FROM private_bookings pb
      JOIN coaches c ON pb.coach_id = c.id
      JOIN members m ON pb.member_id = m.id
      WHERE pb.id = ?
    `).get(id);

    res.status(201).json(success(booking, '预约成功'));
  } catch (e) { next(e); }
});

// 会员取消私教/陪练预约
router.delete('/private/:bookingId', authRole(['member', 'admin']), (req, res, next) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM private_bookings WHERE id = ?').get(req.params.bookingId);
    if (!booking) throw new BizError('预约不存在', 404);
    if (req.user.role === 'member' && booking.member_id !== req.user.memberId) {
      throw new BizError('无权取消他人预约', 403);
    }
    if (booking.status !== 'BOOKED') throw new BizError('预约已取消或已完成', 400);

    db.prepare("UPDATE private_bookings SET status = 'CANCELLED', cancelled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?")
      .run(now(), req.body?.reason || '会员取消', now(), req.params.bookingId);

    res.json(success({ cancelled: true }));
  } catch (e) { next(e); }
});

// 会员的私教/陪练预约列表
router.get('/private/mine', authRole(['member']), (req, res, next) => {
  try {
    const db = getDb();
    const list = db.prepare(`
      SELECT pb.*, c.name as coach_name
      FROM private_bookings pb
      JOIN coaches c ON pb.coach_id = c.id
      WHERE pb.member_id = ?
      ORDER BY pb.date DESC, pb.start_time DESC
    `).all(req.user.memberId);
    res.json(success(list));
  } catch (e) { next(e); }
});

// 教练的私教/陪练预约列表
router.get('/private/coach', authRole(['coach']), (req, res, next) => {
  try {
    const db = getDb();
    const { date, status } = req.query;
    let where = 'WHERE pb.coach_id = ?';
    const params = [req.user.id];
    if (date) { where += ' AND pb.date = ?'; params.push(date); }
    if (status) { where += ' AND pb.status = ?'; params.push(status); }
    const list = db.prepare(`
      SELECT pb.*, m.name as member_name, m.phone as member_phone
      FROM private_bookings pb
      JOIN members m ON pb.member_id = m.id
      ${where}
      ORDER BY pb.date DESC, pb.start_time DESC
    `).all(...params);
    res.json(success(list));
  } catch (e) { next(e); }
});

// 教练取消会员的私教/陪练预约
router.delete('/private/:bookingId/coach-cancel', authRole(['coach', 'admin']), (req, res, next) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM private_bookings WHERE id = ?').get(req.params.bookingId);
    if (!booking) throw new BizError('预约不存在', 404);
    if (req.user.role === 'coach' && booking.coach_id !== req.user.id) {
      throw new BizError('无权取消', 403);
    }
    if (booking.status !== 'BOOKED') throw new BizError('预约已取消或已完成', 400);

    db.prepare("UPDATE private_bookings SET status = 'CANCELLED', cancelled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?")
      .run(now(), req.body?.reason || '教练取消', now(), req.params.bookingId);

    res.json(success({ cancelled: true }));
  } catch (e) { next(e); }
});

// ============ 教练日历排班网格 ============

// 获取教练某天的排班网格（每个小时一个格子，含状态）
router.get('/:coachId/daily-grid', authRole(['admin', 'coach', 'member']), (req, res, next) => {
  try {
    const db = getDb();
    const coachId = req.params.coachId;
    const { date } = req.query;
    if (!date) throw new BizError('date 参数必填');

    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay();

    // 1. 取教练该周几的可用时间模板
    const templates = db.prepare('SELECT * FROM coach_availability_templates WHERE coach_id = ? AND day_of_week = ? AND status = ?')
      .all(coachId, dayOfWeek, 'ACTIVE');

    // 生成小时段列表
    const templateHours = new Set();
    for (const t of templates) {
      for (let h = t.start_hour; h < t.end_hour; h++) {
        templateHours.add(h);
      }
    }

    // 2. 取请假记录
    const timeOffs = db.prepare('SELECT * FROM coach_time_off WHERE coach_id = ? AND date = ?').all(coachId, date);
    const restHours = new Set();
    for (const off of timeOffs) {
      const startH = parseInt(off.start_time.split(':')[0]);
      const endH = parseInt(off.end_time.split(':')[0]);
      for (let h = startH; h < endH; h++) restHours.add(h);
    }

    // 3. 取已预约的私教/陪练
    const privateBookings = db.prepare(`SELECT start_time FROM private_bookings WHERE coach_id = ? AND date = ? AND status = 'BOOKED'`).all(coachId, date);
    const bookedHours = new Set();
    for (const pb of privateBookings) {
      bookedHours.add(parseInt(pb.start_time.split(':')[0]));
    }

    // 4. 取其他课程冲突
    const sessions = db.prepare(`SELECT start_time, end_time FROM sessions WHERE coach_id = ? AND date = ? AND status = 'SCHEDULED'`).all(coachId, date);
    const conflictHours = new Set();
    for (const s of sessions) {
      const startH = parseInt(s.start_time.split(':')[0]);
      const endH = parseInt(s.end_time.split(':')[0]);
      for (let h = startH; h < endH; h++) conflictHours.add(h);
    }

    // 5. 生成网格（8:00 - 22:00）
    const slots = [];
    for (let h = 8; h < 22; h++) {
      let status = 'UNSCHEDULED';
      if (templateHours.has(h)) status = 'AVAILABLE';
      if (restHours.has(h)) status = 'REST';
      if (bookedHours.has(h)) status = 'BOOKED';
      if (conflictHours.has(h)) status = 'CONFLICT';

      slots.push({
        hour: h,
        start_time: `${String(h).padStart(2, '0')}:00`,
        end_time: `${String(h + 1).padStart(2, '0')}:00`,
        status,
      });
    }

    res.json(success({ date, slots }));
  } catch (e) { next(e); }
});

// 切换时段状态（上班/休息）
router.put('/:coachId/toggle-slot', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const coachId = req.params.coachId;
    const { date, startHour, status } = req.body || {};
    if (!date || startHour === undefined || !status) throw new BizError('date、startHour、status 必填');
    if (!['AVAILABLE', 'REST'].includes(status)) throw new BizError('仅支持 AVAILABLE 或 REST');

    const startTime = `${String(startHour).padStart(2, '0')}:00`;
    const endTime = `${String(startHour + 1).padStart(2, '0')}:00`;

    if (status === 'REST') {
      // 添加请假记录
      const existing = db.prepare('SELECT id FROM coach_time_off WHERE coach_id = ? AND date = ? AND start_time = ?').get(coachId, date, startTime);
      if (!existing) {
        db.prepare('INSERT INTO coach_time_off (id, coach_id, date, start_time, end_time, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(uuid(), coachId, date, startTime, endTime, '管理员排班休息', now());
      }
    } else {
      // 移除请假记录 → 恢复可用
      db.prepare('DELETE FROM coach_time_off WHERE coach_id = ? AND date = ? AND start_time = ?').run(coachId, date, startTime);
    }

    writeAudit({ entity: 'coach_schedule', entityId: coachId, action: 'TOGGLE_SLOT', operator: operatorFromReq(req), detail: { date, startHour, status } });
    res.json(success({ updated: true }));
  } catch (e) { next(e); }
});

// 批量排班（多日期 + 多时段 → 统一设置上班/休息）
router.post('/:coachId/batch-schedule', authRole(['admin']), (req, res, next) => {
  try {
    const db = getDb();
    const coachId = req.params.coachId;
    const { dates, hours, status } = req.body || {};
    if (!Array.isArray(dates) || !Array.isArray(hours) || !status) throw new BizError('dates、hours、status 必填');
    if (!['AVAILABLE', 'REST'].includes(status)) throw new BizError('仅支持 AVAILABLE 或 REST');

    let count = 0;
    for (const date of dates) {
      for (const h of hours) {
        const startTime = `${String(h).padStart(2, '0')}:00`;
        const endTime = `${String(h + 1).padStart(2, '0')}:00`;
        if (status === 'REST') {
          const existing = db.prepare('SELECT id FROM coach_time_off WHERE coach_id = ? AND date = ? AND start_time = ?').get(coachId, date, startTime);
          if (!existing) {
            db.prepare('INSERT INTO coach_time_off (id, coach_id, date, start_time, end_time, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .run(uuid(), coachId, date, startTime, endTime, '批量排班休息', now());
          }
        } else {
          db.prepare('DELETE FROM coach_time_off WHERE coach_id = ? AND date = ? AND start_time = ?').run(coachId, date, startTime);
        }
        count++;
      }
    }

    writeAudit({ entity: 'coach_schedule', entityId: coachId, action: 'BATCH_SCHEDULE', operator: operatorFromReq(req), detail: { dates, hours, status, count } });
    res.json(success({ count }));
  } catch (e) { next(e); }
});

export default router;
