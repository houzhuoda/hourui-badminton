// 课表服务：排课、冲突校验、课次管理
import { getDb } from '../db/index.js';
import { uuid, now, formatDate } from '../utils/helpers.js';
import { SESSION_STATUS, AUDIT_ACTIONS } from '../../../shared/constants.js';
import { writeAudit, operatorFromReq } from './audit.js';
import { BizError } from '../middleware/error.js';

// 时间重叠检测
function timeOverlap(s1, e1, s2, e2) {
  return s1 < e2 && s2 < e1;
}

// 业务类型分类
const GROUP_CLASSES = ['ADULT_GROUP', 'KID_GROUP', 'FITNESS', 'GYM'];
const PRIVATE_TYPES = ['PRIVATE', 'PRACTICE'];

// 冲突校验（SCH-002）：同教练/同场地时间重叠
// 大课类为最高优先级，其他课不能和大课冲突
export function checkConflict({ coachId, courtId, date, startTime, endTime, excludeSessionId, businessType }) {
  const db = getDb();
  const sessions = db.prepare(`SELECT * FROM sessions WHERE date = ? AND status = ?`).all(date, SESSION_STATUS.SCHEDULED);
  const conflicts = [];
  const isGroupClass = businessType && GROUP_CLASSES.includes(businessType);

  for (const s of sessions) {
    if (excludeSessionId && s.id === excludeSessionId) continue;
    if (!timeOverlap(s.start_time, s.end_time, startTime, endTime)) continue;

    // 场地冲突
    if (courtId && s.court_id === courtId) {
      conflicts.push({ type: 'court', sessionId: s.id, message: `场地时间冲突（${s.start_time}-${s.end_time}，${s.business_type}）` });
    }

    // 教练冲突
    if (s.coach_id === coachId) {
      conflicts.push({ type: 'coach', sessionId: s.id, message: `教练时间冲突（${s.start_time}-${s.end_time}，${s.business_type}）` });
    }
  }
  return conflicts;
}

// 排课
export function createSession(data, operator) {
  const { courseId, coachId, courtId, date, startTime, endTime, capacity, bookingOpen, note, venueId, participantIds } = data;
  if (!courseId || !coachId || !date || !startTime || !endTime) throw new BizError('课程、教练、日期、时间必填');
  if (startTime >= endTime) throw new BizError('开始时间须早于结束时间');

  const db = getDb();
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) throw new BizError('课程不存在');
  const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(coachId);
  if (!coach) throw new BizError('教练不存在');

  // 冲突校验（包含场地冲突）
  const conflicts = checkConflict({ coachId, courtId, date, startTime, endTime, businessType: course.business_type });
  if (conflicts.length > 0) throw new BizError(`排课冲突：${conflicts.map((c) => c.message).join('；')}`);

  // 私教/陪练容量为 1（SCH-005）
  let cap = capacity || 1;
  if (['PRIVATE', 'PRACTICE'].includes(course.business_type)) cap = 1;

  const id = uuid();
  db.prepare(`INSERT INTO sessions (id, course_id, business_type, coach_id, court_id, venue_id, date, start_time, end_time, capacity, booked_count, status, booking_open, note, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`)
    .run(id, courseId, course.business_type, coachId, courtId || null, venueId || null, date, startTime, endTime, cap, SESSION_STATUS.SCHEDULED, bookingOpen ? 1 : 0, note || null, now(), now());

  // 绑定学员（排课指定）
  if (participantIds && Array.isArray(participantIds)) {
    for (const memberId of participantIds) {
      db.prepare(`INSERT OR IGNORE INTO session_participants (id, session_id, member_id, source, status, created_at) VALUES (?, ?, ?, 'ASSIGNED', 'ENROLLED', ?)`)
        .run(uuid(), id, memberId, now());
    }
  }

  writeAudit({ entity: 'session', entityId: id, action: AUDIT_ACTIONS.CREATE, operator, detail: data });
  return getSessionDetail(id);
}

// 课次详情
export function getSessionDetail(id) {
  const db = getDb();
  const s = db.prepare(`
    SELECT s.*, c.name as course_name, c.business_type, co.name as coach_name, ct.name as court_name
    FROM sessions s
    LEFT JOIN courses c ON s.course_id = c.id
    LEFT JOIN coaches co ON s.coach_id = co.id
    LEFT JOIN courts ct ON s.court_id = ct.id
    WHERE s.id = ?
  `).get(id);
  if (!s) throw new BizError('课次不存在', 404);
  s.participants = db.prepare(`
    SELECT sp.*, m.name as member_name, m.phone as member_phone_encrypted
    FROM session_participants sp
    LEFT JOIN members m ON sp.member_id = m.id
    WHERE sp.session_id = ? AND sp.status = 'ENROLLED'
  `).all(id);
  s.bookings = db.prepare(`
    SELECT b.*, m.name as member_name
    FROM bookings b
    LEFT JOIN members m ON b.member_id = m.id
    WHERE b.session_id = ?
  `).all(id);
  s.attendance = db.prepare('SELECT * FROM attendance WHERE session_id = ?').all(id);
  return s;
}

// 课表查询（周/日视图）
export function listSessions(query) {
  const db = getDb();
  const where = [`s.status != 'DELETED'`];
  const params = [];
  if (query.coachId) { where.push('s.coach_id = ?'); params.push(query.coachId); }
  if (query.courtId) { where.push('s.court_id = ?'); params.push(query.courtId); }
  if (query.businessType) { where.push('s.business_type = ?'); params.push(query.businessType); }
  if (query.status) { where.push('s.status = ?'); params.push(query.status); }
  if (query.date) { where.push('s.date = ?'); params.push(query.date); }
  if (query.startDate) { where.push('s.date >= ?'); params.push(query.startDate); }
  if (query.endDate) { where.push('s.date <= ?'); params.push(query.endDate); }
  const whereSql = where.join(' AND ');
  const list = db.prepare(`
    SELECT s.*, c.name as course_name, co.name as coach_name, ct.name as court_name
    FROM sessions s
    LEFT JOIN courses c ON s.course_id = c.id
    LEFT JOIN coaches co ON s.coach_id = co.id
    LEFT JOIN courts ct ON s.court_id = ct.id
    WHERE ${whereSql} ORDER BY s.date, s.start_time
  `).all(...params);
  return list;
}

// 修改课次
export function updateSession(id, data, operator) {
  const db = getDb();
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!s) throw new BizError('课次不存在', 404);
  if (s.status === SESSION_STATUS.COMPLETED) throw new BizError('已完成课次不可修改');

  const { coachId, courtId, date, startTime, endTime, capacity, bookingOpen, status, note } = data;
  // 若改时间需重新校验冲突
  if ((date || startTime || endTime || coachId || courtId) && s.status === SESSION_STATUS.SCHEDULED) {
    const conflicts = checkConflict({
      coachId: coachId || s.coach_id,
      courtId: courtId || s.court_id,
      date: date || s.date,
      startTime: startTime || s.start_time,
      endTime: endTime || s.end_time,
      excludeSessionId: id,
      businessType: s.business_type,
    });
    if (conflicts.length > 0) throw new BizError(`修改冲突：${conflicts.map((c) => c.message).join('；')}`);
  }
  const updates = {};
  if (coachId) updates.coach_id = coachId;
  if (courtId !== undefined) updates.court_id = courtId;
  if (date) updates.date = date;
  if (startTime) updates.start_time = startTime;
  if (endTime) updates.end_time = endTime;
  if (capacity !== undefined) updates.capacity = capacity;
  if (bookingOpen !== undefined) updates.booking_open = bookingOpen ? 1 : 0;
  if (status) updates.status = status;
  if (note !== undefined) updates.note = note;
  if (Object.keys(updates).length === 0) return getSessionDetail(id);
  const sets = Object.keys(updates).map((k) => `${k === 'coachId' ? 'coach_id' : k === 'courtId' ? 'court_id' : k === 'startTime' ? 'start_time' : k === 'endTime' ? 'end_time' : k === 'bookingOpen' ? 'booking_open' : k} = ?`).join(', ');
  db.prepare(`UPDATE sessions SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(updates), now(), id);
  writeAudit({ entity: 'session', entityId: id, action: AUDIT_ACTIONS.UPDATE, operator, detail: updates });
  return getSessionDetail(id);
}

// 取消课次（SCH-006：通知相关教练，自动取消约课 MBR-008）
export function cancelSession(id, operator, reason) {
  const db = getDb();
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!s) throw new BizError('课次不存在', 404);
  if (s.status === SESSION_STATUS.CANCELLED) throw new BizError('课次已取消');

  db.transaction(() => {
    db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?').run(SESSION_STATUS.CANCELLED, now(), id);
    // 自动取消约课（MBR-008）
    db.prepare("UPDATE bookings SET status = 'CANCELLED', cancelled_at = ?, cancel_reason = ? WHERE session_id = ? AND status = 'BOOKED'")
      .run(now(), `课次已取消：${reason || ''}`, id);
    // 回滚已约课位
    db.prepare('UPDATE sessions SET booked_count = 0 WHERE id = ?').run(id);
  })();

  writeAudit({ entity: 'session', entityId: id, action: AUDIT_ACTIONS.DELETE, operator, detail: { reason } });
  return { cancelled: true };
}

// 模板化排课（SCH-007：按周/按月批量生成）
export function batchCreateSessions(data, operator) {
  const { courseId, coachId, courtId, capacity, bookingOpen, note, participantIds, weeklySlots, startDate, endDate, venueId } = data;
  if (!courseId || !coachId || !weeklySlots?.length || !startDate || !endDate) throw new BizError('课程、教练、时段、日期范围必填');

  const db = getDb();
  const results = [];
  const errors = [];
  // 遍历日期范围内的每一天
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay(); // 0=周日
    const dateStr = d.toISOString().slice(0, 10);
    for (const slot of weeklySlots) {
      if (slot.dayOfWeek !== dayOfWeek) continue;
      try {
        const session = createSession({
          courseId, coachId, courtId, date: dateStr, startTime: slot.startTime, endTime: slot.endTime,
          capacity, bookingOpen, note, venueId, participantIds,
        }, operator);
        results.push(session.id);
      } catch (e) {
        errors.push({ date: dateStr, slot: `${slot.startTime}-${slot.endTime}`, error: e.message });
      }
    }
  }
  return { created: results.length, errors, sessionIds: results };
}

// 添加学员到课次
export function addParticipant(sessionId, memberId, operator) {
  const db = getDb();
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!s) throw new BizError('课次不存在', 404);
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!m) throw new BizError('会员不存在', 404);
  if (m.status !== 'ACTIVE') throw new BizError('会员已停用');
  db.prepare(`INSERT OR IGNORE INTO session_participants (id, session_id, member_id, source, status, created_at) VALUES (?, ?, ?, 'ASSIGNED', 'ENROLLED', ?)`)
    .run(uuid(), sessionId, memberId, now());
  writeAudit({ entity: 'session', entityId: sessionId, action: 'ADD_PARTICIPANT', operator, detail: { memberId } });
  return getSessionDetail(sessionId);
}

// 移除学员
export function removeParticipant(sessionId, memberId, operator) {
  const db = getDb();
  db.prepare("UPDATE session_participants SET status = 'REMOVED' WHERE session_id = ? AND member_id = ?").run(sessionId, memberId);
  writeAudit({ entity: 'session', entityId: sessionId, action: 'REMOVE_PARTICIPANT', operator, detail: { memberId } });
  return { removed: true };
}
